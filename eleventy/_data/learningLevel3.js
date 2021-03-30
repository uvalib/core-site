const Cache = require("@11ty/eleventy-cache-assets");

module.exports = async function() {
  // Library Learning API: https://drupal.lib.virginia.edu/rest/learning-items?_format=json
  let json = await Cache("https://drupal.lib.virginia.edu/rest/learning-items?_format=json", {
    duration: "5m", // 5 minutes
    type: "json"
  });


  var _getValue = (v,k='value')=>{
    return v && Array.isArray(v) && v.length>0? 
      v.map(i=>i[k]): 
      [];
  };

  return  json.map(e=>{
      return {
          'uuid': _getValue(e.uuid)[0],
          'created': _getValue(e.created)[0],
          'changed': _getValue(e.changed)[0],
          'sticky': _getValue(e.sticky)[0],
          'promote': _getValue(e.promote)[0],
          'title': _getValue(e.title)[0],
          'body': _getValue(e.body)[0],
          'learningItemUrl': _getValue(e.field_link_to_learning_item, 'uri')[0],
          'source': _getValue(e.field_source)[0],
          'category': _getValue(e.field_category)[0],
          'format': _getValue(e.field_format)[0],
          'length': _getValue(e.field_length)[0],
          'tags': _getValue(e.field_testing_taxonomy, 'target_uuid'),
          'youtube': e.learningItemUrl && e.learningItemUrl.includes('youtube')?
              e.learningItemUrl: null
          
      };
  })
  
};