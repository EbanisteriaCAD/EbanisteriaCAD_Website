import { mountEnvironmentBanner } from './src/utils/envGuard.js';

(function () {
  var PAGE_PATH = window.location.pathname.split('/').pop() || 'index.html';
  var QuoteService = window.QuoteService;

  var NAV_ITEMS = [
    { href: 'index.html', label: 'Inicio' },
    { href: 'about.html', label: 'Nosotros' },
    { href: 'designs.html', label: 'Diseños' },
    { href: 'pricing.html', label: 'Precios' },
    { href: 'contact.html', label: 'Contáctenos' }
  ];

  function getDefaultSiteSettings() {
    return {
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
      operations: {
        maintenanceMode: false,
        maintenanceMessage: 'Estamos realizando mantenimiento. Intenta nuevamente más tarde.'
      }
    };
  }

  function toSafeString(value) {
    return String(value || '').trim();
  }

  function isFilledFirebaseValue(value) {
    return typeof value === 'string' && value.trim() && value.indexOf('REPLACE_WITH_') !== 0;
  }

  function uniqueStrings(values) {
    var seen = Object.create(null);
    return (Array.isArray(values) ? values : [])
      .map(toSafeString)
      .filter(function (value) {
        var key = value.toLowerCase();
        if (!value || seen[key]) return false;
        seen[key] = true;
        return true;
      });
  }

  function normalizeSiteSettings(input) {
    var source = input || {};
    var defaults = getDefaultSiteSettings();
    var business = source.business || {};
    var contact = source.contact || {};
    var social = source.social || {};
    var homepage = source.homepage || {};
    var quoteForm = source.quoteForm || {};
    var operations = source.operations || {};

    return {
      business: {
        name: toSafeString(business.name) || defaults.business.name,
        logoUrl: toSafeString(business.logoUrl) || defaults.business.logoUrl,
        footerCopyright: toSafeString(business.footerCopyright) || defaults.business.footerCopyright
      },
      contact: {
        phoneDisplay: toSafeString(contact.phoneDisplay) || defaults.contact.phoneDisplay,
        phoneE164: toSafeString(contact.phoneE164) || defaults.contact.phoneE164,
        whatsappNumber: toSafeString(contact.whatsappNumber) || defaults.contact.whatsappNumber,
        email: toSafeString(contact.email) || defaults.contact.email,
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
      operations: {
        maintenanceMode: !!operations.maintenanceMode,
        maintenanceMessage: toSafeString(operations.maintenanceMessage) || defaults.operations.maintenanceMessage
      }
    };
  }

  function getFirebaseConfig() {
    return window.FirebaseConfig || window.firebaseConfig || {};
  }

  function getSettingsDocRef() {
    if (!(window.firebase && typeof window.firebase.initializeApp === 'function' && window.firebase.firestore)) {
      return null;
    }

    var config = getFirebaseConfig();
    if (
      !config ||
      config.isReady === false ||
      !isFilledFirebaseValue(config.apiKey) ||
      !isFilledFirebaseValue(config.projectId) ||
      !isFilledFirebaseValue(config.appId)
    ) {
      return null;
    }

    var app = window.firebase.apps.length
      ? window.firebase.app()
      : window.firebase.initializeApp({
        apiKey: config.apiKey,
        authDomain: config.authDomain,
        projectId: config.projectId,
        storageBucket: config.storageBucket,
        messagingSenderId: config.messagingSenderId,
        appId: config.appId,
        measurementId: config.measurementId || ''
      });

    return app.firestore().collection(config.siteSettingsCollection || 'siteSettings').doc(config.siteSettingsDocId || 'public');
  }

  async function loadSiteSettings() {
    try {
      var ref = getSettingsDocRef();
      if (!ref) {
        return normalizeSiteSettings({});
      }

      var snapshot = await ref.get();
      return normalizeSiteSettings(snapshot.exists ? snapshot.data() : {});
    } catch (error) {
      console.error('Site settings load failed:', error);
      return normalizeSiteSettings({});
    }
  }

  function isActive(href) {
    return PAGE_PATH.toLowerCase() === href.toLowerCase();
  }

  function renderHeader(settings) {
    var header = document.querySelector('.site-topbar');
    if (!header) return;

    var business = settings.business || getDefaultSiteSettings().business;
    var links = NAV_ITEMS.map(function (item) {
      var activeClass = isActive(item.href) ? ' class="active"' : '';
      return '<li><a' + activeClass + ' href="' + item.href + '">' + item.label + '</a></li>';
    }).join('');

    header.innerHTML =
      '<div class="container topbar-inner">' +
      '<a class="brand" href="index.html" aria-label="Inicio ' + business.name + '">' +
      '<span class="brand-logo-wrap">' +
      '<img class="brand-logo" src="' + business.logoUrl + '" alt="Logo de ' + business.name + '" />' +
      '</span>' +
      '</a>' +
      '<button class="nav-toggle" type="button" aria-label="Abrir menú" aria-controls="site-nav" aria-expanded="false">' +
      '<span></span><span></span><span></span>' +
      '</button>' +
      '<nav id="site-nav" class="top-links-nav" aria-label="Principal">' +
      '<ul>' + links + '</ul>' +
      '<a class="btn btn-primary nav-cta" href="quote.html">Solicitar Cotización</a>' +
      '</nav>' +
      '</div>';

    bindMobileMenu();
  }

  function renderFooter(settings) {
    var footer = document.querySelector('.site-footer');
    if (!footer) return;

    var social = settings.social;
    var contact = settings.contact;
    var business = settings.business;

    footer.innerHTML =
      '<div class="container footer-inner">' +
      '<div class="footer-links">' +
      '<a class="footer-link" href="about.html">Nosotros</a>' +
      '<a class="footer-link" href="designs.html">Diseños</a>' +
      '<a class="footer-link" href="pricing.html">Precios</a>' +
      '<a class="footer-link" href="contact.html">Contáctenos</a>' +
      '<a class="footer-link" href="quote.html">Cotizar Ahora</a>' +
      '</div>' +
      '<div class="footer-social">' +
      '<a class="footer-icon" href="' + social.facebookUrl + '" target="_blank" rel="noopener noreferrer" aria-label="Facebook">Facebook</a>' +
      '<a class="footer-icon" href="' + social.instagramUrl + '" target="_blank" rel="noopener noreferrer" aria-label="Instagram">Instagram</a>' +
      '<a class="footer-icon" href="' + social.tiktokUrl + '" target="_blank" rel="noopener noreferrer" aria-label="TikTok">TikTok</a>' +
      '<a class="footer-icon" href="https://wa.me/' + contact.whatsappNumber + '" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">WhatsApp</a>' +
      '</div>' +
      '<p>' + business.footerCopyright + '</p>' +
      '</div>';
  }

  function updateHeaderScrollState() {
    var header = document.querySelector('.site-topbar');
    if (!header) return;

    if (window.scrollY > 10) {
      header.classList.add('is-scrolled');
    } else {
      header.classList.remove('is-scrolled');
    }
  }

  function bindScrollAccent() {
    updateHeaderScrollState();
    window.addEventListener('scroll', updateHeaderScrollState, { passive: true });
  }

  function bindMobileMenu() {
    var toggle = document.querySelector('.nav-toggle');
    var nav = document.querySelector('.top-links-nav');
    if (!toggle || !nav) return;

    toggle.addEventListener('click', function () {
      var expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      nav.classList.toggle('is-open');
    });

    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  function normalizeCategorySlug(value) {
    return String(value || '')
      .toLowerCase()
      .trim()
      .replace(/%c3%b1/g, 'n')
      .replace(/\u00f1/g, 'n')
      .replace(/ñ/g, 'n')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  }

  function getCategoryMap(settings) {
    var map = {};
    (settings.quoteForm.categories || []).forEach(function (category) {
      map[normalizeCategorySlug(category)] = category;
    });

    if (map['centros-tv']) {
      map.centrostv = map['centros-tv'];
    }

    return map;
  }

  function applyCategoryOptions(settings) {
    var categoryField = document.getElementById('category');
    if (!categoryField) return;

    var currentValue = categoryField.value || '';
    var categories = settings.quoteForm.categories || [];
    categoryField.innerHTML = '<option value="">Selecciona una categoría</option>' +
      categories.map(function (category) {
        return '<option value="' + category + '">' + category + '</option>';
      }).join('');

    if (categories.indexOf(currentValue) >= 0) {
      categoryField.value = currentValue;
    }
  }

  function applyCategoryFromQuery(settings) {
    var form = document.getElementById('quoteForm');
    if (!form) return;

    var categoryField = document.getElementById('category');
    if (!categoryField) return;

    var params = new URLSearchParams(window.location.search);
    var cat = params.get('cat');
    if (!cat) return;

    var normalized = normalizeCategorySlug(cat);
    var map = getCategoryMap(settings);
    var target = map[normalized] || cat;

    var matchedOption = Array.prototype.find.call(categoryField.options, function (opt) {
      return normalizeCategorySlug(opt.value) === normalizeCategorySlug(target);
    });

    if (matchedOption) {
      categoryField.value = matchedOption.value;
    }
  }

  function applyQuoteFormSettings(settings) {
    var form = document.getElementById('quoteForm');
    if (!form) return;

    applyCategoryOptions(settings);
    applyCategoryFromQuery(settings);

    var help = document.getElementById('quoteImagesHelp') || document.querySelector('#projectImages + .field-help');
    if (help) {
      help.textContent = 'Puedes subir hasta ' + String(settings.quoteForm.maxImages || 10) + ' fotos para ayudarnos a entender mejor tu proyecto.';
    }
  }

  function applyContactSettings(settings) {
    var contact = settings.contact;

    var phoneLink = document.getElementById('contactPhoneLink');
    if (phoneLink) {
      phoneLink.href = 'tel:' + contact.phoneE164;
      phoneLink.textContent = contact.phoneDisplay;
    }

    var emailLink = document.getElementById('contactEmailLink');
    if (emailLink) {
      emailLink.href = 'mailto:' + contact.email;
      emailLink.textContent = contact.email;
    }

    var whatsappLink = document.getElementById('contactWhatsappLink');
    if (whatsappLink) {
      whatsappLink.href = 'https://wa.me/' + contact.whatsappNumber;
    }

    var addressLink = document.getElementById('contactAddressLink');
    if (addressLink) {
      addressLink.href = contact.mapsLink;
      addressLink.textContent = contact.address;
    }

    var mapOpenLink = document.getElementById('contactMapOpenLink');
    if (mapOpenLink) {
      mapOpenLink.href = contact.mapsLink;
    }

    var mapFrame = document.getElementById('contactMapFrame');
    if (mapFrame) {
      mapFrame.src = 'https://www.google.com/maps?q=' + encodeURIComponent(contact.mapsEmbedQuery || contact.address) + '&output=embed';
    }

    var serviceArea = document.getElementById('contactServiceArea');
    if (serviceArea) {
      serviceArea.textContent = contact.serviceArea;
    }

    var hoursWeekdays = document.getElementById('contactHoursWeekdays');
    if (hoursWeekdays) {
      hoursWeekdays.textContent = contact.hoursWeekdays;
    }

    var hoursWeekends = document.getElementById('contactHoursWeekends');
    if (hoursWeekends) {
      hoursWeekends.textContent = contact.hoursWeekends;
    }
  }

  function applyHomepageSettings(settings) {
    var recentProjectsSection = document.getElementById('recentProjectsSection');
    if (recentProjectsSection) {
      recentProjectsSection.hidden = !settings.homepage.showRecentProjects;
    }

    var testimonialsSection = document.getElementById('testimonialsSection');
    if (testimonialsSection) {
      testimonialsSection.hidden = !settings.homepage.showTestimonials;
    }
  }

  function applyMaintenanceSettings(settings) {
    var body = document.body;
    var header = document.querySelector('.site-topbar');
    var main = document.querySelector('main');
    var footer = document.querySelector('.site-footer');
    var maintenanceShell = document.getElementById('siteMaintenanceShell');
    var business = settings.business || getDefaultSiteSettings().business;

    if (maintenanceShell) {
      maintenanceShell.remove();
    }

    body.classList.remove('site-maintenance-mode');

    if (!settings.operations.maintenanceMode || !header) {
      return;
    }

    body.classList.add('site-maintenance-mode');

    header.innerHTML =
      '<div class="container topbar-inner topbar-inner-maintenance">' +
      '<a class="brand brand-maintenance" href="index.html" aria-label="Inicio ' + business.name + '">' +
      '<span class="brand-logo-wrap">' +
      '<img class="brand-logo" src="' + business.logoUrl + '" alt="Logo de ' + business.name + '" />' +
      '</span>' +
      '<span class="brand-copy">' +
      '<strong>' + business.name + '</strong>' +
      '<small>Mantenimiento</small>' +
      '</span>' +
      '</a>' +
      '</div>';

    maintenanceShell = document.createElement('section');
    maintenanceShell.id = 'siteMaintenanceShell';
    maintenanceShell.className = 'site-maintenance-shell';
    maintenanceShell.innerHTML =
      '<div class="site-maintenance-card">' +
      '<div class="site-maintenance-icon" aria-hidden="true">🚧</div>' +
      '<h1>Mantenimiento en progreso</h1>' +
      '<p>' + settings.operations.maintenanceMessage + '</p>' +
      '</div>';

    if (main && main.parentNode) {
      main.parentNode.insertBefore(maintenanceShell, main);
    } else if (footer && footer.parentNode) {
      footer.parentNode.insertBefore(maintenanceShell, footer);
    } else {
      header.parentNode.appendChild(maintenanceShell);
    }
  }

  function getQuotePayload() {
    return {
      name: (document.getElementById('name') || {}).value || '',
      phone: (document.getElementById('phone') || {}).value || '',
      addressLine: (document.getElementById('addressLine') || {}).value || '',
      city: (document.getElementById('city') || {}).value || '',
      stateRegion: (document.getElementById('stateRegion') || {}).value || '',
      postalCode: (document.getElementById('postalCode') || {}).value || '',
      email: (document.getElementById('email') || {}).value || '',
      category: (document.getElementById('category') || {}).value || '',
      measures: (document.getElementById('measures') || {}).value || '',
      material: (document.getElementById('material') || {}).value || '',
      budget: (document.getElementById('budget') || {}).value || '',
      message: (document.getElementById('message') || {}).value || ''
    };
  }

  function formatBudgetValue(value) {
    var digits = String(value || '').replace(/[^\d]/g, '');
    if (!digits) return '';

    var amount = Number(digits);
    if (!Number.isFinite(amount)) return '';

    return '$' + amount.toLocaleString('en-US');
  }

  function bindBudgetFormatter() {
    var budgetInput = document.getElementById('budget');
    if (!budgetInput) return;

    function applyFormat() {
      budgetInput.value = formatBudgetValue(budgetInput.value);
    }

    budgetInput.addEventListener('input', applyFormat);
    budgetInput.addEventListener('blur', applyFormat);
  }

  function renderProjectImagePreview(files) {
    var preview = document.getElementById('projectImagesPreview');
    if (!preview) return;

    var list = Array.prototype.slice.call(files || []);
    if (!list.length) {
      preview.hidden = true;
      preview.innerHTML = '';
      return;
    }

    preview.hidden = false;
    preview.innerHTML = list.map(function (file) {
      var objectUrl = URL.createObjectURL(file);
      return (
        '<div class="quote-image-preview-item">' +
        '<img src="' + objectUrl + '" alt="Vista previa del proyecto" />' +
        '<span>' + file.name + '</span>' +
        '</div>'
      );
    }).join('');
  }

  function bindQuoteForm(settings) {
    var form = document.getElementById('quoteForm');
    if (!form) return;

    var submitBtn = form.querySelector('button[type="submit"]');
    var statusEl = document.getElementById('quoteStatus');
    var projectImagesInput = document.getElementById('projectImages');
    var maxFileSizeBytes = 8 * 1024 * 1024;
    var maxImages = Number(settings.quoteForm.maxImages || 10);

    if (projectImagesInput) {
      projectImagesInput.addEventListener('change', function () {
        renderProjectImagePreview(projectImagesInput.files);
      });
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (!submitBtn || !statusEl) return;

      if (settings.operations.maintenanceMode) {
        statusEl.className = 'form-status error';
        statusEl.textContent = settings.operations.maintenanceMessage;
        return;
      }

      var selectedFiles = projectImagesInput ? Array.prototype.slice.call(projectImagesInput.files || []) : [];
      if (selectedFiles.length > maxImages) {
        statusEl.className = 'form-status error';
        statusEl.textContent = 'Puedes subir hasta ' + String(maxImages) + ' fotos por solicitud.';
        return;
      }

      var oversizedFile = selectedFiles.find(function (file) {
        return file && file.size > maxFileSizeBytes;
      });

      if (oversizedFile) {
        statusEl.className = 'form-status error';
        statusEl.textContent = 'La foto "' + oversizedFile.name + '" excede el límite de 8 MB.';
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = 'Enviando...';
      statusEl.className = 'form-status';
      statusEl.textContent = '';

      try {
        if (!QuoteService || typeof QuoteService.saveQuote !== 'function') {
          throw new Error('QuoteService no disponible');
        }

        var payload = getQuotePayload();
        await QuoteService.saveQuote(payload, selectedFiles);

        statusEl.classList.add('success');
        statusEl.textContent = '¡Gracias! Tu solicitud fue enviada correctamente.';
        form.reset();
        renderProjectImagePreview([]);
        applyCategoryOptions(settings);
      } catch (error) {
        console.error('Quote submission failed:', error);
        statusEl.classList.add('error');
        if (error && /permission|insufficient/i.test(String(error.message || ''))) {
          statusEl.textContent = 'Firebase rechazó la solicitud. Verifica que las reglas publicadas incluyan addressLine, city, stateRegion, postalCode y attachments.';
        } else if (error && /storage/i.test(String(error.message || ''))) {
          statusEl.textContent = 'No se pudieron subir las fotos del proyecto. Revisa Storage y el tamaño de cada imagen.';
        } else {
          statusEl.textContent = 'No se pudo guardar la solicitud: ' + (error && error.message ? error.message : 'error desconocido.');
        }
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Enviar solicitud';
      }
    });
  }

  async function init() {
    var settings = await loadSiteSettings();
    window.PublicSiteSettings = settings;

    mountEnvironmentBanner();
    renderHeader(settings);
    renderFooter(settings);
    applyContactSettings(settings);
    applyHomepageSettings(settings);
    applyMaintenanceSettings(settings);
    applyQuoteFormSettings(settings);
    bindBudgetFormatter();
    bindQuoteForm(settings);
    bindScrollAccent();
  }

  init();
})();
