#!/bin/bash
cp index.html.testing build/es6-unbundled/index.html
cp -r js/ build/es6-unbundled/js
cp -r build/es5-bundled/src build/es6-unbundled/src-compiled
#cat build/es5-unbundled/bower_components/webcomponentsjs/custom-elements-es5-adapter.js | cat - build/es5-unbundled/bower_components/webcomponentsjs/webcomponents-lite.js > temp && mv temp build/es5-unbundled/bower_components/webcomponentsjs/webcomponents-lite.js
cp -r build/es5-bundled/bower_components build/es6-unbundled/bower_components-compiled
find build/es6-unbundled/src-compiled -type f -exec sed -i'' -e 's/bower_components\//bower_components-compiled\//g' {} +
