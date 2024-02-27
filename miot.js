const fs = require("fs");

function GetDeviceDataLog(did) {
	const file = `/data/homeassistant/.storage/xiaomi_miot/device-data-${did}-4121.json`;
	if (fs.existsSync(file)) {
      const jsonStr = fs.readFileSync(file, 'utf8');
      if (jsonStr) {
        const res = JSON.parse(jsonStr.toString());
        if (res.data && res.data.result) {
        	return res.data.result;
        }
      }
    }
    return [];
}

function GetDviceEventByTime(did, start_time, end_time) {
	const data = GetDeviceDataLog(did);
	let arr = [];
	for (const v of data) {
        if (v.time) {
            if (v.time >= start_time && v.time <= end_time) {
                arr.push(v);
            }
        }
    }
    return arr;
}

module.exports = {
    GetDviceEventByTime
};