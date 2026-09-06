import React from 'react';
import { Manga } from '../types';
import { BookOpen, Trash2, Heart } from 'lucide-react';
import SmartImage from './SmartImage';

interface MangaCardProps {
  key?: string;
  manga: Manga;
  latestChapterTitle?: string;
  onSelect: (manga: Manga) => void;
  canDelete: boolean;
  onDelete?: (mangaId: string) => void;
  rank?: number;
  isSaved?: boolean;
  onToggleSave?: (mangaId: string) => void;
  onCopyLink?: (manga: Manga) => void;
  readChaptersCount?: number;
  totalChaptersCount?: number;
  readPercentage?: number;
}

export default function MangaCard({
  manga,
  latestChapterTitle,
  onSelect,
  canDelete,
  onDelete,
  rank,
  isSaved,
  onToggleSave,
  onCopyLink,
  readChaptersCount,
  totalChaptersCount,
  readPercentage
}: MangaCardProps) {
  const [isConfirmingDelete, setIsConfirmingDelete] = React.useState(false);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isConfirmingDelete) {
      setIsConfirmingDelete(true);
      return;
    }
    if (onDelete) {
      onDelete(manga.id);
      setIsConfirmingDelete(false);
    }
  };

  const handleHeartClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleSave) {
      onToggleSave(manga.id);
    }
  };

  const handleCopyLinkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onCopyLink) {
      onCopyLink(manga);
    }
  };

  const getStatusLabel = (status: Manga['status']) => {
    switch (status) {
      case 'publishing':
        return 'Гарч буй';
      case 'completed':
        return 'Дууссан';
      case 'full_release':
        return 'Гаргалт гүйцсэн';
      default:
        return 'Гарч буй';
    }
  };

  const getStatusBadgeStyle = (status: Manga['status']) => {
    switch (status) {
      case 'publishing':
        return 'bg-[#1e150d] border border-amber-500/25 text-[#efa01a]';
      case 'completed':
        return 'bg-zinc-900/60 border border-zinc-700/60 text-zinc-300';
      case 'full_release':
        return 'bg-cyan-950/30 border border-cyan-500/20 text-cyan-400';
      default:
        return 'bg-[#1e150d] border border-amber-500/25 text-[#efa01a]';
    }
  };

  const getLatestChapterLabel = () => {
    if (!latestChapterTitle) return 'Бүлэггүй';
    const match = latestChapterTitle.match(/\d+(\.\d+)?/);
    if (match) {
      return `${match[0]}-р бүлэг`;
    }
    return latestChapterTitle;
  };

  return (
    <div
      id={`manga-card-${manga.id}`}
      onClick={() => onSelect(manga)}
      className="group relative bg-[#090a0d] hover:bg-[#111217] rounded-lg p-[2px] sm:p-1 flex flex-col cursor-pointer transition-all duration-300 hover:-translate-y-1 shadow-md hover:shadow-brand-accent/5 border border-transparent hover:border-brand-accent/10"
    >
      {/* Premium Large Cover Image */}
      <div className="relative aspect-[2.8/4] w-full rounded-md overflow-hidden bg-zinc-950 shadow-md">
        {/* Ranking or VIP Badge Overlay */}
        {manga.isFree === false ? (
          <div className="absolute top-2 left-2 z-10 select-none">
            <span className="bg-amber-400 text-black text-[9px] font-black px-1.5 py-0.5 rounded uppercase shadow-md flex items-center gap-0.5">
              <span>🔒</span> VIP
            </span>
          </div>
        ) : rank !== undefined && (
          <div className="absolute top-2 left-2 z-10 select-none">
            {rank === 1 ? (
              <div className="bg-[#121316]/95 border border-amber-400/40 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-lg text-[10px] sm:text-xs font-black text-amber-400 font-sans">
                <span>🥇</span>
                <span>#{rank}</span>
              </div>
            ) : rank === 2 ? (
              <div className="bg-[#121316]/95 border border-slate-300/40 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-lg text-[10px] sm:text-xs font-black text-slate-300 font-sans">
                <span>🥈</span>
                <span>#{rank}</span>
              </div>
            ) : rank === 3 ? (
              <div className="bg-[#121316]/95 border border-amber-600/40 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-lg text-[10px] sm:text-xs font-black text-amber-500 font-sans">
                <span>🥉</span>
                <span>#{rank}</span>
              </div>
            ) : (
              <div className="bg-[#121316]/90 border border-zinc-700/30 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md text-[9px] sm:text-[11px] font-bold text-zinc-300 font-sans">
                <span>#{rank}</span>
              </div>
            )}
          </div>
        )}

        {/* Top Right Action Buttons: Heart Save + Delete */}
        <div className="absolute top-1.5 right-1.5 z-10 flex items-center gap-1">
          {onToggleSave && (
            <button
              id={`manga-heart-btn-${manga.id}`}
              onClick={handleHeartClick}
              className={`p-1.5 rounded-full backdrop-blur-md border transition-all cursor-pointer shadow-md ${
                isSaved
                  ? 'bg-red-950/80 border-red-500 text-red-500 scale-105'
                  : 'bg-black/60 hover:bg-black/80 border-white/20 text-white/80 hover:text-red-400'
              }`}
              title={isSaved ? 'Хадгалснаас гаргах' : 'Хадгалах (Таалагдлаа)'}
            >
              <Heart className={`w-3.5 h-3.5 ${isSaved ? 'fill-red-500 text-red-500' : ''}`} />
            </button>
          )}

          {canDelete && onDelete && (
            isConfirmingDelete ? (
              <div className="flex items-center gap-1 bg-red-950/90 border border-red-500 rounded-full p-1 animate-fade-in shadow-lg">
                <button
                  id={`manga-confirm-delete-btn-${manga.id}`}
                  onClick={handleDeleteClick}
                  className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold rounded-full cursor-pointer"
                >
                  Устгах!
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsConfirmingDelete(false);
                  }}
                  className="px-1.5 py-0.5 text-zinc-300 hover:text-white text-[10px] font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                id={`manga-delete-btn-${manga.id}`}
                onClick={handleDeleteClick}
                className="p-1.5 bg-red-950/80 hover:bg-red-600 border border-red-500/30 hover:border-red-500 rounded-full text-red-200 hover:text-white transition-all cursor-pointer shadow-md"
                title="Манга устгах"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )
          )}
        </div>

        <SmartImage
          id={`manga-cover-${manga.id}`}
          key={manga.coverUrl}
          src={manga.coverUrl}
          alt={manga.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />

        {/* Hover overlay read icon */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="w-10 h-10 rounded-full bg-brand-accent flex items-center justify-center text-brand-bg shadow-lg transform scale-90 group-hover:scale-100 transition-all duration-300">
            <BookOpen className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Info layout directly under the poster */}
      <div className="pt-1.5 px-0.5 flex flex-col gap-0.5">
        <h3 id={`manga-title-${manga.id}`} className="font-display font-bold text-white text-[11px] sm:text-xs leading-tight line-clamp-1 group-hover:text-brand-accent transition-colors">
          {manga.title}
        </h3>
        
        {/* Row with status badge and latest chapter on 1 line total */}
        <div className="flex items-center justify-between gap-1 w-full pt-0.5">
          <span className="text-[10px] font-semibold text-brand-accent truncate max-w-[60%]" title={getLatestChapterLabel()}>
            {getLatestChapterLabel()}
          </span>
          <span
            id={`manga-status-badge-${manga.id}`}
            className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 ${getStatusBadgeStyle(manga.status)}`}
          >
            {getStatusLabel(manga.status)}
          </span>
        </div>

        {/* Visual progress bar based on percentage of chapters read */}
        {totalChaptersCount !== undefined && totalChaptersCount > 0 && (
          <div className="w-full mt-1 pt-1 border-t border-white/10 flex flex-col gap-0.5">
            <div className="flex items-center justify-between text-[8px] sm:text-[9px] font-medium px-0.5">
              <span className={`font-extrabold ${readPercentage === 100 ? 'text-emerald-400' : (readPercentage || 0) > 0 ? 'text-cyan-400' : 'text-zinc-400'}`}>
                {readPercentage === 100 ? '✓ Дууссан' : `${readPercentage || 0}% уншсан`}
              </span>
              <span className="text-zinc-400 font-bold">{readChaptersCount || 0}/{totalChaptersCount}</span>
            </div>
            <div className="w-full h-1.5 bg-zinc-900/90 rounded-full overflow-hidden border border-white/10 p-[0.5px]">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  readPercentage === 100 
                    ? 'bg-gradient-to-r from-emerald-500 to-cyan-400 shadow-[0_0_6px_rgba(16,185,129,0.5)]' 
                    : (readPercentage || 0) > 0 
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-500 shadow-[0_0_6px_rgba(6,182,212,0.5)]' 
                      : 'bg-zinc-700/40'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, readPercentage || 0))}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
