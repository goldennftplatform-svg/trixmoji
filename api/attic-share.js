/**
 * DOSWAPZ - Attic pull share page with OG meta (card photo preview).
 */

const { getPostById } = require('./lib/attic-store');

function escapeHtml(str) {
 return String(str)
 .replace(/&/g, '&amp;')
 .replace(/</g, '&lt;')
 .replace(/>/g, '&gt;')
 .replace(/"/g, '&quot;');
}

function categoryLabel(cat) {
 if (cat === 'sports') return 'Sports Card Pull';
 if (cat === 'pokemon') return 'Pokémon Pull';
 return 'TCG Pull';
}

const { rateLimitOrReject } = require('./lib/rate-limit');

module.exports = async function handler(req, res) {
 if (rateLimitOrReject(req, res, { prefix: 'attic-share', perMinute: 40, perDay: 1000 })) return;
 const id = (req.query && req.query.id) || '';
 const post = await getPostById(id);
 const origin = 'https://doswapz.com';
 const atticUrl = origin + '/classic/pages/attic.html' + (id ? '?highlight=' + encodeURIComponent(id) : '');

 if (!post) {
 res.setHeader('Content-Type', 'text/html; charset=utf-8');
 return res.status(404).send(
 '<!DOCTYPE html><html><head><meta charset="UTF-8">' +
 '<title>Pull not found - The Attic</title></head><body style="background:#000;color:#0f0;font-family:monospace;text-align:center;padding:40px;">' +
 '<p>PULL NOT FOUND</p><p><a href="' + atticUrl + '" style="color:#ff0;">Back to The Attic</a></p></body></html>'
 );
 }

 const imageUrl = origin + '/api/attic-image?id=' + encodeURIComponent(id);
 const title = 'DOSWAPZ // THE ATTIC - ' + categoryLabel(post.category);
 const desc = [post.pack, post.caption].filter(Boolean).join(' - ') || 'Card pull from The Attic';
 const shareUrl = origin + '/attic/pull?id=' + encodeURIComponent(id);

 const html = `<!DOCTYPE html>
<html lang="en">
<head>
 <meta charset="UTF-8">
 <meta name="viewport" content="width=device-width, initial-scale=1.0">
 <title>${escapeHtml(title)}</title>
 <meta name="description" content="${escapeHtml(desc)}">
 <meta property="og:type" content="website">
 <meta property="og:title" content="${escapeHtml(title)}">
 <meta property="og:description" content="${escapeHtml(desc)}">
 <meta property="og:image" content="${escapeHtml(imageUrl)}">
 <meta property="og:url" content="${escapeHtml(shareUrl)}">
 <meta name="twitter:card" content="summary_large_image">
 <meta name="twitter:title" content="${escapeHtml(title)}">
 <meta name="twitter:description" content="${escapeHtml(desc)}">
 <meta name="twitter:image" content="${escapeHtml(imageUrl)}">
 <meta http-equiv="refresh" content="0;url=${escapeHtml(atticUrl)}">
 <style>
 body { margin:0; background:#000; color:#0f0; font-family:monospace; text-align:center; padding:40px; }
 a { color:#ff0; }
 </style>
</head>
<body>
 <p>Redirecting to The Attic...</p>
 <p><a href="${escapeHtml(atticUrl)}">Open pull in The Attic</a></p>
 <script>location.replace(${JSON.stringify(atticUrl)});</script>
</body>
</html>`;

 res.setHeader('Content-Type', 'text/html; charset=utf-8');
 res.setHeader('Cache-Control', 'public, max-age=300');
 return res.status(200).send(html);
};