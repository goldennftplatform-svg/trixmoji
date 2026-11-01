const wrap = require('./_vercel-adapter');
const handler = require('../../api/pond-rigs-sync');
const { connectNetlifyBlobs } = require('../../api/lib/pond-rigs-store');
const { syncFromDune } = require('../../api/lib/pond-rigs-dune');

const httpHandler = wrap(handler);

/**
 * HTTP: /api/pond-rigs-sync
 * Cron: every 6 hours (Netlify scheduled function)
 */
exports.handler = async function (event, context) {
  try {
    connectNetlifyBlobs(event);
  } catch (e) {}

  // Scheduled invoke: body often { next_run: "..." } and no user auth
  var isSchedule = false;
  try {
    var raw = event && event.body;
    if (typeof raw === 'string' && raw.indexOf('next_run') !== -1) isSchedule = true;
    if (event && event.headers && event.headers['x-netlify-event'] === 'schedule') {
      isSchedule = true;
    }
  } catch (e) {}

  if (isSchedule) {
    try {
      var result = await syncFromDune({});
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({ ok: true, scheduled: true }, result))
      };
    } catch (err) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ok: false,
          scheduled: true,
          error: String(err && err.message ? err.message : err)
        })
      };
    }
  }

  return httpHandler(event, context);
};

exports.config = {
  schedule: '0 */6 * * *'
};
