const http = require('http');
const request = require('sync-request');
const url = require("url");
const moment = require('moment');

const {
  WechatyBuilder,
  ScanStatus,
  log,
}                     = require('wechaty');
const qrcodeTerminal = require('qrcode-terminal');
const {
    AlipanInitConf,
    ListFile,
    FreshToken,
    GetListFileByKey,
    GetTodayUploadNum,
    RenewSession,
    CreateSession,
    RefreshToken
}                     = require('./alipan');
const {States} = require('./ha');
const {GetDviceEventByTime} = require('./miot');



let server = http.createServer();


let curFileList = {};
let bot = null;
let botName = '';
let lastDeviceCheckTime = new Date().valueOf(); //now


server.on('request', async (request, response) => {
    const path = url.parse(request.url,true).query;
    let refreshType = path.refresh_type;
    

    let host_meta = {};
    const remote_ip = request.socket.remoteAddress.replace('::ffff:','');
    let sayres = null;

    //response.setHeader('Content-Type', 'application/json; charset=utf-8');
    switch (url.parse(request.url).pathname) {
        case '/':
            response.statusCode = 404;
            response.end("404 NOT FOUND");
            break;
        case '/mala/alipan/refresh':
            response.setHeader('Content-Type', 'application/json; charset=utf-8');

            if (refreshType === 'session') {
                RenewSession();
            } else if (refreshType === 'token') {
                RefreshToken();
            } else if  (refreshType === 'create_session') {
                CreateSession();
            }


            response.end(JSON.stringify(
                    {
                        status: 0
                    }
                ));
            break;
        case '/mala/etv/done':
            response.setHeader('Content-Type', 'application/json; charset=utf-8');
            const did = path.did;

            let start_time =  moment().format('YYYYMMDD ') + path.start_time;
            start_time = moment(start_time).format('x') / 1000;
            let end_time =  moment().format('YYYYMMDD ') + path.end_time;
            end_time = moment(end_time).format('x') / 1000;

            let ents = GetDviceEventByTime(did, start_time, end_time);
            response.end(JSON.stringify(
                    {
                        open_times: ents.length,
                        start_time: start_time,
                        end_time: end_time
                    }
                ));
            break;
        case '/mala/alipan/notice':
            response.setHeader('Content-Type', 'application/json; charset=utf-8');
            let fileList = GetListFileByKey('file_id');
            var d = fileList.filter(function(v){ return curFileList.indexOf(v) == -1 });
            if (d.length > 0) {
                await sayToRoom('【NOTICE】 有' + d.length + '个新文件，请注意查看');
            }
            curFileList = fileList;

            response.end(JSON.stringify(
                    {
                        fileList: fileList,
                        curFileList:    curFileList,
                        d
                    }
                ));
            break;
        case '/mala/alipan/remind':
            response.setHeader('Content-Type', 'application/json; charset=utf-8');
            let num = GetTodayUploadNum();
            if (num === 0) {
                await sayToRoom('【REMIND】今天还未分享学习视频 ');
            }

            response.end(JSON.stringify(
                    {
                        TodayUploadNum: num
                    }
                ));
            break;
        case '/mala/login':
            response.setHeader('Content-Type', 'application/json; charset=utf-8');
            response.end(JSON.stringify(
                    {
                        code: -1,
                        msg:    `site or tag can not be empty`
                    }
                ));
            break;

        case '/mala/switch/state':
            response.setHeader('Content-Type', 'application/json; charset=utf-8');
            //let ent = States('binary_sensor.isa_dw2hl_6a75_magnet_sensor_2');
            if (path.start_time) {
                lastDeviceCheckTime = start_time;
            }
            let newEnts = GetDviceEventByTime(path.did, lastDeviceCheckTime, 2529560204);
            lastDeviceCheckTime = new Date().valueOf();

            if (newEnts.length > 0) {
                const msg = "";
                const time = "";
                const state = "";
                for (const v of newEnts) {
                    if (v.value === "[\"01\"]") {
                        state = "已关闭";
                    } else if (v.value === "[\"00\"]") {
                        state = "已打开";
                    } else if (v.value === "[\"02\"]") {
                        state = "超时未关闭";
                    } else {
                        state = "未知";
                    }
                    time = moment(v.time).format("HH:mm:ss");
                    msg += `${state} ${time}\n`;
                }
                await sayToRoom('【HA】抽屉: '+ path.did_name + "\n" + msg);
            }

            response.end(JSON.stringify(
                    {
                        did: path.did,
                        lastDeviceCheckTime: lastDeviceCheckTime,
                        ents: newEnts
                    }
                ));
            break;
        case '/mala/contact/say':
            const contact = await bot.Contact.find({name: 'Lunia'});
            console.log(contact);
            sayres = await contact.say('welcome to wechaty!');
            console.log(sayres);

            response.end(JSON.stringify(sayres));
            break;
        case '/mala/room/say':
            await sayToRoom('Hello!');

            response.end(JSON.stringify(sayres));
            break;
        default:
            response.statusCode = 404;
            response.end("404 NOT FOUND");
    }
});

async function sayToRoom(msg, topic) {
    if (typeof topic === 'undefined') {
        topic = '哈哈';
    }

    const room = await bot.Room.find({topic: topic});
    await room.say(msg);
}


(async ()=>{
function onScan (qrcode, status) {
  if (status === ScanStatus.Waiting || status === ScanStatus.Timeout) {
    qrcodeTerminal.generate(qrcode, { small: true })  // show qrcode on console

    const qrcodeImageUrl = [
      'https://wechaty.js.org/qrcode/',
      encodeURIComponent(qrcode),
    ].join('');

    log.info('StarterBot', 'onScan: %s(%s) - %s', ScanStatus[status], status, qrcodeImageUrl);

  } else {
    log.info('StarterBot', 'onScan: %s(%s)', ScanStatus[status], status);
  }
}

function onLogin (user) {
  log.info('StarterBot', '%s login', user);
  botName = user.name();
}

function onLogout (user) {
  log.info('StarterBot', '%s logout', user);
}

async function onMessage (msg) {
  //log.info('StarterBot', msg.toString());

  if (msg.type() === bot.Message.Type.Text) {
      const from = msg.talker();
      if (await msg.mentionSelf() || from.name() === botName) {
         //console.log('this message were mentioned me! [You were mentioned] tip ([有人@我]的提示)');
         log.info('onMessage', msg.toString());

         console.log(from.name(), botName, msg.text().replace('alipan ', ''));
        if (msg.text().indexOf('alipan ') >= 0) {
            let cmd = msg.text().replace('@' + botName + ' alipan ', '');
            if (from.name() === botName) {
                cmd = msg.text().replace('alipan ', '');
            }

            let resMsg = 'unknow command: ' + cmd;
            if (cmd === 'notice') {
                let fileList = GetListFileByKey('file_id');
                var d = fileList.filter(function(v){ return curFileList.indexOf(v) == -1 });

                resMsg = '【NOTICE】当前共' + (fileList.length - 2) + '个学习视频';

                await msg.say(resMsg);
            } else if (cmd === 'remind') {
                let num = GetTodayUploadNum();
                resMsg = '【REMIND】今天已分享' + num + '个学习视频';

                await msg.say(resMsg);
            }
            //await msg.say(resMsg);
        }
      }
  }
  
}

bot = WechatyBuilder.build({
  name: 'alipan-bot',
  /**
   * How to set Wechaty Puppet Provider:
   *
   *  1. Specify a `puppet` option when instantiating Wechaty. (like `{ puppet: 'wechaty-puppet-padlocal' }`, see below)
   *  1. Set the `WECHATY_PUPPET` environment variable to the puppet NPM module name. (like `wechaty-puppet-padlocal`)
   *
   * You can use the following providers:
   *  - wechaty-puppet-wechat (no token required)
   *  - wechaty-puppet-padlocal (token required)
   *  - wechaty-puppet-service (token required, see: <https://wechaty.js.org/docs/puppet-services>)
   *  - etc. see: <https://github.com/wechaty/wechaty-puppet/wiki/Directory>
   */
   puppet: 'wechaty-puppet-wechat4u',
});

bot.on('scan',    onScan);
bot.on('login',   onLogin);
bot.on('logout',  onLogout);
bot.on('message', onMessage);

bot.start()
  .then(() => log.info('StarterBot', 'Starter Bot Started.'))
  .catch(e => log.error('StarterBot', e))
})();

AlipanInitConf();
curFileList = GetListFileByKey('file_id');

try {
    server.listen(8088, function () {
        console.log("服务器启动成功，可以通过 http://127.0.0.1:8088/mala/contact/say 来进行访问");
    });
} catch (e) {
    console.log('server exist: ', e);
}

