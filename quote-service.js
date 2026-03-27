(function () {
  var PLACEHOLDER_PREFIX = 'REPLACE_WITH_';
  var DEFAULT_QUOTES_COLLECTION = 'quoteRequests';
  var DEFAULT_MAIL_COLLECTION = 'mail';
  var DEFAULT_ATTACHMENTS_FOLDER = 'quote-attachments';

  var state = {
    initialized: false,
    firebaseApp: null,
    firestore: null,
    storage: null
  };

  function getConfig() {
    return window.FirebaseConfig || {};
  }

  function isFilled(value) {
    return typeof value === 'string' && value.trim() && value.indexOf(PLACEHOLDER_PREFIX) !== 0;
  }

  function getFirebaseCoreConfig(config) {
    return {
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      storageBucket: config.storageBucket,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId,
      measurementId: config.measurementId || ''
    };
  }

  function getQuotesCollectionName() {
    var config = getConfig();
    return config.quotesCollection || DEFAULT_QUOTES_COLLECTION;
  }

  function getMailCollectionName() {
    var config = getConfig();
    return config.mailCollection || DEFAULT_MAIL_COLLECTION;
  }

  function getAttachmentsFolder() {
    var config = getConfig();
    return config.quoteAttachmentsFolder || DEFAULT_ATTACHMENTS_FOLDER;
  }

  function shouldQueueReceiptEmails() {
    return !!getConfig().enableReceiptEmails;
  }

  function ensureFirebaseSdk() {
    if (!window.firebase || typeof window.firebase.initializeApp !== 'function') {
      throw new Error('Firebase App SDK no esta cargado.');
    }

    if (!window.firebase.firestore) {
      throw new Error('Firebase Firestore SDK no esta cargado.');
    }
  }

  function ensureConfig() {
    var config = getConfig();
    var required = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
    var missing = required.filter(function (key) {
      return !isFilled(config[key]);
    });

    if (missing.length) {
      throw new Error('Faltan credenciales de Firebase: ' + missing.join(', ') + '.');
    }

    return config;
  }

  function init() {
    if (state.initialized && state.firestore) {
      return state;
    }

    ensureFirebaseSdk();
    var config = ensureConfig();
    var coreConfig = getFirebaseCoreConfig(config);

    state.firebaseApp = window.firebase.apps.length
      ? window.firebase.app()
      : window.firebase.initializeApp(coreConfig);
    state.firestore = window.firebase.firestore();
    state.storage = window.firebase.storage ? window.firebase.storage() : null;
    state.initialized = true;
    return state;
  }

  function notifyQuotesUpdated(quotes) {
    document.dispatchEvent(new CustomEvent('quotesUpdated', {
      detail: { quotes: Array.isArray(quotes) ? quotes.slice() : [] }
    }));
  }

  function generateId() {
    return 'REQ-' + Date.now().toString(36).toUpperCase();
  }

  function toSafeString(value) {
    return String(value || '').trim();
  }

  function normalizeAttachments(input) {
    if (!Array.isArray(input)) return [];

    return input
      .map(function (item) {
        if (typeof item === 'string') {
          return item.trim();
        }

        return item && typeof item.url === 'string' ? item.url.trim() : '';
      })
      .filter(Boolean);
  }

  function buildFullAddress(source) {
    var addressLine = toSafeString(source.addressLine || source.address);
    var city = toSafeString(source.city);
    var stateRegion = toSafeString(source.stateRegion || source.state);
    var postalCode = toSafeString(source.postalCode);

    return [addressLine, city, stateRegion, postalCode].filter(Boolean).join(', ');
  }

  function normalizeQuote(input) {
    var source = input || {};
    return {
      id: toSafeString(source.id) || generateId(),
      name: toSafeString(source.name),
      phone: toSafeString(source.phone),
      addressLine: toSafeString(source.addressLine || source.address),
      city: toSafeString(source.city),
      stateRegion: toSafeString(source.stateRegion || source.state),
      postalCode: toSafeString(source.postalCode),
      address: buildFullAddress(source),
      email: toSafeString(source.email).toLowerCase(),
      category: toSafeString(source.category),
      message: toSafeString(source.message),
      status: toSafeString(source.status) || 'new',
      createdAt: toSafeString(source.createdAt) || new Date().toISOString(),
      measures: toSafeString(source.measures),
      material: toSafeString(source.material),
      budget: toSafeString(source.budget),
      source: toSafeString(source.source) || 'website',
      attachments: normalizeAttachments(source.attachments)
    };
  }

  function compareQuotesDesc(a, b) {
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
  }

  function collectionRef() {
    return init().firestore.collection(getQuotesCollectionName());
  }

  function mailCollectionRef() {
    return init().firestore.collection(getMailCollectionName());
  }

  function quoteFromDoc(doc) {
    return normalizeQuote(doc.data() || {});
  }

  function buildReceiptMailDoc(quote) {
    if (!quote.email) {
      return null;
    }

    var customerName = quote.name || 'cliente';
    var subject = 'Recibimos tu solicitud de cotizacion';
    var text =
      'Hola ' + customerName + ',\n\n' +
      'Recibimos tu solicitud de cotizacion para ' + (quote.category || 'tu proyecto') + '.\n' +
      'Numero de referencia: ' + quote.id + '.\n\n' +
      'Te contactaremos pronto para continuar.\n\n' +
      'Ebanisteria CAD';

    var html =
      '<p>Hola ' + customerName + ',</p>' +
      '<p>Recibimos tu solicitud de cotizacion para <strong>' + (quote.category || 'tu proyecto') + '</strong>.</p>' +
      '<p><strong>Numero de referencia:</strong> ' + quote.id + '</p>' +
      '<p>Te contactaremos pronto para continuar.</p>' +
      '<p>Ebanisteria CAD</p>';

    return {
      to: [quote.email],
      message: {
        subject: subject,
        text: text,
        html: html
      },
      quoteId: quote.id,
      createdAt: new Date().toISOString(),
      type: 'quote_receipt'
    };
  }

  async function uploadAttachments(quoteId, files) {
    if (!files || !files.length) {
      return [];
    }

    var firebaseState = init();
    if (!firebaseState.storage) {
      throw new Error('Firebase Storage no esta cargado.');
    }

    var uploads = Array.prototype.map.call(files, function (file, index) {
      var safeName = String(file && file.name || ('imagen-' + index))
        .replace(/[^\w.\-]+/g, '-')
        .toLowerCase();
      var path = getAttachmentsFolder() + '/' + quoteId + '/' + Date.now() + '-' + index + '-' + safeName;
      var ref = firebaseState.storage.ref(path);

      return ref.put(file).then(function () {
        return ref.getDownloadURL();
      });
    });

    return Promise.all(uploads);
  }

  async function getQuotes() {
    var snapshot = await collectionRef().orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(quoteFromDoc).sort(compareQuotesDesc);
  }

  async function saveQuote(quote, files) {
    var normalized = normalizeQuote(quote);
    var attachments = await uploadAttachments(normalized.id, files || []);
    normalized.attachments = attachments;

    var batch = init().firestore.batch();
    var quoteDocRef = collectionRef().doc(normalized.id);
    var receiptMail = shouldQueueReceiptEmails() ? buildReceiptMailDoc(normalized) : null;

    batch.set(quoteDocRef, normalized);

    if (receiptMail) {
      batch.set(mailCollectionRef().doc(), receiptMail);
    }

    await batch.commit();
    notifyQuotesUpdated([normalized]);
    return normalized;
  }

  async function updateQuoteStatus(id, status) {
    if (!id) return false;

    await collectionRef().doc(id).update({
      status: toSafeString(status) || 'new',
      updatedAt: new Date().toISOString()
    });

    return true;
  }

  async function deleteQuote(id) {
    if (!id) return false;
    await collectionRef().doc(id).delete();
    return true;
  }

  async function seedQuotes(quotes) {
    var items = Array.isArray(quotes) ? quotes.map(normalizeQuote) : [];
    if (!items.length) return [];

    var batch = init().firestore.batch();
    items.forEach(function (quote) {
      batch.set(collectionRef().doc(quote.id), quote);
    });
    await batch.commit();
    return items;
  }

  function subscribeQuotes(onNext, onError) {
    return collectionRef()
      .orderBy('createdAt', 'desc')
      .onSnapshot(function (snapshot) {
        var quotes = snapshot.docs.map(quoteFromDoc).sort(compareQuotesDesc);
        notifyQuotesUpdated(quotes);
        if (typeof onNext === 'function') {
          onNext(quotes);
        }
      }, function (error) {
        if (typeof onError === 'function') {
          onError(error);
        }
      });
  }

  window.QuoteService = {
    init: init,
    getQuotes: getQuotes,
    saveQuote: saveQuote,
    updateQuoteStatus: updateQuoteStatus,
    deleteQuote: deleteQuote,
    seedQuotes: seedQuotes,
    subscribeQuotes: subscribeQuotes
  };
})();
