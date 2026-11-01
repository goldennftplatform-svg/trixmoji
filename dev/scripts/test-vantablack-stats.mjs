import handler from '../../api/vantablack-token-stats.js';

const pumpMint = 'FKaSujGciK4hhFxacUPRycsTiv5W2NirjAuYsZLgpump';
const graduated = 'E2ueKQ3EDTTmCkUA17j3KeTb2u6VT91xiyECdKRzpump';

function mockRes() {
  const headers = {};
  return {
    headers,
    setHeader(k, v) { headers[k] = v; },
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; }
  };
}

async function run(mint, launchType) {
  const res = mockRes();
  await handler(
    { method: 'GET', query: { mint, launchType } },
    res
  );
  const row = res.body?.stats?.[0];
  console.log(mint.slice(0, 8) + '…', launchType || 'auto', {
    ok: row?.ok,
    mcap: row?.marketCap,
    curve: row?.curve,
    spark: row?.sparkline?.length
  });
}

await run(pumpMint, 'curve');
await run(graduated, 'curve');
console.log('stats API test done');