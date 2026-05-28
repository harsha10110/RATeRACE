'use strict';
const crypto    = require('crypto');
const puppeteer = require('puppeteer');
const fs        = require('fs');
const path      = require('path');
const config    = require('../config');
const logger    = require('../utils/logger');

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');
const RENDER_DIR    = path.join(TEMPLATES_DIR, '_render');
const TEMPLATE_HTML = path.join(TEMPLATES_DIR, 'rate-card.html');

let browser = null;

// ---------------------------------------------------------------------------
// Concurrency semaphore — max 3 simultaneous Puppeteer pages
// ---------------------------------------------------------------------------
const MAX_CONCURRENT   = 3;
const QUEUE_TIMEOUT_MS = 30_000; // 30 s max wait in queue

let activeRenders = 0;
const waitQueue   = []; // array of { resolve, reject, timer }

/**
 * Acquire a semaphore slot.  Returns a Promise that resolves when a slot is
 * available.  Rejects after QUEUE_TIMEOUT_MS if still waiting.
 */
function acquireSlot() {
  return new Promise((resolve, reject) => {
    if (activeRenders < MAX_CONCURRENT) {
      activeRenders++;
      return resolve();
    }

    const timer = setTimeout(() => {
      const idx = waitQueue.findIndex(e => e.resolve === resolve);
      if (idx !== -1) waitQueue.splice(idx, 1);
      reject({ message: 'Card generation queue is full. Please try again in a moment.', status: 503 });
    }, QUEUE_TIMEOUT_MS);

    logger.info({ queueLength: waitQueue.length + 1 }, 'Render queued');
    waitQueue.push({ resolve, reject, timer });
  });
}

/**
 * Release a semaphore slot.  Wakes the next waiter (if any).
 */
function releaseSlot() {
  if (waitQueue.length > 0) {
    const { resolve, timer } = waitQueue.shift();
    clearTimeout(timer);
    // slot stays at MAX_CONCURRENT — we hand it directly to the next waiter
    logger.info('Render slot acquired');
    resolve();
  } else {
    activeRenders--;
  }
}

async function getBrowser() {
  if (browser) {
    if (browser.isConnected()) return browser;
    // Browser process died (OOM, signal, etc.) — discard stale handle
    logger.warn('Puppeteer browser disconnected — relaunching');
    browser = null;
  }
  browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  logger.info('Puppeteer browser launched');
  return browser;
}

/**
 * Renders rate-card.html with injected CARD_DATA and returns a PNG buffer.
 * Inject before </head> — simpler than splitting on <script> and guaranteed
 * to execute before any inline script in the body.
 *
 * @param {object} cardData
 * @returns {Promise<Buffer>}
 */
async function renderCard(cardData) {
  const t0   = Date.now();
  const uuid = crypto.randomUUID(); // Node 20 built-in — no uuid package needed
  const tmpPath = path.join(RENDER_DIR, `${uuid}.html`);

  // Inject window.CARD_DATA before </head> so the inline script reads it on load.
  // Writing the temp file happens outside the semaphore — only the browser page
  // lifecycle (RAM-intensive) needs to be serialized.
  const html      = fs.readFileSync(TEMPLATE_HTML, 'utf8');
  const injection = `<script>window.CARD_DATA = ${JSON.stringify(cardData)};</script>`;
  const injected  = html.replace('</head>', `${injection}\n</head>`);

  fs.writeFileSync(tmpPath, injected, 'utf8');

  // Wait for a semaphore slot (max MAX_CONCURRENT simultaneous pages).
  await acquireSlot();

  let b;
  let page;
  try {
    try {
      b    = await getBrowser();
      page = await b.newPage();
    } catch (launchErr) {
      // Browser failed to launch or open a new page — clear the cached handle so the
      // next request triggers a fresh launch rather than reusing the broken browser.
      browser = null;
      throw launchErr;
    }

    try {
      await page.setViewport({ width: 1053, height: 1470, deviceScaleFactor: 2 });

      await page.goto(
        `${config.BASE_URL}/_internal/template/_render/${uuid}.html`,
        { waitUntil: 'networkidle0', timeout: 30000 }
      );

      await page.evaluateHandle('document.fonts.ready');

      // Wait for all <img> elements to finish loading (logos, chess, hourglass)
      await page.evaluate(() => Promise.all(
        Array.from(document.images).map(img =>
          img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })
        )
      ));

      const artboard = await page.$('#artboard');
      if (!artboard) throw new Error('#artboard element not found in rate-card.html');

      const buffer = await artboard.screenshot({ type: 'png', omitBackground: false });

      logger.info({ latencyMs: Date.now() - t0 }, 'Card rendered');
      return buffer;
    } finally {
      await page.close(); // close immediately — Railway free tier is 512 MB
      fs.unlink(tmpPath, () => {});
    }
  } finally {
    releaseSlot();
  }
}

async function initPuppeteer() {
  await getBrowser();
}

module.exports = { renderCard, initPuppeteer };
