/* Bridge Vercel-style (req, res) handlers to Netlify Functions */
module.exports = function wrapVercelHandler(handler) {
  return async function netlifyHandler(event) {
    // Wire Netlify Blobs for Lambda-compat mode (shared catalog + pond rigs).
    try {
      var store = require('../../api/lib/vantablack-store');
      if (store && typeof store.connectNetlifyBlobs === 'function') {
        store.connectNetlifyBlobs(event);
      }
    } catch (e) {}
    try {
      var rigs = require('../../api/lib/pond-rigs-store');
      if (rigs && typeof rigs.connectNetlifyBlobs === 'function') {
        rigs.connectNetlifyBlobs(event);
      }
    } catch (e) {}
    try {
      var xscores = require('../../api/lib/x-scores-store');
      if (xscores && typeof xscores.connectNetlifyBlobs === 'function') {
        xscores.connectNetlifyBlobs(event);
      }
    } catch (e) {}
    try {
      var awardz = require('../../api/lib/awardz-store');
      if (awardz && typeof awardz.connectNetlifyBlobs === 'function') {
        awardz.connectNetlifyBlobs(event);
      }
    } catch (e) {}
    try {
      var xgate = require('../../api/lib/x-gate-store');
      if (xgate && typeof xgate.connectNetlifyBlobs === 'function') {
        xgate.connectNetlifyBlobs(event);
      }
    } catch (e) {}
    try {
      var geoffwatch = require('../../api/lib/geoff-watch-store');
      if (geoffwatch && typeof geoffwatch.connectNetlifyBlobs === 'function') {
        geoffwatch.connectNetlifyBlobs(event);
      }
    } catch (e) {}
    try {
      var dailywatch = require('../../api/lib/daily-watch-store');
      if (dailywatch && typeof dailywatch.connectNetlifyBlobs === 'function') {
        dailywatch.connectNetlifyBlobs(event);
      }
    } catch (e) {}
    try {
      var deploywatch = require('../../api/lib/deploy-watch-store');
      if (deploywatch && typeof deploywatch.connectNetlifyBlobs === 'function') {
        deploywatch.connectNetlifyBlobs(event);
      }
    } catch (e) {}
    try {
      var mailgate = require('../../api/lib/mail-gate-store');
      if (mailgate && typeof mailgate.connectNetlifyBlobs === 'function') {
        mailgate.connectNetlifyBlobs(event);
      }
    } catch (e) {}
    try {
      var accounts = require('../../api/lib/account-store');
      if (accounts && typeof accounts.connectNetlifyBlobs === 'function') {
        accounts.connectNetlifyBlobs(event);
      }
    } catch (e) {}
    try {
      var trixlive = require('../../api/lib/trix-live-store');
      if (trixlive && typeof trixlive.connectNetlifyBlobs === 'function') {
        trixlive.connectNetlifyBlobs(event);
      }
    } catch (e) {}

    return new Promise(function (resolve, reject) {
      var query = Object.assign({}, event.queryStringParameters || {});
      if (event.rawQuery) {
        event.rawQuery.split('&').forEach(function (pair) {
          if (!pair) return;
          var idx = pair.indexOf('=');
          var key = decodeURIComponent(idx >= 0 ? pair.slice(0, idx) : pair).toLowerCase();
          var val = decodeURIComponent(idx >= 0 ? pair.slice(idx + 1) : '');
          if (key && (query[key] == null || query[key] === '')) query[key] = val;
        });
      }
      if (event.multiValueQueryStringParameters) {
        Object.keys(event.multiValueQueryStringParameters).forEach(function (key) {
          var list = event.multiValueQueryStringParameters[key];
          if (list && list.length && (query[key] == null || query[key] === '')) {
            query[key] = list[0];
          }
        });
      }
      var body = {};
      if (event.body) {
        try {
          body = JSON.parse(event.body);
        } catch (e) {
          body = {};
        }
      }

      if (event.isBase64Encoded && typeof event.body === 'string') {
        try {
          body = JSON.parse(Buffer.from(event.body, 'base64').toString('utf8'));
        } catch (e) {
          body = {};
        }
      }

      var req = {
        method: event.httpMethod,
        query: query,
        body: body,
        headers: event.headers || {},
        __netlifyEvent: event
      };

      var statusCode = 200;
      var headers = {};
      var settled = false;

      function finish(payload) {
        if (settled) return;
        settled = true;
        resolve(payload);
      }

      function pack(body) {
        var outHeaders = Object.assign({}, headers);
        var multi = {};
        var setCookie = outHeaders['Set-Cookie'] || outHeaders['set-cookie'];
        if (Array.isArray(setCookie)) {
          multi['Set-Cookie'] = setCookie;
          delete outHeaders['Set-Cookie'];
          delete outHeaders['set-cookie'];
        }
        return {
          statusCode: statusCode,
          headers: outHeaders,
          multiValueHeaders: multi,
          body: body == null ? '' : body
        };
      }

      var res = {
        setHeader: function (key, value) {
          if (String(key).toLowerCase() === 'set-cookie') {
            var list = Array.isArray(value) ? value : [value];
            var prev = headers['Set-Cookie'];
            headers['Set-Cookie'] = (Array.isArray(prev) ? prev : prev ? [prev] : []).concat(list);
            return;
          }
          headers[key] = value;
        },
        status: function (code) {
          statusCode = code;
          return res;
        },
        redirect: function (url) {
          if (!(statusCode >= 300 && statusCode < 400)) statusCode = 302;
          headers['Location'] = url;
          finish(pack(''));
        },
        json: function (data) {
          headers['Content-Type'] = headers['Content-Type'] || 'application/json';
          finish(pack(JSON.stringify(data)));
        },
        send: function (data) {
          if (typeof data === 'object' && data !== null && !Buffer.isBuffer(data)) {
            headers['Content-Type'] = headers['Content-Type'] || 'application/json';
            finish(pack(JSON.stringify(data)));
            return;
          }
          finish(pack(data == null ? '' : String(data)));
        },
        end: function (data) {
          finish(pack(data == null ? '' : String(data)));
        }
      };

      try {
        var result = handler(req, res);
        if (result && typeof result.then === 'function') {
          result.catch(reject);
        }
      } catch (err) {
        reject(err);
      }
    });
  };
};