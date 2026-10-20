import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Preparation and locally recorded evidence only. This module has no execution adapter.
const root = fileURLToPath(new URL('../', import.meta.url));
const fixtureDirectory = path.join(root, 'examples', 'commercial-validation');
const eventTypes = new Set([
  'qualified_visit', 'qualified_conversation', 'sample_authorized', 'trial_delivered',
  'quote_presented', 'eligible_paid_usage', 'platform_settlement', 'cash_receipt',
]);
const paymentTypes = new Set(['eligible_paid_usage', 'platform_settlement', 'cash_receipt']);
const disabledFlags = ['executionEnabled', 'outboundEnabled', 'spendingEnabled', 'scheduleEnabled'];
const channelStates = new Set([
  'owned_channel_conditional', 'conditional_unverified', 'read_only_no_automated_posting',
]);
const eligibilityFlags = {
  independentCustomer: true, payingPlan: true, customerWork: true,
  ownerRun: false, sponsored: false, refunded: false,
};

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function nonempty(value) { return typeof value === 'string' && value.trim().length > 0; }
function positive(value) { return typeof value === 'number' && Number.isFinite(value) && value > 0; }
function strings(value) { return Array.isArray(value) && value.length > 0 && value.every(nonempty); }
function webUrl(value) {
  if (typeof value !== 'string') return false;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password; }
  catch { return false; }
}
function uniqueRows(rows, label) {
  requireValue(Array.isArray(rows) && rows.length > 0, `${label} must be a nonempty array.`);
  const seen = new Set();
  for (const row of rows) {
    requireValue(object(row) && nonempty(row.id), `${label} entries require an id.`);
    requireValue(!seen.has(row.id), `Duplicate ${label} id: ${row.id}`);
    seen.add(row.id);
  }
  return seen;
}
function validateSourceReferences(value, sourceIds, label) {
  requireValue(strings(value), `${label} requires source_ids.`);
  requireValue(new Set(value).size === value.length, `${label} contains duplicate source references.`);
  for (const id of value) requireValue(sourceIds.has(id), `${label} references unknown source: ${id}`);
}
function validateNestedReferences(value, sourceIds) {
  if (Array.isArray(value)) return value.forEach((item) => validateNestedReferences(item, sourceIds));
  if (!object(value)) return;
  for (const [key, item] of Object.entries(value)) {
    if (key === 'source_ids') validateSourceReferences(item, sourceIds, 'Pricing fact');
    else validateNestedReferences(item, sourceIds);
  }
}

export function validateResearch(research) {
  requireValue(object(research) && research.version === 1, 'Research version must be 1.');
  const sourceIds = uniqueRows(research.sources, 'source');
  const leadIds = uniqueRows(research.leads, 'lead');
  const channelIds = uniqueRows(research.channels, 'channel');
  for (const source of research.sources) {
    requireValue(nonempty(source.title) && webUrl(source.url), `Source ${source.id} requires a title and public URL.`);
    requireValue(nonempty(source.retrieved_at) && nonempty(source.limitations), `Source ${source.id} requires a retrieval date and limitations.`);
  }
  for (const lead of research.leads) {
    validateSourceReferences(lead.source_ids, sourceIds, `Lead ${lead.id}`);
    requireValue(nonempty(lead.name) && nonempty(lead.fit_inference) && nonempty(lead.product_gap), `Lead ${lead.id} requires its name, fit inference and product gap.`);
    requireValue(lead.status === 'researched_not_contacted' && lead.buying_intent === 'unknown', `Lead ${lead.id} must remain an uncontacted research candidate.`);
    requireValue(['not_verified_do_not_send', 'research_only_do_not_send'].includes(lead.automated_contact_status), `Lead ${lead.id} cannot authorize automated contact.`);
    requireValue(webUrl(lead.source_url), `Lead ${lead.id} requires a public source URL.`);
    requireValue(lead.contact_url === null || webUrl(lead.contact_url), `Lead ${lead.id} has an invalid contact URL.`);
    if (lead.type === 'public_demand_signal') {
      requireValue(lead.contact_url === null && lead.automated_contact_status === 'research_only_do_not_send', `Forum demand signal ${lead.id} must be research-only, with no contact route.`);
    }
  }
  for (const channel of research.channels) {
    validateSourceReferences(channel.source_ids, sourceIds, `Channel ${channel.id}`);
    requireValue(nonempty(channel.name) && webUrl(channel.url), `Channel ${channel.id} requires a name and URL.`);
    requireValue(channelStates.has(channel.automated_status), `Channel ${channel.id} has an unsupported automation state.`);
    requireValue(strings(channel.entry_conditions) && strings(channel.do_not_do), `Channel ${channel.id} requires entry conditions and prohibited actions.`);
    const hostname = new URL(channel.url).hostname;
    if (['community.n8n.io', 'community.make.com', 'news.ycombinator.com'].includes(hostname)) {
      requireValue(channel.automated_status === 'read_only_no_automated_posting', `Channel ${channel.id} prohibits automated posting.`);
    }
  }
  requireValue(object(research.pricingFacts), 'Research requires pricingFacts.');
  validateNestedReferences(research.pricingFacts, sourceIds);
  return { sources: sourceIds.size, researchCandidates: leadIds.size, channels: channelIds.size };
}

function calendarDate(value) {
  requireValue(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value), 'proposedStart must use YYYY-MM-DD.');
  const parsed = new Date(`${value}T00:00:00Z`);
  requireValue(Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value, 'proposedStart is not a valid date.');
  return parsed;
}

export function validateCampaign(campaign, research) {
  requireValue(object(campaign) && campaign.version === 1, 'Campaign version must be 1.');
  requireValue(campaign.mode === 'preparation_only', 'Campaign mode must remain preparation_only.');
  for (const flag of disabledFlags) requireValue(campaign[flag] === false, `${flag} must remain false.`);
  requireValue(campaign.timezone === 'Asia/Singapore', 'Campaign timezone must be Asia/Singapore.');
  calendarDate(campaign.proposedStart);
  requireValue(campaign.durationDays === 14 && Array.isArray(campaign.days) && campaign.days.length === 14, 'Campaign requires exactly 14 days.');
  for (const [index, day] of campaign.days.entries()) {
    requireValue(object(day) && day.day === index + 1, 'Campaign days must be sequential from 1 through 14.');
    requireValue(nonempty(day.phase) && strings(day.actions) && strings(day.requiredEvidence) && nonempty(day.stopCondition), `Day ${day.day} requires a phase, actions, evidence and stop condition.`);
  }
  requireValue(object(campaign.targets), 'Campaign requires planned targets.');
  for (const [name, target] of Object.entries(campaign.targets)) {
    requireValue(typeof target === 'number' && Number.isFinite(target) && target >= 0, `Planned target ${name} must be a nonnegative number.`);
  }
  for (const name of ['researchCandidates', 'qualifiedConversations', 'authorizedSamples', 'selfServeTrials', 'payingCustomers', 'repeatCustomers']) {
    requireValue(Number.isSafeInteger(campaign.targets[name]), `Planned target ${name} must be an integer.`);
  }
  if (research) requireValue(campaign.targets.researchCandidates === research.leads.length, 'Research candidate target must match the dated lead fixture.');
  return { durationDays: 14, mode: campaign.mode, ...Object.fromEntries(disabledFlags.map((flag) => [flag, false])) };
}

function timestamp(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
}

export function validateEvidence(evidence) {
  requireValue(object(evidence) && evidence.version === 1 && Array.isArray(evidence.events), 'Evidence requires version 1 and an events array.');
  const ids = new Set(), runsByType = new Set(), paidRuns = new Map(), settlements = new Map();
  for (const event of evidence.events) {
    requireValue(object(event) && eventTypes.has(event.eventType), 'Evidence contains an unsupported eventType.');
    for (const field of ['id', 'customerRef', 'evidenceRef']) requireValue(nonempty(event[field]), `Evidence event requires ${field}.`);
    requireValue(timestamp(event.occurredAt), `Event ${event.id} requires an ISO timestamp with a timezone.`);
    requireValue(!ids.has(event.id), `Duplicate evidence id: ${event.id}`);
    ids.add(event.id);
    if (event.runRef !== undefined) {
      requireValue(nonempty(event.runRef), `Event ${event.id} has an invalid runRef.`);
      const key = `${event.eventType}\0${event.runRef}`;
      requireValue(!runsByType.has(key), `Duplicate ${event.eventType} runRef: ${event.runRef}`);
      runsByType.add(key);
    }
    if (!paymentTypes.has(event.eventType)) continue;
    for (const [flag, expected] of Object.entries(eligibilityFlags)) {
      requireValue(event[flag] === expected, `Payment event ${event.id} requires ${flag}=${expected}.`);
    }
    requireValue(positive(event.chargesUsd), `Payment event ${event.id} requires positive chargesUsd.`);
    requireValue(Number.isSafeInteger(event.deliveredRecords) && event.deliveredRecords > 0, `Payment event ${event.id} requires positive deliveredRecords.`);
    requireValue(nonempty(event.runRef) && nonempty(event.inputRef), `Payment event ${event.id} requires runRef and inputRef.`);
    if (event.eventType === 'eligible_paid_usage') paidRuns.set(event.runRef, event);
    else requireValue(positive(event.amountUsd), `Payment event ${event.id} requires positive amountUsd for its recorded financial stage.`);
    if (event.eventType === 'platform_settlement') settlements.set(event.runRef, event);
  }
  // Cross-stage references are checked after reading all rows; file order has no meaning.
  for (const event of evidence.events.filter((item) => paymentTypes.has(item.eventType) && item.eventType !== 'eligible_paid_usage')) {
    const usage = paidRuns.get(event.runRef);
    requireValue(usage, `${event.eventType} ${event.id} must reference recorded eligible_paid_usage.`);
    for (const field of ['customerRef', 'inputRef', 'chargesUsd', 'deliveredRecords']) {
      requireValue(event[field] === usage[field], `${event.eventType} ${event.id} must match its usage ${field}.`);
    }
    requireValue(Date.parse(event.occurredAt) >= Date.parse(usage.occurredAt), `Payment stage ${event.id} predates its usage.`);
    if (event.eventType === 'cash_receipt') {
      const settlement = settlements.get(event.runRef);
      requireValue(settlement && Date.parse(event.occurredAt) >= Date.parse(settlement.occurredAt), `Cash receipt ${event.id} requires an earlier recorded platform_settlement.`);
      requireValue(event.amountUsd <= settlement.amountUsd, `Cash receipt ${event.id} exceeds its recorded settlement.`);
    }
  }
  return evidence;
}

export function summarizeEvidence(evidence) {
  validateEvidence(evidence);
  const ofType = (type) => evidence.events.filter((event) => event.eventType === type);
  const uniqueCustomers = (rows) => new Set(rows.map((event) => event.customerRef)).size;
  const customerTrials = ofType('trial_delivered').filter((event) => event.independentCustomer === true && event.customerWork === true && event.ownerRun === false && event.sponsored === false);
  const paid = ofType('eligible_paid_usage');
  const repeat = new Set();
  for (const [index, event] of paid.entries()) {
    if (paid.slice(0, index).some((earlier) => earlier.customerRef === event.customerRef && earlier.inputRef !== event.inputRef && Math.abs(Date.parse(event.occurredAt) - Date.parse(earlier.occurredAt)) >= 86400000)) repeat.add(event.customerRef);
  }
  const sum = (rows, field) => Math.round(rows.reduce((total, event) => total + event[field], 0) * 1e8) / 1e8;
  return {
    evidenceBasis: 'locally_recorded_not_independently_verified',
    observedCounters: {
      recordedEvents: evidence.events.length,
      qualifiedVisits: uniqueCustomers(ofType('qualified_visit')),
      qualifiedConversations: uniqueCustomers(ofType('qualified_conversation')),
      authorizedSamples: ofType('sample_authorized').length,
      sampleContributors: uniqueCustomers(ofType('sample_authorized')),
      selfServeTrials: customerTrials.length,
      trialCustomers: uniqueCustomers(customerTrials),
      quotesPresented: uniqueCustomers(ofType('quote_presented')),
      eligiblePaidRuns: paid.length,
      payingCustomers: uniqueCustomers(paid),
      repeatCustomers: repeat.size,
      platformSettlements: ofType('platform_settlement').length,
      cashReceipts: ofType('cash_receipt').length,
    },
    recordedFinancials: {
      eligibleUsageChargesUsd: sum(paid, 'chargesUsd'),
      platformSettledUsd: sum(ofType('platform_settlement'), 'amountUsd'),
      cashReceivedUsd: sum(ofType('cash_receipt'), 'amountUsd'),
    },
  };
}

async function readJson(filename) {
  return JSON.parse((await readFile(filename, 'utf8')).replace(/^\uFEFF/, ''));
}

async function main(args) {
  const [command, ...options] = args;
  const usage = 'Usage: node scripts/commercial.mjs check | plan | status [--evidence local-file.json]';
  requireValue(['check', 'plan', 'status'].includes(command), usage);
  requireValue(options.length === 0 || (command === 'status' && options.length === 2 && options[0] === '--evidence' && nonempty(options[1])), usage);
  const research = await readJson(path.join(fixtureDirectory, 'research.json'));
  const campaign = await readJson(path.join(fixtureDirectory, 'campaign.json'));
  const researchSummary = validateResearch(research);
  const campaignSummary = validateCampaign(campaign, research);
  if (command === 'plan') {
    console.log('PREPARATION ONLY - proposed calendar; no actions are executed or scheduled.');
    console.log(`Timezone: ${campaign.timezone}; proposed start: ${campaign.proposedStart}`);
    const start = calendarDate(campaign.proposedStart);
    for (const day of campaign.days) {
      const date = new Date(start.valueOf() + (day.day - 1) * 86400000).toISOString().slice(0, 10);
      console.log(`\nDay ${day.day} | ${date} | ${day.phase}`);
      for (const action of day.actions) console.log(`  Proposed AI action: ${action}`);
      console.log(`  Required evidence: ${day.requiredEvidence.join('; ')}`);
      console.log(`  Stop condition: ${day.stopCondition}`);
    }
    return;
  }
  requireValue(!/^(?:[a-z][a-z0-9+.-]*:\/\/|\\\\|\/\/)/i.test(options[1] || ''), 'Evidence must be a local file path, not a URL or network share.');
  const evidencePath = options.length ? path.resolve(options[1]) : path.join(fixtureDirectory, 'evidence.example.json');
  const evidence = await readJson(evidencePath);
  const observed = summarizeEvidence(evidence);
  if (command === 'check') {
    requireValue(evidence.events.length === 0, 'The checked-in evidence example must remain empty; use a separate local file for recorded evidence.');
    console.log(JSON.stringify({ check: 'passed', research: researchSummary, campaign: campaignSummary, ...observed }, null, 2));
  } else {
    console.log(JSON.stringify({ mode: campaign.mode, evidenceFile: evidencePath, plannedTargets: campaign.targets, ...observed }, null, 2));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => { console.error('Commercial preparation check failed: ' + error.message); process.exitCode = 1; });
}
