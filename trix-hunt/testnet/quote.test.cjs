'use strict'

const { test } = require('node:test')
const assert = require('node:assert/strict')
const { ethers } = require('ethers')
const { quoteFromFeed, readQuote } = require('./quote.cjs')

const valid = { chainId: 11155111, answer: '200000000000', decimals: 8, updatedAt: 10000, blockTimestamp: 10000, roundId: '18446744073709551617', answeredInRound: '18446744073709551617' }
const quote = changes => quoteFromFeed({ ...valid, ...changes })

test('calculates all packs with integer arithmetic and JSON-safe metadata', () => {
  const result = quote({})
  assert.deepEqual(result.prices, [
    { pack: 'bullet', usdCents: 500, wei: '2500000000000000' },
    { pack: 'shotgun', usdCents: 750, wei: '3750000000000000' },
    { pack: 'sniper', usdCents: 1000, wei: '5000000000000000' }
  ])
  assert.equal(result.roundId, valid.roundId)
  assert.equal(result.feed, '0x694AA1769357215DE4FAC081bf1f309aDC325306')
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result)
})

test('ceilings fractional wei and rounds to the next ten wei, including exact boundaries', () => {
  // At $10^18/ETH the $5 pack costs exactly five wei; at $5*10^17 it costs ten.
  assert.equal(quote({ answer: '100000000000000000000000000' }).prices[0].wei, '10')
  assert.equal(quote({ answer: '50000000000000000000000000' }).prices[0].wei, '10')
  assert.equal(quote({ answer: '49999999999999999999999999' }).prices[0].wei, '20')
  assert.equal(quote({ answer: '3' }).prices[0].wei, '166666666666666666666666670')
})

test('accepts freshness boundary and rejects stale, future, and missing timestamps', () => {
  assert.doesNotThrow(() => quote({ blockTimestamp: 17200 }))
  for (const changes of [{ blockTimestamp: 17201 }, { blockTimestamp: 9999 }, { updatedAt: 0 }, { updatedAt: -1 }]) {
    assert.throws(() => quote(changes), /timestamp/)
  }
})

test('rejects wrong chain, precision, answer, round and malformed values', () => {
  for (const changes of [
    { chainId: 1 }, { decimals: 18 }, { answer: 0 }, { answer: -1 },
    { roundId: 0 }, { answeredInRound: '18446744073709551616' },
    { roundId: -1 }, { answer: '1.2' }, { chainId: null }
  ]) assert.throws(() => quote(changes))
  assert.doesNotThrow(() => quote({ answeredInRound: '18446744073709551618' }))
})

test('readQuote uses only pinned feed calls at the same block', async () => {
  const calls = []
  const iface = new ethers.utils.Interface([
    'function decimals() view returns (uint8)',
    'function latestRoundData() view returns (uint80,int256,uint256,uint256,uint80)'
  ])
  const provider = new ethers.providers.BaseProvider(11155111)
  provider.getNetwork = async () => ({ chainId: 11155111, name: 'sepolia' })
  provider.getBlock = async tag => { assert.equal(tag, 'latest'); return { number: 42, timestamp: 10000 } }
  provider.call = async (tx, blockTag) => {
    calls.push({ tx, blockTag })
    assert.equal(tx.to, '0x694AA1769357215DE4FAC081bf1f309aDC325306')
    if (tx.data === iface.getSighash('decimals')) return iface.encodeFunctionResult('decimals', [8])
    assert.equal(tx.data, iface.getSighash('latestRoundData'))
    return iface.encodeFunctionResult('latestRoundData', [valid.roundId, valid.answer, 9999, valid.updatedAt, valid.answeredInRound])
  }
  assert.deepEqual(await readQuote(provider), quote({}))
  assert.equal(calls.length, 2)
  for (const call of calls) assert.equal(call.blockTag, 42)
})

test('readQuote rejects wrong networks and sanitizes upstream errors', async () => {
  await assert.rejects(readQuote({ getNetwork: async () => ({ chainId: 1 }) }), /Unable to read Sepolia ETH\/USD quote/)
  await assert.rejects(readQuote({ getNetwork: async () => { throw Error('https://secret.example/key') } }), e => e.message === 'Unable to read Sepolia ETH/USD quote')
})
