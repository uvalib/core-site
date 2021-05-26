module.exports = function(eleventyConfig) {

    eleventyConfig.addFilter('JSONstringify', function(value){
      return JSON.stringify(value);
    });

    eleventyConfig.addShortcode("getWCImports", function(content){
      return `
        <script type="module">
${(content.includes("uvalib-video-lightbox"))? "import 'https://static.lib.virginia.edu/js/controllers/components-build/uvalib-video-lightbox.js';":""}
        </script>        
      `;
    });

    return {
      dir: { input: 'eleventy', output: 'data' }
    };    
  };