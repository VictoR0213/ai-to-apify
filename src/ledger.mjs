import { randomUUID } from 'node:crypto';
export function validateEntry(input, projects, ledger) {
  if (!input || !projects.some((project) => project.id === input.projectId)) throw new Error('Select an existing project.');
  if (!['payout', 'expense', 'pending'].includes(input.kind)) throw new Error('Unsupported ledger entry kind.');
  const amount = input.amountUsd;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || amount > 1e9) throw new Error('Amount must be a positive USD number.');
  const reference = typeof input.reference === 'string' ? input.reference.trim() : '';
  if (!reference || reference.length > 200) throw new Error('Supply a statement, invoice or receipt reference (1–200 characters).');
  if (ledger.some((entry) => entry.projectId === input.projectId && entry.reference === reference)) throw new Error('This reference has already been recorded for the project.');
  const date = input.occurredAt;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new Error('Use a valid date in YYYY-MM-DD format.');
  const now = new Date();
  const today = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  if (date > today) throw new Error('Ledger entries cannot be dated in the future.');
  const note = typeof input.note === 'string' ? input.note.trim() : '';
  if (note.length > 1000) throw new Error('Note is too long.');
  const settlesReference = input.settlesReference || null;
  if (settlesReference) {
    const pending = ledger.find((entry) => entry.projectId === input.projectId && entry.kind === 'pending' && entry.reference === settlesReference);
    if (input.kind !== 'payout' || !pending) throw new Error('A payout may settle an existing pending reference.');
    if (ledger.some((entry) => entry.projectId === input.projectId && entry.settlesReference === settlesReference)) throw new Error('That pending reference has already been settled.');
  }
  return {
    id: randomUUID(), projectId: input.projectId, kind: input.kind, amountUsd: Math.round(amount * 1e6) / 1e6,
    currency: 'USD', reference, occurredAt: date, note, settlesReference,
    source: 'manual', verification: 'self-reported', createdAt: new Date().toISOString(),
  };
}
export function summarize(ledger) {
  const sum = (kind) => ledger.filter((entry) => entry.kind === kind).reduce((total, entry) => total + entry.amountUsd, 0);
  const settled = new Set(ledger.filter((entry) => entry.settlesReference).map((entry) => entry.projectId + ':' + entry.settlesReference));
  const cash = sum('payout');
  const costs = sum('expense');
  return {
    cashReceivedUsd: cash, costsUsd: costs, netCashUsd: cash - costs,
    platformUsageUsd: sum('run-cost'),
    pendingUsd: ledger.filter((entry) => entry.kind === 'pending' && !settled.has(entry.projectId + ':' + entry.reference)).reduce((total, entry) => total + entry.amountUsd, 0),
    note: 'Manual receipts are self-reported. Pending earnings are excluded from cash. Expenses include only additional cash paid; synced platform usage is informational and excluded to avoid counting payout deductions twice.',
  };
}
export function importRunCosts(state, projectId, runs) {
  let added = 0;
  for (const run of runs) {
    if (typeof run.id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(run.id)) continue;
    // Running jobs have provisional usage. Record a run only when its cost is final.
    if (!['SUCCEEDED', 'FAILED', 'TIMED-OUT', 'ABORTED'].includes(run.status)) continue;
    if (typeof run.usageTotalUsd !== 'number' || !Number.isFinite(run.usageTotalUsd) || run.usageTotalUsd < 0) continue;
    const reference = 'apify-run:' + run.id;
    const existing = state.ledger.find((entry) => entry.projectId === projectId && entry.reference === reference);
    if (existing) {
      if (existing.source === 'apify-api') existing.amountUsd = run.usageTotalUsd;
      continue;
    }
    state.ledger.push({
      id: randomUUID(), projectId, kind: 'run-cost', amountUsd: run.usageTotalUsd, currency: 'USD',
      reference, occurredAt: String(run.finishedAt || run.startedAt || new Date().toISOString()).slice(0, 10),
      note: 'Platform cost of a run visible to your account; not creator revenue or all customer usage.',
      source: 'apify-api', verification: 'api-reported', createdAt: new Date().toISOString(),
    });
    added++;
  }
  return added;
}
