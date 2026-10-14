import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js';
import { browserLocalPersistence, GoogleAuthProvider, getAuth, getIdTokenResult, onAuthStateChanged, setPersistence, signInWithPopup, signOut } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js';
import { collection, doc, getDoc, getDocs, getFirestore, onSnapshot } from 'https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });
const persistence = setPersistence(auth, browserLocalPersistence).catch(() => {});
const el = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize = value => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const cityKey = value => normalize(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const count = value => value == null ? '—' : new Intl.NumberFormat('it-IT').format(value);
const safeUrl = value => { try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } };
const link = (label, value) => safeUrl(value) ? `<a href="${esc(safeUrl(value))}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>` : esc(label);
const date = value => { const parsed = new Date(value); return value && !Number.isNaN(parsed.getTime()) ? new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', dateStyle: 'long', timeStyle: 'medium' }).format(parsed) : '—'; };
const eventDate = value => { if (!value) return 'Data da verificare'; const parsed = new Date(value.length === 10 ? `${value}T12:00:00+01:00` : value); return Number.isNaN(parsed.getTime()) ? 'Data da verificare' : new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', dateStyle: 'medium' }).format(parsed); };
const statusLabels = { ok: 'Lettura riuscita', partial: 'Lettura parziale', failed: 'Lettura fallita', not_scanned: 'Non letta in questa raccolta' };
const badge = status => `<span class="oracle-status ${esc(status || 'not_scanned')}">${esc(statusLabels[status] || statusLabels.not_scanned)}</span>`;
const errorTypes = {
  dns: ['Indirizzo non raggiungibile', 'Il nome del sito non viene risolto.'],
  timeout: ['Timeout', 'Il sito non ha risposto entro il tempo previsto.'],
  tls: ['Certificato o connessione HTTPS', 'La connessione HTTPS non supera i controlli di sicurezza.'],
  forbidden: ['Accesso negato · 403', 'Il sito ha rifiutato la richiesta di lettura.'],
  not_found: ['Pagina non trovata · 404', 'Il collegamento letto non porta a una pagina disponibile.'],
  http: ['Altro errore HTTP', 'Il sito ha restituito una risposta di errore.'],
  connection: ['Connessione non riuscita', 'Non è stato possibile stabilire la connessione al sito.'],
  other: ['Altro problema di lettura', 'Il rapporto segnala una lettura incompleta o non riuscita.'],
};
const hasReadingIssue = row => ['failed', 'partial'].includes(row.status) || Number(row.failedPages) > 0;
function readingErrorType(row) {
  const text = normalize(row.message);
  if (/nameresolutionerror|failed to resolve|name or service not known|getaddrinfo|nodename nor servname/.test(text)) return 'dns';
  if (/certificate|sslerror|sslcert|\[ssl:|tls|dh_key_too_small/.test(text)) return 'tls';
  if (/\b403\b|forbidden/.test(text)) return 'forbidden';
  if (/\b404\b|not found/.test(text)) return 'not_found';
  if (/timed?\s*out|timeout/.test(text)) return 'timeout';
  if (/\b[45]\d{2}\b.*(?:client error|server error)|(?:client error|server error).*\b[45]\d{2}\b/.test(text)) return 'http';
  if (/connectionerror|newconnectionerror|connection refused|failed to establish|connection reset|network is unreachable/.test(text)) return 'connection';
  return 'other';
}
const reasons = { ambiguous_concert_replica: 'Possibili concerti o repliche da distinguere', missing_date: 'Data da verificare', missing_title: 'Titolo da verificare', non_concert: 'Contenuto diverso da un concerto', no_jazz_evidence: 'Genere jazz da confermare', ambiguous_multi_day: 'Evento su più giorni da distinguere' };

let report = null;
let view = 'cities';
let page = 0;
let unsubscribe = null;
let generation = 0;
let loadedRun = '';
let loadingRun = '';
const PAGE_SIZE = 35;

function connection(label, error = false) {
  el('connectionLabel').textContent = label;
  el('connectionStatus').classList.toggle('error', error);
}

function message(text = '', error = false) {
  el('dataMessage').textContent = text;
  el('dataMessage').classList.toggle('error', error);
}

function resetReport() {
  report = null; loadedRun = ''; loadingRun = ''; page = 0;
  for (const id of ['sourceCount','admittedCount','reviewCount','capitalsWithEvents','okCount','errorCount','scannedSources','capitalCount','errorDetail']) el(id).textContent = '—';
  el('scanTitle').textContent = 'In attesa dei risultati';
  el('scanDescription').textContent = 'Il rapporto compare al termine della prima scansione sincronizzata.';
  el('lastAttempt').hidden = true;
  el('errorTabCount').textContent = '—';
  el('errorOverviewText').textContent = 'I problemi compariranno quando il rapporto sarà disponibile.';
  el('tableBody').replaceChildren();
  el('pagination').hidden = true;
  message();
  render();
}

function options(select, values, initial, valueFn = value => value) {
  const previous = select.value;
  select.innerHTML = `<option value="">${esc(initial)}</option>` + values.map(value => `<option value="${esc(valueFn(value))}">${esc(value)}</option>`).join('');
  if ([...select.options].some(option => option.value === previous)) select.value = previous;
}

function updateFilters() {
  const cityRows = report?.cities || [];
  const sourceRows = report?.sources || [];
  options(el('regionFilter'), [...new Set([...cityRows, ...sourceRows].map(row => row.region).filter(Boolean))].sort((a,b) => a.localeCompare(b,'it')), 'Tutte le regioni');
  options(el('cityFilter'), [...new Set([...sourceRows, ...(report?.events || []), ...(report?.review || [])].map(row => row.city).filter(Boolean))].sort((a,b) => a.localeCompare(b,'it')), 'Tutte le città', cityKey);
}

function setView(next) {
  if (next === 'errors' && view !== 'errors') {
    for (const id of ['searchInput', 'regionFilter', 'cityFilter']) el(id).value = '';
  }
  view = next; page = 0;
  document.querySelectorAll('.oracle-tab').forEach(button => {
    const active = button.dataset.view === view;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  el('cityFilterField').hidden = !['events', 'review', 'errors'].includes(view);
  el('statusFilterField').hidden = !['cities', 'sources', 'errors'].includes(view);
  el('errorTypeFilterField').hidden = view !== 'errors';
  el('errorOverview').hidden = view !== 'errors';
  el('errorTypeFilter').value = '';
  el('searchInput').placeholder = view === 'errors' ? 'Cerca fonte, città o messaggio di errore' : 'Cerca città, fonte o concerto';
  const values = view === 'errors' ? [['','Tutti i problemi'], ['failed','Letture fallite'], ['partial','Letture parziali'], ['pages','Con errori di pagina']] : view === 'cities' ? [['', 'Tutte le città'], ['events','Con eventi ammessi'], ['gap','Magazine locale da cercare'], ['errors','Con errori di lettura']] : [['','Tutte le fonti'], ['ok','Letture riuscite'], ['partial','Letture parziali'], ['failed','Letture fallite'], ['not_scanned','Non lette']];
  el('statusFilter').innerHTML = values.map(([value,label]) => `<option value="${esc(value)}">${esc(label)}</option>`).join('');
  render();
}

function filteredRows() {
  const region = el('regionFilter').value;
  const search = normalize(el('searchInput').value).trim();
  const city = el('cityFilter').value;
  const status = el('statusFilter').value;
  const regionsByCity = new Map((report?.cities || []).map(row => [cityKey(row.city), row.region]));
  const baseRows = view === 'errors' ? (report?.sources || []).filter(hasReadingIssue) : report?.[view] || [];
  return baseRows.filter(row => {
    const rowRegion = row.region || regionsByCity.get(cityKey(row.city)) || '';
    if (region && rowRegion !== region) return false;
    const searchable = [row.city,row.province,row.name,row.localMagazine,row.title,row.venueName,row.sourceId];
    if (view === 'errors') searchable.push(row.message, errorTypes[readingErrorType(row)][0]);
    if (search && !normalize(searchable.join(' ')).includes(search)) return false;
    if (['events','review','errors'].includes(view) && city && cityKey(row.city) !== city) return false;
    if (view === 'sources' && status && row.status !== status) return false;
    if (view === 'errors') {
      if (status === 'pages' ? !(Number(row.failedPages) > 0) : status && row.status !== status) return false;
      if (el('errorTypeFilter').value && readingErrorType(row) !== el('errorTypeFilter').value) return false;
    }
    if (view === 'cities') {
      if (status === 'events' && !(row.admitted > 0)) return false;
      if (status === 'gap' && row.localMagazine) return false;
      if (status === 'errors' && !['partial','failed'].includes(row.status)) return false;
    }
    return true;
  }).sort((a,b) => ['events','review'].includes(view) ? String(a.startsAt).localeCompare(String(b.startsAt)) || a.city.localeCompare(b.city,'it') : (a.city || a.name || '').localeCompare(b.city || b.name || '', 'it'));
}

function cityRow(row) {
  const sources = (report?.sources || []).filter(source => cityKey(source.city) === cityKey(row.city));
  const additional = sources.filter(source => !source.publisherId.startsWith('tacco')).slice(0,4);
  return `<tr><td><strong>${esc(row.city)}</strong><small>${esc(row.region)} · ${esc(row.province)}</small></td><td><span class="oracle-number">${count(row.admitted)}</span><small>${count(row.candidates)} candidati trovati · ${count(row.review)} da verificare</small>${row.admitted > 0 ? `<button class="city-events-button" type="button" data-city="${esc(cityKey(row.city))}">Vedi eventi di ${esc(row.city)} →</button>` : ''}</td><td>${link('Il Tacco di Bacco', row.agendaUrl)}<small>${count(row.scannedSources)} fonti lette su ${count(row.sourceCount)}</small>${badge(row.status)}</td><td>${row.localMagazine ? link(row.localMagazine, row.localMagazineUrl) : '<span>Magazine locale da cercare</span>'}<small>${esc(row.localMagazineStatus)}</small></td><td>${additional.length ? additional.map(source => link(source.name,source.url)).join('<br>') : 'Altre fonti cittadine da aggiungere'}<small>${esc(row.coverageNote)}</small></td></tr>`;
}

function sourceRow(row) {
  return `<tr><td><strong>${link(row.name,row.url)}</strong><small>${esc(row.sourceId)} · ${esc(row.feedId)}</small></td><td>${esc(row.city || 'Più città')}<small>${esc(row.region)}</small></td><td>${badge(row.status)}<small>${row.message ? esc(row.message) : row.checkedAt ? date(row.checkedAt) : 'Fuori dalla selezione di questa raccolta'}</small></td><td><span class="oracle-number">${count(row.admitted)}</span><small>${count(row.candidates)} candidati estratti</small></td><td>${count(row.pages)} pagine lette<small>${count(row.failedPages)} errori di pagina</small></td></tr>`;
}

function errorRow(row) {
  const [label, description] = errorTypes[readingErrorType(row)];
  const detail = row.message ? `<details class="oracle-error-details"><summary>Messaggio dal rapporto</summary><pre>${esc(row.message)}</pre></details>` : '<small>Il rapporto non contiene un messaggio di errore.</small>';
  return `<tr><td><strong>${link(row.name,row.url)}</strong><small>${esc(row.sourceId)} · ${esc(row.feedId)}</small></td><td>${esc(row.city || 'Più città')}<small>${esc(row.region)}</small></td><td>${badge(row.status)}<small>Controllata: ${date(row.checkedAt)}</small></td><td><strong class="oracle-error-kind">${esc(label)}</strong><small>${esc(description)}</small>${detail}</td><td>${count(row.failedPages)} errori di pagina<small>${count(row.pages)} pagine lette · ${count(row.candidates)} candidati</small><small>${count(row.admitted)} eventi ammessi</small></td></tr>`;
}

function eventRow(row) {
  return `<tr><td><strong>${esc(row.title)}</strong><small>${esc(row.venueName || 'Luogo da verificare')}</small></td><td>${eventDate(row.startsAt)}<small>${esc(row.timeLabel || 'Orario non indicato')}</small></td><td>${esc(row.city)}<small>${esc(row.region)}</small></td><td>${link(row.sourceId || 'Sito della fonte', row.sourceUrl)}</td><td>${view === 'review' ? `<span class="oracle-status partial">Da verificare</span><small>${esc(reasons[row.reason] || row.reason || 'Dati da verificare')}</small>` : '<span class="oracle-status">Ammesso e salvato</span>'}</td></tr>`;
}

function render() {
  const headings = { cities: ['Città', 'Eventi singoli ammessi', 'Agenda e lettura', 'Magazine locale', 'Altre fonti e copertura'], sources: ['Fonte', 'Città', 'Ultima lettura', 'Ammessi', 'Pagine'], errors: ['Fonte', 'Città', 'Esito della lettura', 'Tipo di problema e dettaglio', 'Pagine ed eventi'], events: ['Concerto', 'Quando', 'Dove', 'Fonte', 'Esito'], review: ['Candidato', 'Quando', 'Dove', 'Fonte', 'Verifica richiesta'] };
  const titles = { cities: 'Censimento dei capoluoghi', sources: 'Fonti dell’Oracolo', errors: 'Errori e letture da controllare', events: 'Eventi ammessi nella raccolta', review: 'Candidati da verificare' };
  el('resultsTitle').textContent = titles[view];
  el('tableHead').innerHTML = '<tr>' + headings[view].map(label => `<th scope="col">${esc(label)}</th>`).join('') + '</tr>';
  const rows = filteredRows();
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  page = Math.min(page, totalPages - 1);
  const visible = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  el('tableBody').innerHTML = visible.map(view === 'cities' ? cityRow : view === 'sources' ? sourceRow : view === 'errors' ? errorRow : eventRow).join('');
  el('emptyState').hidden = rows.length > 0;
  const issueCount = (report?.sources || []).filter(hasReadingIssue).length;
  const noIssues = report && view === 'errors' && issueCount === 0;
  el('emptyTitle').textContent = noIssues ? 'Nessun errore di lettura segnalato' : report ? 'Nessun risultato' : 'In attesa della prima raccolta';
  el('emptyDescription').textContent = noIssues ? 'L’ultima raccolta pubblicata non segnala letture fallite, parziali o errori di pagina.' : report ? 'Nessun dato corrisponde ai filtri scelti. Seleziona un’altra città o azzera i filtri.' : 'La pagina si aggiornerà automaticamente quando il rapporto sarà disponibile.';
  el('resultSummary').textContent = report ? view === 'errors' ? `${count(rows.length)} risultati su ${count(issueCount)} fonti con problemi · ${count(report.sources.length)} fonti nel rapporto · raccolta del ${date(report.run.completedAt)}` : `${count(rows.length)} risultati su ${count(report[view].length)} · raccolta del ${date(report.run.completedAt)}` : 'Nessun rapporto disponibile.';
  el('pagination').hidden = totalPages <= 1;
  el('pageLabel').textContent = `Pagina ${page + 1} di ${totalPages}`;
  el('previousPage').disabled = page === 0;
  el('nextPage').disabled = page >= totalPages - 1;
}

function renderSummary() {
  const s = report.summary;
  el('sourceCount').textContent = count(s.sourceCount);
  el('scannedSources').textContent = `${count(s.scannedSources)} lette in questa raccolta`;
  el('admittedCount').textContent = count(s.admittedCount);
  el('reviewCount').textContent = count(s.reviewCount);
  el('capitalsWithEvents').textContent = count(s.capitalsWithEvents);
  el('capitalCount').textContent = `Su ${count(s.capitalCount)} capoluoghi censiti`;
  el('okCount').textContent = count(s.ok);
  const issues = report.sources.filter(hasReadingIssue);
  el('errorCount').textContent = count(issues.length);
  el('errorTabCount').textContent = count(issues.length);
  const other = issues.filter(row => !['failed', 'partial'].includes(row.status)).length;
  el('errorOverviewText').textContent = `${count(issues.filter(row => row.status === 'failed').length)} letture fallite · ${count(issues.filter(row => row.status === 'partial').length)} parziali${other ? ` · ${count(other)} altre fonti con errori di pagina` : ''}. Dati dell’ultima raccolta pubblicata; il tipo di problema è riconosciuto dal messaggio del rapporto.`;
  el('errorDetail').textContent = `${count(s.partial)} parziali · ${count(s.failed)} fallite`;
  el('scanTitle').textContent = `Completata il ${date(report.run.completedAt)}`;
  el('scanDescription').textContent = `Raccolta ${report.run.event === 'schedule' ? 'giornaliera' : 'manuale'} · ${s.partialScan ? 'selezione parziale delle fonti' : 'tutte le fonti selezionate'} · ${count(s.admittedCount)} concerti ammessi e salvati. Orario italiano.`;
  el('runLink').href = safeUrl(report.run.url) || 'https://github.com/lucacostantini80-oss/jazagora-oracle/actions/workflows/daily-oracle.yml';
  updateFilters();
  render();
}

function renderAttempt(data) {
  const attempt = data.lastAttempt;
  const show = attempt && attempt.mode !== 'production' && (!data.run || new Date(attempt.completedAt) > new Date(data.run.completedAt));
  el('lastAttempt').hidden = !show;
  if (show) el('lastAttempt').textContent = `${attempt.mode === 'dry_run' ? 'Ultima prova senza salvataggio' : 'Ultimo tentativo non completato'}: ${date(attempt.completedAt)}. Restano visibili i risultati dell’ultima raccolta pubblicata.`;
}

async function loadReport(data, currentGeneration) {
  if (!data.runDocId || data.runDocId === loadedRun || data.runDocId === loadingRun) return;
  loadingRun = data.runDocId;
  const expectedRun = loadingRun;
  el('tableBody').closest('.table-wrap').setAttribute('aria-busy', 'true');
  message('Caricamento del rapporto della raccolta…');
  try {
    const runRef = doc(db, 'oracle_dashboard', expectedRun);
    const [metadata, pages] = await Promise.all([getDoc(runRef), getDocs(collection(runRef, 'pages'))]);
    if (currentGeneration !== generation || loadingRun !== expectedRun) return;
    if (!metadata.exists()) throw new Error('Rapporto della raccolta non disponibile.');
    const info = metadata.data();
    if (info.schemaVersion !== 1 || pages.size !== info.pageCount) throw new Error('Rapporto incompleto. Premi Riconnetti per riprovare.');
    const next = { ...info, cities: [], sources: [], events: [], review: [] };
    pages.docs.sort((a,b) => a.id.localeCompare(b.id)).forEach(snapshot => {
      const pageData = snapshot.data();
      if (!['cities','sources','events','review'].includes(pageData.kind) || !Array.isArray(pageData.rows)) throw new Error('Formato del rapporto non riconosciuto.');
      next[pageData.kind].push(...pageData.rows);
    });
    if (next.events.length !== next.summary.admittedCount || next.cities.length !== next.summary.capitalCount) throw new Error('Conteggi del rapporto non coerenti.');
    report = next; loadedRun = expectedRun; page = 0;
    renderSummary(); message();
  } catch (error) {
    if (currentGeneration !== generation) return;
    message(error.code === 'permission-denied' ? 'Accesso al rapporto negato. Verifica i permessi amministrativi.' : `Impossibile caricare il rapporto. ${error.message || ''}`, true);
  } finally {
    if (currentGeneration === generation && loadingRun === expectedRun) {
      loadingRun = '';
      el('tableBody').closest('.table-wrap').removeAttribute('aria-busy');
    }
  }
}

function subscribe() {
  unsubscribe?.(); generation += 1; loadingRun = '';
  const currentGeneration = generation;
  connection('Connessione…');
  unsubscribe = onSnapshot(doc(db, 'oracle_dashboard', 'latest'), { includeMetadataChanges: true }, snapshot => {
    connection(snapshot.metadata.fromCache ? 'Dati memorizzati · connessione…' : 'Aggiornamento automatico attivo');
    const data = snapshot.data() || {};
    renderAttempt(data);
    if (!data.runDocId) { message('In attesa della prima raccolta sincronizzata. La pagina si aggiornerà automaticamente.'); return; }
    loadReport(data, currentGeneration);
  }, error => {
    connection('Connessione non disponibile', true);
    message(error.code === 'permission-denied' ? 'Lettura non autorizzata. Accedi con un account amministratore.' : 'Connessione ai risultati interrotta. Premi Riconnetti.', true);
  });
}

el('loginButton').addEventListener('click', async () => {
  el('loginButton').disabled = true;
  el('authMessage').textContent = 'Apertura accesso Google…';
  try { await persistence; await signInWithPopup(auth, provider); }
  catch (error) { el('authMessage').textContent = error.code === 'auth/popup-closed-by-user' ? 'Accesso annullato.' : 'Accesso non riuscito. Consenti la finestra Google e riprova.'; }
  finally { el('loginButton').disabled = false; }
});
el('logoutButton').addEventListener('click', () => signOut(auth));
el('refreshButton').addEventListener('click', () => { if (auth.currentUser) { loadedRun = ''; subscribe(); } });
document.querySelectorAll('.oracle-tab').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
for (const id of ['searchInput','regionFilter','cityFilter','statusFilter','errorTypeFilter']) el(id).addEventListener('input', () => { page = 0; render(); });
el('resetFilters').addEventListener('click', () => { for (const id of ['searchInput','regionFilter','cityFilter','statusFilter','errorTypeFilter']) el(id).value = ''; page = 0; render(); });
el('previousPage').addEventListener('click', () => { page = Math.max(0,page - 1); render(); });
el('nextPage').addEventListener('click', () => { page += 1; render(); });
el('tableBody').addEventListener('click', event => {
  const button = event.target.closest('[data-city]');
  if (!button) return;
  el('searchInput').value = ''; el('cityFilter').value = button.dataset.city; setView('events');
  el('resultsTitle').focus({ preventScroll: true });
});
window.addEventListener('offline', () => connection('Connessione assente · ultimi dati disponibili', true));
onAuthStateChanged(auth, async user => {
  unsubscribe?.(); unsubscribe = null; generation += 1;
  if (!user) {
    el('loginView').hidden = false; el('dashboardView').hidden = true; el('adminEmail').textContent = '';
    resetReport(); return;
  }
  try {
    const token = await getIdTokenResult(user, true);
    if (auth.currentUser?.uid !== user.uid) return;
    if (token.claims.admin !== true) { await signOut(auth); el('authMessage').textContent = 'Questo account non è autorizzato come amministratore.'; return; }
    el('authMessage').textContent = ''; el('loginView').hidden = true; el('dashboardView').hidden = false;
    el('adminEmail').textContent = user.email || 'Amministratore'; subscribe();
  } catch { await signOut(auth); el('authMessage').textContent = 'Impossibile verificare i permessi amministrativi.'; }
});
setView('cities');

