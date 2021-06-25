let loadModule = (url)=>{
    var script = document.createElement('script');
    script.type = 'module';
    script.src = url;  
    document.getElementsByTagName('head')[0].appendChild(script);
}

loadModule('https://www.library.virginia.edu/module-build/uvalib-header.js');
loadModule('https://www.library.virginia.edu/module-build/uvalib-footer.js');
