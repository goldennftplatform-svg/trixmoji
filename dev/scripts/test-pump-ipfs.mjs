const fd = new FormData();
fd.append('name', 'Test');
fd.append('symbol', 'TST');
fd.append('description', 'test');
fd.append('showName', 'true');
const r = await fetch('https://pump.fun/api/ipfs', { method: 'POST', body: fd });
console.log(r.status, await r.text());