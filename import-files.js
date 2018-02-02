#!/usr/local/bin/node
var request = require('request'),
    makeDir = require('make-dir'),
    wget = require('node-wget');

var filesRoot = "https://drupal.lib.virginia.edu/sites/default/files";

console.log('foo');
request('https://api.devhub.virginia.edu/v1/library/files', function(error, response, body){
  var files = JSON.parse(body);
  files.forEach(file => {
//    var path = file.uri.replace(/public:\/(.*\/).*/,"$1");
//    makeDir("files/"+path).then(abspath => {
//      console.log('wget -> '+filesRoot+path+file.filename)
//      wget({url:filesRoot+path+file.filename,
//        dest:abspath+"/"+file.filename});
//    });
    var path = file.uri.replace(/public:\/(.*\/).*/,"$1");
    var filename = file.uri.replace(/public:\/.*\/(.*)/,"$1");
    makeDir("files/"+path).then(abspath => {
      console.log('wget -> '+filesRoot+path+filename)
      wget({url:filesRoot+path+filename,
        dest:abspath+"/"+filename});
    });
  });

});
