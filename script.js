(function () {
  function currentPage() {
    var file = window.location.pathname.split('/').pop();
    return (file && file.length ? file : 'index.html').toLowerCase();
  }

  function renderHeader(page) {
    var header = document.querySelector('.site-topbar');
    if (!header) return;

    var links = [
      { href: 'index.html', label: 'Inicio' },
      { href: 'about.html', label: 'Nosotros' },
      { href: 'quote.html', label: 'Cotizaci\u00f3n' },
      { href: 'designs.html', label: 'Dise\u00f1os' },
      { href: 'pricing.html', label: 'Precios' },
      { href: 'contact.html', label: 'Cont\u00e1ctenos' }
    ];

    var navItems = links.map(function (link) {
      var active = page === link.href ? ' class="active"' : '';
      return '<li><a' + active + ' href="' + link.href + '">' + link.label + '</a></li>';
    }).join('');

    header.innerHTML =
      '<a class="brand-logo-link" href="index.html">' +
      '<img class="brand-logo" src="assets/logo.jpg" alt="Ebanister\u00edaCAD logo" />' +
      '</a>' +
      '<nav class="top-links-nav"><ul>' + navItems + '</ul></nav>';
  }

  function bindQuoteForm() {
    var quoteForm = document.getElementById('quoteForm');
    if (!quoteForm) return;
    quoteForm.addEventListener('submit', function (e) {
      e.preventDefault();
      alert('\u00a1Gracias! Te contactaremos pronto.');
    });
  }

  renderHeader(currentPage());
  bindQuoteForm();
})();