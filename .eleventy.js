module.exports = function(eleventyConfig) {

    eleventyConfig.addFilter('JSONstringify', function(value){
      return JSON.stringify(value);
    });

    return {
      dir: { input: 'eleventy', output: 'data' }
    };
  };