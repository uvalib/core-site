const Cache = require("@11ty/eleventy-cache-assets");

module.exports = async function() {
  // Library Pages API: https://uvalib-api.firebaseio.com/pages.json
  let json = await Cache("https://uvalib-api.firebaseio.com/pages.json", {
    duration: "1d", // 1 day
    type: "json" // also supports "text" or "buffer"
  });

  return json;
};
