const Gt06 = require("../src/parser");

// Output testing - demonstrating the parser with sample data

console.log("=== GT06 Parser Output Testing ===\n");

// Test 1: Login message
console.log("Test 1: Login Message");
const loginData = Buffer.from("78780d010123456789012345678901234567890d0a", "hex");
const parser1 = new Gt06();

try {
    parser1.parse(loginData);
    console.log("Parsed successfully:");
    console.log("- IMEI:", parser1.imei);
    console.log("- Serial Number:", parser1.serialNumber);
    console.log("- Event:", parser1.event);
    console.log("- Expects Response:", parser1.expectsResponse);
    console.log(
        "- Response Message:",
        parser1.responseMsg ? parser1.responseMsg.toString("hex") : "None"
    );
} catch (error) {
    console.log("Error:", error);
}

console.log("\n" + "=".repeat(50) + "\n");

// Test 2: Location message
console.log("Test 2: Location Message");
const locationData = Buffer.from(
    "78781f120b0a1f0e2a2c000000000000000000000000000000000000000000000000000000000d0a",
    "hex"
);
const parser2 = new Gt06();

try {
    parser2.parse(locationData);
    console.log("Parsed successfully:");
    console.log("- Event:", parser2.event);
    console.log("- Position:", JSON.stringify(parser2.position, null, 2));
    console.log("- Time:", parser2.time ? parser2.time.fixTime : "None");
} catch (error) {
    console.log("Error:", error);
}

console.log("\n" + "=".repeat(50) + "\n");

// Test 3: Invalid data
console.log("Test 3: Invalid Header");
const invalidData = Buffer.from("1234567890", "hex");
const parser3 = new Gt06();

try {
    parser3.parse(invalidData);
    console.log("Parsed successfully (unexpected)");
} catch (error) {
    console.log("Expected error:", error.error);
}
