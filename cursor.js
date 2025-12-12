class Cursor {
    constructor(buffer) {
        if (!Buffer.isBuffer(buffer)) {
            throw new Error("Cursor expects Buffer");
        }
        this.buf = buffer;
        this.offset = 0;
    }

    remaining() {
        return this.buf.length - this.offset;
    }

    ensure(n) {
        if (this.remaining() < n) {
            throw new Error(`Out of bounds: need ${n}, have ${this.remaining()}`);
        }
    }

    skip(n) {
        this.ensure(n);
        this.offset += n;
    }

    u8() {
        this.ensure(1);
        return this.buf.readUInt8(this.offset++);
    }

    u16() {
        this.ensure(2);
        const v = this.buf.readUInt16BE(this.offset);
        this.offset += 2;
        return v;
    }

    u32() {
        this.ensure(4);
        const v = this.buf.readUInt32BE(this.offset);
        this.offset += 4;
        return v;
    }

    bytes(n) {
        this.ensure(n);
        const v = this.buf.slice(this.offset, this.offset + n);
        this.offset += n;
        return v;
    }
}

module.exports = Cursor;