# Faheemz Backend (Render-ready)
Backend to extract clean .m3u8/.mp4 streams using Puppeteer and proxy them safely for frontend playback.

### Deploy to Render
1. Push to GitHub.
2. Create a new Web Service in Render.
3. Build command: `npm install`
4. Start command: `npm start`
5. CORS allowed: https://faheemzmovies.netlify.app

### Endpoints
- `/api/extract?url=<video_page>` → returns `{stream: <m3u8_url>}`
- `/api/video-proxy?url=<m3u8_url>` → proxies playlists/segments
