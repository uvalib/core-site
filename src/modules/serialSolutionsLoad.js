console.log('testing');

var script = document.createElement('script');
script.type = 'module';
script.src = 'https://www.library.virginia.edu/module-build/uvalib-logos.js';  

document.getElementsByTagName('head')[0].appendChild(script);

console.log('testing2');