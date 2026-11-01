'use strict'

// Log categories, never exception messages, request bodies, URLs, or credentials.
function report(stage, error) {
  const message = String(error && error.message || '')
  let reason = 'unexpected_error'
  if (error && error.name === 'MissingBlobsEnvironmentError') reason = 'blobs_runtime_credentials_missing'
  else if (error && error.name === 'BlobsConsistencyError') reason = 'blobs_uncached_endpoint_missing'
  else if (/phunk minter file is missing/i.test(message)) reason = 'minter_file_missing'
  else if (/phunk list is the wrong size/i.test(message)) reason = 'merkle_file_wrong_size'
  else if (/phunk list does not match/i.test(message)) reason = 'merkle_root_mismatch'
  else if (/siteid|site id|token|environment|configuration/i.test(message)) reason = 'storage_configuration'
  else if (/strong|consistency|uncached/i.test(message)) reason = 'storage_consistency'
  else if (/store is not available/i.test(message)) reason = 'storage_unavailable'
  else if (/401|403|unauthorized|forbidden/i.test(message)) reason = 'storage_access_denied'
  else if (/fetch|network|timeout|ENOTFOUND/i.test(message)) reason = 'upstream_connection'
  else if (/ENOENT/i.test(message)) reason = 'file_missing'
  else if (/JSON|Unexpected token/i.test(message)) reason = 'invalid_json'
  const detail = { stage, reason }
  console.error('[ethscriptions]', JSON.stringify(detail))
  return detail
}

module.exports = { report }
