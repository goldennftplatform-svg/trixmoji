'use strict'

const address = '0x11019B7af0F833f5695a44584c5B31Bb1D0baabC'
const creationTopic = '0x665fba0baf3dc33e9943340197893ac16f56482c2defb8de60f944987fee451c'
const replacementTopic = '0x2cf619006e771cc43a8b91ae80cc7bb2559a4daf2dbeb2093269c8b618c3a920'

async function getStatus(fetcher) {
 let url = 'https://eth.blockscout.com/api/v2/addresses/' + address + '/logs'
 let minted = 0, replacements = 0, pages = 0
 do {
  if (++pages > 300) throw Error('Log pagination limit exceeded')
  const response = await fetcher(url, { signal: AbortSignal.timeout(8000) })
  if (!response.ok) throw Error('Indexer unavailable')
  const data = await response.json()
  if (!Array.isArray(data.items)) throw Error('Invalid indexer response')
  for (const row of data.items) {
   const topic = String(row.topics && row.topics[0] || '').toLowerCase()
   if (topic === creationTopic) minted++
   if (topic === replacementTopic) replacements++
  }
  if (data.next_page_params) {
   const query = new URLSearchParams(data.next_page_params)
   url = 'https://eth.blockscout.com/api/v2/addresses/' + address + '/logs?' + query.toString()
  } else url = ''
 } while (url)
 if (minted > 10000 || replacements > minted) throw Error('Invalid event count')
 return { contract: address, minted, supply: 10000, replacements, source: 'Blockscout indexed contract logs', checkedAt: new Date().toISOString() }
}

exports.getStatus = getStatus
exports.handler = async function (event) {
 if (event.httpMethod !== 'GET') return { statusCode: 405, body: 'Method not allowed' }
 try {
  return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(await getStatus(fetch)) }
 } catch (_) {
  return { statusCode: 503, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify({ error: 'Clean Pop mint count unavailable' }) }
 }
}
