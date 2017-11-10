#!/usr/local/bin/node
var request = require('request'),
    fs = require('fs'),
    makeDir = require('make-dir'),
    mustache = require( "mustache" ),
    sanitize = require("sanitize-filename");

request('https://uvalib-api.firebaseio.com/pages.json', function(error, response, body){
  var pages = JSON.parse(body);
  fs.readFile('page-template.jsont', 'utf8', function(err, jsont){
    pages.forEach(function(page){
      if (!page.path.startsWith('/')) page.path = "/"+page.path;
      makeDir("data/pages"+page.path).then(path => {
        var tmpfilename = sanitize(page.title).replace(/\s/g,'_')+".html";
//        console.log(page);
        fs.writeFile("data/pages/"+tmpfilename,
                     mustache.render( jsont, page ));
      });
    });
  });
});
