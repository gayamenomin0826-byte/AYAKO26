import React, { useState, useEffect, useRef } from 'react';
import { DEFAULT_FALLBACK_IMAGE, normalizeImageUrl } from '../utils/imageUpload';

export interface SmartImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string | null;
  fallbackSrc?: string;
  onImageLoadSuccess?: () => void;
  onImageLoadError?: () => void;
}

export const SmartImage: React.FC<SmartImageProps> = ({
  src,
  alt = '',
  className = '',
  fallbackSrc = DEFAULT_FALLBACK_IMAGE,
  onImageLoadSuccess,
  onImageLoadError,
  onError,
  ...rest
}) => {
  const [currentSrc, setCurrentSrc] = useState<string>(() => {
    const raw = typeof src === 'string' ? src.trim() : '';
    return raw ? normalizeImageUrl(raw, fallbackSrc) : fallbackSrc;
  });
  const [retryStage, setRetryStage] = useState<number>(0);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    const raw = typeof src === 'string' ? src.trim() : '';
    if (!raw || raw === 'undefined' || raw === 'null') {
      setCurrentSrc(fallbackSrc);
      setRetryStage(99);
      return;
    }

    const normalized = normalizeImageUrl(raw, fallbackSrc);
    setCurrentSrc(normalized);
    setRetryStage(0);
  }, [src, fallbackSrc]);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const raw = typeof src === 'string' ? src.trim() : '';

    if (!raw || raw === 'undefined' || raw === 'null' || retryStage >= 4) {
      setCurrentSrc(fallbackSrc);
      if (onImageLoadError) onImageLoadError();
      if (onError) onError(e);
      return;
    }

    let cleanUrl = raw.replace(/^["'`(<[]+|[)"'`>\]]+$/g, '');
    if (cleanUrl.startsWith('//')) {
      cleanUrl = `https:${cleanUrl}`;
    }

    if (cleanUrl.includes('/uploads/')) {
      if (retryStage === 0) {
        setRetryStage(1);
        setCurrentSrc(`/api/proxy-image?url=${encodeURIComponent(cleanUrl)}`);
        return;
      }
    }

    if (cleanUrl.startsWith('blob:')) {
      // Blobs cannot be proxied or fetched across devices. Immediately fall back.
      setRetryStage(4);
      setCurrentSrc(fallbackSrc);
      if (onImageLoadError) onImageLoadError();
      if (onError) onError(e);
      return;
    }

    if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
      // Stage 1: Server backend proxy
      if (retryStage === 0) {
        setRetryStage(1);
        setCurrentSrc(`/api/proxy-image?url=${encodeURIComponent(cleanUrl)}`);
        return;
      }

      // Stage 2: Cloudflare Weserv image CDN proxy
      if (retryStage === 1) {
        setRetryStage(2);
        const urlWithoutProto = cleanUrl.replace(/^https?:\/\//, '');
        setCurrentSrc(
          `https://images.weserv.nl/?url=${encodeURIComponent(urlWithoutProto)}&default=${encodeURIComponent(cleanUrl)}`
        );
        return;
      }

      // Stage 3: AllOrigins raw CORS proxy
      if (retryStage === 2) {
        setRetryStage(3);
        setCurrentSrc(`https://api.allorigins.win/raw?url=${encodeURIComponent(cleanUrl)}`);
        return;
      }
    }

    // Final Stage: Fallback image
    setRetryStage(4);
    setCurrentSrc(fallbackSrc);
    if (onImageLoadError) onImageLoadError();
    if (onError) onError(e);
  };

  const handleImageLoad = () => {
    if (onImageLoadSuccess) {
      onImageLoadSuccess();
    }
  };

  return (
    <img
      src={currentSrc || fallbackSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      loading={rest.loading || 'eager'}
      decoding={rest.decoding || 'async'}
      onError={handleImageError}
      onLoad={handleImageLoad}
      className={className}
      {...rest}
    />
  );
};

export default SmartImage;
