import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateResearch, validateCampaign, validateEvidence, summarizeEvidence } from '../scripts/commercial.mjs';

const evidence = (events = []) => ({ version: 1, events });
function paid(id, overrides = {}) {
  return {
    id, eventType: 'eligible_paid_usage', occurredAt: '2026-10-22T10:00:00+08:00',
    customerRef: 'anonymous-customer-1', evidenceRef: `local:receipt-${id}`,
    runRef: `run-${id}`, inputRef: 'input-hash-A', chargesUsd: 2.01, deliveredRecords: 1000,
    independentCustomer: true, payingPlan: true, customerWork: true,
    ownerRun: false, sponsored: false, refunded: false, ...overrides,
  };
}

test('empty evidence reports zero observed results and financials without planned targets', () => {
  const summary = summarizeEvidence(evidence());
  assert.ok(Object.values(summary.observedCounters).every((value) => value === 0));
  assert.ok(Object.values(summary.recordedFinancials).every((value) => value === 0));
  assert.equal(summary.evidenceBasis, 'locally_recorded_not_independently_verified');
  assert.equal('plannedTargets' in summary, false);
});

test('repeat visits and quotes count unique people while sample and trial totals retain their event counts', () => {
  const events = ['qualified_visit', 'quote_presented', 'trial_delivered', 'sample_authorized']
    .flatMap((eventType) => [1, 2].map((index) => paid(`${eventType}-${index}`, { eventType })));
  const counters = summarizeEvidence(evidence(events)).observedCounters;
  assert.equal(counters.recordedEvents, 8);
  assert.equal(counters.qualifiedVisits, 1);
  assert.equal(counters.quotesPresented, 1);
  assert.equal(counters.selfServeTrials, 2);
  assert.equal(counters.trialCustomers, 1);
  assert.equal(counters.authorizedSamples, 2);
  assert.equal(counters.sampleContributors, 1);
});

test('free, self-test and sponsored trials cannot become eligible paid demand', () => {
  const trials = [
    paid('free', { eventType: 'trial_delivered', payingPlan: false, chargesUsd: 0 }),
    paid('self', { eventType: 'trial_delivered', independentCustomer: false, ownerRun: true }),
    paid('sponsored', { eventType: 'trial_delivered', sponsored: true }),
  ];
  const summary = summarizeEvidence(evidence(trials));
  assert.equal(summary.observedCounters.recordedEvents, 3);
  assert.equal(summary.observedCounters.selfServeTrials, 1);
  assert.equal(summary.observedCounters.payingCustomers, 0);
  assert.equal(summary.recordedFinancials.eligibleUsageChargesUsd, 0);
  for (const trial of trials) assert.throws(() => validateEvidence(evidence([{ ...trial, eventType: 'eligible_paid_usage' }])), /Payment event/);
  for (const overrides of [{ refunded: true }, { customerWork: false }, { chargesUsd: 0 }, { deliveredRecords: 0 }]) {
    assert.throws(() => validateEvidence(evidence([paid('invalid', overrides)])), /Payment event/);
  }
});

test('duplicate event and run identities are rejected; same-input reruns are not repeat customers', () => {
  assert.throws(() => validateEvidence(evidence([paid('a'), paid('a', { runRef: 'run-other' })])), /Duplicate evidence id/);
  assert.throws(() => validateEvidence(evidence([paid('a'), paid('b', { runRef: 'run-a' })])), /Duplicate eligible_paid_usage runRef/);
  const sameInput = summarizeEvidence(evidence([paid('a'), paid('b', { occurredAt: '2026-10-24T10:00:00+08:00' })]));
  assert.equal(sameInput.observedCounters.payingCustomers, 1);
  assert.equal(sameInput.observedCounters.repeatCustomers, 0);
  const tooSoon = summarizeEvidence(evidence([paid('a'), paid('b', { inputRef: 'input-hash-B', occurredAt: '2026-10-23T09:59:59+08:00' })]));
  assert.equal(tooSoon.observedCounters.repeatCustomers, 0);
  const laterInput = summarizeEvidence(evidence([paid('a'), paid('b', { inputRef: 'input-hash-B', occurredAt: '2026-10-23T10:00:00+08:00' })]));
  assert.equal(laterInput.observedCounters.repeatCustomers, 1);
});

test('recorded charges, platform settlement and cash remain separate stages with matching evidence', () => {
  const usage = paid('usage');
  const settlement = { ...usage, id: 'settlement', eventType: 'platform_settlement', occurredAt: '2026-11-11T12:00:00+08:00', evidenceRef: 'local:settlement', amountUsd: 1.5 };
  const cash = { ...usage, id: 'cash', eventType: 'cash_receipt', occurredAt: '2026-11-23T12:00:00+08:00', evidenceRef: 'local:cash-receipt', amountUsd: 1.4 };
  assert.equal(summarizeEvidence(evidence([usage])).recordedFinancials.cashReceivedUsd, 0);
  assert.deepEqual(summarizeEvidence(evidence([cash, usage, settlement])).recordedFinancials, { eligibleUsageChargesUsd: 2.01, platformSettledUsd: 1.5, cashReceivedUsd: 1.4 });
  assert.throws(() => validateEvidence(evidence([settlement])), /recorded eligible_paid_usage/);
  assert.throws(() => validateEvidence(evidence([usage, cash])), /earlier recorded platform_settlement/);
  assert.throws(() => validateEvidence(evidence([usage, { ...settlement, customerRef: 'another-customer' }])), /match its usage customerRef/);
  assert.throws(() => validateEvidence(evidence([usage, settlement, { ...cash, amountUsd: 2 }])), /exceeds its recorded settlement/);
});

test('research references, restricted channels and the 14-day disabled calendar fail closed', async () => {
  const research = JSON.parse(await readFile(new URL('../examples/commercial-validation/research.json', import.meta.url), 'utf8'));
  const campaign = JSON.parse(await readFile(new URL('../examples/commercial-validation/campaign.json', import.meta.url), 'utf8'));
  const emptyExample = JSON.parse(await readFile(new URL('../examples/commercial-validation/evidence.example.json', import.meta.url), 'utf8'));
  assert.equal(emptyExample.events.length, 0);
  assert.equal(validateResearch(research).researchCandidates, 25);
  assert.equal(validateCampaign(campaign, research).durationDays, 14);
  const missingSource = structuredClone(research);
  missingSource.leads[0].source_ids = ['missing'];
  assert.throws(() => validateResearch(missingSource), /unknown source/);
  const restricted = structuredClone(research);
  restricted.channels.find((channel) => new URL(channel.url).hostname === 'community.n8n.io').automated_status = 'owned_channel_conditional';
  assert.throws(() => validateResearch(restricted), /prohibits automated posting/);
  for (const flag of ['executionEnabled', 'outboundEnabled', 'spendingEnabled', 'scheduleEnabled']) {
    assert.throws(() => validateCampaign({ ...campaign, [flag]: true }), /must remain false/);
  }
  const reordered = structuredClone(campaign);
  [reordered.days[0], reordered.days[1]] = [reordered.days[1], reordered.days[0]];
  assert.throws(() => validateCampaign(reordered), /sequential/);
  assert.throws(() => validateCampaign({ ...campaign, proposedStart: '2026-02-30' }), /valid date/);
});
