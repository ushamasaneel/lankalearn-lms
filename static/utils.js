/* ============================================================
   utils.js — Shared helpers for LankaLearn LMS
   ============================================================ */

// --- API fetch wrapper ---
async function api(path, opts = {}) {
  try {
    const res = await fetch(path, {
      credentials: 'include',
      headers: { 'Accept': 'application/json', ...(opts.headers || {}) },
      ...opts
    });
    if (res.status === 401) {
      window.location.href = '/';
      return null;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail || `Error ${res.status}`);
    }
    return data;
  } catch (e) {
    if (e.message !== 'Failed to fetch') showToast(e.message, 'error');
    throw e;
  }
}

// POST with FormData
async function apiPost(path, formData) {
  return api(path, { method: 'POST', body: formData });
}

// POST JSON
async function apiJSON(path, obj, method = 'POST') {
  return api(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj)
  });
}

// DELETE
async function apiDelete(path) {
  return api(path, { method: 'DELETE' });
}

// Build FormData from plain object
function buildForm(obj) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(obj)) {
    if (v !== null && v !== undefined) fd.append(k, v);
  }
  return fd;
}

// --- Date helpers ---
function fmtDate(str) {
  if (!str) return '—';
  try {
    return new Date(str).toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return str; }
}

function fmtDateTime(str) {
  if (!str) return '—';
  try {
    return new Date(str).toLocaleString('en-LK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return str; }
}

function daysUntil(str) {
  if (!str) return null;
  const d = Math.ceil((new Date(str) - Date.now()) / 86400000);
  if (d < 0) return { label: `${Math.abs(d)}d overdue`, cls: 'badge-red' };
  if (d === 0) return { label: 'Due today', cls: 'badge-yellow' };
  if (d <= 3) return { label: `${d}d left`, cls: 'badge-yellow' };
  return { label: `${d}d left`, cls: 'badge-green' };
}

// --- Toast ---
function showToast(msg, type = 'info') {
  const tc = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  tc.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// --- Modal ---
function openModal(title, bodyHtml, extraClass = '') {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  const box = document.getElementById('modalBox');
  box.className = 'modal-box ' + extraClass;
  document.getElementById('modalOverlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

// --- Render helpers ---
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

function emptyState(icon, text) {
  return `<div class="empty-state"><div class="empty-icon">${icon}</div><p>${text}</p></div>`;
}

function gradeColor(pct) {
  if (pct === null || pct === undefined) return 'grade-blank';
  if (pct >= 75) return 'grade-a';
  if (pct >= 60) return 'grade-b';
  if (pct >= 40) return 'grade-c';
  return 'grade-f';
}

function gradeLabel(grade, points) {
  if (grade === null || grade === undefined) return '<span class="text-muted">—</span>';
  const pct = Math.round(grade / points * 100);
  const cls = gradeColor(pct);
  return `<span class="${cls}">${grade}/${points} (${pct}%)</span>`;
}

// Course color index
const COURSE_COLORS = ['#1e40af','#0891b2','#059669','#7c3aed','#b45309','#be185d'];
function courseColor(id) { return COURSE_COLORS[(id - 1) % COURSE_COLORS.length]; }
function courseColorClass(id) { return `course-color-${(id - 1) % 6}`; }
function courseBannerClass(id) { return `course-banner-${(id - 1) % 6}`; }

// Type icons for module items
const TYPE_ICONS = {
  material:   '📄',
  assignment: '✏️',
  discussion: '💬',
  page:       '📃',
  quiz:       '📝',
};

// Render a simple form inside a modal
function modalForm(fields, onSubmit, submitLabel = 'Save') {
  let html = '<form id="mf" onsubmit="return false">';
  for (const f of fields) {
    html += `<div class="form-group"><label>${f.label}</label>`;
    if (f.type === 'textarea') {
      html += `<textarea class="form-control" name="${f.name}" placeholder="${f.placeholder||''}" ${f.required?'required':''}>${f.value||''}</textarea>`;
    } else if (f.type === 'select') {
      html += `<select class="form-control" name="${f.name}" ${f.required?'required':''}>`;
      for (const o of (f.options||[])) {
        html += `<option value="${o.value}" ${f.value==o.value?'selected':''}>${o.label}</option>`;
      }
      html += '</select>';
    } else {
      html += `<input class="form-control" type="${f.type||'text'}" name="${f.name}" value="${f.value||''}" placeholder="${f.placeholder||''}" ${f.required?'required':''}/>`;
    }
    html += '</div>';
  }
  html += `<div class="flex gap-8" style="justify-content:flex-end;margin-top:8px">
    <button class="btn btn-secondary btn-sm" type="button" onclick="closeModal()">Cancel</button>
    <button class="btn btn-primary btn-sm" type="submit" onclick="__mfSubmit()">${submitLabel}</button>
  </div></form>`;
  window.__mfSubmit = () => {
    const form = document.getElementById('mf');
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const fd = new FormData(form);
    onSubmit(fd);
  };
  return html;
}

function setContent(html) {
  document.getElementById('contentArea').innerHTML = html;
}

function setPageTitle(t) {
  document.getElementById('pageTitle').textContent = t;
}
