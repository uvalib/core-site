#!/bin/bash
rm -rf .bower_components.bak;
mv bower_components .bower_components.bak;
git pull
npm install
bower install
cd bower_components;
rm -rf ../.uvalib-theme.bak
mv uvalib-theme ../.uvalib-theme.bak;
git clone https://github.com/uvalib-components/uvalib-theme.git
cd ..
./import-pages.js
./import-files.js
./imagemin-files.js
polymer serve
