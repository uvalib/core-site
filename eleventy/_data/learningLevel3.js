const Cache = require("@11ty/eleventy-cache-assets");
const { AxeResults } = require("axe-core");

gmapskey = "AIzaSyBSD75H3-YuH7LDPRWaEFuBRMx1m-tWfo8";

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

  let results = [];
  for (let i=0; i<json.length; i++) {
    let e = json[i];

    const link =  _getValue(e.field_link_to_learning_item, 'uri')[0];
    let obj = {
        'uuid': _getValue(e.uuid)[0],
        'created': _getValue(e.created)[0],
        'changed': _getValue(e.changed)[0],
        'sticky': _getValue(e.sticky)[0],
        'promote': _getValue(e.promote)[0],
        'title': _getValue(e.title)[0],
        'body': _getValue(e.body)[0],
        'learningItemUrl': link,
        'source': _getValue(e.field_source)[0],
        'category': _getValue(e.field_category)[0],
        'format': _getValue(e.field_format)[0],
        'length': _getValue(e.field_length)[0],
        'tags': _getValue(e.field_testing_taxonomy, 'target_uuid'),
//          'youtube': link && link.includes('youtube') && link.includes('watch')?
//              link.replace(/.*v\=/,''): null,
//          'youtubelist': link && link.includes('youtube') && link.includes('list')?
//              link.replace(/.*list\=/,''): null,
    };

    if (link && link.includes('youtube')) {
      obj.youtubeURL = link;
      if (link.indexOf('watch')>0) {
        // youtube video
        obj.youtube = link.replace(/.*v\=/,'');
        obj.youtubethumb = `https://img.youtube.com/vi/${obj.youtube}/default.jpg`;
      } else if (link.includes('list')) {
        // youtube playlist
        obj.youtubelist = link.replace(/.*list\=/,'');
        let playlist = await Cache(`https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${obj.youtubelist}&key=${gmapskey}`, {
            duration: "5m", // 5 minutes
            type: "json"
        });
        obj.youtubethumb = playlist.items[0].snippet.thumbnails.default.url;
      }
    }

    results.push(obj);    

    
  }
  return results;

//  return  json.map(function(e){
//
//  })
  
};