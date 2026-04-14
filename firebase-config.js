import { ENV } from './src/utils/envGuard.js';

(function () {
  var PLACEHOLDER_PREFIX = 'REPLACE_WITH_';
  var viteEnv = (typeof import.meta !== 'undefined' && import.meta && import.meta.env)
    ? import.meta.env
    : {};

  var embeddedEnvironments = {
    development: {
      apiKey: 'AIzaSyAwVljXUklWbroQNYMIKrM6pC0uRQl-VcY',
      authDomain: 'ebanisteriacad-dev.firebaseapp.com',
      projectId: 'ebanisteriacad-dev',
      storageBucket: 'ebanisteriacad-dev.firebasestorage.app',
      messagingSenderId: '769455881533',
      appId: '1:769455881533:web:af03ee7c0af33017a8d954',
      measurementId: ''
    },
    production: {
      apiKey: 'AIzaSyAllmq87MTnMayJLqCCzndJA55LohshsUA',
      authDomain: 'ebanisteriacad-14643.firebaseapp.com',
      projectId: 'ebanisteriacad-14643',
      storageBucket: 'ebanisteriacad-14643.firebasestorage.app',
      messagingSenderId: '52273433150',
      appId: '1:52273433150:web:4031299c7875b954d09f6f',
      measurementId: ''
    }
  };

  var shared = {
    projectsCollection: 'projects',
    legacyQuotesCollection: 'quoteRequests',
    quotesCollection: 'projects',
    designsCollection: 'designCategories',
    pricingCollection: 'pricingCards',
    siteSettingsCollection: 'siteSettings',
    siteSettingsDocId: 'public',
    mailCollection: 'mail',
    adminAuditCollection: 'adminAuditEvents',
    quoteAttachmentsFolder: 'quote-attachments',
    projectFilesFolder: 'project-files',
    designGalleryFolder: 'design-gallery',
    enableReceiptEmails: false,
    allowedAdminEmails: [
      'burgosaxel56@gmail.com',
      'ebanisteriacad@gmail.com'
    ]
  };

  var fallbackCoreConfig = embeddedEnvironments[ENV === 'production' ? 'production' : 'development'];
  var firebaseCoreConfig = {
    apiKey: viteEnv.VITE_FIREBASE_API_KEY || fallbackCoreConfig.apiKey,
    authDomain: viteEnv.VITE_FIREBASE_AUTH_DOMAIN || fallbackCoreConfig.authDomain,
    projectId: viteEnv.VITE_FIREBASE_PROJECT_ID || fallbackCoreConfig.projectId,
    storageBucket: viteEnv.VITE_FIREBASE_STORAGE_BUCKET || fallbackCoreConfig.storageBucket,
    messagingSenderId: viteEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || fallbackCoreConfig.messagingSenderId,
    appId: viteEnv.VITE_FIREBASE_APP_ID || fallbackCoreConfig.appId,
    measurementId: viteEnv.VITE_FIREBASE_MEASUREMENT_ID || fallbackCoreConfig.measurementId || ''
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

  var selectedName = ENV === 'production' ? 'production' : 'development';
  var selected = mergeConfig(firebaseCoreConfig);

  selected.environmentName = selectedName;
  selected.isDevelopment = selectedName === 'development';
  selected.isProduction = selectedName === 'production';
  selected.isReady = isFilled(selected.apiKey) && isFilled(selected.projectId) && isFilled(selected.appId);

  window.FirebaseConfigs = {};
  window.FirebaseConfigs[selectedName] = mergeConfig(firebaseCoreConfig);
  window.FirebaseEnvironment = selectedName;
  window.FirebaseConfig = selected;
  console.log('🔥 Firebase Environment:', ENV);
})();
