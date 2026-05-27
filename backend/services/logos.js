'use strict';
const config = require('../config');

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function monogramSvg(name) {
  const letter  = (name || '?').trim()[0].toUpperCase();
  const palette = ['#2b4c7e', '#567ebb', '#606c38', '#283618', '#bc4749', '#4a4e69', '#9c6644'];
  const bg      = palette[letter.charCodeAt(0) % palette.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">` +
              `<rect width="64" height="64" fill="${bg}"/>` +
              `<text x="32" y="44" font-size="32" font-family="sans-serif" fill="#fff" text-anchor="middle">${letter}</text>` +
              `</svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}

async function fetchBrandfetchLogo(domain) {
  const apiKey = config.BRANDFETCH_API_KEY;
  if (!apiKey || !domain) return null;
  const url = `https://cdn.brandfetch.io/${domain}?c=${apiKey}`;
  try {
    const res = await fetch(url, {
      headers: { Referer: config.BASE_URL },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.startsWith('image/') && !ct.includes('svg')) return null;
    return url;
  } catch {
    return null;
  }
}

// domain: LLM-guessed domain (e.g. "mit.edu", "google.com")
// Returns { logoUrl } where logoUrl is a Brandfetch URL or null (no monogram fallback —
// the card template supplies its own fallback images for edu/work when logoUrl is null).
async function getOrgLogo(name, domain) {
  if (!name && !domain) return { logoUrl: null };
  const useDomain = domain || `${slugify(name || '')}.com`;
  const logoUrl   = (await fetchBrandfetchLogo(useDomain)) ?? null;
  return { logoUrl };
}

module.exports = { getOrgLogo };
