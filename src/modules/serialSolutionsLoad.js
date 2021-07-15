let loadModule = (url)=>{
    var script = document.createElement('script');
    script.type = 'module';
    script.src = url;  
    document.getElementsByTagName('head')[0].appendChild(script);
}

loadModule('https://www.library.virginia.edu/module-build/uvalib-page.js');

// While page component loads lets wrap 
let main = document.querySelector('div[role="main"]');
let wrapper = document.createElement('uvalib-page');
wrapper.setAttribute('simpleheader','');
main.parentNode.insertBefore(wrapper, main);
wrapper.appendChild(main);