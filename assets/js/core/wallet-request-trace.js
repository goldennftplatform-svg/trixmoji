(function (root, factory) {
 'use strict'
 if (typeof module !== 'undefined' && module.exports) module.exports = factory()
 else root.WalletRequestTrace = factory()
})(typeof window !== 'undefined' ? window : globalThis, function () {
 'use strict'
 // Intentionally record method names and outcomes only, never request params,
 // signatures, return payloads, wallet keys, or serialized transactions.
 function create(provider, report, options) {
  if (!provider || typeof provider.request !== 'function') throw Error('No wallet provider selected.')
  options = options || {}; report = report || function () {}
  var rows = [], limit = 40, waitMs = options.waitMs == null ? 12000 : options.waitMs
  function snapshot() { return rows.map(function (r) { return Object.assign({}, r) }) }
  function publish() { try { report(snapshot()) } catch (_) {} }
  function request(payload) {
   var row = { method: String(payload.method), state: 'requested', at: new Date().toISOString() }
   rows.push(row); if (rows.length > limit) rows.shift(); publish()
   var timer = setTimeout(function () { row.state = 'waiting-for-wallet'; publish() }, waitMs)
   function done(state, error) {
    clearTimeout(timer); row.state = state
    if (error) {
     var code = Number(error.code || error.data && error.data.originalError && error.data.originalError.code)
     if (Number.isFinite(code)) row.code = code
     // A method/outcome/code is enough to locate the failure without exporting
     // arbitrary error text supplied by an extension or RPC endpoint.
    }
    publish()
   }
   try {
    return Promise.resolve(provider.request(payload)).then(function (value) { done('answered'); return value }, function (error) { done('rejected', error); throw error })
   } catch (error) { done('rejected', error); return Promise.reject(error) }
  }
  var wrapped = { request: request }
  ;['on', 'removeListener'].forEach(function (name) { if (typeof provider[name] === 'function') wrapped[name] = function () { return provider[name].apply(provider, arguments) } })
  return { provider: wrapped, snapshot: snapshot }
 }
 return { create: create }
})
