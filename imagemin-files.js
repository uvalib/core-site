#!/usr/local/bin/node
const imagemin = require('imagemin');
const imageminOptipng = require('imagemin-optipng');
const imageminWebp = require('imagemin-webp');
const imageminGif2webp = require('imagemin-gif2webp');
//const imageminMozjpeg = require('imagemin-mozjpeg');
const imageminJpegtran = require('imagemin-jpegtran');
const imageminGifsicle = require('imagemin-gifsicle');
const imageminSvgo = require('imagemin-svgo');
const ImageminGm = require('imagemin-gm')
const imageminGm = new ImageminGm()
const { readdirSync, statSync } = require('fs')
const { join } = require('path')
const dirs = p => readdirSync(p).filter(f => statSync(join(p, f)).isDirectory())
var ds = dirs('files')

async function compress() {
  console.log('squish up the images')
  for (var i=0; i<=ds.length; i++) {
    const dir = ds[i];
    console.log(dir);
  	const files = await imagemin(['files/'+dir+'/*.{jpg,png,gif,svg}'], 'files-ready/'+dir, {
  		use: [
//        imageminMozjpeg(),
        imageminOptipng(),
        imageminGifsicle(),
        imageminSvgo(),
  		]
  	}).catch(err => {
      console.log(err);
    });

  	if(Array.isArray(files)) files.forEach(f=>console.log(f.path));
  }
  console.log('done');
}

async function smaller() {
  console.log("make some small versions")
  var newds = [];
  for (var i=0; i<=ds.length; i++) {
    const dir = ds[i];
    console.log(dir);
  	const files = await imagemin(['files-ready/'+dir+'/*.{jpg,png,gif}'], 'files-ready/'+dir+'/SM', {
  		use: [
        imageminGm.resize({ width: 250, height: 250, gravity: 'Center' })
  		]
  	}).catch(err => {
      console.log(err);
    });
    if(Array.isArray(files)) files.forEach(f=>console.log(f.path));
    newds.push(dir);
    newds.push(dir+'/SM');
  }
  ds = newds;
  console.log('done');
}


async function webp() {
  console.log("make some webp versions for chrome")
  for (var i=0; i<=ds.length; i++) {
    const dir = ds[i];
    console.log(dir);
  	const files = await imagemin(['files-ready/'+dir+'/*.{jpg,png,gif}'], 'files-ready/'+dir, {
  		use: [
        imageminWebp({quality: 75}),
        imageminGif2webp({quality: 75})
  		]
  	}).catch(err => {
      console.log(err);
    });

  	if(Array.isArray(files)) files.forEach(f=>console.log(f.path));
  }
  console.log('done');
}

compress()
.then(()=>{
  smaller().then(()=>{
    setTimeout(webp,5000)
  })
})
