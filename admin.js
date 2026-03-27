(function () {
  var SIDEBAR_OPEN_CLASS = 'admin-sidebar-open';
  var QuoteService = window.QuoteService;
  var FirebaseAdminAuth = window.FirebaseAdminAuth;

  var STATUS_META = {
    new: { label: 'Nuevo', css: 'status-nuevo' },
    in_progress: { label: 'En Proceso', css: 'status-en-proceso' },
    completed: { label: 'Completado', css: 'status-completado' }
  };

  var state = {
    search: '',
    statusFilter: 'Todos',
    loading: false,
    authReady: false,
    currentUser: null,
    clockTimer: null,
    uiReady: false,
    quotes: [],
    quotesUnsubscribe: null
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function formatDate(iso) {
    var d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '-';

    return d.toLocaleString('es-PR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function normalize(value) {
    return String(value || '').toLowerCase();
  }

  function filterValueToStatus(filter) {
    if (filter === 'Nuevo') return 'new';
    if (filter === 'En Proceso') return 'in_progress';
    if (filter === 'Completado') return 'completed';
    return 'all';
  }

  function getFilteredQuotes() {
    var q = normalize(state.search);
    var statusFilter = filterValueToStatus(state.statusFilter);

    return state.quotes.filter(function (item) {
      var statusOk = statusFilter === 'all' || item.status === statusFilter;
      if (!statusOk) return false;

      if (!q) return true;

      return [item.name, item.email, item.category, item.phone, item.id, item.address, item.addressLine, item.city, item.stateRegion, item.postalCode]
        .some(function (v) {
          return normalize(v).indexOf(q) !== -1;
        });
    });
  }

  function calcStats() {
    var statTotal = byId('statTotal');
    var statWeek = byId('statWeek');
    var statPending = byId('statPending');
    var statDone = byId('statDone');
    if (!statTotal || !statWeek || !statPending || !statDone) return;

    var quotes = state.quotes.slice();
    var total = quotes.length;
    var pending = quotes.filter(function (r) { return r.status === 'new'; }).length;
    var done = quotes.filter(function (r) { return r.status === 'completed'; }).length;

    var now = new Date();
    var weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);

    var week = quotes.filter(function (r) {
      var d = new Date(r.createdAt);
      return !Number.isNaN(d.getTime()) && d >= weekAgo && d <= now;
    }).length;

    statTotal.textContent = String(total);
    statWeek.textContent = String(week);
    statPending.textContent = String(pending);
    statDone.textContent = String(done);
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function rowActions(id, status) {
    var disableProcess = status === 'in_progress';
    var disableDone = status === 'completed';

    return (
      '<div class="admin-actions-cell">' +
      '<button class="btn btn-outline admin-mini" data-action="view" data-id="' + id + '">Ver</button>' +
      '<button class="btn btn-outline admin-mini" data-action="process" data-id="' + id + '"' + (disableProcess ? ' disabled' : '') + '>En Proceso</button>' +
      '<button class="btn btn-primary admin-mini" data-action="done" data-id="' + id + '"' + (disableDone ? ' disabled' : '') + '>Completar</button>' +
      '<button class="btn btn-outline admin-mini danger" data-action="delete" data-id="' + id + '">Eliminar</button>' +
      '</div>'
    );
  }

  function setLoading(value) {
    state.loading = value;
    var loading = byId('loadingState');
    var empty = byId('emptyState');
    var tableWrap = byId('tableWrap');
    if (!loading || !empty || !tableWrap) return;

    loading.hidden = !value;
    if (value) {
      empty.hidden = true;
      tableWrap.hidden = true;
    }
  }

  function renderTable() {
    var tbody = byId('requestsTbody');
    var empty = byId('emptyState');
    var tableWrap = byId('tableWrap');
    if (!tbody || !empty || !tableWrap) {
      calcStats();
      return;
    }

    var rows = getFilteredQuotes();

    if (!rows.length) {
      tbody.innerHTML = '';
      tableWrap.hidden = true;
      empty.hidden = false;
      calcStats();
      return;
    }

    empty.hidden = true;
    tableWrap.hidden = false;

    tbody.innerHTML = rows.map(function (item) {
      var meta = STATUS_META[item.status] || STATUS_META.new;

      return (
        '<tr>' +
        '<td>' + formatDate(item.createdAt) + '</td>' +
        '<td>' + escapeHtml(item.name) + '</td>' +
        '<td>' + escapeHtml(item.category) + '</td>' +
        '<td>' + escapeHtml(item.phone) + '</td>' +
        '<td>' + escapeHtml(item.email) + '</td>' +
        '<td><span class="admin-status ' + meta.css + '">' + escapeHtml(meta.label) + '</span></td>' +
        '<td>' + rowActions(item.id, item.status) + '</td>' +
        '</tr>'
      );
    }).join('');

    calcStats();
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

  function detail(label, value) {
    return '<div><dt>' + escapeHtml(label) + '</dt><dd>' + escapeHtml(value) + '</dd></div>';
  }

  function renderAttachments(request) {
    var attachments = request && Array.isArray(request.attachments) ? request.attachments : [];
    if (!attachments.length) {
      return '';
    }

    return (
      '<div class="admin-attachments">' +
      '<h4>Fotos del proyecto</h4>' +
      '<div class="admin-attachment-grid">' +
      attachments.map(function (url, index) {
        var safeUrl = escapeHtml(url);
        return (
          '<a class="admin-attachment-link" href="' + safeUrl + '" target="_blank" rel="noopener noreferrer">' +
          '<img src="' + safeUrl + '" alt="Foto del proyecto ' + String(index + 1) + '" />' +
          '</a>'
        );
      }).join('') +
      '</div>' +
      '</div>'
    );
  }

  function openRequestModal(request) {
    var modal = byId('requestModal');
    var content = byId('modalContent');
    if (!modal || !content || !request) return;

    var meta = STATUS_META[request.status] || STATUS_META.new;

    content.innerHTML =
      '<dl class="admin-detail-grid">' +
      detail('ID', request.id) +
      detail('Fecha', formatDate(request.createdAt)) +
      detail('Nombre', request.name) +
      detail('Categoria', request.category) +
      detail('Telefono', request.phone) +
      detail('Direccion', request.addressLine || request.address || '-') +
      detail('Pueblo', request.city || '-') +
      detail('Estado', request.stateRegion || '-') +
      detail('Codigo Postal', request.postalCode || '-') +
      detail('Email', request.email) +
      detail('Estado', meta.label) +
      detail('Medidas', request.measures || '-') +
      detail('Material', request.material || '-') +
      detail('Presupuesto', request.budget || '-') +
      detail('Mensaje', request.message || '-') +
      '</dl>' +
      renderAttachments(request);

    modal.hidden = false;
    document.body.classList.add('admin-modal-open');
  }

  function closeModal() {
    var modal = byId('requestModal');
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove('admin-modal-open');
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

  function formatBudgetValue(value) {
    var digits = String(value || '').replace(/[^\d]/g, '');
    if (!digits) return '';
    return '$' + Number(digits).toLocaleString('en-US');
  }

  function bindBudgetFormatter(inputId) {
    var budgetInput = byId(inputId);
    if (!budgetInput) return;

    function applyFormat() {
      budgetInput.value = formatBudgetValue(budgetInput.value);
    }

    budgetInput.addEventListener('input', applyFormat);
    budgetInput.addEventListener('blur', applyFormat);
  }

  function resetManualQuoteForm() {
    var form = byId('manualQuoteForm');
    var card = byId('manualQuoteCard');
    var imagesInput = byId('manualQuoteImages');
    if (form) form.reset();
    if (imagesInput) imagesInput.value = '';
    renderPreview('manualQuoteImagesPreview', []);
    var statusEl = byId('manualQuoteStatusMessage');
    if (statusEl) {
      statusEl.className = 'form-status';
      statusEl.textContent = '';
    }
    if (card) {
      card.hidden = true;
    }
  }

  function openManualQuoteForm() {
    var card = byId('manualQuoteCard');
    if (!card) return;
    card.hidden = false;
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function setManualQuoteStatus(type, message) {
    var el = byId('manualQuoteStatusMessage');
    if (!el) return;
    el.className = 'form-status';
    if (!message) {
      el.textContent = '';
      return;
    }
    if (type) el.classList.add(type);
    el.textContent = message;
  }

  function getManualQuotePayload() {
    return {
      name: (byId('manualQuoteName') || {}).value || '',
      phone: (byId('manualQuotePhone') || {}).value || '',
      addressLine: (byId('manualQuoteAddressLine') || {}).value || '',
      city: (byId('manualQuoteCity') || {}).value || '',
      stateRegion: (byId('manualQuoteStateRegion') || {}).value || '',
      postalCode: (byId('manualQuotePostalCode') || {}).value || '',
      email: (byId('manualQuoteEmail') || {}).value || '',
      category: (byId('manualQuoteCategory') || {}).value || '',
      measures: (byId('manualQuoteMeasures') || {}).value || '',
      material: (byId('manualQuoteMaterial') || {}).value || '',
      budget: (byId('manualQuoteBudget') || {}).value || '',
      message: (byId('manualQuoteMessage') || {}).value || '',
      status: (byId('manualQuoteStatus') || {}).value || 'new',
      source: 'admin_manual'
    };
  }

  function wireManualQuoteForm() {
    var form = byId('manualQuoteForm');
    var toggleBtn = byId('toggleManualQuoteBtn');
    var cancelBtn = byId('cancelManualQuoteBtn');
    var emptyBtn = byId('openManualQuoteEmptyBtn');
    var imagesInput = byId('manualQuoteImages');
    if (!form) return;

    bindBudgetFormatter('manualQuoteBudget');

    if (toggleBtn) {
      toggleBtn.addEventListener('click', openManualQuoteForm);
    }

    if (emptyBtn) {
      emptyBtn.addEventListener('click', openManualQuoteForm);
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', resetManualQuoteForm);
    }

    if (imagesInput) {
      imagesInput.addEventListener('change', function () {
        renderPreview('manualQuoteImagesPreview', imagesInput.files);
      });
    }

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var files = imagesInput ? Array.prototype.slice.call(imagesInput.files || []) : [];

      var maxImages = 10;
      if (window.SiteSettingsState && window.SiteSettingsState.quoteForm && window.SiteSettingsState.quoteForm.maxImages) {
        maxImages = Number(window.SiteSettingsState.quoteForm.maxImages) || 10;
      }

      if (files.length > maxImages) {
        setManualQuoteStatus('error', 'Puedes subir hasta ' + String(maxImages) + ' fotos por cotizacion manual.');
        return;
      }

      try {
        await QuoteService.saveQuote(getManualQuotePayload(), files);
        setManualQuoteStatus('success', 'Cotizacion manual creada correctamente.');
        showToast('success', 'La cotizacion manual ya aparece en solicitudes.');
        resetManualQuoteForm();
      } catch (error) {
        console.error('Manual quote creation failed:', error);
        setManualQuoteStatus('error', 'No se pudo crear la cotizacion manual.');
      }
    });
  }

  function findQuote(id) {
    return state.quotes.find(function (r) { return r.id === id; }) || null;
  }

  async function handleActionClick(e) {
    var target = e.target;
    if (!(target instanceof HTMLElement)) return;

    var action = target.getAttribute('data-action');
    var id = target.getAttribute('data-id');
    if (!action || !id) return;

    if (action === 'view') {
      openRequestModal(findQuote(id));
      return;
    }

    if (!QuoteService) {
      showToast('error', 'QuoteService no esta disponible.');
      return;
    }

    try {
      if (action === 'process') {
        await QuoteService.updateQuoteStatus(id, 'in_progress');
        showToast('success', 'Estado actualizado a En Proceso.');
        return;
      }

      if (action === 'done') {
        await QuoteService.updateQuoteStatus(id, 'completed');
        showToast('success', 'Solicitud marcada como completada.');
        return;
      }

      if (action === 'delete') {
        var req = findQuote(id);
        if (!req) return;
        if (!window.confirm('Eliminar la solicitud de ' + req.name + '?')) return;
        await QuoteService.deleteQuote(id);
        closeModal();
        showToast('info', 'Solicitud eliminada.');
      }
    } catch (error) {
      showToast('error', 'No se pudo actualizar la solicitud.');
    }
  }

  function updateNowClock() {
    var el = byId('adminNow');
    if (!el) return;
    el.textContent = new Date().toLocaleString('es-PR', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function closeSidebarOnNav() {
    document.querySelectorAll('.admin-nav-link').forEach(function (link) {
      link.addEventListener('click', function () {
        document.body.classList.remove(SIDEBAR_OPEN_CLASS);
      });
    });
  }

  function wireSidebar() {
    var toggle = byId('sidebarToggle');
    if (!toggle) return;

    toggle.addEventListener('click', function () {
      document.body.classList.toggle(SIDEBAR_OPEN_CLASS);
    });

    closeSidebarOnNav();
  }

  function wireFilters() {
    var search = byId('searchInput');
    var status = byId('statusFilter');
    if (!search || !status) return;

    search.addEventListener('input', function () {
      state.search = search.value;
      renderTable();
    });

    status.addEventListener('change', function () {
      state.statusFilter = status.value;
      renderTable();
    });
  }

  function wireTableActions() {
    var tbody = byId('requestsTbody');
    if (!tbody) return;
    tbody.addEventListener('click', handleActionClick);
  }

  function wireModal() {
    var modal = byId('requestModal');
    var closeBtn = byId('closeModalBtn');
    if (!modal || !closeBtn) return;

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', function (e) {
      var target = e.target;
      if (target instanceof HTMLElement && target.hasAttribute('data-close-modal')) {
        closeModal();
      }
    });

    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
    });
  }

  function wireActiveNav() {
    var current = (window.location.pathname.split('/').pop() || 'admin.html').toLowerCase();
    document.querySelectorAll('.admin-nav-link').forEach(function (link) {
      var href = String(link.getAttribute('href') || '').toLowerCase();
      link.classList.toggle('active', href === current);
    });
  }

  function getUserInitial(user) {
    var source = (user && (user.displayName || user.email || user.uid)) || 'A';
    return String(source).trim().charAt(0).toUpperCase() || 'A';
  }

  function updateIdentity(user) {
    var label = byId('adminUserLabel');
    var dot = byId('adminUserDot');

    if (label) {
      label.textContent = user ? (user.displayName || user.email || 'Usuario') : 'Invitado';
    }

    if (dot) {
      dot.textContent = user ? getUserInitial(user) : 'A';
      dot.title = user ? (user.email || user.displayName || 'Usuario autenticado') : 'Sin sesion';
    }
  }

  function setAuthStatus(message, type) {
    var el = byId('authStatus');
    if (!el) return;

    el.className = 'form-status';
    if (!message) {
      el.textContent = '';
      return;
    }

    if (type) {
      el.classList.add(type);
    }

    el.textContent = message;
  }

  function setAuthNotice(messages) {
    var el = byId('authNotice');
    if (!el) return;

    if (!messages || !messages.length) {
      el.hidden = true;
      el.textContent = '';
      return;
    }

    el.hidden = false;
    el.textContent = messages.join(' ');
  }

  function setSignInEnabled(enabled) {
    var btn = byId('signInBtn');
    if (btn) {
      btn.disabled = !enabled;
    }
  }

  function setSignOutVisible(visible) {
    var btn = byId('signOutBtn');
    if (btn) {
      btn.hidden = !visible;
    }
  }

  function showAuthShell() {
    var authShell = byId('authShell');
    var protectedApp = byId('protectedApp');

    document.body.classList.add('admin-auth-active');

    if (authShell) {
      authShell.hidden = false;
    }

    if (protectedApp) {
      protectedApp.hidden = true;
    }
  }

  function showProtectedApp() {
    var authShell = byId('authShell');
    var protectedApp = byId('protectedApp');

    document.body.classList.remove('admin-auth-active');

    if (authShell) {
      authShell.hidden = true;
    }

    if (protectedApp) {
      protectedApp.hidden = false;
    }
  }

  function stopQuoteSubscription() {
    if (typeof state.quotesUnsubscribe === 'function') {
      state.quotesUnsubscribe();
      state.quotesUnsubscribe = null;
    }
  }

  function startQuoteSubscription() {
    if (!QuoteService || typeof QuoteService.subscribeQuotes !== 'function') {
      setLoading(false);
      showToast('error', 'No se pudo conectar con Firestore.');
      return;
    }

    stopQuoteSubscription();
    setLoading(true);

    state.quotesUnsubscribe = QuoteService.subscribeQuotes(function (quotes) {
      state.quotes = Array.isArray(quotes) ? quotes : [];
      setLoading(false);
      renderTable();
    }, function () {
      setLoading(false);
      showToast('error', 'No se pudieron cargar las solicitudes desde Firestore.');
    });
  }

  function bootDashboard() {
    if (!QuoteService) {
      setAuthStatus('QuoteService no esta disponible. Verifica que quote-service.js cargue antes que admin.js.', 'error');
      return;
    }

    if (!state.uiReady) {
      wireSidebar();
      wireFilters();
      wireTableActions();
      wireModal();
      wireManualQuoteForm();
      wireActiveNav();
      updateNowClock();
      if (!state.clockTimer) {
        state.clockTimer = setInterval(updateNowClock, 30000);
      }
      state.uiReady = true;
    }

    startQuoteSubscription();
  }

  function explainAuthError(error) {
    var code = error && error.code ? String(error.code) : '';

    if (code === 'auth/popup-blocked') return 'El navegador bloqueo la ventana emergente de Google. Intenta de nuevo.';
    if (code === 'auth/popup-closed-by-user') return 'Cancelaste el inicio de sesion.';
    if (code === 'auth/unauthorized-domain') return 'Este dominio no esta autorizado en Firebase. Agregalo en Authentication > Settings.';
    if (code === 'auth/network-request-failed') return 'No se pudo conectar con Firebase. Revisa tu red y vuelve a intentar.';
    if (code === 'auth/operation-not-allowed') return 'Google Sign-In no esta habilitado en Firebase Authentication.';

    return (error && error.message) ? error.message : 'No se pudo completar el inicio de sesion.';
  }

  function handleAuthStateChange(user, bridgeState) {
    state.authReady = !!(bridgeState && bridgeState.ready);
    var deniedMessage = FirebaseAdminAuth && typeof FirebaseAdminAuth.getAccessDeniedMessage === 'function'
      ? FirebaseAdminAuth.getAccessDeniedMessage()
      : '';

    if (bridgeState && bridgeState.issues && bridgeState.issues.length) {
      setAuthNotice(bridgeState.issues);
      setAuthStatus('Configura Firebase para desbloquear el acceso con Google.', 'error');
      setSignInEnabled(false);
    } else {
      setAuthNotice([]);
      setSignInEnabled(true);
    }

    if (user) {
      state.currentUser = user;
      updateIdentity(user);
      setSignOutVisible(true);
      setAuthStatus('', null);
      showProtectedApp();
      bootDashboard();
      return;
    }

    state.currentUser = null;
    state.quotes = [];
    stopQuoteSubscription();
    updateIdentity(null);
    setSignOutVisible(false);
    showAuthShell();

    if (deniedMessage) {
      setAuthStatus(deniedMessage, 'error');
      setSignInEnabled(true);
      return;
    }

    if (state.authReady) {
      setAuthStatus('Inicia sesion con Google para entrar al panel.', 'info');
      setSignInEnabled(true);
    }
  }

  function wireAuthControls() {
    var signInBtn = byId('signInBtn');
    var signOutBtn = byId('signOutBtn');

    if (signInBtn) {
      signInBtn.addEventListener('click', function () {
        if (!FirebaseAdminAuth || typeof FirebaseAdminAuth.signInWithGoogle !== 'function') {
          setAuthStatus('Firebase Auth no esta listo todavia.', 'error');
          return;
        }

        setAuthStatus('Abriendo el inicio de sesion de Google...', 'info');

        FirebaseAdminAuth.signInWithGoogle().catch(function (error) {
          var message = explainAuthError(error);
          setAuthStatus(message, 'error');
          setSignInEnabled(true);
          showToast('error', message);
        });
      });
    }

    if (signOutBtn) {
      signOutBtn.addEventListener('click', function () {
        if (!FirebaseAdminAuth || typeof FirebaseAdminAuth.signOut !== 'function') {
          return;
        }

        setAuthStatus('Cerrando la sesion...', 'info');
        setSignOutVisible(false);
        stopQuoteSubscription();

        FirebaseAdminAuth.signOut().catch(function (error) {
          var message = explainAuthError(error);
          setAuthStatus(message, 'error');
          setSignOutVisible(true);
          showToast('error', message);
        });
      });
    }
  }

  function initAuth() {
    var bridge = FirebaseAdminAuth;

    if (!bridge || typeof bridge.onAuthStateChanged !== 'function') {
      setAuthNotice(['Firebase Auth no esta cargado. Verifica que los scripts de Firebase esten incluidos antes de admin.js.']);
      setAuthStatus('No se pudo cargar la proteccion del panel.', 'error');
      setSignInEnabled(false);
      setSignOutVisible(false);
      showAuthShell();
      return;
    }

    if (typeof bridge.init === 'function') {
      bridge.init();
    }

    setAuthNotice(bridge.getIssues ? bridge.getIssues() : []);
    setSignOutVisible(false);
    showAuthShell();

    bridge.onAuthStateChanged(handleAuthStateChange);
  }

  function init() {
    if (!QuoteService) {
      console.error('QuoteService no esta disponible. Verifica que quote-service.js cargue antes de admin.js.');
      return;
    }

    wireAuthControls();
    initAuth();
  }

  init();
})();
