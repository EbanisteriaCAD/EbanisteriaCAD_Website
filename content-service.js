import { assertSafeWrite } from './src/utils/envGuard.js';

var ContentService;

(function () {
  var PLACEHOLDER_PREFIX = 'REPLACE_WITH_';
  var DEFAULT_DESIGNS_COLLECTION = 'designCategories';
  var DEFAULT_PRICING_COLLECTION = 'pricingCards';
  var DEFAULT_RECENT_PROJECTS_COLLECTION = 'recentProjects';
  var DEFAULT_TESTIMONIALS_COLLECTION = 'testimonials';
  var DEFAULT_SITE_SETTINGS_COLLECTION = 'siteSettings';
  var DEFAULT_SITE_SETTINGS_DOC = 'public';
  var DEFAULT_GALLERY_FOLDER = 'design-gallery';
  var DEFAULT_PRICING_EDITOR_FOLDER = 'pricing-richtext';
  var DEFAULT_RECENT_PROJECTS_FOLDER = 'recent-projects';
  var DEFAULT_TESTIMONIALS_FOLDER = 'testimonials';

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

  function getDesignsCollectionName() {
    return getConfig().designsCollection || DEFAULT_DESIGNS_COLLECTION;
  }

  function getPricingCollectionName() {
    return getConfig().pricingCollection || DEFAULT_PRICING_COLLECTION;
  }

  function getRecentProjectsCollectionName() {
    return getConfig().recentProjectsCollection || DEFAULT_RECENT_PROJECTS_COLLECTION;
  }

  function getTestimonialsCollectionName() {
    return getConfig().testimonialsCollection || DEFAULT_TESTIMONIALS_COLLECTION;
  }

  function getSiteSettingsCollectionName() {
    return getConfig().siteSettingsCollection || DEFAULT_SITE_SETTINGS_COLLECTION;
  }

  function getSiteSettingsDocId() {
    return getConfig().siteSettingsDocId || DEFAULT_SITE_SETTINGS_DOC;
  }

  function getGalleryFolder() {
    return getConfig().designGalleryFolder || DEFAULT_GALLERY_FOLDER;
  }

  function getPricingEditorFolder() {
    return getConfig().pricingEditorFolder || DEFAULT_PRICING_EDITOR_FOLDER;
  }

  function getRecentProjectsFolder() {
    return getConfig().recentProjectsFolder || DEFAULT_RECENT_PROJECTS_FOLDER;
  }

  function getTestimonialsFolder() {
    return getConfig().testimonialsFolder || DEFAULT_TESTIMONIALS_FOLDER;
  }

  function designsCollection() {
    return init().firestore.collection(getDesignsCollectionName());
  }

  function pricingCollection() {
    return init().firestore.collection(getPricingCollectionName());
  }

  function recentProjectsCollection() {
    return init().firestore.collection(getRecentProjectsCollectionName());
  }

  function testimonialsCollection() {
    return init().firestore.collection(getTestimonialsCollectionName());
  }

  function siteSettingsDoc() {
    return init().firestore.collection(getSiteSettingsCollectionName()).doc(getSiteSettingsDocId());
  }

  function storageRef(path) {
    var firebaseState = init();
    if (!firebaseState.storage) {
      throw new Error('Firebase Storage no esta cargado.');
    }
    return firebaseState.storage.ref(path);
  }

  function toSafeString(value) {
    return String(value || '').trim();
  }

  function slugify(value) {
    return toSafeString(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || ('item-' + Date.now());
  }

  function normalizeFeatures(input) {
    if (Array.isArray(input)) {
      return input.map(toSafeString).filter(Boolean);
    }

    return String(input || '')
      .split(/\r?\n/)
      .map(toSafeString)
      .filter(Boolean);
  }

  function uniqueStrings(values) {
    var seen = Object.create(null);
    return (Array.isArray(values) ? values : [])
      .map(function (value) { return toSafeString(value); })
      .filter(function (value) {
        var key = value.toLowerCase();
        if (!value || seen[key]) return false;
        seen[key] = true;
        return true;
      });
  }

  function normalizeGalleryImages(input) {
    if (!Array.isArray(input)) return [];

    return input.map(function (item, index) {
      var source = item || {};
      return {
        id: toSafeString(source.id) || ('img-' + index + '-' + Date.now()),
        url: toSafeString(source.url),
        path: toSafeString(source.path),
        title: toSafeString(source.title),
        alt: toSafeString(source.alt),
        sortOrder: Number(source.sortOrder || index)
      };
    }).filter(function (item) {
      return !!item.url;
    }).sort(function (a, b) {
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    });
  }

  function normalizeDesignCategory(input) {
    var source = input || {};
    var images = normalizeGalleryImages(source.images);
    return {
      id: toSafeString(source.id) || slugify(source.name || source.slug),
      name: toSafeString(source.name),
      slug: toSafeString(source.slug) || slugify(source.name),
      description: toSafeString(source.description),
      quoteCategory: toSafeString(source.quoteCategory),
      heroLabel: toSafeString(source.heroLabel),
      coverImage: toSafeString(source.coverImage),
      coverImagePath: toSafeString(source.coverImagePath),
      images: images,
      sortOrder: Number(source.sortOrder || 0),
      createdAt: toSafeString(source.createdAt) || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  function normalizePricingCard(input) {
    var source = input || {};
    return {
      id: toSafeString(source.id) || slugify(source.title),
      title: toSafeString(source.title),
      priceLabel: toSafeString(source.priceLabel),
      badge: toSafeString(source.badge),
      description: sanitizePricingDescriptionHtml(source.description),
      features: normalizeFeatures(source.features),
      ctaLabel: toSafeString(source.ctaLabel) || 'Cotizar Plan',
      quoteCategory: toSafeString(source.quoteCategory),
      highlighted: !!source.highlighted,
      sortOrder: Number(source.sortOrder || 0),
      createdAt: toSafeString(source.createdAt) || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  function normalizeRecentProject(input) {
    var source = input || {};
    var images = normalizeGalleryImages(source.images);
    return {
      id: toSafeString(source.id) || slugify(source.title),
      title: toSafeString(source.title),
      description: toSafeString(source.description),
      coverImage: toSafeString(source.coverImage),
      coverImagePath: toSafeString(source.coverImagePath),
      images: images,
      sortOrder: Number(source.sortOrder || 0),
      createdAt: toSafeString(source.createdAt) || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  function normalizeTestimonial(input) {
    var source = input || {};
    return {
      id: toSafeString(source.id) || slugify(source.title || source.location || 'testimonial'),
      title: toSafeString(source.title),
      imageUrl: toSafeString(source.imageUrl),
      imagePath: toSafeString(source.imagePath),
      sortOrder: Number(source.sortOrder || 0),
      createdAt: toSafeString(source.createdAt) || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  function getDefaultSiteSettings() {
    return {
      id: getSiteSettingsDocId(),
      business: {
        name: 'Ebanistería CAD',
        logoUrl: 'assets/logo.jpg',
        footerCopyright: '© 2026 Ebanistería CAD. Todos los derechos reservados.'
      },
      contact: {
        phoneDisplay: '787-431-0110',
        phoneE164: '+17874310110',
        whatsappNumber: '17874310110',
        email: 'ebanisteriacad@gmail.com',
        address: 'BO Quebrada Arenas Hollywood Hill Carr #1 8-A Calle 3 San Juan, PR 00926',
        mapsLink: 'https://maps.app.goo.gl/7vM7WgmYDUv6VzQZ9',
        mapsEmbedQuery: 'BO Quebrada Arenas Hollywood Hill Carr #1 8-A Calle 3 San Juan, PR 00926',
        serviceArea: 'Toda la Isla de Puerto Rico.',
        hoursWeekdays: 'Lunes a Viernes: 7:00 AM - 4:00 PM',
        hoursWeekends: 'Sábado/Domingo: Cerrado'
      },
      social: {
        facebookUrl: 'https://www.facebook.com/share/1CTmx4jsCt/',
        instagramUrl: 'https://www.instagram.com/ebanisteriacad?igsh=MWc3cmtsaDRuOW1vbA==',
        tiktokUrl: 'https://www.tiktok.com/@ebanisteriacad?_r=1&_t=ZT-951KQNxRrW2'
      },
      homepage: {
        showRecentProjects: true,
        showTestimonials: true
      },
      quoteForm: {
        maxImages: 10,
        categories: ['Cocinas', 'Closets', 'Centros TV', 'Baños', 'Comercial', 'Remodelación']
      },
      admin: {
        allowedAdminEmails: uniqueStrings(getConfig().allowedAdminEmails || ['burgosaxel56@gmail.com'])
      },
      operations: {
        maintenanceMode: false,
        maintenanceMessage: 'Estamos realizando mantenimiento. Intenta nuevamente más tarde.',
        notificationsEnabled: false
      }
    };
  }

  function normalizeSiteSettings(input) {
    var source = input || {};
    var defaults = getDefaultSiteSettings();
    var business = source.business || {};
    var contact = source.contact || {};
    var social = source.social || {};
    var homepage = source.homepage || {};
    var quoteForm = source.quoteForm || {};
    var admin = source.admin || {};
    var operations = source.operations || {};

    return {
      id: toSafeString(source.id) || defaults.id,
      business: {
        name: toSafeString(business.name) || defaults.business.name,
        logoUrl: toSafeString(business.logoUrl) || defaults.business.logoUrl,
        footerCopyright: toSafeString(business.footerCopyright) || defaults.business.footerCopyright
      },
      contact: {
        phoneDisplay: toSafeString(contact.phoneDisplay) || defaults.contact.phoneDisplay,
        phoneE164: toSafeString(contact.phoneE164) || defaults.contact.phoneE164,
        whatsappNumber: toSafeString(contact.whatsappNumber) || defaults.contact.whatsappNumber,
        email: toSafeString(contact.email).toLowerCase() || defaults.contact.email,
        address: toSafeString(contact.address) || defaults.contact.address,
        mapsLink: toSafeString(contact.mapsLink) || defaults.contact.mapsLink,
        mapsEmbedQuery: toSafeString(contact.mapsEmbedQuery) || defaults.contact.mapsEmbedQuery,
        serviceArea: toSafeString(contact.serviceArea) || defaults.contact.serviceArea,
        hoursWeekdays: toSafeString(contact.hoursWeekdays) || defaults.contact.hoursWeekdays,
        hoursWeekends: toSafeString(contact.hoursWeekends) || defaults.contact.hoursWeekends
      },
      social: {
        facebookUrl: toSafeString(social.facebookUrl) || defaults.social.facebookUrl,
        instagramUrl: toSafeString(social.instagramUrl) || defaults.social.instagramUrl,
        tiktokUrl: toSafeString(social.tiktokUrl) || defaults.social.tiktokUrl
      },
      homepage: {
        showRecentProjects: homepage.showRecentProjects !== false,
        showTestimonials: homepage.showTestimonials !== false
      },
      quoteForm: {
        maxImages: Math.max(1, Math.min(20, Number(quoteForm.maxImages || defaults.quoteForm.maxImages))),
        categories: uniqueStrings(quoteForm.categories).length ? uniqueStrings(quoteForm.categories) : defaults.quoteForm.categories.slice()
      },
      admin: {
        allowedAdminEmails: uniqueStrings(admin.allowedAdminEmails).length ? uniqueStrings(admin.allowedAdminEmails) : defaults.admin.allowedAdminEmails.slice()
      },
      operations: {
        maintenanceMode: !!operations.maintenanceMode,
        maintenanceMessage: toSafeString(operations.maintenanceMessage) || defaults.operations.maintenanceMessage,
        notificationsEnabled: !!operations.notificationsEnabled
      }
    };
  }

  function designsFromSnapshot(snapshot) {
    return snapshot.docs.map(function (doc) {
      return normalizeDesignCategory(doc.data());
    }).sort(function (a, b) {
      return (a.sortOrder || 0) - (b.sortOrder || 0) || a.name.localeCompare(b.name, 'es');
    });
  }

  function pricingFromSnapshot(snapshot) {
    return snapshot.docs.map(function (doc) {
      return normalizePricingCard(doc.data());
    }).sort(function (a, b) {
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    });
  }

  function recentProjectsFromSnapshot(snapshot) {
    return snapshot.docs.map(function (doc) {
      return normalizeRecentProject(doc.data());
    }).sort(function (a, b) {
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    });
  }

  function testimonialsFromSnapshot(snapshot) {
    return snapshot.docs.map(function (doc) {
      return normalizeTestimonial(doc.data());
    }).sort(function (a, b) {
      var byDate = String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
      if (byDate !== 0) {
        return byDate;
      }
      return (b.sortOrder || 0) - (a.sortOrder || 0);
    });
  }

  function safeFileName(value, fallback) {
    return toSafeString(value || fallback)
      .replace(/[^\w.\-]+/g, '-')
      .toLowerCase();
  }

  async function deleteStoragePaths(paths) {
    var unique = [];
    (Array.isArray(paths) ? paths : []).forEach(function (path) {
      var next = toSafeString(path);
      if (next && unique.indexOf(next) === -1) {
        unique.push(next);
      }
    });

    for (var i = 0; i < unique.length; i += 1) {
      await storageRef(unique[i]).delete();
    }
  }

  function sanitizeUrl(url) {
    var safe = toSafeString(url);
    if (!safe) return '';
    if (/^(https?:|mailto:|tel:)/i.test(safe)) return safe;
    return '';
  }

  function sanitizeImageUrl(url) {
    var safe = toSafeString(url);
    if (!safe) return '';
    if (/^https?:/i.test(safe)) return safe;
    return '';
  }

  function sanitizePricingDescriptionHtml(html) {
    var source = typeof html === 'string' ? html : '';
    if (!source.trim()) return '';
    if (typeof DOMParser === 'undefined') return source;

    var parser = new DOMParser();
    var doc = parser.parseFromString('<div>' + source + '</div>', 'text/html');
    var root = doc.body.firstElementChild;
    if (!root) return '';

    function sanitizeNode(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        return doc.createTextNode(node.textContent || '');
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return null;
      }

      var tag = node.tagName.toLowerCase();
      var containerTags = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'a', 'img', 'h3', 'h4', 'blockquote'];
      var blockTextTags = ['div'];

      if (blockTextTags.indexOf(tag) >= 0) {
        var paragraph = doc.createElement('p');
        Array.prototype.forEach.call(node.childNodes, function (child) {
          var cleanChild = sanitizeNode(child);
          if (cleanChild) paragraph.appendChild(cleanChild);
        });
        return paragraph;
      }

      if (containerTags.indexOf(tag) === -1) {
        var fragment = doc.createDocumentFragment();
        Array.prototype.forEach.call(node.childNodes, function (child) {
          var cleanChild = sanitizeNode(child);
          if (cleanChild) fragment.appendChild(cleanChild);
        });
        return fragment;
      }

      if (tag === 'br') {
        return doc.createElement('br');
      }

      var clean = doc.createElement(tag);

      if (tag === 'a') {
        var href = sanitizeUrl(node.getAttribute('href'));
        if (!href) {
          var unwrap = doc.createDocumentFragment();
          Array.prototype.forEach.call(node.childNodes, function (child) {
            var cleanChild = sanitizeNode(child);
            if (cleanChild) unwrap.appendChild(cleanChild);
          });
          return unwrap;
        }
        clean.setAttribute('href', href);
        clean.setAttribute('target', '_blank');
        clean.setAttribute('rel', 'noopener noreferrer');
      }

      if (tag === 'img') {
        var src = sanitizeImageUrl(node.getAttribute('src'));
        if (!src) return null;
        clean.setAttribute('src', src);
        clean.setAttribute('alt', toSafeString(node.getAttribute('alt')));
        var path = toSafeString(node.getAttribute('data-storage-path'));
        if (path) clean.setAttribute('data-storage-path', path);
        return clean;
      }

      Array.prototype.forEach.call(node.childNodes, function (child) {
        var cleanChild = sanitizeNode(child);
        if (cleanChild) clean.appendChild(cleanChild);
      });

      return clean;
    }

    var output = doc.createElement('div');
    Array.prototype.forEach.call(root.childNodes, function (child) {
      var cleanChild = sanitizeNode(child);
      if (cleanChild) output.appendChild(cleanChild);
    });

    return output.innerHTML.trim();
  }

  function extractPricingDescriptionAssetPaths(html) {
    var safeHtml = sanitizePricingDescriptionHtml(html);
    if (!safeHtml || typeof DOMParser === 'undefined') return [];

    var parser = new DOMParser();
    var doc = parser.parseFromString('<div>' + safeHtml + '</div>', 'text/html');
    return Array.prototype.map.call(doc.querySelectorAll('img[data-storage-path]'), function (img) {
      return toSafeString(img.getAttribute('data-storage-path'));
    }).filter(Boolean);
  }

  async function uploadPricingDescriptionImage(cardId, file) {
    if (!file) {
      throw new Error('No se encontro la imagen para subir.');
    }

    var firebaseState = init();
    if (!firebaseState.storage) {
      throw new Error('Firebase Storage no esta cargado.');
    }

    var safeName = safeFileName(file.name, 'descripcion');
    var path = getPricingEditorFolder() + '/' + slugify(cardId || 'pricing-card') + '/' + Date.now() + '-' + safeName;
    var ref = firebaseState.storage.ref(path);

    await ref.put(file);
    return {
      url: await ref.getDownloadURL(),
      path: path
    };
  }

  async function uploadGalleryFiles(categorySlug, files) {
    if (!files || !files.length) return [];

    var firebaseState = init();
    if (!firebaseState.storage) {
      throw new Error('Firebase Storage no esta cargado.');
    }

    var uploads = Array.prototype.map.call(files, function (file, index) {
      var safeName = safeFileName(file && file.name, 'imagen-' + index);
      var path = getGalleryFolder() + '/' + categorySlug + '/' + Date.now() + '-' + index + '-' + safeName;
      var ref = firebaseState.storage.ref(path);

      return ref.put(file).then(function () {
        return ref.getDownloadURL().then(function (url) {
          return {
            id: slugify(categorySlug + '-' + safeName + '-' + index),
            url: url,
            path: path,
            title: '',
            alt: '',
            sortOrder: index
          };
        });
      });
    });

    return Promise.all(uploads);
  }

  async function uploadRecentProjectFiles(projectId, files) {
    if (!files || !files.length) return [];

    var firebaseState = init();
    if (!firebaseState.storage) {
      throw new Error('Firebase Storage no esta cargado.');
    }

    var uploads = Array.prototype.map.call(files, function (file, index) {
      var safeName = safeFileName(file && file.name, 'proyecto-' + index);
      var path = getRecentProjectsFolder() + '/' + projectId + '/' + Date.now() + '-' + index + '-' + safeName;
      var ref = firebaseState.storage.ref(path);

      return ref.put(file).then(function () {
        return ref.getDownloadURL().then(function (url) {
          return {
            id: slugify(projectId + '-' + safeName + '-' + index),
            url: url,
            path: path,
            title: '',
            alt: '',
            sortOrder: index
          };
        });
      });
    });

    return Promise.all(uploads);
  }

  async function uploadTestimonialImage(testimonialId, file) {
    if (!file) {
      throw new Error('No se encontro la imagen del testimonio.');
    }

    var firebaseState = init();
    if (!firebaseState.storage) {
      throw new Error('Firebase Storage no esta cargado.');
    }

    var safeName = safeFileName(file && file.name, 'testimonio');
    var path = getTestimonialsFolder() + '/' + testimonialId + '/' + Date.now() + '-' + safeName;
    var ref = firebaseState.storage.ref(path);

    await ref.put(file);
    return {
      url: await ref.getDownloadURL(),
      path: path
    };
  }

  async function getDesignCategories() {
    var snapshot = await designsCollection().get();
    return designsFromSnapshot(snapshot);
  }

  async function getPricingCards() {
    var snapshot = await pricingCollection().get();
    return pricingFromSnapshot(snapshot);
  }

  async function getRecentProjects() {
    var snapshot = await recentProjectsCollection().get();
    return recentProjectsFromSnapshot(snapshot);
  }

  async function getTestimonials() {
    var snapshot = await testimonialsCollection().get();
    return testimonialsFromSnapshot(snapshot);
  }

  async function getSiteSettings() {
    var snapshot = await siteSettingsDoc().get();
    return normalizeSiteSettings(snapshot.exists ? snapshot.data() : {});
  }

  async function saveDesignCategory(category, files, coverIndex) {
    assertSafeWrite();

    var base = normalizeDesignCategory(category);
    var existingDoc = await designsCollection().doc(base.id).get();
    var uploadedImages = await uploadGalleryFiles(base.slug, files || []);
    var mergedImages = (base.images || []).concat(uploadedImages);
    var allImages = normalizeGalleryImages(mergedImages.map(function (image, index) {
      return Object.assign({}, image, { sortOrder: index });
    }));
    var selectedCoverIndex = typeof coverIndex === 'number' ? coverIndex : 0;
    var coverImage = allImages[selectedCoverIndex] || allImages[0] || null;

    var next = normalizeDesignCategory({
      id: base.id,
      slug: base.slug,
      name: base.name,
      description: base.description,
      quoteCategory: base.quoteCategory,
      heroLabel: base.heroLabel,
      images: allImages,
      coverImage: coverImage ? coverImage.url : '',
      coverImagePath: coverImage ? coverImage.path : '',
      sortOrder: existingDoc.exists ? normalizeDesignCategory(existingDoc.data()).sortOrder : (await getDesignCategories()).length,
      createdAt: existingDoc.exists ? normalizeDesignCategory(existingDoc.data()).createdAt : base.createdAt
    });

    await designsCollection().doc(next.id).set(next);
    return next;
  }

  async function updateDesignCategoryImages(id, images, coverIndex) {
    assertSafeWrite();

    var current = await designsCollection().doc(id).get();
    if (!current.exists) {
      throw new Error('La categoria no existe.');
    }

    var base = normalizeDesignCategory(current.data());
    var nextImages = normalizeGalleryImages((images || []).map(function (image, index) {
      return Object.assign({}, image, { sortOrder: index });
    }));
    var removedPaths = (base.images || [])
      .map(function (image) { return image.path; })
      .filter(function (path) {
        return !!path && !nextImages.some(function (image) { return image.path === path; });
      });
    var selectedCoverIndex = typeof coverIndex === 'number' ? coverIndex : 0;
    var coverImage = nextImages[selectedCoverIndex] || nextImages[0] || null;

    var next = normalizeDesignCategory({
      id: base.id,
      slug: base.slug,
      name: base.name,
      description: base.description,
      quoteCategory: base.quoteCategory,
      heroLabel: base.heroLabel,
      images: nextImages,
      coverImage: coverImage ? coverImage.url : '',
      coverImagePath: coverImage ? coverImage.path : '',
      sortOrder: base.sortOrder,
      createdAt: base.createdAt
    });

    await deleteStoragePaths(removedPaths);
    await designsCollection().doc(id).set(next);
    return next;
  }

  async function updateDesignCategoryOrder(categories) {
    assertSafeWrite();

    var batch = init().firestore.batch();
    (Array.isArray(categories) ? categories : []).forEach(function (category, index) {
      var docRef = designsCollection().doc(category.id);
      batch.update(docRef, {
        sortOrder: index,
        updatedAt: new Date().toISOString()
      });
    });
    await batch.commit();
  }

  async function deleteDesignCategory(id) {
    assertSafeWrite();

    var current = await designsCollection().doc(id).get();
    if (!current.exists) return;

    var item = normalizeDesignCategory(current.data());
    await deleteStoragePaths((item.images || []).map(function (image) { return image.path; }));
    await designsCollection().doc(id).delete();
  }

  async function saveRecentProject(project, files, coverIndex) {
    assertSafeWrite();

    var base = normalizeRecentProject(project);
    var current = await recentProjectsCollection().doc(base.id).get();
    var existingItems = await getRecentProjects();
    if (!current.exists && existingItems.length >= 3) {
      throw new Error('Solo se permiten 3 proyectos recientes.');
    }

    var uploadedImages = await uploadRecentProjectFiles(base.id, files || []);
    var mergedImages = (base.images || []).concat(uploadedImages);
    var allImages = normalizeGalleryImages(mergedImages.map(function (image, index) {
      return Object.assign({}, image, { sortOrder: index });
    }));
    var selectedCoverIndex = typeof coverIndex === 'number' ? coverIndex : 0;
    var coverImage = allImages[selectedCoverIndex] || allImages[0] || null;

    var next = normalizeRecentProject({
      id: base.id,
      title: base.title,
      description: base.description,
      images: allImages,
      coverImage: coverImage ? coverImage.url : '',
      coverImagePath: coverImage ? coverImage.path : '',
      sortOrder: current.exists ? normalizeRecentProject(current.data()).sortOrder : existingItems.length,
      createdAt: current.exists ? normalizeRecentProject(current.data()).createdAt : base.createdAt
    });

    await recentProjectsCollection().doc(next.id).set(next);
    return next;
  }

  async function updateRecentProjectImages(id, images, coverIndex) {
    assertSafeWrite();

    var current = await recentProjectsCollection().doc(id).get();
    if (!current.exists) {
      throw new Error('El proyecto no existe.');
    }

    var base = normalizeRecentProject(current.data());
    var nextImages = normalizeGalleryImages((images || []).map(function (image, index) {
      return Object.assign({}, image, { sortOrder: index });
    }));
    var removedPaths = (base.images || [])
      .map(function (image) { return image.path; })
      .filter(function (path) {
        return !!path && !nextImages.some(function (image) { return image.path === path; });
      });
    var selectedCoverIndex = typeof coverIndex === 'number' ? coverIndex : 0;
    var coverImage = nextImages[selectedCoverIndex] || nextImages[0] || null;

    var next = normalizeRecentProject({
      id: base.id,
      title: base.title,
      description: base.description,
      images: nextImages,
      coverImage: coverImage ? coverImage.url : '',
      coverImagePath: coverImage ? coverImage.path : '',
      sortOrder: base.sortOrder,
      createdAt: base.createdAt
    });

    await deleteStoragePaths(removedPaths);
    await recentProjectsCollection().doc(id).set(next);
    return next;
  }

  async function deleteRecentProject(id) {
    assertSafeWrite();

    var current = await recentProjectsCollection().doc(id).get();
    if (!current.exists) return;

    var item = normalizeRecentProject(current.data());
    await deleteStoragePaths((item.images || []).map(function (image) { return image.path; }));
    await recentProjectsCollection().doc(id).delete();
  }

  async function saveTestimonial(item, file) {
    assertSafeWrite();

    var base = normalizeTestimonial(item);
    var current = await testimonialsCollection().doc(base.id).get();
    var existingItems = await getTestimonials();

    var uploaded = file ? await uploadTestimonialImage(base.id, file) : null;
    var previous = current.exists ? normalizeTestimonial(current.data()) : null;
    var next = normalizeTestimonial({
      id: base.id,
      title: base.title,
      imageUrl: uploaded ? uploaded.url : (previous ? previous.imageUrl : base.imageUrl),
      imagePath: uploaded ? uploaded.path : (previous ? previous.imagePath : base.imagePath),
      sortOrder: current.exists ? previous.sortOrder : existingItems.length,
      createdAt: current.exists ? previous.createdAt : base.createdAt
    });

    if (uploaded && previous && previous.imagePath && previous.imagePath !== uploaded.path) {
      await deleteStoragePaths([previous.imagePath]);
    }

    await testimonialsCollection().doc(next.id).set(next);
    return next;
  }

  async function deleteTestimonial(id) {
    assertSafeWrite();

    var current = await testimonialsCollection().doc(id).get();
    if (!current.exists) return;

    var item = normalizeTestimonial(current.data());
    await deleteStoragePaths([item.imagePath]);
    await testimonialsCollection().doc(id).delete();
  }

  async function saveSiteSettings(settings) {
    assertSafeWrite();

    var next = normalizeSiteSettings(settings);
    await siteSettingsDoc().set(next);
    return next;
  }

  function subscribeTestimonials(onNext, onError) {
    return testimonialsCollection().onSnapshot(function (snapshot) {
      if (typeof onNext === 'function') {
        onNext(testimonialsFromSnapshot(snapshot));
      }
    }, function (error) {
      if (typeof onError === 'function') {
        onError(error);
      }
    });
  }

  function subscribeRecentProjects(onNext, onError) {
    return recentProjectsCollection().onSnapshot(function (snapshot) {
      if (typeof onNext === 'function') {
        onNext(recentProjectsFromSnapshot(snapshot));
      }
    }, function (error) {
      if (typeof onError === 'function') {
        onError(error);
      }
    });
  }

  function subscribeSiteSettings(onNext, onError) {
    return siteSettingsDoc().onSnapshot(function (snapshot) {
      if (typeof onNext === 'function') {
        onNext(normalizeSiteSettings(snapshot.exists ? snapshot.data() : {}));
      }
    }, function (error) {
      if (typeof onError === 'function') {
        onError(error);
      }
    });
  }

  async function savePricingCard(card) {
    assertSafeWrite();

    var base = normalizePricingCard(card);
    var current = await pricingCollection().doc(base.id).get();
    var previous = current.exists ? normalizePricingCard(current.data()) : null;
    var next = normalizePricingCard(Object.assign({}, base, {
      sortOrder: current.exists
        ? normalizePricingCard(current.data()).sortOrder
        : (await getPricingCards()).length,
      createdAt: current.exists
        ? normalizePricingCard(current.data()).createdAt
        : base.createdAt
    }));
    var removedDescriptionAssets = (previous ? extractPricingDescriptionAssetPaths(previous.description) : [])
      .filter(function (path) {
        return extractPricingDescriptionAssetPaths(next.description).indexOf(path) === -1;
      });

    if (removedDescriptionAssets.length) {
      await deleteStoragePaths(removedDescriptionAssets);
    }

    await pricingCollection().doc(next.id).set(next);
    return next;
  }

  async function updatePricingCardOrder(cards) {
    assertSafeWrite();

    var batch = init().firestore.batch();
    (Array.isArray(cards) ? cards : []).forEach(function (card, index) {
      var docRef = pricingCollection().doc(card.id);
      batch.update(docRef, {
        sortOrder: index,
        updatedAt: new Date().toISOString()
      });
    });
    await batch.commit();
  }

  async function deletePricingCard(id) {
    assertSafeWrite();

    var current = await pricingCollection().doc(id).get();
    if (!current.exists) return;

    var item = normalizePricingCard(current.data());
    await deleteStoragePaths(extractPricingDescriptionAssetPaths(item.description));
    await pricingCollection().doc(id).delete();
  }

  function subscribeDesignCategories(onNext, onError) {
    return designsCollection().onSnapshot(function (snapshot) {
      if (typeof onNext === 'function') {
        onNext(designsFromSnapshot(snapshot));
      }
    }, function (error) {
      if (typeof onError === 'function') {
        onError(error);
      }
    });
  }

  function subscribePricingCards(onNext, onError) {
    return pricingCollection().onSnapshot(function (snapshot) {
      if (typeof onNext === 'function') {
        onNext(pricingFromSnapshot(snapshot));
      }
    }, function (error) {
      if (typeof onError === 'function') {
        onError(error);
      }
    });
  }

  ContentService = {
    init: init,
    getDesignCategories: getDesignCategories,
    getPricingCards: getPricingCards,
    getRecentProjects: getRecentProjects,
    getTestimonials: getTestimonials,
    getSiteSettings: getSiteSettings,
    saveDesignCategory: saveDesignCategory,
    updateDesignCategoryImages: updateDesignCategoryImages,
    updateDesignCategoryOrder: updateDesignCategoryOrder,
    deleteDesignCategory: deleteDesignCategory,
    savePricingCard: savePricingCard,
    saveRecentProject: saveRecentProject,
    updateRecentProjectImages: updateRecentProjectImages,
    saveTestimonial: saveTestimonial,
    saveSiteSettings: saveSiteSettings,
    uploadPricingDescriptionImage: uploadPricingDescriptionImage,
    updatePricingCardOrder: updatePricingCardOrder,
    deletePricingCard: deletePricingCard,
    deleteRecentProject: deleteRecentProject,
    deleteTestimonial: deleteTestimonial,
    subscribeDesignCategories: subscribeDesignCategories,
    subscribePricingCards: subscribePricingCards,
    subscribeRecentProjects: subscribeRecentProjects,
    subscribeTestimonials: subscribeTestimonials,
    subscribeSiteSettings: subscribeSiteSettings,
    normalizeFeatures: normalizeFeatures,
    normalizeSiteSettings: normalizeSiteSettings,
    sanitizePricingDescriptionHtml: sanitizePricingDescriptionHtml,
    slugify: slugify
  };

  window.ContentService = ContentService;
})();

export { ContentService };
