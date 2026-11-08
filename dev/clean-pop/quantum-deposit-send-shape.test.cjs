'use strict'
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { ethers } = require('ethers')
const { create } = require('../../assets/js/core/market-wallet-adapter')
const artifact = require('../../assets/data/trixmoji-escrow-replacement-artifact.json')

const owner = '0x47cf60BdD877203264921D05CE26F81f6d36Aa3E'
const market = '0x21c1A938d06f87A039abfC48d1cCB459f55b1685'
const creator = '0x915A3D363D0a4e4470B531f008F5142c540E5417'
const verifier = '0x5f5d219c6B3f732eBDCe4BFD9c4655957Ff472C4'
const minter = '0x11019B7af0F833f5695a44584c5B31Bb1D0baabC'
const id = '0xdf234357362b4884a50aa356f0cc6c76a52e72634c29c8e7440ca8232e285e74'
const hash = '0x' + 'ab'.repeat(32)
const iface = new ethers.utils.Interface(artifact.abi)

function fixture(action, accountCode = '0x', sharedStore = null, storageKey = undefined) {
  const store = sharedStore || new Map(), sends = [], calls = []
  let sendError = null
  const provider = {
    request: async (q) => {
      calls.push(JSON.parse(JSON.stringify(q)))
      if (q.method === 'eth_chainId') return '0x1'
      if (q.method === 'eth_accounts') return [owner]
      if (q.method === 'eth_getCode') return q.params[0].toLowerCase() === owner.toLowerCase() ? accountCode : '0x6000'
      if (q.method === 'eth_getTransactionCount') return '0x10'
      if (q.method === 'eth_estimateGas') return '0x186a0'
      if (q.method === 'eth_call') {
        const data = q.params[0].data
        if (data === iface.encodeFunctionData('creator')) return iface.encodeFunctionResult('creator', [creator])
        if (data === iface.encodeFunctionData('verifier')) return iface.encodeFunctionResult('verifier', [verifier])
        if (data.startsWith(iface.getSighash('depositBlock'))) return iface.encodeFunctionResult('depositBlock', [0])
        return '0x'
      }
      if (q.method === 'eth_sendTransaction') {
        assert.equal(q.params.length, 1)
        if (sendError) throw sendError
        sends.push(q.params[0])
        return hash
      }
      throw Error('unexpected ' + q.method)
    }
  }
  const client = create({
    provider, storageKey,
    storage: { getItem: (k) => store.get(k) || null, setItem: (k, v) => store.set(k, v) },
    locks: { request: async (_n, _o, fn) => fn({}) },
    abi: artifact.abi,
    runtimeHash: ethers.utils.keccak256('0x6000'),
    market, creator, verifier, chainId: 1, minter,
    combinedDepositEnabled: true,
    readAsset: async (asset) => ({
      transaction_hash: asset,
      current_owner: action === 'list' || action === 'cancel' ? market : owner,
      previous_owner: owner,
      creator: minter
    })
  })
  return { client, sends, calls, store, setSendError: error => { sendError = error }, setAccountCode: code => { accountCode = code } }
}

test('explicit wallet rejections clear only the unsent request; ambiguous errors stay saved', async () => {
  for (const error of [Object.assign(Error('rejected'), { code: 4001 }), Object.assign(Error('rejected'), { code: -32603, data: { originalError: { code: 4001 } } })]) {
    const f = fixture('deposit'); f.setSendError(error)
    await assert.rejects(f.client.run('deposit', { id }, q => q.approve()), /rejected/)
    assert.equal(f.client.records().length, 0)
  }
  const f = fixture('deposit'); f.setSendError(Error('wallet disconnected'))
  await assert.rejects(f.client.run('deposit', { id }, q => q.approve()), /disconnected/)
  assert.equal(f.client.records()[0].state, 'awaiting-wallet')
})

test('V1 and WebP market transaction records remain separate', async () => {
  const v1 = fixture('deposit'), v2 = fixture('deposit', '0x', v1.store, 'trixmoji.market.contract.transaction.webp-v2')
  await v1.client.run('deposit', { id }, q => q.approve())
  await v2.client.run('deposit', { id }, q => q.approve())
  assert.equal(v1.client.records().length, 1); assert.equal(v2.client.records().length, 1)
  assert.equal(v1.sends.length, 1); assert.equal(v2.sends.length, 1)
})

test('delegated account can request a deposit without a blanket block', async () => {
  const f = fixture('deposit', '0xef0100' + 'ab'.repeat(20))
  await f.client.run('deposit', { id }, async q => q.approve())
  assert.equal(f.sends.length, 1)
  assert.deepEqual(Object.keys(f.sends[0]).sort(), ['data', 'from', 'to', 'value'])
})

for (const action of ['deposit', 'depositAndList', 'gift']) {
  test(action + ' sends only from/to/value/data and retains simulation and estimation', async () => {
    const f = fixture(action), price = ethers.utils.parseEther('0.01')
    await f.client.run(action, { id, amountWei: price.toString(), recipient: creator }, async (q) => {
      assert.equal(q.estimatedGas, '100000')
      return q.approve()
    })
    assert.equal(f.sends.length, 1)
    const tx = f.sends[0]
    const data = action === 'depositAndList' ? ethers.utils.hexConcat([
      id, ethers.utils.id('DEPOSIT_AND_LIST_SIGNATURE'),
      ethers.utils.hexZeroPad(price.toHexString(), 32), ethers.constants.HashZero
    ]) : id
    assert.deepEqual(tx, {
      from: ethers.utils.getAddress(owner),
      to: ethers.utils.getAddress(action === 'gift' ? creator : market),
      value: '0x0', data
    })
    const estimate = f.calls.filter(q => q.method === 'eth_estimateGas')
    assert.deepEqual(estimate, [{ method: 'eth_estimateGas', params: [tx] }])
    assert.ok(f.calls.some(q => q.method === 'eth_call' && q.params[0].from === tx.from && q.params[0].data === data && q.params[1] === 'latest'))
    assert.ok(f.calls.findIndex(q => q.method === 'eth_estimateGas') < f.calls.findIndex(q => q.method === 'eth_sendTransaction'))
  })
}

test('structured list call retains padded gas and chainId', async () => {
  const f = fixture('list'), price = ethers.utils.parseEther('0.01')
  await f.client.run('list', { id, amountWei: price.toString() }, async (q) => q.approve())
  assert.equal(f.sends.length, 1)
  assert.deepEqual(f.sends[0], {
    from: ethers.utils.getAddress(owner), to: ethers.utils.getAddress(market), value: '0x0',
    data: iface.encodeFunctionData('list', [id, price]), gas: '0x1d4c0', chainId: '0x1'
  })
})
