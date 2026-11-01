/**
 * DOSWAPZ - serve Attic pull images for OG previews (by post id).
 */

const { getPostById } = require('./lib/attic-store');

function parseDataUrl(dataUrl) {
 const match = String(dataUrl).match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
 if (!match) return null;
 return { mime: match[1], buf: Buffer.from(match[2], 'base64') };
}

const { rateLimitOrReject } = require('./lib/rate-limit');

module.exports = async function handler(req, res) {
 if (rateLimitOrReject(req, res, { prefix: 'attic-image', perMinute: 60, perDay: 2000 })) return;
 const id = (req.query && req.query.id) || '';
 const post = await getPostById(id);

 if (!post || !post.image) {
 return res.status(404).json({ error: 'Pull not found' });
 }

 const parsed = parseDataUrl(post.image);
 if (!parsed || !parsed.buf.length) {
 return res.status(404).json({ error: 'Image unavailable' });
 }

 res.setHeader('Content-Type', parsed.mime);
 res.setHeader('Cache-Control', 'public, max-age=3600');
 res.setHeader('Access-Control-Allow-Origin', '*');
 return res.status(200).send(parsed.buf);
};