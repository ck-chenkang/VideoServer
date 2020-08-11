const fs = require('fs');

var url = new Array();
for(var i = 1; i < 33; i++){
    var string = '"rtsp://admin:l12345678@192.168.1.14:554/Streaming/Channels/'+ i + '02?transportmode=unicast",\n';
    fs.appendFileSync('url.txt',string, function(){});
    url.push(string);
}
console.log(url);