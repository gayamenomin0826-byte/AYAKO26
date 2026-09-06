import React, { useState, useEffect, useRef } from 'react';
import { Manga } from '../types';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import SmartImage from './SmartImage';

interface FeaturedCarouselProps {
  mangas: Manga[];
  onSelect: (manga: Manga) => void;
}

export default function FeaturedCarousel({ mangas, onSelect }: FeaturedCarouselProps) {
  const [centerIndex, setCenterIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const autoPlayTimer = useRef<NodeJS.Timeout | null>(null);

  const safeMangas = mangas || [];
  const displayMangas = safeMangas.length > 0 && safeMangas.length < 5
    ? [...safeMangas, ...safeMangas, ...safeMangas].slice(0, 8)
    : safeMangas;

  // Auto-play scroll handler
  useEffect(() => {
    if (displayMangas.length === 0) return;
    if (isPlaying) {
      autoPlayTimer.current = setInterval(() => {
        setCenterIndex((prev) => (prev + 1) % displayMangas.length);
      }, 3500); // changes every 3.5 seconds
    } else {
      if (autoPlayTimer.current) {
        clearInterval(autoPlayTimer.current);
      }
    }

    return () => {
      if (autoPlayTimer.current) {
        clearInterval(autoPlayTimer.current);
      }
    };
  }, [isPlaying, displayMangas.length]);

  // Guard against empty array
  if (!safeMangas || safeMangas.length === 0) return null;

  const handleNext = () => {
    setCenterIndex((prev) => (prev + 1) % displayMangas.length);
  };

  const handlePrev = () => {
    setCenterIndex((prev) => (prev - 1 + displayMangas.length) % displayMangas.length);
  };

  const handleCardClick = (index: number, manga: Manga) => {
    if (index === centerIndex) {
      // Click on the active centered card opens it
      onSelect(manga);
    } else {
      // Click on a side card brings it to focus
      setCenterIndex(index);
    }
  };

  const currentManga = displayMangas[centerIndex];

  return (
    <div
      id="featured-cover-flow-container"
      className="relative w-full overflow-hidden p-0 flex flex-col items-center space-y-4"
      onMouseEnter={() => setIsPlaying(false)}
      onMouseLeave={() => setIsPlaying(true)}
    >
      {/* Blurred background image overlay representing the active item */}
      <div className="absolute inset-0 z-0 transition-all duration-700 ease-out scale-105 pointer-events-none opacity-80 blur-3xl">
        <SmartImage
          key={currentManga?.coverUrl}
          src={currentManga?.coverUrl}
          alt=""
          className="w-full h-full object-cover opacity-60"
        />
        {/* Advanced vignette & multidirectional radial/linear gradients to perfectly dissolve the image into the background */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b0b0f] via-transparent to-[#0b0b0f]" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0b0b0f] via-transparent to-[#0b0b0f]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_15%,#0b0b0f_95%)]" />
        <div className="absolute inset-0 bg-[#0b0b0f]/40" />
      </div>

      {/* 3D Stage / Stage Canvas */}
      <div className="relative w-full max-w-3xl h-[280px] sm:h-[340px] md:h-[380px] flex items-center justify-center [perspective:1200px] z-10 overflow-visible mt-2">
        
        {/* Navigation Arrow Overlays (Manual scroll buttons) */}
        <button
          onClick={handlePrev}
          className="absolute left-1 sm:left-4 z-40 p-2 sm:p-3 bg-brand-bg/85 hover:bg-brand-accent text-brand-accent hover:text-brand-bg border border-brand-accent/25 hover:border-brand-accent rounded-full shadow-2xl transition-all cursor-pointer transform -translate-y-1/2 top-1/2 active:scale-95"
          aria-label="Өмнөх"
        >
          <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        <button
          onClick={handleNext}
          className="absolute right-1 sm:right-4 z-40 p-2 sm:p-3 bg-brand-bg/85 hover:bg-brand-accent text-brand-accent hover:text-brand-bg border border-brand-accent/25 hover:border-brand-accent rounded-full shadow-2xl transition-all cursor-pointer transform -translate-y-1/2 top-1/2 active:scale-95"
          aria-label="Дараах"
        >
          <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* Card mapping loop */}
        {displayMangas.map((manga, idx) => {
          // Calculate relative position with circular wrap-around
          let diff = idx - centerIndex;
          const len = displayMangas.length;

          // Wrap diff so it lies in [-len/2, len/2]
          if (diff < -len / 2) diff += len;
          if (diff > len / 2) diff -= len;

          const absDiff = Math.abs(diff);

          // We only display the center card, up to 2 cards to the left, and 2 cards to the right (total 5 visible cards)
          if (absDiff > 2) return null;

          // Compute exact custom layout properties based on diff
          let zIndex = 30 - absDiff * 10;
          let opacity = 1;
          let scale = 1;
          let translateX = '0%';
          let rotateY = '0deg';
          let blur = '0px';

          if (diff === 0) {
            // Active Center Card
            scale = 1.05;
            translateX = '0%';
            rotateY = '0deg';
            opacity = 1;
            blur = '0px';
          } else if (diff === -1) {
            // Immediate Left Card
            scale = 0.82;
            translateX = '-50%';
            rotateY = '20deg';
            opacity = 0.8;
            blur = '0.5px';
          } else if (diff === 1) {
            // Immediate Right Card
            scale = 0.82;
            translateX = '50%';
            rotateY = '-20deg';
            opacity = 0.8;
            blur = '0.5px';
          } else if (diff === -2) {
            // Far Left Card
            scale = 0.65;
            translateX = '-95%';
            rotateY = '35deg';
            opacity = 0.45;
            blur = '1.5px';
          } else if (diff === 2) {
            // Far Right Card
            scale = 0.65;
            translateX = '95%';
            rotateY = '-35deg';
            opacity = 0.45;
            blur = '1.5px';
          }

          return (
            <div
              key={`${manga.id}-${idx}`}
              onClick={() => handleCardClick(idx, manga)}
              style={{
                zIndex,
                opacity,
                filter: `blur(${blur})`,
                transform: `translateX(${translateX}) scale(${scale}) rotateY(${rotateY})`,
                transformStyle: 'preserve-3d',
              }}
              className="absolute w-[160px] sm:w-[200px] md:w-[240px] aspect-[3/4] rounded-2xl overflow-hidden shadow-[0_15px_35px_rgba(0,0,0,0.6)] hover:shadow-brand-accent/15 cursor-pointer transition-all duration-600 ease-out select-none border border-brand-accent/10"
            >
              {/* Cover image */}
              <SmartImage
                key={manga.coverUrl}
                src={manga.coverUrl}
                alt={manga.title}
                className="w-full h-full object-cover pointer-events-none"
              />

              {/* Shading/gradient overlay to add depth to side cards */}
              <div
                className={`absolute inset-0 bg-black/30 transition-opacity duration-500 pointer-events-none ${
                  diff === 0 ? 'opacity-0' : 'opacity-80'
                }`}
              />

              {/* Bottom overlay for active card title fading upward into poster */}
              {diff === 0 && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0b0c10] via-[#0b0c10]/90 via-70% to-transparent p-4 flex flex-col justify-end text-center pt-10">
                  <span className="self-center mb-1 text-[10px] sm:text-xs font-semibold text-gray-300 font-sans tracking-wide">
                    {manga.status === 'publishing' ? 'Гарч буй' : manga.status === 'completed' ? 'Дууссан' : 'Гаргалт гүйцсэн'}
                  </span>
                  <h4 className="font-display font-extrabold text-xs sm:text-sm md:text-base text-white leading-tight truncate">
                    {manga.title}
                  </h4>
                  <p className="text-[10px] md:text-xs text-brand-accent font-mono mt-0.5 tracking-wider truncate">
                    {manga.author}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Interactive Dots Underneath (manual scrolling feedback) */}
      <div className="flex gap-1.5 z-10 pt-2">
        {displayMangas.map((_, i) => (
          <button
            key={i}
            onClick={() => setCenterIndex(i)}
            className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
              i === centerIndex
                ? 'w-6 bg-brand-accent'
                : 'w-1.5 bg-brand-text-dark/40 hover:bg-brand-accent/40'
            }`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
