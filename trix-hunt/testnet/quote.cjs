'use strict'

const { ethers } = require('ethers')
const { BigNumber } = ethers
const FEED = '0x694AA1769357215DE4FAC081bf1f309aDC325306'
const ABI = [
  'function decimals() view returns (uint8)',
  'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)'
]
const PACKS = [['bullet', 500], ['shotgun', 750], ['sniper', 1000]]

function quoteFromFeed({ chainId, answer, decimals, updatedAt, blockTimestamp, roundId, answeredInRound }) {
  let chain, price, precision, updated, timestamp, round, answered
  try {
    chain = BigNumber.from(chainId)
    price = BigNumber.from(answer)
    precision = BigNumber.from(decimals)
    updated = BigNumber.from(updatedAt)
    timestamp = BigNumber.from(blockTimestamp)
    round = BigNumber.from(roundId)
    answered = BigNumber.from(answeredInRound)
  } catch (_) {
    throw new Error('Invalid feed data')
  }
  if (!chain.eq(11155111)) throw new Error('Invalid chain')
  if (!precision.eq(8)) throw new Error('Invalid feed decimals')
  if (price.lte(0)) throw new Error('Invalid feed answer')
  if (updated.lte(0) || timestamp.lt(updated) || timestamp.sub(updated).gt(7200)) throw new Error('Invalid feed timestamp')
  if (round.lte(0) || answered.lt(round)) throw new Error('Invalid feed round')

  // cents / 100 USD, divided by (answer / 10^8) USD per ETH.
  // Round directly to the next ten wei, which also rounds up fractional wei.
  const denominator = price.mul(10)
  const prices = PACKS.map(([pack, usdCents]) => {
    const numerator = BigNumber.from(usdCents).mul('1000000000000000000000000')
    const wei = numerator.add(denominator).sub(1).div(denominator).mul(10)
    return { pack, usdCents, wei: wei.toString() }
  })
  return {
    chainId: chain.toString(), feed: FEED, answer: price.toString(), decimals: 8,
    updatedAt: updated.toString(), blockTimestamp: timestamp.toString(),
    roundId: round.toString(), answeredInRound: answered.toString(), prices
  }
}

async function readQuote(provider) {
  try {
    const network = await provider.getNetwork()
    if (!BigNumber.from(network.chainId).eq(11155111)) throw new Error('Invalid chain')
    const block = await provider.getBlock('latest')
    if (!block || !Number.isSafeInteger(block.number) || block.number < 0) throw new Error('Invalid block')
    const feed = new ethers.Contract(FEED, ABI, provider)
    const [decimals, data] = await Promise.all([
      feed.decimals({ blockTag: block.number }),
      feed.latestRoundData({ blockTag: block.number })
    ])
    return quoteFromFeed({ chainId: network.chainId, answer: data.answer, decimals, updatedAt: data.updatedAt,
      blockTimestamp: block.timestamp, roundId: data.roundId, answeredInRound: data.answeredInRound })
  } catch (_) {
    throw new Error('Unable to read Sepolia ETH/USD quote')
  }
}

module.exports = { quoteFromFeed, readQuote }
