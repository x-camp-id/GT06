const Gt06 = require("../src/parser");

// Output testing - demonstrating the parser with sample data

console.log("=== GT06 Parser Output Testing ===\n");

// Test 1: Login message
console.log("Test 1: Login Message");
// const loginData = Buffer.from("78780d010123456789012345678901234567890d0a", "hex");
let loginData = [120,120,13,1,8,104,105,80,96,54,52,41,0,1,109,190,13,10];
loginData = Buffer.from(loginData);
const parser1 = new Gt06();

try {
    parser1.parse(loginData);
    console.log("Parsed successfully:");
    console.log("Payload", parser1);
} catch (error) {
    console.log("Error:", error);
}

console.log("\n" + "=".repeat(50) + "\n");

// Test 2: Alarm message
console.log("Test 2: Alarm Message");
let alarmData = [120,120,37,22,26,1,8,8,13,30,170,0,171,4,163,11,118,63,163,0,16,133,0,67,5,0,0,2,0,2,128,185,13,10];
alarmData = Buffer.from(alarmData);
const parser2 = new Gt06();

try {
    parser2.parse(alarmData);
    console.log("Parsed successfully:");
    console.log("Payload", parser2);
} catch (error) {
    console.log("Error:", error);
}

console.log("\n" + "=".repeat(50) + "\n");

// // Test 3: Invalid data
// console.log("Test 3: Invalid Header");
// const invalidData = Buffer.from("1234567890", "hex");
// const parser3 = new Gt06();

// try {
//     parser3.parse(invalidData);
//     console.log("Parsed successfully (unexpected)");
// } catch (error) {
//     console.log("Expected error:", error.error);
// }
