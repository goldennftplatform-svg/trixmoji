/**
 * Trix Market API smoke tests.
 * Run: node scripts/test-trix-api.mjs
 */

let passed = 0;
let failed = 0;

function ok(label, detail) {
  passed++;
  console.log(`PASS  ${label}${detail ? ' — ' + detail : ''}`);
}

function fail(label, detail) {
  failed++;
  console.error(`FAIL  ${label}${detail ? ' — ' + detail : ''}`);
}

async function main() {
  console.log('DOSWAPZ Trix Market API tests\n');

  try {
    const trending = await fetch('https://trix.market/api/trending').then((r) => r.json());
    const keys = Object.keys(trending);
    if (!keys.includes('trending') || !keys.includes('recentlyGraduated')) {
      fail('trending shape', 'missing expected keys');
    } else {
      const count =
        (trending.trending?.length || 0) +
        (trending.recentlyGraduated?.length || 0) +
        (trending.topGainers?.length || 0);
      ok('trending endpoint', count + ' tokens across sections');
      const sample = trending.trending?.[0] || trending.recentlyGraduated?.[0];
      if (sample?.mint && sample?.symbol) {
        ok('trending token fields', sample.symbol + ' mint=' + sample.mint.slice(0, 8) + '...');
      } else {
        fail('trending token fields', 'missing mint/symbol');
      }
    }
  } catch (e) {
    fail('trending endpoint', e.message);
  }

  try {
    const search = await fetch('https://trix.market/api/search?q=toasty').then((r) => r.json());
    if (!Array.isArray(search.tokens) || !search.tokens.length) {
      fail('search endpoint', 'no tokens returned');
    } else {
      const t = search.tokens[0];
      ok('search endpoint', (t.symbol || '?') + ' mintAddress=' + (t.mintAddress || '').slice(0, 8) + '...');
    }
  } catch (e) {
    fail('search endpoint', e.message);
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});