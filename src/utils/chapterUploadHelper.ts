import JSZip from 'jszip';
import { uploadMultipleImagesToCloud, fileToDataUrl, compressDataUrl, parseImageUrlsInput, normalizeImageUrl } from './imageUpload';

export { parseImageUrlsInput, normalizeImageUrl };

export interface ChapterPageItem {
  id: string;
  fileName: string;
  previewUrl: string;
  cloudUrl?: string;
  file?: File;
  isUploading?: boolean;
}

/**
 * Natural Alphanumeric Sorting function
 * Correctly orders filenames such as:
 * ["page_1.jpg", "page_2.jpg", "page_10.jpg", "01.png", "02.png", "100.png"]
 */
export function sortPagesNaturally(pages: ChapterPageItem[]): ChapterPageItem[] {
  return [...pages].sort((a, b) =>
    a.fileName.localeCompare(b.fileName, undefined, { numeric: true, sensitivity: 'base' })
  );
}

/**
 * Reverses the page order
 */
export function reversePages(pages: ChapterPageItem[]): ChapterPageItem[] {
  return [...pages].reverse();
}

/**
 * Extract image files from ZIP archive and sort them naturally by path
 */
export async function extractImageFilesFromZip(zipFile: File): Promise<File[]> {
  const zip = new JSZip();
  const loadedZip = await zip.loadAsync(zipFile);
  const fileEntries: { name: string; promise: Promise<File> }[] = [];

  loadedZip.forEach((relativePath, file) => {
    const isImage = /\.(png|jpe?g|webp|gif)$/i.test(relativePath);
    const isMacTrash = relativePath.includes('__MACOSX') || relativePath.startsWith('.') || relativePath.includes('/.');

    if (!file.dir && isImage && !isMacTrash) {
      const promise = file.async('blob').then((blob) => {
        const fileName = relativePath.split('/').pop() || 'page.png';
        return new File([blob], fileName, { type: blob.type || 'image/png' });
      });
      fileEntries.push({ name: relativePath, promise });
    }
  });

  // Sort entries naturally by full relative path inside the zip
  fileEntries.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  );

  return Promise.all(fileEntries.map((item) => item.promise));
}

/**
 * Process a list of File objects (images or ZIPs) into ChapterPageItems
 * Creates permanent zero-delay base64 previews and triggers background cloud uploads.
 */
export async function processFilesForChapter(
  rawFiles: File[],
  onProgress?: (msg: string) => void
): Promise<{ pages: ChapterPageItem[]; uploadPromise: Promise<ChapterPageItem[]> }> {
  const imageFiles: File[] = [];
  const zipFiles = rawFiles.filter((f) => /\.zip$/i.test(f.name));

  // 1. Gather all image files
  for (const f of rawFiles) {
    if (/\.(png|jpe?g|webp|gif)$/i.test(f.name)) {
      imageFiles.push(f);
    }
  }

  // 2. Extract from ZIP files if any
  if (zipFiles.length > 0) {
    for (const zipFile of zipFiles) {
      try {
        const extracted = await extractImageFilesFromZip(zipFile);
        imageFiles.push(...extracted);
      } catch (err) {
        console.error('ZIP extraction error:', err);
      }
    }
  }

  // 3. Sort all image files naturally by name
  imageFiles.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  );

  // 4. Create local chapter page items with permanent high-quality base64 data URLs
  const initialPages: ChapterPageItem[] = await Promise.all(
    imageFiles.map(async (file) => {
      let dataUrl = '';
      try {
        dataUrl = await fileToDataUrl(file);
      } catch (_) {
        dataUrl = '';
      }
      return {
        id: 'pg_' + Math.random().toString(36).substring(2, 10),
        fileName: file.name,
        previewUrl: dataUrl,
        cloudUrl: dataUrl,
        file,
        isUploading: true
      };
    })
  );

  // 5. Background upload promise
  const uploadPromise = (async () => {
    if (imageFiles.length === 0) return initialPages;

    try {
      if (onProgress) {
        onProgress(`[0/${imageFiles.length}] (0%) Cloud сервер рүү уншиж байна...`);
      }

      const cloudUrls = await uploadMultipleImagesToCloud(imageFiles, (curr, tot, msg) => {
        if (onProgress) onProgress(msg);
      });

      return initialPages.map((page, idx) => {
        const cloudUrl = cloudUrls && cloudUrls[idx] && (cloudUrls[idx].startsWith('http://') || cloudUrls[idx].startsWith('https://'))
          ? cloudUrls[idx]
          : page.previewUrl;
        return {
          ...page,
          cloudUrl,
          isUploading: false
        };
      });
    } catch (err) {
      console.error('Bulk upload error:', err);
      return initialPages.map((page) => ({ ...page, isUploading: false }));
    }
  })();

  return { pages: initialPages, uploadPromise };
}
