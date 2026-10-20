'use strict';
(() => {
  const $ = (selector) => document.querySelector(selector);
  const ui = { state: null, example: null, refreshing: null, busy: new Map(), highlightId: null, confirmResolve: null };
  const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  const usageCurrency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 8 });
  const statuses = { draft: 'Draft', generated: 'Generated', tested: 'Tests passed', test_failed: 'Needs attention', deployed: 'Deployment started', published: 'Public' };
  const kinds = { payout: 'Net cash received', expense: 'Additional expense', pending: 'Pending settlement', 'run-cost': 'Reported platform usage' };
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }
  function money(value, precise = false) { return (precise ? usageCurrency : currency).format(Number.isFinite(Number(value)) ? Number(value) : 0); }
  function dateText(value) {
    if (!value) return '—';
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return value;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
  function errorText(value) {
    if (typeof value === 'string') return value;
    if (value && typeof value.message === 'string') return value.message;
    return value ? JSON.stringify(value) : 'Something went wrong. Please try again.';
  }
  function toast(message, isError = false) {
    const region = $('#toast-region');
    const notice = el('div', `toast${isError ? ' is-error' : ''}`);
    notice.append(el('span', 'toast-message', message));
    const close = el('button', 'toast-close', '×');
    close.type = 'button'; close.setAttribute('aria-label', 'Dismiss notification');
    close.addEventListener('click', () => notice.remove());
    notice.append(close); region.append(notice);
    while (region.children.length > 3) region.firstElementChild.remove();
    setTimeout(() => notice.remove(), isError ? 14000 : 8000);
  }
  function formError(selector, message) { const node = $(selector); node.textContent = message || ''; node.hidden = !message; }
  async function api(path, options = {}) {
    const headers = { Accept: 'application/json' };
    if (options.method === 'POST') { headers['Content-Type'] = 'application/json'; headers['X-QF-Token'] = ui.state?.csrfToken || ''; }
    let response;
    try { response = await fetch(path, { ...options, headers, credentials: 'same-origin' }); }
    catch { throw new Error('Cannot reach the local QuotaForge server. Check that it is running, then refresh this page.'); }
    const text = await response.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; }
    catch { throw new Error(`The server returned an unreadable response (HTTP ${response.status}).`); }
    if (!response.ok) throw new Error(errorText(data.error || data.message || `Request failed (HTTP ${response.status}).`));
    return data;
  }
  function connection(ready, message) {
    const status = $('#connection-status');
    status.classList.toggle('is-ready', ready); status.classList.toggle('is-error', !ready);
    status.lastElementChild.textContent = ready ? 'Local server connected' : 'Connection unavailable';
    $('#connection-error').hidden = ready; $('#connection-error').textContent = message || '';
  }
  async function refreshState(options = {}) {
    if (ui.refreshing) return ui.refreshing;
    const button = $('#refresh-button'); button.disabled = true; button.classList.add('is-loading');
    ui.refreshing = (async () => {
      try { ui.state = await api('/api/state'); connection(true); render(); return ui.state; }
      catch (error) { connection(false, error.message); if (!options.quiet) toast(error.message, true); return null; }
      finally { button.disabled = false; button.classList.remove('is-loading'); ui.refreshing = null; }
    })();
    return ui.refreshing;
  }
  function globalButtons() {
    $('#demo-button').disabled = ui.busy.has('demo');
    $('#demo-button').querySelector('span:nth-child(2)').textContent = ui.busy.has('demo') ? 'Running local demo…' : 'Run local demo';
    $('#create-submit').disabled = ui.busy.has('create');
    $('#create-submit').firstChild.textContent = ui.busy.has('create') ? 'Creating draft… ' : 'Create draft ';
    $('#ledger-submit').disabled = ui.busy.has('ledger');
    $('#ledger-submit').textContent = ui.busy.has('ledger') ? 'Saving…' : 'Save record';
  }
  async function mutate(path, body, options) {
    if (ui.busy.has(options.key)) return null;
    ui.busy.set(options.key, options.progress); globalButtons(); renderProjects();
    let result = null;
    try {
      if (!ui.state?.csrfToken) await refreshState({ quiet: true });
      if (!ui.state?.csrfToken) throw new Error('The workspace could not connect securely. Start the local server and refresh before trying again.');
      result = await api(path, { method: 'POST', body: JSON.stringify(body) });
      if (options.success) toast(options.success);
    } catch (error) { toast(error.message, true); if (options.errorTarget) formError(options.errorTarget, error.message); }
    finally { ui.busy.delete(options.key); if (ui.refreshing) await ui.refreshing; await refreshState({ quiet: true }); globalButtons(); renderProjects(); }
    return result;
  }
  function provider(id) { return (ui.state?.providers || []).find((item) => item.id === id); }
  function renderProviders() {
    const list = $('#provider-list'); list.replaceChildren();
    const entries = [
      { id: 'codex', name: 'Codex CLI', symbol: '>_', item: provider('codex') },
      { id: 'claude', name: 'Claude CLI', symbol: '✳', item: provider('claude') },
      { id: 'apify', name: 'Apify', symbol: '△', item: { available: Boolean(ui.state?.apifyConfigured) } },
    ];
    entries.forEach(({ id, name, symbol, item }) => {
      const row = el('div', 'provider-row'), identity = el('div', 'provider-identity'), description = el('div');
      identity.append(el('span', 'provider-symbol', symbol)); description.append(el('div', 'provider-name', name));
      const detail = id === 'apify' ? 'Deployment account' : item?.version || 'Local generation';
      const version = el('div', 'provider-version', detail); version.title = detail; description.append(version); identity.append(description); row.append(identity);
      const available = Boolean(item?.available);
      const label = id === 'apify' ? available ? 'Configured' : 'Not configured' : available ? 'Detected' : 'Not detected';
      const status = el('span', `provider-status${available ? ' is-ready' : ''}`, label);
      if (item?.error) status.title = errorText(item.error);
      row.append(status); list.append(row);
    });
  }
  function renderMetrics() {
    const s = ui.state?.summary || {};
    $('#metric-cash').textContent = money(s.cashReceivedUsd); $('#metric-costs').textContent = money(s.costsUsd);
    $('#metric-net').textContent = money(s.netCashUsd); $('#metric-net').classList.toggle('is-negative', Number(s.netCashUsd) < 0);
    $('#metric-pending').textContent = money(s.pendingUsd);
    const usage = $('#platform-usage');
    if (usage) usage.textContent = `Apify reported run usage: ${money(s.platformUsageUsd, true)} · Informational; not deducted again from received net payouts.`;
  }
  function action(label, handler, options = {}) {
    const button = el('button', `button ${options.className || 'button-secondary'}`, label);
    button.type = 'button'; button.disabled = Boolean(options.disabled);
    if (options.title) button.title = options.title;
    button.addEventListener('click', handler); return button;
  }
  function sourceName(project) {
    const id = project.generation?.provider || project.provider;
    if (id === 'demo') return 'Deterministic template · not AI';
    if (id === 'codex') return 'Codex CLI'; if (id === 'claude') return 'Claude CLI';
    return project.generation ? 'Generated artifact' : 'No generation yet';
  }
  function statusBadge(project) {
    const type = ['tested', 'published'].includes(project.status) ? ' badge-success' : ['generated', 'deployed'].includes(project.status) ? ' badge-info' : project.status === 'test_failed' ? ' badge-danger' : '';
    return el('span', `badge${type}`, statuses[project.status] || project.status || 'Draft');
  }
  function workflow(project) {
    const generated = Boolean(project.generation || project.spec), passed = project.verification?.passed === true;
    const buildStatus = String(project.deployment?.buildStatus || '').toUpperCase();
    const deployed = buildStatus === 'SUCCEEDED', buildFailed = ['FAILED', 'ABORTED', 'TIMED-OUT', 'TIMED_OUT'].includes(buildStatus);
    const published = Boolean(project.deployment?.isPublic || project.status === 'published'), checked = cloudChecked(project);
    const steps = [
      { name: 'Define', done: true }, { name: 'Generate', done: generated, active: !generated },
      { name: 'Test', done: passed, active: generated && !project.verification, failed: project.verification?.passed === false },
      { name: 'Deploy', done: deployed, active: passed && !deployed, failed: buildFailed },
      { name: 'Cloud check', done: checked, active: deployed && !checked, failed: project.smoke?.passed === false },
      { name: 'Publish', done: published, active: checked && !published },
    ];
    const list = el('ol', 'workflow'); list.setAttribute('aria-label', 'Tool workflow');
    steps.forEach((step, index) => {
      const type = step.done ? ' is-complete' : step.failed ? ' is-failed' : step.active ? ' is-active' : '';
      const item = el('li', `workflow-step${type}`), marker = el('span', 'workflow-marker', step.done ? '✓' : step.failed ? '!' : index + 1);
      marker.setAttribute('aria-hidden', 'true'); item.append(marker, el('span', '', step.name));
      item.setAttribute('aria-label', `${step.name}: ${step.done ? 'complete' : step.failed ? 'failed' : step.active ? 'next step' : 'not started'}`); list.append(item);
    });
    return list;
  }
  function renderVerification(project, target) {
    const v = project.verification; if (!v) return;
    const box = el('div', `test-summary${v.passed ? '' : ' has-failures'}`), results = Array.isArray(v.results) ? v.results : [], header = el('div', 'test-summary-header');
    header.append(el('span', '', v.passed ? '✓ Acceptance fixtures passed' : 'Some checks need attention'), el('span', '', `${results.filter((item) => item.passed).length}/${results.length}`)); box.append(header);
    const list = el('ul', 'test-results');
    results.forEach((result) => {
      const item = el('li', `test-result${result.passed ? '' : ' is-failed'}`), text = el('span', '', result.name || 'Unnamed check');
      item.append(el('span', '', result.passed ? '✓' : '×'));
      if (result.error) text.append(el('span', 'test-error', errorText(result.error)));
      item.append(text); list.append(item);
    });
    box.append(list, el('p', 'test-limit', 'These checks cover the defined fixtures, not every real-world input or commercial requirement.'));
    if (v.testedAt) box.append(el('p', 'test-limit', `Last tested ${dateText(v.testedAt)}`));
    target.append(box);
  }
  function safeConsoleUrl(value) {
    try { const url = new URL(value); return url.protocol === 'https:' && (url.hostname === 'console.apify.com' || url.hostname.endsWith('.apify.com')) ? url.href : null; }
    catch { return null; }
  }
  function cloudChecked(project) {
    const smoke = project.smoke;
    return smoke?.passed === true && smoke.artifactHash === project.verification?.artifactHash && smoke.buildId === project.deployment?.buildId;
  }
  function renderDeployment(project, target) {
    const d = project.deployment; if (!d) return;
    const box = el('div', 'deployment-box'), heading = el('div', 'deployment-title', 'Apify deployment');
    heading.append(el('span', `badge${d.isPublic ? ' badge-success' : ' badge-info'}`, d.isPublic ? 'Public' : 'Private')); box.append(heading);
    const facts = el('div', 'deployment-facts'); facts.append(el('span', '', `Build status: ${d.buildStatus || 'Not yet synced'}`));
    if (d.actorId) facts.append(el('span', '', `Actor: ${d.actorId}`));
    const href = safeConsoleUrl(d.consoleUrl);
    if (href) { const link = el('a', 'console-link', 'Open in Apify Console ↗'); link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer'; facts.append(link); }
    facts.append(el('span', '', 'Configure pricing and payouts in Apify Console. Publishing alone does not enable paid access.'));
    if (project.smoke) {
      const check = el('div', `cloud-check-result${cloudChecked(project) ? ' is-passed' : ' is-unverified'}`);
      check.append(el('strong', '', cloudChecked(project) ? '✓ Current build passed the cloud check' : 'Cloud check not passed for the current build'));
      check.append(el('span', '', `Run status: ${project.smoke.status || 'Unknown'} · Checked ${dateText(project.smoke.checkedAt)}`));
      if (project.smoke.error) check.append(el('span', 'test-error', errorText(project.smoke.error)));
      check.append(el('span', '', 'This verifies a sample run, not every possible input.'));
      facts.append(check);
    }
    box.append(facts); target.append(box);
  }
  function emptyState(list) {
    const empty = el('div', 'empty-state'), symbol = el('div', 'empty-symbol', '↗'); symbol.setAttribute('aria-hidden', 'true');
    empty.append(symbol, el('h3', '', 'Your first tool starts here.'), el('p', '', 'Run the local demo to see a complete generate-and-test workflow, or create a draft with your own requirements.'));
    const flow = el('div', 'empty-flow'); ['01 · Define', '→', '02 · Test', '→', '03 · Publish'].forEach((text) => flow.append(el('span', '', text))); empty.append(flow); list.append(empty);
  }
  function renderProjects() {
    const list = $('#project-list'), opened = new Set([...list.querySelectorAll('details[open][data-detail-id]')].map((item) => item.dataset.detailId));
    list.replaceChildren(); const projects = ui.state?.projects || []; $('#project-count').textContent = projects.length;
    if (!projects.length) { emptyState(list); return; }
    projects.forEach((project) => {
      const busy = ui.busy.has(project.id), artifact = Boolean(project.generation || project.spec), passed = project.verification?.passed === true;
      const deployed = Boolean(project.deployment), built = String(project.deployment?.buildStatus || '').toUpperCase() === 'SUCCEEDED', isPublic = Boolean(project.deployment?.isPublic);
      const card = el('article', `project-card${ui.highlightId === project.id ? ' is-highlighted' : ''}`); card.id = `project-${project.id}`; card.setAttribute('aria-busy', String(busy));
      const main = el('div', 'project-main'), header = el('div', 'project-header'), title = el('div', 'project-title-group');
      title.append(el('h3', 'project-title', project.name)); const meta = el('div', 'project-meta'); meta.append(el('span', '', sourceName(project)), el('span', '', `Created ${dateText(project.createdAt)}`)); title.append(meta); header.append(title, statusBadge(project));
      main.append(header, el('p', 'project-brief', project.brief), workflow(project), el('p', 'project-section-label', 'GENERATE WITH'));
      const generation = el('div', 'generation-actions');
      generation.append(action('Template · demo', () => generate(project, 'demo'), { className: 'button-quiet', disabled: busy, title: 'Use the fixed deterministic template. This is not an AI generation.' }));
      ['codex', 'claude'].forEach((id) => {
        const available = Boolean(provider(id)?.available), label = id === 'codex' ? 'Codex CLI' : 'Claude CLI';
        generation.append(action(label, () => generate(project, id), { disabled: busy || !available, title: available ? `Generate using your local ${label}. This consumes your provider allowance.` : `${label} was not detected. Install and authenticate the CLI, then refresh.` }));
      });
      main.append(generation, el('p', 'generation-note', 'The template supports the fixed example only. AI generation uses your local provider and its permitted allowance.'));
      renderVerification(project, main);
      const actions = el('div', 'project-action-row');
      actions.append(action('Run tests', () => runTests(project), { className: 'button-primary', disabled: busy || !artifact, title: artifact ? 'Run acceptance fixtures against the current artifact.' : 'Generate the tool first.' }));
      actions.append(action('View files', () => showArtifacts(project), { disabled: busy || !artifact, title: 'Inspect generated files and the publication checklist.' }));
      actions.append(action(deployed ? 'Rebuild on Apify' : 'Deploy to Apify', () => deploy(project), { disabled: busy || !passed || !ui.state?.apifyConfigured, title: !ui.state?.apifyConfigured ? 'Set APIFY_TOKEN on the local server and restart it before deploying.' : !passed ? 'The current acceptance fixtures must pass first.' : 'Deploying may incur cloud build and run costs.' }));
      if (deployed) {
        actions.append(action('Sync cloud state', () => syncCloud(project), { disabled: busy, title: 'Fetch build state and reported platform run costs.' }));
        actions.append(action('Run cloud check', () => runCloudCheck(project), { disabled: busy || !built || !passed || !ui.state?.apifyConfigured, title: !built ? 'Wait for a successful cloud build and sync its state.' : 'Run a private sample check on Apify. This may incur cloud charges.' }));
        actions.append(action(isPublic ? 'Already public' : 'Make public', () => publish(project), { disabled: busy || isPublic || !built || !passed || !cloudChecked(project), title: isPublic ? 'This Actor is already public.' : !cloudChecked(project) ? 'Pass a cloud check for the current artifact and build before publishing.' : 'Make the Actor public. Configure pricing separately in Apify Console.' }));
      }
      main.append(actions);
      function detail(key, label, value) {
        const node = el('details', 'project-detail'); node.dataset.detailId = `${project.id}:${key}`; node.open = opened.has(node.dataset.detailId);
        node.append(el('summary', '', label), el('pre', 'code-block', JSON.stringify(value, null, 2))); main.append(node);
      }
      if (project.spec) detail('spec', 'View resolved specification', project.spec);
      if (Array.isArray(project.fixtures) && project.fixtures.length) detail('fixtures', `View acceptance fixtures (${project.fixtures.length})`, project.fixtures);
      renderDeployment(project, main);
      if (project.lastError) main.append(el('div', 'project-error', errorText(project.lastError)));
      if (busy) { const operation = el('div', 'project-operation'), spinner = el('span', 'spinner'); spinner.setAttribute('aria-hidden', 'true'); operation.append(spinner, el('span', '', ui.busy.get(project.id))); main.append(operation); }
      card.append(main);
      const footer = el('div', 'project-footer'), amounts = el('div', 'project-money'), finances = project.financialSummary || {};
      const income = el('span', '', 'Recorded cash '), costs = el('span', '', 'Additional expenses ');
      income.append(el('strong', '', money(finances.cashReceivedUsd))); costs.append(el('strong', '', money(finances.costsUsd))); amounts.append(income, costs); footer.append(amounts);
      const record = el('button', 'text-button', 'Add ledger record'); record.type = 'button'; record.addEventListener('click', () => openLedger(project.id)); footer.append(record); card.append(footer); list.append(card);
    });
  }
  function renderLedger() {
    const projects = ui.state?.projects || [], names = new Map(projects.map((project) => [project.id, project.name]));
    const select = $('#ledger-project'), selected = select.value; select.replaceChildren();
    const placeholder = el('option', '', 'Choose a tool'); placeholder.value = ''; select.append(placeholder);
    projects.forEach((project) => { const option = el('option', '', project.name); option.value = project.id; select.append(option); });
    if (names.has(selected)) select.value = selected; else if (projects.length === 1) select.value = projects[0].id;
    const rows = $('#ledger-rows'); rows.replaceChildren();
    const entries = [...(ui.state?.ledger || [])].sort((a, b) => String(b.occurredAt || b.createdAt || '').localeCompare(String(a.occurredAt || a.createdAt || '')));
    if (!entries.length) {
      const row = el('tr'), cell = el('td', 'ledger-empty', 'No records yet. Add a received payment, an additional expense, or a pending amount.'); cell.colSpan = 5; row.append(cell); rows.append(row); return;
    }
    entries.forEach((entry) => {
      const row = el('tr'), record = el('td'); record.append(el('div', 'ledger-record-title', kinds[entry.kind] || entry.kind || 'Record'));
      if (entry.reference) record.append(el('div', 'ledger-record-reference', entry.reference));
      if (entry.settlesReference) record.append(el('div', 'ledger-record-reference', `Settles: ${entry.settlesReference}`));
      if (entry.note) record.append(el('div', 'ledger-record-note', entry.note));
      row.append(record, el('td', '', names.get(entry.projectId) || 'Unknown tool'), el('td', '', dateText(entry.occurredAt || entry.createdAt)));
      const source = el('td'), imported = entry.kind === 'run-cost' || String(entry.source || '').toLowerCase().includes('apify');
      source.append(el('span', `badge${imported ? ' badge-info' : ''}`, imported ? 'Apify-reported' : 'Self-reported')); row.append(source);
      const type = entry.kind === 'payout' ? ' is-income' : entry.kind === 'expense' ? ' is-expense' : '';
      row.append(el('td', `ledger-amount${type}`, (entry.kind === 'expense' ? '−' : '') + money(entry.amountUsd, entry.kind === 'run-cost'))); rows.append(row);
    });
  }
  function render() { renderProviders(); renderMetrics(); renderProjects(); renderLedger(); globalButtons(); }
  function focusProject(id) {
    if (!id) return; ui.highlightId = id; renderProjects();
    document.getElementById(`project-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => { if (ui.highlightId === id) { ui.highlightId = null; renderProjects(); } }, 3000);
  }
  async function loadExample(restore = false) {
    try {
      if (!ui.example) ui.example = await api('/api/example');
      if (restore || !$('#project-name').value) $('#project-name').value = ui.example.name || '';
      if (restore || !$('#project-brief').value) $('#project-brief').value = ui.example.brief || '';
      if (restore || !$('#project-fixtures').value) $('#project-fixtures').value = JSON.stringify(ui.example.fixtures || [], null, 2);
      if (restore) { formError('#create-error', ''); toast('The example brief and fixtures have been restored.'); }
    } catch (error) { toast(`Could not load the example. ${error.message}`, true); }
  }
  async function generate(project, id) {
    await mutate(`/api/projects/${encodeURIComponent(project.id)}/generate`, { provider: id }, {
      key: project.id, progress: id === 'demo' ? 'Preparing the deterministic example template…' : `${id === 'codex' ? 'Codex' : 'Claude'} is generating the tool. This can take several minutes. Keep this page open.`,
      success: id === 'demo' ? 'The deterministic template is ready. Run the fixtures to check it.' : 'Generation finished. Review the files and run the acceptance fixtures.',
    });
  }
  async function runTests(project) {
    const result = await mutate(`/api/projects/${encodeURIComponent(project.id)}/test`, {}, { key: project.id, progress: 'Running the defined acceptance fixtures…' });
    if (result) {
      const updated = ui.state?.projects?.find((item) => item.id === project.id), verification = updated?.verification || result.verification || result.project?.verification;
      toast(verification?.passed ? 'The defined acceptance fixtures passed.' : 'Testing finished. Review the check results.', verification?.passed === false);
    }
  }
  function confirmAction({ title, description, note, accept }) {
    return new Promise((resolve) => {
      ui.confirmResolve = resolve; $('#confirm-title').textContent = title; $('#confirm-description').textContent = description;
      $('#confirm-note').textContent = note; $('#confirm-accept').textContent = accept; $('#confirm-dialog').showModal(); $('#confirm-cancel').focus();
    });
  }
  function finishConfirmation(confirmed) { const resolve = ui.confirmResolve; ui.confirmResolve = null; $('#confirm-dialog').close(); if (resolve) resolve(confirmed); }
  async function deploy(project) {
    const confirmed = await confirmAction({ title: `Deploy ${project.name}?`, description: 'This creates or updates an Actor in your configured Apify account and starts a cloud build.', note: 'Cloud builds and runs may incur charges. Fixture checks do not establish production readiness or commercial demand. Review the generated files before continuing.', accept: 'Deploy and start build' });
    if (!confirmed) return;
    await mutate(`/api/projects/${encodeURIComponent(project.id)}/deploy`, { confirm: true }, { key: project.id, progress: 'Uploading to Apify and starting a cloud build…', success: 'Deployment requested. Sync cloud state to check the build result.' });
  }
  async function runCloudCheck(project) {
    const confirmed = await confirmAction({
      title: `Run a cloud check for ${project.name}?`,
      description: 'This starts a private Apify run with sample input and checks its output against the expected result.',
      note: 'The run may incur cloud charges and can take a few minutes. A passing sample checks this build on that input; it does not guarantee correctness for all data.',
      accept: 'Run check with cloud costs',
    });
    if (!confirmed) return;
    const result = await mutate(`/api/projects/${encodeURIComponent(project.id)}/smoke`, { confirm: true }, {
      key: project.id, progress: 'Running a private cloud check. This can take a few minutes. Keep this page open.',
    });
    if (result) {
      const updated = ui.state?.projects?.find((item) => item.id === project.id);
      const passed = updated ? cloudChecked(updated) : false;
      toast(passed ? 'The current cloud build passed the sample check.' : 'Cloud check finished. Review its result before publishing.', !passed);
    }
  }
  async function publish(project) {
    const confirmed = await confirmAction({ title: `Make ${project.name} public?`, description: 'This makes the Actor public on Apify. Check its code, data sources, and listing before publishing.', note: 'Public access does not enable paid access or create income. Set pricing and payout details in Apify Console. Deployment and usage may incur cloud charges.', accept: 'Make Actor public' });
    if (!confirmed) return;
    await mutate(`/api/projects/${encodeURIComponent(project.id)}/publish`, { confirm: true }, { key: project.id, progress: 'Making the Actor public on Apify…', success: 'The Actor is public. Review its listing and configure pricing in Apify Console.' });
  }
  async function syncCloud(project) {
    await mutate(`/api/projects/${encodeURIComponent(project.id)}/sync`, {}, { key: project.id, progress: 'Fetching build state and reported run usage from Apify…', success: 'Cloud state synced. Reported platform usage is informational and is not deducted again from net payouts.' });
  }
  async function showArtifacts(project) {
    const dialog = $('#artifact-dialog'), content = $('#artifact-content'); $('#artifact-title').textContent = project.name;
    content.replaceChildren(el('p', '', 'Loading generated files…')); dialog.showModal();
    try {
      const artifact = await api(`/api/projects/${encodeURIComponent(project.id)}/artifact`); content.replaceChildren();
      if (artifact.artifactHash) content.append(el('p', 'artifact-hash', `Artifact fingerprint: ${artifact.artifactHash}`));
      const files = artifact.files || artifact.artifacts;
      if (Array.isArray(files)) files.forEach((file, index) => {
        const detail = el('details', 'artifact-file'); detail.open = index === 0;
        detail.append(el('summary', '', typeof file === 'string' ? file : file.name || file.path || `File ${index + 1}`));
        if (typeof file === 'object') detail.append(el('pre', 'code-block', typeof file.content === 'string' ? file.content : JSON.stringify(file.content ?? file, null, 2)));
        content.append(detail);
      }); else content.append(el('pre', 'code-block', JSON.stringify(artifact, null, 2)));
      if (Array.isArray(artifact.publicationChecklist) && artifact.publicationChecklist.length) {
        const list = el('ul', 'publication-checklist'); artifact.publicationChecklist.forEach((item) => list.append(el('li', '', typeof item === 'string' ? item : item.label || item.text || JSON.stringify(item))));
        content.append(el('h3', 'checklist-heading', 'Before publishing'), list);
      }
    } catch (error) { content.replaceChildren(el('div', 'project-error', error.message)); }
  }
  function openLedger(projectId) {
    $('#ledger-form-panel').hidden = false; $('#toggle-ledger-button').setAttribute('aria-expanded', 'true');
    if (projectId) $('#ledger-project').value = projectId;
    $('#ledger-form-panel').scrollIntoView({ behavior: 'smooth', block: 'center' }); $('#ledger-amount').focus({ preventScroll: true });
  }
  function setToday() { const now = new Date(); $('#ledger-date').value = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }
  $('#refresh-button').addEventListener('click', () => refreshState());
  $('#reset-example-button').addEventListener('click', () => loadExample(true));
  $('#new-project-button').addEventListener('click', () => {
    const panel = $('#create-panel'); panel.classList.add('is-highlighted'); panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    $('#project-name').focus({ preventScroll: true }); setTimeout(() => panel.classList.remove('is-highlighted'), 2200);
  });
  $('#demo-button').addEventListener('click', async () => {
    const result = await mutate('/api/demo', {}, { key: 'demo', progress: 'Running the deterministic local demo…', success: 'Local demo complete. The fixed template was generated and tested; no income or cloud deployment was created.' });
    if (result) focusProject(result.project?.id || result.id || ui.state?.projects?.[0]?.id);
  });
  $('#create-form').addEventListener('submit', async (event) => {
    event.preventDefault(); formError('#create-error', ''); let fixtures;
    try { fixtures = JSON.parse($('#project-fixtures').value); if (!Array.isArray(fixtures) || !fixtures.length) throw new Error('Provide at least one acceptance fixture in a JSON array.'); }
    catch (error) { $('#create-form .form-details').open = true; formError('#create-error', error instanceof SyntaxError ? 'The acceptance fixtures are not valid JSON. Check the commas, quotes, and brackets.' : error.message); $('#project-fixtures').focus(); return; }
    const result = await mutate('/api/projects', { name: $('#project-name').value.trim(), brief: $('#project-brief').value.trim(), fixtures }, { key: 'create', progress: 'Creating a local draft…', success: 'Draft created. Choose a generation method to continue.', errorTarget: '#create-error' });
    if (result) focusProject(result.project?.id || result.id || ui.state?.projects?.[0]?.id);
  });
  $('#toggle-ledger-button').addEventListener('click', () => {
    const panel = $('#ledger-form-panel'); if (panel.hidden) openLedger(); else { panel.hidden = true; $('#toggle-ledger-button').setAttribute('aria-expanded', 'false'); }
  });
  $('#ledger-kind').addEventListener('change', () => { $('#settles-field').hidden = $('#ledger-kind').value !== 'payout'; });
  $('#ledger-form').addEventListener('submit', async (event) => {
    event.preventDefault(); formError('#ledger-error', ''); const amount = Number($('#ledger-amount').value);
    if (!Number.isFinite(amount) || amount <= 0) { formError('#ledger-error', 'Enter a positive amount in USD.'); return; }
    const kind = $('#ledger-kind').value, data = { projectId: $('#ledger-project').value, kind, amountUsd: amount, reference: $('#ledger-reference').value.trim(), occurredAt: $('#ledger-date').value, note: $('#ledger-note').value.trim() };
    if (kind === 'payout' && $('#ledger-settles').value.trim()) data.settlesReference = $('#ledger-settles').value.trim();
    const result = await mutate('/api/ledger', data, { key: 'ledger', progress: 'Saving a self-reported ledger entry…', success: 'Ledger record saved as self-reported.', errorTarget: '#ledger-error' });
    if (result) { ['#ledger-amount', '#ledger-reference', '#ledger-note', '#ledger-settles'].forEach((id) => { $(id).value = ''; }); setToday(); }
  });
  $('#confirm-cancel').addEventListener('click', () => finishConfirmation(false));
  $('#confirm-accept').addEventListener('click', () => finishConfirmation(true));
  $('#confirm-dialog').addEventListener('cancel', (event) => { event.preventDefault(); finishConfirmation(false); });
  $('#artifact-close').addEventListener('click', () => $('#artifact-dialog').close());
  $('#artifact-dialog').addEventListener('click', (event) => { if (event.target === $('#artifact-dialog')) $('#artifact-dialog').close(); });
  setToday();
  Promise.allSettled([refreshState({ quiet: true }), loadExample()]);
})();
