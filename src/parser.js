const Cursor = require("./utils/cursor");
const readLbs = require("./utils/readLbs");
const decodeTerminalInfo = require("./utils/terminalInfo");
const { getCrc16, validateCrc16 } = require("./utils/crc16");

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
        const parsed = {};

        if (!checkHeader(data)) {
            throw { error: "Unknown message header", msg: data };
        }

        this.msgBufferRaw = sliceMsgsInBuff(data).slice();
        this.msgBufferRaw.forEach((buffer, idx) => {
            parsed.parseTime = Date.now();
            /* CRC Check */
            if (!validateCrc16(buffer)) {
                throw { error: "CRC checksum validation failed", msg: buffer };
            }

            /* Protocol Switch */
            const content = buffer.slice(4, buffer.length - 4);
            parsed.event = buffer[3];
            parsed.payload = {};
            switch (parsed.event) {
            case 0x01: // Login Message
                parsed.expectsResponse = true;
                Object.assign(parsed.payload, parseLogin(content));
                break;
            case 0x12: // Location Data Message
                parsed.expectsResponse = false;
                Object.assign(parsed.payload, parseLocation(content));
                Object.assign(parsed.payload, parseLBS(content.slice(18)));
                break;
            case 0x13: // Status Information (Heartbeat)
                parsed.expectsResponse = true;
                Object.assign(parsed.payload, parseStatus(content));
                break;
            case 0x16: // Alarm Data
                parsed.expectsResponse = true;
                Object.assign(parsed.payload, parseAlarm(content));
                break;
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

            /* Serial Number */
            parsed.serialNumber = data.readUInt16BE(12);

            /* Response Message */
            if (parsed.expectsResponse) {
                parsed.responseMsg = createResponse(buffer);
            }

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
    const c = new Cursor(data);

    return {
        imei: BigInt("0x" + c.bytes(8).toString("hex")).toString(),
    };
}

/**
 * Parse location message
 * @param {Buffer} buffer - Message buffer
 * @returns {Object} Parsed location data
 */
function parseLocation(buffer) {
    const c = new Cursor(buffer);
    
    const datetime = c.bytes(6);
    const satellites = c.u8();
    const latitude = c.u32();
    const longitude = c.u32();
    const speed = c.u8();
    const course = c.u16();

    return {
        datetime: parseDatetime(datetime).getTime(),
        latitude: decodeGt06Lat(latitude, course),
        longitude: decodeGt06Lon(longitude, course),
        speed,
        satellites: satellites & 0x0f,
        gpsLength: satellites >> 4,
        gpsFixed: (course & 0x1000) !== 0,
        course: course & 0x03ff,
    };
}


/**
 * Parse location message
 * @param {Buffer} buffer - Message buffer
 * @returns {Object} Parsed location data
 */
function parseLBS(buffer) {
    const c = new Cursor(buffer);
    
    const mcc = c.u16();
    const mnc = c.u8();
    const lac = c.u16();
    const cellId = c.u32() & 0xffffff;

    return {
        mcc,
        mnc,
        lac,
        cellId,
    };
}

/**
 * Parse status information (placeholder)
 * @param {Buffer} buffer - Message buffer
 * @returns {Object} Parsed status data
 */
function parseStatus(buffer) {
    const c = new Cursor(buffer);

    const terminal = c.u8();
    const voltage = c.u8();
    const signal = c.u8();
    const alarmLanguage = c.u16();

    return {
        terminal: decodeTerminalInfo(terminal),
        voltage,
        signal,
        alarmLanguage,
    };
}

/**
 * Parse alarm message
 * @param {Buffer} buffer - Message buffer
 * @returns {Object} Parsed alarm data
 */
function parseAlarm(buffer) {
    // --- Location Data ---
    const location = parseLocation(buffer.slice(0, 18));
    buffer = buffer.slice(18);

    // --- LBS Data ---
    const lbs_length = buffer[0];
    var lbs = null;
    if (lbs_length > 0) {
        lbs = parseLBS(buffer.slice(1, 1 + lbs_length));
        buffer = buffer.slice(1 + lbs_length);
    } else {
        buffer = buffer.slice(1);
    }

    // --- Status Information ---
    const status = parseStatus(buffer);


    return {
        location,
        ...(lbs ? { lbs } : {}),
        status,
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

module.exports = Gt06;
