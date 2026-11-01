const wrap = require('./_vercel-adapter');
const handler = require('../../api/awardz-settle');
const { connectNetlifyBlobs } = require('../../api/lib/awardz-store');
const { runSettle } = require('../../api/awardz-settle');

const httpHandler = wrap(handler);

exports.handler = async function (event, context) {
  try {
    connectNetlifyBlobs(event);
  } catch (e) {}

  var isSchedule = false;
  try {
    if (event && event.headers && event.headers['x-netlify-event'] === 'schedule') {
      isSchedule = true;
    }
  } catch (e) {}

  if (isSchedule) {
    try {
      var result = await runSettle({ pay: false });
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({ scheduled: true, pay: false }, result))
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
  schedule: '*/15 * * * *'
};
