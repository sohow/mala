const http = require('http');
const request = require('sync-request');
const url = require("url");

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



let server = http.createServer();


let curFileList = {};
let bot = null;
let botName = '';


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
        case '/mala/alipan/notice':
            response.setHeader('Content-Type', 'application/json; charset=utf-8');
            let fileList = GetListFileByKey('file_id');
            var d = fileList.filter(function(v){ return curFileList.indexOf(v) == -1 });
            if (d.length > 0) {
                const contact = await bot.Contact.find({name: '不辞远'});
                await contact.say('【NOTICE】 有' + d.length + '个新文件，请注意查看');
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
                const contact = await bot.Contact.find({name: '不辞远'});
                await contact.say('【REMIND】今天还未分享学习视频 ');
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
        case '/mala/contact/say':
            const contact = await bot.Contact.find({name: '不辞远'});
            console.log(contact);
            sayres = await contact.say('welcome to wechaty!');
            console.log(sayres);

            response.end(JSON.stringify(sayres));
            break;
        case '/mala/room/say':
            const room = await bot.Room.find({topic: '哈哈'});
            console.log(room);
            sayres = await room.say('Hello world!');
            console.log(sayres);

            response.end(JSON.stringify(sayres));
            break;
        default:
            response.statusCode = 404;
            response.end("404 NOT FOUND");
    }
});


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

  if (await msg.mentionSelf()) {
     console.log('this message were mentioned me! [You were mentioned] tip ([有人@我]的提示)');
     log.info('StarterBot', msg.toString());

    if (msg.text().indexOf('alipan ') > 0) {
        let cmd = msg.text().replace('@' + botName + ' alipan ', '');
        let resMsg = 'unknow command: ' + cmd;
        if (cmd === 'notice') {
            let fileList = GetListFileByKey('file_id');
            var d = fileList.filter(function(v){ return curFileList.indexOf(v) == -1 });

            resMsg = '【NOTICE】当前共' + (fileList.length - 2) + '个学习视频';
        } else if (cmd === 'remind') {
            let num = GetTodayUploadNum();
            resMsg = '【REMIND】今天已分享' + num + '个学习视频';
        }

        await msg.say(resMsg);
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

server.listen(8088, function () {
    console.log("服务器启动成功，可以通过 http://127.0.0.1:8088/mala/contact/say 来进行访问");
});
