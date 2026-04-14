import { mountEnvironmentBanner } from './src/utils/envGuard.js';
import { QuoteService } from './quote-service.js';
import { FirebaseAdminAuth } from './firebase-auth.js';

(function () {
  var SIDEBAR_OPEN_CLASS = 'admin-sidebar-open';

  var STATUS_META = {
    new: { label: 'Nuevo', css: 'status-nuevo' },
    in_progress: { label: 'En Proceso', css: 'status-en-proceso' },
    completed: { label: 'Completado', css: 'status-completado' },
    archived: { label: 'Archivado', css: 'status-completado' }
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
    quotesUnsubscribe: null,
    auditEvents: [],
    auditEventsUnsubscribe: null,
    currentModalProjectId: null,
    manualFormMode: 'create',
    editingProjectId: null
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
    if (filter === 'Archivado') return 'archived';
    return 'all';
  }

  function getFilteredQuotes() {
    var q = normalize(state.search);
    var statusFilter = filterValueToStatus(state.statusFilter);

    return state.quotes.filter(function (item) {
      var statusOk = statusFilter === 'all' || item.status === statusFilter;
      if (!statusOk) return false;

      if (!q) return true;

      return [item.name, item.email, item.category, item.projectTitle, item.phone, item.id, item.address, item.addressLine, item.city, item.stateRegion, item.zipCode, item.postalCode]
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
      '<select class="admin-actions-select" data-actions-menu="true" data-id="' + id + '" aria-label="Acciones del proyecto">' +
      '<option value="" selected disabled hidden>Acciones</option>' +
      '<option value="view">Ver</option>' +
      '<option value="edit">Editar</option>' +
      '<option value="process"' + (disableProcess ? ' disabled' : '') + '>En Proceso</option>' +
      '<option value="done"' + (disableDone ? ' disabled' : '') + '>Completar</option>' +
      '<option value="delete">Eliminar</option>' +
      '</select>' +
      '</div>'
    );
  }

  async function runRowAction(action, id) {
    if (!action || !id) return;

    if (action === 'view') {
      openRequestModal(findQuote(id));
      return;
    }

    if (action === 'edit') {
      closeModal();
      openManualQuoteForm('edit', findQuote(id));
      return;
    }

    if (!QuoteService) {
      showToast('error', 'QuoteService no esta disponible.');
      return;
    }

    try {
      if (action === 'process') {
        await (QuoteService.updateProjectStatus || QuoteService.updateQuoteStatus)(id, 'in_progress');
        showToast('success', 'Estado actualizado a En Proceso.');
        return;
      }

      if (action === 'done') {
        await (QuoteService.updateProjectStatus || QuoteService.updateQuoteStatus)(id, 'completed');
        showToast('success', 'Proyecto marcado como completado.');
        return;
      }

      if (action === 'delete') {
        var req = findQuote(id);
        if (!req) return;
        if (!window.confirm('Eliminar el registro de ' + req.name + '?')) return;
        await (QuoteService.deleteProject || QuoteService.deleteQuote)(id);
        closeModal();
        showToast('info', 'Registro eliminado.');
      }
    } catch (error) {
      showToast('error', 'No se pudo actualizar el registro.');
    }
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

  function auditTypeLabel(type) {
    if (type === 'project_deleted') return 'Deleted project';
    if (type === 'status_changed') return 'Status changed';
    if (type === 'note_added') return 'Note added';
    if (type === 'note_deleted') return 'Note deleted';
    if (type === 'attachment_added') return 'Attachment added';
    if (type === 'attachment_deleted') return 'Attachment deleted';
    if (type === 'attachment_uploaded') return 'Files uploaded';
    return 'Audit event';
  }

  function renderAuditEvents() {
    var list = byId('auditEventsList');
    var empty = byId('auditEmptyState');
    var loading = byId('auditLoadingState');
    if (!list || !empty || !loading) return;

    if (state.loading && !state.auditEvents.length) {
      loading.hidden = false;
      empty.hidden = true;
      list.innerHTML = '';
      return;
    }

    loading.hidden = true;

    if (!state.auditEvents.length) {
      list.innerHTML = '';
      empty.hidden = false;
      return;
    }

    empty.hidden = true;
    list.innerHTML = state.auditEvents.map(function (event) {
      return (
        '<article class="admin-audit-item">' +
        '<div class="admin-audit-main">' +
        '<div class="admin-file-meta">' +
        '<span class="admin-chip">' + escapeHtml(auditTypeLabel(event.type)) + '</span>' +
        '<span>' + formatDateMeta(event.createdAt) + '</span>' +
        '<span>' + formatActor(event.createdBy) + '</span>' +
        '</div>' +
        '<strong>' + escapeHtml(event.projectTitle || event.clientName || event.projectId || 'Project record') + '</strong>' +
        '<div class="admin-note-meta">Client: ' + escapeHtml(event.clientName || '-') + ' · Status: ' + escapeHtml(event.status || '-') + '</div>' +
        '</div>' +
        '</article>'
      );
    }).join('');
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

  function formatActor(value) {
    return escapeHtml(value || 'Admin');
  }

  function formatDateMeta(iso) {
    var formatted = formatDate(iso);
    return formatted === '-' ? 'Sin fecha' : formatted;
  }

  function getCurrentAdminLabel() {
    return (state.currentUser && (state.currentUser.displayName || state.currentUser.email)) || 'Admin';
  }

  function getCurrentModalProject() {
    return findQuote(state.currentModalProjectId);
  }

  function formatExportDate(iso) {
    var d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString();
  }

  function csvEscape(value) {
    var text = String(value == null ? '' : value);
    if (/[",\n]/.test(text)) {
      return '"' + text.replace(/"/g, '""') + '"';
    }
    return text;
  }

  function getExportRecords(scope) {
    return (scope === 'filtered' ? getFilteredQuotes() : state.quotes.slice()).slice();
  }

  function buildExportRows(records) {
    return records.map(function (item) {
      return {
        id: item.id || '',
        type: item.type || '',
        status: item.status || '',
        createdAt: formatExportDate(item.createdAt),
        updatedAt: formatExportDate(item.updatedAt),
        name: item.name || '',
        phone: item.phone || '',
        email: item.email || '',
        address: item.address || item.addressLine || '',
        city: item.city || '',
        stateRegion: item.stateRegion || '',
        zipCode: item.zipCode || item.postalCode || '',
        category: item.category || '',
        projectTitle: item.projectTitle || '',
        measures: item.measures || '',
        material: item.material || '',
        budget: item.budget || '',
        message: item.message || '',
        notesCount: Array.isArray(item.notes) ? item.notes.length : 0,
        attachmentsCount: Array.isArray(item.attachments) ? item.attachments.length : 0,
        historyCount: Array.isArray(item.history) ? item.history.length : 0,
        source: item.source || ''
      };
    });
  }

  function downloadBlob(filename, mimeType, content) {
    var blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function getExportFileBaseName(scope) {
    var stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    return 'clientes-proyectos-' + (scope === 'filtered' ? 'filtrados-' : 'todos-') + stamp;
  }

  function exportAsCsv(records, scope) {
    var rows = buildExportRows(records);
    var headers = Object.keys(rows[0] || {
      id: '', type: '', status: '', createdAt: '', updatedAt: '', name: '', phone: '', email: '', address: '', city: '', stateRegion: '', zipCode: '', category: '', projectTitle: '', measures: '', material: '', budget: '', message: '', notesCount: '', attachmentsCount: '', historyCount: '', source: ''
    });
    var lines = [headers.join(',')].concat(rows.map(function (row) {
      return headers.map(function (header) {
        return csvEscape(row[header]);
      }).join(',');
    }));
    downloadBlob(getExportFileBaseName(scope) + '.csv', 'text/csv;charset=utf-8', '\uFEFF' + lines.join('\n'));
  }

  function exportAsExcel(records, scope) {
    var rows = buildExportRows(records);
    var xlsxApi = window.XLSX;
    if (!xlsxApi || !xlsxApi.utils || typeof xlsxApi.writeFile !== 'function') {
      throw new Error('Excel export is not available right now.');
    }

    var worksheet = xlsxApi.utils.json_to_sheet(rows);
    var workbook = xlsxApi.utils.book_new();
    xlsxApi.utils.book_append_sheet(workbook, worksheet, 'Clientes');
    xlsxApi.writeFile(workbook, getExportFileBaseName(scope) + '.xlsx');
  }

  function buildExportHtml(records, title) {
    var rows = buildExportRows(records);
    var headers = Object.keys(rows[0] || {
      id: '', type: '', status: '', createdAt: '', updatedAt: '', name: '', phone: '', email: '', address: '', city: '', stateRegion: '', zipCode: '', category: '', projectTitle: '', measures: '', material: '', budget: '', message: '', notesCount: '', attachmentsCount: '', historyCount: '', source: ''
    });

    return '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + escapeHtml(title) + '</title>' +
      '<style>body{font-family:Segoe UI,Tahoma,sans-serif;padding:24px;color:#1a1d24}h1{margin:0 0 16px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #d8dde6;padding:8px;text-align:left;vertical-align:top}th{background:#f5f6fa}tr:nth-child(even){background:#fafbfc}</style>' +
      '</head><body><h1>' + escapeHtml(title) + '</h1><table><thead><tr>' + headers.map(function (header) {
        return '<th>' + escapeHtml(header) + '</th>';
      }).join('') + '</tr></thead><tbody>' + rows.map(function (row) {
        return '<tr>' + headers.map(function (header) {
          return '<td>' + escapeHtml(row[header]) + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table></body></html>';
  }

  function exportAsWord(records, scope) {
    var title = 'Clientes / Proyectos';
    var html = buildExportHtml(records, title);
    downloadBlob(getExportFileBaseName(scope) + '.doc', 'application/msword;charset=utf-8', html);
  }

  function exportAsPdf(records, scope) {
    var jsPdfApi = window.jspdf;
    if (!jsPdfApi || typeof jsPdfApi.jsPDF !== 'function') {
      throw new Error('PDF export is not available right now.');
    }

    var rows = buildExportRows(records);
    var headers = ['ID', 'Cliente', 'Categoria', 'Telefono', 'Email', 'Estado', 'Tipo', 'Presupuesto'];
    var doc = new jsPdfApi.jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    var y = 40;

    doc.setFontSize(18);
    doc.text('Clientes / Proyectos', 40, y);
    y += 24;
    doc.setFontSize(10);
    doc.text('Exportado: ' + new Date().toLocaleString('es-PR'), 40, y);
    y += 24;

    doc.setFontSize(9);
    doc.text(headers.join(' | '), 40, y);
    y += 18;

    rows.forEach(function (row) {
      var line = [
        row.id,
        row.name,
        row.category,
        row.phone,
        row.email,
        row.status,
        row.type,
        row.budget
      ].join(' | ');

      if (y > 540) {
        doc.addPage();
        y = 40;
      }

      var wrapped = doc.splitTextToSize(line, 760);
      doc.text(wrapped, 40, y);
      y += wrapped.length * 12 + 6;
    });

    doc.save(getExportFileBaseName(scope) + '.pdf');
  }

  function openExportModal() {
    var modal = byId('exportModal');
    if (!modal) return;
    modal.hidden = false;
    document.body.classList.add('admin-modal-open');
  }

  function closeExportModal() {
    var modal = byId('exportModal');
    if (!modal) return;
    modal.hidden = true;
    if (byId('requestModal') && byId('requestModal').hidden) {
      document.body.classList.remove('admin-modal-open');
    }
  }

  function handleProjectsExport() {
    var formatInput = byId('exportFormat');
    var scopeInput = byId('exportScope');
    var format = formatInput ? String(formatInput.value || 'csv') : 'csv';
    var scope = scopeInput ? String(scopeInput.value || 'all') : 'all';
    var records = getExportRecords(scope);

    if (!records.length) {
      showToast('info', 'No records available to export.');
      return;
    }

    if (format === 'csv') {
      exportAsCsv(records, scope);
    } else if (format === 'xlsx') {
      exportAsExcel(records, scope);
    } else if (format === 'doc') {
      exportAsWord(records, scope);
    } else if (format === 'pdf') {
      exportAsPdf(records, scope);
    } else {
      throw new Error('Unsupported export format.');
    }

    closeExportModal();
    showToast('success', 'Export downloaded successfully.');
  }

  function renderInfoSection(title, content) {
    return (
      '<section class="admin-detail-section">' +
      '<div class="admin-detail-section-head">' +
      '<h4>' + escapeHtml(title) + '</h4>' +
      '</div>' +
      content +
      '</section>'
    );
  }

  function renderNotesSection(request) {
    var notes = request && Array.isArray(request.notes) ? request.notes : [];

    return renderInfoSection('Notas Internas',
      '<div class="admin-detail-stack">' +
      '<div class="admin-inline-form">' +
      '<textarea id="projectNoteText" rows="4" placeholder="Escribe una nota interna para este proyecto"></textarea>' +
      '<button id="addProjectNoteBtn" class="btn btn-primary" type="button">Agregar Nota</button>' +
      '</div>' +
      '<div class="admin-note-list">' +
      (notes.length ? notes.map(function (note) {
        return (
          '<article class="admin-note-item">' +
          '<div class="admin-note-copy">' + escapeHtml(note.text) + '</div>' +
          '<div class="admin-note-meta">' + formatDateMeta(note.createdAt) + ' · ' + formatActor(note.createdBy) + '</div>' +
          '<button class="btn btn-outline admin-mini danger" type="button" data-note-delete="' + escapeHtml(note.id) + '">Eliminar</button>' +
          '</article>'
        );
      }).join('') : '<p class="admin-list-empty">Todavia no hay notas internas.</p>') +
      '</div>' +
      '</div>'
    );
  }

  function attachmentCategoryLabel(category) {
    if (category === 'quote') return 'Cotizacion';
    if (category === 'invoice') return 'Factura';
    if (category === 'receipt') return 'Recibo';
    if (category === 'photo') return 'Foto';
    return 'Otro';
  }

  function renderAttachmentsSection(request) {
    var attachments = request && Array.isArray(request.attachments) ? request.attachments : [];

    return renderInfoSection('Archivos / Adjuntos',
      '<div class="admin-detail-stack">' +
      '<div class="admin-inline-form admin-inline-form-attachments">' +
      '<input id="projectAttachmentName" type="text" placeholder="Nombre del archivo" />' +
      '<select id="projectAttachmentCategory">' +
      '<option value="photo">Foto del proyecto</option>' +
      '<option value="quote">Cotizacion / Propuesta</option>' +
      '<option value="invoice">Factura</option>' +
      '<option value="receipt">Recibo</option>' +
      '<option value="other">Otro documento</option>' +
      '</select>' +
      '<input id="projectAttachmentUrl" type="url" placeholder="Optional reference URL" />' +
      '<input id="projectAttachmentFiles" type="file" multiple />' +
      '<button id="addProjectAttachmentBtn" class="btn btn-primary" type="button">Upload Photos/Documents</button>' +
      '</div>' +
      '<div class="admin-file-list">' +
      (attachments.length ? attachments.map(function (attachment) {
        var safeUrl = escapeHtml(attachment.url || '#');
        var isPhoto = attachment.category === 'photo' || String(attachment.type || '').indexOf('image/') === 0;
        return (
          '<article class="admin-file-item">' +
          (isPhoto ? '<a class="admin-file-preview" href="' + safeUrl + '" target="_blank" rel="noopener noreferrer"><img src="' + safeUrl + '" alt="' + escapeHtml(attachment.name || 'Imagen del proyecto') + '" /></a>' : '') +
          '<div class="admin-file-main">' +
          '<a class="admin-file-link" href="' + safeUrl + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(attachment.name || 'Archivo') + '</a>' +
          '<div class="admin-file-meta">' +
          '<span class="admin-chip">' + escapeHtml(attachmentCategoryLabel(attachment.category)) + '</span>' +
          '<span>' + formatDateMeta(attachment.createdAt) + '</span>' +
          '<span>' + formatActor(attachment.createdBy) + '</span>' +
          '</div>' +
          '</div>' +
          '<button class="btn btn-outline admin-mini danger" type="button" data-attachment-delete="' + escapeHtml(attachment.id) + '">Eliminar</button>' +
          '</article>'
        );
      }).join('') : '<p class="admin-list-empty">Todavia no hay adjuntos internos.</p>') +
      '</div>' +
      '</div>'
    );
  }

  function renderHistorySection(request) {
    var history = request && Array.isArray(request.history) ? request.history.slice() : [];
    history.sort(function (a, b) {
      return String(b && b.createdAt || '').localeCompare(String(a && a.createdAt || ''));
    });
    return renderInfoSection('Historial',
      history.length
        ? '<div class="admin-history-list">' + history.map(function (item) {
          var entry = item && typeof item === 'object' ? item : { description: String(item || '') };
          return (
            '<div class="admin-history-item">' +
            '<div class="admin-file-meta"><span class="admin-chip">' + escapeHtml(String(entry.action || 'update')) + '</span></div>' +
            '<div class="admin-note-copy">' + escapeHtml(entry.description || '') + '</div>' +
            '<div class="admin-note-meta">' + formatDateMeta(entry.createdAt) + ' · ' + formatActor(entry.createdBy) + '</div>' +
            '</div>'
          );
        }).join('') + '</div>'
        : '<p class="admin-list-empty">Historial pendiente. Esta seccion queda lista para futuras acciones del proyecto.</p>'
    );
  }

  function renderDetailSections(request) {
    var meta = STATUS_META[request.status] || STATUS_META.new;

    return (
      '<div class="admin-detail-layout">' +
      renderInfoSection('Informacion del cliente',
        '<dl class="admin-detail-grid">' +
        detail('ID', request.id) +
        detail('Fecha', formatDate(request.createdAt)) +
        detail('Cliente', request.name) +
        detail('Telefono', request.phone) +
        detail('Email', request.email) +
        detail('Direccion', request.address || request.addressLine || '-') +
        detail('Ciudad', request.city || '-') +
        detail('Estado', request.stateRegion || '-') +
        detail('Codigo Postal', request.zipCode || request.postalCode || '-') +
        '</dl>'
      ) +
      renderInfoSection('Informacion del proyecto',
        '<dl class="admin-detail-grid">' +
        detail('Tipo', request.type === 'project' ? 'Proyecto' : 'Cotizacion') +
        detail('Titulo del proyecto', request.projectTitle || '-') +
        detail('Categoria', request.category) +
        detail('Estado', meta.label) +
        detail('Medidas', request.measures || '-') +
        detail('Material', request.material || '-') +
        detail('Presupuesto', request.budget || '-') +
        detail('Ultima actualizacion', formatDateMeta(request.updatedAt)) +
        detail('Mensaje', request.message || '-') +
        detail('Origen', request.source || '-') +
        '</dl>'
      ) +
      renderNotesSection(request) +
      renderAttachmentsSection(request) +
      renderHistorySection(request) +
      '</div>'
    );
  }

  function openRequestModal(request) {
    var modal = byId('requestModal');
    var content = byId('modalContent');
    if (!modal || !content || !request) return;
    state.currentModalProjectId = request.id;
    content.innerHTML = renderDetailSections(request);

    modal.hidden = false;
    document.body.classList.add('admin-modal-open');
  }

  function closeModal() {
    var modal = byId('requestModal');
    if (!modal) return;
    state.currentModalProjectId = null;
    modal.hidden = true;
    document.body.classList.remove('admin-modal-open');
  }

  async function handleAddProjectNote() {
    var request = getCurrentModalProject();
    var noteInput = byId('projectNoteText');
    if (!request || !noteInput || !QuoteService || typeof QuoteService.addProjectNote !== 'function') return;

    var text = String(noteInput.value || '').trim();
    if (!text) {
      showToast('error', 'Escribe una nota antes de guardarla.');
      return;
    }

    try {
      await QuoteService.addProjectNote(request.id, {
        text: text,
        createdBy: getCurrentAdminLabel()
      });
      noteInput.value = '';
      openRequestModal(findQuote(request.id));
      showToast('success', 'Nota agregada correctamente.');
    } catch (error) {
      showToast('error', 'No se pudo guardar la nota.');
    }
  }

  async function handleDeleteProjectNote(noteId) {
    var request = getCurrentModalProject();
    if (!request || !noteId || !QuoteService || typeof QuoteService.deleteProjectNote !== 'function') return;

    try {
      await QuoteService.deleteProjectNote(request.id, noteId);
      openRequestModal(findQuote(request.id));
      showToast('info', 'Nota eliminada.');
    } catch (error) {
      showToast('error', 'No se pudo eliminar la nota.');
    }
  }

  async function handleAddProjectAttachment() {
    var request = getCurrentModalProject();
    var nameInput = byId('projectAttachmentName');
    var categoryInput = byId('projectAttachmentCategory');
    var urlInput = byId('projectAttachmentUrl');
    var filesInput = byId('projectAttachmentFiles');
    if (!request || !nameInput || !categoryInput || !urlInput || !filesInput || !QuoteService) return;

    var name = String(nameInput.value || '').trim();
    var url = String(urlInput.value || '').trim();
    var files = Array.prototype.slice.call(filesInput.files || []);
    if (!files.length && (!name || !url)) {
      showToast('error', 'Add a desktop file, or provide a name and reference URL.');
      return;
    }

    try {
      if (files.length) {
        if (typeof QuoteService.addProjectAttachmentFiles !== 'function') {
          throw new Error('Attachment uploads are not available.');
        }

        await QuoteService.addProjectAttachmentFiles(request.id, files, categoryInput.value || 'other');
      } else {
        if (typeof QuoteService.addProjectAttachment !== 'function') {
          throw new Error('Manual attachment entries are not available.');
        }

        await QuoteService.addProjectAttachment(request.id, {
          name: name,
          category: categoryInput.value || 'other',
          url: url,
          createdBy: getCurrentAdminLabel()
        });
      }

      nameInput.value = '';
      urlInput.value = '';
      filesInput.value = '';
      categoryInput.value = 'photo';
      openRequestModal(findQuote(request.id));
      showToast('success', 'Attachment added successfully.');
    } catch (error) {
      showToast('error', 'Could not save the attachment.');
    }
  }

  async function handleDeleteProjectAttachment(attachmentId) {
    var request = getCurrentModalProject();
    if (!request || !attachmentId || !QuoteService || typeof QuoteService.deleteProjectAttachment !== 'function') return;

    try {
      await QuoteService.deleteProjectAttachment(request.id, attachmentId);
      openRequestModal(findQuote(request.id));
      showToast('info', 'Adjunto eliminado.');
    } catch (error) {
      showToast('error', 'No se pudo eliminar el adjunto.');
    }
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

  function setManualQuoteFormMode(mode, record) {
    var title = byId('manualQuoteCardTitle');
    var subtitle = byId('manualQuoteCardSubtitle');
    var submit = byId('manualQuoteSubmitBtn');
    var isEdit = mode === 'edit';

    state.manualFormMode = isEdit ? 'edit' : 'create';
    state.editingProjectId = isEdit && record ? record.id : null;

    if (title) {
      title.textContent = isEdit ? 'Editar Proyecto' : 'Proyecto Manual';
    }

    if (subtitle) {
      subtitle.textContent = isEdit
        ? 'Actualiza la información principal del cliente o proyecto. Las notas y adjuntos se gestionan por separado.'
        : 'Crea un proyecto o registro de cliente desde el panel administrativo con la misma base de datos que usan las cotizaciones.';
    }

    if (submit) {
      submit.textContent = isEdit ? 'Guardar Cambios' : 'Guardar Proyecto';
    }
  }

  function fillManualQuoteForm(record) {
    var project = record || {};

    (byId('manualQuoteName') || {}).value = project.name || '';
    (byId('manualQuotePhone') || {}).value = project.phone || '';
    (byId('manualQuoteAddressLine') || {}).value = project.address || project.addressLine || '';
    (byId('manualQuoteCity') || {}).value = project.city || '';
    (byId('manualQuoteStateRegion') || {}).value = project.stateRegion || '';
    (byId('manualQuotePostalCode') || {}).value = project.zipCode || project.postalCode || '';
    (byId('manualQuoteEmail') || {}).value = project.email || '';
    (byId('manualQuoteCategory') || {}).value = project.category || '';
    (byId('manualQuoteProjectTitle') || {}).value = project.projectTitle || '';
    (byId('manualQuoteMeasures') || {}).value = project.measures || '';
    (byId('manualQuoteMaterial') || {}).value = project.material || '';
    (byId('manualQuoteBudget') || {}).value = project.budget || '';
    (byId('manualQuoteMessage') || {}).value = project.message || '';
    (byId('manualQuoteStatus') || {}).value = project.status || 'new';
    (byId('manualQuoteType') || {}).value = project.type || 'project';
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
    setManualQuoteFormMode('create');
  }

  function openManualQuoteForm(mode, record) {
    var card = byId('manualQuoteCard');
    var imagesInput = byId('manualQuoteImages');
    if (!card) return;
    if (imagesInput) {
      imagesInput.value = '';
    }
    renderPreview('manualQuoteImagesPreview', []);
    setManualQuoteStatus('', '');
    setManualQuoteFormMode(mode, record);
    if (mode !== 'edit') {
      var form = byId('manualQuoteForm');
      if (form) form.reset();
    }
    if (record) {
      fillManualQuoteForm(record);
    }
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
      address: (byId('manualQuoteAddressLine') || {}).value || '',
      city: (byId('manualQuoteCity') || {}).value || '',
      stateRegion: (byId('manualQuoteStateRegion') || {}).value || '',
      zipCode: (byId('manualQuotePostalCode') || {}).value || '',
      email: (byId('manualQuoteEmail') || {}).value || '',
      category: (byId('manualQuoteCategory') || {}).value || '',
      projectTitle: (byId('manualQuoteProjectTitle') || {}).value || '',
      measures: (byId('manualQuoteMeasures') || {}).value || '',
      material: (byId('manualQuoteMaterial') || {}).value || '',
      budget: (byId('manualQuoteBudget') || {}).value || '',
      message: (byId('manualQuoteMessage') || {}).value || '',
      status: (byId('manualQuoteStatus') || {}).value || 'new',
      type: (byId('manualQuoteType') || {}).value || 'project',
      notes: [],
      attachments: [],
      history: [],
      source: 'manual_admin'
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
      toggleBtn.addEventListener('click', function () {
        resetManualQuoteForm();
        openManualQuoteForm('create');
      });
    }

    if (emptyBtn) {
      emptyBtn.addEventListener('click', function () {
        resetManualQuoteForm();
        openManualQuoteForm('create');
      });
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
      var payload = getManualQuotePayload();

      var maxImages = 10;
      if (window.SiteSettingsState && window.SiteSettingsState.quoteForm && window.SiteSettingsState.quoteForm.maxImages) {
        maxImages = Number(window.SiteSettingsState.quoteForm.maxImages) || 10;
      }

      if (state.manualFormMode !== 'edit' && files.length > maxImages) {
        setManualQuoteStatus('error', 'Puedes subir hasta ' + String(maxImages) + ' fotos por proyecto manual.');
        return;
      }

      try {
        if (state.manualFormMode === 'edit' && state.editingProjectId) {
          var current = findQuote(state.editingProjectId);
          await QuoteService.updateProject(state.editingProjectId, Object.assign({}, payload, {
            notes: current && current.notes ? current.notes : [],
            attachments: current && current.attachments ? current.attachments : [],
            history: current && current.history ? current.history : [],
            source: current && current.source ? current.source : 'manual_admin'
          }));
          setManualQuoteStatus('success', 'Proyecto actualizado correctamente.');
          showToast('success', 'Project updated in Firestore.');
        } else {
          await QuoteService.createProject(payload, files);
          setManualQuoteStatus('success', 'Proyecto manual creado correctamente.');
          showToast('success', 'Project created in Firestore.');
        }
        resetManualQuoteForm();
      } catch (error) {
        console.error('Project save failed:', error);
        setManualQuoteStatus('error', state.manualFormMode === 'edit' ? 'No se pudo actualizar el proyecto.' : 'No se pudo crear el proyecto manual.');
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
    await runRowAction(action, id);
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
    tbody.addEventListener('change', function (e) {
      var target = e.target;
      if (!(target instanceof HTMLSelectElement)) return;
      if (!target.hasAttribute('data-actions-menu')) return;

      var action = target.value;
      var id = target.getAttribute('data-id');
      target.value = '';
      runRowAction(action, id);
    });
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
        return;
      }

      if (!(target instanceof HTMLElement)) return;

      if (target.id === 'addProjectNoteBtn') {
        handleAddProjectNote();
        return;
      }

      if (target.id === 'addProjectAttachmentBtn') {
        handleAddProjectAttachment();
        return;
      }

      if (target.id === 'editCurrentProjectBtn') {
        var current = getCurrentModalProject();
        if (current) {
          closeModal();
          openManualQuoteForm('edit', current);
        }
        return;
      }

      var noteId = target.getAttribute('data-note-delete');
      if (noteId) {
        handleDeleteProjectNote(noteId);
        return;
      }

      var attachmentId = target.getAttribute('data-attachment-delete');
      if (attachmentId) {
        handleDeleteProjectAttachment(attachmentId);
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

  function wireExportModal() {
    var openBtn = byId('openExportProjectsBtn');
    var closeBtn = byId('closeExportModalBtn');
    var cancelBtn = byId('cancelProjectsExportBtn');
    var downloadBtn = byId('downloadProjectsExportBtn');
    var modal = byId('exportModal');

    if (openBtn) {
      openBtn.addEventListener('click', openExportModal);
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', closeExportModal);
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', closeExportModal);
    }

    if (downloadBtn) {
      downloadBtn.addEventListener('click', function () {
        try {
          handleProjectsExport();
        } catch (error) {
          showToast('error', error && error.message ? error.message : 'Could not export records.');
        }
      });
    }

    if (modal) {
      modal.addEventListener('click', function (e) {
        var target = e.target;
        if (target instanceof HTMLElement && target.hasAttribute('data-close-export-modal')) {
          closeExportModal();
        }
      });
    }
  }

  function stopAuditEventsSubscription() {
    if (typeof state.auditEventsUnsubscribe === 'function') {
      state.auditEventsUnsubscribe();
      state.auditEventsUnsubscribe = null;
    }
  }

  function startQuoteSubscription() {
    var subscribe = QuoteService && (QuoteService.subscribeProjects || QuoteService.subscribeQuotes);
    if (typeof subscribe !== 'function') {
      setLoading(false);
      showToast('error', 'No se pudo conectar con Firestore.');
      return;
    }

    stopQuoteSubscription();
    setLoading(true);

    state.quotesUnsubscribe = subscribe(function (quotes) {
      state.quotes = Array.isArray(quotes) ? quotes : [];
      setLoading(false);
      renderTable();
      renderAuditEvents();
    }, function () {
      setLoading(false);
      showToast('error', 'No se pudieron cargar los registros desde Firestore.');
    });
  }

  function startAuditEventsSubscription() {
    if (!QuoteService || typeof QuoteService.subscribeAdminAuditEvents !== 'function') {
      renderAuditEvents();
      return;
    }

    stopAuditEventsSubscription();
    state.auditEventsUnsubscribe = QuoteService.subscribeAdminAuditEvents(function (events) {
      state.auditEvents = Array.isArray(events) ? events : [];
      renderAuditEvents();
    }, function () {
      showToast('error', 'Could not load audit activity.');
    }, 30);
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
      wireExportModal();
      wireManualQuoteForm();
      wireActiveNav();
      updateNowClock();
      if (!state.clockTimer) {
        state.clockTimer = setInterval(updateNowClock, 30000);
      }
      state.uiReady = true;
    }

    startQuoteSubscription();
    startAuditEventsSubscription();
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
    state.auditEvents = [];
    stopQuoteSubscription();
    stopAuditEventsSubscription();
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

    mountEnvironmentBanner();
    wireAuthControls();
    initAuth();
  }

  init();
})();
