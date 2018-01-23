#!/bin/bash
rm -rf bower_components
git pull
bower install
cd bower_components; rm -rf uvalib-theme; git clone https://github.com/uvalib-components/uvalib-theme.git
cd ..
./import-pages.js
./import-files.js
polymer serve
