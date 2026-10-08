const API_BASE = (import.meta.env?.VITE_API_BASE_URL || '').replace(/\/$/, '');
const TRACKED_KEY = 'bulk-certificates.tracked-jobs';
const TERMINAL = new Set(['completed', 'partial', 'failed']);
const state = { page: 'dashboard', job: null, jobs: [], search: '', filter: 'all', menuOpen: false, loading: false, error: '' };

const api = {
  async request(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
    if (!response.ok) {
      let message = `Request failed (${response.status})`;
      try { const body = await response.json(); message = body.detail || message; } catch { /* non-JSON error */ }
      throw new Error(message);
    }
    return response;
  },
  createJob(payload) { return this.request('/api/v1/jobs', { method: 'POST', body: JSON.stringify(payload) }).then(r => r.json()); },
  getJob(id) { return this.request(`/api/v1/jobs/${encodeURIComponent(id)}`).then(r => r.json()); },
  download(id) { return this.request(`/api/v1/certificates/${encodeURIComponent(id)}`).then(r => r.blob()); },
};

function trackedIds() { try { return JSON.parse(localStorage.getItem(TRACKED_KEY) || '[]'); } catch { return []; } }
function rememberJob(id) { localStorage.setItem(TRACKED_KEY, JSON.stringify([...new Set([id, ...trackedIds()])])); }
async function loadJobs() {
  const results = await Promise.all(trackedIds().map(id => api.getJob(id).catch(() => null)));
  state.jobs = results.filter(Boolean);
}
function esc(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c])); }
function date(value) { return value ? new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'; }
function dateTime(value) { return value ? new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'; }
function statusBadge(status) { return `<span class="badge badge-${esc(status)}"><i></i>${esc(status)}</span>`; }
function progress(value) { return `<div class="progress"><span style="width:${Math.min(100, Math.max(0, value || 0))}%"></span></div>`; }
function errorBox(message) { return `<div class="state error"><strong>Unable to load data</strong><span>${esc(message)}</span><small>Make sure FastAPI is running on http://127.0.0.1:8000.</small></div>`; }
function empty(text) { return `<div class="state"><span class="empty-icon">○</span><span>${esc(text)}</span></div>`; }

function shell(content) {
  const nav = [['dashboard', 'D', 'Dashboard'], ['jobs', 'J', 'Generation jobs'], ['create', '+', 'Create job']];
  return `<div class="shell"><aside class="${state.menuOpen ? 'open' : ''}"><div class="brand"><span class="brand-mark">C</span><span><b>Certify</b><small>Operations</small></span><button class="mobile-close" data-action="close-menu" aria-label="Close menu">×</button></div><nav>${nav.map(([page, icon, label]) => `<a class="${state.page === page ? 'active' : ''}" href="#${page}"><em aria-hidden="true">${icon}</em>${label}</a>`).join('')}</nav><div class="side-footer"><i></i><span><b>API connected</b><small>FastAPI backend</small></span></div></aside>${state.menuOpen ? '<div class="scrim" data-action="close-menu"></div>' : ''}<div class="content"><header><button class="menu" data-action="open-menu" aria-label="Open menu">☰</button><span class="crumb">Workspace / <b>${state.page === 'dashboard' ? 'Dashboard' : state.page === 'create' ? 'Create job' : state.page === 'detail' ? 'Job details' : 'Generation jobs'}</b></span><span class="live"><i></i> Live system</span></header><main>${content}</main></div></div>`;
}

function title(titleText, description, action = '') {
  return `<div class="page-title"><div><p class="eyebrow">CERTIFICATE OPERATIONS</p><h1>${titleText}</h1><p class="muted">${description}</p></div>${action}</div>`;
}
function button(href, label, primary = true) { return `<a class="button ${primary ? 'primary' : 'secondary'}" href="${href}">${primary ? '+' : '‹'} ${label}</a>`; }

function stats(jobs) {
  return jobs.reduce((a, x) => ({ total: a.total + x.job.total, success: a.success + x.job.success_count, failed: a.failed + x.job.failure_count, active: a.active + (['pending', 'running'].includes(x.job.status) ? 1 : 0) }), { total: 0, success: 0, failed: 0, active: 0 });
}
function jobRows(jobs) {
  if (!jobs.length) return empty('No tracked generation jobs yet.');
  return `<div class="table-scroll"><table><thead><tr><th>Job</th><th>Course</th><th>Status</th><th>Progress</th><th>Created</th><th></th></tr></thead><tbody>${jobs.map(x => `<tr data-job="${esc(x.job.id)}"><td><b class="mono">${esc(x.job.id.slice(0, 8))}…</b></td><td>${esc(x.job.course_name)}</td><td>${statusBadge(x.job.status)}</td><td><div class="table-progress">${progress(x.progress_percent)} <span>${Math.round(x.progress_percent)}%</span></div></td><td>${dateTime(x.job.created_at)}</td><td>›</td></tr>`).join('')}</tbody></table></div>`;
}

async function dashboard() {
  state.loading = true; state.error = '';
  try { await loadJobs(); } catch (e) { state.error = e.message; }
  state.loading = false;
  const s = stats(state.jobs), rate = s.total ? Math.round(s.success / s.total * 100) : 0;
  const body = `<section class="hero-dashboard"><div class="hero-copy"><p class="eyebrow">CERTIFICATE OPERATIONS</p><h1>Certificate command center</h1><p class="muted">Track bulk generation, inspect failures, and move from upload to download without leaving the console.</p><div class="hero-actions">${button('#create', 'Create job')}<a class="button ghost" href="#jobs">Review jobs</a></div></div><div class="certificate-preview" aria-hidden="true"><span>Certificate</span><b>Recipient Name</b><small>Course completion verified</small><i></i></div></section><section class="stats">${[['Total certificates', s.total, 'Across tracked jobs', 'purple'], ['Successful', s.success, `${rate}% success rate`, 'green'], ['Failed', s.failed, 'Needs attention', 'red'], ['Active jobs', s.active, 'Currently processing', 'blue']].map(([label, value, note, tone]) => `<div class="stat"><span class="stat-icon ${tone}"></span><div><small>${label}</small><strong>${value}</strong><em>${note}</em></div></div>`).join('')}</section><div class="dash-grid"><section class="card activity-card"><div class="card-head"><div><h2>Recent jobs</h2><p class="muted">Live activity from submitted browser-tracked jobs</p></div><a href="#jobs" class="link">View all</a></div>${state.loading ? '<div class="state">Loading live data…</div>' : state.error ? errorBox(state.error) : jobRows(state.jobs.slice(0, 6))}</section><aside class="side-stack"><section class="card outcome"><div class="card-head"><div><h2>Outcome overview</h2><p class="muted">Successful vs failed certificates</p></div></div><div class="donut" style="--rate:${rate}%"><b>${rate}%</b><small>success</small></div><div class="legend"><span><i class="green-dot"></i>Successful <b>${s.success}</b></span><span><i class="amber-dot"></i>Failed <b>${s.failed}</b></span></div></section></aside></div>`;
  document.querySelector('#app').innerHTML = shell(body); bindCommon(); pollActive();
}

function createPage() {
  const rows = [{ name: '', email: '' }];
  const body = `${title('Create generation job', 'Submit a batch of recipients to generate certificates from the predefined template.') }<form id="create-form" class="card form"><div class="form-grid"><label>Course name<input name="course" required minlength="2" placeholder="e.g. Python Backend Development"></label><label>Issuer name<input name="issuer" required minlength="2" placeholder="e.g. Example Academy"></label><label>Issue date<input name="issue_date" required type="date" value="${new Date().toISOString().slice(0, 10)}"></label></div><hr><div class="recipient-head"><div><h2>Recipients</h2><p class="muted">Each row becomes one certificate. Emails must be unique.</p></div><label class="csv">▣ Import CSV<input id="csv" type="file" accept=".csv,text/csv"></label></div><p id="csv-status" class="muted"></p><div id="recipients">${rows.map((r, i) => recipientRow(r, i)).join('')}</div><button type="button" class="button secondary" data-action="add-recipient">+ Add recipient</button><div id="form-error"></div><div class="form-actions"><a href="#dashboard" class="button secondary">Cancel</a><button class="button primary" type="submit">Create generation job ›</button></div></form>`;
  document.querySelector('#app').innerHTML = shell(body); bindCommon(); document.querySelector('#create-form').addEventListener('submit', submitJob); document.querySelector('#csv').addEventListener('change', importCsv);
}
function recipientRow(r, i) { return `<div class="recipient"><span>${String(i + 1).padStart(2, '0')}</span><input required name="recipient_name" placeholder="Recipient name" value="${esc(r.name)}"><input required type="email" name="recipient_email" placeholder="Email address" value="${esc(r.email)}"><button type="button" data-action="remove-recipient">×</button></div>`; }
function addRecipient() { const box = document.querySelector('#recipients'); const i = box.children.length; box.insertAdjacentHTML('beforeend', recipientRow({ name: '', email: '' }, i)); bindCommon(); }
function parseCsv(text) {
  const input = String(text).replace(/^\uFEFF/, '');
  const delimiter = detectCsvDelimiter(input);
  const rows = [];
  let row = [], value = '', quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    const next = input[index + 1];
    if (character === '"') {
      if (quoted && next === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(value);
      value = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && next === '\n') index += 1;
      row.push(value);
      if (row.some(cell => cell.trim())) rows.push(row);
      row = [];
      value = '';
    } else {
      value += character;
    }
  }
  if (value || row.length) {
    row.push(value);
    if (row.some(cell => cell.trim())) rows.push(row);
  }
  return rows.map(row => row.map(cell => cell.trim()));
}

function detectCsvDelimiter(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const candidates = [',', ';', '\t'];
  return candidates.reduce((best, candidate) => (
    firstLine.split(candidate).length > firstLine.split(best).length ? candidate : best
  ), ',');
}

function importCsv(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const rows = parseCsv(reader.result);
      if (!rows.length) throw new Error('The CSV file is empty.');

      const normalizedHeader = rows[0].map(cell => cell.toLowerCase().replace(/[^a-z]/g, ''));
      const nameIndex = normalizedHeader.findIndex(cell => ['name', 'fullname', 'recipientname'].includes(cell));
      const emailIndex = normalizedHeader.findIndex(cell => ['email', 'emailaddress', 'recipientemail'].includes(cell));
      const hasHeader = nameIndex !== -1 && emailIndex !== -1;
      const dataRows = rows.slice(hasHeader ? 1 : 0);
      const recipientRows = dataRows
        .map((row, rowIndex) => ({
          name: (row[hasHeader ? nameIndex : 0] || '').trim(),
          email: (row[hasHeader ? emailIndex : 1] || '').trim(),
          rowNumber: rowIndex + (hasHeader ? 2 : 1),
        }))
        .filter(row => row.name || row.email);

      const invalidRow = recipientRows.find(row => !row.name || !row.email);
      if (invalidRow) {
        throw new Error(`CSV row ${invalidRow.rowNumber} must contain both a name and an email.`);
      }
      if (!recipientRows.length) throw new Error('No recipient rows were found in the CSV.');

      document.querySelector('#recipients').innerHTML = recipientRows
        .map((recipient, index) => recipientRow(recipient, index))
        .join('');
      document.querySelector('#csv-status').textContent = `${recipientRows.length} recipient${recipientRows.length === 1 ? '' : 's'} imported from ${file.name}.`;
      document.querySelector('#form-error').innerHTML = '';
      bindCommon();
    } catch (error) {
      document.querySelector('#csv-status').textContent = '';
      document.querySelector('#form-error').innerHTML = `<p class="form-error">${esc(error.message)}</p>`;
      e.target.value = '';
    }
  };
  reader.onerror = () => {
    document.querySelector('#form-error').innerHTML = '<p class="form-error">The CSV file could not be read.</p>';
  };
  reader.readAsText(file);
}
async function submitJob(e) { e.preventDefault(); const form = e.target, button = form.querySelector('button[type=submit]'), names = [...form.querySelectorAll('[name=recipient_name]')], emails = [...form.querySelectorAll('[name=recipient_email]')]; const payload = { course_name: form.course.value.trim(), issuer_name: form.issuer.value.trim(), issue_date: form.issue_date.value, recipients: names.map((input, i) => ({ name: input.value.trim(), email: emails[i].value.trim() })) }; button.disabled = true; button.textContent = 'Submitting…'; try { const job = await api.createJob(payload); rememberJob(job.id); location.hash = `#jobs/${job.id}`; } catch (error) { document.querySelector('#form-error').innerHTML = `<p class="form-error">${esc(error.message)}</p>`; button.disabled = false; button.textContent = 'Create generation job ›'; } }

async function jobsPage() {
  try { await loadJobs(); } catch (e) { state.error = e.message; }
  const filtered = state.jobs.filter(x => (state.filter === 'all' || x.job.status === state.filter) && `${x.job.id} ${x.job.course_name}`.toLowerCase().includes(state.search.toLowerCase()));
  const body = `${title('Generation jobs', 'Search and inspect jobs submitted from this dashboard.', button('#create', 'Create job'))}<div class="notice">ⓘ The backend does not expose a list-all-jobs endpoint. This view shows jobs tracked by this browser after submission.</div><section class="card"><div class="toolbar"><label class="search">⌕<input id="search" placeholder="Search jobs…" value="${esc(state.search)}"></label><select id="filter"><option value="all">All statuses</option>${['pending', 'running', 'completed', 'partial', 'failed'].map(s => `<option ${state.filter === s ? 'selected' : ''} value="${s}">${s[0].toUpperCase() + s.slice(1)}</option>`).join('')}</select></div>${state.error ? errorBox(state.error) : jobRows(filtered)}</section>`;
  document.querySelector('#app').innerHTML = shell(body); bindCommon(); document.querySelector('#search').addEventListener('input', e => { state.search = e.target.value; jobsPage(); }); document.querySelector('#filter').addEventListener('change', e => { state.filter = e.target.value; jobsPage(); }); pollActive();
}

async function detailPage(id) {
  try { state.job = await api.getJob(id); rememberJob(id); } catch (e) { document.querySelector('#app').innerHTML = shell(errorBox(e.message)); bindCommon(); return; }
  const { job, certificates, progress_percent: percent } = state.job, pending = job.total - job.success_count - job.failure_count;
  const body = `${title('Job details', `Tracking generation job ${job.id}`, button('#jobs', 'Back to jobs', false))}<div class="detail card"><div><span class="mono">${esc(job.id)}</span><h2>${esc(job.course_name)}</h2><p class="muted">Issued by ${esc(job.issuer_name)} on ${date(job.issue_date)}</p></div>${statusBadge(job.status)}</div><div class="detail-stats">${[['Total', job.total, ''], ['Successful', job.success_count, 'good'], ['Failed', job.failure_count, 'bad'], ['Pending', pending, '']].map(([l, v, c]) => `<div><small>${l}</small><b class="${c}">${v}</b></div>`).join('')}</div><section class="card progress-card"><div class="card-head"><div><h2>Generation progress</h2><p class="muted">${percent}% complete · ${job.status === 'running' ? 'Processing certificates now' : 'Status is up to date'}</p></div><b class="percent">${Math.round(percent)}%</b></div>${progress(percent)}</section><section class="card"><div class="card-head"><div><h2>Recipients</h2><p class="muted">${certificates.length} certificate records</p></div></div>${certificateRows(certificates)}</section>`;
  document.querySelector('#app').innerHTML = shell(body); bindCommon(); if (!TERMINAL.has(job.status)) setTimeout(() => detailPage(id), 1500);
}
function certificateRows(items) { if (!items.length) return empty('No recipient records found.'); return `<div class="table-scroll"><table><thead><tr><th>Recipient</th><th>Email</th><th>Status</th><th>Details</th><th></th></tr></thead><tbody>${items.map(c => `<tr><td><b>${esc(c.recipient_name)}</b></td><td class="muted">${esc(c.recipient_email)}</td><td>${statusBadge(c.status)}</td><td>${c.error_message ? `<span class="failure">${esc(c.error_message)}</span>` : `<span class="muted">${c.status === 'success' ? 'Ready to download' : 'Waiting to process'}</span>`}</td><td>${c.status === 'success' ? `<button class="download" data-download="${esc(c.id)}">↓</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`; }
function pollActive() { if (state.jobs.some(x => !TERMINAL.has(x.job.status))) setTimeout(() => { if (state.page === 'dashboard' || state.page === 'jobs') route(); }, 3000); }
function bindCommon() { document.querySelectorAll('[data-action="add-recipient"]').forEach(x => x.addEventListener('click', addRecipient)); document.querySelectorAll('[data-action="remove-recipient"]').forEach(x => x.addEventListener('click', e => e.target.closest('.recipient').remove())); document.querySelectorAll('[data-action="open-menu"]').forEach(x => x.addEventListener('click', () => { state.menuOpen = true; route(); })); document.querySelectorAll('[data-action="close-menu"]').forEach(x => x.addEventListener('click', () => { state.menuOpen = false; route(); })); document.querySelectorAll('[data-job]').forEach(x => x.addEventListener('click', () => location.hash = `#jobs/${x.dataset.job}`)); document.querySelectorAll('[data-download]').forEach(x => x.addEventListener('click', async () => { const blob = await api.download(x.dataset.download); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'certificate.pdf'; a.click(); URL.revokeObjectURL(a.href); })); }
function route() { const parts = location.hash.slice(1).split('/'); state.page = parts[0] || 'dashboard'; state.menuOpen = false; if (state.page === 'dashboard') dashboard(); else if (state.page === 'create') createPage(); else if (state.page === 'jobs' && parts[1]) detailPage(parts[1]); else if (state.page === 'jobs') jobsPage(); else dashboard(); }
window.addEventListener('hashchange', route); route();
