# GT06 Parser

A Node.js library for parsing GT06 GPS tracking device protocol messages. The GT06 protocol is commonly used by GPS trackers to communicate location data, status updates, and alarms over TCP/UDP connections.

## Installation

```bash
npm install gt06-parser
```

## Overview

The GT06 protocol uses binary messages with a specific format. This library provides a parser that can decode incoming messages from GT06 devices and extract useful information such as GPS coordinates, device status, and alarm conditions.

## Quick Start

```javascript
const Gt06 = require('gt06-parser');

const parser = new Gt06();

// Example binary data from device (as Buffer)
const rawData = Buffer.from('78780d010123456789012345678901234567890d0a', 'hex');

try {
    parser.parse(rawData);

    console.log('Parsed data:', parser);
    console.log('IMEI:', parser.imei);
    console.log('Event type:', parser.event.string);

    if (parser.expectsResponse) {
        // Send response back to device
        console.log('Response needed:', parser.responseMsg);
    }
} catch (error) {
    console.error('Parse error:', error);
}
```

## API Reference

### Gt06 Class

The main parser class.

#### Constructor

```javascript
const parser = new Gt06();
```

#### Properties

- `imei`: The device's IMEI number (set after login message)
- `event`: Object with `number` (protocol byte) and `string` (human-readable type)
- `expectsResponse`: Boolean indicating if the device expects an acknowledgment
- `responseMsg`: Buffer containing the response message to send back (if `expectsResponse` is true)
- `msgBuffer`: Array of all parsed messages in the current buffer
- `msgBufferRaw`: Array of raw message buffers

#### Methods

##### `parse(data)`

Parses binary data from the device.

**Parameters:**
- `data` (Buffer): Raw binary data received from the device

**Throws:**
- `{error: 'unknown message header'}` if data doesn't start with 0x7878
- `{error: 'unknown message type'}` for unsupported protocol numbers

**Effects:**
- Updates the parser's state with the latest message data
- Populates `msgBuffer` with all messages found in the data
- Sets `expectsResponse` and `responseMsg` if acknowledgment is needed

##### `clearMsgBuffer()`

Clears the message buffer array.

## Supported Message Types

### Login Message (0x01)

Sent when device connects to server.

**Parsed Data:**
- `imei`: Device IMEI number
- `serialNumber`: Message serial number

**Response Required:** Yes

### Location Message (0x12)

Contains GPS location data.

**Parsed Data:**
- `time`: Object with `fixTime` (Date) and `fixTimestamp` (Unix timestamp)
- `position`: Object containing:
  - `lat`, `lon`: GPS coordinates
  - `speed`: Speed in km/h
  - `course`: Direction in degrees
  - `gpsPositioned`: Boolean indicating GPS fix
  - `realTimeGps`: Boolean for real-time GPS
  - `satellites`: Object with `total` and `active` satellite counts
- `lbs`: Cell tower information (MCC, MNC, LAC, Cell ID)
- `serial`: Message serial number

### Status Message (0x13)

Device status update.

**Parsed Data:**
- `terminal`: Object with device status:
  - `oilDisconnected`: Oil/electric cut-off status
  - `gpsTracking`: GPS tracking enabled
  - `alarm`: Alarm type ("normal", "shock", "power_cut", "low_battery", "sos")
  - `charging`: Battery charging status
  - `acc`: ACC (ignition) status
  - `activated`: Device activation status
- `power`: Object with `voltageLevel`
- `network`: Object with `gsmSignal` strength
- `lbs`: Cell tower information
- `serial`: Message serial number

**Response Required:** Yes

### Alarm Message (0x16)

Triggered by alarm conditions.

**Parsed Data:**
- Same as location message plus:
- `terminal`: Device status (same as status message)
- `power`: Voltage level
- `network`: GSM signal strength

## Usage Examples

### TCP Server Example

```javascript
const net = require('net');
const Gt06 = require('gt06-parser');

const server = net.createServer((socket) => {
    const parser = new Gt06();

    socket.on('data', (data) => {
        try {
            parser.parse(data);

            // Process the parsed data
            switch (parser.event.string) {
                case 'login':
                    console.log(`Device ${parser.imei} logged in`);
                    break;
                case 'location':
                    console.log(`Location: ${parser.position.lat}, ${parser.position.lon}`);
                    break;
                case 'status':
                    console.log(`Status: ACC ${parser.terminal.acc ? 'ON' : 'OFF'}`);
                    break;
                case 'alarm':
                    console.log(`Alarm: ${parser.terminal.alarm}`);
                    break;
            }

            // Send response if required
            if (parser.expectsResponse) {
                socket.write(parser.responseMsg);
            }

        } catch (error) {
            console.error('Parse error:', error);
        }
    });
});

server.listen(8080, () => {
    console.log('GT06 server listening on port 8080');
});
```

### Handling Multiple Messages

```javascript
const parser = new Gt06();
const data = Buffer.from(/* multiple messages */);

parser.parse(data);

// Process all messages
parser.msgBuffer.forEach((msg, index) => {
    console.log(`Message ${index}:`, msg.event.string);
});

// Clear buffer after processing
parser.clearMsgBuffer();
```

## Data Formats

### GPS Coordinates

- Latitude/Longitude are in decimal degrees
- Speed is in km/h
- Course is in degrees (0-360)

### Cell Tower Information (LBS)

```javascript
{
    mcc: 510,        // Mobile Country Code
    mnc: 10,         // Mobile Network Code
    lac: 12345,      // Location Area Code
    cellId: 123456   // Cell ID
}
```

### Terminal Status

The terminal byte contains multiple flags:
- Bit 7: Oil disconnected
- Bit 6: GPS tracking enabled
- Bits 5-3: Alarm code
- Bit 2: Charging
- Bit 1: ACC on
- Bit 0: Device activated

## Error Handling

The parser throws errors for:
- Invalid message headers (not starting with 0x7878)
- Unknown message types
- Buffer underflow during parsing

Always wrap `parse()` calls in try-catch blocks.

## Testing

This library includes unit tests and output tests to verify functionality.

### Running Tests

```bash
npm test
```

### Test Coverage

The test suite covers:
- Login message parsing
- Location message parsing
- Error handling for invalid headers and unknown message types
- Message buffer management

### Output Testing

Run the output test to see parsed data examples:

```bash
node test/output-test.js
```

This demonstrates the parser with sample messages and shows the expected output format.

## Contributors

- **Meisha Putradewan** - Original author
- **Faris Rafi Pramana** - Contributor

## Protocol Notes

- All messages start with 0x7878 and end with 0x0D0A
- Multi-byte values are big-endian
- CRC16 checksum is used for validation
- Some devices may have OEM-specific variations (handled via options in readLbs)

## License

MIT