/**
 * Permanent Cloud Image Uploader Utility
 * Uploads images directly to permanent cloud storage (Catbox, ImgBB, Telegraph, Pixeldrain) and returns clean, PERMANENT image URLs that never expire.
 * Automatically compresses fallback image Data URLs using HTML5 Canvas to avoid Firestore document size limits.
 */

export const DEFAULT_FALLBACK_IMAGE =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900" fill="%2309090b"><rect width="600" height="900" fill="%2309090b"/><rect x="30" y="30" width="540" height="840" rx="16" fill="%2318181b" stroke="%2327272a" stroke-width="2" stroke-dasharray="8 8"/><circle cx="300" cy="380" r="50" fill="%2327272a"/><path d="M280 370a20 20 0 1 0 40 0 20 20 0 0 0-40 0z" fill="%2371717a"/><path d="M190 530l80-90 60 70 50-60 90 100H190z" fill="%233f3f46"/><text x="50%" y="620" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="bold" fill="%23e4e4e7" text-anchor="middle">Зураг ачаалсангүй</text><text x="50%" y="655" font-family="system-ui, -apple-system, sans-serif" font-size="14" fill="%2371717a" text-anchor="middle">Холбоос буруу эсвэл сүлжээний алдаа гарлаа</text></svg>';

/**
 * Validates whether an input is a potentially valid image URL or data URI
 */
export function isValidImageUrl(url: any): boolean {
  if (!url || typeof url !== 'string') return false;
  let clean = url.trim().replace(/^["'`(<[]+|[)"'`>\]]+$/g, '');
  if (!clean || clean === 'undefined' || clean === 'null') return false;
  return (
    clean.startsWith('http://') ||
    clean.startsWith('https://') ||
    clean.startsWith('data:image/') ||
    clean.startsWith('blob:') ||
    clean.includes('/uploads/') ||
    clean.startsWith('/') ||
    clean.startsWith('//')
  );
}

/**
 * Normalizes an image URL, repairing protocol-relative or relative paths.
 * Automatically handles localhost /uploads paths and upgrades HTTP URLs.
 * Returns fallback if URL is completely invalid.
 */
export function normalizeImageUrl(url: any, fallback = DEFAULT_FALLBACK_IMAGE): string {
  if (!url || typeof url !== 'string') {
    return fallback;
  }
  let clean = url.trim().replace(/^["'`(<[]+|[)"'`>\]]+$/g, '');
  if (!clean || clean === 'undefined' || clean === 'null') {
    return fallback;
  }

  // If URL contains /uploads/ (from local server storage), make it a relative path
  if (clean.includes('/uploads/')) {
    return clean.substring(clean.indexOf('/uploads/'));
  }

  // Data URLs & Blob URLs
  if (clean.startsWith('data:image/') || clean.startsWith('blob:')) {
    return clean;
  }

  // Relative paths
  if (clean.startsWith('/')) {
    return clean;
  }

  // Protocol-relative paths
  if (clean.startsWith('//')) {
    return `https:${clean}`;
  }

  // Upgrade common insecure HTTP hosts to HTTPS to prevent Mixed Content blocking in browsers
  if (clean.startsWith('http://')) {
    if (
      clean.includes('catbox.moe') ||
      clean.includes('ibb.co') ||
      clean.includes('unsplash.com') ||
      clean.includes('telegra.ph') ||
      clean.includes('pixeldrain.com') ||
      clean.includes('postimg.cc') ||
      clean.includes('imgur.com') ||
      clean.includes('cloudinary.com')
    ) {
      clean = clean.replace('http://', 'https://');
    }
    return clean;
  }

  if (clean.startsWith('https://')) {
    return clean;
  }

  // Domains without protocol (e.g. "files.catbox.moe/abc.jpg")
  if (clean.includes('.') && !clean.includes(' ') && !clean.includes('<')) {
    return `https://${clean}`;
  }

  return clean || fallback;
}

const IMGBB_KEYS = [
  '6d207e02198a847aa98d0a2a901485a5',
  '0f9b5c3e2182c3c6f609e9fbc7a9e102',
  '3a298282361b0728c77395ef3e2e28cf',
  'ec57173b2241cfbdfd9426f04fba218b',
  'a3e0f5239fb5bf765691060cae2501a3',
  'd9c8cbcf984bc871239f15c1b697361a'
];

/**
 * Returns original image file without any canvas conversion or quality modification (100% Original Quality & Resolution)
 */
export async function convertFileToHighQualityWebP(
  file: File,
  _quality = 1.0
): Promise<File> {
  return file;
}

/**
 * Returns raw uncompressed Data URL from an image file without canvas conversion
 */
export async function compressImageFile(
  file: File,
  _maxWidth = 3840,
  _maxHeight = 5000,
  _quality = 1.0
): Promise<string> {
  return fileToDataUrl(file);
}

/**
 * Compresses a base64 Data URL using HTML5 Canvas with maximum visual fidelity and sharpness
 */
export async function compressDataUrl(
  dataUrl: string,
  maxDimension = 4096,
  quality = 0.96
): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:image/') || dataUrl.length < 20000) {
    return dataUrl;
  }
  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (maxDimension && (width > maxDimension || height > maxDimension)) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { alpha: true });
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
          const mimeType = dataUrl.includes('image/png') ? 'image/png' : 'image/jpeg';
          const compressed = mimeType === 'image/png' 
            ? canvas.toDataURL('image/png') 
            : canvas.toDataURL('image/jpeg', quality);
          if (compressed.startsWith('data:image') && compressed.length < dataUrl.length) {
            resolve(compressed);
            return;
          }
        }
      } catch (e) {
        console.warn('compressDataUrl error:', e);
      }
      resolve(dataUrl);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * Uploads a base64 Data URL or Blob URL to permanent cloud/server storage and returns an uncompressed HTTPS image URL
 */
export async function uploadDataUrlToCloud(dataUrl: string): Promise<string> {
  if (!dataUrl) return dataUrl;

  // Handle blob: URL by fetching it and converting to File
  if (dataUrl.startsWith('blob:')) {
    try {
      const resp = await fetch(dataUrl);
      const blob = await resp.blob();
      const ext = blob.type.split('/')[1] || 'jpg';
      const file = new File([blob], `manga_page_${Date.now()}.${ext}`, { type: blob.type || 'image/jpeg' });
      const uploadedUrl = await uploadSingleImageToCloud(file);
      if (uploadedUrl && (uploadedUrl.startsWith('http://') || uploadedUrl.startsWith('https://'))) {
        return uploadedUrl;
      }
      if (uploadedUrl && uploadedUrl.startsWith('data:image/')) {
        return uploadedUrl;
      }
      // If cloud upload didn't return http, return compressed data URL
      const rawBase64 = await fileToDataUrl(file);
      const compressed = await compressDataUrl(rawBase64, 1600, 0.88);
      return compressed || rawBase64;
    } catch (err) {
      console.warn('uploadDataUrlToCloud blob convert notice:', err);
      // NEVER return blob: URL because other devices cannot read it!
      return DEFAULT_FALLBACK_IMAGE;
    }
  }

  if (!dataUrl.startsWith('data:image/')) {
    return dataUrl;
  }

  try {
    const arr = dataUrl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    const ext = mime.split('/')[1] || 'jpg';
    const file = new File([u8arr], `manga_page_${Date.now()}.${ext}`, { type: mime });
    const uploadedUrl = await uploadSingleImageToCloud(file);
    if (uploadedUrl && (uploadedUrl.startsWith('http://') || uploadedUrl.startsWith('https://'))) {
      return uploadedUrl;
    }
    // Return compressed data URL
    const compressed = await compressDataUrl(dataUrl, 1600, 0.88);
    return compressed || dataUrl;
  } catch (err) {
    console.warn('uploadDataUrlToCloud error:', err);
  }

  return dataUrl;
}

/**
 * Helper function to perform fetch with a strict timeout to prevent hangs
 */
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 25000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      ...options,
      headers: {
        ...options.headers
      },
      signal: controller.signal
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * IndexedDB Local Media Store for instant video loading & zero reset
 */
const IDB_NAME = 'AyakoAppDB';
const IDB_STORE = 'mediaStore';

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const videoObjectUrlCache = new Map<string, string>();

export function clearLocalVideoFromIDB(key: string): void {
  if (videoObjectUrlCache.has(key)) {
    try {
      URL.revokeObjectURL(videoObjectUrlCache.get(key)!);
    } catch (_) {}
    videoObjectUrlCache.delete(key);
  }
}

export function getCachedVideoUrlSync(key: string): string | null {
  return videoObjectUrlCache.get(key) || null;
}

export async function saveLocalVideoToIDB(key: string, fileOrBlob: Blob): Promise<string> {
  clearLocalVideoFromIDB(key);
  const objectUrl = URL.createObjectURL(fileOrBlob);
  videoObjectUrlCache.set(key, objectUrl);

  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    store.put(fileOrBlob, key);
  } catch (err) {
    console.warn('saveLocalVideoToIDB failed:', err);
  }
  return objectUrl;
}

export async function getLocalVideoFromIDB(key: string): Promise<string | null> {
  if (videoObjectUrlCache.has(key)) {
    return videoObjectUrlCache.get(key)!;
  }
  try {
    const db = await openIDB();
    const tx = db.transaction(IDB_STORE, 'readonly');
    const store = tx.objectStore(IDB_STORE);
    return new Promise((resolve) => {
      const request = store.get(key);
      request.onsuccess = () => {
        if (request.result instanceof Blob) {
          const url = URL.createObjectURL(request.result);
          videoObjectUrlCache.set(key, url);
          resolve(url);
        } else if (typeof request.result === 'string') {
          videoObjectUrlCache.set(key, request.result);
          resolve(request.result);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn('getLocalVideoFromIDB failed:', err);
    return null;
  }
}

/**
 * Fast offline audio extractor & compressor (~1-2 seconds)
 * Extracts audio from any audio or video file and compresses it down to lightweight audio (< 1-2MB)
 */
export async function compressAudioFile(fileOrBlob: Blob): Promise<Blob> {
  // If small audio file (< 1.5MB), return original directly
  if (fileOrBlob.size <= 1.5 * 1024 * 1024 && fileOrBlob.type.startsWith('audio/')) {
    return fileOrBlob;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    const timeout = setTimeout(() => {
      resolve(fileOrBlob);
    }, 12000);

    reader.onload = async (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        if (!arrayBuffer) {
          clearTimeout(timeout);
          resolve(fileOrBlob);
          return;
        }

        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) {
          clearTimeout(timeout);
          resolve(fileOrBlob);
          return;
        }

        const audioCtx = new AudioCtx();
        let decodedBuffer: AudioBuffer;
        try {
          decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        } catch (_) {
          audioCtx.close().catch(() => {});
          clearTimeout(timeout);
          resolve(fileOrBlob);
          return;
        }

        // Limit maximum duration to 10 mins (600s) to keep memory footprint minimal
        const duration = Math.min(decodedBuffer.duration, 600);
        const sampleRate = 22050; // 22.05kHz mono downsampled for ultra lightweight file size
        const offlineCtx = new (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext)(
          1, // 1 channel (mono)
          Math.ceil(sampleRate * duration),
          sampleRate
        );

        const source = offlineCtx.createBufferSource();
        source.buffer = decodedBuffer;
        source.connect(offlineCtx.destination);
        source.start(0);

        const renderedBuffer = await offlineCtx.startRendering();
        audioCtx.close().catch(() => {});

        // Convert renderedBuffer to lightweight 16-bit WAV blob
        const pcmBlob = audioBufferToWav(renderedBuffer);
        clearTimeout(timeout);
        if (pcmBlob && pcmBlob.size > 0 && pcmBlob.size < fileOrBlob.size) {
          resolve(pcmBlob);
        } else {
          resolve(fileOrBlob);
        }
      } catch (err) {
        clearTimeout(timeout);
        resolve(fileOrBlob);
      }
    };

    reader.onerror = () => {
      clearTimeout(timeout);
      resolve(fileOrBlob);
    };

    reader.readAsArrayBuffer(fileOrBlob);
  });
}

function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const out = new DataView(new ArrayBuffer(length));
  const channels: Float32Array[] = [];
  const sampleRate = buffer.sampleRate;
  let offset = 0;
  let pos = 0;

  function writeString(str: string) {
    for (let i = 0; i < str.length; i++) {
      out.setUint8(pos++, str.charCodeAt(i));
    }
  }

  function setUint16(data: number) {
    out.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data: number) {
    out.setUint32(pos, data, true);
    pos += 4;
  }

  // RIFF header
  writeString('RIFF');
  setUint32(length - 8);
  writeString('WAVE');
  writeString('fmt ');
  setUint32(16);
  setUint16(1); // PCM format
  setUint16(numOfChan);
  setUint32(sampleRate);
  setUint32(sampleRate * 2 * numOfChan);
  setUint16(numOfChan * 2);
  setUint16(16); // 16-bit
  writeString('data');
  setUint32(length - pos - 4);

  for (let i = 0; i < buffer.numberOfChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  while (offset < buffer.length) {
    for (let i = 0; i < numOfChan; i++) {
      let sample = Math.max(-1, Math.min(1, channels[i][offset]));
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
      out.setInt16(pos, sample, true);
      pos += 2;
    }
    offset++;
  }

  return new Blob([out.buffer], { type: 'audio/wav' });
}

/**
 * Compress a large video (1080p, 100MB+) down to 720p HD with client-side Canvas/MediaRecorder
 */
export async function compressVideoFile(
  fileOrBlob: Blob,
  maxHeight: number = 1080,
  targetBitrate: number = 4500000
): Promise<Blob> {
  // If small (< 12MB), return original directly
  if (fileOrBlob.size <= 12 * 1024 * 1024) {
    return fileOrBlob;
  }

  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    const videoSrcUrl = URL.createObjectURL(fileOrBlob);
    video.src = videoSrcUrl;
    video.muted = true;
    video.playsInline = true;

    // Timeout fallback after 30s to return original if processing stalls
    const timeout = setTimeout(() => {
      URL.revokeObjectURL(videoSrcUrl);
      resolve(fileOrBlob);
    }, 30000);

    video.onloadedmetadata = () => {
      let width = video.videoWidth || 1280;
      let height = video.videoHeight || 720;

      // Calculate 720p HD constrained dimensions
      if (height > maxHeight) {
        width = Math.round((width * maxHeight) / height);
        height = maxHeight;
      }
      width = width % 2 === 0 ? width : width - 1;
      height = height % 2 === 0 ? height : height - 1;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx || typeof canvas.captureStream !== 'function' || typeof MediaRecorder === 'undefined') {
        clearTimeout(timeout);
        URL.revokeObjectURL(videoSrcUrl);
        resolve(fileOrBlob);
        return;
      }

      const stream = canvas.captureStream(30);
      let mimeType = 'video/webm;codecs=vp8,opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = 'video/webm';
      if (!MediaRecorder.isTypeSupported(mimeType)) mimeType = '';

      let mediaRecorder: MediaRecorder;
      try {
        mediaRecorder = mimeType
          ? new MediaRecorder(stream, { mimeType, videoBitsPerSecond: targetBitrate })
          : new MediaRecorder(stream);
      } catch (_) {
        clearTimeout(timeout);
        URL.revokeObjectURL(videoSrcUrl);
        resolve(fileOrBlob);
        return;
      }

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        clearTimeout(timeout);
        URL.revokeObjectURL(videoSrcUrl);
        const compressedBlob = new Blob(chunks, { type: mediaRecorder.mimeType || 'video/webm' });
        if (compressedBlob.size > 0 && compressedBlob.size < fileOrBlob.size) {
          resolve(compressedBlob);
        } else {
          resolve(fileOrBlob);
        }
      };

      video.currentTime = 0;
      video.play().then(() => {
        mediaRecorder.start(100);
        const drawFrame = () => {
          if (video.paused || video.ended) {
            if (mediaRecorder.state !== 'inactive') {
              mediaRecorder.stop();
            }
            return;
          }
          ctx.drawImage(video, 0, 0, width, height);
          requestAnimationFrame(drawFrame);
        };
        drawFrame();
      }).catch(() => {
        clearTimeout(timeout);
        URL.revokeObjectURL(videoSrcUrl);
        resolve(fileOrBlob);
      });

      video.onended = () => {
        if (mediaRecorder.state !== 'inactive') {
          mediaRecorder.stop();
        }
      };
    };

    video.onerror = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(videoSrcUrl);
      resolve(fileOrBlob);
    };
  });
}

/**
 * Upload a video/audio file to permanent cloud storage with ultra-fast timeout fallbacks
 * (Catbox -> Pixeldrain -> Tmpfiles -> Base64 Data URL)
 */
export async function uploadSingleVideoToCloud(file: File | Blob): Promise<string> {
  // Strategy 1: Catbox.moe API (CORS enabled, permanent, ultra-fast for MP3/MP4, up to 200MB)
  try {
    const formData = new FormData();
    formData.append('reqtype', 'fileupload');
    formData.append('fileToUpload', file);

    const res = await fetchWithTimeout('https://catbox.moe/user/api.php', {
      method: 'POST',
      body: formData,
    }, 25000);

    if (res.ok) {
      const text = (await res.text()).trim();
      if (text.startsWith('http://') || text.startsWith('https://')) {
        return text;
      }
    }
  } catch (err) {
    console.warn('Catbox media upload fallback triggered:', err);
  }

  // Strategy 2: Pixeldrain API (CORS enabled, super fast, up to 10GB)
  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetchWithTimeout('https://pixeldrain.com/api/file', {
      method: 'POST',
      body: formData,
    }, 25000);

    if (res.ok) {
      const json = await res.json();
      if (json.success && json.id) {
        return `https://pixeldrain.com/api/file/${json.id}`;
      }
    }
  } catch (err) {
    console.warn('Pixeldrain media upload fallback triggered:', err);
  }

  // Strategy 3: Tmpfiles API (CORS enabled, direct stream link)
  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetchWithTimeout('https://tmpfiles.org/api/v1/upload', {
      method: 'POST',
      body: formData,
    }, 20000);

    if (res.ok) {
      const json = await res.json();
      if (json.status === 'success' && json.data?.url) {
        return json.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
      }
    }
  } catch (err) {
    console.warn('Tmpfiles media upload fallback triggered:', err);
  }

  // Strategy 4: Fallback for smaller files (<8MB) to data URL
  if (file.size < 8 * 1024 * 1024) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string) || '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  }

  return '';
}

/**
 * Upload an animated GIF file to permanent cloud storage with higher timeouts and direct frame preservation
 */
export async function uploadGifToCloud(file: File): Promise<string> {
  // Strategy 1: ImgLink.cc Direct Upload (Cloudflare CDN, permanent storage, high speed)
  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetchWithTimeout('https://imglink.cc/api/upload', {
      method: 'POST',
      body: formData,
    }, 20000);

    if (res.ok) {
      const json = await res.json();
      if (json?.images?.[0]?.url) {
        return json.images[0].url as string;
      }
    }
  } catch (err) {}

  // Strategy 2: Catbox Permanent Media Upload (25s timeout for large GIFs)
  try {
    const formData = new FormData();
    formData.append('reqtype', 'fileupload');
    formData.append('fileToUpload', file);

    const res = await fetchWithTimeout('https://catbox.moe/user/api.php', {
      method: 'POST',
      body: formData,
    }, 25000);

    if (res.ok) {
      const text = (await res.text()).trim();
      if (text.startsWith('http://') || text.startsWith('https://')) {
        return text;
      }
    }
  } catch (err) {
    console.warn('Catbox GIF upload fallback:', err);
  }

  // Strategy 3: Server-assisted upload (/api/upload)
  try {
    const dataUrl = await fileToDataUrl(file);
    if (dataUrl && dataUrl.startsWith('data:image/')) {
      const res = await fetchWithTimeout('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: dataUrl,
          fileName: file.name || `anim_${Date.now()}.gif`
        })
      }, 25000);

      if (res.ok) {
        const json = await res.json();
        if (json?.url && (json.url.startsWith('http://') || json.url.startsWith('https://'))) {
          return json.url;
        }
      }
    }
  } catch (err) {}

  // Strategy 4: ImgBB with rotating keys (15s timeout)
  for (const key of IMGBB_KEYS) {
    try {
      const formData = new FormData();
      formData.append('image', file);

      const res = await fetchWithTimeout(`https://api.imgbb.com/1/upload?key=${key}`, {
        method: 'POST',
        body: formData,
      }, 15000);

      if (res.ok) {
        const json = await res.json();
        if (json && json.data && (json.data.url || json.data.display_url)) {
          return (json.data.url || json.data.display_url) as string;
        }
      }
    } catch (err) {}
  }

  // Fallback: Return raw Data URL using FileReader (preserving all GIF animation frames)
  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) || '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) || '');
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

/**
 * Upload a single image file to Cloud storage and return the public HTTP URL.
 * ALL strategy endpoints here store images PERMANENTLY without expiration!
 */
export async function uploadSingleImageToCloud(file: File): Promise<string> {
  if (file.type === 'image/gif' || /\.gif$/i.test(file.name)) {
    return uploadGifToCloud(file);
  }

  // Strategy 1: ImgLink.cc Direct Upload (Permanent Cloudflare CDN, CORS-enabled, fast)
  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetchWithTimeout('https://imglink.cc/api/upload', {
      method: 'POST',
      body: formData,
    }, 15000);

    if (res.ok) {
      const json = await res.json();
      if (json?.images?.[0]?.url) {
        return json.images[0].url as string;
      }
    }
  } catch (err) {}

  // Strategy 2: Server-assisted upload (/api/upload) -> connects to server-side ImgLink/CDNs
  try {
    const dataUrl = await fileToDataUrl(file);
    if (dataUrl && dataUrl.startsWith('data:image/')) {
      const res = await fetchWithTimeout('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: dataUrl,
          fileName: file.name || `page_${Date.now()}.jpg`
        })
      }, 20000);

      if (res.ok) {
        const json = await res.json();
        if (json && json.url && (json.url.startsWith('http://') || json.url.startsWith('https://'))) {
          return json.url;
        }
        if (json && json.url && json.url.startsWith('data:image/')) {
          return json.url;
        }
      }
    }
  } catch (err) {
    console.warn('Server /api/upload fallback triggered:', err);
  }

  // Strategy 3: Direct Catbox upload (Permanent host up to 200MB)
  try {
    const formData = new FormData();
    formData.append('reqtype', 'fileupload');
    formData.append('fileToUpload', file);

    const res = await fetchWithTimeout('https://catbox.moe/user/api.php', {
      method: 'POST',
      body: formData,
    }, 15000);

    if (res.ok) {
      const text = (await res.text()).trim();
      if (text.startsWith('http://') || text.startsWith('https://')) {
        return text;
      }
    }
  } catch (err) {}

  // Strategy 4: ImgBB with rotating keys (Permanent CDN)
  for (const key of IMGBB_KEYS) {
    try {
      const formData = new FormData();
      formData.append('image', file);

      const res = await fetchWithTimeout(`https://api.imgbb.com/1/upload?key=${key}`, {
        method: 'POST',
        body: formData,
      }, 12000);

      if (res.ok) {
        const json = await res.json();
        if (json && json.data && (json.data.url || json.data.display_url)) {
          return (json.data.url || json.data.display_url) as string;
        }
      }
    } catch (err) {}
  }

  // Strategy 5: Telegraph / Telegra.ph permanent upload
  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetchWithTimeout('https://telegra.ph/upload', {
      method: 'POST',
      body: formData,
    }, 12000);

    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json) && json[0]?.src) {
        return `https://telegra.ph${json[0].src}`;
      }
    }
  } catch (err) {}

  // Strategy 6: High-efficiency client-side compressed Data URL (works 100% on all devices and phones)
  try {
    const rawData = await fileToDataUrl(file);
    const compressed = await compressDataUrl(rawData, 1600, 0.88);
    if (compressed && compressed.startsWith('data:image/')) {
      return compressed;
    }
    return rawData;
  } catch (_) {
    return '';
  }
}

/**
 * Upload multiple images to cloud in parallel worker batches with live percentage reporting.
 */
export async function uploadMultipleImagesToCloud(
  files: File[],
  onProgress?: (current: number, total: number, statusText: string) => void
): Promise<string[]> {
  // Sort files naturally by filename (1.jpg, 2.jpg, 10.jpg) to preserve page order
  const sortedFiles = [...files].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  );

  const total = sortedFiles.length;
  if (total === 0) return [];

  const results: string[] = new Array(total);
  let completedCount = 0;
  let nextIndex = 0;

  // Run up to 6 concurrent parallel uploads
  const CONCURRENCY = Math.min(6, total);

  const worker = async () => {
    while (nextIndex < total) {
      const idx = nextIndex++;
      const file = sortedFiles[idx];

      try {
        const url = await uploadSingleImageToCloud(file);
        results[idx] = url;
      } catch (err) {
        console.error(`Failed to upload file ${file.name}:`, err);
        const rawFallback = await fileToDataUrl(file);
        results[idx] = rawFallback;
      } finally {
        completedCount++;
        const percent = Math.round((completedCount / total) * 100);
        if (onProgress) {
          onProgress(
            completedCount,
            total,
            `[${completedCount}/${total}] (${percent}%) Зургуудыг байнгын Cloud сервер рүү найдвартай хуулж байна...`
          );
        }
      }
    }
  };

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  return results;
}

/**
 * Parses raw text input containing image URLs (newline, space, comma separated, markdown, or HTML)
 */
export function parseImageUrlsInput(rawText: string): string[] {
  if (!rawText || !rawText.trim()) return [];

  // Match URLs in Markdown ![alt](url), HTML src="url", BBCode [img]url[/img], or standard links
  const urlRegex = /(?:https?:\/\/|\/\/|data:image\/)[^\s"'<>()[\]{}]+/gi;
  const matches = rawText.match(urlRegex);

  if (matches && matches.length > 0) {
    const cleaned = matches.map((u) => {
      let clean = u.trim().replace(/^["'(<]+|[)"'>.,;]+$/g, '');
      if (clean.startsWith('//')) clean = `https:${clean}`;
      return clean;
    }).filter((u) => u.length > 5);

    if (cleaned.length > 0) {
      return Array.from(new Set(cleaned));
    }
  }

  const lines = rawText.split(/[\n,\s]+/);
  return lines
    .map((line) => line.trim().replace(/^["'(<]+|[)"'>.,;]+$/g, ''))
    .filter((line) => {
      if (line.length < 5) return false;
      return (
        line.startsWith('http://') ||
        line.startsWith('https://') ||
        line.startsWith('data:image/') ||
        line.startsWith('//')
      );
    })
    .map((line) => (line.startsWith('//') ? `https:${line}` : line));
}

