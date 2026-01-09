/**
 * Cursor class for reading binary data from buffers
 * Provides methods to read various data types with bounds checking
 */
class Cursor {
    /**
     * @param {Buffer} buffer - The buffer to read from
     */
    constructor(buffer) {
        if (!Buffer.isBuffer(buffer)) {
            throw new Error("Cursor expects Buffer");
        }
        this.buf = buffer;
        this.offset = 0;
    }

    /**
     * Get remaining bytes in buffer
     * @returns {number} Number of remaining bytes
     */
    remaining() {
        return this.buf.length - this.offset;
    }

    /**
     * Ensure enough bytes are available
     * @param {number} n - Number of bytes needed
     * @throws {Error} If not enough bytes available
     */
    ensure(n) {
        if (this.remaining() < n) {
            throw new Error(`Out of bounds: need ${n}, have ${this.remaining()}`);
        }
    }

    /**
     * Skip n bytes
     * @param {number} n - Number of bytes to skip
     */
    skip(n) {
        this.ensure(n);
        this.offset += n;
    }

    /**
     * Read unsigned 8-bit integer
     * @returns {number} The byte value
     */
    u8() {
        this.ensure(1);
        return this.buf.readUInt8(this.offset++);
    }

    /**
     * Read unsigned 16-bit integer (big-endian)
     * @returns {number} The 16-bit value
     */
    u16() {
        this.ensure(2);
        const v = this.buf.readUInt16BE(this.offset);
        this.offset += 2;
        return v;
    }

    /**
     * Read unsigned 32-bit integer (big-endian)
     * @returns {number} The 32-bit value
     */
    u32() {
        this.ensure(4);
        const v = this.buf.readUInt32BE(this.offset);
        this.offset += 4;
        return v;
    }

    /**
     * Read n bytes as buffer
     * @param {number} n - Number of bytes to read
     * @returns {Buffer} The bytes
     */
    bytes(n) {
        this.ensure(n);
        const v = this.buf.slice(this.offset, this.offset + n);
        this.offset += n;
        return v;
    }
}

module.exports = Cursor;
