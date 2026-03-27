(function () {
  var PLACEHOLDER_PREFIX = 'REPLACE_WITH_';
  var REQUIRED_KEYS = [
    'apiKey',
    'authDomain',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId'
  ];

  var state = {
    initialized: false,
    ready: false,
    app: null,
    auth: null,
    firestore: null,
    provider: null,
    issues: [],
    allowedAdminEmails: [],
    accessDeniedMessage: '',
    remoteConfigPromise: null
  };

  function getConfig() {
    return window.FirebaseConfig || window.firebaseConfig || {};
  }

  function isFilled(value) {
    return typeof value === 'string' && value.trim() && value.indexOf(PLACEHOLDER_PREFIX) !== 0;
  }

  function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
  }

  function getAllowedAdminEmails(config) {
    if (!Array.isArray(config.allowedAdminEmails)) {
      return [];
    }

    return config.allowedAdminEmails
      .map(normalizeEmail)
      .filter(function (email) {
        return !!email && email.indexOf(PLACEHOLDER_PREFIX.toLowerCase()) !== 0;
      });
  }

  function getSiteSettingsRef() {
    if (!state.firestore) return null;
    var config = getConfig();
    var collection = config.siteSettingsCollection || 'siteSettings';
    var docId = config.siteSettingsDocId || 'public';
    return state.firestore.collection(collection).doc(docId);
  }

  function loadRemoteAllowedAdminEmails() {
    var ref = getSiteSettingsRef();
    if (!ref) {
      return Promise.resolve(state.allowedAdminEmails.slice());
    }

    return ref.get().then(function (snapshot) {
      if (!snapshot.exists) {
        return state.allowedAdminEmails.slice();
      }

      var data = snapshot.data() || {};
      var admin = data.admin || {};
      var remote = Array.isArray(admin.allowedAdminEmails)
        ? admin.allowedAdminEmails.map(normalizeEmail).filter(Boolean)
        : [];

      if (remote.length) {
        state.allowedAdminEmails = remote;
      }

      return state.allowedAdminEmails.slice();
    }).catch(function () {
      return state.allowedAdminEmails.slice();
    });
  }

  function getMissingKeys(config) {
    return REQUIRED_KEYS.filter(function (key) {
      return !isFilled(config[key]);
    });
  }

  function hasFirebaseSdk() {
    return !!(window.firebase && typeof window.firebase.initializeApp === 'function' && window.firebase.auth);
  }

  function init() {
    if (state.initialized) {
      return state;
    }

    var config = getConfig();
    var missingKeys = getMissingKeys(config);
    var allowedAdminEmails = getAllowedAdminEmails(config);

    state.initialized = true;
    state.issues = [];
    state.allowedAdminEmails = allowedAdminEmails;
    state.accessDeniedMessage = '';

    if (!hasFirebaseSdk()) {
      state.issues.push('El SDK de Firebase no se cargo.');
      return state;
    }

    if (missingKeys.length) {
      state.issues.push('Faltan credenciales de Firebase: ' + missingKeys.join(', ') + '.');
      state.issues.push('Actualiza `firebase-config.js` con los valores reales del proyecto.');
      return state;
    }

    try {
      state.app = window.firebase.apps.length
        ? window.firebase.app()
        : window.firebase.initializeApp(config);
      state.auth = window.firebase.auth();
      state.firestore = window.firebase.firestore ? window.firebase.firestore() : null;
      state.provider = new window.firebase.auth.GoogleAuthProvider();
      state.auth.setPersistence(window.firebase.auth.Auth.Persistence.LOCAL).catch(function () {});
      state.remoteConfigPromise = loadRemoteAllowedAdminEmails().then(function (emails) {
        if (!emails.length && !state.issues.some(function (msg) { return msg.indexOf('allowedAdminEmails') !== -1; })) {
          state.issues.push('Falta configurar allowedAdminEmails en Ajustes o firebase-config.js.');
        }
        return emails;
      });
      state.ready = true;
    } catch (error) {
      state.issues.push(error && error.message ? error.message : 'No se pudo inicializar Firebase Auth.');
    }

    return state;
  }

  function getIssues() {
    return init().issues.slice();
  }

  function getAccessDeniedMessage() {
    init();
    return state.accessDeniedMessage;
  }

  function isAllowedAdmin(user) {
    var email = normalizeEmail(user && user.email);

    if (!email) {
      return false;
    }

    return state.allowedAdminEmails.indexOf(email) !== -1;
  }

  function isReady() {
    return init().ready;
  }

  function onAuthStateChanged(callback) {
    init();

    if (!state.ready || !state.auth) {
      callback(null, state);
      return function () {};
    }

    return state.auth.onAuthStateChanged(function (user) {
      Promise.resolve(state.remoteConfigPromise).catch(function () {}).then(function () {
        if (user && !isAllowedAdmin(user)) {
          state.accessDeniedMessage = 'Tu cuenta de Google no esta autorizada para entrar al panel.';
          state.auth.signOut().catch(function () {});
          callback(null, state);
          return;
        }

        state.accessDeniedMessage = '';
        callback(user, state);
      });
    });
  }

  function signInWithGoogle() {
    init();

    if (!state.ready || !state.auth || !state.provider) {
      return Promise.reject(new Error(state.issues[0] || 'Firebase Auth no esta listo.'));
    }

    return state.auth.signInWithPopup(state.provider);
  }

  function signOut() {
    init();

    if (!state.ready || !state.auth) {
      return Promise.resolve();
    }

    return state.auth.signOut();
  }

  function getCurrentUser() {
    init();
    return state.auth ? state.auth.currentUser : null;
  }

  window.FirebaseAdminAuth = {
    init: init,
    getIssues: getIssues,
    getAccessDeniedMessage: getAccessDeniedMessage,
    isReady: isReady,
    onAuthStateChanged: onAuthStateChanged,
    signInWithGoogle: signInWithGoogle,
    signOut: signOut,
    getCurrentUser: getCurrentUser
  };
})();
