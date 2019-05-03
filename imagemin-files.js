#!/usr/local/bin/node
const glob = require("glob"),
      gm = require('gm').subClass({imageMagick: true}),
      fs = require('fs');

// options is optional
glob("files/**/*.jpg", {}, function (er, files) {
  files.forEach(f=>{
    // max width
    gm(f).resize(2000,null,'>').write(f, err=>{
        // sm version
        let fsm = f.replace('.jpg','.sm.jpg');
        gm(f).resize(150,null,'>').write(fsm, err=>{
          gm(f).stream('webp').pipe(fs.createWriteStream(f.replace('.jpg','.webp')));
          gm(fsm).stream('webp').pipe(fs.createWriteStream(fsm.replace('.jpg','.webp')));
        });
    });
  })
})
