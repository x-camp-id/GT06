# GT06 GPS Protocol Parser

A lightweight Node.js library for parsing binary messages from GT06 GPS tracking devices. Easily decode location data, device status, and alarm information from GPS trackers using the GT06 protocol.

## Features

- ✅ Parse GT06 binary protocol messages
- ✅ Support for multiple message types (Login, Location, Status, Alarm)
- ✅ CRC16 validation for data integrity
- ✅ LBS (Location-Based Services) cell tower data parsing
- ✅ Automatic response message generation for device communication
- ✅ Simple, intuitive API

## Installation

```bash
npm install gt06-parser
```

## Quick Start

```javascript
const Gt06 = require('gt06-parser');

const parser = new Gt06();

// Parse binary data from your GPS device
const deviceData = Buffer.from([...]);  // Raw binary data from GT06 device
const result = parser.parse(deviceData);

console.log(result);
// Output includes: event, payload, serialNumber, responseMsg
```

## Usage Guide

### Basic Setup

```javascript
const Gt06 = require('gt06-parser');
const parser = new Gt06();
```

### Parsing Device Data

```javascript
try {
  parser.parse(incomingBuffer);
  
  // Access parsed messages
  console.log('Message Event:', parser.event);
  console.log('Payload:', parser.payload);
  console.log('Serial Number:', parser.serialNumber);
  
  // If device expects a response
  if (parser.responseMsg) {
    device.send(parser.responseMsg);
  }
  
  // Access all parsed messages in buffer
  console.log('All messages:', parser.msgBuffer);
} catch (error) {
  console.error('Parse error:', error.error);
}
```

## Output Format

Each parsed message returns a structured object with the following information:

### Common Fields

| Field | Type | Description |
|-------|------|-------------|
| `event` | `number` | Message type identifier (0x01, 0x12, 0x13, 0x16) |
| `parseTime` | `number` | Unix timestamp of when message was parsed |
| `serialNumber` | `number` | Device serial number |
| `payload` | `object` | Message-specific data (see types below) |
| `expectsResponse` | `boolean` | Whether device expects a response |
| `responseMsg` | `Buffer` | Pre-generated response message (if needed) |

### Message Types

#### Login Message (0x01)

**Purpose:** Device authentication and registration

**Payload Structure:**
```javascript
{
  imei: "123456789012345"  // International Mobile Equipment Identity
}
```

**Example Output:**
```javascript
{
  event: 0x01,
  parseTime: 1673456789000,
  serialNumber: 5,
  payload: {
    imei: "862107055640871"
  },
  expectsResponse: true,
  responseMsg: Buffer<...>
}
```

---

#### Location Data Message (0x12)

**Purpose:** GPS coordinates, speed, and satellite information

**Payload Structure:**
```javascript
{
  datetime: 1673456789000,        // UTC timestamp of location
  latitude: 39.123456,             // Latitude (-90 to 90)
  longitude: -105.654321,          // Longitude (-180 to 180)
  speed: 45,                       // Speed in km/h (0-255)
  satellites: 12,                  // Number of satellites (0-15)
  gpsLength: 4,                    // GPS signal length (0-15)
  gpsFixed: true,                  // GPS fix status
  course: 180,                     // Direction heading (0-359 degrees)
  
  // Cell tower location data (LBS)
  mcc: 310,                        // Mobile Country Code
  mnc: 410,                        // Mobile Network Code
  lac: 1234,                       // Location Area Code
  cellId: 567890                   // Cell Tower ID
}
```

**Example Output:**
```javascript
{
  event: 0x12,
  parseTime: 1673456789000,
  serialNumber: 5,
  payload: {
    datetime: 1673456789000,
    latitude: 39.123456,
    longitude: -105.654321,
    speed: 45,
    satellites: 12,
    gpsLength: 4,
    gpsFixed: true,
    course: 180,
    mcc: 310,
    mnc: 410,
    lac: 1234,
    cellId: 567890
  },
  expectsResponse: false
}
```

---

#### Status Information / Heartbeat (0x13)

**Purpose:** Device health and network status

**Payload Structure:**
```javascript
{
  terminal: {
    statusFlag: 0,
    gpsSignal: true,
    powerStatus: "external",
    alarm: false
  },
  voltage: 85,                     // Battery voltage (0-255)
  signal: 25,                      // Signal strength (0-31)
  alarmLanguage: 0                 // Alarm language code
}
```

**Example Output:**
```javascript
{
  event: 0x13,
  parseTime: 1673456789000,
  serialNumber: 5,
  payload: {
    terminal: {
      statusFlag: 0,
      gpsSignal: true,
      powerStatus: "external",
      alarm: false
    },
    voltage: 85,
    signal: 25,
    alarmLanguage: 0
  },
  expectsResponse: true,
  responseMsg: Buffer<...>
}
```

---

#### Alarm Data Message (0x16)

**Purpose:** Alert events with location context

**Payload Structure:**
```javascript
{
  location: {
    // Same structure as Location Data Message
    datetime: 1673456789000,
    latitude: 39.123456,
    longitude: -105.654321,
    speed: 45,
    satellites: 12,
    gpsFixed: true,
    course: 180,
    // ... other location fields
  },
  
  lbs: {                           // Optional - only if present
    mcc: 310,
    mnc: 410,
    lac: 1234,
    cellId: 567890
  },
  
  status: {
    terminal: {...},
    voltage: 85,
    signal: 25,
    alarmLanguage: 0
  }
}
```

**Example Output:**
```javascript
{
  event: 0x16,
  parseTime: 1673456789000,
  serialNumber: 5,
  payload: {
    location: {
      datetime: 1673456789000,
      latitude: 39.123456,
      longitude: -105.654321,
      speed: 45,
      satellites: 12,
      gpsFixed: true,
      course: 180
    },
    lbs: {
      mcc: 310,
      mnc: 410,
      lac: 1234,
      cellId: 567890
    },
    status: {
      terminal: {...},
      voltage: 85,
      signal: 25,
      alarmLanguage: 0
    }
  },
  expectsResponse: true,
  responseMsg: Buffer<...>
}
```

## API Reference

### Constructor

```javascript
const parser = new Gt06();
```

### Methods

#### `parse(buffer)`

Parses raw binary data from a GT06 device.

**Parameters:**
- `buffer` (Buffer): Raw binary data from the GPS device

**Returns:** Populates parser properties: `event`, `payload`, `serialNumber`, `responseMsg`

**Throws:**
- Error with `Unknown message header` if buffer doesn't start with valid header (0x7878)
- Error with `CRC checksum validation failed` if CRC16 validation fails
- Error with `Message type not implemented` for unsupported message types
- Error with `Unknown message type` for unrecognized message types

**Example:**
```javascript
try {
  parser.parse(deviceBuffer);
  console.log(parser.payload);
} catch (err) {
  console.error('Parse failed:', err.error);
}
```

#### `clearMsgBuffer()`

Clears the internal message buffer.

**Example:**
```javascript
parser.clearMsgBuffer();
```

### Properties

- `msgBuffer` (Array): Array of all parsed messages from the current parse operation
- `msgBufferRaw` (Array): Array of raw message buffers
- `event` (number): Message type of the last parsed message
- `payload` (object): Parsed payload of the last parsed message
- `serialNumber` (number): Device serial number from the last parsed message
- `responseMsg` (Buffer): Response message to send back to device (if applicable)

## Complete Example

```javascript
const Gt06 = require('gt06-parser');
const net = require('net');

const parser = new Gt06();

const server = net.createServer((socket) => {
  socket.on('data', (buffer) => {
    try {
      parser.parse(buffer);
      
      console.log(`Message Type: 0x${parser.event.toString(16)}`);
      console.log(`Device SN: ${parser.serialNumber}`);
      
      // Handle different message types
      switch (parser.event) {
        case 0x01: // Login
          console.log(`Device IMEI: ${parser.payload.imei}`);
          break;
          
        case 0x12: // Location
          console.log(`Location: ${parser.payload.latitude}, ${parser.payload.longitude}`);
          console.log(`Speed: ${parser.payload.speed} km/h`);
          break;
          
        case 0x13: // Status
          console.log(`Battery: ${parser.payload.voltage}%`);
          console.log(`Signal: ${parser.payload.signal}`);
          break;
          
        case 0x16: // Alarm
          console.log(`ALARM at: ${parser.payload.location.latitude}, ${parser.payload.location.longitude}`);
          break;
      }
      
      // Send response if device expects one
      if (parser.responseMsg) {
        socket.write(parser.responseMsg);
      }
      
    } catch (error) {
      console.error(`Parse Error: ${error.error}`);
      socket.destroy();
    }
  });
});

server.listen(8888, '0.0.0.0');
```

## Supported Message Types

| Event Code | Name | Response Required | Description |
|-----------|------|-------------------|-------------|
| 0x01 | Login | Yes | Device authentication |
| 0x12 | Location | No | GPS location data |
| 0x13 | Status | Yes | Device heartbeat/status |
| 0x16 | Alarm | Yes | Alert/alarm event |
| 0x15 | String Info | N/A | Not yet implemented |
| 0x1A | Query Address | N/A | Not yet implemented |
| 0x80 | Command Info | N/A | Not yet implemented |

## Error Handling

```javascript
const Gt06 = require('gt06-parser');
const parser = new Gt06();

try {
  parser.parse(deviceBuffer);
} catch (error) {
  if (error.error === 'Unknown message header') {
    console.log('Invalid GT06 message header');
  } else if (error.error === 'CRC checksum validation failed') {
    console.log('Message corrupted or invalid checksum');
  } else if (error.error === 'Message type not implemented') {
    console.log(`Unsupported message type: 0x${error.event.toString(16)}`);
  }
}
```

## Unit Explanations

### Coordinate Units
- **Latitude/Longitude:** Decimal degrees (e.g., 39.123456)
- **Range:** Latitude [-90, 90], Longitude [-180, 180]

### Speed
- **Unit:** km/h (kilometers per hour)
- **Range:** 0-255

### Course/Direction
- **Unit:** Degrees
- **Range:** 0-359 (0° = North, 90° = East, 180° = South, 270° = West)

### Voltage
- **Unit:** Percentage or voltage representation (0-255)

### Signal Strength
- **Unit:** Signal bars
- **Range:** 0-31 (higher = stronger signal)

### Time
- **Unit:** Unix timestamp (milliseconds since epoch)
- **Timezone:** UTC

### Cell Tower Identifiers
- **MCC:** Mobile Country Code (e.g., 310 for USA)
- **MNC:** Mobile Network Code (e.g., 410 for AT&T USA)
- **LAC:** Location Area Code
- **Cell ID:** Unique cell tower identifier

## License

See LICENSE file for details.

## Contributing

Contributions are welcome! Please feel free to submit pull requests.

## Support

For issues, questions, or feature requests, please open an issue on GitHub.
