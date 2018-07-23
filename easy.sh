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
rm -rf ../.uvalib-page.bak
mv uvalib-page ../.uvalib-page.bak;
git clone https://github.com/uvalib-components/uvalib-page.git
rm -rf ../.uvalib-banner.bak
mv uvalib-page ../.uvalib-banner.bak;
git clone https://github.com/uvalib-components/uvalib-banner.git
rm -rf ../.uvalib-bookplates.bak
mv uvalib-bookplates ../.uvalib-bookplates.bak;
git clone https://github.com/uvalib-components/uvalib-bookplates.git
cd ..
./import-pages.js
./import-files-lite.js
#./imagemin-files.js
polymer serve
