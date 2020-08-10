var express = require('express');
var bodyParser = require('body-parser');
var fs = require('fs');
var app = express();

//使用json parser中间件
var urlencodedParser = bodyParser.urlencoded({ extended: false });
var jsonParser = bodyParser.json();

// 指定静态文件
app.use(express.static(__dirname + '\\live'));


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
    while (global.sessionId.indexOf(id) != -1) {
      id = Math.random(1).toString().split('.')[1];
    }
    // 将sessionId存放到全局数组里
    global.sessionId.push(id);
    // 获得当前时间（从1970。1.1开始的毫秒数）,并把它放到全局sessionIdTime里面
    var myDate = new Date();
    global.sessionIdTime.push(myDate.getTime());
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
  //   请求参数：
  // {
  //    number：string（编号，多个的话以逗号隔开）
  //    sessionId:string (视频服务返回的会话ID)
  //    type:int (获取类型：1-标清 2-高清，如果该参数没传，默认标清)
  // }
  // 返回数据：
  // {
  //     "code": 1,
  //     "msg": "操作成功",
  //     "data": {
  //         "url": ["htttp://xxxx","htttp://xxxx","htttp://xxxx"](直播的url数组)
  //     }
  // }

  // 获取前端请求参数
  var number = req.body.number;
  var sessionId = req.body.sessionId;
  var type = req.body.type;

  // 判断前端是否发送需要的数据
  if (number === undefined || sessionId === undefined || type >= 3) {
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

  // 判断设备number是否正确
  if (global.configInfo.videoInfo.urlHighDefinition.length < number) {
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
  if (global.sessionId.indexOf(sessionId) == -1) {
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
  var deviceNumberList = number.split(",");
  if(deviceNumberList[deviceNumberList.length - 1] > global.configInfo.videoInfo.urlHighDefinition.length){
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

    if(global.deviceRun.has(element)){
      continue;
    }

    var spawn = require('child_process').spawn;
    if(type == undefined || type == 1){
      var rtspPath = global.configInfo.videoInfo.urlStanardDefinition[element - 1];
    }
    if(type == 2)
    {
      var rtspPath = global.configInfo.videoInfo.urlHighDefinition[element - 1]; 
    }
    var outFile = __dirname + "\\live\\" + element + "\\" + "video.m3u8";

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

    global.deviceRun.set(element, run);

    // 捕获标准输出并将其打印到控制台 
    run.stdout.on('data', function (data) {
      fs.appendFile(__dirname + "\\log.txt", data, (err) => { if (err); });
    });

    // 捕获标准错误输出并将其打印到控制台 
    run.stderr.on('data', function (data) {
    });

    // 注册子进程关闭事件 
    run.on('exit', function (code, signal) {
    });
  });
  res.send(
    {
      "code": 1,
      "msg": "操作成功",
      "data": {
        "url": "http://1223"
      }
    }
  )

})

//第一个id代表设备,第二个id代表会话
app.get('/live/:sessionId/:deviceId', function (req, res) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  res.header('Access-Control-Allow-Headers', 'Content-Type');

  var deviceId = req.params.deviceId;
  var sessionId = req.params.sessionId;

  path = __dirname + "\\live\\" + deviceId + "\\" + "video.m3u8";
  res.writeHead(200, { "msg": "1" });
  fs.createReadStream(path).pipe(res);
});

app.get('/video/playback', function (req, res) {
  res.send('收到回放请求');
})

app.put('/video/quit', function (req, res) {
  res.send('收到下线请求');
})

var server = app.listen(65500, function () {
  var host = server.address().address;
  var port = server.address().port;

  global.key = "key";
  // 这里定义设备信息
  global.deviceRun = new Map();
  global.deviceId = new Array();
  global.deviceIdTime = new Array();

  // 这里定义用户会话信息
  // global.sessionIdDeviceMap
  global.sessionId = new Array();
  global.sessionIdTime = new Array();
  global.sessionIdDeviceMap = new Map();

  global.sessionIdDeviceMap.set(1, [1, 2, 3]);
  global.sessionIdDeviceMap.set(2, [1, 2, 4]);
  global.sessionIdDeviceMap.set(3, [1, 2, 3]);

  fs.readFile(__dirname + "\\config.json", 'utf-8', (err, data) => {
    if (err);
    global.configInfo = JSON.parse(data.toString());
  });
  console.log("应用程序已启动：" + host + port);
})

