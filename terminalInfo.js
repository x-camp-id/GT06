function decodeTerminalInfo(byte) {
    const alarmCode = (byte & 0x38) >> 3;

    return {
        raw: byte,

        oilDisconnected: Boolean(byte & 0x80),
        gpsTracking: Boolean(byte & 0x40),

        alarm: ALARM_MAP[alarmCode] || "unknown",

        charging: Boolean(byte & 0x04),
        acc: Boolean(byte & 0x02),
        activated: Boolean(byte & 0x01)
    };
}

const ALARM_MAP = {
    0: "normal",
    1: "shock",
    2: "power_cut",
    3: "low_battery",
    4: "sos"
};

module.exports = decodeTerminalInfo;