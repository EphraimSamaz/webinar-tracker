'use strict';
// Webinar dashboard. All database requests go through the server-side API.
const $ = (id) => document.getElementById(id);
const paths = {
  dashboard: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  video: '<rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 10 5-3v10l-5-3"/>',
  report: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h6"/>',
  chart: '<path d="M4 3v17h17M8 15v-4m5 4V7m5 8V4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-16a3 3 0 0 1 0 6m3 10v-3a6 6 0 0 0-2-4"/>',
  award: '<circle cx="12" cy="8" r="5"/><path d="m8 12-2 9 6-3 6 3-2-9"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  edit: '<path d="m16 3 5 5-12 12H4v-5zM13 6l5 5"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
};
const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.chart}</svg>`;
document.querySelectorAll('[data-icon]').forEach((node) => { node.innerHTML = icon(node.dataset.icon); });
const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const number = (value) => new Intl.NumberFormat('en-ZA').format(value);
const rate = (row) => row.registrants ? Math.round(row.attendees / row.registrants * 100) : 0;
const monthName = (month) => new Date(`${month}-01T12:00:00+02:00`).toLocaleDateString('en-ZA', {month:'long', year:'numeric', timeZone:'Africa/Johannesburg'});
const dateLabel = (value) => new Date(`${value}+02:00`).toLocaleDateString('en-GB', {day:'2-digit',month:'short',year:'numeric',timeZone:'Africa/Johannesburg'});
let webinars = [];
let accessKey = sessionStorage.getItem('webinarAccessKey') || '';
const apiBase = (window.WEBINAR_API_BASE || '').replace(/\/$/, '');
async function apiRequest(method = 'GET', id = '', body) {
  const response = await fetch(`${apiBase}/api/webinars${id ? `?id=${encodeURIComponent(id)}` : ''}`, {
    method,
    headers: {Authorization: `Bearer ${accessKey}`, ...(body ? {'Content-Type':'application/json'} : {})},
    ...(body ? {body:JSON.stringify(body)} : {}),
    cache:'no-store',
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) { sessionStorage.removeItem('webinarAccessKey'); accessKey = ''; $('accessDialog').showModal(); }
    throw new Error(result.error || `Request failed (${response.status})`);
  }
  return result;
}
async function loadWebinars() {
  try {
    webinars = await apiRequest();
    $('connectionStatus').textContent = 'Connected';
    $('connectionStatus').closest('.preview-pill').classList.add('is-connected');
    $('connectionBanner').hidden = true;
    populateMonths(); render();
    $('accessDialog').close();
    return true;
  } catch (error) {
    $('connectionStatus').textContent = 'Disconnected';
    $('connectionStatus').closest('.preview-pill').classList.remove('is-connected');
    $('connectionBanner').hidden = false;
    $('connectionMessage').textContent = error.message;
    if (accessKey) notify(error.message);
    return false;
  }
}
let reportRows = [];
let deleteId = null;
let toastTimer;
function notify(message) {
  clearTimeout(toastTimer);
  $('snackbar').textContent = message;
  $('snackbar').hidden = false;
  toastTimer = setTimeout(() => { $('snackbar').hidden = true; }, 4500);
}
function periodRows() { return webinars.filter((row) => !$('monthFilter').value || row.date_time.startsWith($('monthFilter').value)); }
function populateMonths() {
  const selected = $('monthFilter').value;
  const months = [...new Set(webinars.map((row) => row.date_time.slice(0,7)))].sort().reverse();
  $('monthFilter').replaceChildren(new Option('All months', ''), ...months.map((month) => new Option(monthName(month), month)));
  $('monthFilter').value = months.includes(selected) ? selected : '';
}
function statsMarkup(rows) {
  const registrants = rows.reduce((sum,row) => sum + row.registrants,0);
  const attendees = rows.reduce((sum,row) => sum + row.attendees,0);
  const duration = rows.reduce((sum,row) => sum + row.duration,0);
  const stats = [
    ['Total webinars',number(rows.length),`${number(duration)} minutes of learning`,'video'],
    ['Registrants',number(registrants),'Across selected sessions','users'],
    ['Attendees',number(attendees),'Total session attendances','users'],
    ['Attendance rate',registrants ? `${Math.round(attendees/registrants*100)}%` : '—','Attendees ÷ registrants','chart'],
  ];
  return stats.map(([label,value,caption,name]) => `<article class="stat-card"><div class="stat-top"><span>${label}</span><span class="icon-tile">${icon(name)}</span></div><div class="stat-value">${value}</div><p>${caption}</p></article>`).join('');
}
function renderChart(rows) {
  const recent = [...rows].sort((a,b) => b.date_time.localeCompare(a.date_time)).slice(0,6).reverse();
  const max = Math.max(1,...recent.map((row) => row.registrants));
  $('engagementChart').innerHTML = recent.length ? recent.map((row) => `<div class="chart-column" role="img" aria-label="${escapeHTML(row.name)}: ${row.registrants} registrants, ${row.attendees} attendees"><div class="bar-pair" aria-hidden="true"><div class="bar" style="height:${row.registrants/max*88}%"><span class="bar-value">${row.registrants}</span></div><div class="bar attended" style="height:${row.attendees/max*88}%"><span class="bar-value">${row.attendees}</span></div></div><span class="chart-label" aria-hidden="true">${dateLabel(row.date_time).slice(0,6)}</span></div>`).join('') : '<div class="empty-state"><p>Add a webinar to see engagement.</p></div>';
}
function renderSpotlight(rows) {
  const best = [...rows].filter(row => row.registrants > 0).sort((a,b) => rate(b)-rate(a) || b.attendees-a.attendees)[0];
  $('spotlightContent').innerHTML = best ? `<span class="spotlight-tag">Highest attendance rate</span><h3>${escapeHTML(best.name)}</h3><p class="session-meta">${escapeHTML(best.host)} · ${dateLabel(best.date_time)}</p><div class="spotlight-rate">${rate(best)}<span>%</span></div><p class="spotlight-caption">of registrants attended</p><div class="progress" aria-hidden="true"><span style="width:${Math.min(rate(best),100)}%"></span></div><p class="spotlight-footer">${number(best.attendees)} attendees out of ${number(best.registrants)} registrants</p>` : '<p>No audience results yet. Add a session with registrations to see your spotlight.</p>';
}
function renderTable(rows) {
  const search = $('searchInput').value.trim().toLowerCase();
  const filtered = rows.filter((row) => `${row.name} ${row.host}`.toLowerCase().includes(search));
  const sorts = {newest:(a,b)=>b.date_time.localeCompare(a.date_time),oldest:(a,b)=>a.date_time.localeCompare(b.date_time),attendance:(a,b)=>rate(b)-rate(a),name:(a,b)=>a.name.localeCompare(b.name)};
  filtered.sort(sorts[$('sortOrder').value]);
  $('webinarList').innerHTML = filtered.map((row) => `<tr><td><span class="session-name">${escapeHTML(row.name)}</span><span class="session-host">${escapeHTML(row.host)}</span></td><td><span class="session-date">${dateLabel(row.date_time)}</span><span class="time">${row.date_time.slice(11,16)} SAST</span></td><td>${row.duration} min</td><td>${number(row.registrants)}</td><td>${number(row.attendees)}</td><td><div class="table-rate"><div class="progress" aria-hidden="true"><span style="width:${Math.min(rate(row),100)}%"></span></div>${row.registrants ? rate(row)+'%' : '—'}</div></td><td><div class="row-actions"><button class="icon-button" data-edit="${escapeHTML(row.id)}" aria-label="Edit ${escapeHTML(row.name)}">${icon('edit')}</button><button class="icon-button" data-delete="${escapeHTML(row.id)}" aria-label="Remove ${escapeHTML(row.name)}">${icon('trash')}</button></div></td></tr>`).join('');
  $('emptyState').hidden = filtered.length > 0;
  $('tableCount').textContent = filtered.length;
  $('resultCount').textContent = `Showing ${filtered.length} of ${rows.length} webinars in this period`;
}
function render() {
  const rows = periodRows();
  $('summaryStats').innerHTML = statsMarkup(rows);
  $('navCount').textContent = webinars.length;
  renderChart(rows); renderSpotlight(rows); renderTable(rows);
  $('generateReport').disabled = !rows.length;
  $('reportsNav').disabled = !rows.length;
}
function openForm(id) {
  $('webinarForm').reset();
  $('formError').textContent = '';
  const row = webinars.find((row) => row.id === id);
  $('formTitle').textContent = row ? 'Edit webinar' : 'Add webinar';
  $('webinarId').value = row?.id || '';
  if (row) {
    for (const [field,key] of [['webinarName','name'],['hostName','host'],['webinarDateTime','date_time'],['webinarDuration','duration'],['webinarRegistrants','registrants'],['webinarAttendees','attendees']]) $(field).value = row[key];
  }
  $('webinarDialog').showModal();
  $('webinarName').focus();
}
$('addWebinar').addEventListener('click', () => openForm());
$('webinarForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const row = {name:$('webinarName').value.trim(),host:$('hostName').value.trim(),date_time:$('webinarDateTime').value,duration:Number($('webinarDuration').value),registrants:Number($('webinarRegistrants').value),attendees:Number($('webinarAttendees').value)};
  if (!row.name || !row.host) { $('formError').textContent = 'Enter a webinar name and host.'; return; }
  const editing = Boolean($('webinarId').value);
  const saveButton = $('webinarForm').querySelector('[type=submit]');
  saveButton.disabled = true;
  try {
    await apiRequest(editing ? 'PUT' : 'POST', $('webinarId').value, row);
    if (!await loadWebinars()) throw new Error('Saved, but the webinar list could not be refreshed. Reload the page.');
  } catch (error) {
    $('formError').textContent = error.message;
    saveButton.disabled = false;
    return;
  }
  saveButton.disabled = false;
  populateMonths();
  if ($('monthFilter').value && !row.date_time.startsWith($('monthFilter').value)) $('monthFilter').value = row.date_time.slice(0,7);
  $('searchInput').value = '';
  render(); $('webinarDialog').close();
  notify(editing ? 'Webinar updated.' : 'Webinar added.');
});
$('webinarList').addEventListener('click', (event) => {
  const edit = event.target.closest('[data-edit]');
  const remove = event.target.closest('[data-delete]');
  if (edit) openForm(edit.dataset.edit);
  if (remove) {
    deleteId = remove.dataset.delete;
    $('deleteDescription').textContent = webinars.find((row) => row.id === deleteId).name;
    $('deleteDialog').showModal();
  }
});
$('confirmDelete').addEventListener('click', async () => {
  $('confirmDelete').disabled = true;
  try {
    await apiRequest('DELETE', deleteId);
    if (!await loadWebinars()) throw new Error('Removed, but the webinar list could not be refreshed. Reload the page.');
    $('deleteDialog').close(); $('addWebinar').focus(); notify('Webinar removed.');
  } catch (error) { notify(error.message); }
  $('confirmDelete').disabled = false;
});
document.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => $(button.dataset.close).close()));
$('monthFilter').addEventListener('change', render);
$('searchInput').addEventListener('input', () => renderTable(periodRows()));
$('sortOrder').addEventListener('change', () => renderTable(periodRows()));
$('clearFilters').addEventListener('click', () => { $('monthFilter').value = ''; $('searchInput').value = ''; render(); $('searchInput').focus(); });
function openReport() {
  reportRows = [...periodRows()].sort((a,b) => b.date_time.localeCompare(a.date_time));
  if (!reportRows.length) return;
  $('reportPeriod').textContent = `${$('monthFilter').value ? monthName($('monthFilter').value) : 'All months'} · All sessions in this period · SAST`;
  $('reportContent').innerHTML = `<div class="stats-grid">${statsMarkup(reportRows)}</div><div class="table-scroll"><table><thead><tr><th>Session / host</th><th>Date</th><th>Minutes</th><th>Registrants</th><th>Attendees</th><th>Rate</th></tr></thead><tbody>${reportRows.map((row) => `<tr><td><strong>${escapeHTML(row.name)}</strong><span class="session-host">${escapeHTML(row.host)}</span></td><td>${dateLabel(row.date_time)}<span class="time">${row.date_time.slice(11,16)} SAST</span></td><td>${row.duration}</td><td>${row.registrants}</td><td>${row.attendees}</td><td>${row.registrants ? rate(row)+'%' : '—'}</td></tr>`).join('')}</tbody></table></div>`;
  $('reportDialog').showModal();
}
$('generateReport').addEventListener('click', openReport);
$('reportsNav').addEventListener('click', openReport);
$('printReport').addEventListener('click', () => window.print());
function csvCell(value) {
  let text = String(value);
  if (/^[\s]*[=+@-]/.test(text)) text = "'" + text;
  return `"${text.replace(/"/g,'""')}"`;
}
$('exportReport').addEventListener('click', () => {
  const rows = [['Name','Date & time (SAST)','Duration (min)','Host','Registrants','Attendees','Attendance rate'],...reportRows.map((row) => [row.name,row.date_time.replace('T',' '),row.duration,row.host,row.registrants,row.attendees,row.registrants ? `${rate(row)}%` : 'N/A'])];
  const blob = new Blob(['\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = `remax-webinars-${$('monthFilter').value || 'all-months'}.csv`; link.click();
  setTimeout(() => URL.revokeObjectURL(url),1000);
});
function updateNav() { document.querySelectorAll('[data-nav]').forEach((link) => { const active = link.dataset.nav === (location.hash === '#webinars' ? 'webinars' : 'overview'); link.classList.toggle('active',active); if (active) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current'); }); }
window.addEventListener('hashchange',updateNav);
$('accessForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  accessKey = $('accessKey').value;
  $('accessError').textContent = '';
  try {
    webinars = await apiRequest();
    sessionStorage.setItem('webinarAccessKey', accessKey);
    $('accessKey').value = '';
    await loadWebinars();
  } catch (error) { $('accessError').textContent = error.message; }
});
populateMonths(); render(); updateNav();
if (accessKey) loadWebinars(); else $('accessDialog').showModal();
