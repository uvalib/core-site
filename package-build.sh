#!/bin/bash
cp index.html.testing build/es6-unbundled/index.html
cp -r js/ build/es6-unbundled/js
cp -r build/es5-unbundled/src build/es6-unbundled/src-compiled
cp -r build/es5-unbundled/bower_components build/es6-unbundled/bower_components-compiled
find build/es6-unbundled/src-compiled -type f -exec sed -i'' -e 's/bower_components\//bower_components-compiled\//g' {} +
cp bower_components/bwt-datatable/src/* build/es6-unbundled/bower_components/bwt-datatable/src/
cp bower_components/bwt-datatable/src/* build/es6-unbundled/bower_components-compiled/bwt-datatable/src/
