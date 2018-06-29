#!/usr/local/bin/node
var request = require('request-promise'),
    fs = require('fs'),
    makeDir = require('make-dir'),
    mustache = require( "mustache" ),
    sanitize = require("sanitize-filename")
    cheerio = require('cheerio')
    util = require('util');

fs.readFileAsync = util.promisify(fs.readFile);

var sitemap = [];
function addToSitemap(page,type){
  var tmpfilename = sanitize(page.title).replace(/\s/g,'_');
  var parent = (page.parentPage) ? page.parentPage.id : '';
  sitemap.push(
    {
      "title": page.title,
      "time": "",
      "author": "",
      "category": "Pages",
      "id": tmpfilename,
      "pageId": page.id,
      "parentId": parent,
      "link": page.path,
      "path": page.path,
      "sidebar": page.sidebar,
      "subnav": page.subnav,
      "iframe": page.iframe,
      "imgSrc": "",
      "placeholder": "",
      "summary": page.title,
      "contentLength": 3584,
      "type": type
    }
  );
  console.log('added page to sitemap '+page.title);
}

async function makePages(body,template,mkPath,type,defaults,parentId){
  // Some global search and replace here
  body.replace('U.Va.', 'UVA');

  var pages = JSON.parse(body);

  // create the pages
  var pageTemplate = await fs.readFileAsync(template,'utf8');

  for (var i=0; i<pages.length; i++) {
    var page = pages[i];
//  pages.forEach(page => {
    if (page.body) {
      page.body = page.body.replace(/https:\/\/drupal\.lib\.virginia\.edu\/sites\/default\/files\//g, '/files/');
      page.body = page.body.replace(/\/sites\/default\/files\//g, '/files/');
    }

    if (!page.path && mkPath) page.path = mkPath(page);

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
    if (parentId) page.parentPage = {id: parentId};
if (defaults)
    for (key in defaults) {
      if (!page[key]) page[key]=defaults[key];
    }
    addToSitemap(page,type);
    await makeDir("data/pages"+page.path);
    fs.writeFile("data/pages"+page.path+page.filename,
                   mustache.render( pageTemplate, page ), function(){});
    console.log('wrote file? '+"data/pages"+page.path+page.filename);
  }
//  });

};

async function buildPages() {
  var body = await request('https://uvalib-api.firebaseio.com/pages.json');
  await makePages(body, 'page-template.html');

  body = await request('https://uvalib-api.firebaseio.com/exhibit-pages.json');
  await makePages(body, 'page-exhibit-template.html', page=>{return "/exhibits/"+page.urlSlug},'exhibit');

  body = await request('https://uvalib-api.firebaseio.com/libraries.json');
  await makePages(body, 'page-library-template.html', page=>{return "/libraries/"+page.slug},'library');

  body = await request('https://uvalib-api.firebaseio.com/bookplates.json');
  await makePages(body, 'page-bookplate-template.html', page=>{return "/bookplates/"+page.fundID},'bookplate',{bookplateImage:{url:"https://static.lib.virginia.edu/files/generic-bookplate.png",alt:"University of Virginia Library Bookplate image"}},1224);

  console.log('making sitemap now');
  makeDir("data").then(path => {
    fs.writeFile("data/pages.json", JSON.stringify(sitemap), function(){});
  });
};

buildPages();
