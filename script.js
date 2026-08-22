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
        accessories: ['Luces', 'Zafacon', 'Espejos'],
        materials: ['Panel de PVC', 'Variedad de Maderas', 'Panel Hidrófugo'],
        categories: ['Cocinas', 'Closets', 'Centros TV', 'Baños', 'Comercial', 'Restauración']
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
        accessories: uniqueStrings(quoteForm.accessories).length ? uniqueStrings(quoteForm.accessories) : defaults.quoteForm.accessories.slice(),
        materials: uniqueStrings(quoteForm.materials).length ? uniqueStrings(quoteForm.materials) : defaults.quoteForm.materials.slice(),
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
      '<p class="footer-credit">Built by <a href="https://firstlinedev.com" target="_blank" rel="noopener noreferrer">FirstLine Development</a></p>' +
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
      .replace(/�/g, 'n')
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

  function getSelectedQuoteCategories() {
    return Array.prototype.slice.call(document.querySelectorAll('input[name="quoteCategories"]:checked')).map(function (input) {
      return input.value;
    });
  }

  function getSelectedQuoteAccessories() {
    return Array.prototype.slice.call(document.querySelectorAll('input[name="quoteAccessories"]:checked')).map(function (input) {
      return input.value;
    });
  }

  function updateCategoryFieldValue() {
    var categoryField = document.getElementById('category');
    if (!categoryField) return;
    categoryField.value = getSelectedQuoteCategories().join(', ');
  }

  function clearCategoryChecklistError() {
    var checklist = document.getElementById('categoryChecklist');
    if (checklist) {
      checklist.classList.remove('is-invalid');
    }
  }

  function updateAccessoriesFieldValue() {
    var accessoriesField = document.getElementById('accessoriesSummary');
    if (!accessoriesField) return;
    accessoriesField.value = getSelectedQuoteAccessories().join(', ');
  }

  function applyCategoryOptions(settings) {
    var categoryField = document.getElementById('category');
    var checklist = document.getElementById('categoryChecklist');
    if (!categoryField || !checklist) return;

    var currentValues = (categoryField.value || '').split(',').map(function (value) {
      return String(value || '').trim();
    }).filter(Boolean);
    var categories = settings.quoteForm.categories || [];

    checklist.innerHTML = categories.map(function (category, index) {
      var inputId = 'quoteCategoryOption' + String(index);
      var checked = currentValues.indexOf(category) >= 0 ? ' checked' : '';
      return (
        '<label class="option-checklist-item" for="' + inputId + '">' +
        '<input id="' + inputId + '" type="checkbox" name="quoteCategories" value="' + category + '"' + checked + ' />' +
        '<span>' + category + '</span>' +
        '</label>'
      );
    }).join('');

    checklist.querySelectorAll('input[name="quoteCategories"]').forEach(function (input) {
      input.addEventListener('change', function () {
        clearCategoryChecklistError();
        updateCategoryFieldValue();
      });
    });

    updateCategoryFieldValue();
  }

  function applyAccessoriesOptions(settings) {
    var accessoriesField = document.getElementById('accessoriesSummary');
    var checklist = document.getElementById('accessoriesChecklist');
    if (!accessoriesField || !checklist) return;

    var currentValues = (accessoriesField.value || '').split(',').map(function (value) {
      return String(value || '').trim();
    }).filter(Boolean);
    var accessories = settings.quoteForm.accessories || [];

    checklist.innerHTML = accessories.map(function (accessory, index) {
      var inputId = 'quoteAccessoryOption' + String(index);
      var checked = currentValues.indexOf(accessory) >= 0 ? ' checked' : '';
      return (
        '<label class="option-checklist-item" for="' + inputId + '">' +
        '<input id="' + inputId + '" type="checkbox" name="quoteAccessories" value="' + accessory + '"' + checked + ' />' +
        '<span>' + accessory + '</span>' +
        '</label>'
      );
    }).join('');

    checklist.querySelectorAll('input[name="quoteAccessories"]').forEach(function (input) {
      input.addEventListener('change', updateAccessoriesFieldValue);
    });

    updateAccessoriesFieldValue();
  }

  function applyMaterialOptions(settings) {
    var materialField = document.getElementById('material');
    if (!materialField) return;

    var currentValue = materialField.value || '';
    var materials = settings.quoteForm.materials || [];

    materialField.innerHTML = '<option value="">Selecciona un material</option>' + materials.map(function (material) {
      return '<option value="' + material + '">' + material + '</option>';
    }).join('');

    if (materials.indexOf(currentValue) >= 0) {
      materialField.value = currentValue;
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
    var matchedInput = Array.prototype.find.call(document.querySelectorAll('input[name="quoteCategories"]'), function (input) {
      return normalizeCategorySlug(input.value) === normalizeCategorySlug(target);
    });

    if (matchedInput) {
      matchedInput.checked = true;
      updateCategoryFieldValue();
    }
  }

  function applyQuoteFormSettings(settings) {
    var form = document.getElementById('quoteForm');
    if (!form) return;

    applyCategoryOptions(settings);
    applyAccessoriesOptions(settings);
    applyMaterialOptions(settings);
    applyCategoryFromQuery(settings);
    bindVisitDatePicker();
    bindRequestKindSelector();

    var help = document.getElementById('quoteImagesHelp') || document.querySelector('#projectImages + .field-help');
    if (help) {
      help.textContent = 'Puedes subir hasta ' + String(settings.quoteForm.maxImages || 10) + ' fotos para ayudarnos a entender mejor tu proyecto o el espacio a visitar.';
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
      '<div class="site-maintenance-icon" aria-hidden="true">' +
      '<svg viewBox="0 0 24 24" role="img" focusable="false" aria-hidden="true">' +
      '<path d="M21 7.5a5.5 5.5 0 0 1-7.91 4.96l-6.13 6.13a1.75 1.75 0 1 1-2.47-2.47l6.13-6.13A5.5 5.5 0 0 1 16.5 3l-2.12 2.12 2.5 2.5L21 5.5v2Z"></path>' +
      '</svg>' +
      '</div>' +
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
    var requestKind = getSelectedRequestKind();
    var isVisit = requestKind === 'visit';
    var selectedCategories = getSelectedQuoteCategories();
    var selectedAccessories = getSelectedQuoteAccessories();
    return {
      name: (document.getElementById('name') || {}).value || '',
      phone: (document.getElementById('phone') || {}).value || '',
      addressLine: isVisit ? '' : ((document.getElementById('addressLine') || {}).value || ''),
      city: (document.getElementById('city') || {}).value || '',
      stateRegion: isVisit ? '' : ((document.getElementById('stateRegion') || {}).value || ''),
      postalCode: isVisit ? '' : ((document.getElementById('postalCode') || {}).value || ''),
      email: (document.getElementById('email') || {}).value || '',
      category: selectedCategories.join(', '),
      requestKind: requestKind,
      preferredVisitDate: ((document.getElementById('preferredVisitDate') || {}).dataset || {}).isoValue || '',
      preferredVisitWindow: (document.getElementById('preferredVisitWindow') || {}).value || '',
      measures: isVisit ? '' : ((document.getElementById('measures') || {}).value || ''),
      accessories: isVisit ? [] : selectedAccessories,
      material: isVisit ? '' : ((document.getElementById('material') || {}).value || ''),
      budget: (document.getElementById('budget') || {}).value || '',
      message: isVisit ? '' : ((document.getElementById('message') || {}).value || '')
    };
  }

  function getSelectedRequestKind() {
    var selected = document.querySelector('input[name="requestKind"]:checked');
    return selected && selected.value === 'visit' ? 'visit' : 'quote';
  }

  function toggleFieldVisibility(fieldId, shouldShow) {
    var field = document.getElementById(fieldId);
    if (field) {
      field.hidden = !shouldShow;
    }
  }

  function getCurrentLocalDateIso() {
    var now = new Date();
    var year = now.getFullYear();
    var month = String(now.getMonth() + 1).padStart(2, '0');
    var day = String(now.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
  }

  function parseIsoDate(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').trim());
    if (!match) return null;

    var year = Number(match[1]);
    var monthIndex = Number(match[2]) - 1;
    var day = Number(match[3]);
    var date = new Date(year, monthIndex, day);
    if (date.getFullYear() !== year || date.getMonth() !== monthIndex || date.getDate() !== day) {
      return null;
    }

    return date;
  }

  function formatIsoDate(date) {
    if (!(date instanceof Date)) return '';
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }

  function formatHumanDate(date) {
    if (!(date instanceof Date)) return '';
    return date.toLocaleDateString('es-PR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  }

  function isWeekendDate(date) {
    if (!(date instanceof Date)) return false;
    var day = date.getDay();
    return day === 0 || day === 6;
  }

  function getNextBusinessDate(startDate) {
    var date = startDate instanceof Date
      ? new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
      : parseIsoDate(getCurrentLocalDateIso());

    while (isWeekendDate(date)) {
      date.setDate(date.getDate() + 1);
    }

    return date;
  }

  function bindVisitDatePicker() {
    var input = document.getElementById('preferredVisitDate');
    var calendar = document.getElementById('preferredVisitDateCalendar');
    var form = document.getElementById('quoteForm');
    var picker = input ? input.closest('.visit-date-picker') : null;
    if (!input || !calendar || input.dataset.calendarBound === 'true') return;

    var todayIso = getCurrentLocalDateIso();
    var minDate = getNextBusinessDate(parseIsoDate(todayIso));
    var selectedDate = parseIsoDate(input.dataset.isoValue || '');
    if (selectedDate && (selectedDate < minDate || isWeekendDate(selectedDate))) {
      selectedDate = null;
    }

    if (selectedDate) {
      input.dataset.isoValue = formatIsoDate(selectedDate);
      input.value = formatHumanDate(selectedDate);
    } else {
      input.dataset.isoValue = '';
      input.value = '';
    }

    var visibleMonth = new Date((selectedDate || minDate).getFullYear(), (selectedDate || minDate).getMonth(), 1);

    function canGoPrev() {
      var prevMonthLastDate = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 0);
      return prevMonthLastDate >= minDate;
    }

    function closeCalendar() {
      calendar.hidden = true;
      input.setAttribute('aria-expanded', 'false');
    }

    function renderCalendar() {
      var firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
      var startOffset = (firstDay.getDay() + 6) % 7;
      var gridStart = new Date(firstDay.getFullYear(), firstDay.getMonth(), 1 - startOffset);
      var monthLabel = visibleMonth.toLocaleDateString('es-PR', { month: 'long', year: 'numeric' });
      var buttons = [];

      for (var dayIndex = 0; dayIndex < 42; dayIndex += 1) {
        var cellDate = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + dayIndex);
        var isoValue = formatIsoDate(cellDate);
        var isPast = cellDate < minDate;
        var isWeekend = isWeekendDate(cellDate);
        var isOutsideMonth = cellDate.getMonth() !== visibleMonth.getMonth();
        var isSelected = selectedDate && formatIsoDate(selectedDate) === isoValue;
        var isToday = isoValue === todayIso;
        var classNames = ['visit-date-calendar-day'];

        if (isWeekend) classNames.push('is-weekend');
        if (isOutsideMonth) classNames.push('is-outside');
        if (isSelected) classNames.push('is-selected');
        if (isToday) classNames.push('is-today');

        buttons.push(
          '<button type="button" class="' + classNames.join(' ') + '" data-date-value="' + isoValue + '"' + (isPast || isWeekend ? ' disabled' : '') + '>' +
          String(cellDate.getDate()) +
          '</button>'
        );
      }

      calendar.innerHTML =
        '<div class="visit-date-calendar-head">' +
        '<button type="button" class="visit-date-calendar-nav" data-calendar-nav="prev"' + (canGoPrev() ? '' : ' disabled') + ' aria-label="Mes anterior">&#8249;</button>' +
        '<div class="visit-date-calendar-title">' + monthLabel + '</div>' +
        '<button type="button" class="visit-date-calendar-nav" data-calendar-nav="next" aria-label="Mes siguiente">&#8250;</button>' +
        '</div>' +
        '<div class="visit-date-calendar-weekdays">' +
        '<span>L</span><span>M</span><span>X</span><span>J</span><span>V</span><span>S</span><span>D</span>' +
        '</div>' +
        '<div class="visit-date-calendar-grid">' + buttons.join('') + '</div>' +
        '<p class="visit-date-calendar-note">Los fines de semana no están disponibles para visitas.</p>';
    }

    function openCalendar() {
      renderCalendar();
      calendar.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    }

    function setSelectedDate(date) {
      selectedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      input.dataset.isoValue = formatIsoDate(selectedDate);
      input.value = formatHumanDate(selectedDate);
      closeCalendar();
    }

    input.setAttribute('aria-haspopup', 'dialog');
    input.setAttribute('aria-expanded', 'false');

    input.addEventListener('click', function () {
      if (calendar.hidden) {
        openCalendar();
      } else {
        closeCalendar();
      }
    });

    input.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
        event.preventDefault();
        openCalendar();
      } else if (event.key === 'Escape') {
        closeCalendar();
      }
    });

    calendar.addEventListener('click', function (event) {
      event.stopPropagation();

      var target = event.target;
      if (!(target instanceof HTMLElement)) return;

      var navButton = target.closest('[data-calendar-nav]');
      if (navButton instanceof HTMLElement) {
        visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + (navButton.getAttribute('data-calendar-nav') === 'next' ? 1 : -1), 1);
        if (visibleMonth < new Date(minDate.getFullYear(), minDate.getMonth(), 1)) {
          visibleMonth = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
        }
        renderCalendar();
        return;
      }

      var dayButton = target.closest('[data-date-value]');
      if (!(dayButton instanceof HTMLElement) || dayButton.hasAttribute('disabled')) return;

      var date = parseIsoDate(dayButton.getAttribute('data-date-value'));
      if (date && !isWeekendDate(date) && date >= minDate) {
        setSelectedDate(date);
      }
    });

    document.addEventListener('click', function (event) {
      var target = event.target;
      if (!(target instanceof Node)) return;
      if (!calendar.hidden && !(picker && picker.contains(target))) {
        closeCalendar();
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !calendar.hidden) {
        closeCalendar();
      }
    });

    if (form) {
      form.addEventListener('reset', function () {
        selectedDate = null;
        visibleMonth = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
        input.dataset.isoValue = '';
        input.value = '';
        closeCalendar();
      });
    }

    input.dataset.calendarBound = 'true';
  }

  function updateRequestKindUI() {
    var form = document.getElementById('quoteForm');
    if (!form) return;

    var requestKind = getSelectedRequestKind();
    var isVisit = requestKind === 'visit';
    var visitFields = document.getElementById('visitFields');
    var title = document.getElementById('quotePageTitle');
    var subtitle = document.getElementById('quotePageSubtitle');
    var notice = document.getElementById('requestModeNotice');
    var messageLabel = document.getElementById('messageLabel');
    var messageField = document.getElementById('message');
    var submitBtn = document.getElementById('quoteSubmitBtn');
    var measuresField = document.getElementById('measures');
    var budgetField = document.getElementById('budget');
    var addressField = document.getElementById('addressLine');
    var stateField = document.getElementById('stateRegion');
    var postalCodeField = document.getElementById('postalCode');
    var dateField = document.getElementById('preferredVisitDate');

    if (visitFields) {
      visitFields.hidden = !isVisit;
    }

    toggleFieldVisibility('fieldAddressLine', !isVisit);
    toggleFieldVisibility('fieldStateRegion', !isVisit);
    toggleFieldVisibility('fieldPostalCode', !isVisit);
    toggleFieldVisibility('fieldMeasures', !isVisit);
    toggleFieldVisibility('fieldMaterial', !isVisit);
    toggleFieldVisibility('fieldAccessories', !isVisit);
    toggleFieldVisibility('fieldProjectImages', !isVisit);
    toggleFieldVisibility('fieldMessage', !isVisit);

    if (addressField) {
      addressField.required = !isVisit;
    }

    if (stateField) {
      stateField.required = !isVisit;
    }

    if (postalCodeField) {
      postalCodeField.required = !isVisit;
    }

    if (messageField) {
      messageField.required = !isVisit;
    }

    if (title) {
      title.innerHTML = isVisit ? 'Solicitar Visita' : 'Solicitar Cotizaci&oacute;n o Visita';
    }

    if (subtitle) {
      subtitle.innerHTML = isVisit
        ? 'Cu&eacute;ntanos qu&eacute; necesitas y coordinaremos una visita para ayudarte con medidas, ideas y orientaci&oacute;n del proyecto.'
        : 'Elige si ya tienes medidas para cotizar o si prefieres que coordinemos una visita para orientarte con ideas.';
    }

    if (notice) {
      notice.textContent = isVisit
        ? 'Comparte tu pueblo, categoría, presupuesto estimado y tu preferencia de fecha y horario para coordinar la visita.'
        : 'Si ya tienes medidas aproximadas, materiales o presupuesto, inclúyelos para agilizar tu propuesta.';
    }

    if (messageLabel) {
      messageLabel.textContent = isVisit ? 'Cuentanos en que necesitas ayuda *' : 'Mensaje *';
    }

    if (messageField) {
      messageField.placeholder = isVisit
        ? 'Ej. Necesito ayuda para tomar medidas, definir distribucion y escoger la mejor opcion para mi espacio.'
        : 'Cuentanos sobre tu proyecto, estilo deseado, medidas o dudas.';
    }

    if (submitBtn) {
      submitBtn.textContent = isVisit ? 'Solicitar visita' : 'Enviar solicitud';
    }

    if (measuresField) {
      measuresField.placeholder = isVisit ? 'Si no las tienes, puedes dejar este campo en blanco' : 'Ej. 12x10 pies';
    }

    if (budgetField) {
      budgetField.placeholder = isVisit ? 'Opcional si todavia estas explorando opciones' : 'Ej. $5,000 - $8,000';
    }

    if (dateField && isVisit) {
      var visitDate = parseIsoDate(dateField.dataset.isoValue || '');
      if (visitDate && isWeekendDate(visitDate)) {
        dateField.dataset.isoValue = '';
        dateField.value = '';
      }
    }
  }

  function bindRequestKindSelector() {
    var form = document.getElementById('quoteForm');
    if (!form) return;

    var inputs = document.querySelectorAll('input[name="requestKind"]');
    if (!inputs.length) return;

    var params = new URLSearchParams(window.location.search);
    var requestedKind = String(params.get('kind') || '').toLowerCase();
    if (requestedKind === 'visit') {
      inputs.forEach(function (input) {
        input.checked = input.value === 'visit';
      });
    }

    if (!form.dataset.requestKindBound) {
      inputs.forEach(function (input) {
        input.addEventListener('change', updateRequestKindUI);
      });
      form.dataset.requestKindBound = 'true';
    }

    updateRequestKindUI();
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

      var selectedFiles = getSelectedRequestKind() === 'visit'
        ? []
        : (projectImagesInput ? Array.prototype.slice.call(projectImagesInput.files || []) : []);
      var selectedCategories = getSelectedQuoteCategories();

      if (!selectedCategories.length) {
        clearCategoryChecklistError();
        var checklist = document.getElementById('categoryChecklist');
        if (checklist) {
          checklist.classList.add('is-invalid');
        }
        statusEl.className = 'form-status error';
        statusEl.textContent = 'Selecciona al menos una categoría para continuar.';
        return;
      }

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
        statusEl.textContent = 'La foto "' + oversizedFile.name + '" excede el limite de 8 MB.';
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
        statusEl.textContent = payload.requestKind === 'visit'
          ? 'Gracias. Tu solicitud de visita fue enviada correctamente.'
          : 'Gracias. Tu solicitud fue enviada correctamente.';
        form.reset();
        renderProjectImagePreview([]);
        applyCategoryOptions(settings);
        applyAccessoriesOptions(settings);
        clearCategoryChecklistError();
        bindRequestKindSelector();
      } catch (error) {
        console.error('Quote submission failed:', error);
        statusEl.classList.add('error');
        if (error && /permission|insufficient/i.test(String(error.message || ''))) {
          statusEl.textContent = 'Firebase rechazó la solicitud. Verifica que las reglas publicadas estén sincronizadas con los campos actuales del formulario.';
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

