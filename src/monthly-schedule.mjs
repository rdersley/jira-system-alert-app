const DUBLIN_TZ = 'Europe/Dublin';

export function dublinParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-IE', {
    timeZone: DUBLIN_TZ,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  const value = type => parts.find(p => p.type === type)?.value || '';
  return {
    weekday: value('weekday'),
    year: Number(value('year')),
    month: Number(value('month')),
    day: Number(value('day')),
    hour: Number(value('hour')),
    minute: Number(value('minute'))
  };
}

export function scheduleState(date = new Date(), targetHour = 10) {
  const local = dublinParts(date);
  const hour = Math.max(0, Math.min(23, Number.isFinite(Number(targetHour)) ? Number(targetHour) : 10));
  const firstWednesday = local.weekday === 'Wed' && local.day >= 1 && local.day <= 7;
  const atOrAfter = local.hour >= hour;
  let reason = 'Not the first Wednesday.';
  if (firstWednesday && !atOrAfter) reason = `Waiting until ${String(hour).padStart(2, '0')}:00 Ireland time.`;
  if (firstWednesday && atOrAfter) reason = 'Inside the first-Wednesday send window.';
  return {
    due: firstWednesday && atOrAfter,
    firstWednesday,
    atOrAfter,
    targetHour: hour,
    local,
    timeZone: DUBLIN_TZ,
    reason
  };
}
