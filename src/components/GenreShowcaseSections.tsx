import React, { useState } from 'react';
import { Manga } from '../types';
import MangaCard from './MangaCard';
import { Heart, Zap, Sparkles, X, ChevronRight, BookOpen } from 'lucide-react';

interface GenreShowcaseSectionsProps {
  mangas: Manga[];
  latestChaptersMap: Record<string, string>;
  onSelectManga: (manga: Manga) => void;
  canDelete: boolean;
  onDeleteManga?: (mangaId: string) => void;
  savedMangaIds?: string[];
  onToggleSave?: (mangaId: string) => void;
  onCopyLink?: (manga: Manga) => void;
}

interface GenreConfig {
  key: 'romance' | 'action' | 'yaoi';
  title: string;
  subtitle: string;
  badge: string;
  icon: React.ElementType;
  colorClass: string;
  bgGlow: string;
  borderClass: string;
}

export default function GenreShowcaseSections({
  mangas,
  latestChaptersMap,
  onSelectManga,
  canDelete,
  onDeleteManga,
  savedMangaIds,
  onToggleSave,
  onCopyLink,
}: GenreShowcaseSectionsProps) {
  const [selectedGenreModal, setSelectedGenreModal] = useState<{
    key: string;
    title: string;
    mangas: Manga[];
  } | null>(null);

  const GENRE_CONFIGS: GenreConfig[] = [
    {
      key: 'romance',
      title: 'Romance (Романс)',
      subtitle: 'Сэтгэл хөдөлгөм хайр дурлалын шилдэг өгүүлэмжүүд',
      badge: 'Хайр дурлал',
      icon: Heart,
      colorClass: 'text-rose-400',
      bgGlow: 'bg-rose-500/10 border-rose-500/30',
      borderClass: 'border-rose-500/20',
    },
    {
      key: 'action',
      title: 'Action (Адал явдалт)',
      subtitle: 'Шигүү тулаан, адал явдалт, баатарлаг түүхүүд',
      badge: 'Адал явдал',
      icon: Zap,
      colorClass: 'text-amber-400',
      bgGlow: 'bg-amber-500/10 border-amber-500/30',
      borderClass: 'border-amber-500/20',
    },
    {
      key: 'yaoi',
      title: 'Yaoi (Яой / BL)',
      subtitle: 'Сонирхолтой романтик ба мэдрэмжтэй өгүүлэмжүүд',
      badge: 'BL / Yaoi',
      icon: Sparkles,
      colorClass: 'text-purple-400',
      bgGlow: 'bg-purple-500/10 border-purple-500/30',
      borderClass: 'border-purple-500/20',
    },
  ];

  const getFilteredMangas = (genreKey: string): Manga[] => {
    const filtered = mangas.filter((m) => {
      if (!m) return false;
      const genresLower = Array.isArray(m.genres) ? m.genres.map((g) => String(g || '').toLowerCase()) : [];
      if (genreKey === 'romance') {
        return genresLower.some((g) => g.includes('romance') || g.includes('романс'));
      }
      if (genreKey === 'action') {
        return genresLower.some(
          (g) => g.includes('action') || g.includes('адал') || g.includes('тулаан')
        );
      }
      if (genreKey === 'yaoi') {
        return (
          genresLower.some(
            (g) => g.includes('yaoi') || g.includes('яой') || g.includes('bl')
          ) || String(m.type || '').toLowerCase() === 'bl'
        );
      }
      return false;
    });

    // Fallback: if database has very few tagged items, include first few mangas so UI looks rich
    if (filtered.length === 0) {
      return mangas.slice(0, 6);
    }
    return filtered;
  };

  if (!mangas || mangas.length === 0) {
    return null;
  }

  return (
    <div id="genre-showcase-sections" className="space-y-6 pt-2">
      {GENRE_CONFIGS.map((config) => {
        const genreMangas = getFilteredMangas(config.key);
        const IconComponent = config.icon;

        return (
          <div
            key={config.key}
            className="bg-[#0b0c0e] p-3.5 sm:p-5 rounded-3xl space-y-3.5 relative overflow-hidden"
          >
            {/* Header with Title and "Бүгд" button */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 sm:w-11 sm:h-11 rounded-2xl border flex items-center justify-center shrink-0 shadow-md ${config.bgGlow} ${config.colorClass}`}
                >
                  <IconComponent className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className={`font-serif italic font-extrabold text-base sm:text-xl tracking-wide ${config.colorClass}`}>
                      {config.title}
                    </h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700">
                      {genreMangas.length}
                    </span>
                  </div>
                  <p className="text-[10px] sm:text-xs text-brand-text-dark font-medium leading-tight">
                    {config.subtitle}
                  </p>
                </div>
              </div>

              {/* "Бүгд ▶" Button */}
              <button
                type="button"
                onClick={() =>
                  setSelectedGenreModal({
                    key: config.key,
                    title: config.title,
                    mangas: genreMangas,
                  })
                }
                className="text-xs sm:text-sm font-bold text-cyan-400 hover:text-cyan-300 bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/30 px-3 py-1.5 rounded-xl transition-all cursor-pointer shrink-0 flex items-center gap-1 active:scale-95"
              >
                <span>Бүгд</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Horizontal Scrollable Row */}
            <div className="flex overflow-x-auto gap-2.5 sm:gap-4 pb-2 pt-1 scrollbar-none snap-x custom-scrollbar">
              {genreMangas.map((manga) => (
                <div key={manga.id} className="w-28 sm:w-40 shrink-0 snap-start">
                  <MangaCard
                    manga={manga}
                    latestChapterTitle={latestChaptersMap[manga.id]}
                    onSelect={onSelectManga}
                    canDelete={canDelete}
                    onDelete={onDeleteManga}
                    isSaved={savedMangaIds?.includes(manga.id)}
                    onToggleSave={onToggleSave}
                    onCopyLink={onCopyLink}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* "Бүгд" Grid View Modal (3 columns on phone, 5 columns on desktop) */}
      {selectedGenreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="bg-[#0b0c0e] border border-cyan-500/30 rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-zinc-800/80 flex items-center justify-between bg-[#12141a]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-serif italic font-extrabold text-base sm:text-xl text-cyan-200">
                      {selectedGenreModal.title}
                    </h3>
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                      Нийт: {selectedGenreModal.mangas.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Утас дээр 3-н баганаар, компьютер дээр 5-н баганаар харагдана
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedGenreModal(null)}
                className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Grid (3 columns mobile, 5 columns desktop) */}
            <div className="p-3 sm:p-6 overflow-y-auto custom-scrollbar flex-1">
              <div className="grid grid-cols-3 md:grid-cols-5 gap-2 sm:gap-4">
                {selectedGenreModal.mangas.map((manga) => (
                  <MangaCard
                    key={manga.id}
                    manga={manga}
                    latestChapterTitle={latestChaptersMap[manga.id]}
                    onSelect={(m) => {
                      onSelectManga(m);
                      setSelectedGenreModal(null);
                    }}
                    canDelete={canDelete}
                    onDelete={onDeleteManga}
                    isSaved={savedMangaIds?.includes(manga.id)}
                    onToggleSave={onToggleSave}
                    onCopyLink={onCopyLink}
                  />
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 border-t border-zinc-800/80 bg-[#12141a] flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedGenreModal(null)}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
              >
                Хаах
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
