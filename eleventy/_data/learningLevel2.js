const Cache = require("@11ty/eleventy-cache-assets");
var striptags = require('striptags');

module.exports = async function() {
  // Library Learning Tags from Drupal : https://drupal.lib.virginia.edu/rest/tags?_format=json
  let json = await Cache("https://drupal.lib.virginia.edu/rest/tags?_format=json", {
    duration: "5m", // 5 minutes
    type: "json"
  });

  var _getValue = (v,k='value')=>{
      return v && Array.isArray(v) && v.length>0?
        v.map(i=>i[k]).filter(i=>i!=undefined):
        [];
  };

  return json.map(e=>{
      return {
          'uuid': _getValue(e.uuid)[0],
          'name': _getValue(e.name)[0],
          'description': striptags(_getValue(e.description)[0]).trim(),
          'icon': _getValue(e.field_url_to_icon, 'uri').map(i=>i.replace("drupal.lib.virginia.edu/sites/default","wwwstatic.lib.virginia.edu"))[0],
          'weight': _getValue(e.weight)[0],
          'parent': _getValue(e.parent, 'target_uuid')[0]
      };
  }).filter(e=>e.parent);
  
};