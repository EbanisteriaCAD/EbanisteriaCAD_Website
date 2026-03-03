(function () {
  var STORAGE_KEY = 'ebanisteria_content_v1';

  var DEFAULT_CONTENT = {
    about: {
      title: 'Sobre Ebanister\u00edaCAD',
      paragraphs: [
        'Soy Ana \u00c1lamo y llevo 12 a\u00f1os en la industria de los gabinetes. Junto a mi esposo Christian Del Valle, quien ha sido ebanista por 18, decidimos arriesgarnos y tener nuestro propio negocio.',
        'Lo que comenz\u00f3 como un sue\u00f1o en la marquesina de nuestro hogar, es hoy Ebanister\u00eda CAD. Contamos con un taller de ebanister\u00eda ubicado en la carretera n\u00famero 1 en direcci\u00f3n de San Juan a Caguas.',
        'Somos un equipo de trabajo extraordinario que d\u00eda a d\u00eda se levanta para realizar la cocina de tus sue\u00f1os.',
        'Nos distingue nuestra rapidez, nuestra calidad, pero sobre todo, nuestra responsabilidad.'
      ]
    },
    contact: {
      title: 'Cont\u00e1ctenos',
      phones: ['787-425-3887', '787-446-4469'],
      email: 'ebanisteriacad@gmail.com'
    },
    pricing: {
      title: 'Precios Base',
      rows: [
        { service: 'M\u00f3dulo b\u00e1sico de cocina', price: '$2,500' },
        { service: 'Proyecto personalizado completo', price: '$5,000' }
      ]
    },
    designs: {
      title: 'Dise\u00f1os Destacados',
      categories: [
        {
          name: 'Cocinas',
          images: [
            { src: '', caption: 'Cocina Moderna Minimalista' }
          ]
        },
        {
          name: 'Closets',
          images: [
            { src: '', caption: 'Closets y Muebles Empotrados' }
          ]
        },
        {
          name: 'Acabados',
          images: [
            { src: '', caption: 'Acabado Cl\u00e1sico Elegante' }
          ]
        }
      ]
    }
  };

  function cloneDefault() {
    return JSON.parse(JSON.stringify(DEFAULT_CONTENT));
  }

  function loadContent() {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneDefault();
    try {
      var parsed = JSON.parse(raw);
      return deepMerge(cloneDefault(), parsed);
    } catch (e) {
      return cloneDefault();
    }
  }

  function deepMerge(base, incoming) {
    if (!incoming || typeof incoming !== 'object') return base;
    Object.keys(incoming).forEach(function (k) {
      if (Array.isArray(incoming[k])) {
        base[k] = incoming[k];
      } else if (incoming[k] && typeof incoming[k] === 'object' && base[k] && typeof base[k] === 'object') {
        base[k] = deepMerge(base[k], incoming[k]);
      } else {
        base[k] = incoming[k];
      }
    });
    return base;
  }

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

  function renderAbout(content) {
    var section = document.getElementById('about');
    if (!section) return;
    section.innerHTML = '';
    var h2 = document.createElement('h2');
    h2.textContent = content.about.title;
    section.appendChild(h2);

    content.about.paragraphs.forEach(function (txt) {
      var p = document.createElement('p');
      p.textContent = txt;
      section.appendChild(p);
    });
  }

  function renderContact(content) {
    var section = document.getElementById('contact');
    if (!section) return;
    section.innerHTML = '';

    var h2 = document.createElement('h2');
    h2.textContent = content.contact.title;
    section.appendChild(h2);

    content.contact.phones.forEach(function (phone) {
      if (!phone) return;
      var p = document.createElement('p');
      p.textContent = 'Tel\u00e9fono: ' + phone;
      section.appendChild(p);
    });

    var email = document.createElement('p');
    email.textContent = 'Email: ' + (content.contact.email || '');
    section.appendChild(email);
  }

  function renderPricing(content) {
    var section = document.getElementById('pricing');
    if (!section) return;

    section.innerHTML = '';
    var h2 = document.createElement('h2');
    h2.textContent = content.pricing.title;
    section.appendChild(h2);

    var table = document.createElement('table');
    var headRow = document.createElement('tr');
    headRow.innerHTML = '<th>Servicio</th><th>Precio desde</th>';
    table.appendChild(headRow);

    content.pricing.rows.forEach(function (row) {
      var tr = document.createElement('tr');
      var tdService = document.createElement('td');
      tdService.textContent = row.service || '';
      var tdPrice = document.createElement('td');
      tdPrice.textContent = row.price || '';
      tr.appendChild(tdService);
      tr.appendChild(tdPrice);
      table.appendChild(tr);
    });

    section.appendChild(table);
  }

  function renderDesigns(content) {
    var section = document.getElementById('designs');
    if (!section) return;

    section.innerHTML = '';
    var h2 = document.createElement('h2');
    h2.textContent = content.designs.title;
    section.appendChild(h2);

    content.designs.categories.forEach(function (cat) {
      var title = document.createElement('h3');
      title.textContent = cat.name;
      title.style.marginTop = '1rem';
      section.appendChild(title);

      var gallery = document.createElement('div');
      gallery.className = 'design-gallery';

      (cat.images || []).forEach(function (img) {
        var card = document.createElement('article');
        card.className = 'design-card';

        if (img.src) {
          var image = document.createElement('img');
          image.className = 'design-image';
          image.src = img.src;
          image.alt = img.caption || cat.name;
          card.appendChild(image);
        }

        var caption = document.createElement('h3');
        caption.textContent = img.caption || 'Dise\u00f1o';
        card.appendChild(caption);
        gallery.appendChild(card);
      });

      if (!cat.images || cat.images.length === 0) {
        var empty = document.createElement('p');
        empty.textContent = 'Sin dise\u00f1os en esta carpeta todav\u00eda.';
        gallery.appendChild(empty);
      }

      section.appendChild(gallery);
    });
  }

  function bindQuoteForm() {
    var quoteForm = document.getElementById('quoteForm');
    if (!quoteForm) return;
    quoteForm.addEventListener('submit', function (e) {
      e.preventDefault();
      alert('\u00a1Gracias! Te contactaremos pronto.');
    });
  }

  var page = currentPage();
  var content = loadContent();

  renderHeader(page);
  renderAbout(content);
  renderContact(content);
  renderPricing(content);
  renderDesigns(content);
  bindQuoteForm();
})();