function readLbs(cursor, options = {}) {
    const allowOem = options.allowOem !== false;
    const minBytes = options.minBytes || 8;

    if (cursor.remaining() < 1) {
        return null;
    }

    const lbsLength = cursor.u8();

    const bytesLeft = cursor.remaining() - 6; // serial + crc + stop

    // OEM behavior: length = 0 tapi data tetap ada
    if (allowOem && lbsLength === 0 && bytesLeft >= minBytes) {
        return {
            mcc: cursor.u16(),
            mnc: cursor.u8(),
            lac: cursor.u16(),
            cellId: cursor.u32() & 0xFFFFFF
        };
    }

    // Standard GT06
    if (lbsLength > 0 && cursor.remaining() >= lbsLength) {
        return {
            mcc: cursor.u16(),
            mnc: cursor.u8(),
            lac: cursor.u16(),
            cellId: cursor.u32() & 0xFFFFFF
        };
    }

    return null;
}

module.exports = readLbs;