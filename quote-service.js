import { assertSafeWrite } from './src/utils/envGuard.js';

var QuoteService;

(function () {
  var PLACEHOLDER_PREFIX = 'REPLACE_WITH_';
  var DEFAULT_PROJECTS_COLLECTION = 'projects';
  var DEFAULT_LEGACY_QUOTES_COLLECTION = 'quoteRequests';
  var DEFAULT_MAIL_COLLECTION = 'mail';
  var DEFAULT_ATTACHMENTS_FOLDER = 'quote-attachments';
  var DEFAULT_PROJECT_FILES_FOLDER = 'project-files';
  var DEFAULT_ADMIN_AUDIT_COLLECTION = 'adminAuditEvents';

  var state = {
    initialized: false,
    firebaseApp: null,
    firestore: null,
    storage: null,
    latestQuotes: [],
    latestPrimaryProjects: [],
    latestLegacyQuotes: []
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

  function getProjectsCollectionName() {
    var config = getConfig();
    return config.projectsCollection || config.quotesCollection || DEFAULT_PROJECTS_COLLECTION;
  }

  function getLegacyQuotesCollectionName() {
    var config = getConfig();
    return config.legacyQuotesCollection || DEFAULT_LEGACY_QUOTES_COLLECTION;
  }

  function getMailCollectionName() {
    var config = getConfig();
    return config.mailCollection || DEFAULT_MAIL_COLLECTION;
  }

  function getAdminAuditCollectionName() {
    var config = getConfig();
    return config.adminAuditCollection || DEFAULT_ADMIN_AUDIT_COLLECTION;
  }

  function getAttachmentsFolder() {
    var config = getConfig();
    return config.quoteAttachmentsFolder || DEFAULT_ATTACHMENTS_FOLDER;
  }

  function getProjectFilesFolder() {
    var config = getConfig();
    return config.projectFilesFolder || DEFAULT_PROJECT_FILES_FOLDER;
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
    var items = Array.isArray(quotes) ? quotes.slice() : [];
    document.dispatchEvent(new CustomEvent('quotesUpdated', {
      detail: { quotes: items }
    }));
    document.dispatchEvent(new CustomEvent('projectsUpdated', {
      detail: { projects: items, quotes: items }
    }));
  }

  function generateId() {
    return 'REQ-' + Date.now().toString(36).toUpperCase();
  }

  function generateEntityId(prefix) {
    return String(prefix || 'ITEM') + '-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();
  }

  function toSafeString(value) {
    return String(value || '').trim();
  }

  function normalizeDateValue(value, fallback) {
    if (value && typeof value.toDate === 'function') {
      return value.toDate().toISOString();
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString();
    }

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }

    if (typeof fallback === 'string' && fallback) {
      return fallback;
    }

    return new Date().toISOString();
  }

  function nowTimestamp() {
    return init().firestore.constructor.Timestamp.now();
  }

  function normalizeSimpleArray(input) {
    return Array.isArray(input) ? input.slice() : [];
  }

  function getCurrentUserLabel() {
    // TODO: Replace temporary current user resolution with Firebase Auth user metadata everywhere.
    var auth = window.FirebaseAdminAuth;
    var user = auth && typeof auth.getCurrentUser === 'function' ? auth.getCurrentUser() : null;
    return toSafeString(user && (user.displayName || user.email)) || 'Admin';
  }

  function normalizeNote(input) {
    var source = input || {};
    return {
      id: toSafeString(source.id) || generateEntityId('NOTE'),
      text: toSafeString(source.text),
      createdAt: normalizeDateValue(source.createdAt),
      createdBy: toSafeString(source.createdBy) || getCurrentUserLabel()
    };
  }

  function normalizeNotes(input) {
    return normalizeSimpleArray(input)
      .map(normalizeNote)
      .filter(function (item) {
        return !!item.text;
      });
  }

  function normalizeHistoryItem(input) {
    var source = input || {};
    return {
      id: toSafeString(source.id) || generateEntityId('HIST'),
      action: toSafeString(source.action || source.type) || 'update',
      description: toSafeString(source.description || source.text),
      createdAt: normalizeDateValue(source.createdAt),
      createdBy: toSafeString(source.createdBy) || getCurrentUserLabel()
    };
  }

  function normalizeHistory(input) {
    return normalizeSimpleArray(input)
      .map(function (item) {
        if (typeof item === 'string') {
          return normalizeHistoryItem({ description: item });
        }
        return normalizeHistoryItem(item);
      })
      .filter(function (item) {
        return !!item.description;
      });
  }

  function buildHistoryEntry(action, description, createdBy) {
    return normalizeHistoryItem({
      action: action || 'update',
      description: description,
      createdBy: createdBy || getCurrentUserLabel()
    });
  }

  function normalizeAttachmentCategory(value) {
    var normalized = toSafeString(value);
    if (['quote', 'invoice', 'receipt', 'photo', 'other'].indexOf(normalized) >= 0) {
      return normalized;
    }
    return 'other';
  }

  function attachmentNameFromUrl(url) {
    var value = toSafeString(url);
    if (!value) return '';
    var clean = value.split('?')[0];
    var parts = clean.split('/');
    return toSafeString(parts[parts.length - 1]);
  }

  function attachmentIdFromUrl(url) {
    var value = toSafeString(url);
    if (!value) return generateEntityId('ATT');
    return 'ATT-' + value.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 48).toUpperCase();
  }

  function normalizeAttachment(input) {
    if (typeof input === 'string') {
      var url = input.trim();
      return url ? {
        id: attachmentIdFromUrl(url),
        name: attachmentNameFromUrl(url) || 'Archivo',
        type: '',
        category: 'photo',
        url: url,
        createdAt: normalizeDateValue(null),
        createdBy: 'Sistema'
      } : null;
    }

    var source = input || {};
    var normalizedUrl = toSafeString(source.url);
    if (!normalizedUrl) return null;

    return {
      id: toSafeString(source.id) || attachmentIdFromUrl(normalizedUrl),
      name: toSafeString(source.name) || attachmentNameFromUrl(normalizedUrl) || 'Archivo',
      type: toSafeString(source.type),
      category: normalizeAttachmentCategory(source.category),
      url: normalizedUrl,
      createdAt: normalizeDateValue(source.createdAt),
      createdBy: toSafeString(source.createdBy) || getCurrentUserLabel()
    };
  }

  function normalizeAttachments(input) {
    return normalizeSimpleArray(input)
      .map(normalizeAttachment)
      .filter(Boolean);
  }

  function normalizeSource(value) {
    var normalized = toSafeString(value);
    if (normalized === 'website') return 'web_quote';
    if (normalized === 'admin_manual') return 'manual_admin';
    if (normalized === 'manual_admin' || normalized === 'web_quote') return normalized;
    return 'web_quote';
  }

  function normalizeType(value) {
    return toSafeString(value) === 'project' ? 'project' : 'quote';
  }

  function normalizeStatus(value) {
    var normalized = toSafeString(value);
    if (normalized === 'in_progress' || normalized === 'completed' || normalized === 'archived') {
      return normalized;
    }
    return 'new';
  }

  function buildProjectTitle(source) {
    return toSafeString(source.projectTitle || source.title || source.category || source.name);
  }

  function normalizeQuote(input) {
    var source = input || {};
    var createdAt = normalizeDateValue(source.createdAt);
    var updatedAt = normalizeDateValue(source.updatedAt, createdAt);
    var address = toSafeString(source.address || source.addressLine);
    var zipCode = toSafeString(source.zipCode || source.postalCode);

    return {
      id: toSafeString(source.id) || generateId(),
      type: normalizeType(source.type),
      createdAt: createdAt,
      updatedAt: updatedAt,
      name: toSafeString(source.name),
      phone: toSafeString(source.phone),
      email: toSafeString(source.email).toLowerCase(),
      address: address,
      city: toSafeString(source.city),
      zipCode: zipCode,
      addressLine: address,
      stateRegion: toSafeString(source.stateRegion || source.state),
      postalCode: zipCode,
      category: toSafeString(source.category),
      projectTitle: buildProjectTitle(source),
      message: toSafeString(source.message),
      measures: toSafeString(source.measures),
      material: toSafeString(source.material),
      budget: toSafeString(source.budget),
      status: normalizeStatus(source.status),
      notes: normalizeNotes(source.notes),
      attachments: normalizeAttachments(source.attachments),
      history: normalizeHistory(source.history),
      source: normalizeSource(source.source)
    };
  }

  function setLatestQuotes(quotes) {
    state.latestQuotes = Array.isArray(quotes) ? quotes.slice() : [];
    return state.latestQuotes;
  }

  function getMergedLatestQuotes() {
    var byId = {};

    state.latestLegacyQuotes.forEach(function (item) {
      byId[item.id] = normalizeQuote(item);
    });

    state.latestPrimaryProjects.forEach(function (item) {
      byId[item.id] = normalizeQuote(item);
    });

    return Object.keys(byId).map(function (id) {
      return byId[id];
    }).sort(compareQuotesDesc);
  }

  function publishLatestQuotes() {
    var merged = getMergedLatestQuotes();
    notifyQuotesUpdated(merged);
    return merged;
  }

  function normalizeProject(input) {
    var normalized = normalizeQuote(input);
    normalized.type = 'project';
    return normalized;
  }

  function normalizeAuditEvent(input) {
    var source = input || {};
    return {
      id: toSafeString(source.id) || generateEntityId('AUDIT'),
      projectId: toSafeString(source.projectId),
      projectTitle: toSafeString(source.projectTitle),
      clientName: toSafeString(source.clientName),
      type: toSafeString(source.type) || 'update',
      createdAt: normalizeDateValue(source.createdAt),
      createdBy: toSafeString(source.createdBy) || getCurrentUserLabel(),
      status: toSafeString(source.status),
      source: toSafeString(source.source)
    };
  }

  function compareQuotesDesc(a, b) {
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
  }

  function projectsCollectionRef() {
    return init().firestore.collection(getProjectsCollectionName());
  }

  function legacyQuotesCollectionRef() {
    return init().firestore.collection(getLegacyQuotesCollectionName());
  }

  function mailCollectionRef() {
    return init().firestore.collection(getMailCollectionName());
  }

  function adminAuditCollectionRef() {
    return init().firestore.collection(getAdminAuditCollectionName());
  }

  function quoteFromDoc(doc) {
    return normalizeQuote(Object.assign({ id: doc.id }, doc.data() || {}));
  }

  function auditEventFromDoc(doc) {
    return normalizeAuditEvent(doc.data() || {});
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
      createdAt: normalizeDateValue(null),
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

  async function uploadProjectFiles(projectId, files, category) {
    // TODO: Move richer attachment handling to Firebase Storage metadata when full file management is implemented.
    if (!files || !files.length) {
      return [];
    }

    var firebaseState = init();
    if (!firebaseState.storage) {
      throw new Error('Firebase Storage no esta cargado.');
    }

    var now = normalizeDateValue(null);
    var createdBy = getCurrentUserLabel();

    var uploads = Array.prototype.map.call(files, function (file, index) {
      var safeName = String(file && file.name || ('archivo-' + index))
        .replace(/[^\w.\-]+/g, '-')
        .toLowerCase();
      var path = getProjectFilesFolder() + '/' + projectId + '/' + Date.now() + '-' + index + '-' + safeName;
      var ref = firebaseState.storage.ref(path);

      return ref.put(file).then(function () {
        return ref.getDownloadURL();
      }).then(function (url) {
        return normalizeAttachment({
          id: generateEntityId('ATT'),
          name: file && file.name ? file.name : safeName,
          type: file && file.type ? file.type : '',
          category: category || ((file && file.type && file.type.indexOf('image/') === 0) ? 'photo' : 'other'),
          url: url,
          createdAt: now,
          createdBy: createdBy
        });
      });
    });

    return Promise.all(uploads);
  }

  async function getQuotes() {
    var snapshots = await Promise.all([
      projectsCollectionRef().orderBy('createdAt', 'desc').get(),
      getLegacyQuotesCollectionName() !== getProjectsCollectionName()
        ? legacyQuotesCollectionRef().orderBy('createdAt', 'desc').get()
        : Promise.resolve({ docs: [] })
    ]);
    state.latestPrimaryProjects = snapshots[0].docs.map(quoteFromDoc).sort(compareQuotesDesc);
    state.latestLegacyQuotes = snapshots[1].docs.map(quoteFromDoc).sort(compareQuotesDesc);
    setLatestQuotes(getMergedLatestQuotes());
    return getMergedLatestQuotes();
  }

  function toFirestoreDate(value) {
    if (value && typeof value.toDate === 'function') {
      return value;
    }

    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return init().firestore.constructor.Timestamp.fromDate(value);
    }

    if (typeof value === 'string' && value.trim()) {
      var parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return init().firestore.constructor.Timestamp.fromDate(parsed);
      }
    }

    return nowTimestamp();
  }

  function serializeNoteForFirestore(note) {
    var normalized = normalizeNote(note);
    return {
      id: normalized.id,
      text: normalized.text,
      createdAt: toFirestoreDate(note && note.createdAt ? note.createdAt : normalized.createdAt),
      createdBy: normalized.createdBy
    };
  }

  function serializeAttachmentForFirestore(attachment) {
    var normalized = normalizeAttachment(attachment);
    if (!normalized) {
      return null;
    }

    return {
      id: normalized.id,
      name: normalized.name,
      type: normalized.type,
      category: normalized.category,
      url: normalized.url,
      createdAt: toFirestoreDate(attachment && attachment.createdAt ? attachment.createdAt : normalized.createdAt),
      createdBy: normalized.createdBy
    };
  }

  function serializeHistoryEntryForFirestore(entry) {
    var normalized = normalizeHistoryItem(entry);
    return {
      id: normalized.id,
      action: normalized.action,
      description: normalized.description,
      createdAt: toFirestoreDate(entry && entry.createdAt ? entry.createdAt : normalized.createdAt),
      createdBy: normalized.createdBy
    };
  }

  function serializeProjectForFirestore(project, options) {
    var normalized = normalizeQuote(project);
    var settings = options || {};
    var createdAt = settings.createdAt || toFirestoreDate(project && project.createdAt ? project.createdAt : normalized.createdAt);
    var updatedAt = settings.updatedAt || nowTimestamp();

    return {
      id: normalized.id,
      type: normalized.type,
      createdAt: createdAt,
      updatedAt: updatedAt,
      name: normalized.name,
      phone: normalized.phone,
      email: normalized.email,
      address: normalized.address,
      city: normalized.city,
      zipCode: normalized.zipCode,
      addressLine: normalized.addressLine,
      stateRegion: normalized.stateRegion,
      postalCode: normalized.postalCode,
      category: normalized.category,
      projectTitle: normalized.projectTitle,
      message: normalized.message,
      measures: normalized.measures,
      material: normalized.material,
      budget: normalized.budget,
      status: normalized.status,
      notes: normalizeNotes(normalized.notes).map(serializeNoteForFirestore),
      attachments: normalizeAttachments(normalized.attachments).map(serializeAttachmentForFirestore).filter(Boolean),
      history: normalizeHistory(normalized.history).map(serializeHistoryEntryForFirestore),
      source: normalized.source
    };
  }

  async function createProject(project, files) {
    assertSafeWrite();

    var normalized = normalizeQuote(project);
    var uploadedAttachments = await uploadAttachments(normalized.id, files || []);
    if (uploadedAttachments.length) {
      normalized.attachments = normalized.attachments.concat(uploadedAttachments);
    }
    normalized.history = normalizeHistory((normalized.history || []).concat([
      buildHistoryEntry(
        'project_created',
        normalized.type === 'project' ? 'Proyecto creado' : 'Cotizacion creada',
        getCurrentUserLabel()
      )
    ]));
    normalized.source = normalized.source || 'manual_admin';

    var batch = init().firestore.batch();
    var quoteDocRef = projectsCollectionRef().doc(normalized.id);
    var receiptMail = shouldQueueReceiptEmails() ? buildReceiptMailDoc(normalized) : null;

    batch.set(quoteDocRef, serializeProjectForFirestore(normalized));

    if (receiptMail) {
      batch.set(mailCollectionRef().doc(), receiptMail);
    }

    await batch.commit();
    state.latestPrimaryProjects = [normalized].concat(state.latestPrimaryProjects.filter(function (item) { return item.id !== normalized.id; }));
    setLatestQuotes(getMergedLatestQuotes());
    publishLatestQuotes();
    return normalized;
  }

  async function saveQuote(quote, files) {
    return createProject(quote, files);
  }

  function replaceLatestQuote(item) {
    var normalized = normalizeQuote(item);
    state.latestPrimaryProjects = [normalized].concat(state.latestPrimaryProjects.filter(function (current) {
      return current.id !== normalized.id;
    }));
    setLatestQuotes(getMergedLatestQuotes());
    publishLatestQuotes();
    return normalized;
  }

  async function updateQuoteStatus(id, status) {
    if (!id) return false;
    var current = getProjectById(id);
    if (!current) return false;
    var nextStatus = normalizeStatus(status);
    await updateProjectDocument(id, function (record) {
      return {
        status: nextStatus,
        history: normalizeHistory((record.history || []).concat([
          buildHistoryEntry(
            'status_changed',
            nextStatus === 'in_progress'
              ? 'Estado cambiado a En Proceso'
              : nextStatus === 'completed'
                ? 'Estado cambiado a Completado'
                : nextStatus === 'archived'
                  ? 'Estado cambiado a Archivado'
                  : 'Estado cambiado a Nuevo',
            getCurrentUserLabel()
          )
        ]))
      };
    });
    return true;
  }

  async function updateProjectStatus(id, status) {
    return updateQuoteStatus(id, status);
  }

  async function deleteQuote(id) {
    if (!id) return false;
    var current = getProjectById(id);
    assertSafeWrite();
    if (current) {
      var auditId = generateEntityId('AUDIT');
      await adminAuditCollectionRef().doc(auditId).set({
        id: auditId,
        projectId: current.id,
        projectTitle: current.projectTitle || current.category || current.name,
        clientName: current.name || '',
        type: 'project_deleted',
        createdAt: nowTimestamp(),
        createdBy: getCurrentUserLabel(),
        status: current.status || '',
        source: current.source || ''
      });
    }

    var batch = init().firestore.batch();
    batch.delete(projectsCollectionRef().doc(id));
    if (getLegacyQuotesCollectionName() !== getProjectsCollectionName()) {
      batch.delete(legacyQuotesCollectionRef().doc(id));
    }
    await batch.commit();
    return true;
  }

  async function deleteProject(id) {
    return deleteQuote(id);
  }

  async function seedQuotes(quotes) {
    var items = Array.isArray(quotes) ? quotes.map(normalizeQuote) : [];
    if (!items.length) return [];

    assertSafeWrite();
    var batch = init().firestore.batch();
    items.forEach(function (quote) {
      batch.set(projectsCollectionRef().doc(quote.id), serializeProjectForFirestore(quote));
    });
    await batch.commit();
    state.latestPrimaryProjects = items.slice();
    setLatestQuotes(getMergedLatestQuotes());
    publishLatestQuotes();
    return items;
  }

  function getProjectById(projectId) {
    if (!projectId) return null;
    var current = state.latestQuotes.find(function (item) { return item.id === projectId; });
    return current ? normalizeQuote(current) : null;
  }

  async function updateProjectDocument(projectId, buildNext) {
    var current = getProjectById(projectId);
    if (!current) {
      throw new Error('Proyecto no encontrado.');
    }

    var next = buildNext(normalizeQuote(current)) || {};
    var payload = normalizeQuote(Object.assign({}, current, next, {
      id: current.id
    }));

    assertSafeWrite();
    await projectsCollectionRef().doc(projectId).set(serializeProjectForFirestore(payload), { merge: true });
    return replaceLatestQuote(payload);
  }

  function addProjectHistory(projectId, entry) {
    return updateProjectDocument(projectId, function (current) {
      var history = normalizeHistory((current.history || []).concat([entry]));
      return {
        notes: current.notes,
        attachments: current.attachments,
        history: history
      };
    });
  }

  function addProjectNote(projectId, note) {
    return updateProjectDocument(projectId, function (current) {
      var notes = normalizeNotes((current.notes || []).concat([note]));
      var history = normalizeHistory((current.history || []).concat([
        buildHistoryEntry('note_added', 'Se agrego una nota interna', note && note.createdBy)
      ]));
      return {
        notes: notes,
        attachments: current.attachments,
        history: history
      };
    });
  }

  function deleteProjectNote(projectId, noteId) {
    return updateProjectDocument(projectId, function (current) {
      var notes = normalizeNotes(current.notes || []).filter(function (item) {
        return item.id !== noteId;
      });
      var history = normalizeHistory((current.history || []).concat([
        buildHistoryEntry('note_deleted', 'Se elimino una nota interna', getCurrentUserLabel())
      ]));
      return {
        notes: notes,
        attachments: current.attachments,
        history: history
      };
    });
  }

  function addProjectAttachment(projectId, attachment) {
    return updateProjectDocument(projectId, function (current) {
      var nextAttachment = normalizeAttachment(attachment);
      var attachments = normalizeAttachments((current.attachments || []).concat(nextAttachment ? [nextAttachment] : []));
      var history = normalizeHistory((current.history || []).concat([
        buildHistoryEntry(
          'attachment_added',
          'Se agrego un archivo tipo ' + (nextAttachment ? nextAttachment.category : 'other') + ': ' + (nextAttachment ? nextAttachment.name : 'archivo'),
          attachment && attachment.createdBy
        )
      ]));
      return {
        notes: current.notes,
        attachments: attachments,
        history: history
      };
    });
  }

  function deleteProjectAttachment(projectId, attachmentId) {
    return updateProjectDocument(projectId, function (current) {
      var attachment = normalizeAttachments(current.attachments || []).find(function (item) {
        return item.id === attachmentId;
      });
      var attachments = normalizeAttachments(current.attachments || []).filter(function (item) {
        return item.id !== attachmentId;
      });
      var history = normalizeHistory((current.history || []).concat([
        buildHistoryEntry(
          'attachment_deleted',
          'Se elimino un archivo tipo ' + (attachment ? attachment.category : 'other') + ': ' + (attachment ? attachment.name : 'archivo'),
          getCurrentUserLabel()
        )
      ]));
      return {
        notes: current.notes,
        attachments: attachments,
        history: history
      };
    });
  }

  async function addProjectAttachmentFiles(projectId, files, category) {
    var current = getProjectById(projectId);
    if (!current) {
      throw new Error('Proyecto no encontrado.');
    }

    var uploaded = await uploadProjectFiles(projectId, files, category);
    return updateProjectDocument(projectId, function (record) {
      var attachments = normalizeAttachments((record.attachments || []).concat(uploaded));
      var history = normalizeHistory((record.history || []).concat(uploaded.map(function (item) {
        return buildHistoryEntry(
          'attachment_added',
          'Se agrego un archivo tipo ' + item.category + ': ' + item.name,
          item.createdBy
        );
      })));
      return {
        notes: record.notes,
        attachments: attachments,
        history: history
      };
    });
  }

  async function getAdminAuditEvents(limit) {
    var size = Math.max(1, Math.min(100, Number(limit || 25)));
    var snapshot = await adminAuditCollectionRef()
      .orderBy('createdAt', 'desc')
      .limit(size)
      .get();
    return snapshot.docs.map(auditEventFromDoc);
  }

  function subscribeAdminAuditEvents(onNext, onError, limit) {
    var size = Math.max(1, Math.min(100, Number(limit || 25)));
    return adminAuditCollectionRef()
      .orderBy('createdAt', 'desc')
      .limit(size)
      .onSnapshot(function (snapshot) {
        var events = snapshot.docs.map(auditEventFromDoc);
        if (typeof onNext === 'function') {
          onNext(events);
        }
      }, function (error) {
        if (typeof onError === 'function') {
          onError(error);
        }
      });
  }

  function subscribeQuotes(onNext, onError) {
    var primaryUnsubscribe = projectsCollectionRef()
      .orderBy('createdAt', 'desc')
      .onSnapshot(function (snapshot) {
        state.latestPrimaryProjects = snapshot.docs.map(quoteFromDoc).sort(compareQuotesDesc);
        var quotes = publishLatestQuotes();
        if (typeof onNext === 'function') {
          onNext(quotes);
        }
      }, function (error) {
        if (typeof onError === 'function') {
          onError(error);
        }
      });

    if (getLegacyQuotesCollectionName() === getProjectsCollectionName()) {
      return primaryUnsubscribe;
    }

    var legacyUnsubscribe = legacyQuotesCollectionRef()
      .orderBy('createdAt', 'desc')
      .onSnapshot(function (snapshot) {
        state.latestLegacyQuotes = snapshot.docs.map(quoteFromDoc).sort(compareQuotesDesc);
        var quotes = publishLatestQuotes();
        if (typeof onNext === 'function') {
          onNext(quotes);
        }
      }, function (error) {
        if (typeof onError === 'function') {
          onError(error);
        }
      });

    return function () {
      primaryUnsubscribe();
      legacyUnsubscribe();
    };
  }

  function subscribeProjects(onNext, onError) {
    return subscribeQuotes(onNext, onError);
  }

  async function updateProject(projectId, updates) {
    return updateProjectDocument(projectId, function (current) {
      var next = Object.assign({}, current, updates || {});
      var history = normalizeHistory(current.history || []);
      var currentStatus = normalizeStatus(current.status);
      var nextStatus = normalizeStatus(next.status);

      history.push(buildHistoryEntry(
        'project_updated',
        'Se actualizo la informacion del proyecto',
        getCurrentUserLabel()
      ));

      if (currentStatus !== nextStatus) {
        history.push(buildHistoryEntry(
          'status_changed',
          nextStatus === 'in_progress'
            ? 'Estado cambiado a En Proceso'
            : nextStatus === 'completed'
              ? 'Estado cambiado a Completado'
              : nextStatus === 'archived'
                ? 'Estado cambiado a Archivado'
                : 'Estado cambiado a Nuevo',
          getCurrentUserLabel()
        ));
      }

      next.history = history;
      next.notes = current.notes || [];
      next.attachments = current.attachments || [];
      next.source = current.source || next.source || 'manual_admin';
      return next;
    });
  }

  async function getProjects() {
    return getQuotes();
  }

  QuoteService = {
    init: init,
    normalizeQuote: normalizeQuote,
    normalizeProject: normalizeProject,
    normalizeNote: normalizeNote,
    normalizeAttachment: normalizeAttachment,
    getProjects: getProjects,
    getQuotes: getQuotes,
    getProjectById: getProjectById,
    createProject: createProject,
    updateProject: updateProject,
    addProjectHistory: addProjectHistory,
    saveQuote: saveQuote,
    updateProjectStatus: updateProjectStatus,
    updateQuoteStatus: updateQuoteStatus,
    deleteProject: deleteProject,
    deleteQuote: deleteQuote,
    seedQuotes: seedQuotes,
    subscribeProjects: subscribeProjects,
    subscribeQuotes: subscribeQuotes,
    getAdminAuditEvents: getAdminAuditEvents,
    subscribeAdminAuditEvents: subscribeAdminAuditEvents,
    addProjectNote: addProjectNote,
    deleteProjectNote: deleteProjectNote,
    addProjectAttachment: addProjectAttachment,
    addProjectAttachmentFiles: addProjectAttachmentFiles,
    deleteProjectAttachment: deleteProjectAttachment
  };

  window.QuoteService = QuoteService;
})();

export { QuoteService };
