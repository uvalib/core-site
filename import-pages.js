#!/usr/local/bin/node
var request = require('request'),
    fs = require('fs'),
    makeDir = require('make-dir'),
    mustache = require( "mustache" ),
    sanitize = require("sanitize-filename");

request('https://uvalib-api.firebaseio.com/pages.json', function(error, response, body){
  var pages = JSON.parse(body);

  // create the pages
  fs.readFile('page-template.html', 'utf8', function(err, pageTemplate){
    pages.forEach(page => {
      // Add leading slash to path if missing
      if (!page.path.startsWith('/')) page.path = "/"+page.path;
      // Pull filename from path or use index.html
      if (page.path.endsWith('.html')) {
        var tmp = page.path.split('/');
        page.filename = tmp.pop();
        page.path = tmp.join('/');
      } else {
        page.filename = "index.html";
      }
      // make sure that we have an ending slash
      if (page.path.slice(-1) != "/") {
        page.path += "/";
      }

      console.log(page.path);

      makeDir("data/pages"+page.path).then(path => {
        var tmpfilename = sanitize(page.title).replace(/\s/g,'_')+".html";
        //temp write to flat directory
//        fs.writeFile("data/pages/"+tmpfilename,
//                     mustache.render( pageTemplate, page ), function(){});
        fs.writeFile("data/pages"+page.path+page.filename,
                     mustache.render( pageTemplate, page ), function(){});
      });
    });
  });

  // create the sitemap
  var sitemap = [];
  pages.forEach(page => {
    var tmpfilename = sanitize(page.title).replace(/\s/g,'_');

    sitemap.push(
      {
        "title": page.title,
        "time": "Tue, 19 Apr 2016 18:50:00 +0000",
        "author": "Jeff Nusz",
        "category": "Pages",
        "id": tmpfilename,
        "link": page.path,
        "path": page.path,
        "sidebar": page.sidebar,
        "subnav": page.subnav,
        "imgSrc": "images/experience-virtual-reality-art-in-your.jpg",
        "placeholder": "",
        "summary": page.title,
        "contentLength": 3584
      }
    );
  });
  fs.writeFile("data/pages.json", JSON.stringify(sitemap), function(){});

});
