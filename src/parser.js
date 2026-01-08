const getCrc16 = require("./utils/crc16");
const Cursor = require("./utils/cursor");
const readLbs = require("./utils/readLbs");
const decodeTerminalInfo = require("./utils/terminalInfo");

/**
 * GT06 GPS Protocol Parser
 * Parses binary messages from GT06 GPS tracking devices
 */
class Gt06 {
    constructor() {
        this.msgBufferRaw = [];
        this.msgBuffer = [];
    }

    /**
     * Parse incoming GT06 data buffer
     * @param {Buffer} data - Raw binary data from device
     * @throws {Error} If message header is unknown or message type is not implemented
     */
    parse(data) {
        this.msgBufferRaw.length = 0;
        const parsed = { expectsResponse: false };

        if (!checkHeader(data)) {
            throw { error: "Unknown message header", msg: data };
        }

        this.msgBufferRaw = sliceMsgsInBuff(data).slice();
        this.msgBufferRaw.forEach((buffer, idx) => {
            switch (buffer[3]) {
                case 0x01: // Login Message
                    Object.assign(parsed, parseLogin(buffer));
                    parsed.expectsResponse = true;
                    parsed.responseMsg = createResponse(buffer);
                    break;
                case 0x12: // Location Data Message
                    Object.assign(parsed, parseLocation(buffer), { imei: this.imei });
                    break;
                case 0x16: // Alarm Data
                    Object.assign(parsed, parseAlarm(buffer), { imei: this.imei });
                    break;
                case 0x13: // Status Information
                case 0x15: // String Information
                case 0x1a: // GPS, Query Address Information
                case 0x80: // Command Information
                    throw {
                        error: "Message type not implemented",
                        event: buffer[3],
                    };
                default:
                    throw {
                        error: "Unknown message type",
                        event: buffer[3],
                    };
            }

            parsed.event = buffer[3];
            parsed.parseTime = Date.now();

            // Only assign to the main object on the last iteration
            if (idx === this.msgBufferRaw.length - 1) {
                Object.assign(this, parsed);
            }
            this.msgBuffer.push(parsed);
        });
    }

    /**
     * Clear the message buffer
     */
    clearMsgBuffer() {
        this.msgBuffer.length = 0;
    }
}

/**
 * Check if buffer has valid GT06 header
 * @param {Buffer} data - Data buffer
 * @returns {boolean} True if header is valid
 */
function checkHeader(data) {
    const header = data.slice(0, 2);
    return header.equals(Buffer.from("7878", "hex"));
}

/**
 * Parse login message
 * @param {Buffer} data - Message buffer
 * @returns {Object} Parsed login data
 */
function parseLogin(data) {
    return {
        imei: parseInt(data.slice(4, 12).toString("hex"), 10),
        serialNumber: data.readUInt16BE(12),
        // errorCheck: data.readUInt16BE(14)
    };
}

/**
 * Parse status information (placeholder)
 * @param {Buffer} buffer - Message buffer
 * @returns {Object} Parsed status data
 */
function parseStatus(buffer) {
    const c = new Cursor(buffer);

    c.skip(2);
    const length = c.u8();
    const protocol = c.u8();

    const terminalRaw = c.u8();
    const voltage = c.u8();
    const gsm = c.u8();

    const lbs = readLbs(c);

    const serial = c.u16();
    const crc = c.u16();
    c.skip(2);

    return {
        ...normalizeCommon({
            protocol,
            terminalRaw,
            voltage,
            gsm,
            lbs,
        }),
        serial,
        event: { type: "status" },
    };
}

/**
 * Parse location message
 * @param {Buffer} buffer - Message buffer
 * @returns {Object} Parsed location data
 */
function parseLocation(buffer) {
    const c = new Cursor(buffer);

    c.skip(2); // 7878
    const length = c.u8();
    const protocol = c.u8(); // 0x12
    const fixTime = c.bytes(6);

    const quantity = c.u8();
    const latRaw = c.u32();
    const lonRaw = c.u32();
    const speed = c.u8();
    const course = c.u16();

    const lbs = readLbs(c);

    const serial = c.u16();
    const crc = c.u16();
    c.skip(2); // 0D0A

    return {
        ...normalizeCommon({
            protocol,
            fixTime,
            quantity,
            latRaw,
            lonRaw,
            speed,
            course,
            lbs,
        }),
        serial,
        event: { type: "location" },
    };
}

/**
 * Parse alarm message
 * @param {Buffer} buffer - Message buffer
 * @returns {Object} Parsed alarm data
 */
function parseAlarm(buffer) {
    const c = new Cursor(buffer);

    // --- Header ---
    c.skip(2); // 7878
    const length = c.u8();
    const protocol = c.u8(); // 0x16

    // --- Datetime ---
    const fixTime = c.bytes(6);

    // --- GPS ---
    const quantity = c.u8();
    const latRaw = c.u32();
    const lonRaw = c.u32();
    const speed = c.u8();
    const course = c.u16();

    // --- LBS (OEM-safe) ---
    const lbs = readLbs(c);

    // --- Alarm / Status ---
    const terminalRaw = c.u8();
    const voltage = c.u8();
    const gsm = c.u8();
    const alarmLang = c.u16();

    // --- Tail ---
    const serial = c.u16();
    const crc = c.u16();
    c.skip(2); // 0D0A

    return {
        ...normalizeCommon({
            protocol,
            fixTime,
            quantity,
            latRaw,
            lonRaw,
            speed,
            course,
            terminalRaw,
            voltage,
            gsm,
            lbs,
        }),
        serial,
        event: { type: "alarm" },
    };
}

/**
 * Create response message for login
 * @param {Buffer} data - Original message buffer
 * @returns {Buffer} Response message
 */
function createResponse(data) {
    let respRaw = Buffer.from("787805FF0001d9dc0d0a", "hex");
    // Put the protocol of the received message into the response message
    // at position byte 3 (0xFF in the raw message)
    respRaw[3] = data[3];
    appendCrc16(respRaw);
    return respRaw;
}

/**
 * Parse datetime from BCD format
 * @param {Buffer} data - 6-byte datetime buffer
 * @returns {Date} Parsed date
 */
function parseDatetime(data) {
    return new Date(Date.UTC(data[0] + 2000, data[1] - 1, data[2], data[3], data[4], data[5]));
}

/**
 * Decode GT06 latitude
 * @param {number} lat - Raw latitude value
 * @param {number} course - Course value
 * @returns {number} Decoded latitude
 */
function decodeGt06Lat(lat, course) {
    let latitude = lat / 60.0 / 30000.0;
    if (!(course & 0x0400)) {
        latitude = -latitude;
    }
    return Math.round(latitude * 1000000) / 1000000;
}

/**
 * Decode GT06 longitude
 * @param {number} lon - Raw longitude value
 * @param {number} course - Course value
 * @returns {number} Decoded longitude
 */
function decodeGt06Lon(lon, course) {
    let longitude = lon / 60.0 / 30000.0;
    if (course & 0x0800) {
        longitude = -longitude;
    }
    return Math.round(longitude * 1000000) / 1000000;
}

/**
 * Append CRC16 to buffer
 * @param {Buffer} data - Buffer to append CRC to
 */
function appendCrc16(data) {
    // Write the crc16 at the 4th position from the right (2 bytes)
    // The last two bytes are the line ending
    data.writeUInt16BE(getCrc16(data.slice(2, 6)).readUInt16BE(0), data.length - 4);
}

/**
 * Slice multiple messages from buffer
 * @param {Buffer} data - Raw data buffer
 * @returns {Buffer[]} Array of message buffers
 */
function sliceMsgsInBuff(data) {
    const startPattern = Buffer.from("7878", "hex");
    let nextStart = data.indexOf(startPattern, 2);
    const msgArray = [];

    if (nextStart === -1) {
        msgArray.push(Buffer.from(data));
        return msgArray;
    }
    msgArray.push(Buffer.from(data.slice(0, nextStart)));
    let redMsgBuff = Buffer.from(data.slice(nextStart));

    while (nextStart !== -1) {
        nextStart = redMsgBuff.indexOf(startPattern, 2);
        if (nextStart === -1) {
            msgArray.push(Buffer.from(redMsgBuff));
            return msgArray;
        }
        msgArray.push(Buffer.from(redMsgBuff.slice(0, nextStart)));
        redMsgBuff = Buffer.from(redMsgBuff.slice(nextStart));
    }
    return msgArray;
}

/**
 * Normalize common fields across message types
 * @param {Object} params - Common parameters
 * @returns {Object} Normalized data object
 */
function normalizeCommon({
    protocol,
    fixTime,
    quantity,
    latRaw,
    lonRaw,
    speed,
    course,
    terminalRaw,
    voltage,
    gsm,
    lbs,
}) {
    return {
        protocol,

        time: fixTime
            ? {
                  fixTime: parseDatetime(fixTime),
                  fixTimestamp: parseDatetime(fixTime).getTime() / 1000,
              }
            : null,

        position:
            latRaw !== undefined
                ? {
                      lat: decodeGt06Lat(latRaw, course),
                      lon: decodeGt06Lon(lonRaw, course),
                      speed,
                      course: course & 0x03ff,
                      gpsPositioned: Boolean(course & 0x1000),
                      realTimeGps: Boolean(course & 0x2000),
                      satellites: {
                          total: (quantity & 0xf0) >> 4,
                          active: quantity & 0x0f,
                      },
                  }
                : null,

        terminal: terminalRaw !== undefined ? decodeTerminalInfo(terminalRaw) : null,

        power: voltage !== undefined ? { voltageLevel: voltage } : null,

        network: gsm !== undefined ? { gsmSignal: gsm } : null,

        lbs,
    };
}

module.exports = Gt06;
