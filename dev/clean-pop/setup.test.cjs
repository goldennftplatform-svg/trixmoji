const { test } = require('node:test')
const assert = require('node:assert/strict')
const vm = require('node:vm'), fs = require('node:fs'), path = require('node:path')
const html = fs.readFileSync(path.join(__dirname, '../../classic/pages/clean-pop-setup.html'), 'utf8')
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1]
async function load(options) {
 const elements = {}, configured = []
 const context = { document: { getElementById(id) { return elements[id] ||= { disabled: true, textContent: '' } } },
  EthscriptionCheckout: { configure(id) { configured.push(id) }, eth() { return '0.0002' } },
  localStorage: { getItem() { return null } }, CleanPopControl: { saved() { return null } }, AbortSignal,
  fetch: async url => {
   if (url === '/api/ethscriptions') {
    if (options.error) throw Error('Offline')
    return { ok: true, json: async () => ({ walletConnectProjectId: options.id || '' }) }
   }
   return { ok: true, json: async () => ({ version: 'clean-pop-v1', chainId: 1, address: '0x'+'1'.repeat(40), deployData: '0x1234', runtime: '0x1234', priceWei:'200000000000000' }) }
  } }
 vm.runInNewContext(script, context)
 await new Promise(resolve => setImmediate(resolve))
 return { elements, configured }
}
test('deployment page loads WalletConnect configuration before enabling connection', async () => {
 const { elements, configured } = await load({ id: 'test-public-project-id' })
 assert.deepEqual(configured, ['test-public-project-id'])
 assert.equal(elements.prepare.disabled, false)
 assert.match(elements.connectionHelp.textContent, /WalletConnect/)
})
test('missing mobile configuration gives a wallet-browser instruction', async () => {
 const { elements } = await load({})
 assert.equal(elements.prepare.disabled, false)
 assert.match(elements.connectionHelp.textContent, /Mobile QR is not configured/)
})
test('wallet options outage does not disable installed wallet connection', async () => {
 const { elements } = await load({ error: true })
 assert.equal(elements.prepare.disabled, false)
 assert.match(elements.connectionHelp.textContent, /Installed Ethereum wallets still work/)
})
