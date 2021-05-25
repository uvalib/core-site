module.exports = function(eleventyConfig) {

    eleventyConfig.addFilter('JSONstringify', function(value){
      return JSON.stringify(value);
    });

    eleventyConfig.addShortcode("getWCImports", function(content){
      return `
        <script type="module">
          ${(content.includes("sp-theme"))? "import '@spectrum-web-components/theme/sp-theme.js'; import '@spectrum-web-components/theme/src/themes.js';":""}
          ${(content.includes("sp-dialog-wrapper"))? "import '@spectrum-web-components/dialog/sp-dialog-wrapper.js';":""}
          ${(content.includes("overlay-trigger"))? "import '@spectrum-web-components/overlay/overlay-trigger.js';":""}
          ${(content.includes("lite-youtube"))? "import '@justinribeiro/lite-youtube/lite-youtube.js';":""}
        </script>        
      `;
    });

    return {
      dir: { input: 'eleventy', output: 'data' }
    };    
  };