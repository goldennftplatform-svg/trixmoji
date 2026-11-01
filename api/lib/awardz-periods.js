/** UTC day / week (Monday) / month locks. */

function pad(n) {
  return n < 10 ? '0' + n : String(n);
}

function ymd(ts) {
  const d = new Date(ts);
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
}

function dayStart(ts) {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function weekStart(ts) {
  const d = new Date(ts);
  const dow = d.getUTCDay();
  const offset = dow === 0 ? 6 : dow - 1;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - offset);
}

function monthStart(ts) {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

function weekIdFromStart(start) {
  const d = new Date(start);
  return 'week:' + d.toISOString().slice(0, 10);
}

function meta(kind, ts) {
  ts = Number(ts) || Date.now();
  if (kind === 'day') {
    const start = dayStart(ts);
    return { id: 'day:' + ymd(start), kind: 'day', start: start, end: start + 86400000 };
  }
  if (kind === 'week') {
    const start = weekStart(ts);
    return { id: weekIdFromStart(start), kind: 'week', start: start, end: start + 7 * 86400000 };
  }
  if (kind === 'month') {
    const start = monthStart(ts);
    const d = new Date(start);
    const end = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
    return {
      id: 'month:' + d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1),
      kind: 'month',
      start: start,
      end: end
    };
  }
  return null;
}

function kinds() {
  return ['day', 'week', 'month'];
}

module.exports = {
  meta,
  kinds,
  dayStart,
  weekStart,
  monthStart
};
