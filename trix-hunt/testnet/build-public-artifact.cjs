'use strict'
// Reproducible Sepolia-only build; no network calls or deployment.
const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module')
const deps=process.env.TRIX_TEST_DEPS;if(!deps)throw Error('TRIX_TEST_DEPS is required')
const solc=createRequire(path.join(deps,'package.json'))('solc'),artifact=require('./compile-settlement.cjs').compile(solc)
const out=path.join(__dirname,'..','sepolia-settlement-artifact.json')
fs.writeFileSync(out,JSON.stringify(artifact,null,2)+'\n')
console.log('Built Sepolia test settlement artifact; no contract deployed.')
