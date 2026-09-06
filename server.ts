import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createServer as createViteServer } from 'vite';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, collection, onSnapshot } from 'firebase/firestore';

const app = express();
const PORT = 3000;

// Persistent disk cache file for reliable state retention across restarts
const cacheFilePath = path.resolve(process.cwd(), 'site-cache.json');

// In-memory cache of live site state for instantaneous, 0ms page delivery
let serverInitialData: {
  siteConfig: any;
  mangas: any[];
  chapters: any[];
  genres: string[];
  movies: any[];
  movieEpisodes: any[];
  lastUpdated: number;
} = {
  siteConfig: null,
  mangas: [],
  chapters: [],
  genres: [],
  movies: [],
  movieEpisodes: [],
  lastUpdated: 0
};

// Load existing disk cache on startup if available
if (fs.existsSync(cacheFilePath)) {
  try {
    const raw = fs.readFileSync(cacheFilePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed.siteConfig) {
      serverInitialData.siteConfig = parsed.siteConfig;
      if (serverInitialData.siteConfig.siteName === 'AYAKO MANGA' || serverInitialData.siteConfig.siteName === 'АЯАКО') {
        serverInitialData.siteConfig.siteName = 'MISORA';
      }
    }
    if (Array.isArray(parsed.mangas)) {
      serverInitialData.mangas = parsed.mangas.filter((m: any) => m && m.title !== 'ёсч');
    }
    if (Array.isArray(parsed.chapters)) serverInitialData.chapters = parsed.chapters;
    if (Array.isArray(parsed.genres)) serverInitialData.genres = parsed.genres;
    if (Array.isArray(parsed.movies)) serverInitialData.movies = parsed.movies;
    if (Array.isArray(parsed.movieEpisodes)) serverInitialData.movieEpisodes = parsed.movieEpisodes;
    if (parsed.lastUpdated) serverInitialData.lastUpdated = parsed.lastUpdated;
    console.log('[Server Cache] Loaded existing site state from disk cache');
  } catch (err: any) {
    console.warn('[Server Cache Notice] Failed to read disk cache:', err?.message);
  }
}

if (!serverInitialData.siteConfig) {
  serverInitialData.siteConfig = {
    siteName: 'MISORA',
    themeColor: '#ff2a85',
    bannerTitle: 'MANGA',
    bannerSubtitle: 'Манга, Махвуа, Комиксыг хамгийн хурднаар орчуулан хүргэж байна',
    isFreeSiteMode: false,
    isMoviesTabEnabled: true
  };
} else if (serverInitialData.siteConfig.siteName === 'AYAKO MANGA' || serverInitialData.siteConfig.siteName === 'АЯАКО') {
  serverInitialData.siteConfig.siteName = 'MISORA';
}

function saveCacheToDisk() {
  try {
    const toPersist = {
      siteConfig: serverInitialData.siteConfig,
      mangas: serverInitialData.mangas,
      chapters: serverInitialData.chapters,
      genres: serverInitialData.genres,
      movies: serverInitialData.movies,
      movieEpisodes: serverInitialData.movieEpisodes,
      lastUpdated: serverInitialData.lastUpdated
    };
    fs.writeFileSync(cacheFilePath, JSON.stringify(toPersist, null, 2), 'utf8');
  } catch (err: any) {
    console.warn('[Server Cache Notice] Failed to write disk cache:', err?.message);
  }
}

// Initialize server-side real-time Firestore synchronization
try {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const fbApp = initializeApp(firebaseConfig, 'server-sync-app');
    const db = getFirestore(fbApp, firebaseConfig.firestoreDatabaseId);

    // Real-time siteConfig listener
    onSnapshot(doc(db, 'settings', 'siteConfig'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.siteName === 'AYAKO MANGA' || data.siteName === 'АЯАКО') {
          data.siteName = 'MISORA';
        }
        serverInitialData.siteConfig = { ...(serverInitialData.siteConfig || {}), ...data };
        serverInitialData.lastUpdated = Date.now();
        saveCacheToDisk();
      }
    }, (err) => console.warn('[Server Firestore siteConfig notice]', err?.message));

    // Real-time mangas listener
    onSnapshot(collection(db, 'mangas'), (snap) => {
      const list: any[] = [];
      snap.forEach(d => {
        const data = d.data();
        if (data.title !== 'ёсч') {
          list.push({ id: d.id, ...data });
        }
      });
      if (list.length > 0) {
        serverInitialData.mangas = list;
        serverInitialData.lastUpdated = Date.now();
        saveCacheToDisk();
      }
    }, (err) => console.warn('[Server Firestore mangas notice]', err?.message));

    // Real-time chapters listener
    onSnapshot(collection(db, 'chapters'), (snap) => {
      const list: any[] = [];
      snap.forEach(d => {
        const data = d.data();
        list.push({ id: d.id, ...data });
      });
      if (list.length > 0) {
        list.sort((a, b) => {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return timeB - timeA;
        });
        serverInitialData.chapters = list;
        serverInitialData.lastUpdated = Date.now();
        saveCacheToDisk();
      }
    }, (err) => console.warn('[Server Firestore chapters notice]', err?.message));

    // Real-time genres listener
    onSnapshot(collection(db, 'genres'), (snap) => {
      const list: string[] = [];
      snap.forEach(d => {
        const data = d.data();
        if (data.name) list.push(data.name);
      });
      if (list.length > 0) {
        serverInitialData.genres = list;
      }
    }, () => {});

    // Real-time movies listener
    onSnapshot(collection(db, 'movies'), (snap) => {
      const list: any[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() });
      });
      if (list.length > 0) {
        serverInitialData.movies = list;
        saveCacheToDisk();
      }
    }, () => {});

    // Real-time movieEpisodes listener
    onSnapshot(collection(db, 'movieEpisodes'), (snap) => {
      const list: any[] = [];
      snap.forEach(d => {
        list.push({ id: d.id, ...d.data() });
      });
      if (list.length > 0) {
        serverInitialData.movieEpisodes = list;
        saveCacheToDisk();
      }
    }, () => {});
  }
} catch (err: any) {
  console.warn('[Server Firestore initialization notice]', err?.message);
}

function injectInitialData(html: string): string {
  try {
    const serialized = JSON.stringify(serverInitialData).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
    const themeColor = serverInitialData?.siteConfig?.themeColor;
    let styleInject = '';
    if (themeColor && themeColor.startsWith('#')) {
      styleInject = `
    <style id="__SERVER_THEME_VARS__">
      :root {
        --color-brand-accent: ${themeColor} !important;
        --theme-accent: ${themeColor} !important;
      }
    </style>`;
    }

    const scriptInject = `<script id="__INITIAL_DATA_SCRIPT__">window.__INITIAL_DATA__ = ${serialized};</script>${styleInject}`;

    if (html.includes('</head>')) {
      return html.replace('</head>', `${scriptInject}\n</head>`);
    }
    return scriptInject + html;
  } catch (err) {
    return html;
  }
}

// Body parsers with high limits for manga chapter image batches
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Ensure upload directory exists
const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve public uploads statically with long-term cache headers
app.use('/uploads', express.static(uploadsDir, {
  maxAge: '1y',
  immutable: true,
  setHeaders: (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
}));

// Fallback for dist/uploads in production
const distUploadsDir = path.join(process.cwd(), 'dist', 'uploads');
if (!fs.existsSync(distUploadsDir)) {
  fs.mkdirSync(distUploadsDir, { recursive: true });
}
app.use('/uploads', express.static(distUploadsDir, {
  maxAge: '1y',
  immutable: true,
  setHeaders: (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
}));

// ImgBB API Keys for rotation
const IMGBB_KEYS = [
  '6d207e02198a847aa98d0a2a901485a5',
  '0f9b5c3e2182c3c6f609e9fbc7a9e102',
  '3a298282361b0728c77395ef3e2e28cf',
  'ec57173b2241cfbdfd9426f04fba218b'
];

/**
 * Upload a Buffer to ImgLink.cc (Permanent Cloudflare CDN storage)
 */
async function uploadToImgLink(buffer: Buffer, fileName: string): Promise<string | null> {
  try {
    const formData = new FormData();
    const mime = getMimeType(fileName);
    const blob = new Blob([buffer], { type: mime });
    formData.append('file', blob, fileName);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch('https://imglink.cc/api/upload', {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data?.images?.[0]?.url) {
        return data.images[0].url as string;
      }
    }
  } catch (err) {
    console.warn('ImgLink upload notice:', err);
  }
  return null;
}

/**
 * Upload a Buffer to Catbox.moe (Permanent, unexpiring storage)
 */
async function uploadToCatbox(buffer: Buffer, fileName: string): Promise<string | null> {
  try {
    const formData = new FormData();
    formData.append('reqtype', 'fileupload');
    const blob = new Blob([buffer], { type: getMimeType(fileName) });
    formData.append('fileToUpload', blob, fileName);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch('https://catbox.moe/user/api.php', {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (res.ok) {
      const text = (await res.text()).trim();
      if (text.startsWith('http://') || text.startsWith('https://')) {
        return text;
      }
    }
  } catch (err) {
    console.warn('Catbox upload notice:', err);
  }
  return null;
}

/**
 * Upload a Buffer to ImgBB (Permanent CDN)
 */
async function uploadToImgBB(buffer: Buffer, fileName: string): Promise<string | null> {
  const base64Data = buffer.toString('base64');
  for (const key of IMGBB_KEYS) {
    try {
      const formData = new FormData();
      formData.append('image', base64Data);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(`https://api.imgbb.com/1/upload?key=${key}`, {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = await res.json();
        if (data?.data?.url || data?.data?.display_url) {
          return (data.data.url || data.data.display_url) as string;
        }
      }
    } catch (err) {
      // try next key
    }
  }
  return null;
}

function getMimeType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.svg':
      return 'image/svg+xml';
    default:
      return 'image/jpeg';
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Single or Batch Image Upload Endpoint
app.post('/api/upload', async (req, res) => {
  try {
    const { image, images, fileName } = req.body;

    // Handle batch upload
    if (Array.isArray(images) && images.length > 0) {
      const uploadedUrls: string[] = [];

      for (let i = 0; i < images.length; i++) {
        const item = images[i];
        if (!item || typeof item !== 'string') continue;

        if (item.startsWith('http://') || item.startsWith('https://')) {
          uploadedUrls.push(item);
          continue;
        }

        const url = await processAndSaveBase64Image(item, `manga_page_${Date.now()}_${i}.jpg`, req);
        uploadedUrls.push(url);
      }

      return res.json({ success: true, urls: uploadedUrls });
    }

    // Handle single image upload
    if (image && typeof image === 'string') {
      if (image.startsWith('http://') || image.startsWith('https://')) {
        return res.json({ success: true, url: image });
      }

      const safeName = fileName || `image_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.jpg`;
      const url = await processAndSaveBase64Image(image, safeName, req);
      return res.json({ success: true, url });
    }

    return res.status(400).json({ error: 'No image data provided in request' });
  } catch (err: any) {
    console.error('Server upload error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to process image' });
  }
});

async function processAndSaveBase64Image(dataStr: string, defaultName: string, req: express.Request): Promise<string> {
  let base64 = dataStr;
  let ext = '.jpg';

  if (dataStr.startsWith('data:')) {
    const matches = dataStr.match(/^data:image\/([a-zA-Z0-9+-]+);base64,(.+)$/);
    if (matches && matches[2]) {
      ext = '.' + (matches[1] === 'jpeg' ? 'jpg' : matches[1]);
      base64 = matches[2];
    } else {
      const commaIdx = dataStr.indexOf(',');
      if (commaIdx !== -1) {
        base64 = dataStr.substring(commaIdx + 1);
      }
    }
  }

  const buffer = Buffer.from(base64, 'base64');
  const uniqueName = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`;
  const localFilePath = path.join(uploadsDir, uniqueName);

  // 1. Write file to local disk (Guaranteed permanent fallback)
  fs.writeFileSync(localFilePath, buffer);

  // If dist uploads exists, sync it too
  if (fs.existsSync(distUploadsDir)) {
    try {
      fs.writeFileSync(path.join(distUploadsDir, uniqueName), buffer);
    } catch (_) {}
  }

  // 2. Upload to permanent Cloud CDNs (ImgLink is Tier 1, then Catbox / ImgBB)
  try {
    const imglinkUrl = await uploadToImgLink(buffer, uniqueName);
    if (imglinkUrl) {
      return imglinkUrl;
    }

    const catboxUrl = await uploadToCatbox(buffer, uniqueName);
    if (catboxUrl) {
      return catboxUrl;
    }

    const imgbbUrl = await uploadToImgBB(buffer, uniqueName);
    if (imgbbUrl) {
      return imgbbUrl;
    }
  } catch (err) {
    console.warn('Cloud CDN mirror notice:', err);
  }

  // If cloud uploads fail and dataStr was a data URI, return it directly so any device can display it
  if (dataStr && dataStr.startsWith('data:image/')) {
    return dataStr;
  }

  return `/uploads/${uniqueName}`;
}

// Resilient Image Proxy Endpoint (Bypasses CORS, referer blocks, hotlink restrictions)
app.get('/api/proxy-image', async (req, res) => {
  let targetUrl = req.query.url as string;
  if (!targetUrl || typeof targetUrl !== 'string') {
    return res.status(400).send('Invalid URL parameter');
  }

  targetUrl = targetUrl.trim().replace(/^["'`(<[]+|[)"'`>\]]+$/g, '');

  // If URL contains localhost or 127.0.0.1 pointing to an upload
  if (targetUrl.includes('/uploads/')) {
    const fileName = path.basename(targetUrl.split('?')[0]);
    const filePath = path.join(uploadsDir, fileName);
    if (fs.existsSync(filePath)) {
      return res.sendFile(filePath);
    }
    const distFilePath = path.join(distUploadsDir, fileName);
    if (fs.existsSync(distFilePath)) {
      return res.sendFile(distFilePath);
    }
    // Return reliable public fallback image if the ephemeral upload is not present
    return res.redirect(302, 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=85');
  }

  if (targetUrl.startsWith('//')) {
    targetUrl = `https:${targetUrl}`;
  }

  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    return res.status(400).send('Invalid URL parameter format');
  }

  // Tier 1: Direct fetch with neutral / standard browser headers
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Sec-Fetch-Dest': 'image',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'cross-site'
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (response.ok) {
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Access-Control-Allow-Origin', '*');

      const arrayBuffer = await response.arrayBuffer();
      return res.send(Buffer.from(arrayBuffer));
    }
  } catch (err: any) {
    // continue to tier 2
  }

  // Tier 2: Cloudflare Weserv image proxy
  try {
    const cleanUrl = targetUrl.replace(/^https?:\/\//, '');
    const weservUrl = `https://images.weserv.nl/?url=${encodeURIComponent(cleanUrl)}&default=${encodeURIComponent(targetUrl)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const weservRes = await fetch(weservUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (weservRes.ok) {
      const contentType = weservRes.headers.get('content-type') || 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Access-Control-Allow-Origin', '*');

      const arrayBuffer = await weservRes.arrayBuffer();
      return res.send(Buffer.from(arrayBuffer));
    }
  } catch (err: any) {
    // continue to tier 3
  }

  // Tier 3: AllOrigins raw proxy
  try {
    const allOriginsUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const aoRes = await fetch(allOriginsUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (aoRes.ok) {
      const contentType = aoRes.headers.get('content-type') || 'image/jpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Access-Control-Allow-Origin', '*');

      const arrayBuffer = await aoRes.arrayBuffer();
      return res.send(Buffer.from(arrayBuffer));
    }
  } catch (err: any) {}

  return res.status(404).send('Image could not be retrieved from remote source');
});

// API endpoint for client to fetch fresh initial state if needed
app.get('/api/initial-state', (req, res) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.json(serverInitialData);
});

// API endpoint for client to push instantaneous state updates
app.post('/api/sync-state', (req, res) => {
  try {
    const { key, data } = req.body || {};
    if (key && data !== undefined) {
      if (key === 'siteConfig') {
        serverInitialData.siteConfig = { ...(serverInitialData.siteConfig || {}), ...data };
      } else if (key === 'mangas' && Array.isArray(data)) {
        serverInitialData.mangas = data;
      } else if (key === 'chapters' && Array.isArray(data)) {
        serverInitialData.chapters = data;
      } else if (key === 'movies' && Array.isArray(data)) {
        serverInitialData.movies = data;
      } else if (key === 'movieEpisodes' && Array.isArray(data)) {
        serverInitialData.movieEpisodes = data;
      } else if (key === 'genres' && Array.isArray(data)) {
        serverInitialData.genres = data;
      }
      serverInitialData.lastUpdated = Date.now();
      saveCacheToDisk();
      return res.json({ success: true, lastUpdated: serverInitialData.lastUpdated });
    }
    return res.status(400).json({ error: 'Missing key or data' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Vite Middleware for Development / Static serving for Production
async function setupApp() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    // Intercept full HTML navigation requests to inject latest state directly
    app.use(async (req, res, next) => {
      if (req.method === 'GET' && req.headers.accept?.includes('text/html') && !req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
        try {
          let template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
          template = await vite.transformIndexHtml(req.originalUrl, template);
          const html = injectInitialData(template);
          return res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
        } catch (e) {
          return next(e);
        }
      }
      next();
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, { index: false }));
    app.get('*', (req, res) => {
      try {
        let template = fs.readFileSync(path.join(distPath, 'index.html'), 'utf-8');
        const html = injectInitialData(template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (e) {
        res.sendFile(path.join(distPath, 'index.html'));
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MISORA Server running on http://0.0.0.0:${PORT}`);
  });
}

setupApp();
