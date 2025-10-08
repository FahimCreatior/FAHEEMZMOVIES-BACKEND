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
app.use(cors());
app.use(express.json());

// Set basic security headers
app.use((req, res, next) => {
    // Set Content Security Policy
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

// Extract stream URL from video provider
app.get('/api/extract-stream', async (req, res) => {
    let page;
    try {
        const { url } = req.query;
        
        if (!url) {
            return res.status(400).json({ error: 'URL parameter is required' });
        }
        
        console.log('\n=== Extracting Clean Stream URL (No Ads) ===');
        console.log('Original URL:', url);
        console.log('Content Type:', url.includes('/tv/') ? 'TV Show' : 'Movie');

        // Create a new page
        page = await browser.newPage();
        
        // Set user agent and viewport
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1920, height: 1080 });
        
        // Track all network requests to find the actual video stream
        const capturedUrls = {
            m3u8: [],
            mp4: [],
            iframe: [],
            other: []
        };
        
        // Enable request interception to capture video URLs
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            const url = request.url();
            const resourceType = request.resourceType();
            
            // Capture video-related URLs
            if (url.includes('.m3u8')) {
                capturedUrls.m3u8.push(url);
                console.log('📹 Found M3U8:', url);
            } else if (url.includes('.mp4') || url.includes('.webm') || url.includes('.mkv')) {
                capturedUrls.mp4.push(url);
                console.log('📹 Found Video:', url);
            }
            
            // Block ads and unnecessary resources
            if (['image', 'stylesheet', 'font'].includes(resourceType) || 
                url.includes('ads') || 
                url.includes('analytics') || 
                url.includes('tracking')) {
                request.abort();
            } else {
                request.continue();
            }
        });

        console.log('🌐 Navigating to URL...');
        await page.goto(url, { 
            waitUntil: 'networkidle2',
            timeout: 60000 // 60 seconds timeout for slow loading
        });

        console.log('⏳ Waiting for video player to load...');
        
        // Wait a bit for dynamic content to load
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Try to find video elements
        try {
            await page.waitForSelector('video, iframe[src*="embed"], iframe[src*="player"]', { timeout: 10000 });
            console.log('✅ Video player detected');
        } catch (e) {
            console.log('⚠️ No video player found immediately, continuing...');
        }

        // Get the page content
        const html = await page.content();
        
        // Try multiple approaches to find the stream URL
        let streamUrl = null;
        const patterns = [
            // Try to find the iframe first
            { 
                name: 'iframe',
                pattern: /<iframe[^>]*src=["']([^"']+)["']/i,
                process: (match) => match[1]
            },
            // Look for video sources in scripts
            {
                name: 'script sources',
                pattern: /sources\s*:\s*\[\s*{[^}]*src\s*:\s*['"]([^'"]+)['"]/,
                process: (match) => match[1]
            },
            // Look for HLS or DASH manifests
            {
                name: 'HLS/DASH manifest',
                pattern: /(https?:\/\/[^"'\s]+\.(?:m3u8|mpd)[^"'\s]*)/i,
                process: (match) => match[1]
            },
            // Look for direct video files
            {
                name: 'direct video',
                pattern: /(https?:\/\/[^"'\s]+\.(?:mp4|webm|mkv|avi|mov)[^"'\s]*)/i,
                process: (match) => match[1]
            },
            // Look for JSON data with video info
            {
                name: 'JSON data',
                pattern: /(?:sources|file)\s*[:=]\s*(\[.*?\])/s,
                process: (match) => {
                    try {
                        const sources = JSON.parse(match[1].replace(/'/g, '"'));
                        return Array.isArray(sources) ? sources[0].file || sources[0].src || sources[0] : sources.file || sources.src;
                    } catch (e) {
                        return null;
                    }
                }
            }
        ];

        console.log('\n📊 Captured URLs Summary:');
        console.log('M3U8 URLs:', capturedUrls.m3u8.length);
        console.log('MP4 URLs:', capturedUrls.mp4.length);
        
        // Prefer M3U8 (HLS) over direct MP4
        if (capturedUrls.m3u8.length > 0) {
            // Choose the M3U8 URL that looks most like a playlist (with base64 encoding)
            let bestM3u8Url = capturedUrls.m3u8[0];
            for (const m3u8Url of capturedUrls.m3u8) {
                if (m3u8Url.includes('MTA4MA==') || m3u8Url.includes('NzIw')) {
                    bestM3u8Url = m3u8Url;
                    break;
                }
            }
            streamUrl = bestM3u8Url;
            console.log('✅ Using best M3U8 URL:', streamUrl);
        } else if (capturedUrls.mp4.length > 0) {
            streamUrl = capturedUrls.mp4[0];
            console.log('✅ Using captured MP4 URL:', streamUrl);
        }
        
        // If we didn't capture anything from network, try page evaluation
        if (!streamUrl) {
            console.log('🔍 Extracting video sources using page evaluation...');
            const videoSources = await page.evaluate(() => {
                const sources = [];
                
                // Check for video elements
                document.querySelectorAll('video source, video').forEach(video => {
                    const src = video.src || video.getAttribute('data-src');
                    if (src) sources.push({ type: 'video', src });
                });
                
                // Check for iframes
                document.querySelectorAll('iframe').forEach(iframe => {
                    const src = iframe.src || iframe.getAttribute('data-src');
                    if (src) sources.push({ type: 'iframe', src });
                });
                
                // Check for JSON data in scripts
                document.querySelectorAll('script').forEach(script => {
                    const content = script.textContent;
                    
                    // Look for various video URL patterns
                    const patterns = [
                        /sources\s*:\s*(\[.*?\])/s,
                        /file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/,
                        /src\s*:\s*["']([^"']+\.m3u8[^"']*)["']/,
                        /https?:\/\/[^\s"']+\.m3u8[^\s"']*/g
                    ];
                    
                    patterns.forEach(pattern => {
                        const matches = content.match(pattern);
                        if (matches) {
                            if (pattern.toString().includes('sources')) {
                                try {
                                    const data = JSON.parse(matches[1]);
                                    data.forEach(item => {
                                        if (item.src || item.file) {
                                            sources.push({ type: 'json', src: item.src || item.file });
                                        }
                                    });
                                } catch (e) {
                                    // Ignore JSON parse errors
                                }
                            } else {
                                sources.push({ type: 'script', src: matches[1] || matches[0] });
                            }
                        }
                    });
                });
                
                return sources;
            });

            console.log('Found potential video sources:', videoSources.length);
            
            // Try to find the best source
            for (const source of videoSources) {
                const { type, src } = source;
                console.log(`Found ${type} source:`, src);
                
                // Skip empty or invalid URLs
                if (!src || typeof src !== 'string') continue;
                
                // Skip ad-related URLs
                if (src.includes('ads') || src.includes('doubleclick') || src.includes('analytics')) {
                    console.log('⚠️ Skipping ad-related URL');
                    continue;
                }
                
                // Make relative URLs absolute
                if (src.startsWith('//')) {
                    streamUrl = 'https:' + src;
                    console.log(`✅ Using ${type} source (converted to absolute URL):`, streamUrl);
                    break;
                } else if (src.startsWith('/')) {
                    const urlObj = new URL(url);
                    streamUrl = urlObj.origin + src;
                    console.log(`✅ Using ${type} source (converted to absolute URL):`, streamUrl);
                    break;
                } else if (src.startsWith('http')) {
                    streamUrl = src;
                    console.log(`✅ Using ${type} source:`, streamUrl);
                    break;
                }
            }
        }

        // If still no match, try to find any URL that looks like a video source in the page content
        if (!streamUrl) {
            console.log('No video sources found, trying fallback pattern matching...');
            const urlMatch = html.match(/(https?:\/\/[^"'\s]+\/(?:videos?|streams?|embed|player)\/[^"'\s]+)/i);
            if (urlMatch) {
                streamUrl = urlMatch[1];
                console.log('Found URL using fallback pattern:', streamUrl);
            }
        }
        
        if (!streamUrl) {
            console.error('\n❌ Error: Could not extract stream URL from page');
            console.log('Tried multiple methods but no match found');
            
            return res.status(404).json({ 
                error: 'Could not extract stream URL',
                debug: {
                    message: 'No matching URL pattern found in page content',
                    capturedUrls: capturedUrls,
                    suggestion: 'The video might be protected by additional security measures or the page structure has changed'
                }
            });
        }
        
        // Make sure the URL is absolute
        if (streamUrl.startsWith('//')) {
            streamUrl = 'https:' + streamUrl;
        } else if (streamUrl.startsWith('/')) {
            const urlObj = new URL(url);
            streamUrl = urlObj.origin + streamUrl;
        }

        console.log('\n✅ === CLEAN STREAM URL EXTRACTED (NO ADS) ===');
        console.log('🎬 Stream URL:', streamUrl);
        console.log('\n📋 Summary:');
        console.log('- Original URL:', url);
        console.log('- Content Type:', url.includes('/tv/') ? 'TV Show' : 'Movie');
        console.log('- Clean Stream URL:', streamUrl);
        console.log('- Type:', streamUrl.includes('.m3u8') ? 'HLS (M3U8)' : 'Direct Video');
        
        res.json({ 
            success: true,
            streamUrl: streamUrl,
            type: streamUrl.includes('.m3u8') ? 'hls' : 'direct',
            contentType: url.includes('/tv/') ? 'tv' : 'movie',
            info: {
                originalUrl: url,
                cleanStreamUrl: streamUrl,
                isAdFree: true,
                contentType: url.includes('/tv/') ? 'tv' : 'movie'
            }
        });
    } catch (error) {
        console.error('Error extracting stream URL:', error);
        res.status(500).json({ 
            error: 'Failed to extract stream URL',
            details: error.message
        });
    } finally {
        // Close the page when done
        if (page) {
            await page.close().catch(e => console.error('Error closing page:', e));
        }
    }
});

// Simple CORS-enabled video proxy
app.get('/api/video-proxy', async (req, res) => {
    const url = req.query.url;

    if (!url) {
        return res.status(400).json({ error: 'URL parameter is required' });
    }

    try {
        console.log('🎬 Proxying video URL:', url);

        // Set CORS headers for video content
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Range, Accept, Accept-Encoding, Referer, User-Agent');

        // Handle preflight requests
        if (req.method === 'OPTIONS') {
            res.status(200).end();
            return;
        }

        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://vidlink.pro/',
                'Accept': '*/*'
            },
            timeout: 30000,
            maxContentLength: 1024 * 1024 * 1024,
            maxBodyLength: 1024 * 1024 * 1024,
            validateStatus: null,
            decompress: false
        });

        // Forward important headers
        if (response.headers['content-type']) {
            res.setHeader('Content-Type', response.headers['content-type']);
        }
        if (response.headers['content-length']) {
            res.setHeader('Content-Length', response.headers['content-length']);
        }
        if (response.headers['accept-ranges']) {
            res.setHeader('Accept-Ranges', response.headers['accept-ranges']);
        }

        // Handle range requests for seeking
        const range = req.headers.range;
        if (range && response.status === 200) {
            res.setHeader('Content-Range', response.headers['content-range'] || `bytes ${range.replace('bytes=', '')}/*`);
            res.status(206);
        } else {
            res.status(response.status);
        }

        response.data.pipe(res);

    } catch (error) {
        console.error('Video proxy error:', error);
        res.status(error.response?.status || 500).json({
            error: 'Failed to proxy video',
            details: error.message
        });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Proxy server running on http://localhost:${PORT}`);
});
