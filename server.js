import express from 'express';
import puppeteer from 'puppeteer';
import cors from 'cors';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// TMDB API Configuration
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';

// Global browser instance
let browser;

// Launch browser when the server starts
(async () => {
    browser = await puppeteer.launch({
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu'
        ]
    });
    console.log('Puppeteer browser launched');
})();

// Close browser when the server is shutting down
process.on('SIGINT', async () => {
    if (browser) {
        await browser.close();
        console.log('Puppeteer browser closed');
    }
    process.exit();
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (mobile apps, etc.)
        if (!origin) return callback(null, true);

        // Allow specific frontend domains
        const allowedOrigins = [
            'https://faheemzmovies.netlify.app',
            'http://localhost:5173',
            'http://localhost:3000',
            'https://faheemzmovies-backend.onrender.com'
        ];

        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        } else {
            console.warn('CORS blocked request from origin:', origin);
            return callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Range', 'Accept', 'Accept-Encoding', 'Referer', 'User-Agent']
}));
app.use(express.json());

// Set basic security headers and ensure CORS
app.use((req, res, next) => {
    // Ensure CORS headers are always set
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || 'https://faheemzmovies.netlify.app');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Range, Accept, Accept-Encoding, Referer, User-Agent');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    next();
});

// TMDB API helper function
function tmdbRequest(endpoint, params = {}) {
    if (!TMDB_API_KEY) {
        throw new Error('TMDB API key not configured');
    }

    const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
    url.searchParams.append('api_key', TMDB_API_KEY);
    url.searchParams.append('language', 'en-US');

    // Add additional params
    Object.keys(params).forEach(key => {
        url.searchParams.append(key, params[key]);
    });

    return axios.get(url.toString())
        .then(response => response.data)
        .catch(error => {
            console.error(`TMDB API Error for ${endpoint}:`, error.response?.data || error.message);
            throw error;
        });
}

// TMDB API Endpoints

// Search movies
app.get('/api/movies/search', async (req, res) => {
    try {
        if (!TMDB_API_KEY) {
            return res.status(500).json({
                error: 'TMDB API key not configured',
                message: 'Please set TMDB_API_KEY environment variable'
            });
        }

        const { query, page = 1 } = req.query;
        if (!query) {
            return res.status(400).json({ error: 'Query parameter is required' });
        }

        console.log('🔍 Searching movies for:', query);
        const data = await tmdbRequest('/search/movie', { query, page });
        res.json(data.results);
    } catch (error) {
        console.error('Error searching movies:', error);
        res.status(500).json({
            error: 'Failed to search movies',
            details: error.response?.data?.status_message || error.message
        });
    }
});

// Get movie details
app.get('/api/movies/:id', async (req, res) => {
    try {
        if (!TMDB_API_KEY) {
            return res.status(500).json({
                error: 'TMDB API key not configured',
                message: 'Please set TMDB_API_KEY environment variable'
            });
        }

        const { id } = req.params;
        console.log('🎬 Fetching movie details for ID:', id);
        const data = await tmdbRequest(`/movie/${id}`);
        res.json(data);
    } catch (error) {
        console.error('Error fetching movie details:', error);
        res.status(500).json({
            error: 'Failed to fetch movie details',
            details: error.response?.data?.status_message || error.message
        });
    }
});

// Get movie recommendations
app.get('/api/movies/:id/recommendations', async (req, res) => {
    try {
        if (!TMDB_API_KEY) {
            return res.status(500).json({
                error: 'TMDB API key not configured',
                message: 'Please set TMDB_API_KEY environment variable'
            });
        }

        const { id } = req.params;
        console.log('🎯 Fetching movie recommendations for ID:', id);
        const data = await tmdbRequest(`/movie/${id}/recommendations`);
        res.json(data.results);
    } catch (error) {
        console.error('Error fetching movie recommendations:', error);
        res.status(500).json({
            error: 'Failed to fetch movie recommendations',
            details: error.response?.data?.status_message || error.message
        });
    }
});

// Search TV shows
app.get('/api/tv/search', async (req, res) => {
    try {
        if (!TMDB_API_KEY) {
            return res.status(500).json({
                error: 'TMDB API key not configured',
                message: 'Please set TMDB_API_KEY environment variable'
            });
        }

        const { query, page = 1 } = req.query;
        if (!query) {
            return res.status(400).json({ error: 'Query parameter is required' });
        }

        console.log('🔍 Searching TV shows for:', query);
        const data = await tmdbRequest('/search/tv', { query, page });
        res.json(data.results);
    } catch (error) {
        console.error('Error searching TV shows:', error);
        res.status(500).json({
            error: 'Failed to search TV shows',
            details: error.response?.data?.status_message || error.message
        });
    }
});

// Get TV show details
app.get('/api/tv/:id', async (req, res) => {
    try {
        if (!TMDB_API_KEY) {
            return res.status(500).json({
                error: 'TMDB API key not configured',
                message: 'Please set TMDB_API_KEY environment variable'
            });
        }

        const { id } = req.params;
        console.log('📺 Fetching TV show details for ID:', id);
        const data = await tmdbRequest(`/tv/${id}`);
        res.json(data);
    } catch (error) {
        console.error('Error fetching TV show details:', error);
        res.status(500).json({
            error: 'Failed to fetch TV show details',
            details: error.response?.data?.status_message || error.message
        });
    }
});

// Get TV show recommendations
app.get('/api/tv/:id/recommendations', async (req, res) => {
    try {
        if (!TMDB_API_KEY) {
            return res.status(500).json({
                error: 'TMDB API key not configured',
                message: 'Please set TMDB_API_KEY environment variable'
            });
        }

        const { id } = req.params;
        console.log('🎯 Fetching TV show recommendations for ID:', id);
        const data = await tmdbRequest(`/tv/${id}/recommendations`);
        res.json(data.results);
    } catch (error) {
        console.error('Error fetching TV show recommendations:', error);
        res.status(500).json({
            error: 'Failed to fetch TV show recommendations',
            details: error.response?.data?.status_message || error.message
        });
    }
});

// Get season details with episodes
app.get('/api/tv/:id/season/:season', async (req, res) => {
    try {
        if (!TMDB_API_KEY) {
            return res.status(500).json({
                error: 'TMDB API key not configured',
                message: 'Please set TMDB_API_KEY environment variable'
            });
        }

        const { id, season } = req.params;
        console.log(`📺 Fetching season ${season} details for TV show ID:`, id);
        const data = await tmdbRequest(`/tv/${id}/season/${season}`);
        res.json(data);
    } catch (error) {
        console.error('Error fetching season details:', error);
        res.status(500).json({
            error: 'Failed to fetch season details',
            details: error.response?.data?.status_message || error.message
        });
    }
});

// Discover content by genre
app.get('/api/discover/:type', async (req, res) => {
    try {
        if (!TMDB_API_KEY) {
            return res.status(500).json({
                error: 'TMDB API key not configured',
                message: 'Please set TMDB_API_KEY environment variable'
            });
        }

        const { type } = req.params;
        const { genre, page = 1 } = req.query;

        if (!['movie', 'tv'].includes(type)) {
            return res.status(400).json({ error: 'Type must be either movie or tv' });
        }

        console.log(`🎭 Discovering ${type}s by genre:`, genre || 'all');
        const params = { page };
        if (genre) {
            params.with_genres = genre;
        }

        const data = await tmdbRequest(`/discover/${type}`, params);
        res.json(data.results);
    } catch (error) {
        console.error('Error discovering content:', error);
        res.status(500).json({
            error: 'Failed to discover content',
            details: error.response?.data?.status_message || error.message
        });
    }
});

// Extract stream URL from video provider with fallback sources
app.get('/api/extract-stream', async (req, res) => {
    let page;
    try {
        const { url: targetUrl } = req.query;

        if (!targetUrl) {
            return res.status(400).json({ error: 'URL parameter is required' });
        }

        console.log('\n=== Extracting Clean Stream URL (No Ads) ===');
        console.log('Original URL:', targetUrl);

        // Determine content type and extract ID
        const isMovie = targetUrl.includes('/movie/');
        const isTV = targetUrl.includes('/tv/');

        if (!isMovie && !isTV) {
            return res.status(400).json({ error: 'Invalid URL format. Must be movie or TV show URL.' });
        }

        // Define sources in order of preference
        const SOURCES = [
            {
                name: 'vidlink.pro',
                movieUrl: (id) => `https://vidlink.pro/movie/${id}?nextbutton=true`,
                tvUrl: (id, season, episode) => `https://vidlink.pro/tv/${id}/${season}/${episode}?nextbutton=true`,
                priority: 1
            },
            {
                name: 'moviesapi.to',
                movieUrl: (id) => `https://moviesapi.to/movie/${id}`,
                tvUrl: (id, season, episode) => `https://moviesapi.to/tv/${id}-${season}-${episode}`,
                priority: 2
            }
        ];

        let streamUrl = null;

        // Try each source until we find a working one
        for (const source of SOURCES) {
            try {
                console.log(`\n🔄 Trying source: ${source.name} (priority ${source.priority})`);

                let sourceUrl;
                if (isMovie) {
                    const movieId = targetUrl.split('/movie/')[1]?.split('?')[0];
                    if (!movieId) continue;
                    sourceUrl = source.movieUrl(movieId);
                } else if (isTV) {
                    const tvMatch = targetUrl.match(/\/tv\/(\d+)\/(\d+)\/(\d+)/);
                    if (!tvMatch) continue;
                    const [, tvId, season, episode] = tvMatch;
                    sourceUrl = source.tvUrl(tvId, season, episode);
                }

                console.log('Source URL:', sourceUrl);

                // Create a new page for each source attempt
                page = await browser.newPage();

                // Set user agent and viewport
                await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                await page.setViewport({ width: 1920, height: 1080 });

                // Track network requests
                const capturedUrls = { m3u8: [], mp4: [], iframe: [], other: [] };

                await page.setRequestInterception(true);
                page.on('request', (request) => {
                    const requestUrl = request.url();
                    const resourceType = request.resourceType();

                    if (requestUrl.includes('.m3u8')) {
                        capturedUrls.m3u8.push(requestUrl);
                        console.log('📹 Found M3U8:', requestUrl);
                    } else if (requestUrl.includes('.mp4') || requestUrl.includes('.webm') || requestUrl.includes('.mkv')) {
                        capturedUrls.mp4.push(requestUrl);
                        console.log('📹 Found Video:', requestUrl);
                    }

                    if (['image', 'stylesheet', 'font'].includes(resourceType) ||
                        requestUrl.includes('ads') ||
                        requestUrl.includes('analytics') ||
                        requestUrl.includes('tracking')) {
                        request.abort();
                    } else {
                        request.continue();
                    }
                });

                console.log('🌐 Navigating to source URL...');
                await page.goto(sourceUrl, {
                    waitUntil: 'networkidle2',
                    timeout: 60000
                });

                await new Promise(resolve => setTimeout(resolve, 5000));

                // Try to find video elements
                try {
                    await page.waitForSelector('video, iframe[src*="embed"], iframe[src*="player"]', { timeout: 10000 });
                    console.log('✅ Video player detected');
                } catch (e) {
                    console.log('⚠️ No video player found immediately, continuing...');
                }

                // Prefer M3U8 over direct MP4 for this source
                if (capturedUrls.m3u8.length > 0) {
                    let bestM3u8Url = capturedUrls.m3u8[0];
                    for (const m3u8Url of capturedUrls.m3u8) {
                        if (m3u8Url.includes('MTA4MA==') || m3u8Url.includes('NzIw')) {
                            bestM3u8Url = m3u8Url;
                            break;
                        }
                    }
                    streamUrl = bestM3u8Url;
                    console.log(`✅ Found working stream from ${source.name}:`, streamUrl);
                    break; // Success! Exit the source loop
                } else if (capturedUrls.mp4.length > 0) {
                    streamUrl = capturedUrls.mp4[0];
                    console.log(`✅ Found working stream from ${source.name}:`, streamUrl);
                    break; // Success! Exit the source loop
                }

                console.log(`❌ No stream found from ${source.name}, trying next source...`);
                await page.close();

            } catch (sourceError) {
                console.log(`❌ Error with ${source.name}:`, sourceError.message);
                if (page) await page.close();
                continue; // Try next source
            }
        }

        if (!streamUrl) {
            console.error('\n❌ Error: Could not extract stream URL from any source');
            return res.status(404).json({
                error: 'Could not extract stream URL',
                debug: {
                    message: 'No matching URL pattern found from any source',
                    triedSources: SOURCES.map(s => s.name),
                    suggestion: 'All sources failed or video might be protected'
                }
            });
        }

        // Make sure the URL is absolute
        if (streamUrl.startsWith('//')) {
            streamUrl = 'https:' + streamUrl;
        } else if (streamUrl.startsWith('/')) {
            const urlObj = new URL(targetUrl);
            streamUrl = urlObj.origin + streamUrl;
        }

        console.log('\n✅ === CLEAN STREAM URL EXTRACTED (NO ADS) ===');
        console.log('🎬 Stream URL:', streamUrl);
        console.log('📋 Summary:');
        console.log('- Original URL:', targetUrl);
        console.log('- Content Type:', isTV ? 'TV Show' : 'Movie');
        console.log('- Clean Stream URL:', streamUrl);
        console.log('- Type:', streamUrl.includes('.m3u8') ? 'HLS (M3U8)' : 'Direct Video');

        res.json({
            success: true,
            streamUrl: streamUrl,
            type: streamUrl.includes('.m3u8') ? 'hls' : 'direct',
            contentType: isTV ? 'tv' : 'movie',
            source: 'multiple_sources',
            info: {
                originalUrl: targetUrl,
                cleanStreamUrl: streamUrl,
                isAdFree: true,
                contentType: isTV ? 'tv' : 'movie'
            }
        });

    } catch (error) {
        console.error('Error extracting stream URL:', error);
        res.status(500).json({
            error: 'Failed to extract stream URL',
            details: error.message
        });
    } finally {
        if (page) {
            await page.close().catch(e => console.error('Error closing page:', e));
        }
    }
});

// Updated /api/video-proxy route with HLS playlist rewrite and Range handling
app.get('/api/video-proxy', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).send('Missing url parameter');

    const forwardHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': req.query.referer || 'https://vidlink.pro/',
      'Accept': '*/*',
      'Accept-Encoding': 'identity;q=1, *;q=0',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Pragma': 'no-cache',
      'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'cross-site',
      'Origin': 'https://vidlink.pro'
    };
    if (req.headers.range) forwardHeaders.Range = req.headers.range;

    // If the request is for a playlist (.m3u8)
    if (url.toLowerCase().endsWith('.m3u8')) {
      const playlistResp = await axios.get(url, {
        headers: forwardHeaders,
        timeout: 30000, // Increased timeout
        responseType: 'text',
        validateStatus: s => s >= 200 && s < 400
      });

      let playlist = playlistResp.data;
      playlist = playlist.split('\n').map(line => {
        line = line.trim();
        if (!line || line.startsWith('#')) return line;
        try {
          const base = new URL(url);
          const segUrl = new URL(line, base).toString();
          return `/api/video-proxy?url=${encodeURIComponent(segUrl)}&referer=${encodeURIComponent(req.query.referer || url)}`;
        } catch (e) {
          return line;
        }
      }).join('\n');

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).send(playlist);
    }

    // Otherwise stream binary (segment/mp4)
    const response = await axios({
      method: 'get',
      url,
      responseType: 'stream',
      headers: forwardHeaders,
      timeout: 60000, // Increased timeout for video segments
      maxRedirects: 10,
      validateStatus: s => s >= 200 && s < 400
    });

    if (response.headers['content-type']) res.setHeader('Content-Type', response.headers['content-type']);
    if (response.headers['content-length']) res.setHeader('Content-Length', response.headers['content-length']);
    if (response.headers['accept-ranges']) res.setHeader('Accept-Ranges', response.headers['accept-ranges']);
    if (response.headers['content-range']) res.setHeader('Content-Range', response.headers['content-range']);
    res.setHeader('Access-Control-Allow-Origin', '*');

    res.status(response.status);
    response.data.pipe(res);

  } catch (error) {
    console.error('Proxy error:', error.message);
    console.error('Error details:', error.response?.status, error.response?.statusText);
    res.status(500).send('Error proxying video: ' + error.message);
  }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Proxy server running on http://localhost:${PORT}`);
});
