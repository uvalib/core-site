#!/usr/local/bin/node
var request = require('request'),
    makeDir = require('make-dir'),
    wget = require('node-wget'),
    webp = require('webp-converter');

var filesRoot = "https://drupal.lib.virginia.edu/sites/default/files";

request('https://api.devhub.virginia.edu/v1/library/files', function(error, response, body){
  var files = JSON.parse(body);
  files.forEach(file => {
    var path = file.uri.replace(/public:\/(.*\/).*/,"$1");
    var filename = file.uri.replace(/public:\/.*\/(.*)/,"$1");
    makeDir("files/"+path).then(abspath => {
      console.log('wget -> '+filesRoot+path+filename)
      wget({url:filesRoot+path+filename,
        dest:abspath+"/"+filename},function(){
          webp.cwebp("input.jpg","output.webp","-q 80",function(status)
          {
          	//if exicuted successfully status will be '100'
          	//if exicuted unsuccessfully status will be '101'
          	console.log(status);
          });
        });
    });
  });

});
