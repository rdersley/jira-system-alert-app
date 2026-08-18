import test from 'node:test';
import assert from 'node:assert/strict';
import { selectEligibleContacts, uniqueDeliveryTargets, renderTokens, monthKeyUtc, shouldRunMonthlyTest } from '../src/safety.mjs';

const contacts = [
  { id:'r1', clientCode:'RYR', active:true, priorities:['P1','P2'], email:'a@example.com', emailAlerts:true, mobile:'+3531', smsAlerts:true, monthlyTestAlerts:true },
  { id:'r2', clientCode:'RYR', active:true, priorities:['P2'], email:'A@example.com', emailAlerts:true, mobile:'+3531', smsAlerts:true, monthlyTestAlerts:false },
  { id:'b1', clientCode:'BUZZ', active:true, priorities:['P1'], email:'buzz@example.com', emailAlerts:true, mobile:'+3532', smsAlerts:true, monthlyTestAlerts:true },
  { id:'off', clientCode:'RYR', active:false, priorities:['P1'], email:'off@example.com', emailAlerts:true, monthlyTestAlerts:true }
];

test('client isolation prevents cross-client recipients', () => {
  const result = selectEligibleContacts(contacts, { clientCode:'RYR', priority:'P1', alertType:'initial' });
  assert.deepEqual(result.map(x => x.id), ['r1']);
});

test('priority eligibility selects only matching active contacts', () => {
  const result = selectEligibleContacts(contacts, { clientCode:'RYR', priority:'P2', alertType:'update' });
  assert.deepEqual(result.map(x => x.id), ['r1','r2']);
});

test('monthly test uses monthly-test opt-in, not priority', () => {
  const result = selectEligibleContacts(contacts, { clientCode:'RYR', priority:'', alertType:'monthly-test' });
  assert.deepEqual(result.map(x => x.id), ['r1']);
});

test('delivery targets are deduplicated', () => {
  const eligible = selectEligibleContacts(contacts, { clientCode:'RYR', priority:'P2' });
  assert.deepEqual(uniqueDeliveryTargets(eligible, 'email'), ['a@example.com']);
  assert.deepEqual(uniqueDeliveryTargets(eligible, 'sms'), ['+3531']);
});

test('template tokens render additional incident fields', () => {
  assert.equal(renderTokens('Impact: {{field.impact}} / {{clientCode}}', {'field.impact':'High', clientCode:'RYR'}), 'Impact: High / RYR');
});

test('month key is stable in UTC', () => {
  assert.equal(monthKeyUtc(new Date('2026-08-31T23:59:00Z')), '2026-08');
});

test('monthly test runs once at configured hour', () => {
  assert.equal(shouldRunMonthlyTest({currentHour:10,targetHour:10,alreadySent:false}), true);
  assert.equal(shouldRunMonthlyTest({currentHour:10,targetHour:10,alreadySent:true}), false);
  assert.equal(shouldRunMonthlyTest({enabled:false,currentHour:10,targetHour:10}), false);
});
