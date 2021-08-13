var express = require('express');
var bodyParser = require('body-parser');
var fs = require('fs');
const { pid } = require('process');
var app = express();
// var fsExtra = require('fs-extra');
//使用json parser中间件
var urlencodedParser = bodyParser.urlencoded({ extended: false });
var jsonParser = bodyParser.json();

const CryptoJS = require('crypto-js');  //引用AES源码js

// const key = CryptoJS.enc.Utf8.parse("1234123412ABCDEF");
const key = CryptoJS.enc.Utf8.parse("SONTECH-TEXPRO11");  //十六位十六进制数作为密钥
const iv = CryptoJS.enc.Utf8.parse('ABCDEF1234123412');   //十六位十六进制数作为密钥偏移量

//解密方法
function Decrypt(word) {
  let encryptedHexStr = CryptoJS.enc.Hex.parse(word);
  let srcs = CryptoJS.enc.Base64.stringify(encryptedHexStr);
  let decrypt = CryptoJS.AES.decrypt(srcs, key, { iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 });
  // console.log(key.length);
  let decryptedStr = decrypt.toString(CryptoJS.enc.Utf8);
  return decryptedStr.toString();
}

//加密方法
function Encrypt(word) {
  let srcs = CryptoJS.enc.Utf8.parse(word);
  let encrypted = CryptoJS.AES.encrypt(srcs, key, { iv: iv, mode: CryptoJS.mode.CBC, padding: CryptoJS.pad.Pkcs7 });
  return encrypted.ciphertext.toString().toUpperCase();
}



// 指定静态文件
// app.use(express.static(__dirname + '\\live'));

app.all('*', function(req, res, next) {
  // 跨域访问
  res.header("Access-Control-Allow-Origin", "*");
  res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  // 这个很重要很重要
  next();

});


//上线请求
app.post('/video/Online', jsonParser, function (req, res) {
  //1、 判断请求是否有参数  
  if (Object.keys(req.body).length === 0) {
    res.send(
      {
        "code": 0,
        "msg": "操作失败",
        "data": {
          "sessionId": "",
          "info": "没有参数"
        }
      }
    );
    return;
  } 
  var key_en = Encrypt(req.body.key);
  //2、 判断请求的key是否正确
  // var key = Decrypt(req.body.key);
  var key = Decrypt("8833265A4D272FF01A3762DF246B7910");

  console.log("解密后的key：");
  console.log(key);
  // 根据约定，key是一个由设备编号组成的字符串，如："1,2,3,4,5"
  if(key.indexOf("，") > -1 || key == undefined){
    res.send(
        {
          "code": 0,
          "msg": "操作失败",
          "data": {
            "sessionId": "",
            "info": "请检查key是否正确"
          }
        }
      );
      return;
  }

  key = key.split(",");
  key.forEach(element => {
    if(element > global.configInfo.DeviceNumber || element <= 0){
        res.send(
            {
              "code": 0,
              "msg": "操作失败",
              "data": {
                "sessionId": "",
                "info": "请检查key是否正确"
              }
            }
          );
          return;
    }
  });

  
  // 生成随机数，作为sessionId
  var id = Math.random(1).toString().split('.')[1];
  // 当sessionId已存在，重新生成
  while (global.sessionIdAndTime.has(id)) {
    id = Math.random(1).toString().split('.')[1];
  }

  // 记录id及时间
  // 获得当前时间（从1970.1.1开始的毫秒数）,并把它放到全局sessionIdTime里面
  var myDate = new Date();
  global.sessionIdAndTime.set(id, myDate.getTime());

  // 初始化global.sessionIdDeviceMap
  global.sessionIdDeviceMap.set(id, new Array());
  res.send(
    {
      "code": 1,
      "msg": "操作成功",
      "data": {
        "sessionId": id,
      }
    }
  )
})



// 直播请求
app.post('/video/liveBroadcast', jsonParser, function (req, res) {

  if (Object.keys(req.body).length === 0) {
    res.send(
      {
        "code": 0,
        "msg": "操作失败",
        "data": {
          "url": [],
          "info": "没有参数"
        }
      }
    );
    return;
  }

  // 获取前端请求参数
  var number = req.body.number;
  var sessionId = req.body.sessionId;
  var type = req.body.type;



  // 判断前端是否发送需要的数据
  if (number === undefined || number.includes("，") || sessionId === undefined || type >= 3) {
    res.send(
      {
        "code": 0,
        "msg": "操作失败",
        "data": {
          "url": [],
          "info": "请检查参数是否正确"
        }
      }
    );
    return;
  }

  // 分离设备编号
  var deviceNumberList = number.split(",");
  var maxNumber = Math.max.apply(Math, Array.from(deviceNumberList));
  // 判断设备number是否正确
  if (global.configInfo.videoInfo.urlHighDefinition.length < maxNumber) {
    res.send(
      {
        "code": 0,
        "msg": "操作失败",
        "data": {
          "url": [],
          "info": "设备number过大，正常范围为：1到" + global.configInfo.videoInfo.urlHighDefinition.length
            + "之间的整数"
        }
      }
    );
    return;
  }

  // 判断sessionId是否存在
  if (!global.sessionIdAndTime.has(sessionId)) {
    res.send(
      {
        "code": 0,
        "msg": "操作失败",
        "data": {
          "url": [],
          "info": "请检查sessionId是否正确，是否过期（过期时间暂定为2分钟）"
        }
      }
    );
    return;
  }

  // 计算当前视频播放的数量
  var count = 0;
  // global.sessionIdDeviceMap.forEach((value, key) => {
  //   count += value.length;
  // });
  var deviceList = new Array();
  global.deviceRun.forEach((value, key) => {
    count++;
    deviceList.push(key);
  });


  // global.sessionIdDeviceMap.forEach((value, key)=>{
  //   Array.from(value).forEach(element=>{
  //     deviceList.push(element);
  //   })
  // })

  // 判断当前视频播放的数量和允许的播放数量
  if (count >= parseInt(global.configInfo.maxNumber)) {
    var info = "播放数量已满，当前的路数为：" + count
      + "，允许最大播放数量为：" + global.configInfo.maxNumber;
    res.send(
      {
        "code": 0,
        "msg": "操作失败",
        "data": {
          "url": [],
          "info": info,
          "deviceList":deviceList
        }
      }
    );
    return;
  }

  // 下面这段逻辑用来执行ffmpe命令，实现转码
  // 根据传进来的参数，先创建ffmpeg输出文件夹
  // 请求的设备编号大于实际的编号
  if (deviceNumberList[deviceNumberList.length - 1] > global.configInfo.videoInfo.urlHighDefinition.length) {
    res.send(
      {
        "code": 0,
        "msg": "操作失败",
        "data": {
          "url": [],
          "info": "请求的参数num，大于配置文件实际的url数量"
        }
      }
    );
    return;
  }

    // 创建设备输出文件夹
   // ==1，创建的文件夹，是设备ID
    if(type == 1 || type == undefined){
    deviceNumberList.forEach(element => {
      // 如果文件夹不存在，就创建新的文件夹
      var folder = __dirname + "\\live" + "\\" + element;
      if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder);
      }
    });
  }
  //==2，创建的文件夹，是设备ID + 1000 
  if(type == 2){
    deviceNumberList.forEach(element => {
      // 如果文件夹不存在，就创建新的文件夹
      var folder = __dirname + "\\live" + "\\" + (element*1 + 1000);
      if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder);
      }
    });
  }

  //ffmpeg的路径
  var cmd = __dirname + "\\ffmpeg\\bin\\ffmpeg.exe";
  var url = [];
  // 创建进程
  deviceNumberList.forEach(element => {
    element = element.trim();
    if(type == 1 || type == undefined){
      var rtspPath = global.configInfo.videoInfo.urlStanardDefinition[element - 1];
    }

    if(type == 2){
      var rtspPath = global.configInfo.videoInfo.urlHighDefinition[element - 1];
      element = element*1 + 1000;
      element = element.toString();
    }

    // 判断进程存不存在
    if(global.deviceRun.has(element) && global.deviceIdAndTime.has(element)){
      ;
    }else{

      if(global.deviceRun.has(element)){
        global.deviceRun.delete(element)
      }

      if(global.deviceIdAndTime.has(element)){
        global.deviceIdAndTime.delete(element);
      }

      var spawn = require('child_process').spawn;

      var outFile = __dirname + "\\live\\" + element + "\\" + element + ".m3u8";

      var args = [
        '-r', '25',
        '-i', rtspPath,
        '-codec:v', 'copy',
        '-f', 'hls',
        '-hls_init_time', '0.1',
        '-hls_list_size', '3',
        '-hls_wrap', '3',
        '-hls_time', '1',
        outFile
      ];
      run = spawn(cmd, args);
      // setTimeout(function () {
      //   run.stdin.pause();
      //   run.kill();
      // }, 60000);

      // 捕获标准输出并将其打印到控制台
      run.stdout.on('data', function (data) {
        // console.log('standard output:\n' + data);
      });

      // 捕获标准错误输出并将其打印到控制台 
      run.stderr.on('data', function (data) {
        // console.log('standard error:\n' + data);
      });

      // 注册子进程关闭事件 
      run.on('exit', function (code, signal) {
        // console.log('child process eixt ,exit:' + signal);
      });

      // 将进程信息放到全局变量里
      global.deviceRun.set(element, run);
      var myDate = new Date();
      // 记录已经转码的设备号,上线时间
      global.deviceIdAndTime.set(element, myDate.getTime());
      }
  });

  // 返回的url 
  deviceNumberList.forEach(element => {
    if(type == 1 || type == undefined){
        ;
    }
    if(type == 2){
      element = element*1 + 1000;
      element = element.toString();
    }
    
    var str = "http://" + global.configInfo.ipPublic + ":" + global.port + "/live/"
      + sessionId + "/" + element + "/" + element + ".m3u8";
    // var str = "http://" + global.configInfo.ipPublic + ":" + global.port + "/live/"
    //   + sessionId + "/" + element.trim() + "/" + element.trim() + ".m3u8";

    url.push(str);
  });

  res.send(
    {
      "code": 1,
      "msg": "操作成功",
      "data": {
        "url": url
      }
    }
  )
})


// 视频访问的url
//第一个id代表会话，二个id代表设备,第三个id代表文件名
// 第三个id，一定要是动态的不然会出错
app.get('/live/:sessionId/:deviceId/:uid', function (req, res) {
  // 从url获取参数
  var sessionId = req.params.sessionId;
  var deviceId = req.params.deviceId;
  var uid = req.params.uid;
  // 如果sessonId不在会话列表里
  if (!global.sessionIdAndTime.has(sessionId)) {
    res.send(
      {
        "code": 0,
        "msg": "操作失败",
        "data": {
          "url": "",
          "info": "sessionId不存在"
        }
      }
    )
    return;
  }
  var myDate = new Date();
  // console.log("这是直播里面的时间：" + myDate.toLocaleTimeString());
  // 修改session的访问时间
  global.sessionIdAndTime.set(sessionId, myDate.getTime());

  // 修改设备的访问时间
  global.deviceIdAndTime.set(deviceId, myDate.getTime());
  // 如果等于-1表示当前会话里没有这个设备，所以要把这个设备加进去
  if(global.deviceRun.has(deviceId) && global.deviceIdAndTime.has(deviceId)){
    if (global.sessionIdDeviceMap.get(sessionId).indexOf(deviceId) == -1) {
      global.sessionIdDeviceMap.get(sessionId).push(deviceId);
    }
  }

  // 根据url，动态修改path，uid不能写成常量，会出错
  var path = __dirname + "\\live\\" + deviceId + "\\" + uid;

  // 如果文件存在
  if(fs.existsSync(path)){
    // res.send("文件被删除了");
    // return;
    res.writeHead(200, { "msg": "1" });
    fs.createReadStream(path).pipe(res);
  }
});


// 回放请求
app.post('/video/playback', jsonParser, function (req, res) {
    //1、 判断请求是否有参数  
    if (Object.keys(req.body).length === 0) {
      res.send(
        {
          "code": 0,
          "msg": "操作失败",
          "data": {
            "sessionId": "",
            "info": "没有参数"
          }
        }
      );
      return;
    }

  //2、获取前端请求参数
  var number = req.body.number;
  var sessionId = req.body.sessionId;
  var startTime = req.body.startTime
  var numberList = number.split(",");
  // 判断前端是否发送需要的数据
  if (number === undefined || number.includes("，") || sessionId === undefined || 
  startTime === undefined || numberList === undefined) {
    res.send(
      {
        "code": 0,
        "msg": "操作失败",
        "data": {
          "url": [],
          "info": "请检查参数是否正确，需要number,sessionId,startTime三个参数"
        }
      }
    );
    return;
  }

  // 判断sessionId是否存在
  if(!global.sessionIdAndTime.has(sessionId)){
    res.send(
      {
        "code": 0,
        "msg": "操作失败",
        "data": {
          "url": [],
          "info": "请检查sessionId是否正确，是否过期（过期时间暂定为2分钟）"
        }
      }
    );
    return;
  }


  // 回放的设备的数量只能有一个
  if(numberList.length > 1){
    res.send(
      {
        "code": 0,
        "msg": "操作失败",
        "data": {
          "url": [],
          "info": "只能回放一个设备"
        }
      }
    );
    return;
  }
  
  // 限制设备最大的编号
  if(parseInt(number) >  parseInt(global.configInfo.DeviceNumber) || parseInt(number) <=0){
    res.send(
      {
        "code": 0,
        "msg": "操作失败",
        "data": {
          "url": [],
          "info": "设备number过大，正常范围为：1到" + global.configInfo.DeviceNumber
            + "之间的整数"
        }
      }
    );
    return;
  }

  // 判断回放的时间格式是不是正确的 默认格式为"2020-01-03 09:30:10"
  var pattern = /(((\d{4})-(0[13578]|1[02])-(0[1-9]|[12]\d|3[01]))|((\d{4})-(0[469]|11)-(0[1-9]|[12]\d|30))|((\d{4})-(02)-(0[1-9]|1\d|2[0-8]))|((\d{2}(0[48]|[2468][048]|[13579][26]))-(02)-(29))|(((0[48]|[2468][048]|[13579][26])00)-(02)-(29))) (([01]\d|2[0-3]):([0-5]\d):([0-5]\d))/;
  if(!pattern.test(startTime)){
    res.send(
      {
        "code": 0,
        "msg": "操作失败",
        "data": {
          "url": [],
          "info": "请检查时间格式，默认格式为\"hhhh-mm-dd hh:mm:ss\""
        }
      }
    );
    return;
  }
 
  var numberId = (number*1 + 2000).toString();
  // 判断这台设备有没有在回放
  if(global.deviceRun.has(numberId)){
    res.send(
      {
        "code": 0,
        "msg": "操作失败",
        "data": {
          "url": [],
          "info": "当前这台设备正在回放"
        }
      }
    );
    return;
  }

  // 判断有没有其他设备在回放
  Array.from(global.deviceRun.keys()).forEach(element=>{
    if(element > 2000){
      res.send(
        {
          "code": 0,
          "msg": "操作失败",
          "data": {
            "url": [],
            "info": "当前有其他设备在回放"
          }
        }
      );
      return;
    }
  });

  // 判断有没有其他设备在回放
/*
  Array.from(global.deviceIdAndTime.keys()).forEach(element=>{
    if(element > 2000){
      res.send(
        {
          "code": 0,
          "msg": "操作失败",
          "data": {
            "url": [],
            "info": "当前有其他设备在回放"
          }
        }
      );
      return;
    }
  });
*/

  // 字符串格式化
  var time = startTime.replace("-", "");
  time = time.replace("-", "");
  time = time.replace(":", "");
  time = time.replace(":", "");
  time = time.replace(" ", "t");

  // 创建文件夹
  var folder = __dirname + "\\live\\" + (number*1 + 2000);
  // var folder = __dirname + "\\history" + "\\" + number;
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder);
  }

  // 如果文件夹存在，就清空问价夹下的内容
  // 不清空，回放会有问题

  try{
    deleteFiles(folder);
  }catch(e){
    ;
  }

  var cmd = __dirname + "\\ffmpeg\\bin\\ffmpeg.exe";

  var spawn = require('child_process').spawn;
  // 1、要先知道，设备编号和IP的对应关系
  var nvrIp = "";
  var numId = "";
  var serialNum = 0;
  for(var i = 0; i < global.configInfo.nvrNumber; i++){
    numId = "num" + (i*1 + 1);
    if( parseInt(number) <= parseInt(global.configInfo.nvrIpInfo[numId].maxDeviceNum)){
      nvrIp = global.configInfo.nvrIpInfo[numId].ip;
      if(i == 0){
        var serialNumInner = number;
        serialNum = serialNumInner;
      }else{
        var serialNumInner = number - global.configInfo.nvrIpInfo[numId].maxDeviceNum + 32;
        serialNum = serialNumInner;
      }
      break;
    }
  }

  var rtspPath = "rtsp://" + global.configInfo.account + ":" + global.configInfo.password + "@" +
  nvrIp + ":554" + "/Streaming/tracks/" + serialNum +  "01?starttime=" + time + "z";

  var outFile = __dirname + "\\live\\" + (number*1 + 2000) + "\\" + (number*1 + 2000) + ".m3u8";
  console.log(rtspPath);
  var args = [
    '-rtsp_transport', 'tcp',
    '-i', rtspPath,
    '-c:v', 'libx264', '-an',
    '-f', 'hls',
    '-hls_init_time', '0.1',
    '-hls_list_size', '3',
    '-hls_wrap', '3',
    '-hls_time', '1',
    outFile
  ];
  run = spawn(cmd, args);
  // 捕获标准输出并将其打印到控制台
  run.stdout.on('data', function (data) {
    // console.log('standard output:\n' + data);
  });

  // 捕获标准错误输出并将其打印到控制台 
  run.stderr.on('data', function (data) {
    // console.log('standard error:\n' + data);
  });

  // 注册子进程关闭事件 
  run.on('exit', function (code, signal) {
    // console.log('child process eixt ,exit:' + signal);
  });

  // 将进程信息放到全局变量里
  global.deviceRun.set((number*1 + 2000).toString(), run);
  var myDate = new Date();
  // 记录已经转码的设备号,上线时间
  global.deviceIdAndTime.set((number*1 + 2000).toString(), myDate.getTime());
  // console.log(global.deviceRun);
  // console.log(global.deviceIdAndTime);

  var str = "http://" + global.configInfo.ipPublic + ":" + global.port + "/live/"
  + sessionId + "/" + (number*1 + 2000) + "/" + (number*1 + 2000) + ".m3u8";

  // 这里加入文件是否生成做判断 2020-11-3 9:51
  var needReturn = true;
  fs.watch(folder, (event, filename)=>{
    if(needReturn){
    var middleStr = str;
    needReturn = false;
      res.send(
        {
          "code": 1,
          "msg": "操作成功",
          "data": {
            "url": middleStr
          }
        }
      );
    }
  })

/*
  res.send(
    {
      "code": 1,
      "msg": "操作成功",
      "data": {
        "url": str
      }
    }
  );
*/
})

//下线请求
app.put('/video/quit', jsonParser, function (req, res) {
  // 判断请求是否有参数  
  if (Object.keys(req.body).length === 0) {
    res.send(
      {
        "code": 0,
        "msg": "操作失败",
        "data": {
          "sessionId": "",
          "info": "没有参数"
        }
      }
    );
    return;
  }

  // 获取前端请求参数
  var number = req.body.number;
  var sessionId = req.body.sessionId;

  // 判断前端是否发送需要的数据
  if (number === undefined || number.includes("，") || sessionId === undefined) {
    res.send(
      {
        "code": 0,
        "msg": "操作失败",
        "data": {
          "url": [],
          "info": "请检查参数是否正确"
        }
      }
    );
    return;
  }

  // 分离设备编号
  var deviceNumberList = Array.from(number.split(","));
  var maxNumber = Math.max.apply(Math, Array.from(deviceNumberList));
  // 判断设备number是否正确
  if (global.configInfo.videoInfo.urlHighDefinition.length < maxNumber) {
    res.send(
      {
        "code": 0,
        "msg": "操作失败",
        "data": {
          "url": [],
          "info": "设备number过大，正常范围为：1到" + global.configInfo.videoInfo.urlHighDefinition.length
            + "之间的整数"
        }
      }
    );
    return;
  }

  // 判断sessionId是否存在
  if (!global.sessionIdAndTime.has(sessionId)) {
    res.send(
      {
        "code": 0,
        "msg": "操作失败",
        "data": {
          "url": [],
          "info": "请检查sessionId是否正确，是否过期（过期时间暂定为2分钟）"
        }
      }
    );
    return;
  }

  // // var num = 0;
  // var indexNum = 0;
  // // 判断设备是否已经下线,修改下线过的设备列表
  // var listLength = deviceNumberList.length;
  // deviceNumberList.forEach(element=>{
  //   // 没有查到设备
  //   if(!global.deviceIdAndTime.has(element))
  //   {
  //     // num++;
  //     deviceNumberList.splice(indexNum, 1);
  //   }
  //   indexNum++;
  // })


  // if(deviceNumberList.length == 0){
  //   res.send(
  //     {
  //       "code": 1,
  //       "msg": "操作失败",
  //       "data": "视频已经下线"
  //     }
  //   )
  //   return;
  // }


  // 下线设备
  deviceNumberList.forEach(element => {

    var deviceFlag = true;
    var deviceFlagHigh = true;
    var deviceFlagHistory = true;


    var elementHigh = (element*1 + 1000).toString();
    var elementHistory = (element*1 + 2000).toString();
    // 杀session里的设备
    global.sessionIdDeviceMap.forEach((value, key) => {
      // 当sessionId和global.sessionIdDeviceMap里面相等的时候
      if(key == sessionId){

        // 如果有标清
        var index = value.indexOf(element);
        if (index > -1) {
          global.sessionIdDeviceMap.get(key).splice(index, 1);
        }else{
          deviceFlag = false;
        }

        // 如果有高清
        var indexHigh = value.indexOf(elementHigh);
        if(indexHigh > -1){
          global.sessionIdDeviceMap.get(key).splice(indexHigh, 1);
        }else{
          deviceFlagHigh = false;
        }

        // 如果有历史
        var indexHistory = value.indexOf(elementHistory);
        if(indexHistory > -1){
          global.sessionIdDeviceMap.get(key).splice(indexHistory, 1);
        }else{
          deviceFlagHistory = false;
        }
      }

      // 判断其他的sesseionID里面还有没有进程，如果有，就不要执行杀设备，杀进程
      if(global.sessionIdDeviceMap.get(key).indexOf(element) > -1)
      {
        deviceFlag = false;
      }

      if(global.sessionIdDeviceMap.get(key).indexOf(elementHigh) > -1){
        deviceFlagHigh = false;
      }

      if(global.sessionIdDeviceMap.get(key).indexOf(elementHistory) > -1){
        deviceFlagHistory = false;
      }
    })

    if(deviceFlag){
      console.log("deviceFlag:" + deviceFlag);

      global.deviceIdAndTime.delete(element);
      if(global.deviceRun.get(element) == undefined ){
        ;
      }else{
        global.deviceRun.get(element).stdin.pause();
        global.deviceRun.get(element).kill();
        global.deviceRun.delete(element);
      }

      // 清理文件
      var path = __dirname + "\\" + "live\\" + element;
      try{
        deleteFiles(path);
      }catch(e){
        ;
      }
    }

    if(deviceFlagHigh){
      console.log("deviceFlagHigh:" + deviceFlagHigh);

      global.deviceIdAndTime.delete(elementHigh);
      if(global.deviceRun.get(elementHigh) == undefined ){
        ;
      }else{
        global.deviceRun.get(elementHigh).stdin.pause();
        global.deviceRun.get(elementHigh).kill();
        global.deviceRun.delete(elementHigh);
      }


      // 清理文件
      var path = __dirname + "\\" + "live\\" + elementHigh;
      try{
        deleteFiles(path);
      }catch(e){
        ;
      }

    }

    if(deviceFlagHistory){
      console.log("deviceFlagHistory:" + deviceFlagHistory);

      global.deviceIdAndTime.delete(elementHistory);

      if(global.deviceRun.get(elementHistory) == undefined ){
        ;
      }else{
        global.deviceRun.get(elementHistory).stdin.pause();
        global.deviceRun.get(elementHistory).kill();
        global.deviceRun.delete(elementHistory);
      }
      // 清理文件
      var path = __dirname + "\\" + "live\\" + elementHistory;
      try{
        deleteFiles(path);
      }catch(e){
        ;
      }
    }
  })


  res.send(
    {
      "code": 1,
      "msg": "操作成功",
      "data": ""
    }
  ) 
})

app.get('/globalInfo', function (req, res) {
  // console.log("打印全局信息");
  // console.log("global.deviceRun: ");
  // console.log(global.deviceRun);
  // console.log("global.deviceIdAndTime: ");
  // console.log(global.deviceIdAndTime);
  // console.log("global.sessionIdAndTime:");
  // console.log(global.sessionIdAndTime);
  // console.log("global.sessionIdDeviceMap:");
  // console.log(global.sessionIdDeviceMap);

  var sessionIdList = new Array();
  var sessionIdTime = new Array();
  var myDate = new Date();

  Array.from(global.sessionIdAndTime.keys()).forEach(element => {
    sessionIdList.push(element);
  });

  global.sessionIdAndTime.forEach((value, key)=>{
    var time = (myDate.getTime() - value)/1000/60;
    sessionIdTime.push(time);
  }

  );
  
  var deviceList = new Array();
  global.sessionIdDeviceMap.forEach((value, key)=>{
    Array.from(value).forEach(element=>{
      deviceList.push(element);
    })
  });

  res.send(
    {
      "code": 1,
      "msg": "操作成功",
      "data": {
        "sessionIdList" : sessionIdList,
        "deviceList":deviceList,
        "sessionIdTime":sessionIdTime

      }
    }
  ) 
})

// 服务的起始入口
var server = app.listen(65500, function () {
  var host = server.address().address;
  global.port = server.address().port;

  global.key = "key";

  // 这里定义设备信息
  // global.deviceRun存放设备的编号和进程的对应关系
  // global.deviceIdAndTime存放设备的编号和最新访问时间

  // 增加画质控制，决定，设备ID + 1000，作为高清画质的ID
  // 对应sessionId里面的参数也是如此对应ID + 1000

  // 增加回放，决定，设备ID + 2000，作为回放的Id
  // 对应sessionId里面的参数也是如此对应
  global.deviceRun = new Map();
  global.deviceIdAndTime = new Map();

  // 这里定义用户会话信息
  // global.sessionIdAndTime存放会话编号和最新访问时间
  // global.sessionIdDeviceMap存放会话编号和访问的设备编号
  global.sessionIdAndTime = new Map();
  global.sessionIdDeviceMap = new Map();

  // 全局变量的处理函数
  fs.readFile(__dirname + "\\config.json", 'utf-8', (err, data) => {
    if (err);
    global.configInfo = JSON.parse(data.toString());
  });

  var myAppDate = new Date();
  var time = myAppDate.getFullYear() + "-" + myAppDate.getMonth() + "-" + myAppDate.getDay() + "-" + myAppDate.getHours() + ":" +  myAppDate.getMinutes() + ":" + myAppDate.getSeconds();
  console.log("应用程序已启动：" + host + port);
  // fs.appendFileSync(__dirname + "\\log.txt", time +   "\r\n" + "应用程序已经启动了: " + host + port + "\r\n\r\n", function(err){
  //   if(err){
  //     ;
  //   }
  // })

  // 定时清理会话,两分钟清理一次
  setInterval(() => {
    var myDate = new Date();
    global.sessionIdAndTime.forEach((value, key) => {
      if ((myDate.getTime() - value) / 1000 / 60 > 2) {
        // console.log(global.sessionIdAndTime);
        // 将sessionId和time信息清理掉
        global.sessionIdAndTime.delete(key);
        // 将sessionId及其绑定的Device信息清理掉
        global.sessionIdDeviceMap.delete(key);
      }
    }
    );
  }, 1000);

  // 定时清理设备,也是两分钟清理一次
  setInterval(() => {
    var myDate = new Date();
    global.deviceIdAndTime.forEach((value, key) => {

      if ((myDate.getTime() - value) / 1000 / 60 > 2) {
        var deviceKey = key;
        // 杀session里的设备
        global.sessionIdDeviceMap.forEach((value, key) => {
          var index = value.indexOf(deviceKey);
          // sessionIdDeviceMap对应的sesssion里面有相应的设备的时候
          if (index > -1) {
            global.sessionIdDeviceMap.get(key.toString()).splice(index, 1);
          }
        })

        // 杀设备
        global.deviceIdAndTime.delete(key);
        console.log(key.toString());
        // 杀进程
        // console.log(global.deviceRun.get(key.toString()));
        if(global.deviceRun.get(key.toString()) == undefined ){

        }else{
          global.deviceRun.get(key.toString()).stdin.pause();
          global.deviceRun.get(key.toString()).kill();
          global.deviceRun.delete(key.toString());
        }

        // 清理文件
        var path = __dirname + "\\" + "live\\" + key;
        try{
          deleteFiles(path);
        }catch(e){
          ;
        }
      }
    }
    );
  }, 1000);
  
  setInterval(() => {
    var myDate = new Date();
    var info = "["+myDate.getFullYear()+ "-" + myDate.getMonth() + "-"+ myDate.getDay() + "   " + myDate.getHours() + ":" + myDate.getMinutes() + ":" + myDate.getSeconds() + "]  ";
    console.log(info + "视频服务器正在运行！！！\r\n");
  }, 1000);
})

function deleteFiles(folderPath) {
  // const fs = require('fs');
  const path = require('path');
  let forlder_exists = fs.existsSync(folderPath);
  if (forlder_exists) {
    let fileList = fs.readdirSync(folderPath);
    fileList.forEach(function (fileName) {
      fs.unlinkSync(path.join(folderPath, fileName));
    });
  }
}
