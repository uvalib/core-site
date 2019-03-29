#!/usr/local/bin/node
var request = require('request'),
    makeDir = require('make-dir'),
    download = require('image-downloader'),
    moment = require('moment');

var filesRoot = "https://drupal.lib.virginia.edu/sites/default/files";

var getImage = function(options,count) {
  console.log('attempt download('+count+') -> '+options.url);
  download.image(options)
    .then(({filename, image})=>{
      console.log('File saved to ', filename);
    })
    .catch((err) => {
      console.log(err);
      if (count--) getImage(options, count);
    });
}

request('https://api.devhub.virginia.edu/v1/library/files', function(error, response, body){
  var files = JSON.parse(body);
  makeDir("files").then(pth => {
    files.forEach(file => {
      var changed = moment(file.changed,'X');
      if (changed.isAfter(moment().clone().subtract(7,'days').startOf('day'))) {
        var path = file.uri.replace(/public:\/(.*\/).*/,"$1");
        var filename = file.uri.replace(/public:\/.*\/(.*)/,"$1");
        makeDir("files/"+path).then(abspath => {
          getImage({url:filesRoot+path+filename,
                          dest: abspath+"/"+filename}, 100);
        });
      }
    });
  });
});
