import express from 'express';
import puppeteer from 'puppeteer';
import cors from 'cors';
import axios from 'axios';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

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
    res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self' https:;");
    next();
});

// Root route
app.get('/', (req, res) => {
    res.send(`
        <h1>FAHEEMZMOVIES Proxy Server</h1>
        <p>API Endpoints:</p>
        <ul>
            <li><strong>GET /api/extract-stream?url=VIDEO_URL</strong> - Extract clean stream URL from video provider (Movies & TV Shows)</li>
            <li><strong>GET /api/stream?url=STREAM_URL</strong> - Proxy for video streaming</li>
        </ul>
        <p>Supported URL formats:</p>
        <ul>
            <li>Movies: <code>https://vidlink.pro/movie/{movieId}</code></li>
            <li>TV Shows: <code>https://vidlink.pro/tv/{tvId}/{season}/{episode}</code></li>
        </ul>
        <p>Check the server console for detailed logs of requests.</p>
    `);
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
                capturedFromNetwork: capturedUrls.m3u8.length > 0 || capturedUrls.mp4.length > 0,
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

// Proxy endpoint for streaming video
app.get('/api/stream', async (req, res) => {
    let page;
    let browser;
    let url = req.query.url;
    
    try {
        // Use Puppeteer to handle Cloudflare
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
        
        page = await browser.newPage();
        
        // Set a realistic user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        
        // Set viewport to a common desktop size
        await page.setViewport({ width: 1366, height: 768 });
        
        console.log('Opening page to handle Cloudflare...');
        
        // Listen for responses to find the m3u8 URL
        const videoUrlPromise = new Promise((resolve) => {
            page.on('response', async (response) => {
                const url = response.url();
                if (url.includes('.m3u8')) {
                    console.log('Found m3u8 URL:', url);
                    resolve(url);
                }
            });
        });
        
        // Navigate to the URL
        await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: 60000
        });
        
        console.log('Page loaded, waiting for video...');
        
        // Wait for either the video element or the m3u8 URL
        const videoUrl = await Promise.race([
            videoUrlPromise,
            page.waitForSelector('video', { timeout: 30000 })
                .then(() => page.evaluate(() => document.querySelector('video')?.src)),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for video')), 30000))
        ]);
        
        if (!videoUrl) {
            throw new Error('Could not find video URL');
        }
        
        console.log('Video URL found:', videoUrl);
        
        // Get cookies to maintain session
        const cookies = await page.cookies();
        const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');
        
        // Close the browser as we don't need it anymore
        await browser.close();
        
        // Now make the request with the session cookies
        const response = await axios({
            method: 'get',
            url: videoUrl,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://vidlink.pro/',
                'Origin': 'https://vidlink.pro',
                'Cookie': cookieHeader,
                'Accept': '*/*',
                'Accept-Encoding': 'identity;q=1, *;q=0',
                'Connection': 'keep-alive'
            },
            timeout: 30000,
            maxContentLength: 1024 * 1024 * 1024,
            maxBodyLength: 1024 * 1024 * 1024,
            validateStatus: null,
            decompress: false,
            maxRedirects: 5
        });
        
        if (!url) {
            return res.status(400).json({ error: 'URL parameter is required' });
        }
        
        console.log('\n=== Proxying Stream ===');
        console.log('Original URL:', url);

        // Parse the URL to extract headers if they exist
        const urlObj = new URL(url);
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Referer': 'https://vidlink.pro/',
            'Origin': 'https://vidlink.pro'
        };

        // Try to extract headers from URL parameters
        try {
            // Handle the headers parameter which is already URL-encoded JSON
            const headersMatch = url.match(/headers=([^&]*)/);
            if (headersMatch && headersMatch[1]) {
                const headersJson = decodeURIComponent(headersMatch[1]);
                const customHeaders = JSON.parse(headersJson);
                Object.assign(headers, customHeaders);
                
                // Reconstruct the URL without the headers parameter
                const urlWithoutHeaders = url.split('?')[0];
                const searchParams = new URLSearchParams(url.split('?')[1] || '');
                searchParams.delete('headers');
                url = searchParams.toString() ? 
                    `${urlWithoutHeaders}?${searchParams.toString()}` : 
                    urlWithoutHeaders;
            }
        } catch (e) {
            console.log('Could not parse custom headers, using defaults');
            console.error('Headers parsing error:', e.message);
        }

        console.log('Proxying to URL:', url);
        console.log('Using headers:', headers);

        console.log('Final URL being requested:', url);
        
        // Log the exact request being made
        console.log('\n=== Making Request ===');
        console.log('URL:', url);
        console.log('Method: GET');
        console.log('Headers:', {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Referer': headers.referer || 'https://vidlink.pro/',
            'Origin': headers.origin || 'https://vidlink.pro',
            'Accept': '*/*'
        });

        // Make the request
        response = await axios({
            method: 'get',
            url: url,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Referer': headers.referer || 'https://vidlink.pro/',
                'Origin': headers.origin || 'https://vidlink.pro',
                'Accept': '*/*',
                'Accept-Encoding': 'identity;q=1, *;q=0',
                'Connection': 'keep-alive'
            },
            timeout: 30000,
            maxContentLength: 1024 * 1024 * 1024,
            maxBodyLength: 1024 * 1024 * 1024,
            validateStatus: null,
            decompress: false,
            maxRedirects: 5
        });

        // Log response info (without the body)
        console.log('\n=== Response Received ===');
        console.log('Status:', response.status, response.statusText);
        console.log('Response Headers:', response.headers);

        // Forward the appropriate headers
        const responseHeaders = {
            'Content-Type': response.headers['content-type'] || 'application/octet-stream',
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'no-cache',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Range',
            'Access-Control-Expose-Headers': 'Content-Length, Content-Range'
        };

        // Only set Content-Length if it exists
        if (response.headers['content-length']) {
            responseHeaders['Content-Length'] = response.headers['content-length'];
        }

        // Handle partial content (seeking)
        const range = req.headers.range;
        if (range) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : response.data.length - 1;
            const chunksize = (end - start) + 1;
            
            responseHeaders['Content-Range'] = `bytes ${start}-${end}/${response.data.length}`;
            responseHeaders['Content-Length'] = chunksize;
            
            res.writeHead(206, responseHeaders);
            response.data.pipe(res);
        } else {
            res.writeHead(200, responseHeaders);
            response.data.pipe(res);
        }
    } catch (error) {
        console.error('Proxy error:', error);
        const status = error.response?.status || 500;
        const message = error.response?.statusText || 'Failed to fetch the video stream';
        res.status(status).json({ 
            error: message,
            details: error.message,
            url: url,
            response: error.response ? {
                status: error.response.status,
                statusText: error.response.statusText,
                headers: error.response.headers
            } : undefined
        });
    } finally {
        // Clean up the response if it exists
        if (response && response.data) {
            response.data.destroy();
        }
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Proxy server running on http://localhost:${PORT}`);
});
