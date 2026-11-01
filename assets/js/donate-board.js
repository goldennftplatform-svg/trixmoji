/* Live MAPS / Wu Tang donation board — reads /api/dswpz-track */
window.DOSWAPZ_DONATE_BOARD = (function () {
  'use strict'

  var TRACK = '/api/dswpz-track'
  var TREAS = {
    SOL: '5tJbQX5vRxDyHNEXdAmLEWtKR8EyrDTRdYtBFqujmpAc',
    ETH: '0x5be58476DF379BAdc88b552F603db227C0D95bac',
    BTC: 'bc1qtwqxrsj8ur8zyp9ku47dx6ljhc9dxmjc8j4t2g'
  }

  function $(id) {
    return document.getElementById(id)
  }

  function n(v) {
    var x = Number(v)
    return Number.isFinite(x) ? x : 0
  }

  function sol(v) {
    return n(v).toFixed(4)
  }

  function usd(v) {
    if (v == null || !isFinite(Number(v))) return ' - '
    var x = Number(v)
    if (x >= 1000) return '$' + Math.round(x).toLocaleString('en-US')
    if (x >= 1) return '$' + x.toFixed(2)
    return '$' + x.toFixed(4)
  }

  function fillAddr(id, value) {
    var el = $(id)
    if (el && value) el.textContent = value
  }

  function renderDays(days) {
    if (!days || !days.length) {
      return '<tr><td colspan="5">No on-chain donation rows yet. Refresh after the next MAPS / Wu Tang sweep.</td></tr>'
    }
    return days
      .slice(0, 12)
      .map(function (d) {
        var txs = Array.isArray(d.txs) ? d.txs : []
        var links =
          txs
            .map(function (t) {
              var sig = t.sig || ''
              var short = sig.slice(0, 8)
              var cause = t.cause === 'wutang' ? 'WU' : 'MAPS'
              return (
                '<a href="https://solscan.io/tx/' +
                sig +
                '" target="_blank" rel="noopener">' +
                cause +
                ' ' +
                n(t.amountSol).toFixed(4) +
                ' (' +
                short +
                ')</a>'
              )
            })
            .join('<br>') || ' - '
        return (
          '<tr>' +
          '<td>' +
          (d.date || '') +
          '</td>' +
          '<td>' +
          sol(d.inSol) +
          '</td>' +
          '<td>' +
          sol(d.mapsSol) +
          '</td>' +
          '<td>' +
          sol(d.wuTangSol) +
          '</td>' +
          '<td>' +
          links +
          '</td>' +
          '</tr>'
        )
      })
      .join('')
  }

  async function refresh() {
    var status = $('donateBoardStatus')
    var body = $('donateBoardBody')
    if (status) status.textContent = 'SYNCING /api/dswpz-track ...'
    try {
      var res = await fetch(TRACK, { headers: { Accept: 'application/json' } })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      var data = await res.json()
      var ledger = data.ledger || {}
      var market = data.market || {}
      if ($('donateClaimed')) $('donateClaimed').textContent = sol(ledger.claimedSol)
      if ($('donateMaps')) $('donateMaps').textContent = sol(ledger.donatedMapsSol)
      if ($('donateWu')) $('donateWu').textContent = sol(ledger.donatedWuTangSol)
      if ($('donateRemain')) $('donateRemain').textContent = sol(ledger.remainderSol)
      if ($('donateFeeBal')) $('donateFeeBal').textContent = sol(ledger.feeWalletSol)
      if ($('donateVol')) $('donateVol').textContent = usd(market.volumeTotal)
      if ($('donateCurve')) {
        $('donateCurve').textContent =
          market.curveSol != null
            ? Number(market.curveSol).toFixed(3) +
              (market.curveTargetSol ? ' / ' + Number(market.curveTargetSol).toFixed(0) : '') +
              ' SOL'
            : ' - '
      }
      if (body) body.innerHTML = renderDays(ledger.days)
      fillAddr('donateSolAddr', data.feeWallet || TREAS.SOL)
      fillAddr('donateEthAddr', TREAS.ETH)
      fillAddr('donateBtcAddr', TREAS.BTC)
      var stamp = data.updatedAt ? data.updatedAt.replace('T', ' ').replace(/\..+/, ' UTC') : ''
      var err = data.ledgerError ? ' * RPC ' + data.ledgerError : ''
      if (status) {
        status.textContent =
          'LIVE ' +
          stamp +
          ' * MAPS ' +
          sol(ledger.donatedMapsSol) +
          ' * WU TANG ' +
          sol(ledger.donatedWuTangSol) +
          err
      }
    } catch (e) {
      if (status) status.textContent = 'BOARD SYNC FAILED: ' + (e.message || e)
    }
  }

  function mount() {
    fillAddr('donateSolAddr', TREAS.SOL)
    fillAddr('donateEthAddr', TREAS.ETH)
    fillAddr('donateBtcAddr', TREAS.BTC)
    var btn = $('donateBoardRefresh')
    if (btn) btn.addEventListener('click', refresh)
    refresh()
  }

  return { mount: mount, refresh: refresh, TREAS: TREAS }
})()
