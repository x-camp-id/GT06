/**
 * Read LBS (Location Based Service) data from GT06 protocol
 * @param {Cursor} cursor - Cursor positioned at LBS data
 * @param {Object} options - Options for parsing
 * @param {boolean} options.allowOem - Allow OEM-specific behavior (default: true)
 * @param {number} options.minBytes - Minimum bytes for OEM mode (default: 8)
 * @returns {Object|null} LBS data or null if not available
 */
function readLbs(cursor, options = {}) {
    const allowOem = options.allowOem !== false;
    const minBytes = options.minBytes || 8;

    if (cursor.remaining() < 1) {
        return null;
    }

    const lbsLength = cursor.u8();

    const bytesLeft = cursor.remaining() - 6; // serial + crc + stop

    // OEM behavior: length = 0 but data still exists
    if (allowOem && lbsLength === 0 && bytesLeft >= minBytes) {
        return {
            mcc: cursor.u16(),
            mnc: cursor.u8(),
            lac: cursor.u16(),
            cellId: cursor.u32() & 0xffffff,
        };
    }

    // Standard GT06
    if (lbsLength > 0 && cursor.remaining() >= lbsLength) {
        return {
            mcc: cursor.u16(),
            mnc: cursor.u8(),
            lac: cursor.u16(),
            cellId: cursor.u32() & 0xffffff,
        };
    }

    return null;
}

module.exports = readLbs;
