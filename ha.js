const request = require('sync-request');
const gconf = require('./gconf');


function States(ent) {
	let result = {};
	try {
		let url = `http://localhost:8023/api/states/${ent}`;
		let res = request('GET', url, {
	        timeout: 3*1000,
	        headers: {
	            "Content-type": "application/json;charset-utf-8",
	            "Authorization": 'Bearer ' + gconf.haToken
	        },
	    });
		result = JSON.parse(res.getBody('utf8'));
	}catch (e) {
		console.log("HA States exp: ");
		console.log(e.message);
		result = JSON.parse(e.body.toString());
	}

  //console.log("result", result);
  return result;
}


module.exports = {
    States
};