// Based on audit.js in the accessibility developer tools node module.
var page = require('webpage').create(),
    system = require('system'),
    filename, url;

// disabling so we can get the document root from iframes (http -> https)
page.settings.webSecurityEnabled = false;

if (system.args.length !== 2) {
  console.log('Usage: phantomjs ./accessibility-report.js FILE');
  phantom.exit();
} else {
  filename = system.args[1];
  url = filename.replace('./data','https://wwwstatic.lib.virginia.edu/data');
  page.open(url, function (status) {
    if (status !== 'success') {
      console.log('Failed to load the page at ' + url + ". Status was: " + status);
      phantom.exit();
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
        var results = axs.Audit.run();
        var rpt = '';
//        if (results.result == axs.constants.AuditResult.PASS) {
          rpt = axs.Audit.createReport(results);
//        }
        return rpt;
      });
      if (report != '') {
        console.log(url);
        console.log(report);
      }
      phantom.exit();
    }
  });
}
