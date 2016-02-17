var ip   = "140.112.119.171",
    port = 1314,
    http = require('http');


var express = require('express');
var app = express();
var server = http.createServer(app);
app.get('/',function(request, response){ //我們要處理URL為 "/" 的HTTP GET請求
    response.end('你好！'); //作出回應
});
server.listen(port,"140.112.119.171",function(){
    console.log('HTTP伺服器在 http://127.0.0.1:8080/ 上運行');
});