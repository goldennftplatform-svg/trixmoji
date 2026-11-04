'use strict'
const { ethers } = require('ethers')
const signature = ethers.utils.id('DEPOSIT_AND_LIST_SIGNATURE').slice(2).toLowerCase()
function isDepositCalldata(data, id) {
 const raw = String(data || '').toLowerCase(), asset = String(id || '').toLowerCase()
 if (!/^0x[0-9a-f]{64}$/.test(asset)) return false
 if (raw === asset) return true
 if (!/^0x[0-9a-f]{256}$/.test(raw) || raw.slice(2, 66) !== asset.slice(2) || raw.slice(66, 130) !== signature) return false
 return BigInt('0x' + raw.slice(130, 194)) > 0n && /^0{64}$/.test(raw.slice(194, 258))
}
module.exports = { isDepositCalldata }
