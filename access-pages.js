#!/usr/local/bin/node
// Script identifies all site pages and checks each for accessibility problems.

// Get all files from a directory tree recursively synchronously.
// See https://gist.github.com/kethinov/6658166
var walkSync = function(dir, filelist) {
  var path = path || require('path');
  var fs = fs || require('fs'),
      files = fs.readdirSync(dir);
  filelist = filelist || [];
  files.forEach(function(file) {
    if (fs.statSync(path.join(dir, file)).isDirectory()) {
      filelist = walkSync(path.join(dir, file), filelist);
    }
    else {
      filelist.push(path.join(dir, file));
    }
  });
  return filelist;
};
//console.log(walkSync('./data/pages'));
//process.exit();

// Check accessibility for each file
walkSync('./data/pages').forEach( function(fullpathFile, index) {
  console.log(fullpathFile);
  var fs = require('fs');
  fs.stat(fullpathFile, function(err2, stat) {
    if (err2) {
      console.error('File state error: ', err2);
      return;
    }
    // if file then check accessibility.
    if (stat.isFile()) {
      var pageAccessibility = testAccessibility(fullpathFile);
      // if there were problems with the page then write report to disk.
      if (pageAccessibility != '') {
        console.log(pageAccessibility);
      }
    } else if (stat.isDirectory()) {
      console.log(fullpathFile);
    }
  });
});

function testAccessibility(filePathName) {
  var phantom = require('node-phantom');
  phantom.create(function(err, ph) {
    return ph.createPage(function(err, page) {
      page.settings.webSecurityEnabled = false;
      var results = page.open(filePathName, function (status) {
        if (status !== 'success') {
          return 'Failed to load the page at ' + filePathName + ". Status was: " + status;
    //      phantom.exit();
        } else {
          page.evaluate(function() {
            // if target website has an AMD loader, we need to make sure
            // that window.axs is still available
            if (typeof define !== 'undefined' && define.amd) {
                define.amd = false;
            }
          });
          page.injectJs('./node_modules/accessibility-developer-tools/dist/js/axs_testing.js');
          var report = page.evaluate(function() {
            var auditResults = axs.Audit.run();
            var output = '';
            if (auditResults.result == FAIL) {
              output = axs.Audit.createReport(auditResults);
            }
            return output;
          });
          return report;
    //      console.log(report);
    //      phantom.exit();
        }
      });
      return results;
    });
  });
}
