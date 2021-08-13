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


