const Gt06 = require("../src/parser");

describe("Gt06 Parser", () => {
    let parser;

    beforeEach(() => {
        parser = new Gt06();
    });

    describe("parse method", () => {
        test("should parse login message correctly", () => {
            // Sample login message: 7878 0d 01 123456789012345 6789 0123 456789 0d0a
            // Header: 7878, Length: 0d (13), Protocol: 01, IMEI: 123456789012345, Serial: 6789, CRC: 0123, End: 456789 0d0a
            const loginData = Buffer.from("78780d010123456789012345678901234567890d0a", "hex");

            parser.parse(loginData);

            expect(parser.imei).toBe(123456789012345);
            expect(parser.serialNumber).toBe(0x6789);
            expect(parser.event).toBe(0x01);
            expect(parser.expectsResponse).toBe(true);
            expect(parser.responseMsg).toBeInstanceOf(Buffer);
            expect(parser.responseMsg.length).toBeGreaterThan(0);
        });

        test("should parse location message correctly", () => {
            // Sample location message
            // This is a simplified example - in real scenarios you'd use actual captured data
            const locationData = Buffer.from(
                "78781f120b0a1f0e2a2c000000000000000000000000000000000000000000000000000000000d0a",
                "hex"
            );

            parser.parse(locationData);

            expect(parser.event).toBe(0x12);
            expect(parser.position).toBeDefined();
            expect(parser.time).toBeDefined();
        });

        test("should throw error for unknown header", () => {
            const invalidData = Buffer.from("1234567890", "hex");

            expect(() => {
                parser.parse(invalidData);
            }).toThrow();
        });

        test("should throw error for unimplemented message type", () => {
            // Message with protocol 0x13 (Status Information) which is not implemented
            const statusData = Buffer.from("787805130123450d0a", "hex");

            expect(() => {
                parser.parse(statusData);
            }).toThrow();
        });

        test("should throw error for unknown message type", () => {
            // Message with unknown protocol 0x99
            const unknownData = Buffer.from("787805990123450d0a", "hex");

            expect(() => {
                parser.parse(unknownData);
            }).toThrow();
        });
    });

    describe("clearMsgBuffer method", () => {
        test("should clear message buffer", () => {
            const loginData = Buffer.from("78780d010123456789012345678901234567890d0a", "hex");
            parser.parse(loginData);

            expect(parser.msgBuffer.length).toBeGreaterThan(0);

            parser.clearMsgBuffer();

            expect(parser.msgBuffer.length).toBe(0);
        });
    });
});
