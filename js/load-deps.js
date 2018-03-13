// Twitters es6-feature-detect
var str = 'class ಠ_ಠ extends Array {constructor(j = "a", ...c) {const q = (({u: e}) => {return { [`s${c}`]: Symbol(j) };})({});super(j, q, ...c);}}' +
          'new Promise((f) => {const a = function* (){return "\u20BB7".match(/./u)[0].length === 2 || true;};for (let vre of a()) {' +
          'const [uw, as, he, re] = [new Set(), new WeakSet(), new Map(), new WeakMap()];break;}f(new Proxy({}, {get: (han, h) => h in han ? han[h] ' +
          ': "42".repeat(0o10)}));}).then(bi => new ಠ_ಠ(bi.rd));';

var oldBrowser = false;
var head = document.getElementsByTagName('head')[0];
var addScript = function(src){
  var script = document.createElement('script');
  script.type = 'text/javascript';
  script.src = src;
  script.async = false;
  return script;
}

var addImport = function(href){
  var link = document.createElement('link');
  link.rel = "import";
  link.href= href;
  return link;
}

try {
  eval(str);
} catch(e) {
  console.log('Your browser does not support ES6!');
  oldBrowser = true;
//  if (window.customElements)
//    head.appendChild( addScript('bower_components-compiled/webcomponentsjs/custom-elements-es5-adapter.js') );
}

if (oldBrowser) {
  head.appendChild( addScript('bower_components-compiled/webcomponentsjs/custom-elements-es5-adapter.js') );
  head.appendChild( addScript('bower_components-compiled/webcomponentsjs/webcomponents-lite.js') );
  head.appendChild( addImport('src-compiled/uvalib-app.html') );
} else {
  head.appendChild( addScript('bower_components/webcomponentsjs/webcomponents-lite.js') );
  head.appendChild( addImport('src/uvalib-app.html') );
}
