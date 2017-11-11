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
      // rid of ending slash
      page.path = page.path.replace(/\/$/, "");

      makeDir("data/pages"+page.path).then(path => {
        var tmpfilename = sanitize(page.title).replace(/\s/g,'_')+".html";
        //temp write to flat directory
        fs.writeFile("data/pages/"+tmpfilename,
                     mustache.render( pageTemplate, page ), function(){});
        fs.writeFile("data/pages"+page.path+"/"+page.filename,
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
        "imgSrc": "images/experience-virtual-reality-art-in-your.jpg",
        "placeholder": "data:image/jpeg;base64,/9j/4QAYRXhpZgAASUkqAAgAAAAAAAAAAAAAAP/sABFEdWNreQABAAQAAAA8AAD/4QMxaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLwA8P3hwYWNrZXQgYmVnaW49Iu+7vyIgaWQ9Ilc1TTBNcENlaGlIenJlU3pOVGN6a2M5ZCI/PiA8eDp4bXBtZXRhIHhtbG5zOng9ImFkb2JlOm5zOm1ldGEvIiB4OnhtcHRrPSJBZG9iZSBYTVAgQ29yZSA1LjYtYzExMSA3OS4xNTgzMjUsIDIwMTUvMDkvMTAtMDE6MTA6MjAgICAgICAgICI+IDxyZGY6UkRGIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyI+IDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiIHhtbG5zOnhtcE1NPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvbW0vIiB4bWxuczpzdFJlZj0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL3NUeXBlL1Jlc291cmNlUmVmIyIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bXBNTTpEb2N1bWVudElEPSJ4bXAuZGlkOkYwNjMwQThFQTQxODExRTY5NjdCRDcxN0ZDQzkwNzU3IiB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOkYwNjMwQThEQTQxODExRTY5NjdCRDcxN0ZDQzkwNzU3IiB4bXA6Q3JlYXRvclRvb2w9IkFkb2JlIFBob3Rvc2hvcCBDQyAyMDE1IChNYWNpbnRvc2gpIj4gPHhtcE1NOkRlcml2ZWRGcm9tIHN0UmVmOmluc3RhbmNlSUQ9InhtcC5paWQ6NDY0MDU4NjRBNDEwMTFFNjk2N0JENzE3RkNDOTA3NTciIHN0UmVmOmRvY3VtZW50SUQ9InhtcC5kaWQ6NDY0MDU4NjVBNDEwMTFFNjk2N0JENzE3RkNDOTA3NTciLz4gPC9yZGY6RGVzY3JpcHRpb24+IDwvcmRmOlJERj4gPC94OnhtcG1ldGE+IDw/eHBhY2tldCBlbmQ9InIiPz7/7gAmQWRvYmUAZMAAAAABAwAVBAMGCg0AAATaAAAE/QAABTMAAAVg/9sAhAAGBAQEBQQGBQUGCQYFBgkLCAYGCAsMCgoLCgoMEAwMDAwMDBAMDg8QDw4MExMUFBMTHBsbGxwfHx8fHx8fHx8fAQcHBw0MDRgQEBgaFREVGh8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx//wgARCAAFAAoDAREAAhEBAxEB/8QAggABAQAAAAAAAAAAAAAAAAAABAcBAQEAAAAAAAAAAAAAAAAAAAABEAADAQAAAAAAAAAAAAAAAAAAEBMBEQACAwAAAAAAAAAAAAAAAAAQARExQRIBAAAAAAAAAAAAAAAAAAAAEBMAAQQBBQEAAAAAAAAAAAAAAQAQETEh8FFhkbHR/9oADAMBAAIRAxEAAAGcgU//2gAIAQEAAQUC2cz/2gAIAQIAAQUCX//aAAgBAwABBQJf/9oACAECAgY/Aj//2gAIAQMCBj8CP//aAAgBAQEGPwJVOD//2gAIAQEDAT8hsAM63HK+r//aAAgBAgMBPyEN/9oACAEDAwE/IS3/2gAMAwEAAhEDEQAAEE//2gAIAQEDAT8QI8IGQGjaBdrrTxf/2gAIAQIDAT8Qg3//2gAIAQMDAT8Qk3//2Q==",
        "summary": page.title,
        "contentLength": 3584
      }
    );
  });
  fs.writeFile("data/pages.json", JSON.stringify(sitemap), function(){});

});
