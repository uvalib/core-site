module.exports = {
  staticFileGlobs: [
    'manifest.json',
    'src/ce-fix.html',
    'bower_components/webcomponentsjs/webcomponents-loader.js',
    'bower_components/uva-helper-libs/polyfills.html',
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
      urlPattern: /^https:\/\/static\.lib\.virginia\.edu\/js\/.*/,
      handler: 'networkOnly'
    },
    {
      urlPattern: /\/bower_components\/uvalib-form-builder\/.*/,
      handler: 'networkOnly'
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
      handler: 'networkFirst',
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
      urlPattern: /^https:\/\/analytics\.lib\.virginia\.edu\/.*/,
      handler: 'networkOnly'
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
      urlPattern: /^https:\/\/use\.typekit\.net\/.*/,
      handler: 'fastest',
      options: {
        cache: {
          maxEntries: 100,
          name: 'typekit-cache'
        }
      }
    },
    {
      urlPattern: /^https:\/\/p\.typekit\.net\/.*/,
      handler: 'fastest',
      options: {
        cache: {
          maxEntries: 100,
          name: 'typekit-cache2'
        }
      }
    },
    {
      urlPattern: /^https:\/\/api\.devhub\.virginia\.edu\/.*/,
      handler: 'fastest',
      options: {
        cache: {
          maxEntries: 5,
          name: 'data-api-cache'
        }
      }
    },
    {
      urlPattern: /^https:\/\/api.devhub.virginia.edu\/.*\/library\/web\/banners.*/,
      handler: 'networkOnly'
    },
    {
      urlPattern: /^https:\/\/api\.devhub\.virginia\.edu\/.*\/library\/alerts/,
      handler: 'networkOnly'
    },
    {
      urlPattern: /\/manifest.json/,
      handler: 'networkFirst',
      options: {
        cache: {
          maxEntries: 1,
          name: 'manifest-cache'
        }
      }
    }
  ]
};
