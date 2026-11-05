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

function fixture(action, accountCode = '0x') {
  const store = new Map(), sends = [], calls = []
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
        sends.push(q.params[0])
        return hash
      }
      throw Error('unexpected ' + q.method)
    }
  }
  const client = create({
    provider,
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
  return { client, sends, calls, setAccountCode: code => { accountCode = code } }
}

for (const action of ['deposit', 'depositAndList']) {
  test(action + ' refuses EIP-7702 accounts before wallet approval', async () => {
    const f = fixture(action, '0xef0100' + 'ab'.repeat(20))
    await assert.rejects(f.client.run(action, { id, amountWei: '1' }, async q => q.approve()), /EIP-7702 delegation/)
    assert.equal(f.sends.length, 0)
  })
}

test('deposit rechecks delegation immediately before sending', async () => {
  const f = fixture('deposit')
  await assert.rejects(f.client.run('deposit', { id }, async q => {
    f.setAccountCode('0xef0100' + 'ab'.repeat(20))
    return q.approve()
  }), /EIP-7702 delegation/)
  assert.equal(f.sends.length, 0)
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
