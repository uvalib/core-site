# UVA Library Web App

## Prerequisites

### Polymer CLI

Install [polymer-cli](https://github.com/Polymer/polymer-cli):

    npm install -g polymer-cli

### Setup

    git clone https://github.com/uvalib/core-site.git
    git checkout develop
    cd core-site
    npm install
    bower install 

### Import pages from Library API

    ./import-pages.js
    ./import-files.js

## Start the development server

    polymer serve

## Build

    npm run build

## Test the build

    polymer serve 

## Deploy to testing server

    git commit -am'your message' && git push
    and then view changes https://library-legacy-dev.internal.lib.virginia.edu/

## Deploy to production

    git checkout master && git merge develop && git push
    Then run the TeamCity job https://teamcity.lib.virginia.edu/buildConfiguration/UX_StaticWebsite_CoreSiteBuid
