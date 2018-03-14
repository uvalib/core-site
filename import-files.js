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
      getImage({url:filesRoot+path+filename,
                      dest: abspath+"/"+filename}, 100);
    });
//      wget({url:filesRoot+path+filename,
//        dest:abspath+"/"+filename},function(error, response){
//
//if (error) {
//          console.log(abspath+"/"+filename);
//          console.log(error);
//}
//          if (response && response.headers['content-type'] == 'image/jpeg') {
//            webp.cwebp(abspath+"/"+filename.replace(' ','\ '),abspath+"/"+filename.replace(' ','\ ')+".webp","-q 80",function(status)
//            {
//            	//if exicuted successfully status will be '100'
//            	//if exicuted unsuccessfully status will be '101'
//            	//console.log(status);
//              if (status == '101') console.log("*******************************************************");
//            });
//          }

//        });
//    });
  });

});
