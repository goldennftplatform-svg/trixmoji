'use strict'
const {createHandler}=require('./market-wallet-inventory-webp-v2')
const minter=require('../../assets/data/trixmoji-launch-candidate.json')
exports.handler=createHandler(minter,'market-wallet-inventory-launch')
