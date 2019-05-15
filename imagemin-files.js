#!/usr/local/bin/node
const glob = require("glob"),
      gm = require('gm').subClass({imageMagick: true}),
      fs = require('fs');

async function minfiles() {
  // options is optional
  glob("files/**/*.jpg", {}, async function (er, files) {
    for (i=0; i<files.length; i++) {
      let f = files[i];
//    files.forEach( function(f){
      // max width
      await new Promise(function(resolve,reject){
        gm(f).resize(2000,null,'>').write(f, err=>{
          gm(f).stream('webp').pipe(fs.createWriteStream(f.replace('.jpg','.webp')));
          if (err) reject(err);
          else resolve();
        });
      })
      await new Promise(function(resolve,reject){
        // sm version
        let fsm = f.replace('.jpg','.sm.jpg');
        gm(f).resize(150,null,'>').write(fsm, err=>{
          gm(fsm).stream('webp').pipe(fs.createWriteStream(fsm.replace('.jpg','.webp')));
          if (err) reject(err);
          else resolve();
        });
      })
    }
  })
}

minfiles();
