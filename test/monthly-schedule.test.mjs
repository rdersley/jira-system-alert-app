import test from 'node:test';
import assert from 'node:assert/strict';
import { dublinParts, scheduleState } from '../src/monthly-schedule.mjs';

test('recognises first Wednesday at configured Ireland time during DST', () => {
  const before = new Date('2026-09-02T04:59:00Z'); // 05:59 Europe/Dublin
  const due = new Date('2026-09-02T05:00:00Z'); // 06:00 Europe/Dublin
  assert.equal(scheduleState(before, 6).due, false);
  assert.equal(scheduleState(due, 6).due, true);
  assert.equal(dublinParts(due).hour, 6);
});

test('does not run before first Wednesday target hour', () => {
  const atFive = new Date('2026-09-02T04:00:00Z'); // 05:00 Ireland
  const state = scheduleState(atFive, 6);
  assert.equal(state.firstWednesday, true);
  assert.equal(state.atOrAfter, false);
  assert.equal(state.due, false);
});

test('does not run on a later Wednesday', () => {
  const laterWednesday = new Date('2026-09-09T05:00:00Z');
  assert.equal(scheduleState(laterWednesday, 6).due, false);
});

test('handles winter Ireland time without a hard-coded UTC offset', () => {
  const due = new Date('2026-12-02T06:00:00Z');
  assert.equal(dublinParts(due).hour, 6);
  assert.equal(scheduleState(due, 6).due, true);
});
