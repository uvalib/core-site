#!/bin/bash
rm -rf bower_components
git pull
bower install
./import-pages.js
polymer serve
