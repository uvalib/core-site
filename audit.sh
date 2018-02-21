#!/bin/bash
for f in $(find ./data/pages -type f -name "*html")
#  do phantomjs ./node_modules/accessibility-developer-tools/tools/runner/audit.js $f
  do phantomjs ./accessibility-report.js $f
done
