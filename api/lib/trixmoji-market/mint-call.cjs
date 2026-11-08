'use strict'
const { ethers } = require('ethers')
const DELEGATION_MANAGER = '0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3'
const wrapper = new ethers.utils.Interface(['function redeemDelegations(bytes[] permissionContexts, bytes32[] modes, bytes[] executionCallDatas)'])
const same = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase()

// Only decode the verified single-call MetaMask format. The caller must still
// verify the successful receipt, minter event, artwork proof and indexer data.
function extractMintCall(tx, minter, allowWrapped) {
 if (!tx || !ethers.utils.isAddress(minter || '') || !ethers.utils.isHexString(tx.data || '')) throw Error('Invalid mint transaction.')
 if (same(tx.to, minter)) return { data: tx.data, value: ethers.BigNumber.from(tx.value), wrapped: false }
 if (!allowWrapped || !same(tx.to, DELEGATION_MANAGER) || !ethers.BigNumber.from(tx.value).isZero()) throw Error('Mint transaction target is not supported.')
 let parsed
 try { parsed = wrapper.parseTransaction({ data: tx.data }) } catch (_) { throw Error('Unsupported wrapped mint transaction.') }
 if (!parsed || parsed.name !== 'redeemDelegations' || parsed.args.permissionContexts.length !== 1 || parsed.args.modes.length !== 1 || parsed.args.executionCallDatas.length !== 1 || !same(parsed.args.modes[0], ethers.constants.HashZero)) throw Error('Unsupported wrapped mint execution mode.')
 const execution = parsed.args.executionCallDatas[0]
 if (!ethers.utils.isHexString(execution) || ethers.utils.hexDataLength(execution) < 56 || !same(ethers.utils.hexDataSlice(execution, 0, 20), minter)) throw Error('Wrapped mint target does not match the minter.')
 return { data: ethers.utils.hexDataSlice(execution, 52), value: ethers.BigNumber.from(ethers.utils.hexDataSlice(execution, 20, 52)), wrapped: true }
}
module.exports = { extractMintCall, DELEGATION_MANAGER }
