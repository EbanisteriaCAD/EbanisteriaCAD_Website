import { ContentService } from './content-service.js';

(function () {

  var state = {
    booted: false,
    designUnsubscribe: null,
    pricingUnsubscribe: null,
    recentProjectsUnsubscribe: null,
    testimonialsUnsubscribe: null,
    settingsUnsubscribe: null,
    designCategories: [],
    pricingCards: [],
    recentProjects: [],
    testimonials: [],
    siteSettings: null,
    editingDesignId: '',
    editingPricingId: '',
    editingRecentProjectId: '',
    editingTestimonialId: '',
    designWorkingImages: [],
    recentProjectWorkingImages: [],
    draggingDesignId: '',
    draggingImageId: '',
    draggingPricingId: ''
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showStatus(id, type, message) {
    var el = byId(id);
    if (!el) return;
    el.className = 'form-status';
    if (!message) {
      el.textContent = '';
      return;
    }
    if (type) el.classList.add(type);
    el.textContent = message;
  }

  function showToast(type, message) {
    var wrap = byId('toastContainer');
    if (!wrap) return;

    var toast = document.createElement('div');
    toast.className = 'admin-toast ' + type;
    toast.textContent = message;
    wrap.appendChild(toast);

    requestAnimationFrame(function () {
      toast.classList.add('show');
    });

    setTimeout(function () {
      toast.classList.remove('show');
      setTimeout(function () {
        toast.remove();
      }, 220);
    }, 3000);
  }

  function getRichEditorHtml(id) {
    var editor = byId(id);
    if (!editor) return '';
    return editor.innerHTML || '';
  }

  function setRichEditorHtml(id, html) {
    var editor = byId(id);
    if (!editor) return;
    editor.innerHTML = html || '';
  }

  function getRichEditorText(id) {
    var editor = byId(id);
    if (!editor) return '';
    return String(editor.textContent || '').trim();
  }

  function renderPricingPreviewText(html) {
    var temp = document.createElement('div');
    temp.innerHTML = ContentService.sanitizePricingDescriptionHtml(html || '');
    return String(temp.textContent || '').trim();
  }

  function renderPreview(containerId, files) {
    var preview = byId(containerId);
    if (!preview) return;

    var list = Array.prototype.slice.call(files || []);
    if (!list.length) {
      preview.hidden = true;
      preview.innerHTML = '';
      return;
    }

    preview.hidden = false;
    preview.innerHTML = list.map(function (file) {
      var url = URL.createObjectURL(file);
      return (
        '<div class="quote-image-preview-item">' +
        '<img src="' + url + '" alt="Vista previa" />' +
        '<span>' + escapeHtml(file.name) + '</span>' +
        '</div>'
      );
    }).join('');
  }

  function toLineList(value) {
    return String(value || '')
      .split(/\r?\n/)
      .map(function (item) { return String(item || '').trim(); })
      .filter(Boolean);
  }

  function setSelectOptions(selectId, items, blankLabel, selectedValue) {
    var select = byId(selectId);
    if (!select) return;

    var normalizedItems = Array.isArray(items) ? items.slice() : [];
    var currentValue = typeof selectedValue === 'string' ? selectedValue : String(select.value || '');
    var options = [];

    if (typeof blankLabel === 'string') {
      options.push('<option value="">' + escapeHtml(blankLabel) + '</option>');
    }

    normalizedItems.forEach(function (item) {
      options.push('<option value="' + escapeHtml(item) + '">' + escapeHtml(item) + '</option>');
    });

    select.innerHTML = options.join('');
    if (normalizedItems.indexOf(currentValue) >= 0 || currentValue === '') {
      select.value = currentValue;
    } else if (normalizedItems.length) {
      select.value = normalizedItems[0];
    }
  }

  function applySiteSettingsToAdmin(settings) {
    state.siteSettings = settings || null;
    window.SiteSettingsState = settings || null;

    if (!settings) return;

    var categories = (settings.quoteForm && settings.quoteForm.categories) || [];
    setSelectOptions('manualQuoteCategory', categories, 'Selecciona una categoría');
    setSelectOptions('designQuoteCategory', categories, 'Selecciona una categoría');
    setSelectOptions('pricingQuoteCategory', categories, 'General');

    var manualHelp = byId('manualQuoteImagesHelp') || document.querySelector('#manualQuoteImages + .field-help');
    if (manualHelp) {
      manualHelp.textContent = 'Puedes subir hasta ' + String(settings.quoteForm.maxImages || 10) + ' fotos para esta cotización manual.';
    }
  }

  function getCurrentDesignItem() {
    return state.designCategories.find(function (item) {
      return item.id === state.editingDesignId;
    }) || null;
  }

  function getExistingCoverIndex() {
    var item = getCurrentDesignItem();
    if (!item || !Array.isArray(state.designWorkingImages) || !state.designWorkingImages.length) {
      return 0;
    }

    var coverIndex = state.designWorkingImages.findIndex(function (image) {
      return image.url === item.coverImage;
    });

    return coverIndex >= 0 ? coverIndex : 0;
  }

  function getSelectedCoverImageId() {
    var coverIndex = Number((byId('designCoverIndex') || {}).value || 0);
    var image = state.designWorkingImages[coverIndex];
    return image ? image.id : '';
  }

  function refreshDesignCoverOptions(filesCount, existingImages, selectedIndex) {
    var select = byId('designCoverIndex');
    if (!select) return;

    var existingCount = Array.isArray(existingImages) ? existingImages.length : 0;
    var total = Number(filesCount || 0) + existingCount;
    var nextSelectedIndex = typeof selectedIndex === 'number' ? selectedIndex : 0;

    select.innerHTML = '';

    if (!total) {
      select.innerHTML = '<option value="0">Primera foto subida</option>';
      return;
    }

    for (var i = 0; i < total; i += 1) {
      var option = document.createElement('option');
      option.value = String(i);
      option.textContent = i < existingCount ? ('Foto actual ' + String(i + 1)) : ('Foto nueva ' + String(i - existingCount + 1));
      select.appendChild(option);
    }

    select.value = String(Math.min(nextSelectedIndex, total - 1));
  }

  function renderExistingImages() {
    var host = byId('designExistingImages');
    if (!host) return;

    if (!state.editingDesignId) {
      host.innerHTML = '<div class="admin-list-empty">Selecciona una categoría existente para administrar sus fotos actuales.</div>';
      return;
    }

    if (!state.designWorkingImages.length) {
      host.innerHTML = '<div class="admin-list-empty">Esta categoría todavía no tiene fotos guardadas.</div>';
      return;
    }

    var selectedCoverIndex = Number((byId('designCoverIndex') || {}).value || 0);

    host.innerHTML = state.designWorkingImages.map(function (image, index) {
      return (
        '<article class="admin-existing-image-item" draggable="true" data-image-id="' + escapeHtml(image.id) + '">' +
        '<img src="' + escapeHtml(image.url) + '" alt="' + escapeHtml(image.alt || 'Imagen de la categoría') + '" />' +
        '<div class="admin-existing-image-actions">' +
        '<button class="btn btn-outline admin-mini' + (selectedCoverIndex === index ? ' active' : '') + '" type="button" data-design-cover="' + String(index) + '">Portada</button>' +
        '<button class="btn btn-outline admin-mini danger" type="button" data-design-remove-image="' + escapeHtml(image.id) + '">Eliminar</button>' +
        '</div>' +
        '</article>'
      );
    }).join('');
  }

  function getDesignFormData() {
    return {
      id: state.editingDesignId || ContentService.slugify((byId('designName') || {}).value || ''),
      name: (byId('designName') || {}).value || '',
      quoteCategory: (byId('designQuoteCategory') || {}).value || '',
      heroLabel: (byId('designHeroLabel') || {}).value || '',
      description: (byId('designDescription') || {}).value || '',
      images: state.designWorkingImages.slice()
    };
  }

  function getPricingFormData() {
    return {
      id: state.editingPricingId || ContentService.slugify((byId('pricingTitle') || {}).value || ''),
      title: (byId('pricingTitle') || {}).value || '',
      priceLabel: (byId('pricingPrice') || {}).value || '',
      badge: (byId('pricingBadge') || {}).value || '',
      description: ContentService.sanitizePricingDescriptionHtml(getRichEditorHtml('pricingDescription')),
      features: (byId('pricingFeatures') || {}).value || '',
      ctaLabel: (byId('pricingCtaLabel') || {}).value || 'Cotizar Plan',
      quoteCategory: (byId('pricingQuoteCategory') || {}).value || '',
      highlighted: !!((byId('pricingHighlighted') || {}).checked),
      sortOrder: Number((byId('pricingSortOrder') || {}).value || 0)
    };
  }

  function setDesignEditorVisible(visible) {
    var form = byId('designCategoryForm');
    var openBtn = byId('openDesignEditorBtn');
    if (form) form.hidden = !visible;
    if (openBtn) openBtn.hidden = !!visible;
  }

  function setPricingEditorVisible(visible) {
    var form = byId('pricingCardForm');
    var openBtn = byId('openPricingEditorBtn');
    if (form) form.hidden = !visible;
    if (openBtn) openBtn.hidden = !!visible;
  }

  function setRecentProjectEditorVisible(visible) {
    var form = byId('recentProjectForm');
    var openBtn = byId('openRecentProjectEditorBtn');
    if (form) form.hidden = !visible;
    if (openBtn) openBtn.hidden = !!visible;
  }

  function setTestimonialEditorVisible(visible) {
    var form = byId('testimonialForm');
    var openBtn = byId('openTestimonialEditorBtn');
    if (form) form.hidden = !visible;
    if (openBtn) openBtn.hidden = !!visible;
  }

  function resetDesignForm() {
    var form = byId('designCategoryForm');
    var imagesInput = byId('designImages');
    if (form) form.reset();
    if (imagesInput) imagesInput.value = '';
    state.editingDesignId = '';
    state.designWorkingImages = [];
    refreshDesignCoverOptions(0, [], 0);
    renderPreview('designImagesPreview', []);
    renderExistingImages();
    showStatus('designFormStatus', '', '');
    setDesignEditorVisible(false);
  }

  function resetPricingForm() {
    var form = byId('pricingCardForm');
    if (form) form.reset();
    setRichEditorHtml('pricingDescription', '');
    if (byId('pricingSortOrder')) {
      byId('pricingSortOrder').value = String(state.pricingCards.length || 0);
    }
    state.editingPricingId = '';
    showStatus('pricingFormStatus', '', '');
    setPricingEditorVisible(false);
  }

  function getCurrentRecentProjectItem() {
    return state.recentProjects.find(function (item) {
      return item.id === state.editingRecentProjectId;
    }) || null;
  }

  function getRecentProjectExistingCoverIndex() {
    var item = getCurrentRecentProjectItem();
    if (!item || !Array.isArray(state.recentProjectWorkingImages) || !state.recentProjectWorkingImages.length) {
      return 0;
    }

    var coverIndex = state.recentProjectWorkingImages.findIndex(function (image) {
      return image.url === item.coverImage;
    });

    return coverIndex >= 0 ? coverIndex : 0;
  }

  function refreshRecentProjectCoverOptions(filesCount, existingImages, selectedIndex) {
    var select = byId('recentProjectCoverIndex');
    if (!select) return;

    var existingCount = Array.isArray(existingImages) ? existingImages.length : 0;
    var total = Number(filesCount || 0) + existingCount;
    var nextSelectedIndex = typeof selectedIndex === 'number' ? selectedIndex : 0;

    select.innerHTML = '';

    if (!total) {
      select.innerHTML = '<option value="0">Primera foto subida</option>';
      return;
    }

    for (var i = 0; i < total; i += 1) {
      var option = document.createElement('option');
      option.value = String(i);
      option.textContent = i < existingCount ? ('Foto actual ' + String(i + 1)) : ('Foto nueva ' + String(i - existingCount + 1));
      select.appendChild(option);
    }

    select.value = String(Math.min(nextSelectedIndex, total - 1));
  }

  function renderRecentProjectExistingImages() {
    var host = byId('recentProjectExistingImages');
    if (!host) return;

    if (!state.editingRecentProjectId) {
      host.innerHTML = '<div class="admin-list-empty">Selecciona un proyecto existente para administrar sus fotos.</div>';
      return;
    }

    if (!state.recentProjectWorkingImages.length) {
      host.innerHTML = '<div class="admin-list-empty">Este proyecto todavia no tiene fotos guardadas.</div>';
      return;
    }

    var selectedCoverIndex = Number((byId('recentProjectCoverIndex') || {}).value || 0);

    host.innerHTML = state.recentProjectWorkingImages.map(function (image, index) {
      return (
        '<article class="admin-existing-image-item" data-recent-project-image-id="' + escapeHtml(image.id) + '">' +
        '<img src="' + escapeHtml(image.url) + '" alt="' + escapeHtml(image.alt || 'Imagen del proyecto') + '" />' +
        '<div class="admin-existing-image-actions">' +
        '<button class="btn btn-outline admin-mini' + (selectedCoverIndex === index ? ' active' : '') + '" type="button" data-recent-project-cover="' + String(index) + '">Portada</button>' +
        '<button class="btn btn-outline admin-mini danger" type="button" data-recent-project-remove-image="' + escapeHtml(image.id) + '">Eliminar</button>' +
        '</div>' +
        '</article>'
      );
    }).join('');
  }

  function resetRecentProjectForm() {
    var form = byId('recentProjectForm');
    var imagesInput = byId('recentProjectImages');
    if (form) form.reset();
    if (imagesInput) imagesInput.value = '';
    state.editingRecentProjectId = '';
    state.recentProjectWorkingImages = [];
    refreshRecentProjectCoverOptions(0, [], 0);
    renderPreview('recentProjectImagesPreview', []);
    renderRecentProjectExistingImages();
    showStatus('recentProjectFormStatus', '', '');
    setRecentProjectEditorVisible(false);
  }

  function resetTestimonialForm() {
    var form = byId('testimonialForm');
    var imageInput = byId('testimonialImage');
    if (form) form.reset();
    if (imageInput) imageInput.value = '';
    state.editingTestimonialId = '';
    renderPreview('testimonialImagePreview', []);
    showStatus('testimonialFormStatus', '', '');
    setTestimonialEditorVisible(false);
  }

  function getRecentProjectFormData() {
    return {
      id: state.editingRecentProjectId || ContentService.slugify((byId('recentProjectTitle') || {}).value || ''),
      title: (byId('recentProjectTitle') || {}).value || '',
      description: (byId('recentProjectDescription') || {}).value || '',
      images: state.recentProjectWorkingImages.slice()
    };
  }

  function getTestimonialFormData() {
    return {
      id: state.editingTestimonialId || ContentService.slugify((byId('testimonialTitle') || {}).value || ''),
      title: (byId('testimonialTitle') || {}).value || ''
    };
  }

  function populateRecentProjectForm(id) {
    var item = state.recentProjects.find(function (entry) { return entry.id === id; });
    if (!item) return;

    state.editingRecentProjectId = item.id;
    state.recentProjectWorkingImages = Array.isArray(item.images) ? item.images.slice() : [];
    byId('recentProjectTitle').value = item.title || '';
    byId('recentProjectDescription').value = item.description || '';
    refreshRecentProjectCoverOptions(0, state.recentProjectWorkingImages, getRecentProjectExistingCoverIndex());
    renderPreview('recentProjectImagesPreview', []);
    renderRecentProjectExistingImages();
    showStatus('recentProjectFormStatus', 'info', 'Editando proyecto reciente. Puedes actualizar portada o eliminar fotos.');
    setRecentProjectEditorVisible(true);
  }

  function populateTestimonialForm(id) {
    var item = state.testimonials.find(function (entry) { return entry.id === id; });
    if (!item) return;

    state.editingTestimonialId = item.id;
    byId('testimonialTitle').value = item.title || '';
    renderPreview('testimonialImagePreview', []);
    showStatus('testimonialFormStatus', 'info', 'Editando testimonio existente. Puedes reemplazar la imagen o actualizar el titulo.');
    setTestimonialEditorVisible(true);
  }

  function renderRecentProjects(items) {
    var host = byId('recentProjectsList');
    if (!host) return;

    if (!items.length) {
      host.innerHTML = '<div class="admin-list-empty">Todavia no hay proyectos recientes publicados.</div>';
      return;
    }

    host.innerHTML = items.map(function (item) {
      var imageCount = Array.isArray(item.images) ? item.images.length : 0;
      return (
        '<article class="admin-content-item">' +
        '<div class="admin-content-item-media">' +
        (item.coverImage
          ? '<img src="' + escapeHtml(item.coverImage) + '" alt="' + escapeHtml(item.title) + '" />'
          : '<div class="admin-content-item-fallback">Sin portada</div>') +
        '</div>' +
        '<div class="admin-content-item-body">' +
        '<div class="admin-content-item-head">' +
        '<div>' +
        '<h4>' + escapeHtml(item.title) + '</h4>' +
        '<p>' + escapeHtml(item.description || 'Sin descripcion') + '</p>' +
        '</div>' +
        '<div class="admin-inline-actions">' +
        '<button class="btn btn-outline admin-mini" type="button" data-recent-project-edit="' + escapeHtml(item.id) + '">Editar</button>' +
        '<button class="btn btn-outline admin-mini danger" type="button" data-recent-project-delete="' + escapeHtml(item.id) + '">Eliminar</button>' +
        '</div>' +
        '</div>' +
        '<div class="admin-chip-row">' +
        '<span class="admin-chip">' + String(imageCount) + ' fotos</span>' +
        '</div>' +
        '</div>' +
        '</article>'
      );
    }).join('');
  }

  function renderTestimonials(items) {
    var host = byId('testimonialsAdminList');
    if (!host) return;

    if (!items.length) {
      host.innerHTML = '<div class="admin-list-empty">Todavia no hay testimonios publicados.</div>';
      return;
    }

    host.innerHTML = items.map(function (item) {
      return (
        '<article class="admin-content-item">' +
        '<div class="admin-content-item-media">' +
        (item.imageUrl
          ? '<img src="' + escapeHtml(item.imageUrl) + '" alt="' + escapeHtml(item.title || 'Testimonio') + '" />'
          : '<div class="admin-content-item-fallback">Sin imagen</div>') +
        '</div>' +
        '<div class="admin-content-item-body">' +
        '<div class="admin-content-item-head">' +
        '<div>' +
        '<h4>' + escapeHtml(item.title || 'Testimonio') + '</h4>' +
        '<p>Imagen tipo review para la homepage.</p>' +
        '</div>' +
        '<div class="admin-inline-actions">' +
        '<button class="btn btn-outline admin-mini" type="button" data-testimonial-edit="' + escapeHtml(item.id) + '">Editar</button>' +
        '<button class="btn btn-outline admin-mini danger" type="button" data-testimonial-delete="' + escapeHtml(item.id) + '">Eliminar</button>' +
        '</div>' +
        '</div>' +
        '</div>' +
        '</article>'
      );
    }).join('');
  }

  function populateDesignForm(id) {
    var item = state.designCategories.find(function (entry) { return entry.id === id; });
    if (!item) return;

    state.editingDesignId = item.id;
    state.designWorkingImages = Array.isArray(item.images) ? item.images.slice() : [];
    byId('designName').value = item.name || '';
    byId('designQuoteCategory').value = item.quoteCategory || '';
    byId('designHeroLabel').value = item.heroLabel || '';
    byId('designDescription').value = item.description || '';
    refreshDesignCoverOptions(0, state.designWorkingImages, getExistingCoverIndex());
    renderPreview('designImagesPreview', []);
    renderExistingImages();
    showStatus('designFormStatus', 'info', 'Editando categoria existente. Puedes cambiar portada o eliminar fotos individuales.');
    setDesignEditorVisible(true);
  }

  function populatePricingForm(id) {
    var item = state.pricingCards.find(function (entry) { return entry.id === id; });
    if (!item) return;

    state.editingPricingId = item.id;
    byId('pricingTitle').value = item.title || '';
    byId('pricingPrice').value = item.priceLabel || '';
    byId('pricingBadge').value = item.badge || '';
    setRichEditorHtml('pricingDescription', item.description || '');
    byId('pricingFeatures').value = (item.features || []).join('\n');
    byId('pricingCtaLabel').value = item.ctaLabel || '';
    byId('pricingQuoteCategory').value = item.quoteCategory || '';
    byId('pricingHighlighted').checked = !!item.highlighted;
    byId('pricingSortOrder').value = String(item.sortOrder || 0);
    showStatus('pricingFormStatus', 'info', 'Editando tarjeta existente. Guardar actualizara el precio publico.');
    setPricingEditorVisible(true);
  }

  function renderDesignCategories(categories) {
    var host = byId('designCategoriesList');
    if (!host) return;

    if (!categories.length) {
      host.innerHTML = '<div class="admin-list-empty">Todavia no hay categorias publicadas.</div>';
      return;
    }

    host.innerHTML = categories.map(function (item) {
      var imageCount = Array.isArray(item.images) ? item.images.length : 0;
      return (
        '<article class="admin-content-item" draggable="true" data-design-id="' + escapeHtml(item.id) + '">' +
        '<div class="admin-content-item-media">' +
        (item.coverImage
          ? '<img src="' + escapeHtml(item.coverImage) + '" alt="' + escapeHtml(item.name) + '" />'
          : '<div class="admin-content-item-fallback">Sin portada</div>') +
        '</div>' +
        '<div class="admin-content-item-body">' +
        '<div class="admin-content-item-head">' +
        '<div>' +
        '<h4>' + escapeHtml(item.name) + '</h4>' +
        '<p>' + escapeHtml(item.description || 'Sin descripcion') + '</p>' +
        '</div>' +
        '<div class="admin-inline-actions">' +
        '<button class="btn btn-outline admin-mini" type="button" data-design-edit="' + escapeHtml(item.id) + '">Editar</button>' +
        '<button class="btn btn-outline admin-mini danger" type="button" data-design-delete="' + escapeHtml(item.id) + '">Eliminar</button>' +
        '</div>' +
        '</div>' +
        '<div class="admin-chip-row">' +
        '<span class="admin-chip">Cotiza: ' + escapeHtml(item.quoteCategory || 'General') + '</span>' +
        '<span class="admin-chip">' + String(imageCount) + ' fotos</span>' +
        '</div>' +
        '</div>' +
        '</article>'
      );
    }).join('');
  }

  function reorderItems(items, draggedId, targetId) {
    var list = Array.isArray(items) ? items.slice() : [];
    if (!draggedId || !targetId || draggedId === targetId) return list;

    var fromIndex = list.findIndex(function (item) { return item.id === draggedId; });
    var toIndex = list.findIndex(function (item) { return item.id === targetId; });
    if (fromIndex < 0 || toIndex < 0) return list;

    var moved = list.splice(fromIndex, 1)[0];
    list.splice(toIndex, 0, moved);
    return list;
  }

  function renderPricingCards(cards) {
    var host = byId('pricingCardsList');
    if (!host) return;

    if (!cards.length) {
      host.innerHTML = '<div class="admin-list-empty">Todavia no hay tarjetas de precio activas.</div>';
      return;
    }

    host.innerHTML = cards.map(function (item) {
      return (
        '<article class="admin-content-item admin-price-item" draggable="true" data-pricing-id="' + escapeHtml(item.id) + '">' +
        '<div class="admin-content-item-body">' +
        '<div class="admin-content-item-head">' +
        '<div>' +
        '<h4>' + escapeHtml(item.title) + '</h4>' +
        '<p>' + escapeHtml(renderPricingPreviewText(item.description || item.priceLabel) || item.priceLabel) + '</p>' +
        '</div>' +
        '<div class="admin-inline-actions">' +
        '<button class="btn btn-outline admin-mini" type="button" data-pricing-edit="' + escapeHtml(item.id) + '">Editar</button>' +
        '<button class="btn btn-outline admin-mini danger" type="button" data-pricing-delete="' + escapeHtml(item.id) + '">Eliminar</button>' +
        '</div>' +
        '</div>' +
        '<div class="admin-price-meta">' +
        '<strong>' + escapeHtml(item.priceLabel) + '</strong>' +
        (item.badge ? '<span class="admin-chip highlighted">' + escapeHtml(item.badge) + '</span>' : '') +
        (item.highlighted ? '<span class="admin-chip">Destacada</span>' : '') +
        '</div>' +
        '<ul class="admin-feature-list">' +
        (item.features || []).map(function (feature) {
          return '<li>' + escapeHtml(feature) + '</li>';
        }).join('') +
        '</ul>' +
        '</div>' +
        '</article>'
      );
    }).join('');
  }

  function wireDesignForm() {
    var form = byId('designCategoryForm');
    var imagesInput = byId('designImages');
    var coverSelect = byId('designCoverIndex');
    var existingImagesHost = byId('designExistingImages');
    var resetBtn = byId('designResetBtn');
    var openBtn = byId('openDesignEditorBtn');
    if (!form || !imagesInput || !coverSelect || !existingImagesHost) return;

    if (openBtn) {
      openBtn.addEventListener('click', function () {
        state.editingDesignId = '';
        state.designWorkingImages = [];
        if (form) form.reset();
        if (imagesInput) imagesInput.value = '';
        refreshDesignCoverOptions(0, [], 0);
        renderPreview('designImagesPreview', []);
        renderExistingImages();
        showStatus('designFormStatus', '', '');
        setDesignEditorVisible(true);
      });
    }

    imagesInput.addEventListener('change', function () {
      refreshDesignCoverOptions(imagesInput.files.length, state.designWorkingImages, Number(coverSelect.value || 0));
      renderPreview('designImagesPreview', imagesInput.files);
    });

    coverSelect.addEventListener('change', function () {
      renderExistingImages();
    });

    existingImagesHost.addEventListener('click', async function (e) {
      var target = e.target;
      if (!(target instanceof HTMLElement)) return;

      var coverIndex = target.getAttribute('data-design-cover');
      var removeId = target.getAttribute('data-design-remove-image');

      if (coverIndex !== null && coverIndex !== '') {
        coverSelect.value = coverIndex;
        renderExistingImages();
        return;
      }

      if (removeId) {
        state.designWorkingImages = state.designWorkingImages.filter(function (image) {
          return image.id !== removeId;
        });
        refreshDesignCoverOptions(imagesInput.files.length, state.designWorkingImages, 0);
        renderExistingImages();

        if (state.editingDesignId) {
          try {
            await ContentService.updateDesignCategoryImages(
              state.editingDesignId,
              state.designWorkingImages,
              Number(coverSelect.value || 0)
            );
            showToast('info', 'Foto eliminada de la categoria.');
          } catch (error) {
            console.error('Image removal failed:', error);
            showStatus('designFormStatus', 'error', 'No se pudo eliminar la foto existente.');
          }
        }
      }
    });

    existingImagesHost.addEventListener('dragstart', function (e) {
      var target = e.target;
      if (!(target instanceof HTMLElement)) return;
      var item = target.closest('[data-image-id]');
      if (!(item instanceof HTMLElement)) return;
      state.draggingImageId = item.getAttribute('data-image-id') || '';
      item.classList.add('is-dragging');
    });

    existingImagesHost.addEventListener('dragend', function (e) {
      var target = e.target;
      if (target instanceof HTMLElement) {
        target.classList.remove('is-dragging');
      }
      state.draggingImageId = '';
    });

    existingImagesHost.addEventListener('dragover', function (e) {
      e.preventDefault();
    });

    existingImagesHost.addEventListener('drop', async function (e) {
      e.preventDefault();
      var target = e.target;
      if (!(target instanceof HTMLElement)) return;
      var item = target.closest('[data-image-id]');
      if (!(item instanceof HTMLElement)) return;

      var targetId = item.getAttribute('data-image-id') || '';
      if (!state.draggingImageId || !targetId || state.draggingImageId === targetId) return;

      var selectedCoverImageId = getSelectedCoverImageId();
      state.designWorkingImages = reorderItems(state.designWorkingImages, state.draggingImageId, targetId);
      var nextCoverIndex = state.designWorkingImages.findIndex(function (image) {
        return image.id === selectedCoverImageId;
      });
      nextCoverIndex = nextCoverIndex >= 0 ? nextCoverIndex : 0;
      refreshDesignCoverOptions(imagesInput.files.length, state.designWorkingImages, nextCoverIndex);
      renderExistingImages();

      if (state.editingDesignId) {
        try {
          await ContentService.updateDesignCategoryImages(state.editingDesignId, state.designWorkingImages, nextCoverIndex);
          showToast('success', 'Orden de fotos actualizado.');
        } catch (error) {
          console.error('Image reorder failed:', error);
          showStatus('designFormStatus', 'error', 'No se pudo actualizar el orden de las fotos.');
        }
      }
    });

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        resetDesignForm();
      });
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      showStatus('designFormStatus', '', '');

      try {
        var payload = getDesignFormData();
        var files = imagesInput.files || [];
        var selectedCoverIndex = Number(coverSelect.value || 0);
        await ContentService.saveDesignCategory(payload, files, selectedCoverIndex);
        showStatus('designFormStatus', 'success', 'Categoria guardada correctamente.');
        showToast('success', 'La galeria publica se actualizo.');
        resetDesignForm();
      } catch (error) {
        console.error('Design save failed:', error);
        showStatus('designFormStatus', 'error', 'No se pudo guardar la categoria. Revisa Storage y Firestore.');
      }
    });
  }

  function wirePricingForm() {
    var form = byId('pricingCardForm');
    var editor = byId('pricingDescription');
    var imageInput = byId('pricingDescriptionImageInput');
    var resetBtn = byId('pricingResetBtn');
    var openBtn = byId('openPricingEditorBtn');
    if (!form || !editor) return;

    if (openBtn) {
      openBtn.addEventListener('click', function () {
        if (form) form.reset();
        setRichEditorHtml('pricingDescription', '');
        if (byId('pricingSortOrder')) {
          byId('pricingSortOrder').value = String(state.pricingCards.length || 0);
        }
        state.editingPricingId = '';
        showStatus('pricingFormStatus', '', '');
        setPricingEditorVisible(true);
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        resetPricingForm();
      });
    }

    document.querySelectorAll('button[data-rich-target="pricingDescription"]').forEach(function (button) {
      button.addEventListener('click', async function () {
        var command = button.getAttribute('data-rich-command');
        var action = button.getAttribute('data-rich-action');
        editor.focus();

        if (command) {
          document.execCommand(command, false, null);
          return;
        }

        if (action === 'clear') {
          document.execCommand('removeFormat', false, null);
          return;
        }

        if (action === 'quote') {
          document.execCommand('formatBlock', false, 'blockquote');
          return;
        }

        if (action === 'link') {
          var href = window.prompt('Pega el enlace que quieres insertar:', 'https://');
          if (!href) return;
          document.execCommand('createLink', false, href);
          return;
        }

        if (action === 'image' && imageInput) {
          imageInput.click();
        }
      });
    });

    document.querySelectorAll('select[data-rich-target="pricingDescription"]').forEach(function (select) {
      select.addEventListener('change', function () {
        var action = select.getAttribute('data-rich-action');
        editor.focus();

        if (action === 'formatBlock') {
          document.execCommand('formatBlock', false, select.value || 'P');
        }
      });
    });

    if (imageInput) {
      imageInput.addEventListener('change', async function () {
        var file = imageInput.files && imageInput.files[0];
        if (!file) return;

        try {
          var cardId = state.editingPricingId || ContentService.slugify((byId('pricingTitle') || {}).value || '') || 'pricing-card';
          var uploaded = await ContentService.uploadPricingDescriptionImage(cardId, file);
          editor.focus();
          document.execCommand(
            'insertHTML',
            false,
            '<p><img src="' + escapeHtml(uploaded.url) + '" data-storage-path="' + escapeHtml(uploaded.path) + '" alt="' + escapeHtml(file.name) + '" /></p>'
          );
          showToast('success', 'Imagen agregada a la descripcion.');
        } catch (error) {
          console.error('Pricing description image upload failed:', error);
          showStatus('pricingFormStatus', 'error', 'No se pudo subir la imagen para la descripcion.');
        } finally {
          imageInput.value = '';
        }
      });
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      showStatus('pricingFormStatus', '', '');

      if (!getRichEditorText('pricingDescription') && !getRichEditorHtml('pricingDescription').match(/<img/i)) {
        showStatus('pricingFormStatus', 'error', 'La descripcion enriquecida no puede estar vacia.');
        return;
      }

      try {
        await ContentService.savePricingCard(getPricingFormData());
        showStatus('pricingFormStatus', 'success', 'Tarjeta de precio guardada correctamente.');
        showToast('success', 'La pagina publica de precios se actualizo.');
        resetPricingForm();
      } catch (error) {
        console.error('Pricing save failed:', error);
        showStatus('pricingFormStatus', 'error', 'No se pudo guardar la tarjeta de precio.');
      }
    });
  }

  function wireRecentProjectForm() {
    var form = byId('recentProjectForm');
    var imagesInput = byId('recentProjectImages');
    var coverSelect = byId('recentProjectCoverIndex');
    var existingImagesHost = byId('recentProjectExistingImages');
    var resetBtn = byId('recentProjectResetBtn');
    var openBtn = byId('openRecentProjectEditorBtn');
    if (!form || !imagesInput || !coverSelect || !existingImagesHost) return;

    if (openBtn) {
      openBtn.addEventListener('click', function () {
        if (state.recentProjects.length >= 3 && !state.editingRecentProjectId) {
          showToast('info', 'Ya tienes 3 proyectos recientes publicados. Edita uno existente para reemplazarlo.');
          return;
        }
        resetRecentProjectForm();
        setRecentProjectEditorVisible(true);
      });
    }

    imagesInput.addEventListener('change', function () {
      refreshRecentProjectCoverOptions(imagesInput.files.length, state.recentProjectWorkingImages, Number(coverSelect.value || 0));
      renderPreview('recentProjectImagesPreview', imagesInput.files);
    });

    coverSelect.addEventListener('change', function () {
      renderRecentProjectExistingImages();
    });

    existingImagesHost.addEventListener('click', async function (e) {
      var target = e.target;
      if (!(target instanceof HTMLElement)) return;

      var coverIndex = target.getAttribute('data-recent-project-cover');
      var removeId = target.getAttribute('data-recent-project-remove-image');

      if (coverIndex !== null && coverIndex !== '') {
        coverSelect.value = coverIndex;
        renderRecentProjectExistingImages();
        return;
      }

      if (removeId) {
        state.recentProjectWorkingImages = state.recentProjectWorkingImages.filter(function (image) {
          return image.id !== removeId;
        });
        refreshRecentProjectCoverOptions(imagesInput.files.length, state.recentProjectWorkingImages, 0);
        renderRecentProjectExistingImages();

        if (state.editingRecentProjectId) {
          try {
            await ContentService.updateRecentProjectImages(
              state.editingRecentProjectId,
              state.recentProjectWorkingImages,
              Number(coverSelect.value || 0)
            );
            showToast('info', 'Foto eliminada del proyecto.');
          } catch (error) {
            console.error('Recent project image removal failed:', error);
            showStatus('recentProjectFormStatus', 'error', 'No se pudo eliminar la foto existente.');
          }
        }
      }
    });

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        resetRecentProjectForm();
      });
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      showStatus('recentProjectFormStatus', '', '');

      try {
        var payload = getRecentProjectFormData();
        var files = imagesInput.files || [];
        var selectedCoverIndex = Number(coverSelect.value || 0);
        await ContentService.saveRecentProject(payload, files, selectedCoverIndex);
        showStatus('recentProjectFormStatus', 'success', 'Proyecto reciente guardado correctamente.');
        showToast('success', 'La homepage se actualizo con el proyecto reciente.');
        resetRecentProjectForm();
      } catch (error) {
        console.error('Recent project save failed:', error);
        showStatus('recentProjectFormStatus', 'error', error && error.message ? error.message : 'No se pudo guardar el proyecto reciente.');
      }
    });
  }

  function wireTestimonialForm() {
    var form = byId('testimonialForm');
    var imageInput = byId('testimonialImage');
    var resetBtn = byId('testimonialResetBtn');
    var openBtn = byId('openTestimonialEditorBtn');
    if (!form || !imageInput) return;

    if (openBtn) {
      openBtn.addEventListener('click', function () {
        resetTestimonialForm();
        setTestimonialEditorVisible(true);
      });
    }

    imageInput.addEventListener('change', function () {
      renderPreview('testimonialImagePreview', imageInput.files);
    });

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        resetTestimonialForm();
      });
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      showStatus('testimonialFormStatus', '', '');

      try {
        var payload = getTestimonialFormData();
        var file = imageInput.files && imageInput.files[0] ? imageInput.files[0] : null;
        await ContentService.saveTestimonial(payload, file);
        showStatus('testimonialFormStatus', 'success', 'Testimonio guardado correctamente.');
        showToast('success', 'La homepage se actualizo con el testimonio.');
        resetTestimonialForm();
      } catch (error) {
        console.error('Testimonial save failed:', error);
        showStatus('testimonialFormStatus', 'error', error && error.message ? error.message : 'No se pudo guardar el testimonio.');
      }
    });
  }

  function populateSettingsForm(settings) {
    if (!settings) return;

    byId('settingsBusinessName') && (byId('settingsBusinessName').value = settings.business.name || '');
    byId('settingsLogoUrl') && (byId('settingsLogoUrl').value = settings.business.logoUrl || '');
    byId('settingsFooterCopyright') && (byId('settingsFooterCopyright').value = settings.business.footerCopyright || '');

    byId('settingsPhoneDisplay') && (byId('settingsPhoneDisplay').value = settings.contact.phoneDisplay || '');
    byId('settingsPhoneE164') && (byId('settingsPhoneE164').value = settings.contact.phoneE164 || '');
    byId('settingsWhatsappNumber') && (byId('settingsWhatsappNumber').value = settings.contact.whatsappNumber || '');
    byId('settingsEmail') && (byId('settingsEmail').value = settings.contact.email || '');
    byId('settingsAddress') && (byId('settingsAddress').value = settings.contact.address || '');
    byId('settingsMapsLink') && (byId('settingsMapsLink').value = settings.contact.mapsLink || '');
    byId('settingsMapsEmbedQuery') && (byId('settingsMapsEmbedQuery').value = settings.contact.mapsEmbedQuery || '');
    byId('settingsServiceArea') && (byId('settingsServiceArea').value = settings.contact.serviceArea || '');
    byId('settingsHoursWeekdays') && (byId('settingsHoursWeekdays').value = settings.contact.hoursWeekdays || '');
    byId('settingsHoursWeekends') && (byId('settingsHoursWeekends').value = settings.contact.hoursWeekends || '');

    byId('settingsFacebookUrl') && (byId('settingsFacebookUrl').value = settings.social.facebookUrl || '');
    byId('settingsInstagramUrl') && (byId('settingsInstagramUrl').value = settings.social.instagramUrl || '');
    byId('settingsTiktokUrl') && (byId('settingsTiktokUrl').value = settings.social.tiktokUrl || '');

    byId('settingsShowRecentProjects') && (byId('settingsShowRecentProjects').checked = !!settings.homepage.showRecentProjects);
    byId('settingsShowTestimonials') && (byId('settingsShowTestimonials').checked = !!settings.homepage.showTestimonials);

    byId('settingsQuoteMaxImages') && (byId('settingsQuoteMaxImages').value = String(settings.quoteForm.maxImages || 10));
    byId('settingsQuoteCategories') && (byId('settingsQuoteCategories').value = (settings.quoteForm.categories || []).join('\n'));

    byId('settingsAllowedAdminEmails') && (byId('settingsAllowedAdminEmails').value = (settings.admin.allowedAdminEmails || []).join('\n'));

    byId('settingsMaintenanceMode') && (byId('settingsMaintenanceMode').checked = !!settings.operations.maintenanceMode);
    byId('settingsNotificationsEnabled') && (byId('settingsNotificationsEnabled').checked = !!settings.operations.notificationsEnabled);
    byId('settingsMaintenanceMessage') && (byId('settingsMaintenanceMessage').value = settings.operations.maintenanceMessage || '');
  }

  function getSettingsFormData() {
    return {
      business: {
        name: (byId('settingsBusinessName') || {}).value || '',
        logoUrl: (byId('settingsLogoUrl') || {}).value || '',
        footerCopyright: (byId('settingsFooterCopyright') || {}).value || ''
      },
      contact: {
        phoneDisplay: (byId('settingsPhoneDisplay') || {}).value || '',
        phoneE164: (byId('settingsPhoneE164') || {}).value || '',
        whatsappNumber: (byId('settingsWhatsappNumber') || {}).value || '',
        email: (byId('settingsEmail') || {}).value || '',
        address: (byId('settingsAddress') || {}).value || '',
        mapsLink: (byId('settingsMapsLink') || {}).value || '',
        mapsEmbedQuery: (byId('settingsMapsEmbedQuery') || {}).value || '',
        serviceArea: (byId('settingsServiceArea') || {}).value || '',
        hoursWeekdays: (byId('settingsHoursWeekdays') || {}).value || '',
        hoursWeekends: (byId('settingsHoursWeekends') || {}).value || ''
      },
      social: {
        facebookUrl: (byId('settingsFacebookUrl') || {}).value || '',
        instagramUrl: (byId('settingsInstagramUrl') || {}).value || '',
        tiktokUrl: (byId('settingsTiktokUrl') || {}).value || ''
      },
      homepage: {
        showRecentProjects: !!((byId('settingsShowRecentProjects') || {}).checked),
        showTestimonials: !!((byId('settingsShowTestimonials') || {}).checked)
      },
      quoteForm: {
        maxImages: Number((byId('settingsQuoteMaxImages') || {}).value || 10),
        categories: toLineList((byId('settingsQuoteCategories') || {}).value || '')
      },
      admin: {
        allowedAdminEmails: toLineList((byId('settingsAllowedAdminEmails') || {}).value || '')
      },
      operations: {
        maintenanceMode: !!((byId('settingsMaintenanceMode') || {}).checked),
        notificationsEnabled: !!((byId('settingsNotificationsEnabled') || {}).checked),
        maintenanceMessage: (byId('settingsMaintenanceMessage') || {}).value || ''
      }
    };
  }

  function wireSettingsForm() {
    var form = byId('siteSettingsForm');
    var resetBtn = byId('settingsResetBtn');
    var exportBtn = byId('settingsExportBtn');
    if (!form) return;

    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        if (state.siteSettings) {
          populateSettingsForm(state.siteSettings);
          showStatus('settingsFormStatus', 'info', 'Formulario restablecido a los valores guardados.');
        }
      });
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        var settings = ContentService.normalizeSiteSettings(getSettingsFormData());
        var blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url;
        link.download = 'site-settings.json';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 500);
      });
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      showStatus('settingsFormStatus', '', '');

      try {
        var next = await ContentService.saveSiteSettings(getSettingsFormData());
        applySiteSettingsToAdmin(next);
        populateSettingsForm(next);
        showStatus('settingsFormStatus', 'success', 'Ajustes guardados correctamente.');
        showToast('success', 'La configuración central del sitio fue actualizada.');
      } catch (error) {
        console.error('Settings save failed:', error);
        showStatus('settingsFormStatus', 'error', 'No se pudieron guardar los ajustes.');
      }
    });
  }

  function wireLists() {
    var designsHost = byId('designCategoriesList');
    var pricingHost = byId('pricingCardsList');
    var recentProjectsHost = byId('recentProjectsList');
    var testimonialsHost = byId('testimonialsAdminList');

    if (designsHost) {
      designsHost.addEventListener('dragstart', function (e) {
        var target = e.target;
        if (!(target instanceof HTMLElement)) return;
        var item = target.closest('[data-design-id]');
        if (!(item instanceof HTMLElement)) return;
        state.draggingDesignId = item.getAttribute('data-design-id') || '';
        item.classList.add('is-dragging');
      });

      designsHost.addEventListener('dragend', function (e) {
        var target = e.target;
        if (target instanceof HTMLElement) {
          target.classList.remove('is-dragging');
        }
        state.draggingDesignId = '';
      });

      designsHost.addEventListener('dragover', function (e) {
        e.preventDefault();
      });

      designsHost.addEventListener('drop', async function (e) {
        e.preventDefault();
        var target = e.target;
        if (!(target instanceof HTMLElement)) return;
        var item = target.closest('[data-design-id]');
        if (!(item instanceof HTMLElement)) return;

        var targetId = item.getAttribute('data-design-id') || '';
        if (!state.draggingDesignId || !targetId || state.draggingDesignId === targetId) return;

        state.designCategories = reorderItems(state.designCategories, state.draggingDesignId, targetId);
        renderDesignCategories(state.designCategories);

        try {
          await ContentService.updateDesignCategoryOrder(state.designCategories);
          showToast('success', 'Orden de categorías actualizado.');
        } catch (error) {
          console.error('Category reorder failed:', error);
          showStatus('designFormStatus', 'error', 'No se pudo actualizar el orden de las categorías.');
        }
      });

      designsHost.addEventListener('click', async function (e) {
        var target = e.target;
        if (!(target instanceof HTMLElement)) return;

        var editId = target.getAttribute('data-design-edit');
        var deleteId = target.getAttribute('data-design-delete');

        if (editId) {
          populateDesignForm(editId);
          return;
        }

        if (deleteId) {
          if (!window.confirm('Eliminar esta categoria de la galeria publica?')) return;
          try {
            await ContentService.deleteDesignCategory(deleteId);
            showToast('info', 'Categoria eliminada.');
            if (state.editingDesignId === deleteId) resetDesignForm();
          } catch (error) {
            console.error('Category delete failed:', error);
            showStatus('designFormStatus', 'error', 'No se pudo eliminar la categoria ni limpiar sus fotos.');
          }
        }
      });
    }

    if (pricingHost) {
      pricingHost.addEventListener('dragstart', function (e) {
        var target = e.target;
        if (!(target instanceof HTMLElement)) return;
        var item = target.closest('[data-pricing-id]');
        if (!(item instanceof HTMLElement)) return;
        state.draggingPricingId = item.getAttribute('data-pricing-id') || '';
        item.classList.add('is-dragging');
      });

      pricingHost.addEventListener('dragend', function (e) {
        var target = e.target;
        if (target instanceof HTMLElement) {
          target.classList.remove('is-dragging');
        }
        state.draggingPricingId = '';
      });

      pricingHost.addEventListener('dragover', function (e) {
        e.preventDefault();
      });

      pricingHost.addEventListener('drop', async function (e) {
        e.preventDefault();
        var target = e.target;
        if (!(target instanceof HTMLElement)) return;
        var item = target.closest('[data-pricing-id]');
        if (!(item instanceof HTMLElement)) return;

        var targetId = item.getAttribute('data-pricing-id') || '';
        if (!state.draggingPricingId || !targetId || state.draggingPricingId === targetId) return;

        state.pricingCards = reorderItems(state.pricingCards, state.draggingPricingId, targetId);
        renderPricingCards(state.pricingCards);

        try {
          await ContentService.updatePricingCardOrder(state.pricingCards);
          showToast('success', 'Orden de tarjetas actualizado.');
        } catch (error) {
          console.error('Pricing reorder failed:', error);
          showStatus('pricingFormStatus', 'error', 'No se pudo actualizar el orden de las tarjetas.');
        }
      });

      pricingHost.addEventListener('click', async function (e) {
        var target = e.target;
        if (!(target instanceof HTMLElement)) return;

        var editId = target.getAttribute('data-pricing-edit');
        var deleteId = target.getAttribute('data-pricing-delete');

        if (editId) {
          populatePricingForm(editId);
          return;
        }

        if (deleteId) {
          if (!window.confirm('Eliminar esta tarjeta de precio publica?')) return;
          try {
            await ContentService.deletePricingCard(deleteId);
            showToast('info', 'Tarjeta eliminada.');
            if (state.editingPricingId === deleteId) resetPricingForm();
          } catch (error) {
            console.error('Pricing delete failed:', error);
            showStatus('pricingFormStatus', 'error', 'No se pudo eliminar la tarjeta.');
          }
        }
      });
    }

    if (recentProjectsHost) {
      recentProjectsHost.addEventListener('click', async function (e) {
        var target = e.target;
        if (!(target instanceof HTMLElement)) return;

        var editId = target.getAttribute('data-recent-project-edit');
        var deleteId = target.getAttribute('data-recent-project-delete');

        if (editId) {
          populateRecentProjectForm(editId);
          return;
        }

        if (deleteId) {
          if (!window.confirm('Eliminar este proyecto reciente de la homepage?')) return;
          try {
            await ContentService.deleteRecentProject(deleteId);
            showToast('info', 'Proyecto reciente eliminado.');
            if (state.editingRecentProjectId === deleteId) resetRecentProjectForm();
          } catch (error) {
            console.error('Recent project delete failed:', error);
            showStatus('recentProjectFormStatus', 'error', 'No se pudo eliminar el proyecto reciente.');
          }
        }
      });
    }

    if (testimonialsHost) {
      testimonialsHost.addEventListener('click', async function (e) {
        var target = e.target;
        if (!(target instanceof HTMLElement)) return;

        var editId = target.getAttribute('data-testimonial-edit');
        var deleteId = target.getAttribute('data-testimonial-delete');

        if (editId) {
          populateTestimonialForm(editId);
          return;
        }

        if (deleteId) {
          if (!window.confirm('Eliminar este testimonio de la homepage?')) return;
          try {
            await ContentService.deleteTestimonial(deleteId);
            showToast('info', 'Testimonio eliminado.');
            if (state.editingTestimonialId === deleteId) resetTestimonialForm();
          } catch (error) {
            console.error('Testimonial delete failed:', error);
            showStatus('testimonialFormStatus', 'error', 'No se pudo eliminar el testimonio.');
          }
        }
      });
    }
  }

  function stopSubscriptions() {
    if (typeof state.designUnsubscribe === 'function') state.designUnsubscribe();
    if (typeof state.pricingUnsubscribe === 'function') state.pricingUnsubscribe();
    if (typeof state.recentProjectsUnsubscribe === 'function') state.recentProjectsUnsubscribe();
    if (typeof state.testimonialsUnsubscribe === 'function') state.testimonialsUnsubscribe();
    if (typeof state.settingsUnsubscribe === 'function') state.settingsUnsubscribe();
    state.designUnsubscribe = null;
    state.pricingUnsubscribe = null;
    state.recentProjectsUnsubscribe = null;
    state.testimonialsUnsubscribe = null;
    state.settingsUnsubscribe = null;
  }

  function startSubscriptions() {
    stopSubscriptions();

    state.designUnsubscribe = ContentService.subscribeDesignCategories(function (categories) {
      state.designCategories = categories;
      renderDesignCategories(categories);
      if (state.editingDesignId) {
        populateDesignForm(state.editingDesignId);
      }
    }, function (error) {
      console.error('Design subscription failed:', error);
    });

    state.pricingUnsubscribe = ContentService.subscribePricingCards(function (cards) {
      state.pricingCards = cards;
      renderPricingCards(cards);
      if (state.editingPricingId) {
        populatePricingForm(state.editingPricingId);
      } else if (byId('pricingSortOrder')) {
        byId('pricingSortOrder').value = String(cards.length || 0);
      }
    }, function (error) {
      console.error('Pricing subscription failed:', error);
    });

    state.recentProjectsUnsubscribe = ContentService.subscribeRecentProjects(function (items) {
      state.recentProjects = items;
      renderRecentProjects(items);
      if (state.editingRecentProjectId) {
        populateRecentProjectForm(state.editingRecentProjectId);
      }
    }, function (error) {
      console.error('Recent projects subscription failed:', error);
    });

    state.testimonialsUnsubscribe = ContentService.subscribeTestimonials(function (items) {
      state.testimonials = items;
      renderTestimonials(items);
      if (state.editingTestimonialId) {
        populateTestimonialForm(state.editingTestimonialId);
      }
    }, function (error) {
      console.error('Testimonials subscription failed:', error);
    });

    state.settingsUnsubscribe = ContentService.subscribeSiteSettings(function (settings) {
      state.siteSettings = settings;
      applySiteSettingsToAdmin(settings);
      populateSettingsForm(settings);
    }, function (error) {
      console.error('Site settings subscription failed:', error);
    });
  }

  function boot() {
    if (state.booted || !ContentService) return;
    wireDesignForm();
    wirePricingForm();
    wireRecentProjectForm();
    wireTestimonialForm();
    wireSettingsForm();
    wireLists();
    renderExistingImages();
    renderRecentProjectExistingImages();
    setDesignEditorVisible(false);
    setPricingEditorVisible(false);
    setRecentProjectEditorVisible(false);
    setTestimonialEditorVisible(false);
    state.booted = true;
  }

  function watchAuthAndLoadContent() {
    if (!window.firebase || !window.firebase.auth) return;

    window.firebase.auth().onAuthStateChanged(function (user) {
      if (!user) {
        stopSubscriptions();
        return;
      }

      boot();
      startSubscriptions();
    });
  }

  watchAuthAndLoadContent();
})();
