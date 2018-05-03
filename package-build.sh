#!/bin/bash

cp -r build/es5-bundled build/es6-unbundled/ie11

cp index.html.testing build/es6-unbundled/index.html
cp -r js/ build/es6-unbundled/js
cp -r build/es5-bundled/src build/es6-unbundled/src-compiled
cp -r build/es5-bundled/bower_components build/es6-unbundled/bower_components-compiled
cp -r build/es5-unbundled/bower_components build/es6-unbundled/bower_components-unbundled-compiled
find build/es6-unbundled/src-compiled -type f -exec sed -i'' -e 's/bower_components\//bower_components-compiled\//g' {} +
