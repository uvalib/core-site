module.exports = {
  staticFileGlobs: [
    'manifest.json',
    'bower_components/webcomponentsjs/webcomponents-loader.js',
    'images/*'
  ],
  runtimeCaching: [
    {
      urlPattern: /\/bower_components\/webcomponentsjs\/.*.js/,
      handler: 'fastest',
      options: {
        cache: {
          name: 'webcomponentsjs-polyfills-cache'
        }
      }
    },
    {
      urlPattern: /.*\.(png|jpg|gif|svg)/i,
      handler: 'fastest',
      options: {
        cache: {
          maxEntries: 500,
          name: 'data-images-cache'
        }
      }
    },
    {
      urlPattern: /\/data\/pages\/.*/,
      handler: 'fastest',
      options: {
        cache: {
          maxEntries: 500,
          name: 'data-pages-cache'
        }
      }
    },
    {
      urlPattern: /\/data\/.*json/,
      handler: 'fastest',
      options: {
        cache: {
          maxEntries: 500,
          name: 'data-json-cache'
        }
      }
    },
    {
      urlPattern: /^https:\/\/api\.devhub\.virginia\.edu\/.*/,
      handler: 'fastest',
      options: {
        cache: {
          maxEntries: 500,
          name: 'data-api-cache'
        }
      }
    }
  ]
};
