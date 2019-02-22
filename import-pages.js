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
function addToSitemap(page,type,template){
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
      "type": type,
      "template": template
    }
  );
  console.log('added page to sitemap '+page.title);
}

async function makePages(body,template,defaultFunc,type){
  // Some global search and replace here
  body.replace('U.Va.', 'UVA');
  var pages = JSON.parse(body);

  // create the pages
  var pageTemplate = await fs.readFileAsync("templates/"+template,'utf8');
  if(pages && pages.length > 0)
    for (var i=0; i<pages.length; i++) {
      var page = pages[i];
      if (page.body) {
        page.body = page.body.replace(/https:\/\/drupal\.lib\.virginia\.edu\/sites\/default\/files\//g, '/files/');
        page.body = page.body.replace(/\/sites\/default\/files\//g, '/files/');
      }

      if (defaultFunc) {
        var defaults = defaultFunc(page);
        for (key in defaults) {
          page[key] = defaults[key];
        }
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
        $('[href]').each(function(i,elem){
          var href = $(this).attr('href');
          if (href.match(/^#.*$/)) {
            $(this).attr('href', page.path+href);
          }
        });
/*
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
          if (page.iframe) {
            $(this).attr('target', '_top');
          }
        });
        $('[src]').each(function(i,elem){
          var attr = $(this).attr('src');
          if (page.iframe && attr.startsWith('/')) {
            $(this).attr('src', "https://www.library.virginia.edu"+attr);
          }
        });
*/
        // Use figure where we have the content to support it
        $('img').each(function(i,img){
          // make sure that we are not already looking at a figure
          if ($(this).parent.name.toLowerCase() === 'figure') { return; }
          var align = $(this).attr('data-align');
          var fig = $('<figure role="group" class="caption caption-img align-'+align+'">');
          fig.append($(this).clone());
          var caption = $(this).attr('data-caption');
          if (caption) {
            var figcap = $('<figcaption>');
            figcap.append(caption);
            fig.append(figcap);
          }
          $(this).replaceWith(fig);
        });

        page.head = $('head').html();
        page.body = $('body').html();
      }


      addToSitemap(page,type,page.template);
      await makeDir("data/pages"+page.path);
      fs.writeFile("data/pages"+page.path+page.filename,
                     mustache.render( pageTemplate, page ), function(){});
      console.log('wrote file? '+"data/pages"+page.path+page.filename);
    }
};

async function buildPages() {
  // build basic pages
  var body = await request('https://uvalib-api.firebaseio.com/pages.json');
  await makePages(body, 'page-template.html');
  // build major exhibit pages
  body = await request('https://uvalib-api.firebaseio.com/exhibit-pages.json');
  await makePages(body, 'page-exhibit-template.html',
                  page=>{return {
                    path:"/exhibitions/"+page.urlSlug
                  }},'exhibit');
  // build library pages
  var libs = await request('https://uvalib-api.firebaseio.com/libraries.json');
  await makePages(libs, 'page-library-template.html',
                  page=>{return {
                    path:"/libraries/"+page.slug
                  }},'library');
  // build bookplate pages
  body = await request('https://uvalib-api.firebaseio.com/bookplates.json');
  await makePages(body, 'page-bookplate-template.html',
                  page=>{return {
                    parentPage:{id:1224},
                    bookplateImage:{url:(page.bookplateImage)?page.bookplateImage.url:"https://static.lib.virginia.edu/files/generic-bookplate.png",alt:"University of Virginia Library Bookplate image"},
                    path:"/bookplates/"+page.fundID
                  }},'bookplate');
  teams = await request('https://uvalib-api.firebaseio.com/teams.json');
  var areas = await request('https://uvalib-api.firebaseio.com/areas.json');
  var staff = await request('https://uvalib-api.firebaseio.com/people.json');
  // build team pages
  var areasParsed = JSON.parse(areas);
  var staffParsed = JSON.parse(staff);
  var teamsParsed = JSON.parse(teams);
  await makePages(teams, 'page-team-template.html',
                  team=>{return {
                    path:"/teams/"+team.uuid,
                    area:(team.area)?areasParsed.find(area => area.uuid===team.area):"",
                    manager:(team.manager)?staffParsed.find(staff => staff.uuid===team.manager):""
                  }},'team');
  // build area Pages
  await makePages(areas, 'page-area-template.html',
                  area=>{return {
                    path:"/areas/"+area.uuid
                  }},'area');
  // build staff pages
  staffParsed.forEach(person=>person.teams=(person.teams)? teamsParsed.filter(
    team=>person.teams.indexOf(team.uuid)>-1
  ):[] );

  await makePages(JSON.stringify(staffParsed), 'page-staff-template.html',
                  person=>{return {
                    parentPage:{id:1137},
                    path:"/staff/"+person.computingId,
                    title:(person.displayName)?
                      person.displayName:
                      person.firstName+" "+person.lastName,
                    field_image:(person.field_image)?
                      person.field_image:"",
                    profileOption: (person.guides || person.cv || person.profile)? "YES PLEASE":null,
                    bioWebLinks: (person.twitter || person.linkedin || person.site || person.field_orcid_id )?"YES PLEASE":null,
                    teamOption: (person.teams && person.teams.length > 0 && person.teams[0].body)?"YES PLEASE":null
                  }},'staffprofile');
  // build area pages
  //  https://uvalib-api.firebaseio.com/areas

  console.log('making sitemap now');
  makeDir("data").then(path => {
    fs.writeFile("data/pages.json", JSON.stringify(sitemap), function(){});
    fs.writeFile("sitemap.txt", sitemap.map(p=>'https://www.library.virginia.edu'+p.path).join('\n'), function(){});
  });
};

buildPages();
