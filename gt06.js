const getCrc16 = require('./crc16');
const Cursor = require("./cursor");
const readLbs = require("./readLbs");
const decodeTerminalInfo = require("./terminalInfo");

module.exports = Gt06 = function () {
    this.msgBufferRaw = new Array();
    this.msgBuffer = new Array();
    this.imei = null;
}

// if multiple message are in the buffer, it will store them in msgBuffer
// the state of the last message will be represented in Gt06
Gt06.prototype.parse = function (data) {
    this.msgBufferRaw.length = 0;
    const parsed = { expectsResponse: false };

    if (!checkHeader(data)) {
        throw { error: 'unknown message header', msg: data };
    }

    this.msgBufferRaw = sliceMsgsInBuff(data).slice();
    this.msgBufferRaw.forEach((msg, idx) => {
        switch (selectEvent(msg).number) {
            case 0x01: // login message
                Object.assign(parsed, parseLogin(msg));
                parsed.imei = parsed.imei;
                parsed.expectsResponse = true;
                parsed.responseMsg = createResponse(msg);
                break;
            case 0x12: // location message
                Object.assign(parsed, parseLocation(msg), { imei: this.imei });
                break;
            case 0x13: // status message
                Object.assign(parsed, parseStatus(msg), { imei: this.imei });
                parsed.expectsResponse = true;
                parsed.responseMsg = createResponse(msg);
                break;
            // case 0x15:
            //     //parseLocation(msg);
            //     break;
            case 0x16:
                Object.assign(parsed, parseAlarm(msg), { imei: this.imei });
                break;
            // case 0x1A:
            //     //parseLocation(msg);
            //     break;
            // case 0x80:
            //     //parseLocation(msg);
            //     break;
            default:
                throw {
                    error: 'unknown message type',
                    event: selectEvent(msg)
                };
        }
        parsed.event = selectEvent(msg);
        parsed.parseTime = Date.now();
        // last message represents the obj state
        // and all go to the buffer for looped forwarding in the app
        if (idx === this.msgBufferRaw.length - 1) {
            Object.assign(this, parsed);
        }
        this.msgBuffer.push(parsed);
    });
}

Gt06.prototype.clearMsgBuffer = function () {
    this.msgBuffer.length = 0;
}

function checkHeader(data) {
    let header = data.slice(0, 2);
    if (!header.equals(Buffer.from('7878', 'hex'))) {
        return false;
    }
    return true;
}

function selectEvent(data) {
    let eventStr = 'unknown';
    switch (data[3]) {
        case 0x01:
            eventStr = 'login';
            break;
        case 0x12:
            eventStr = 'location';
            break;
        case 0x13:
            eventStr = 'status';
            break;
        case 0x16:
            eventStr = 'alarm';
            break;
        default:
            eventStr = 'unknown';
            break;
    }
    return { number: data[3], string: eventStr };
}

function parseLogin(data) {
    return {
        imei: parseInt(data.slice(4, 12).toString('hex'), 10),
        serialNumber: data.readUInt16BE(12),
        // errorCheck: data.readUInt16BE(14)
    };
}

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
            lbs
        }),
        serial,
        event: { type: "status" }
    };
}

function parseLocation(buffer) {
    const c = new Cursor(buffer);

    c.skip(2);              // 7878
    const length = c.u8();
    const protocol = c.u8();   // 0x12

    const fixTime = c.bytes(6);
    const quantity = c.u8();
    const latRaw = c.u32();
    const lonRaw = c.u32();
    const speed = c.u8();
    const course = c.u16();

    const lbs = readLbs(c);

    const serial = c.u16();
    const crc = c.u16();
    c.skip(2);              // 0D0A

    return {
        ...normalizeCommon({
            protocol,
            fixTime,
            quantity,
            latRaw,
            lonRaw,
            speed,
            course,
            lbs
        }),
        serial,
        event: { type: "location" }
    };
}


function parseAlarm(buffer) {
    const c = new Cursor(buffer);

    // --- Header ---
    c.skip(2);          // 7878
    const length = c.u8();
    const protocol = c.u8();   // 0x16

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
    c.skip(2);          // 0D0A

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
        event: { type: "alarm" }
    };
}


function createResponse(data) {
    let respRaw = Buffer.from('787805FF0001d9dc0d0a', 'hex');
    // we put the protocol of the received message into the response message
    // at position byte 3 (0xFF in the raw message)
    respRaw[3] = data[3];
    appendCrc16(respRaw);
    return respRaw;
}

function parseDatetime(data) {
    return new Date(
        Date.UTC(
            data[0] + 2000, data[1] - 1, data[2], data[3], data[4], data[5]));
}

function decodeGt06Lat(lat, course) {
    var latitude = lat / 60.0 / 30000.0;
    if (!(course & 0x0400)) {
        latitude = -latitude;
    }
    return Math.round(latitude * 1000000) / 1000000;
}

function decodeGt06Lon(lon, course) {
    var longitude = lon / 60.0 / 30000.0;
    if (course & 0x0800) {
        longitude = -longitude;
    }
    return Math.round(longitude * 1000000) / 1000000;
}

function appendCrc16(data) {
    // write the crc16 at the 4th position from the right (2 bytes)
    // the last two bytes are the line ending
    data.writeUInt16BE(getCrc16(data.slice(2, 6)).readUInt16BE(0), data.length - 4);
}

function sliceMsgsInBuff(data) {
    let startPattern = new Buffer.from('7878', 'hex');
    let nextStart = data.indexOf(startPattern, 2);
    let msgArray = new Array();

    if (nextStart === -1) {
        msgArray.push(new Buffer.from(data));
        return msgArray;
    }
    msgArray.push(new Buffer.from(data.slice(0, nextStart)));
    let redMsgBuff = new Buffer.from(data.slice(nextStart));

    while (nextStart != -1) {
        nextStart = redMsgBuff.indexOf(startPattern, 2);
        if (nextStart === -1) {
            msgArray.push(new Buffer.from(redMsgBuff));
            return msgArray;
        }
        msgArray.push(new Buffer.from(redMsgBuff.slice(0, nextStart)));
        redMsgBuff = new Buffer.from(redMsgBuff.slice(nextStart));
    }
    return msgArray;
}

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
                fixTimestamp: parseDatetime(fixTime).getTime() / 1000
            }
            : null,

        position: latRaw !== undefined ? {
            lat: decodeGt06Lat(latRaw, course),
            lon: decodeGt06Lon(lonRaw, course),
            speed,
            course: course & 0x03FF,
            gpsPositioned: Boolean(course & 0x1000),
            realTimeGps: Boolean(course & 0x2000),
            satellites: {
                total: (quantity & 0xF0) >> 4,
                active: quantity & 0x0F
            }
        } : null,

        terminal: terminalRaw !== undefined
            ? decodeTerminalInfo(terminalRaw)
            : null,

        power: voltage !== undefined
            ? { voltageLevel: voltage }
            : null,

        network: gsm !== undefined
            ? { gsmSignal: gsm }
            : null,

        lbs
    };
}