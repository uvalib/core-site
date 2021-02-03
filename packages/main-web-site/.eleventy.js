module.exports = function(eleventyConfig) {
    eleventyConfig.addPassthroughCopy({"node_modules/@webcomponents/webcomponentsjs": "assets/webcomponents"});
    return {
      dir: { input: 'src', output: '_site' }
    };
  };