#!/usr/local/bin/node
var request = require('request'),
    fs = require('fs'),
    makeDir = require('make-dir'),
    mustache = require( "mustache" ),
    sanitize = require("sanitize-filename")
    cheerio = require('cheerio');

request('https://uvalib-api.firebaseio.com/pages.json', function(error, response, body){

  // Some global search and replace here
  body.replace('U.Va.', 'UVA');

  var pages = JSON.parse(body);

  // create the pages
  fs.readFile('page-template.html', 'utf8', function(err, pageTemplate){
    pages.forEach(page => {
      if (page.body) {
        page.body = page.body.replace(/https:\/\/drupal\.lib\.virginia\.edu\/sites\/default\/files\//g, '/files/');
        page.body = page.body.replace(/\/sites\/default\/files\//g, '/files/');
      }

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

      if (page.body) {
        const $ = cheerio.load(page.body);
        $('[href]').each(function(i,elem) {
          var attr = $(this).attr('href');
          if (match = attr.match(/^https?:\/\/(www\.)?library\.virginia\.edu(.*\.pdf)$/i) ) {
              $(this).attr('href', "https://wwwstatic.lib.virginia.edu"+match[2]);
          }
          if (match = attr.match(/^(\/.*\.pdf)$/i) ) {
              $(this).attr('href', "https://wwwstatic.lib.virginia.edu"+match[1]);
          }
          if (attr.match(/^#.*$/)) {
            $(this).attr('href', page.path+attr);
          }
        });
        page.body = $('head').html();
        page.body += $('body').html();
      }

      makeDir("data/pages"+page.path).then(path => {
        var tmpfilename = sanitize(page.title).replace(/\s/g,'_')+".html";
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
        "time": "",
        "author": "",
        "category": "Pages",
        "id": tmpfilename,
        "link": page.path,
        "path": page.path,
        "sidebar": page.sidebar,
        "subnav": page.subnav,
        "iframe": page.iframe,
        "imgSrc": "",
        "placeholder": "",
        "summary": page.title,
        "contentLength": 3584
      }
    );
  });
  fs.writeFile("data/pages.json", JSON.stringify(sitemap), function(){});
});
