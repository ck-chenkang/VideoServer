var express = require('express');
var bodyParser = require('body-parser');
var fs = require('fs');
var app = express();
// var fsExtra = require('fs-extra');
//使用json parser中间件
var urlencodedParser = bodyParser.urlencoded({ extended: false });
var jsonParser = bodyParser.json();

// 指定静态文件
// app.use(express.static(__dirname + '\\live'));



//上线请求
app.get('/video/Online', jsonParser, function (req, res) {
  // 跨域访问
  res.header("Access-Control-Allow-Origin", "*");
  res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  res.header('Access-Control-Allow-Headers', 'Content-Type');

  //1、 判断请求是否有参数  
  //2、 判断请求的key是否正确
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
  } else if (req.body.key === global.key) {
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
  } else {
    res.send(
      {
        "code": 0,
        "msg": "操作失败",
        "data": {
          "sessionId": id,
          "info": "请检查key是否正确"
        }
      }
    )
  }
})



// 直播请求
app.get('/video/liveBroadcast', jsonParser, function (req, res) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  res.header('Access-Control-Allow-Headers', 'Content-Type');

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

  // 判断sessionId是否存在，== -1 表示不存在
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
  global.sessionIdDeviceMap.forEach((value, key) => {
    count += value.length;
  });

  // 判断当前视频播放的数量和允许的播放数量
  if (count >= global.configInfo.maxNumber) {
    var info = "播放数量已满，当前的路数为：" + count
      + "，允许最大播放数量为：" + global.configInfo.maxNumber;
    res.send(
      {
        "code": 0,
        "msg": "操作失败",
        "data": {
          "url": [],
          "info": info
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
  deviceNumberList.forEach(element => {
    // 如果文件夹不存在，就创建新的文件夹
    var folder = __dirname + "\\live" + "\\" + element;
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder);
    }
  });

  //ffmpeg的路径
  var cmd = __dirname + "\\ffmpeg\\bin\\ffmpeg.exe";

  // 创建进程
  deviceNumberList.forEach(element => {
    var element = element.trim();
    // 判断进程存不存在
    if (global.deviceRun.has(element)) {
      return;
    }

    var spawn = require('child_process').spawn;
    if (type == undefined || type == 1) {
      var rtspPath = global.configInfo.videoInfo.urlStanardDefinition[element - 1];
    }
    if (type == 2) {
      var rtspPath = global.configInfo.videoInfo.urlHighDefinition[element - 1];
    }
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

    var myDate = new Date;
    // 记录已经转码的设备号,上线时间
    global.deviceIdAndTime.set(element, myDate.getTime());

  });

  // 返回的url 
  var url = [];
  deviceNumberList.forEach(element => {
    var str = "http://" + global.configInfo.ipPublic + ":" + global.port + "/live/"
      + sessionId + "/" + element.trim() + "/" + element.trim() + ".m3u8";
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
//第一个id代表会话，二个id代表设备,第三个id代表会话
app.get('/live/:sessionId/:deviceId/:uid', function (req, res) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  res.header('Access-Control-Allow-Headers', 'Content-Type');

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
  // 修改session的访问时间
  global.sessionIdAndTime.sessionId = myDate.getDate();

  // 修改设备的访问时间
  global.deviceIdAndTime.deviceId = myDate.getDate();

  // 增加访问量
  // 如果等于-1表示当前会话里没有这个设备，所以要把这个设备加进去
  if (global.sessionIdDeviceMap.get(sessionId).indexOf(deviceId) == -1) {
    global.sessionIdDeviceMap.get(sessionId).push(deviceId);
  }

  // 根据url，动态修改path，uid不能写成常量，会出错
  var path = __dirname + "\\live\\" + deviceId + "\\" + uid;
  res.writeHead(200, { "msg": "1" });
  fs.createReadStream(path).pipe(res);
});



// 回放请求
app.get('/video/playback', function (req, res) {
  res.send('收到回放请求');
})

//下线请求
app.put('/video/quit', jsonParser, function (req, res) {
  // 跨域访问
  res.header("Access-Control-Allow-Origin", "*");
  res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  res.header('Access-Control-Allow-Headers', 'Content-Type');

  // console.log(req.body);
  // res.send();
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

  var num = 0;
  var indexNum = 0;
  // 判断设备是否已经下线,修改下线过的设备列表
  var listLength = deviceNumberList.length;
  deviceNumberList.forEach(element=>{
    // 没有查到设备
    if(!global.deviceIdAndTime.has(element))
    {
      num++;
      deviceNumberList.splice(indexNum, 1);
    }
    indexNum++;
  })

  if(listLength == num){
    res.send(
      {
        "code": 1,
        "msg": "操作失败",
        "data": "视频已经下线"
      }
    )
    return;
  }

  var deviceFlag = true;
  // 下线设备
  deviceNumberList.forEach(element => {
    // 杀session里的设备
    global.sessionIdDeviceMap.forEach((value, key) => {
      // 当sessionId和global.sessionIdDeviceMap里面相等的时候
      if(key == sessionId){
        var index = value.indexOf(element);
        // sessionIdDeviceMap对应的sesssion里面有相应的设备的时候
        if (index > -1) {
          global.sessionIdDeviceMap.get(key).splice(index, 1);
        }

      }
      // 判断设备进程需不需要杀死
      if(value.indexOf(element) > -1)
      {
        deviceFlag = false;
      }
    })

    if(deviceFlag){
      // 杀进程
      global.deviceRun.get(element).stdin.pause();
      global.deviceRun.get(element).kill();
      global.deviceRun.delete(element);
      // 杀设备
      global.deviceIdAndTime.delete(element);
      // 清理文件
      // var path = __dirname + "\\" + "live\\" + key;
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


// 服务的起始入口
var server = app.listen(65500, function () {
  var host = server.address().address;
  global.port = server.address().port;

  global.key = "key";
  // 这里定义设备信息
  // global.deviceRun存放设备的编号和进程的对应关系
  // global.deviceIdAndTime存放设备的编号和最新访问时间
  global.deviceRun = new Map();
  global.deviceIdAndTime = new Map();

  // 这里定义用户会话信息
  // global.sessionIdAndTime存放会话编号和最新访问时间
  // global.sessionIdDeviceMap存放会话编号和访问的设备编号
  global.sessionIdAndTime = new Map();
  global.sessionIdDeviceMap = new Map();

  fs.readFile(__dirname + "\\config.json", 'utf-8', (err, data) => {
    if (err);
    global.configInfo = JSON.parse(data.toString());
  });

  console.log("应用程序已启动：" + host + port);

  // 定时清理会话,两分钟清理一次
  setInterval(() => {
    var myDate = new Date();
    global.sessionIdAndTime.forEach((value, key) => {
      if ((myDate.getTime() - value) / 1000 / 60 > 2) {
        console.log(global.sessionIdAndTime);
        // 将sessionId和time信息清理掉
        global.sessionIdAndTime.delete(key);
        // 将sessionId及其绑定的Device信息清理掉
        global.sessionIdDeviceMap.delete(key);
      }
    }
    );
  }, 5000);

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
            global.sessionIdDeviceMap.get(key).splice(index, 1);
          }
        })

        // 杀进程
        global.deviceRun.get(key).stdin.pause();
        global.deviceRun.get(key).kill();
        global.deviceRun.delete(key);

        // 杀设备
        global.deviceIdAndTime.delete(key);

        // 清理文件
        // var path = __dirname + "\\" + "live\\" + key;
        
      }
    }
    );
  }, 5000);
})