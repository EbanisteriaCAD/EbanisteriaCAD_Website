import { ContentService } from './content-service.js';

(function () {
  var testimonialsExpanded = false;
  var page = (window.location.pathname.split('/').pop() || '').toLowerCase();
  var galleryState = {
    items: [],
    categoryName: '',
    index: 0,
    touchStartX: 0,
    touchStartY: 0
  };

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function setStatus(id, message) {
    var el = byId(id);
    if (!el) return;
    if (!message) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    el.hidden = false;
    el.textContent = message;
  }

  function openGallery(categoryName, images, index) {
    var modal = byId('publicGalleryModal');
    if (!modal) return;

    galleryState.items = Array.isArray(images) ? images.slice() : [];
    galleryState.categoryName = categoryName || 'Galería';
    galleryState.index = Math.max(0, Math.min(Number(index || 0), galleryState.items.length - 1));
    modal.hidden = false;
    document.body.classList.add('public-gallery-open');
    renderGallery();
  }

  function closeGallery() {
    var modal = byId('publicGalleryModal');
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove('public-gallery-open');
  }

  function renderGallery() {
    var imageEl = byId('publicGalleryImage');
    var metaEl = byId('publicGalleryMeta');
    var titleEl = byId('publicGalleryTitle');
    var thumbsEl = byId('publicGalleryThumbs');
    var prevEl = byId('publicGalleryPrev');
    var nextEl = byId('publicGalleryNext');
    var current = galleryState.items[galleryState.index];

    if (!imageEl || !metaEl || !titleEl || !thumbsEl || !current) return;

    titleEl.textContent = galleryState.categoryName || 'Galería';
    metaEl.textContent = 'Imagen ' + String(galleryState.index + 1) + ' de ' + String(galleryState.items.length);
    imageEl.src = current.url;
    imageEl.alt = current.alt || galleryState.categoryName || 'Diseño';

    thumbsEl.innerHTML = galleryState.items.map(function (item, index) {
      return (
        '<button class="public-gallery-thumb' + (index === galleryState.index ? ' active' : '') + '" type="button" data-gallery-index="' + String(index) + '">' +
        '<img src="' + escapeHtml(item.url) + '" alt="' + escapeHtml(item.alt || galleryState.categoryName) + '" />' +
        '</button>'
      );
    }).join('');

    if (prevEl) prevEl.disabled = galleryState.items.length <= 1;
    if (nextEl) nextEl.disabled = galleryState.items.length <= 1;
  }

  function moveGallery(step) {
    if (!galleryState.items.length) return;
    galleryState.index = (galleryState.index + step + galleryState.items.length) % galleryState.items.length;
    renderGallery();
  }

  function wireGallery() {
    var modal = byId('publicGalleryModal');
    var thumbsEl = byId('publicGalleryThumbs');
    var prevEl = byId('publicGalleryPrev');
    var nextEl = byId('publicGalleryNext');
    var closeEl = byId('publicGalleryClose');
    var stageEl = byId('publicGalleryStage');
    if (!modal) return;

    modal.addEventListener('click', function (e) {
      var target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.hasAttribute('data-gallery-close')) {
        closeGallery();
      }
    });

    if (closeEl) {
      closeEl.addEventListener('click', closeGallery);
    }

    if (prevEl) {
      prevEl.addEventListener('click', function () {
        moveGallery(-1);
      });
    }

    if (nextEl) {
      nextEl.addEventListener('click', function () {
        moveGallery(1);
      });
    }

    if (thumbsEl) {
      thumbsEl.addEventListener('click', function (e) {
        var target = e.target;
        if (!(target instanceof HTMLElement)) return;
        var button = target.closest('[data-gallery-index]');
        if (!(button instanceof HTMLElement)) return;
        galleryState.index = Number(button.getAttribute('data-gallery-index') || 0);
        renderGallery();
      });
    }

    if (stageEl) {
      stageEl.addEventListener('touchstart', function (e) {
        var touch = e.changedTouches && e.changedTouches[0];
        if (!touch) return;
        galleryState.touchStartX = touch.clientX;
        galleryState.touchStartY = touch.clientY;
      }, { passive: true });

      stageEl.addEventListener('touchend', function (e) {
        var touch = e.changedTouches && e.changedTouches[0];
        if (!touch) return;

        var deltaX = touch.clientX - galleryState.touchStartX;
        var deltaY = touch.clientY - galleryState.touchStartY;
        var absX = Math.abs(deltaX);
        var absY = Math.abs(deltaY);

        if (absX < 40 || absX <= absY) {
          return;
        }

        if (deltaX < 0) {
          moveGallery(1);
          return;
        }

        moveGallery(-1);
      }, { passive: true });
    }

    window.addEventListener('keydown', function (e) {
      if (modal.hidden) return;
      if (e.key === 'Escape') closeGallery();
      if (e.key === 'ArrowLeft') moveGallery(-1);
      if (e.key === 'ArrowRight') moveGallery(1);
    });
  }

  function renderDesigns(items) {
    var nav = byId('designsCategoryNav');
    var grid = byId('designsGrid');
    if (!grid) return;

    if (!items.length) {
      setStatus('designsStatus', 'Todavía no hay categorías publicadas. Vuelve pronto.');
      grid.innerHTML = '';
      if (nav) {
        nav.hidden = true;
        nav.innerHTML = '';
      }
      return;
    }

    setStatus('designsStatus', '');

    if (nav) {
      nav.hidden = false;
      nav.innerHTML = items.map(function (item) {
        return '<a class="btn btn-outline" href="#' + escapeHtml(item.slug) + '">' + escapeHtml(item.name) + '</a>';
      }).join('');
    }

    grid.innerHTML = items.map(function (item) {
      var images = Array.isArray(item.images) && item.images.length ? item.images : [{ url: item.coverImage || 'assets/index-hero.jpg', alt: item.name }];
      var thumb = item.coverImage || images[0].url || 'assets/index-hero.jpg';
      return (
        '<article class="card gallery-card" id="' + escapeHtml(item.slug) + '">' +
        '<button class="gallery-main-trigger" type="button" data-gallery-category="' + escapeHtml(item.id) + '" data-gallery-index="0">' +
        '<img class="gallery-thumb" src="' + escapeHtml(thumb) + '" alt="' + escapeHtml(item.heroLabel || item.name) + '" />' +
        '</button>' +
        '<h3>' + escapeHtml(item.heroLabel || item.name) + '</h3>' +
        '<p>' + escapeHtml(item.description || 'Explora este estilo y solicita tu cotización personalizada.') + '</p>' +
        '<div class="gallery-thumb-grid">' +
        images.slice(0, 6).map(function (image, index) {
          return (
            '<button class="gallery-thumb-button" type="button" data-gallery-category="' + escapeHtml(item.id) + '" data-gallery-index="' + String(index) + '">' +
            '<img class="gallery-mini-thumb" src="' + escapeHtml(image.url) + '" alt="' + escapeHtml(image.alt || item.name) + '" />' +
            '</button>'
          );
        }).join('') +
        '</div>' +
        '<a class="btn btn-primary" href="quote.html?cat=' + encodeURIComponent(item.quoteCategory || item.name) + '">Cotizar este estilo</a>' +
        '</article>'
      );
    }).join('');

    grid.onclick = function (e) {
      var target = e.target;
      if (!(target instanceof HTMLElement)) return;
      var trigger = target.closest('[data-gallery-category]');
      if (!(trigger instanceof HTMLElement)) return;

      var categoryId = trigger.getAttribute('data-gallery-category');
      var index = Number(trigger.getAttribute('data-gallery-index') || 0);
      var item = items.find(function (entry) { return entry.id === categoryId; });
      if (!item) return;
      var images = Array.isArray(item.images) && item.images.length ? item.images : [{ url: item.coverImage || 'assets/index-hero.jpg', alt: item.name }];
      openGallery(item.name, images, index);
    };
  }

  function renderPricing(cards) {
    var grid = byId('pricingGrid');
    var paymentsWrap = byId('paymentMethodsWrap');
    var contentService = ContentService;
    if (!grid) return;

    if (!cards.length) {
      setStatus('pricingStatus', 'Todavía no hay planes publicados. Vuelve pronto.');
      grid.innerHTML = '';
      if (paymentsWrap) paymentsWrap.innerHTML = '';
      return;
    }

    setStatus('pricingStatus', '');

    var pricingCardsHtml = cards.map(function (item) {
      var buttonClass = item.highlighted ? 'btn btn-primary' : 'btn btn-outline';
      var quoteHref = item.quoteCategory ? ('quote.html?cat=' + encodeURIComponent(item.quoteCategory)) : 'quote.html';
      var richDescription = contentService && typeof contentService.sanitizePricingDescriptionHtml === 'function'
        ? contentService.sanitizePricingDescriptionHtml(item.description)
        : '';

      return (
        '<article class="card package-card' + (item.highlighted ? ' package-card-featured' : '') + '">' +
        (item.badge ? '<p class="package-badge">' + escapeHtml(item.badge) + '</p>' : '') +
        '<h3>' + escapeHtml(item.title) + '</h3>' +
        '<p class="package-price">' + escapeHtml(item.priceLabel) + '</p>' +
        (richDescription ? '<div class="package-copy rich-content">' + richDescription + '</div>' : '') +
        '<ul class="package-features">' +
        (item.features || []).map(function (feature) {
          return '<li>' + escapeHtml(feature) + '</li>';
        }).join('') +
        '</ul>' +
        '<a class="' + buttonClass + '" href="' + quoteHref + '">' + escapeHtml(item.ctaLabel || 'Cotizar Plan') + '</a>' +
        '</article>'
        );
      }).join('');

    var paymentMethodsHtml =
      '<article class="card package-card package-card-payments">' +
      '<h3>Métodos de Pago</h3>' +
      '<p class="package-price">Opciones disponibles</p>' +
      '<ul class="package-features package-features-payments">' +
      '<li>Tarjeta de Crédito (Visa, MasterCard)</li>' +
      '<li>Tarjeta de Débito</li>' +
      '<li>Cheque @ Ebanisteria CAD LLC</li>' +
      '</ul>' +
      '<a class="btn btn-outline" href="contact.html">Consultar Pago</a>' +
      '</article>';

    grid.innerHTML = pricingCardsHtml;
    if (paymentsWrap) {
      paymentsWrap.innerHTML = '<div class="payment-methods-section">' + paymentMethodsHtml + '</div>';
    }
  }

  function renderRecentProjects(items) {
    var grid = byId('recentProjectsGrid');
    if (!grid) return;

    if (!items.length) {
      setStatus('recentProjectsStatus', 'Todavia no hay proyectos recientes publicados.');
      grid.innerHTML = '';
      return;
    }

    setStatus('recentProjectsStatus', '');

    grid.innerHTML = items.slice(0, 3).map(function (item) {
      var images = Array.isArray(item.images) && item.images.length ? item.images : [{ url: item.coverImage || 'assets/index-hero.jpg', alt: item.title }];
      var thumb = item.coverImage || images[0].url || 'assets/index-hero.jpg';
      return (
        '<article class="card project-card">' +
        '<button class="gallery-main-trigger" type="button" data-recent-project-id="' + escapeHtml(item.id) + '" data-gallery-index="0">' +
        '<img class="project-thumb" src="' + escapeHtml(thumb) + '" alt="' + escapeHtml(item.title) + '" />' +
        '</button>' +
        '<h3>' + escapeHtml(item.title) + '</h3>' +
        '<p>' + escapeHtml(item.description || 'Proyecto reciente publicado desde el panel administrativo.') + '</p>' +
        '</article>'
      );
    }).join('');

    grid.onclick = function (e) {
      var target = e.target;
      if (!(target instanceof HTMLElement)) return;
      var trigger = target.closest('[data-recent-project-id]');
      if (!(trigger instanceof HTMLElement)) return;

      var projectId = trigger.getAttribute('data-recent-project-id');
      var index = Number(trigger.getAttribute('data-gallery-index') || 0);
      var item = items.find(function (entry) { return entry.id === projectId; });
      if (!item) return;
      var images = Array.isArray(item.images) && item.images.length ? item.images : [{ url: item.coverImage || 'assets/index-hero.jpg', alt: item.title }];
      openGallery(item.title, images, index);
    };
  }

  function renderTestimonials(items) {
    var grid = byId('testimonialsGrid');
    var moreBtn = byId('testimonialsMoreBtn');
    if (!grid) return;

    if (!items.length) {
      setStatus('testimonialsStatus', 'Todavia no hay testimonios publicados.');
      grid.innerHTML = '';
      if (moreBtn) {
        moreBtn.hidden = true;
        moreBtn.textContent = 'Ver mas';
      }
      return;
    }

    setStatus('testimonialsStatus', '');
    var visibleItems = testimonialsExpanded ? items : items.slice(0, 3);

    grid.innerHTML = visibleItems.map(function (item) {
      var imageUrl = item.imageUrl || 'assets/index-hero.jpg';
      return (
        '<article class="card testimonial-card testimonial-image-card">' +
        '<button class="gallery-main-trigger" type="button" data-testimonial-id="' + escapeHtml(item.id) + '" data-gallery-index="0">' +
        '<img class="testimonial-image" src="' + escapeHtml(imageUrl) + '" alt="' + escapeHtml(item.title || 'Testimonio') + '" />' +
        '</button>' +
        (item.title ? '<h3>' + escapeHtml(item.title) + '</h3>' : '') +
        '</article>'
      );
    }).join('');

    if (moreBtn) {
      moreBtn.hidden = items.length <= 3;
      moreBtn.textContent = testimonialsExpanded ? 'Ver menos' : 'Ver mas';
      moreBtn.onclick = function () {
        testimonialsExpanded = !testimonialsExpanded;
        renderTestimonials(items);
      };
    }

    grid.onclick = function (e) {
      var target = e.target;
      if (!(target instanceof HTMLElement)) return;
      var trigger = target.closest('[data-testimonial-id]');
      if (!(trigger instanceof HTMLElement)) return;

      var testimonialId = trigger.getAttribute('data-testimonial-id');
      var item = items.find(function (entry) { return entry.id === testimonialId; });
      if (!item) return;
      openGallery(item.title || 'Testimonio', [{ url: item.imageUrl || 'assets/index-hero.jpg', alt: item.title || 'Testimonio' }], 0);
    };
  }

  async function init(attempt) {
    var contentService = ContentService;
    if (!contentService) {
      if ((attempt || 0) < 5) {
        window.setTimeout(function () {
          init((attempt || 0) + 1);
        }, 50);
      }
      return;
    }

    try {
      if (page === 'designs.html') {
        wireGallery();
        setStatus('designsStatus', 'Cargando diseños...');
        renderDesigns(await contentService.getDesignCategories());
      }

      if (page === 'pricing.html') {
        setStatus('pricingStatus', 'Cargando precios...');
        renderPricing(await contentService.getPricingCards());
      }

      if (page === 'index.html' || page === '') {
        wireGallery();
        setStatus('recentProjectsStatus', 'Cargando proyectos recientes...');
        renderRecentProjects(await contentService.getRecentProjects());
        setStatus('testimonialsStatus', 'Cargando testimonios...');
        renderTestimonials(await contentService.getTestimonials());
      }
    } catch (error) {
      console.error('Content page load failed:', error);
      if (page === 'designs.html') {
        setStatus('designsStatus', 'No se pudieron cargar los diseños publicados.');
      }
      if (page === 'pricing.html') {
        setStatus('pricingStatus', 'No se pudieron cargar los precios publicados.');
      }
      if (page === 'index.html' || page === '') {
        setStatus('recentProjectsStatus', 'No se pudieron cargar los proyectos recientes.');
        setStatus('testimonialsStatus', 'No se pudieron cargar los testimonios.');
      }
    }
  }

  init(0);
})();
