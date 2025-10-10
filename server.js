// server.js
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const puppeteer = require('puppeteer');
const { URL } = require('url');

const app = express();
app.use(cors({ origin: 'https://faheemzmovies.netlify.app' }));
app.disable('x-powered-by');
const PORT = process.env.PORT || 3000;

async function launchBrowser() {
  return await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
}

app.get('/api/extract', async (req, res) => {
  const pageUrl = req.query.url;
  if (!pageUrl) return res.status(400).json({ error: 'Missing url query param' });

  let browser;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();

    await page.setRequestInterception(true);
    page.on('request', (reqq) => {
      const rt = reqq.resourceType();
      const url = reqq.url();
      if (rt === 'image' || rt === 'stylesheet' || rt === 'font' || url.includes('ads')) return reqq.abort();
      reqq.continue();
    });

    let found = null;
    page.on('response', async (response) => {
      try {
        const url = response.url();
        const ct = response.headers()['content-type'] || '';
        if (!found && (url.includes('.m3u8') || url.endsWith('.mp4') ||
          ct.includes('application/vnd.apple.mpegurl') || ct.includes('video/mp4'))) {
          found = url;
        }
      } catch {}
    });

    await page.goto(pageUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await page.waitForTimeout(2500);

    if (!found) {
      const candidates = await page.evaluate(() => {
        const urls = Array.from(document.querySelectorAll('[src]')).map(el => el.src).filter(Boolean);
        return urls.filter(u => u.includes('.m3u8') || u.endsWith('.mp4'));
      });
      if (candidates && candidates.length) found = candidates[0];
    }

    await browser.close();
    if (!found) return res.status(404).json({ error: 'No stream URL found' });
    return res.json({ stream: found });
  } catch (error) {
    if (browser) await browser.close();
    console.error(error);
    return res.status(500).json({ error: 'Extraction failed', details: error.message });
  }
});

app.get('/api/video-proxy', async (req, res) => {
  const target = req.query.url;
  if (!target) return res.status(400).send('Missing url');
  const referer = req.query.referer || '';
  const headers = {
    'User-Agent': req.get('User-Agent') || 'Mozilla/5.0',
    'Referer': referer,
    'Accept': '*/*'
  };
  if (req.headers.range) headers.Range = req.headers.range;

  try {
    if (target.toLowerCase().includes('.m3u8')) {
      const pResp = await axios.get(target, { headers, responseType: 'text' });
      let playlist = pResp.data;
      const lines = playlist.split('\n').map(line => {
        line = line.trim();
        if (!line || line.startsWith('#')) return line;
        const abs = new URL(line, target).toString();
        return `/api/video-proxy?url=${encodeURIComponent(abs)}&referer=${encodeURIComponent(referer || target)}`;
      });
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Access-Control-Allow-Origin', 'https://faheemzmovies.netlify.app');
      return res.send(lines.join('\n'));
    }
    const resp = await axios({ method: 'get', url: target, responseType: 'stream', headers });
    res.setHeader('Access-Control-Allow-Origin', 'https://faheemzmovies.netlify.app');
    resp.data.pipe(res);
  } catch (err) {
    console.error(err.message);
    res.status(502).send('Proxy error');
  }
});

app.get('/', (req, res) => res.send('Faheemz backend is running'));
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));