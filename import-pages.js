#!/usr/local/bin/node
var request = require('request'),
    fs = require('fs'),
    makeDir = require('make-dir'),
    sqsJsonTemplate = require( "node-squarespace-jsont" );

request('https://uvalib-api.firebaseio.com/pages.json', function(error, response, body){
  var pages = JSON.parse(body);
  fs.readFile('page-template.jsont', 'utf8', function(err, jsont){
    pages.forEach(function(page){
      if (!page.path.startsWith('/')) page.path = "/"+page.path;
      makeDir("data/pages"+page.path).then(path => {
        var result = sqsJsonTemplate.render( jsont, pages );
      });
    });
  });
});
