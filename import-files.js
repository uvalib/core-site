#!/usr/local/bin/node
var request = require('request'),
    makeDir = require('make-dir'),
    download = require('image-downloader'),
    webp = require('webp-converter');

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
  files.forEach(file => {
    var path = file.uri.replace(/public:\/(.*\/).*/,"$1");
    var filename = file.uri.replace(/public:\/.*\/(.*)/,"$1");
    makeDir("files/"+path).then(abspath => {
      var url = filesRoot+path+filename.replace("'","%27");
      getImage({url: url,
                      dest: abspath+"/"+filename}, 100);
    });
  });

});
