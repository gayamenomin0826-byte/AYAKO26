import React, { useState } from 'react';
import { 
  Tv, Film, PlusCircle, Trash2, ArrowLeft, Search, Eye, Heart, 
  Play, ChevronLeft, ChevronRight, CheckCircle2, Lock, Sparkles, MessageSquare, Edit3, X, Video,
  CheckSquare, Square, Crown, Layers, Plus
} from 'lucide-react';
import { MovieItem, MovieEpisode, User } from '../types';
import SmartImage from './SmartImage';

interface MoviesSectionProps {
  movies: MovieItem[];
  episodes: MovieEpisode[];
  currentUser: User | null;
  onAddMovie: (movie: MovieItem) => Promise<void> | void;
  onUpdateMovie?: (movie: MovieItem) => Promise<void> | void;
  onDeleteMovie: (id: string) => Promise<void> | void;
  onAddEpisode: (ep: MovieEpisode) => Promise<void> | void;
  onDeleteEpisode: (id: string) => Promise<void> | void;
  onDeleteEpisodesBatch?: (ids: string[]) => Promise<void> | void;
  onBackToHome: () => void;
  selectedMovie: MovieItem | null;
  setSelectedMovie: (movie: MovieItem | null) => void;
  activeEpisode: MovieEpisode | null;
  setActiveEpisode: (ep: MovieEpisode | null) => void;
  isFreeSiteMode?: boolean;
  onOpenVipPlans?: () => void;
  allGenres?: string[];
  onAddGenre?: (genre: string) => void;
}

const DEFAULT_FALLBACK_COVER = 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80';

export default function MoviesSection({
  movies,
  episodes,
  currentUser,
  onAddMovie,
  onUpdateMovie,
  onDeleteMovie,
  onAddEpisode,
  onDeleteEpisode,
  onDeleteEpisodesBatch,
  onBackToHome,
  selectedMovie,
  setSelectedMovie,
  activeEpisode,
  setActiveEpisode,
  isFreeSiteMode = false,
  onOpenVipPlans,
  allGenres = ['Анимэ', 'Action', 'Fantasy', 'Supernatural', 'Comedy', 'Drama', 'Romance', 'Sci-Fi', 'School', 'Adventure'],
  onAddGenre
}: MoviesSectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [specialFilter, setSpecialFilter] = useState<'all' | 'free' | 'paid' | 'top' | 'most_viewed'>('all');

  // Modals state
  const [isAddMovieModalOpen, setIsAddMovieModalOpen] = useState(false);
  const [editingMovie, setEditingMovie] = useState<MovieItem | null>(null);
  const [isAddEpisodeModalOpen, setIsAddEpisodeModalOpen] = useState(false);

  // New/Edit Movie Form
  const [movieTitle, setMovieTitle] = useState('');
  const [movieDesc, setMovieDesc] = useState('');
  const [movieCover, setMovieCover] = useState('');
  const [movieType, setMovieType] = useState<'Анимэ' | 'Кино' | 'Олон ангит'>('Анимэ');
  const [movieStatus, setMovieStatus] = useState<'publishing' | 'completed'>('publishing');
  const [movieIsFree, setMovieIsFree] = useState<boolean>(true);
  const [movieGenres, setMovieGenres] = useState<string>('Анимэ, Action, Fantasy');
  const [newGenreInput, setNewGenreInput] = useState('');

  // Episode Selection for Batch Delete
  const [selectedEpisodeIds, setSelectedEpisodeIds] = useState<string[]>([]);

  // New Episode Form
  const [epTitle, setEpTitle] = useState('');
  const [epNum, setEpNum] = useState<number>(1);
  const [epVideoUrl, setEpVideoUrl] = useState('');
  const [epIsVip, setEpIsVip] = useState(false);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';

  // VIP Check helper
  const isVipUser = currentUser?.role === 'admin' || currentUser?.role === 'super_admin' || (!!currentUser?.vipUntil && new Date(currentUser.vipUntil) > new Date());

  // Check if content requires VIP in current site mode
  const isMovieAccessLocked = (movie: MovieItem) => {
    if (isFreeSiteMode) return false; // Site is in free mode -> all content free
    if (isVipUser) return false;
    return movie.isFree === false; // If explicitly marked as paid
  };

  const isEpisodeAccessLocked = (movie: MovieItem, episode: MovieEpisode) => {
    if (isFreeSiteMode) return false;
    if (isVipUser) return false;
    if (movie.isFree === false) return true;
    return episode.isVip || episode.isFree === false;
  };

  // Filtered movies list
  const filteredMovies = movies.filter(movie => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = movie.title.toLowerCase().includes(q);
      const matchDesc = movie.description?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc) return false;
    }
    if (selectedGenre !== 'all') {
      if (!movie.genres || !movie.genres.includes(selectedGenre)) return false;
    }
    if (specialFilter === 'free') {
      if (movie.isFree === false) return false;
    }
    if (specialFilter === 'paid') {
      if (movie.isFree !== false) return false;
    }
    return true;
  });

  const sortedMovies = [...filteredMovies].sort((a, b) => {
    if (specialFilter === 'most_viewed') return (b.views || 0) - (a.views || 0);
    if (specialFilter === 'top') return (b.likes || 0) - (a.likes || 0);
    return 0;
  });

  // Movie specific episodes
  const currentMovieEpisodes = selectedMovie
    ? episodes.filter(e => e.movieId === selectedMovie.id).sort((a, b) => a.episodeNumber - b.episodeNumber)
    : [];

  const handleOpenAddMovie = () => {
    setEditingMovie(null);
    setMovieTitle('');
    setMovieDesc('');
    setMovieCover('');
    setMovieType('Анимэ');
    setMovieStatus('publishing');
    setMovieIsFree(true);
    setMovieGenres('Анимэ, Action, Fantasy');
    setIsAddMovieModalOpen(true);
  };

  const handleOpenEditMovie = (movie: MovieItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingMovie(movie);
    setMovieTitle(movie.title);
    setMovieDesc(movie.description || '');
    setMovieCover(movie.coverUrl || '');
    setMovieType(movie.type || 'Анимэ');
    setMovieStatus(movie.status || 'publishing');
    setMovieIsFree(movie.isFree !== false);
    setMovieGenres(movie.genres ? movie.genres.join(', ') : 'Анимэ');
    setIsAddMovieModalOpen(true);
  };

  const handleSaveMovieForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movieTitle.trim()) return;

    const genreList = movieGenres.split(',').map(g => g.trim()).filter(Boolean);

    if (editingMovie) {
      const updated: MovieItem = {
        ...editingMovie,
        title: movieTitle.trim(),
        description: movieDesc.trim(),
        coverUrl: movieCover.trim() || DEFAULT_FALLBACK_COVER,
        genres: genreList,
        status: movieStatus,
        type: movieType,
        isFree: movieIsFree,
        updatedAt: new Date().toISOString()
      };
      if (onUpdateMovie) {
        await onUpdateMovie(updated);
      }
      if (selectedMovie?.id === editingMovie.id) {
        setSelectedMovie(updated);
      }
    } else {
      const newMov: MovieItem = {
        id: `mov_${Date.now()}`,
        title: movieTitle.trim(),
        description: movieDesc.trim(),
        coverUrl: movieCover.trim() || DEFAULT_FALLBACK_COVER,
        genres: genreList,
        status: movieStatus,
        type: movieType,
        isFree: movieIsFree,
        views: 0,
        likes: 0,
        createdAt: new Date().toISOString()
      };
      await onAddMovie(newMov);
    }

    setIsAddMovieModalOpen(false);
    setEditingMovie(null);
  };

  const handleAddNewGenre = () => {
    if (!newGenreInput.trim()) return;
    const cleanG = newGenreInput.trim();
    if (onAddGenre) onAddGenre(cleanG);
    if (!movieGenres.includes(cleanG)) {
      setMovieGenres(movieGenres ? `${movieGenres}, ${cleanG}` : cleanG);
    }
    setNewGenreInput('');
  };

  const handleSaveNewEpisode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMovie || !epTitle.trim() || !epVideoUrl.trim()) return;

    const newEp: MovieEpisode = {
      id: `ep_${Date.now()}`,
      movieId: selectedMovie.id,
      title: epTitle.trim(),
      episodeNumber: epNum || currentMovieEpisodes.length + 1,
      videoUrl: epVideoUrl.trim(),
      isVip: epIsVip,
      isFree: !epIsVip,
      createdAt: new Date().toISOString()
    };

    await onAddEpisode(newEp);
    setIsAddEpisodeModalOpen(false);
    setEpTitle('');
    setEpVideoUrl('');
    setEpNum(currentMovieEpisodes.length + 2);
  };

  // Batch Episode Selection
  const toggleSelectEpisode = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedEpisodeIds.includes(id)) {
      setSelectedEpisodeIds(selectedEpisodeIds.filter(i => i !== id));
    } else {
      setSelectedEpisodeIds([...selectedEpisodeIds, id]);
    }
  };

  const handleSelectAllEpisodes = () => {
    if (selectedEpisodeIds.length === currentMovieEpisodes.length) {
      setSelectedEpisodeIds([]);
    } else {
      setSelectedEpisodeIds(currentMovieEpisodes.map(e => e.id));
    }
  };

  const handleBatchDeleteEpisodes = async () => {
    if (selectedEpisodeIds.length === 0) return;
    if (!confirm(`${selectedEpisodeIds.length} ангийг нэгэн зэрэг устгахдаа итгэлтэй байна уу?`)) return;

    if (onDeleteEpisodesBatch) {
      await onDeleteEpisodesBatch(selectedEpisodeIds);
    } else {
      for (const id of selectedEpisodeIds) {
        await onDeleteEpisode(id);
      }
    }
    setSelectedEpisodeIds([]);
  };

  // Episode Video Navigation
  const activeEpIndex = currentMovieEpisodes.findIndex(e => e.id === activeEpisode?.id);
  const prevEp = activeEpIndex > 0 ? currentMovieEpisodes[activeEpIndex - 1] : null;
  const nextEp = activeEpIndex >= 0 && activeEpIndex < currentMovieEpisodes.length - 1 ? currentMovieEpisodes[activeEpIndex + 1] : null;

  // Direct MP4 / Video file detector
  const isDirectVideo = (url: string) => {
    if (!url) return false;
    return url.match(/\.(mp4|webm|ogg|m3u8)(\?.*)?$/i) || url.includes('pixeldrain.com/api/file/');
  };

  // Clean Embed URL Parser for External Hosting (YouTube, Google Drive, OK.ru, Vimeo, etc.)
  const getEmbedUrl = (rawUrl: string) => {
    if (!rawUrl) return '';
    let url = rawUrl.trim();

    // YouTube Parser
    if (url.includes('youtube.com/watch') || url.includes('youtu.be/') || url.includes('youtube.com/embed/') || url.includes('youtube.com/shorts/')) {
      let ytId = '';
      const vMatch = url.match(/[?&]v=([\w-]{11})/);
      if (vMatch) ytId = vMatch[1];
      else {
        const pathMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/|live\/))([\w-]{11})/i);
        if (pathMatch) ytId = pathMatch[1];
      }
      if (ytId) {
        return `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&modestbranding=1&rel=0&playsinline=1`;
      }
    }

    // Google Drive Parser
    if (url.includes('drive.google.com')) {
      const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        return `https://drive.google.com/file/d/${match[1]}/preview`;
      }
    }

    // OK.ru Video Parser
    if (url.includes('ok.ru/video/')) {
      const match = url.match(/ok\.ru\/video\/(\d+)/);
      if (match && match[1]) {
        return `https://ok.ru/videoembed/${match[1]}`;
      }
    }

    // Vimeo Parser
    if (url.includes('vimeo.com/')) {
      const match = url.match(/vimeo\.com\/(\d+)/);
      if (match && match[1]) {
        return `https://player.vimeo.com/video/${match[1]}?autoplay=1`;
      }
    }

    // Dailymotion Parser
    if (url.includes('dailymotion.com/video/')) {
      const match = url.match(/dailymotion\.com\/video\/([a-zA-Z0-9]+)/);
      if (match && match[1]) {
        return `https://www.dailymotion.com/embed/video/${match[1]}`;
      }
    }

    // PixelDrain Parser
    if (url.includes('pixeldrain.com/u/')) {
      return url.replace('pixeldrain.com/u/', 'pixeldrain.com/api/file/');
    }

    return url;
  };

  // ==================== 1. WATCH EPISODE VIDEO PLAYER VIEW ====================
  if (selectedMovie && activeEpisode) {
    const isLocked = isEpisodeAccessLocked(selectedMovie, activeEpisode);

    return (
      <div id="video-player-container" className="max-w-6xl mx-auto px-2 sm:px-4 py-4 sm:py-8 space-y-6 animate-fade-in">
        {/* Top Navigation Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-brand-card/80 border border-brand-accent/15 p-3 sm:p-4 rounded-2xl shadow-xl">
          <button
            onClick={() => setActiveEpisode(null)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-bg hover:bg-brand-accent/10 border border-brand-accent/20 text-brand-accent rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{selectedMovie.title} - Бүх ангиуд</span>
          </button>

          <div className="text-center flex-1 min-w-[200px]">
            <h2 className="font-display font-extrabold text-sm sm:text-base text-white truncate flex items-center justify-center gap-2">
              <span>{selectedMovie.title}</span>
              {selectedMovie.isFree === false && (
                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] rounded-full uppercase">
                  VIP
                </span>
              )}
            </h2>
            <p className="text-xs text-cyan-400 font-mono font-semibold">
              {activeEpisode.title}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {prevEp && (
              <button
                onClick={() => setActiveEpisode(prevEp)}
                className="flex items-center gap-1 px-3 py-1.5 bg-brand-bg hover:bg-cyan-500/20 text-cyan-300 rounded-xl text-xs font-bold border border-cyan-500/30 transition-all cursor-pointer"
                title="Өмнөх анги"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Өмнөх</span>
              </button>
            )}
            {nextEp && (
              <button
                onClick={() => setActiveEpisode(nextEp)}
                className="flex items-center gap-1 px-3 py-1.5 bg-cyan-400 text-black font-extrabold rounded-xl text-xs hover:bg-cyan-300 shadow-md shadow-cyan-400/20 transition-all cursor-pointer"
                title="Дараагийн анги"
              >
                <span className="hidden sm:inline">Дараагийн</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Video Player Display Screen */}
        <div className="relative aspect-video w-full bg-black rounded-3xl overflow-hidden border border-cyan-500/30 shadow-2xl shadow-cyan-500/10 flex items-center justify-center group">
          {isLocked ? (
            <div className="p-6 text-center space-y-4 max-w-md animate-fade-in bg-gradient-to-b from-amber-950/40 via-black to-black w-full h-full flex flex-col items-center justify-center border border-amber-500/30">
              <div className="w-16 h-16 rounded-3xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 mx-auto shadow-2xl shadow-amber-500/20">
                <Lock className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="font-serif italic font-extrabold text-xl text-amber-300">
                  Зөвхөн VIP уншигчид үзэх боломжтой
                </h3>
                <p className="text-xs text-brand-text-dark leading-relaxed">
                  Энэхүү кино / анги нь VIP эрхтэй гишүүдэд зориулагдсан байна. Та VIP багц идэвхжүүлснээр шууд үзэх боломжтой.
                </p>
              </div>
              {onOpenVipPlans && (
                <button
                  onClick={onOpenVipPlans}
                  className="px-6 py-3 bg-gradient-to-r from-amber-400 to-amber-500 text-black font-black text-xs rounded-2xl shadow-xl shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-2"
                >
                  <Crown className="w-4 h-4" />
                  <span>VIP Эрх Авах (Үнэ үзэх)</span>
                </button>
              )}
            </div>
          ) : isDirectVideo(activeEpisode.videoUrl) ? (
            <video
              src={activeEpisode.videoUrl}
              controls
              autoPlay
              controlsList="nodownload"
              poster={activeEpisode.posterUrl || selectedMovie.coverUrl}
              className="w-full h-full object-contain"
            />
          ) : (
            <iframe
              src={getEmbedUrl(activeEpisode.videoUrl)}
              title={activeEpisode.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="w-full h-full border-0 object-cover"
            />
          )}
        </div>

        {/* Episode Navigation Buttons Grid */}
        <div className="bg-[#0b0c0e] border border-cyan-500/15 p-4 sm:p-6 rounded-3xl shadow-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-cyan-500/10 pb-3 flex-wrap gap-2">
            <h3 className="font-display font-extrabold text-sm sm:text-base text-white flex items-center gap-2">
              <Video className="w-5 h-5 text-cyan-400" />
              <span>Ангиуд ({currentMovieEpisodes.length})</span>
            </h3>

            {isAdmin && (
              <div className="flex items-center gap-2">
                {selectedEpisodeIds.length > 0 && (
                  <button
                    onClick={handleBatchDeleteEpisodes}
                    className="text-xs bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 transition-all cursor-pointer shadow-lg shadow-red-500/20"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Сонгосон ({selectedEpisodeIds.length}) ангийг устгах</span>
                  </button>
                )}
                <button
                  onClick={handleSelectAllEpisodes}
                  className="text-xs bg-brand-card hover:bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 transition-all cursor-pointer"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>{selectedEpisodeIds.length === currentMovieEpisodes.length ? 'Бүгдийг болих' : 'Бүгдийг сонгох'}</span>
                </button>
                <button
                  onClick={() => setIsAddEpisodeModalOpen(true)}
                  className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/40 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 hover:bg-amber-500/30 cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Анги Нэмэх</span>
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
            {currentMovieEpisodes.map(ep => {
              const isActive = ep.id === activeEpisode.id;
              const isSelected = selectedEpisodeIds.includes(ep.id);
              const epLocked = isEpisodeAccessLocked(selectedMovie, ep);

              return (
                <div
                  key={ep.id}
                  onClick={() => setActiveEpisode(ep)}
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between relative group ${
                    isActive
                      ? 'bg-cyan-400 text-black border-cyan-300 font-extrabold shadow-lg shadow-cyan-400/20'
                      : 'bg-brand-card/60 hover:bg-brand-card border-brand-accent/15 text-brand-text hover:border-cyan-400/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase font-mono tracking-wider opacity-80">
                      {ep.episodeNumber}-р анги
                    </span>

                    <div className="flex items-center gap-1">
                      {epLocked && (
                        <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                      )}
                      {ep.isVip && (
                        <span className="text-[8px] px-1 py-0.2 bg-amber-400 text-black font-black rounded uppercase">
                          VIP
                        </span>
                      )}
                      {isAdmin && (
                        <button
                          onClick={(e) => toggleSelectEpisode(ep.id, e)}
                          className="p-1 rounded hover:bg-black/20"
                          title="Сонгох"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-cyan-300 fill-cyan-950" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-400 opacity-60 hover:opacity-100" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs font-bold truncate">{ep.title}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ==================== 2. MOVIE DETAIL VIEW ====================
  if (selectedMovie) {
    const isLocked = isMovieAccessLocked(selectedMovie);

    return (
      <div id="movie-detail-container" className="max-w-6xl mx-auto px-2 sm:px-4 py-6 sm:py-10 space-y-8 animate-fade-in">
        {/* Back button and Admin Controls */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <button
            onClick={() => setSelectedMovie(null)}
            className="px-4 py-2 bg-brand-card hover:bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Бусад кинонууд руу буцах</span>
          </button>

          {isAdmin && (
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => handleOpenEditMovie(selectedMovie, e)}
                className="px-3.5 py-2 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-lg"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Мэдээлэл / Постер засах</span>
              </button>
              <button
                onClick={() => {
                  if (confirm(`"${selectedMovie.title}" киног устгах уу?`)) {
                    onDeleteMovie(selectedMovie.id);
                    setSelectedMovie(null);
                  }
                }}
                className="px-3 py-2 bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Устгах</span>
              </button>
            </div>
          )}
        </div>

        {/* Movie Info Hero Banner */}
        <div className="bg-[#0b0c0e] border border-cyan-500/20 rounded-3xl p-4 sm:p-8 shadow-2xl flex flex-col md:flex-row gap-6 md:gap-8 items-start relative overflow-hidden">
          {/* Cover Poster */}
          <div className="w-full md:w-64 aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl relative shrink-0 border border-cyan-500/20">
            <SmartImage
              src={selectedMovie.coverUrl}
              fallbackSrc={DEFAULT_FALLBACK_COVER}
              alt={selectedMovie.title}
              className="w-full h-full object-cover"
            />
            {selectedMovie.type && (
              <span className="absolute top-3 left-3 bg-cyan-400 text-black font-extrabold text-xs px-2.5 py-1 rounded-lg uppercase shadow-lg">
                {selectedMovie.type}
              </span>
            )}
            {selectedMovie.isFree === false && (
              <span className="absolute top-3 right-3 bg-amber-400 text-black font-extrabold text-xs px-2.5 py-1 rounded-lg uppercase shadow-lg flex items-center gap-1">
                <Crown className="w-3.5 h-3.5" />
                <span>VIP</span>
              </span>
            )}
          </div>

          {/* Movie Metadata */}
          <div className="flex-1 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                  selectedMovie.status === 'completed' 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' 
                    : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                }`}>
                  {selectedMovie.status === 'completed' ? 'Дууссан' : 'Гарч буй'}
                </span>

                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                  selectedMovie.isFree === false
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                }`}>
                  {selectedMovie.isFree === false ? '🔒 Төлбөртэй (VIP)' : '🎁 Үнэгүй'}
                </span>
              </div>

              <h1 className="font-serif italic font-extrabold text-2xl sm:text-4xl text-white tracking-wide leading-tight">
                {selectedMovie.title}
              </h1>
            </div>

            {/* Genres pills */}
            {selectedMovie.genres && selectedMovie.genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedMovie.genres.map((g, idx) => (
                  <span key={idx} className="px-2.5 py-1 bg-brand-card border border-brand-accent/15 text-cyan-300 text-xs font-semibold rounded-lg">
                    {g}
                  </span>
                ))}
              </div>
            )}

            {/* Description */}
            <p className="text-sm text-brand-text-dark leading-relaxed font-sans">
              {selectedMovie.description || 'Тайлбар одоогоор оруулаагүй байна.'}
            </p>

            {/* Views & Likes */}
            <div className="flex items-center gap-6 pt-2 text-xs font-mono text-brand-text-dark border-t border-brand-accent/10">
              <span className="flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-cyan-400" />
                <span>{selectedMovie.views || 0} үзсэн</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Heart className="w-4 h-4 text-rose-400" />
                <span>{selectedMovie.likes || 0} таалагдсан</span>
              </span>
            </div>
          </div>
        </div>

        {/* Episodes Section */}
        <div className="bg-[#0b0c0e] border border-cyan-500/15 p-4 sm:p-6 rounded-3xl shadow-2xl space-y-5">
          <div className="flex items-center justify-between border-b border-cyan-500/10 pb-4 flex-wrap gap-2">
            <h2 className="font-display font-extrabold text-base sm:text-xl text-white flex items-center gap-2">
              <Play className="w-5 h-5 text-cyan-400 fill-cyan-400" />
              <span>Ангиудын жагсаалт ({currentMovieEpisodes.length})</span>
            </h2>

            {isAdmin && (
              <div className="flex items-center gap-2">
                {selectedEpisodeIds.length > 0 && (
                  <button
                    onClick={handleBatchDeleteEpisodes}
                    className="px-3.5 py-2 bg-red-600 hover:bg-red-500 text-white font-extrabold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-red-500/20"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Сонгосон ({selectedEpisodeIds.length}) устгах</span>
                  </button>
                )}
                <button
                  onClick={handleSelectAllEpisodes}
                  className="px-3.5 py-2 bg-brand-card hover:bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-extrabold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <CheckSquare className="w-4 h-4" />
                  <span>{selectedEpisodeIds.length === currentMovieEpisodes.length ? 'Болих' : 'Сонгох'}</span>
                </button>
                <button
                  onClick={() => setIsAddEpisodeModalOpen(true)}
                  className="px-3.5 py-2 bg-cyan-400 hover:bg-cyan-300 text-black font-extrabold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-cyan-400/20"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Шинэ Анги Нэмэх</span>
                </button>
              </div>
            )}
          </div>

          {currentMovieEpisodes.length === 0 ? (
            <div className="py-12 text-center text-brand-text-dark space-y-2 bg-brand-card/30 rounded-2xl border border-brand-accent/5">
              <Tv className="w-10 h-10 text-cyan-400/30 mx-auto" />
              <p className="text-sm">Одоогоор бичлэг эсвэл анги оруулаагүй байна.</p>
              {isAdmin && (
                <button
                  onClick={() => setIsAddEpisodeModalOpen(true)}
                  className="mt-2 text-xs text-cyan-400 font-bold hover:underline cursor-pointer"
                >
                  + Эхний ангийг одоо нэмэх
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {currentMovieEpisodes.map(ep => {
                const epLocked = isEpisodeAccessLocked(selectedMovie, ep);
                const isSelected = selectedEpisodeIds.includes(ep.id);

                return (
                  <div
                    key={ep.id}
                    onClick={() => setActiveEpisode(ep)}
                    className={`p-3.5 bg-brand-card/60 hover:bg-brand-card border border-brand-accent/15 hover:border-cyan-400/50 rounded-2xl transition-all cursor-pointer flex items-center justify-between group relative ${
                      isSelected ? 'ring-2 ring-cyan-400 bg-cyan-950/30' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className="w-9 h-9 rounded-xl bg-cyan-950/80 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 group-hover:bg-cyan-400 group-hover:text-black transition-all">
                        {epLocked ? (
                          <Lock className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Play className="w-4 h-4 fill-current ml-0.5" />
                        )}
                      </div>
                      <div className="overflow-hidden">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-extrabold text-white truncate group-hover:text-cyan-300 transition-colors">
                            {ep.title}
                          </p>
                          {ep.isVip && (
                            <span className="text-[8px] px-1 py-0.2 bg-amber-400 text-black font-black rounded uppercase">
                              VIP
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-brand-text-dark font-mono">
                          {ep.episodeNumber}-р анги
                        </span>
                      </div>
                    </div>

                    {isAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => toggleSelectEpisode(ep.id, e)}
                          className="p-1 rounded hover:bg-black/20"
                          title="Сонгох"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-cyan-300 fill-cyan-950" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-400 opacity-60 hover:opacity-100" />
                          )}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`"${ep.title}" ангийг устгах уу?`)) {
                              onDeleteEpisode(ep.id);
                            }
                          }}
                          className="p-1.5 text-red-400/60 hover:text-red-400 hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer"
                          title="Анги устгах"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal: Add Episode */}
        {isAddEpisodeModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-[#121316] border border-cyan-500/30 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-cyan-500/10 pb-3">
                <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                  <PlusCircle className="w-5 h-5 text-cyan-400" />
                  <span>Шинэ анги оруулах</span>
                </h3>
                <button onClick={() => setIsAddEpisodeModalOpen(false)} className="text-brand-text-dark hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveNewEpisode} className="space-y-4 text-xs">
                <div>
                  <label className="block text-brand-text font-bold mb-1">Ангийн нэр:</label>
                  <input
                    type="text"
                    value={epTitle}
                    onChange={(e) => setEpTitle(e.target.value)}
                    placeholder="1-р анги - Эхлэл"
                    required
                    className="w-full p-2.5 bg-brand-bg border border-brand-accent/20 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-brand-text font-bold mb-1">Ангийн дугаар (тоо):</label>
                  <input
                    type="number"
                    value={epNum}
                    onChange={(e) => setEpNum(Number(e.target.value))}
                    required
                    className="w-full p-2.5 bg-brand-bg border border-brand-accent/20 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-brand-text font-bold mb-1">Агуулгын төрөл:</label>
                  <select
                    value={epIsVip ? 'paid' : 'free'}
                    onChange={(e) => setEpIsVip(e.target.value === 'paid')}
                    className="w-full p-2.5 bg-brand-bg border border-brand-accent/20 rounded-xl text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
                  >
                    <option value="free">🎁 Үнэгүй анги</option>
                    <option value="paid">🔒 VIP / Төлбөртэй анги</option>
                  </select>
                </div>

                <div>
                  <label className="block text-brand-text font-bold mb-1">Бичлэгийн эх сурвалж (Video URL / Embed Link):</label>
                  <input
                    type="url"
                    value={epVideoUrl}
                    onChange={(e) => setEpVideoUrl(e.target.value)}
                    placeholder="Direct MP4 URL, YouTube link, Google Drive, OK.ru, Vimeo"
                    required
                    className="w-full p-2.5 bg-brand-bg border border-brand-accent/20 rounded-xl text-white focus:outline-none focus:border-cyan-400 font-mono text-[11px]"
                  />
                  <p className="text-[10px] text-brand-text-dark mt-1">
                    Direct MP4 эсвэл YouTube, Google Drive, OK.ru, Vimeo embed холбоос оруулж болно.
                  </p>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddEpisodeModalOpen(false)}
                    className="px-4 py-2 bg-brand-card text-brand-text rounded-xl font-bold"
                  >
                    Цуцлах
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-cyan-400 text-black rounded-xl font-extrabold shadow-lg shadow-cyan-400/20"
                  >
                    Хадгалах
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==================== 3. MOVIES MAIN CATALOG GRID VIEW ====================
  return (
    <div id="movies-catalog-container" className="max-w-7xl mx-auto px-2 sm:px-4 py-6 sm:py-10 space-y-8 animate-fade-in">
      {/* Title & Navigation */}
      <div className="flex items-center justify-between border-b border-cyan-500/10 pb-4">
        <div className="flex items-center gap-2.5 text-cyan-400 font-serif italic font-extrabold text-lg sm:text-2xl">
          <Tv className="w-6 h-6 sm:w-7 sm:h-7 text-cyan-400" />
          <span>Кино & Анимэ хэсэг</span>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              onClick={handleOpenAddMovie}
              className="px-3.5 py-2 bg-cyan-400 hover:bg-cyan-300 text-black font-extrabold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer shadow-lg shadow-cyan-400/20"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Шинэ Кино Нэмэх</span>
            </button>
          )}
          <button
            onClick={onBackToHome}
            className="px-3 py-1.5 bg-brand-card hover:bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Нүүр хуудас</span>
          </button>
        </div>
      </div>

      {/* Featured / Filter Buttons Bar */}
      <div className="bg-[#0b0c0e] border border-cyan-500/10 p-4 sm:p-6 rounded-3xl shadow-2xl space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 shadow-lg shadow-cyan-500/10">
            <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <h3 className="font-serif italic font-extrabold text-base sm:text-xl text-cyan-300 tracking-wide glow-text">
              Шилдэг Анимэ & Кинонууд
            </h3>
            <p className="text-[10px] sm:text-xs text-brand-text-dark font-medium leading-tight">
              Бүх анги, бичлэгүүдийг өндөр чанартайгаар шууд үзэх
            </p>
          </div>
        </div>

        {/* Filter Quick Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3">
          <button
            onClick={() => setSpecialFilter('all')}
            className={`relative overflow-hidden h-14 sm:h-16 rounded-2xl flex items-center justify-center transition-all cursor-pointer p-2 active:scale-95 ${
              specialFilter === 'all'
                ? 'bg-gradient-to-br from-cyan-400 to-[#0096c7] text-[#0b0b0f] font-black shadow-lg shadow-cyan-500/30 ring-2 ring-cyan-300'
                : 'bg-[#121316] border border-cyan-500/10 hover:border-cyan-400/30 text-brand-text-dark hover:text-brand-text'
            }`}
          >
            <span className="text-center text-[10px] sm:text-xs font-sans font-bold leading-tight">
              🎬 Бүх кинонууд
            </span>
          </button>

          <button
            onClick={() => setSpecialFilter('free')}
            className={`relative overflow-hidden h-14 sm:h-16 rounded-2xl flex items-center justify-center transition-all cursor-pointer p-2 active:scale-95 ${
              specialFilter === 'free'
                ? 'bg-gradient-to-br from-emerald-400 to-teal-600 text-black font-black shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-300'
                : 'bg-[#121316] border border-cyan-500/10 hover:border-emerald-400/30 text-emerald-400'
            }`}
          >
            <span className="text-center text-[10px] sm:text-xs font-sans font-bold leading-tight">
              🎁 Үнэгүй кино
            </span>
          </button>

          <button
            onClick={() => setSpecialFilter('paid')}
            className={`relative overflow-hidden h-14 sm:h-16 rounded-2xl flex items-center justify-center transition-all cursor-pointer p-2 active:scale-95 ${
              specialFilter === 'paid'
                ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-black font-black shadow-lg shadow-amber-500/30 ring-2 ring-amber-300'
                : 'bg-[#121316] border border-cyan-500/10 hover:border-amber-400/30 text-amber-300'
            }`}
          >
            <span className="text-center text-[10px] sm:text-xs font-sans font-bold leading-tight">
              🔒 VIP / Төлбөртэй
            </span>
          </button>

          <button
            onClick={() => setSpecialFilter('top')}
            className={`relative overflow-hidden h-14 sm:h-16 rounded-2xl flex items-center justify-center transition-all cursor-pointer p-2 active:scale-95 ${
              specialFilter === 'top'
                ? 'bg-gradient-to-br from-cyan-400 to-[#0096c7] text-[#0b0b0f] font-black shadow-lg shadow-cyan-500/30 ring-2 ring-cyan-300'
                : 'bg-[#121316] border border-cyan-500/10 hover:border-cyan-400/30 text-brand-text-dark hover:text-brand-text'
            }`}
          >
            <span className="text-center text-[10px] sm:text-xs font-sans font-bold leading-tight">
              🔥 Хамгийн шилдэг
            </span>
          </button>

          <button
            onClick={() => setSpecialFilter('most_viewed')}
            className={`relative overflow-hidden h-14 sm:h-16 rounded-2xl flex items-center justify-center transition-all cursor-pointer p-2 active:scale-95 ${
              specialFilter === 'most_viewed'
                ? 'bg-gradient-to-br from-cyan-400 to-[#0096c7] text-[#0b0b0f] font-black shadow-lg shadow-cyan-500/30 ring-2 ring-cyan-300'
                : 'bg-[#121316] border border-cyan-500/10 hover:border-cyan-400/30 text-brand-text-dark hover:text-brand-text'
            }`}
          >
            <span className="text-center text-[10px] sm:text-xs font-sans font-bold leading-tight">
              👁️ Олон үзэлттэй
            </span>
          </button>
        </div>
      </div>

      {/* Genre Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-brand-card/60 p-3 rounded-2xl border border-brand-accent/10">
        {/* Genre Tags */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none w-full sm:w-auto py-1">
          <button
            onClick={() => setSelectedGenre('all')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              selectedGenre === 'all'
                ? 'bg-cyan-400 text-black'
                : 'bg-brand-bg text-brand-text-dark hover:text-white'
            }`}
          >
            Бүгд
          </button>
          {allGenres.map(g => (
            <button
              key={g}
              onClick={() => setSelectedGenre(g)}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedGenre === g
                  ? 'bg-cyan-400 text-black'
                  : 'bg-brand-bg text-brand-text-dark hover:text-white'
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-60">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-text-dark" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Кино хайх..."
            className="w-full pl-8 pr-3 py-1.5 bg-brand-bg border border-brand-accent/15 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-400"
          />
        </div>
      </div>

      {/* Movies Grid */}
      {sortedMovies.length === 0 ? (
        <div className="py-20 text-center text-brand-text-dark space-y-2 bg-brand-card/40 rounded-3xl border border-brand-accent/5">
          <Tv className="w-12 h-12 text-cyan-400/30 mx-auto" />
          <p className="text-sm">Тохирох кино олдсонгүй.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-5">
          {sortedMovies.map(movie => {
            const movEps = episodes.filter(e => e.movieId === movie.id);
            const isLocked = isMovieAccessLocked(movie);

            return (
              <div
                key={movie.id}
                onClick={() => setSelectedMovie(movie)}
                className="bg-brand-card/40 hover:bg-brand-card border border-brand-accent/10 hover:border-cyan-400/50 rounded-2xl overflow-hidden shadow-lg transition-all cursor-pointer group flex flex-col justify-between relative"
              >
                <div>
                  <div className="aspect-[3/4] relative overflow-hidden">
                    <SmartImage
                      src={movie.coverUrl}
                      fallbackSrc={DEFAULT_FALLBACK_COVER}
                      alt={movie.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {movie.type && (
                      <span className="absolute top-2 left-2 bg-black/80 backdrop-blur-xs text-cyan-300 text-[9px] font-extrabold px-2 py-0.5 rounded uppercase">
                        {movie.type}
                      </span>
                    )}

                    {movie.isFree === false ? (
                      <span className="absolute top-2 right-2 bg-amber-400 text-black font-black text-[9px] px-2 py-0.5 rounded uppercase flex items-center gap-0.5 shadow-md">
                        <Lock className="w-2.5 h-2.5" />
                        <span>VIP</span>
                      </span>
                    ) : (
                      <span className="absolute top-2 right-2 bg-emerald-500 text-black font-black text-[9px] px-2 py-0.5 rounded uppercase shadow-md">
                        FREE
                      </span>
                    )}

                    <span className="absolute bottom-2 right-2 bg-black/80 text-white font-mono text-[9px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                      <Video className="w-3 h-3 text-cyan-400" />
                      <span>{movEps.length} анги</span>
                    </span>

                    {isAdmin && (
                      <button
                        onClick={(e) => handleOpenEditMovie(movie, e)}
                        className="absolute bottom-2 left-2 p-1.5 bg-amber-500/80 hover:bg-amber-400 text-black rounded-lg transition-all cursor-pointer shadow-md"
                        title="Мэдээлэл засах"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="p-3 space-y-1">
                    <h4 className="font-extrabold text-xs sm:text-sm text-white line-clamp-1 group-hover:text-cyan-400 transition-colors">
                      {movie.title}
                    </h4>
                    <p className="text-[10px] text-brand-text-dark line-clamp-2 leading-tight">
                      {movie.description}
                    </p>
                  </div>
                </div>

                <div className="px-3 pb-3 pt-1 flex items-center justify-between text-[10px] font-mono text-brand-text-dark border-t border-brand-accent/5">
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3 text-cyan-400" />
                    <span>{movie.views || 0}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Heart className="w-3 h-3 text-rose-400" />
                    <span>{movie.likes || 0}</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Add or Edit Movie */}
      {isAddMovieModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#121316] border border-cyan-500/30 w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-cyan-500/10 pb-3">
              <h3 className="font-extrabold text-base text-white flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-cyan-400" />
                <span>{editingMovie ? 'Киноны мэдээлэл засах' : 'Шинэ Кино / Анимэ нэмэх'}</span>
              </h3>
              <button onClick={() => setIsAddMovieModalOpen(false)} className="text-brand-text-dark hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMovieForm} className="space-y-4 text-xs">
              <div>
                <label className="block text-brand-text font-bold mb-1">Нэр:</label>
                <input
                  type="text"
                  value={movieTitle}
                  onChange={(e) => setMovieTitle(e.target.value)}
                  placeholder="Заавал бичнэ үү"
                  required
                  className="w-full p-2.5 bg-brand-bg border border-brand-accent/20 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-brand-text font-bold mb-1">Төрөл:</label>
                  <select
                    value={movieType}
                    onChange={(e) => setMovieType(e.target.value as any)}
                    className="w-full p-2.5 bg-brand-bg border border-brand-accent/20 rounded-xl text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
                  >
                    <option value="Анимэ">Анимэ</option>
                    <option value="Кино">Кино</option>
                    <option value="Олон ангит">Олон ангит</option>
                  </select>
                </div>

                <div>
                  <label className="block text-brand-text font-bold mb-1">Төлөв:</label>
                  <select
                    value={movieStatus}
                    onChange={(e) => setMovieStatus(e.target.value as any)}
                    className="w-full p-2.5 bg-brand-bg border border-brand-accent/20 rounded-xl text-white focus:outline-none focus:border-cyan-400 cursor-pointer"
                  >
                    <option value="publishing">Гарч буй</option>
                    <option value="completed">Дууссан</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-brand-text font-bold mb-1">Агуулгын төрөл (Нэвтрэх эрх):</label>
                <select
                  value={movieIsFree ? 'free' : 'paid'}
                  onChange={(e) => setMovieIsFree(e.target.value === 'free')}
                  className="w-full p-2.5 bg-brand-bg border border-brand-accent/20 rounded-xl text-white focus:outline-none focus:border-cyan-400 cursor-pointer font-bold"
                >
                  <option value="free">🎁 Үнэгүй (Бүх хэрэглэгч шууд үзнэ)</option>
                  <option value="paid">🔒 Төлбөртэй (Сайт төлбөртэй үед зөвхөн VIP үзнэ)</option>
                </select>
              </div>

              <div>
                <label className="block text-brand-text font-bold mb-1">Жанрууд (Таслалаар тусгаарлана):</label>
                <input
                  type="text"
                  value={movieGenres}
                  onChange={(e) => setMovieGenres(e.target.value)}
                  placeholder="Анимэ, Action, Fantasy"
                  className="w-full p-2.5 bg-brand-bg border border-brand-accent/20 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                />

                {/* Add new genre quick input */}
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="text"
                    value={newGenreInput}
                    onChange={(e) => setNewGenreInput(e.target.value)}
                    placeholder="Шинэ жанр нэмэх..."
                    className="flex-1 p-2 bg-brand-bg border border-brand-accent/20 rounded-xl text-white text-[11px] focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    type="button"
                    onClick={handleAddNewGenre}
                    className="px-3 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 font-bold rounded-xl text-[11px] flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Нэмэх</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-brand-text font-bold mb-1">Постер Зургийн URL:</label>
                <input
                  type="url"
                  value={movieCover}
                  onChange={(e) => setMovieCover(e.target.value)}
                  placeholder="https://..."
                  className="w-full p-2.5 bg-brand-bg border border-brand-accent/20 rounded-xl text-white focus:outline-none focus:border-cyan-400 font-mono text-[11px]"
                />
              </div>

              <div>
                <label className="block text-brand-text font-bold mb-1">Тайлбар:</label>
                <textarea
                  value={movieDesc}
                  onChange={(e) => setMovieDesc(e.target.value)}
                  rows={3}
                  className="w-full p-2.5 bg-brand-bg border border-brand-accent/20 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddMovieModalOpen(false)}
                  className="px-4 py-2 bg-brand-card text-brand-text rounded-xl font-bold"
                >
                  Цуцлах
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-cyan-400 text-black rounded-xl font-extrabold shadow-lg shadow-cyan-400/20 cursor-pointer"
                >
                  {editingMovie ? 'Шинэчлэх' : 'Кино Нэмэх'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
