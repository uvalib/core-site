#!/usr/local/bin/node
const imagemin = require('imagemin'),
      makeDir = require('make-dir'),
      imageminJpegRecompress = require('imagemin-jpeg-recompress'),
      imageminPngquant = require('imagemin-pngquant'),
      imageminWebp = require('imagemin-webp'),
      {lstatSync, readdirSync } = require('fs'),
      { join } = require('path');

const isDirectory = source => lstatSync(source).isDirectory()
const getDirectories = source =>
  readdirSync(source).map(name => join(source,name)).filter(isDirectory);

//webp
getDirectories("files").forEach((f)=>{
  makeDir(f.replace('files','files-comp')).then(abspath => {
    imagemin([f+'/*.{jpg,png}'], abspath, {
        plugins: [
            imageminWebp({quality: 50})
        ]
    }).then(files => {
	     console.log('did one');
	      //=> [{data: <Buffer 89 50 4e …>, path: 'build/images/foo.jpg'}, …]
    });
  });
});

// png & jpeg for mobile
getDirectories("files").forEach((f)=>{
  makeDir(f.replace('files','files-comp')).then(abspath => {
    imagemin([f+'/*.{jpg,png}'], abspath, {
        plugins: [
            imageminJpegRecompress(),
            imageminPngquant({quality: '65-80'})
        ]
    }).then(files => {
      console.log('did one');
	     //console.log(files);
	      //=> [{data: <Buffer 89 50 4e …>, path: 'build/images/foo.jpg'}, …]
    });
  });
});
