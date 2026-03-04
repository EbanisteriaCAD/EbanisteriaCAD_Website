(function () {
  var PAGE_PATH = window.location.pathname.split('/').pop() || 'index.html';

  var NAV_ITEMS = [
    { href: 'index.html', label: 'Inicio' },
    { href: 'about.html', label: 'Nosotros' },
    { href: 'designs.html', label: 'Dise\u00f1os' },
    { href: 'pricing.html', label: 'Precios' },
    { href: 'contact.html', label: 'Cont\u00e1ctenos' }
  ];

  function isActive(href) {
    return PAGE_PATH.toLowerCase() === href.toLowerCase();
  }

  function renderHeader() {
    var header = document.querySelector('.site-topbar');
    if (!header) return;

    var links = NAV_ITEMS.map(function (item) {
      var activeClass = isActive(item.href) ? ' class="active"' : '';
      return '<li><a' + activeClass + ' href="' + item.href + '">' + item.label + '</a></li>';
    }).join('');

    header.innerHTML =
      '<div class="container topbar-inner">' +
      '<a class="brand" href="index.html" aria-label="Inicio Ebanister\u00eda CAD">' +
      '<span class="brand-logo-wrap">' +
      '<img class="brand-logo" src="assets/logo.jpg" alt="Logo de Ebanister\u00eda CAD" />' +
      '</span>' +
      '</a>' +
      '<button class="nav-toggle" type="button" aria-label="Abrir men\u00fa" aria-controls="site-nav" aria-expanded="false">' +
      '<span></span><span></span><span></span>' +
      '</button>' +
      '<nav id="site-nav" class="top-links-nav" aria-label="Principal">' +
      '<ul>' + links + '</ul>' +
      '<a class="btn btn-primary nav-cta" href="quote.html">Solicitar Cotizaci\u00f3n</a>' +
      '</nav>' +
      '</div>';

    bindMobileMenu();
  }

  function renderFooter() {
    var footer = document.querySelector('.site-footer');
    if (!footer) return;

    footer.innerHTML =
      '<div class="container footer-inner">' +
      '<div class="footer-links">' +
      '<a class="footer-link" href="about.html">Nosotros</a>' +
      '<a class="footer-link" href="designs.html">Dise\u00f1os</a>' +
      '<a class="footer-link" href="pricing.html">Precios</a>' +
      '<a class="footer-link" href="contact.html">Cont\u00e1ctenos</a>' +
      '<a class="footer-link" href="quote.html">Cotizar Ahora</a>' +
      '</div>' +
      '<div class="footer-social">' +
      '<a class="footer-icon" href="https://www.facebook.com/share/1GQxtdCVWr/" target="_blank" rel="noopener noreferrer" aria-label="Facebook">Facebook</a>' +
      '<a class="footer-icon" href="https://wa.me/17874464469" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">WhatsApp</a>' +
      '</div>' +
      '<p>\u00a9 2026 Ebanister\u00eda CAD. Todos los derechos reservados.</p>' +
      '</div>';
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

  function applyCategoryFromQuery() {
    var form = document.getElementById('quoteForm');
    if (!form) return;

    var categoryField = document.getElementById('category');
    if (!categoryField) return;

    var params = new URLSearchParams(window.location.search);
    var cat = params.get('cat');
    if (!cat) return;

    var normalized = cat.toLowerCase();
    var matchedOption = Array.prototype.find.call(categoryField.options, function (opt) {
      return opt.value.toLowerCase() === normalized || opt.textContent.toLowerCase() === normalized;
    });

    if (matchedOption) {
      categoryField.value = matchedOption.value;
    }
  }

  function bindQuoteForm() {
    var form = document.getElementById('quoteForm');
    if (!form) return;

    var submitBtn = form.querySelector('button[type="submit"]');
    var statusEl = document.getElementById('quoteStatus');
    var formAction = form.getAttribute('action') || '';

    applyCategoryFromQuery();

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!submitBtn || !statusEl) return;

      submitBtn.disabled = true;
      submitBtn.textContent = 'Enviando...';
      statusEl.className = 'form-status';
      statusEl.textContent = '';

      var isPlaceholder = formAction.indexOf('XXXXXXXX') !== -1;
      var formData = new FormData(form);

      var request = isPlaceholder
        ? new Promise(function (resolve) {
            setTimeout(resolve, 900);
          })
        : fetch(formAction, {
            method: 'POST',
            body: formData,
            headers: {
              Accept: 'application/json'
            }
          });

      request
        .then(function () {
          statusEl.classList.add('success');
          statusEl.textContent = '¡Gracias! Tu solicitud fue enviada correctamente.';
          form.reset();
        })
        .catch(function () {
          statusEl.classList.add('error');
          statusEl.textContent = 'No se pudo enviar ahora. Inténtalo nuevamente en unos minutos.';
        })
        .finally(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Enviar solicitud';
        });
    });
  }

  renderHeader();
  renderFooter();
  bindQuoteForm();
})();
