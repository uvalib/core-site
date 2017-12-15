# UVA Library Web App

## Prerequisites

### Polymer CLI

Install [polymer-cli](https://github.com/Polymer/polymer-cli):

    npm install -g polymer-cli

### Setup

    git clone https://github.com/uvalib/core-site.git
    cd core-site
    npm install
    bower install

### Import pages from Library API

    ./import-pages.js

## Start the development server

    polymer serve

## Build

    npm run build

## Test the build

Use `polymer serve` to serve a specific build preset of the app. For example:

    polymer serve build/es5-bundled
