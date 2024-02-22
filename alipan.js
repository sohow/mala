const { SHA256 } = require('crypto-js');
const { ecdsaSign, publicKeyCreate } = require('secp256k1');
const getUuid = require('uuid-by-string');
const { v4 } = require('uuid');
const request = require('sync-request');
const fs = require("fs");
let {ArrCount} = require('./tools');

let alipantokenfile = "alipantoken.txt";
let driveId = '';
let parentFileId = '';

let token = {
  token_type: 'Bearer',
  user_id: '',
  device_id: '',
  access_token: '',
  signature: '',
  refresh_token: '',
  nonce: 0
};

function AlipanInitConf() {
  if (fs.existsSync(alipantokenfile)) {
      let cacheJson = fs.readFileSync(alipantokenfile, 'utf8');
      if (cacheJson) {
        token = JSON.parse(cacheJson.toString());
      }
  }
}

function GetSignature() {
  const user_id = token.user_id;
  const deviceId = token.device_id;
  const nonce = token.nonce;

  const toHex = (bytesArr) => {
    const hashArray = Array.from(bytesArr); // convert buffer to byte array
    // convert bytes to hex string
    return hashArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  }
  const toU8 = (wordArray) => {
    const words = wordArray.words;
    const sigBytes = wordArray.sigBytes;
    // Convert
    const u8 = new Uint8Array(sigBytes);
    for (let i = 0; i < sigBytes; i++) {
      u8[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
    }
    return u8;
  }
  const privateKey = toU8(SHA256(user_id));
  const publicKey = '04' + toHex(publicKeyCreate(privateKey));
  const appId = '5dde4e1bdf9e4966b387ba58f4b3fdc3';
  const signature = toHex(ecdsaSign(toU8(SHA256(`${appId}:${deviceId}:${user_id}:${nonce}`)), privateKey).signature) + '01';
  token.signature = signature;

  return { signature, publicKey };
}


function ApiSessionRefreshAccount() {
    if (!token.user_id) {
      return false;
    }

    const apiUrl = 'https://api.aliyundrive.com/users/v1/users/device/create_session';
    let { signature, publicKey } = GetSignature();
    const postData = {
      'deviceName': 'Chrome浏览器',
      'modelName': 'Windows网页版',
      'pubKey': publicKey
    };
    const resp = AlipanPost(apiUrl, postData, token.user_id, '');
    console.log(111, resp);

    if (resp.success) {
      token.signature = signature;
      return true;
    } else {
      console.log('ApiSessionRefreshAccount err=' + (resp.code || '') + ' ' + (resp?.code || ''), resp);
    }
    return false;
}

function ApiTokenRefreshAccount() {
    if (!token.refresh_token) {
      return false;
    }


    const url = 'https://auth.aliyundrive.com/v2/account/token';
    const postData = { refresh_token: token.refresh_token, grant_type: 'refresh_token' };
    const resp = AlipanPost(url, postData, '', '');
    console.log(333, resp);

    if (resp.access_token) {
      token.access_token = resp.access_token;
      token.refresh_token = resp.refresh_token;
      token.expires_in = resp.expires_in;
      token.token_type = resp.token_type;
      token.user_id = resp.user_id;
      token.user_name = resp.user_name;

      token.avatar = resp.avatar;
      token.nick_name = resp.nick_name;
      token.default_drive_id = resp.default_drive_id;
      token.default_sbox_drive_id = resp.default_sbox_drive_id;

      token.role = resp.role;
      token.status = resp.status;
      token.expire_time = resp.expire_time;
      token.state = resp.state;

      token.device_id = getUuid(resp.user_id.toString(), 5);

      return true;
    } else {
      console.log('ApiTokenRefreshAccount err=' + (resp.code || '') + ' ' + (resp?.code || ''), resp);
    }
    return false;
  }



function FreshToken(resp) {
    // // 自动刷新Token
    // if (resp.code == 'AccessTokenInvalid'
    //         || resp.code == 'AccessTokenExpired'
    //         || resp.code == 'I400JD') {
    //   return ApiTokenRefreshAccount();
    // }

    // // 自动刷新Session
    // if (resp.code == 'UserDeviceIllegality'
    //     || resp.code == 'UserDeviceOffline'
    //     || resp.code == 'DeviceSessionSignatureInvalid') {
    //   return ApiSessionRefreshAccount();
    // }

    // 自动刷新Token
    if (resp.code == 'AccessTokenInvalid'
            || resp.code == 'AccessTokenExpired'
            || resp.code == 'I400JD'
            || resp.code == 'UserDeviceIllegality'
            || resp.code == 'UserDeviceOffline'
            || resp.code == 'DeviceSessionSignatureInvalid'
            || resp.code == 'AutoRefresh') {
      let res1 = ApiTokenRefreshAccount();
      let res2 = ApiSessionRefreshAccount();

      console.log("FreshToken", resp.code, token);

      const resultJson = JSON.stringify(token);
      fs.writeFileSync(alipantokenfile, resultJson);
      return res1 && res2;
    }
    
    return false;
}

function AlipanPost(url, postData) {
  let result = {};
  try {
    const res = request('POST', url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            "Referer": "https://www.alipan.com/",
            "Content-type": "application/json;charset-utf-8",
            "Authorization": token.token_type + ' ' + token.access_token,
            "x-request-id": v4().toString(),
            "x-device-id": token.device_id,
            "x-signature": token.signature,
        },
        json: postData,
        timeout: 30000
    });

    result = JSON.parse(res.getBody('utf8'));
  }catch (e) {
    console.log("AlipanPost exp:");
    console.log(e.message);
    result = JSON.parse(e.body.toString());
  }

  return result;
}

function ListFile(drive_id, parent_file_id) {
  let data = {"drive_id":drive_id,"parent_file_id":parent_file_id,"limit":20,"all":false,"url_expire_sec":14400,"image_thumbnail_process":"image/resize,w_256/format,avif","image_url_process":"image/resize,w_1920/format,avif","video_thumbnail_process":"video/snapshot,t_120000,f_jpg,m_lfit,w_256,ar_auto,m_fast","fields":"*","order_by":"created_at","order_direction":"DESC"};
  const res = AlipanPost("https://api.aliyundrive.com/adrive/v3/file/list", data);
  return res;
}

function GetListFileByKey(key) {
  let res = ListFile(driveId, parentFileId);
  if (FreshToken(res)) {
    res = ListFile(driveId, parentFileId);
  }
  if (!res.items) {
    return [];
  }

  let result = [];
  for (const v of res.items) {
    result.push(v[key]);

  }
  return result;
}


function GetTodayUploadNum() {
  let arr = GetListFileByKey('created_at');
  let videoDate = [];
  for (const v of arr) {
      videoDate.push(new Date(v).toLocaleString().split(',')[0]);
  }
  let today = new Date().toLocaleString().split(',')[0];

  return ArrCount(videoDate, today);
}

module.exports = {
    AlipanInitConf,
    ListFile,
    FreshToken,
    GetListFileByKey,
    GetTodayUploadNum
};

//let res = ApiSessionRefreshAccount();
 //console.log(222, res);

 // AlipanInitConf();
 // res = GetListFileByKey('file_id');
 // console.log(666, res);
 // console.log("token", token);