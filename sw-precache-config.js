module.exports = {
  staticFileGlobs: [
    'manifest.json',
    'src/ce-fix.html',
    'bower_components/webcomponentsjs/webcomponents-loader.js',
    'images/*'
  ],
  runtimeCaching: [
    {
      urlPattern: /\/js\/.*\.js/,
      handler: 'fastest',
      options: {
        cache: {
          name: 'local-js-cache'
        }
      }
    },
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
      urlPattern: /.*\.(png|jpg|gif|svg|webp)/i,
      handler: 'fastest',
      options: {
        cache: {
          maxEntries: 400,
          name: 'data-images-cache'
        }
      }
    },
    {
      urlPattern: /\/data\/pages\/.*/,
      handler: 'fastest',
      options: {
        cache: {
          maxEntries: 200,
          name: 'data-pages-cache'
        }
      }
    },
    {
      urlPattern: /\/data\/.*json/,
      handler: 'fastest',
      options: {
        cache: {
          maxEntries: 200,
          name: 'data-json-cache'
        }
      }
    },
    {
      urlPattern: /\/data\/pages\/emergency/,
      handler: 'networkFirst',
      options: {
        cache: {
          maxEntries: 200,
          name: 'data-pages-cache'
        }
      }
    },
    {
      urlPattern: /^https:\/\/static\.lib\.virginia\.edu\/.*/,
      handler: 'fastest',
      options: {
        cache: {
          maxEntries: 200,
          name: 'static-file-cache'
        }
      }
    },
    {
      urlPattern: /^https:\/\/api\.devhub\.virginia\.edu\/.*/,
      handler: 'fastest',
      options: {
        cache: {
          maxEntries: 100,
          name: 'data-api-cache'
        }
      }
    },
    {
      urlPattern: /^https:\/\/use\.typekit\.net/.*/,
      handler: 'fastest',
      options: {
        cache: {
          maxEntries: 40,
          name: 'data-typekit-cache'
        }
      }
    },
    {
      urlPattern: /^https:\/\/api\.devhub\.virginia\.edu\/.*\/library\/alerts/,
      handler: 'networkFirst',
      options: {
        cache: {
          maxEntries: 5,
          name: 'data-api-cache'
        }
      }
    }
  ]
};
