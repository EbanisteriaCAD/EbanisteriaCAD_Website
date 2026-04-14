import { ENV } from './src/utils/envGuard.js';

(function () {
  var PLACEHOLDER_PREFIX = 'REPLACE_WITH_';

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

  var firebaseCoreConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || ''
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
