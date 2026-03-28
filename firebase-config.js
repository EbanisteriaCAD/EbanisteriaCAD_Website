(function () {
  var PLACEHOLDER_PREFIX = 'REPLACE_WITH_';
  var host = String(window.location.hostname || '').toLowerCase();
  var isLocalHost = host === 'localhost' || host === '127.0.0.1' || host === '::1';

  var shared = {
    quotesCollection: 'quoteRequests',
    designsCollection: 'designCategories',
    pricingCollection: 'pricingCards',
    siteSettingsCollection: 'siteSettings',
    siteSettingsDocId: 'public',
    mailCollection: 'mail',
    quoteAttachmentsFolder: 'quote-attachments',
    designGalleryFolder: 'design-gallery',
    enableReceiptEmails: false,
    allowedAdminEmails: [
      'burgosaxel56@gmail.com',
      'ebanisteriacad@gmail.com'
    ]
  };

  var environments = {
    production: {
      apiKey: 'AIzaSyAllmq87MTnMayJLqCCzndJA55LohshsUA',
      authDomain: 'ebanisteriacad-14643.firebaseapp.com',
      projectId: 'ebanisteriacad-14643',
      storageBucket: 'ebanisteriacad-14643.firebasestorage.app',
      messagingSenderId: '52273433150',
      appId: '1:52273433150:web:4031299c7875b954d09f6f',
      measurementId: 'G-2EE5JTG813'
    },
    development: {
      apiKey: 'REPLACE_WITH_DEV_FIREBASE_API_KEY',
      authDomain: 'REPLACE_WITH_DEV_FIREBASE_AUTH_DOMAIN',
      projectId: 'REPLACE_WITH_DEV_FIREBASE_PROJECT_ID',
      storageBucket: 'REPLACE_WITH_DEV_FIREBASE_STORAGE_BUCKET',
      messagingSenderId: 'REPLACE_WITH_DEV_FIREBASE_MESSAGING_SENDER_ID',
      appId: 'REPLACE_WITH_DEV_FIREBASE_APP_ID',
      measurementId: 'REPLACE_WITH_DEV_FIREBASE_MEASUREMENT_ID'
    }
  };

  function isFilled(value) {
    return typeof value === 'string' && value.trim() && value.indexOf(PLACEHOLDER_PREFIX) !== 0;
  }

  function mergeConfig(core) {
    var config = {};
    var key;

    for (key in shared) {
      if (Object.prototype.hasOwnProperty.call(shared, key)) {
        config[key] = shared[key];
      }
    }

    for (key in core) {
      if (Object.prototype.hasOwnProperty.call(core, key)) {
        config[key] = core[key];
      }
    }

    return config;
  }

  var selectedName = isLocalHost ? 'development' : 'production';
  var selected = mergeConfig(environments[selectedName]);

  selected.environmentName = selectedName;
  selected.isDevelopment = selectedName === 'development';
  selected.isReady = isFilled(selected.apiKey) && isFilled(selected.projectId) && isFilled(selected.appId);

  window.FirebaseConfigs = {
    production: mergeConfig(environments.production),
    development: mergeConfig(environments.development)
  };
  window.FirebaseEnvironment = selectedName;
  window.FirebaseConfig = selected;
})();
