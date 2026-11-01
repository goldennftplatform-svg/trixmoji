/* DOSWAPZ - The Attic card-pull forum */
window.DOSWAPZ_ATTIC = (function () {
 'use strict';

 var API = '/api/attic-posts';
 var MAX_FILE_BYTES = 8 * 1024 * 1024;
 var MAX_OUTPUT_DIM = 720;
 var JPEG_QUALITY = 0.82;

 var state = {
 posts: [],
 filter: 'all',
 previewUrl: null,
 wallet: null
 };

 function $(id) {
 return document.getElementById(id);
 }

 function escapeHtml(str) {
 return String(str)
 .replace(/&/g, '&amp;')
 .replace(/</g, '&lt;')
 .replace(/>/g, '&gt;')
 .replace(/"/g, '&quot;');
 }

 function formatTs(ts) {
 if (!ts) return '';
 try {
 return new Date(ts).toLocaleString(undefined, {
 month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
 });
 } catch (e) {
 return '';
 }
 }

 function categoryLabel(cat) {
 if (cat === 'sports') return 'SPORTS';
 if (cat === 'pokemon') return 'POKÉMON';
 return 'OTHER';
 }

 function setStatus(msg, isError) {
 var el = $('postStatus');
 if (!el) return;
 el.innerHTML = isError
 ? '<span class="status-err">' + escapeHtml(msg) + '</span>'
 : '<span class="status-ok">' + escapeHtml(msg) + '</span>';
 }

 function buildSignMessage(wallet) {
 var category = (document.querySelector('input[name="cardCategory"]:checked') || {}).value || 'sports';
 return [
 'DOSWAPZ - THE ATTIC - SOFT SIGN ONLY',
 'Category: ' + category.toUpperCase(),
 'Timestamp: ' + Date.now(),
 'Wallet: ' + wallet,
 '',
 'This is a signature-only verification. NO FUNDS. NO TRANSACTION.',
 'NO TOKEN APPROVAL. NO MOVE OF ASSETS. MESSAGE SIGN ONLY.',
 'Signing logs your card photo post. Nothing else can happen.',
 'I confirm this upload is a photo of trading cards only (sports or Pokémon).',
 'No inappropriate, non-card, or offensive content.'
 ].join('\n');
 }

 function solanaPublicKey() {
 if (!window.solana || !window.solana.publicKey) return null;
 try {
 return window.solana.publicKey.toString();
 } catch (e) {
 return null;
 }
 }

 async function solanaSoftConnect() {
 var existing = solanaPublicKey();
 if (existing) return existing;

 if (window.solana.connect) {
 try {
 var silent = await window.solana.connect({ onlyIfTrusted: true });
 if (silent && silent.publicKey) return silent.publicKey.toString();
 } catch (e) { /* fall through */ }
 }

 var resp = await window.solana.connect({ onlyIfTrusted: false });
 return resp.publicKey.toString();
 }

 async function softSign() {
 if (window.solana && typeof window.solana.signMessage === 'function') {
 var publicKey = await solanaSoftConnect();
 var encoded = new TextEncoder().encode(buildSignMessage(publicKey));
 var signed = await window.solana.signMessage(encoded, 'utf8');
 var sig = signed.signature;
 var sigStr = typeof sig === 'string'
 ? sig
 : btoa(String.fromCharCode.apply(null, new Uint8Array(sig)));
 return { wallet: publicKey, signature: sigStr };
 }

 if (window.ethereum && typeof window.ethereum.request === 'function') {
 var accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
 var addr = accounts[0];
 var ethSig = await window.ethereum.request({
 method: 'personal_sign',
 params: [buildSignMessage(addr), addr]
 });
 return { wallet: addr, signature: ethSig };
 }

 throw new Error('No wallet found - Phantom/Solflare (Solana) or MetaMask (ETH). Soft-sign only.');
 }

 function validateFile(file) {
 if (!file) return 'Select a card photo first';
 var allowed = ['image/jpeg', 'image/png', 'image/webp'];
 if (allowed.indexOf(file.type) === -1) {
 return 'Only JPEG, PNG, or WebP - card photos only';
 }
 if (file.size > MAX_FILE_BYTES) {
 return 'File too large (max 8MB before resize)';
 }
 if (file.size < 2000) {
 return 'File too small - upload a real card photo';
 }
 return null;
 }

 function loadImageFromFile(file) {
 return new Promise(function (resolve, reject) {
 var url = URL.createObjectURL(file);
 var img = new Image();
 img.onload = function () {
 URL.revokeObjectURL(url);
 resolve(img);
 };
 img.onerror = function () {
 URL.revokeObjectURL(url);
 reject(new Error('Could not read image'));
 };
 img.src = url;
 });
 }

 function resizeToDataUrl(img) {
 var w = img.naturalWidth || img.width;
 var h = img.naturalHeight || img.height;
 if (!w || !h) throw new Error('Invalid image dimensions');

 if (w < 120 || h < 120) {
 throw new Error('Image too small - minimum 120×120px');
 }

 var ratio = w / h;
 if (ratio > 4 || ratio < 0.2) {
 throw new Error('Unusual aspect ratio - upload a card photo, not a banner');
 }

 var scale = Math.min(1, MAX_OUTPUT_DIM / Math.max(w, h));
 var tw = Math.round(w * scale);
 var th = Math.round(h * scale);

 var canvas = document.createElement('canvas');
 canvas.width = tw;
 canvas.height = th;
 var ctx = canvas.getContext('2d');
 ctx.fillStyle = '#111';
 ctx.fillRect(0, 0, tw, th);
 ctx.drawImage(img, 0, 0, tw, th);

 var dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
 if (dataUrl.length > 300000) {
 dataUrl = canvas.toDataURL('image/jpeg', 0.65);
 }
 if (dataUrl.length > 300000) {
 throw new Error('Image still too large after resize - try a smaller photo');
 }
 return dataUrl;
 }

 async function processFile(file) {
 var err = validateFile(file);
 if (err) throw new Error(err);
 var img = await loadImageFromFile(file);
 return resizeToDataUrl(img);
 }

 function showPreview(dataUrl) {
 state.previewUrl = dataUrl;
 var box = $('imagePreview');
 var img = $('previewImg');
 if (box && img) {
 img.src = dataUrl;
 box.style.display = 'block';
 }
 }

 function clearPreview() {
 state.previewUrl = null;
 var box = $('imagePreview');
 var input = $('cardImage');
 if (box) box.style.display = 'none';
 if (input) input.value = '';
 }

 function filteredPosts() {
 if (state.filter === 'all') return state.posts;
 return state.posts.filter(function (p) {
 return p.category === state.filter;
 });
 }

 function renderFeed() {
 var feed = $('atticFeed');
 var empty = $('feedEmpty');
 if (!feed) return;

 var posts = filteredPosts();
 if (!posts.length) {
 feed.innerHTML = '';
 if (empty) empty.style.display = 'block';
 return;
 }

 if (empty) empty.style.display = 'none';

 feed.innerHTML = posts.map(function (p) {
 var packLine = p.pack
 ? '<div class="pull-pack">' + escapeHtml(p.pack) + '</div>'
 : '';
 var captionLine = p.caption
 ? '<div class="pull-caption">' + escapeHtml(p.caption) + '</div>'
 : '';

 var shareUrl = '/attic/pull?id=' + encodeURIComponent(p.id);

 return (
 '<article class="pull-card" data-id="' + escapeHtml(p.id) + '">' +
 '<div class="pull-img-wrap">' +
 '<img src="' + escapeHtml(p.image) + '" alt="Card pull" loading="lazy" decoding="async">' +
 '</div>' +
 '<div class="pull-meta">' +
 '<span class="pull-cat cat-' + escapeHtml(p.category) + '">' + categoryLabel(p.category) + '</span>' +
 '<span class="pull-wallet">' + escapeHtml(p.wallet) + '</span>' +
 '<span class="pull-ts">' + escapeHtml(formatTs(p.ts)) + '</span>' +
 '</div>' +
 packLine +
 captionLine +
 '<a href="' + escapeHtml(shareUrl) + '" class="pull-share">SHARE PULL</a>' +
 '</article>'
 );
 }).join('');
 }

 async function loadPosts() {
 var feedStatus = $('feedStatus');
 if (feedStatus) feedStatus.textContent = 'Loading pulls...';

 try {
 var res = await fetch(API, { cache: 'no-store' });
 var data = await res.json();
 state.posts = Array.isArray(data.posts) ? data.posts : [];
 renderFeed();

 if (feedStatus) {
 var note = data.persisted ? 'LIVE FEED' : 'PREVIEW - enable Vercel KV for shared posts';
 feedStatus.textContent = state.posts.length + ' pull(s) * ' + note;
 }
 } catch (e) {
 if (feedStatus) feedStatus.textContent = 'Could not load feed';
 renderFeed();
 }
 }

 async function submitPost() {
 var fileInput = $('cardImage');
 var file = fileInput && fileInput.files && fileInput.files[0];
 var caption = ($('cardCaption') || {}).value || '';
 var pack = ($('cardPack') || {}).value || '';
 var categoryEl = document.querySelector('input[name="cardCategory"]:checked');
 var category = categoryEl ? categoryEl.value : 'sports';
 var btn = $('postBtn');

 if (!state.previewUrl && file) {
 try {
 setStatus('Processing image...');
 state.previewUrl = await processFile(file);
 showPreview(state.previewUrl);
 } catch (e) {
 setStatus(e.message || 'Image rejected', true);
 return;
 }
 }

 if (!state.previewUrl) {
 setStatus('Add a card photo first (JPEG/PNG/WebP only)', true);
 return;
 }

 if (btn) btn.disabled = true;
 setStatus('Soft-sign only - no funds, no transaction...');

 try {
 var signed = await softSign();
 state.wallet = signed.wallet;

 setStatus('Soft sign OK - uploading pull...');

 var res = await fetch(API, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 wallet: signed.wallet,
 signature: signed.signature,
 category: category,
 pack: pack.trim(),
 caption: caption.trim(),
 image: state.previewUrl
 })
 });

 var data = await res.json();
 if (!res.ok) {
 throw new Error(data.error || 'Post failed');
 }

 setStatus('Pull posted - refreshing feed...');
 clearPreview();
 if ($('cardCaption')) $('cardCaption').value = '';
 if ($('cardPack')) $('cardPack').value = '';
 await loadPosts();
 var short = signed.wallet.length > 10
 ? signed.wallet.slice(0, 4) + '...' + signed.wallet.slice(-4)
 : signed.wallet;
 setStatus('Posted - soft sign only, no funds moved (' + short + '). Nice hit.');
 } catch (e) {
 setStatus(e.message || 'Could not post', true);
 } finally {
 if (btn) btn.disabled = false;
 }
 }

 function bindEvents() {
 var fileInput = $('cardImage');
 if (fileInput) {
 fileInput.addEventListener('change', async function () {
 var file = fileInput.files && fileInput.files[0];
 if (!file) return;
 try {
 setStatus('Scanning image...');
 var dataUrl = await processFile(file);
 showPreview(dataUrl);
 setStatus('Image OK - ready to post');
 } catch (e) {
 clearPreview();
 setStatus(e.message || 'Image rejected', true);
 }
 });
 }

 var postBtn = $('postBtn');
 if (postBtn) postBtn.addEventListener('click', submitPost);

 var clearBtn = $('clearPreviewBtn');
 if (clearBtn) clearBtn.addEventListener('click', function () {
 clearPreview();
 setStatus('Preview cleared');
 });

 document.querySelectorAll('.filter-btn').forEach(function (btn) {
 btn.addEventListener('click', function () {
 state.filter = btn.getAttribute('data-filter') || 'all';
 document.querySelectorAll('.filter-btn').forEach(function (b) {
 b.classList.toggle('active', b === btn);
 });
 renderFeed();
 });
 });

 var refreshBtn = $('refreshFeedBtn');
 if (refreshBtn) refreshBtn.addEventListener('click', loadPosts);
 }

 function highlightFromQuery() {
 var params = new URLSearchParams(window.location.search);
 var id = params.get('highlight') || params.get('id');
 if (!id) return;
 id = id.replace(/["<>]/g, '');

 var tryHighlight = function () {
 var card = document.querySelector('.pull-card[data-id="' + id + '"]');
 if (!card) return false;
 card.classList.add('highlighted');
 card.scrollIntoView({ behavior: 'smooth', block: 'center' });
 return true;
 };

 if (!tryHighlight()) {
 setTimeout(tryHighlight, 600);
 }
 }

 function init() {
 bindEvents();
 loadPosts().then(highlightFromQuery);
 }

 return { init: init };
})();

document.addEventListener('DOMContentLoaded', function () {
 if (window.DOSWAPZ_ATTIC) DOSWAPZ_ATTIC.init();
});