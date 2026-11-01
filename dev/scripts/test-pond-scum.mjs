import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function check(label, ok) {
  if (!ok) {
    console.error('FAIL:', label);
    process.exitCode = 1;
  } else {
    console.log('OK:', label);
  }
}

const pondScumHtml = read('pages/pond-scum.html');
const swapHtml = read('pages/doswapz/swap.html');
const hubHtml = read('hub.html');
const pondScumJs = read('assets/js/pond/scum.js');
const pondRailJs = read('assets/js/swap/pond-rail.js');
const pondConfig = read('assets/js/config/pond-config.js');

check('pond-scum page exists', pondScumHtml.includes('dossierGrid'));
check('pond-scum loads scum.js', pondScumHtml.includes('/assets/js/pond/scum.js'));
check('pond-scum soft sign copy', pondScumJs.includes('SOFT SIGN ONLY'));
check('pond dossier proxy wired', pondScumJs.includes('/api/pond-dossier'));
check('pond mining proxy wired', pondScumJs.includes('/api/pond-mining'));
check('pond-scum mining section', pondScumHtml.includes('miningGrid'));
check('mining stats fields', pondScumJs.includes('mining_sessions'));
check('page has dossier swap iframe', pondScumHtml.includes('dossierSwapFrame'));
check('swap links to pond scum', swapHtml.includes('/classic/pages/pond-scum.html'));
check('dossier swap builds ref URL', pondRailJs.includes("searchParams.set('ref'") || pondScumJs.includes("searchParams.set('ref'"));
check('hub links pond scum', hubHtml.includes('/classic/pages/pond-scum.html'));
check('hub has own pond scum section', hubHtml.includes('POND SCUM'));
check('pond-config has jupiter plugin', pondConfig.includes('swap-solana-3'));

check('api/pond-manifest.js exists', fs.existsSync(path.join(root, 'api/pond-manifest.js')));
check('api/pond-stats.js exists', fs.existsSync(path.join(root, 'api/pond-stats.js')));
check('api/pond-mining.js exists', fs.existsSync(path.join(root, 'api/pond-mining.js')));

console.log(process.exitCode ? '\nSome checks failed.' : '\nAll pond checks passed.');