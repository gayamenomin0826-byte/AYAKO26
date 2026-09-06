import React, { useState, useEffect } from 'react';

export const revalidate = 0;
export const dynamic = 'force-dynamic';
import { User, Manga, Chapter, VipRequest, SalaryConfig, Employee, UserRole, MovieItem, MovieEpisode } from './types';
import { ShieldAlert } from 'lucide-react';
import {
  INITIAL_MANGAS,
  INITIAL_EMPLOYEES,
  INITIAL_CHAPTERS,
  DEFAULT_SALARY_CONFIG,
  INITIAL_USERS,
  DEFAULT_GENRES,
  INITIAL_MOVIES,
  INITIAL_MOVIE_EPISODES
} from './data';
import { DEFAULT_FALLBACK_IMAGE, uploadSingleImageToCloud, uploadSingleVideoToCloud, uploadGifToCloud, compressImageFile, compressVideoFile, compressAudioFile, saveLocalVideoToIDB, getLocalVideoFromIDB, clearLocalVideoFromIDB, getCachedVideoUrlSync } from './utils/imageUpload';
import {
  getStoredMangas,
  getStoredChapters,
  subscribeToMangas,
  subscribeToChapters,
  subscribeToUsers,
  subscribeToVipRequests,
  subscribeToSiteConfig,
  subscribeToGenres,
  subscribeToMovies,
  subscribeToMovieEpisodes,
  forceSyncWithFirestoreServer,
  incrementMangaViewsInDb,
  incrementMangaLikesInDb,
  getChapterFromDb,
  parseTimestamp,
  addGenreToDb,
  deleteGenreFromDb,
  saveSiteConfigToDb,
  BankConfig,
  addMangaToDb,
  updateMangaInDb,
  deleteMangaFromDb,
  addChapterToDb,
  updateChapterInDb,
  deleteChapterFromDb,
  deleteChaptersBatchFromDb,
  saveUserToDb,
  addVipRequestToDb,
  updateVipRequestInDb,
  deleteVipRequestFromDb,
  addMovieToDb,
  updateMovieInDb,
  deleteMovieFromDb,
  addMovieEpisodeToDb,
  deleteMovieEpisodeFromDb,
  deleteMovieEpisodesBatchFromDb,
  subscribeToAuth,
  logoutFromFirebase
} from './firebase';

import { AnimatePresence, motion } from 'motion/react';
import Header from './components/Header';
import MangaCard from './components/MangaCard';
import SmartImage from './components/SmartImage';
import ChapterReader from './components/ChapterReader';
import MoviesSection from './components/MoviesSection';
import AdminPanel from './components/AdminPanel';
import FinancialPanel from './components/FinancialPanel';
import VipPanel from './components/VipPanel';
import UserProfile from './components/UserProfile';
import UsersPanel from './components/UsersPanel';
import AuthModal from './components/AuthModal';
import FeaturedCarousel from './components/FeaturedCarousel';
import { PopularThisWeekChart } from './components/PopularThisWeekChart';
import { ScreenProtection } from './components/ScreenProtection';
import BannerCropperModal from './components/BannerCropperModal';
import GenreShowcaseSections from './components/GenreShowcaseSections';
import ThemeSettingsPanel from './components/ThemeSettingsPanel';
import { applyThemeColor } from './utils/theme';

import { Sparkles, Search, BookOpen, User as UserIcon, Award, Heart, Eye, X, TrendingUp, MoreVertical, UserCheck, Wallet, Compass, Settings, Tags, Plus, Trash2, Clock, Trophy, Medal, ArrowLeft, Crown, Camera, Loader2, Volume2, VolumeX, Palette, Edit2, Music, Link as LinkIcon, Kanban } from 'lucide-react';

const safeSetLocalStorage = (key: string, valueOrObj: any) => {
  try {
    if (valueOrObj === undefined || valueOrObj === null) return;
    let strVal = typeof valueOrObj === 'string' ? valueOrObj : JSON.stringify(valueOrObj);
    if (!strVal || strVal.startsWith('blob:') || strVal.length > 3000000) {
      return;
    }
    localStorage.setItem(key, strVal);
  } catch (err) {
    console.warn(`localStorage setItem failed for ${key}:`, err);
  }
};

export function getTimeAgo(timestampString?: string | number): string {
  if (!timestampString) return 'Дөнгөж сая';
  const ts = parseTimestamp(timestampString);
  if (!ts || isNaN(ts) || ts <= 0) return 'Дөнгөж сая';
  
  const now = Date.now();
  const diffSec = Math.floor((now - ts) / 1000);
  
  if (diffSec < 60) return 'Дөнгөж сая';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}мин өмнө`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}ц өмнө`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}д өмнө`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)}д.х өмнө`;
  
  const d = new Date(ts);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

const computeNewVipDate = (currentVipUntil: string | null | undefined, durationText: string): string => {
  const duration = (durationText || '').trim().toLowerCase();

  // Check for unlimited / lifetime / хязгааргүй / үүрд
  if (
    duration.includes('хязгааргүй') ||
    duration.includes('unlimited') ||
    duration.includes('насан туршийн') ||
    duration.includes('хугацаагүй') ||
    duration.includes('үүрд') ||
    duration.includes('2100')
  ) {
    return '2100-01-01T00:00:00.000Z';
  }

  const now = new Date();
  let baseDate = new Date();
  if (currentVipUntil) {
    const currentVip = new Date(currentVipUntil);
    if (currentVip.getFullYear() >= 2090) {
      return '2100-01-01T00:00:00.000Z';
    }
    if (currentVip > now) {
      baseDate = new Date(currentVip.getTime());
    }
  }

  if (duration.includes('жилийн') || duration.includes('жил') || duration.includes('year')) {
    const years = parseInt(duration) || 1;
    baseDate.setFullYear(baseDate.getFullYear() + years);
  } else if (duration.includes('хоног')) {
    const days = parseInt(duration) || 1;
    baseDate.setDate(baseDate.getDate() + days);
  } else if (duration.includes('сар')) {
    const months = parseInt(duration) || 1;
    baseDate.setMonth(baseDate.getMonth() + months);
  } else {
    // Default fallback 1 month
    baseDate.setMonth(baseDate.getMonth() + 1);
  }

  return baseDate.toISOString();
};

export default function App() {
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((current) => (current === msg ? null : current));
    }, 3000);
  };

  const getSiteConfigCache = () => {
    if (typeof window !== 'undefined' && window.__INITIAL_DATA__?.siteConfig) {
      return window.__INITIAL_DATA__.siteConfig;
    }
    try {
      const saved = localStorage.getItem('ayako_siteConfig');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  };

  // State initialization with localStorage persistence
  const [siteName, setSiteName] = useState<string>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('ayako_siteName') : null;
    if (saved && saved !== 'AYAKO MANGA' && saved !== 'АЯАКО') return saved;
    const cached = getSiteConfigCache();
    if (cached?.siteName && cached.siteName !== 'AYAKO MANGA' && cached.siteName !== 'АЯАКО') return cached.siteName;
    if (saved && saved !== 'AYAKO MANGA') return saved;
    if (cached?.siteName && cached.siteName !== 'AYAKO MANGA') return cached.siteName;
    return 'MISORA';
  });

  const [allUsers, setAllUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('ayako_users');
    if (!saved) return [];
    try {
      const parsed: User[] = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.filter(u => u && u.id !== '11112222' && u.id !== '77777777') : [];
    } catch {
      return [];
    }
  });

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('ayako_currentUser');
    if (!saved) return null;
    try {
      const parsed: User = JSON.parse(saved);
      const emailLower = parsed.email?.toLowerCase();
      if (emailLower === 'g.ayamenomin0826@gmail.com' || emailLower === 'misoraclan@gmail.com') {
        return { ...parsed, role: 'super_admin' };
      }
      return parsed;
    } catch {
      return null;
    }
  });

  const [mangas, setMangas] = useState<Manga[]>(() => {
    const local = getStoredMangas();
    if (local && local.length > 0) {
      return local;
    }
    if (typeof window !== 'undefined' && window.__INITIAL_DATA__?.mangas && window.__INITIAL_DATA__.mangas.length > 0) {
      return window.__INITIAL_DATA__.mangas.filter(m => m && m.title !== 'ёсч' && !String(m.id || '').startsWith('manga-'));
    }
    return [];
  });
  const [chapters, setChapters] = useState<Chapter[]>(() => {
    const local = getStoredChapters();
    if (local && local.length > 0) {
      return local;
    }
    if (typeof window !== 'undefined' && window.__INITIAL_DATA__?.chapters && window.__INITIAL_DATA__.chapters.length > 0) {
      return window.__INITIAL_DATA__.chapters.filter(c => c && !String(c.id || '').startsWith('ch-'));
    }
    return [];
  });

  const [employees, setEmployees] = useState<Employee[]>(() => {
    const saved = localStorage.getItem('ayako_employees');
    if (!saved) return INITIAL_EMPLOYEES;
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : INITIAL_EMPLOYEES;
    } catch {
      return INITIAL_EMPLOYEES;
    }
  });

  const [vipRequests, setVipRequests] = useState<VipRequest[]>(() => {
    const saved = localStorage.getItem('ayako_vipRequests');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // fallback
      }
    }
    return [];
  });

  const [salaryConfig, setSalaryConfig] = useState<SalaryConfig>(() => {
    const saved = localStorage.getItem('ayako_salary_config');
    if (!saved) return DEFAULT_SALARY_CONFIG;
    try {
      return JSON.parse(saved);
    } catch {
      return DEFAULT_SALARY_CONFIG;
    }
  });

  const [isMoviesTabEnabled, setIsMoviesTabEnabled] = useState<boolean>(() => {
    const cached = getSiteConfigCache();
    if (cached?.isMoviesTabEnabled !== undefined) return Boolean(cached.isMoviesTabEnabled);
    const saved = localStorage.getItem('ayako_is_movies_enabled');
    if (saved !== null) return saved === 'true';
    return true;
  });

  const [movies, setMovies] = useState<MovieItem[]>(() => {
    const saved = localStorage.getItem('ayako_movies');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [movieEpisodes, setMovieEpisodes] = useState<MovieEpisode[]>(() => {
    const saved = localStorage.getItem('ayako_movie_episodes');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [selectedMovie, setSelectedMovie] = useState<MovieItem | null>(null);
  const [activeMovieEpisode, setActiveMovieEpisode] = useState<MovieEpisode | null>(null);

  const [vipPlans, setVipPlans] = useState(() => {
    const saved = localStorage.getItem('ayako_vip_plans');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch {
        // fallback
      }
    }
    return [
      { id: '1d', label: '1 хоног', price: 1000, desc: 'Туршилтын богино хугацаа' },
      { id: '7d', label: '7 хоног', price: 5000, desc: '1 долоо хоногийн эрх' },
      { id: '1m', label: '1 сар', price: 15000, desc: 'Стандарт 30 хоногийн эрх' },
      { id: '2m', label: '2 сар', price: 27000, desc: '10% хэмнэлттэй багц' },
      { id: '3m', label: '3 сар', price: 38000, desc: '16% хэмнэлттэй багц' },
      { id: '6m', label: '6 сар', price: 70000, desc: '22% хэмнэлттэй багц' },
      { id: '12m', label: '12 сар', price: 120000, desc: '33% хэмнэлттэй багц' },
      { id: 'unlimited', label: 'Хязгааргүй', price: 250000, desc: 'Хугацаагүй үүрд унших эрх' }
    ];
  });

  useEffect(() => {
    safeSetLocalStorage('ayako_vip_plans', vipPlans);
  }, [vipPlans]);

  const [activeTab, setActiveTab] = useState<string>('home');
  const [selectedManga, setSelectedManga] = useState<Manga | null>(null);
  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [adminForceAdd, setAdminForceAdd] = useState(false);
  const [isAddMangaModalOpen, setIsAddMangaModalOpen] = useState(false);
  const [catalogPage, setCatalogPage] = useState<number>(1);
  const CATALOG_PAGE_SIZE = 15;

  const DEFAULT_HOME_BANNER = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1600&auto=format&fit=crop&q=80';

  const [homeBannerMediaType, setHomeBannerMediaType] = useState<'video' | 'image' | 'gif'>(() => {
    const cached = getSiteConfigCache();
    if (cached?.homeBannerMediaType === 'video' || cached?.homeBannerMediaType === 'image' || cached?.homeBannerMediaType === 'gif') {
      return cached.homeBannerMediaType;
    }
    const saved = localStorage.getItem('ayako_homeBannerMediaType');
    if (saved === 'video' || saved === 'image' || saved === 'gif') return saved;
    return 'image';
  });

  const isVideoUrl = (url?: string): boolean => {
    if (!url) return false;
    const lower = url.toLowerCase().trim();
    if (lower.startsWith('data:video/')) return true;
    if (lower.startsWith('data:image/')) return false;

    if (/\.(jpg|jpeg|png|gif|webp|svg|bmp|avif)($|\?)/i.test(lower)) return false;
    if (/\.(mp4|webm|ogg|mov|m4v)($|\?)/i.test(lower)) return true;

    if (homeBannerMediaType === 'gif' || homeBannerMediaType === 'image') return false;
    if (homeBannerMediaType === 'video') return true;

    if (lower.startsWith('blob:')) {
      return homeBannerMediaType === 'video';
    }
    return false;
  };

  const getYouTubeVideoId = (url?: string): string | null => {
    if (!url) return null;
    const trimmed = url.trim();
    // 1. Check v= query parameter first (youtube.com/watch?v=ID, music.youtube.com/watch?v=ID, etc.)
    const vMatch = trimmed.match(/[?&]v=([\w-]{11})/);
    if (vMatch) return vMatch[1];
    // 2. Check path based URLs (youtu.be/ID, embed/ID, shorts/ID, live/ID)
    const pathMatch = trimmed.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/|live\/)|music\.youtube\.com\/watch\?v=)([\w-]{11})/i);
    if (pathMatch) return pathMatch[1];
    return null;
  };

  const formatDirectAudioUrl = (url: string): string => {
    if (!url) return '';
    let trimmed = url.trim();
    const ytId = getYouTubeVideoId(trimmed);
    if (ytId) {
      return `https://www.youtube.com/watch?v=${ytId}`;
    }
    if (trimmed.includes('drive.google.com')) {
      const match = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/) || trimmed.match(/id=([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        return `https://drive.google.com/uc?export=download&id=${match[1]}`;
      }
    }
    if (trimmed.includes('dropbox.com')) {
      return trimmed.replace('dl=0', 'dl=1').replace('www.dropbox.com', 'dl.dropboxusercontent.com');
    }
    if (trimmed.includes('pixeldrain.com/u/')) {
      return trimmed.replace('pixeldrain.com/u/', 'pixeldrain.com/api/file/');
    }
    if (trimmed.includes('vocaroo.com/')) {
      const match = trimmed.match(/vocaroo\.com\/(?:embed\/|)([\w-]+)/i);
      if (match && match[1]) {
        return `https://media.vocaroo.com/mp3/${match[1]}`;
      }
    }
    return trimmed;
  };

  const [homeBannerUrl, setHomeBannerUrl] = useState<string>(() => {
    const syncCached = getCachedVideoUrlSync('ayako_homeBannerVideo');
    if (syncCached) return syncCached;
    const cached = getSiteConfigCache();
    if (cached?.homeBannerUrl && cached.homeBannerUrl !== 'idb:video' && !cached.homeBannerUrl.startsWith('blob:')) {
      return cached.homeBannerUrl;
    }
    const saved = localStorage.getItem('ayako_homeBannerUrl');
    if (saved && saved !== 'idb:video' && !saved.startsWith('blob:')) {
      return saved;
    }
    return DEFAULT_HOME_BANNER;
  });
  const [homeBannerAudioUrl, setHomeBannerAudioUrl] = useState<string>(() => {
    const syncCached = getCachedVideoUrlSync('ayako_homeBannerAudio');
    if (syncCached) return syncCached;
    const cached = getSiteConfigCache();
    if (cached?.homeBannerAudioUrl !== undefined && cached.homeBannerAudioUrl !== 'idb:audio' && !cached.homeBannerAudioUrl.startsWith('blob:')) {
      return cached.homeBannerAudioUrl;
    }
    const saved = localStorage.getItem('ayako_homeBannerAudioUrl');
    if (saved && saved !== 'idb:audio' && !saved.startsWith('blob:')) {
      return saved;
    }
    return '';
  });
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [cropperFile, setCropperFile] = useState<File | null>(null);
  const [isCropperOpen, setIsCropperOpen] = useState<boolean>(false);
  const bannerVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const bannerAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const [isBannerMuted, setIsBannerMuted] = useState<boolean>(false);
  const lastLocalUploadTimeRef = React.useRef<number>(0);
  const lastLocalAudioUploadTimeRef = React.useRef<number>(0);

  // Cover Banner Customizable Title & Subtitle State
  const [bannerTitle, setBannerTitle] = useState<string>(() => {
    const cached = getSiteConfigCache();
    if (cached?.bannerTitle) return cached.bannerTitle;
    return localStorage.getItem('ayako_bannerTitle') || 'MANGA';
  });
  const [bannerSubtitle, setBannerSubtitle] = useState<string>(() => {
    const cached = getSiteConfigCache();
    if (cached?.bannerSubtitle) return cached.bannerSubtitle;
    return localStorage.getItem('ayako_bannerSubtitle') || 'Манга, Махвхуа, Комиксыг хамгийн хурднаар орчуулан хүргэж байна';
  });
  const [isEditingBannerText, setIsEditingBannerText] = useState(false);
  const [editTitleInput, setEditTitleInput] = useState('');
  const [editSubtitleInput, setEditSubtitleInput] = useState('');

  const handleSaveBannerText = async () => {
    const newTitle = editTitleInput.trim() || 'MANGA';
    const newSubtitle = editSubtitleInput.trim() || 'Манга, Махвхуа, Комиксыг хамгийн хурднаар орчуулан хүргэж байна';

    setBannerTitle(newTitle);
    setBannerSubtitle(newSubtitle);
    safeSetLocalStorage('ayako_bannerTitle', newTitle);
    safeSetLocalStorage('ayako_bannerSubtitle', newSubtitle);

    await saveSiteConfigToDb({
      bannerTitle: newTitle,
      bannerSubtitle: newSubtitle
    });

    setIsEditingBannerText(false);
  };

  useEffect(() => {
    const saved = localStorage.getItem('ayako_homeBannerUrl');
    if (saved === 'idb:video' || !saved || isVideoUrl(saved)) {
      getLocalVideoFromIDB('ayako_homeBannerVideo').then((idbUrl) => {
        if (idbUrl) {
          setHomeBannerUrl(idbUrl);
        }
      });
    }

    const savedAudio = localStorage.getItem('ayako_homeBannerAudioUrl');
    if (savedAudio === 'idb:audio' || !savedAudio) {
      getLocalVideoFromIDB('ayako_homeBannerAudio').then((idbUrl) => {
        if (idbUrl) {
          setHomeBannerAudioUrl(idbUrl);
        }
      });
    }
  }, []);

  const isUserExplicitlyMutedRef = React.useRef<boolean>(false);
  const hasUnblockedRef = React.useRef<boolean>(false);
  const youtubeIframeRef = React.useRef<HTMLIFrameElement | null>(null);

  const toggleBannerAudio = () => {
    const nextMuted = !isBannerMuted;
    isUserExplicitlyMutedRef.current = nextMuted;
    setIsBannerMuted(nextMuted);
    if (bannerVideoRef.current) {
      bannerVideoRef.current.muted = nextMuted;
      if (!nextMuted && bannerVideoRef.current.paused) {
        bannerVideoRef.current.play().catch(() => {});
      }
    }
    if (bannerAudioRef.current) {
      bannerAudioRef.current.muted = nextMuted;
      if (!nextMuted) {
        if (bannerAudioRef.current.paused) {
          bannerAudioRef.current.play().then(() => {
            setIsBannerMuted(false);
          }).catch((err) => {
            console.warn("Audio toggle play failed:", err);
          });
        }
      }
    }
    const ytId = getYouTubeVideoId(homeBannerAudioUrl);
    if (ytId && youtubeIframeRef.current) {
      try {
        const command = nextMuted ? 'mute' : 'unMute';
        youtubeIframeRef.current.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func: command, args: [] }),
          '*'
        );
        youtubeIframeRef.current.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func: nextMuted ? 'pauseVideo' : 'playVideo', args: [] }),
          '*'
        );
      } catch (e) {}
    }
  };

  useEffect(() => {
    const video = bannerVideoRef.current;
    const audio = bannerAudioRef.current;

    const isMovieActive = activeTab === 'movies' || !!selectedMovie || !!activeMovieEpisode;
    const shouldMute = !!(selectedManga || activeChapter || isMovieActive || isBannerMuted);

    if (video) {
      video.muted = shouldMute;
      if (video.paused && !shouldMute) {
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            video.muted = true;
            video.play().catch(() => {});
          });
        }
      }
    }

    if (audio) {
      audio.muted = shouldMute;
      if (!shouldMute) {
        if (audio.paused) {
          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise.catch(() => {
              setIsBannerMuted(true);
              audio.muted = true;
              audio.play().catch(() => {});
            });
          }
        }
      } else if (selectedManga || activeChapter || isMovieActive) {
        audio.pause();
      }
    }

    const ytId = getYouTubeVideoId(homeBannerAudioUrl);
    if (ytId && youtubeIframeRef.current) {
      try {
        const command = shouldMute ? 'mute' : 'unMute';
        youtubeIframeRef.current.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func: command, args: [] }),
          '*'
        );
        if (shouldMute) {
          youtubeIframeRef.current.contentWindow?.postMessage(
            JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }),
            '*'
          );
        }
      } catch (e) {}
    }
  }, [isBannerMuted, homeBannerUrl, homeBannerAudioUrl, selectedManga, activeChapter, selectedMovie, activeMovieEpisode, activeTab]);

  // First-user-interaction unblock listener for modern browser autoplay policies (mobile & desktop)
  useEffect(() => {
    function cleanupListeners() {
      window.removeEventListener('click', unblockAudioOnInteraction);
      window.removeEventListener('touchstart', unblockAudioOnInteraction);
      window.removeEventListener('touchend', unblockAudioOnInteraction);
      window.removeEventListener('pointerdown', unblockAudioOnInteraction);
      window.removeEventListener('keydown', unblockAudioOnInteraction);
      window.removeEventListener('scroll', unblockAudioOnInteraction);
      window.removeEventListener('mousemove', unblockAudioOnInteraction);
      window.removeEventListener('wheel', unblockAudioOnInteraction);
    }

    function unblockAudioOnInteraction(e?: Event) {
      if (hasUnblockedRef.current) {
        cleanupListeners();
        return;
      }

      if (!isUserExplicitlyMutedRef.current) {
        if (bannerAudioRef.current && homeBannerAudioUrl) {
          if (!selectedManga && !activeChapter && activeTab !== 'movies' && !selectedMovie && !activeMovieEpisode) {
            bannerAudioRef.current.muted = false;
            bannerAudioRef.current.play().then(() => {
              setIsBannerMuted(false);
              hasUnblockedRef.current = true;
              cleanupListeners();
            }).catch(() => {});
          }
        }

        const ytId = getYouTubeVideoId(homeBannerAudioUrl);
        if (ytId && youtubeIframeRef.current) {
          try {
            const win = youtubeIframeRef.current.contentWindow;
            if (win) {
              const sendCmd = () => {
                if (activeTab === 'movies' || selectedMovie || activeMovieEpisode || selectedManga || activeChapter) return;
                win.postMessage(JSON.stringify({ event: 'command', func: 'unMute', args: [] }), '*');
                win.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*');
              };
              sendCmd();
              setTimeout(sendCmd, 300);
              setTimeout(sendCmd, 800);
              setIsBannerMuted(false);
            }
          } catch (err) {}
        }

        if (bannerVideoRef.current && homeBannerUrl && isVideoUrl(homeBannerUrl)) {
          if (!selectedManga && !activeChapter && activeTab !== 'movies' && !selectedMovie && !activeMovieEpisode && bannerVideoRef.current.paused) {
            bannerVideoRef.current.muted = false;
            setIsBannerMuted(false);
            bannerVideoRef.current.play().catch(() => {});
          }
        }

        if (e) {
          hasUnblockedRef.current = true;
          cleanupListeners();
        }
      }
    }

    // On mount: attempt silent unmuted play immediately
    if (bannerAudioRef.current && homeBannerAudioUrl && !selectedManga && !activeChapter) {
      bannerAudioRef.current.muted = false;
      bannerAudioRef.current.play().then(() => {
        setIsBannerMuted(false);
        hasUnblockedRef.current = true;
        cleanupListeners();
      }).catch(() => {
        // Browser blocked unmuted autoplay - listeners handle first gesture
      });
    }

    if (!hasUnblockedRef.current) {
      window.addEventListener('click', unblockAudioOnInteraction, { passive: true });
      window.addEventListener('touchstart', unblockAudioOnInteraction, { passive: true });
      window.addEventListener('touchend', unblockAudioOnInteraction, { passive: true });
      window.addEventListener('pointerdown', unblockAudioOnInteraction, { passive: true });
      window.addEventListener('keydown', unblockAudioOnInteraction, { passive: true });
      window.addEventListener('scroll', unblockAudioOnInteraction, { passive: true });
      window.addEventListener('mousemove', unblockAudioOnInteraction, { passive: true });
      window.addEventListener('wheel', unblockAudioOnInteraction, { passive: true });
    }

    return () => {
      cleanupListeners();
    };
  }, [homeBannerAudioUrl, homeBannerUrl, selectedManga, activeChapter]);

  const handleBannerFileSelect = async (file: File) => {
    if (!currentUser || (currentUser.role !== 'super_admin' && currentUser.role !== 'admin')) return;

    const isVideo = file.type.startsWith('video/') || file.name.match(/\.(mp4|webm|ogg|mov|m4v)$/i);

    if (isVideo) {
      try {
        setIsUploadingBanner(true);
        setHomeBannerMediaType('video');
        safeSetLocalStorage('ayako_homeBannerMediaType', 'video');
        lastLocalUploadTimeRef.current = Date.now();

        // Purge old cached video & save new file Blob in IDB for instant uploader preview
        clearLocalVideoFromIDB('ayako_homeBannerVideo');
        const objectUrl = await saveLocalVideoToIDB('ayako_homeBannerVideo', file);

        setHomeBannerUrl(objectUrl);

        // Process / compress large videos to 720p HD for smooth zero-lag playback
        let blobToUpload: Blob = file;
        if (file.size > 6 * 1024 * 1024) {
          try {
            const compressed = await compressVideoFile(file, 720, 1800000);
            if (compressed.size > 0 && compressed.size < file.size) {
              blobToUpload = compressed;
            }
          } catch (cErr) {
            console.warn("Video compression warning:", cErr);
          }
        }

        // Background cloud upload to get public URL for all users
        setToastMsg('⏳ Кавер видео сервер рүү хуулагдаж байна...');
        const cloudUrl = await uploadSingleVideoToCloud(blobToUpload);
        if (cloudUrl && cloudUrl.startsWith('http')) {
          setHomeBannerUrl(cloudUrl);
          safeSetLocalStorage('ayako_homeBannerUrl', cloudUrl);
          await saveSiteConfigToDb({ homeBannerUrl: cloudUrl, homeBannerMediaType: 'video' });
          setToastMsg('🎬 Кавер видео амжилттай солигдлоо! Бүх хэрэглэгчдэд шууд харагдана.');
          setTimeout(() => setToastMsg(''), 4000);
        } else {
          setToastMsg('⚠️ Видео сервер рүү хуулахад алдаа гарлаа. "Дууны URL" эсвэл зураг сонгоно уу.');
          setTimeout(() => setToastMsg(''), 5000);
        }
      } catch (err) {
        console.error("Video banner upload error:", err);
      } finally {
        setIsUploadingBanner(false);
      }
    } else {
      // Static image cropper modal
      setHomeBannerMediaType('image');
      safeSetLocalStorage('ayako_homeBannerMediaType', 'image');
      lastLocalUploadTimeRef.current = Date.now();
      setCropperFile(file);
      setIsCropperOpen(true);
    }
  };

  const handleCroppedBannerSave = async (croppedDataUrl: string) => {
    if (!currentUser || (currentUser.role !== 'super_admin' && currentUser.role !== 'admin')) return;
    try {
      setIsUploadingBanner(true);
      setHomeBannerMediaType('image');
      safeSetLocalStorage('ayako_homeBannerMediaType', 'image');
      // 1. Instant local preview (< 30ms)
      setHomeBannerUrl(croppedDataUrl);

      // Convert data URL to blob file for persistent cloud upload
      const res = await fetch(croppedDataUrl, { cache: 'no-store' });
      const blob = await res.blob();
      const croppedFile = new File([blob], 'home_banner.webp', { type: 'image/webp' });

      // 2. Upload to Cloud storage and sync with database
      setToastMsg('⏳ Кавер зураг сервер рүү хадгалагдаж байна...');
      const cloudUrl = await uploadSingleImageToCloud(croppedFile);
      const finalUrl = cloudUrl || croppedDataUrl;
      setHomeBannerUrl(finalUrl);
      safeSetLocalStorage('ayako_homeBannerUrl', finalUrl);
      await saveSiteConfigToDb({ homeBannerUrl: finalUrl, homeBannerMediaType: 'image' });
      setToastMsg('🖼️ Кавер зураг амжилттай солигдлоо! Бүх хэрэглэгчдэд шууд харагдана.');
      setTimeout(() => setToastMsg(''), 4000);
    } catch (err) {
      console.error("Cover banner upload error:", err);
    } finally {
      setIsUploadingBanner(false);
      setIsCropperOpen(false);
      setCropperFile(null);
    }
  };

  const handleAudioFileSelect = async (file: File) => {
    if (!currentUser || (currentUser.role !== 'super_admin' && currentUser.role !== 'admin') || !file) return;

    if (file.type.startsWith('video/') || /\.(mp4|webm|mov|mkv|m4v|avi)($|\?)/i.test(file.name)) {
      setToastMsg('⚠️ Зөвхөн MP3/Audio файл эсвэл URL холбоос оруулна уу! Видео файл оруулах боломжгүй.');
      setTimeout(() => setToastMsg(''), 5000);
      return;
    }

    try {
      setIsUploadingAudio(true);
      lastLocalAudioUploadTimeRef.current = Date.now();

      // Read file as Data URL first
      const rawDataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve((e.target?.result as string) || '');
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
      });

      // Save locally to IDB for instant uploader preview
      clearLocalVideoFromIDB('ayako_homeBannerAudio');
      const objectUrl = await saveLocalVideoToIDB('ayako_homeBannerAudio', file);
      setHomeBannerAudioUrl(objectUrl);
      setIsBannerMuted(false);
      isUserExplicitlyMutedRef.current = false;
      hasUnblockedRef.current = false;

      // Upload original audio file directly to Cloud
      setToastMsg('⏳ Арын дуу сервер рүү хуулагдаж байна...');
      let finalUrl = '';
      try {
        finalUrl = await uploadSingleVideoToCloud(file);
      } catch (err) {
        console.warn('Cloud audio upload error:', err);
      }

      if (finalUrl && finalUrl.startsWith('http')) {
        setHomeBannerAudioUrl(finalUrl);
        safeSetLocalStorage('ayako_homeBannerAudioUrl', finalUrl);
        await saveSiteConfigToDb({ homeBannerAudioUrl: finalUrl });
        setToastMsg('🎵 Арын дуу хадгалагдлаа. Бүх хэрэглэгчдэд шууд сонсогдоно!');
        setTimeout(() => setToastMsg(''), 4000);
      } else if (rawDataUrl && rawDataUrl.length < 800000) {
        setHomeBannerAudioUrl(rawDataUrl);
        safeSetLocalStorage('ayako_homeBannerAudioUrl', rawDataUrl);
        await saveSiteConfigToDb({ homeBannerAudioUrl: rawDataUrl });
        setToastMsg('🎵 Арын дуу хадгалагдлаа. Бүх хэрэглэгчдэд шууд сонсогдоно!');
        setTimeout(() => setToastMsg(''), 4000);
      } else {
        setToastMsg('⚠️ Файлын хэмжээ том тул "Дууны URL" товчоор шууд MP3 эсвэл YouTube холбоос оруулна уу.');
        setTimeout(() => setToastMsg(''), 6000);
      }
    } catch (err) {
      console.error("Banner audio upload error:", err);
    } finally {
      setIsUploadingAudio(false);
    }
  };

  const handleAudioUrlPrompt = async () => {
    if (!currentUser || (currentUser.role !== 'super_admin' && currentUser.role !== 'admin')) return;
    const input = window.prompt(
      'Арын дууны холбоос (YouTube эсвэл TikTok бичлэгийн линк) оруулна уу:\n\n• YouTube бичлэг эсвэл дууны линк (youtube.com/watch?v=... эсвэл youtu.be/...)\n• TikTok бичлэгийн линк (tiktok.com/@user/video/... эсвэл vt.tiktok.com/...)',
      homeBannerAudioUrl.startsWith('http') ? homeBannerAudioUrl : ''
    );
    if (input !== null) {
      const formatted = formatDirectAudioUrl(input.trim());
      setHomeBannerAudioUrl(formatted);
      if (formatted) {
        safeSetLocalStorage('ayako_homeBannerAudioUrl', formatted);
        setIsBannerMuted(false);
        isUserExplicitlyMutedRef.current = false;
        hasUnblockedRef.current = false;
      } else {
        localStorage.removeItem('ayako_homeBannerAudioUrl');
      }
      await saveSiteConfigToDb({ homeBannerAudioUrl: formatted });
      if (formatted) {
        const ytId = getYouTubeVideoId(formatted);
        if (ytId) {
          setToastMsg('▶️ YouTube арын дуу холбогдлоо! Дэлгэцийн хаана ч хамаагүй нэг дарахад эсвэл "Дуутай" товчоор шууд тоглогдоно.');
        } else {
          setToastMsg('🎵 Арын дууны холбоос хадгалагдлаа. Бүх хэрэглэгчдэд шууд сонсогдоно!');
        }
      } else {
        setToastMsg('Арын дуу устгагдлаа');
      }
      setTimeout(() => setToastMsg(''), 5000);
    }
  };

  const handleRemoveAudio = async () => {
    if (!currentUser || (currentUser.role !== 'super_admin' && currentUser.role !== 'admin')) return;
    clearLocalVideoFromIDB('ayako_homeBannerAudio');
    setHomeBannerAudioUrl('');
    localStorage.removeItem('ayako_homeBannerAudioUrl');
    await saveSiteConfigToDb({ homeBannerAudioUrl: '' });
    setToastMsg('🔇 Арын дуу устгагдлаа.');
    setTimeout(() => setToastMsg(''), 3000);
  };

  const handleBannerUrlPrompt = async () => {
    if (!currentUser || (currentUser.role !== 'super_admin' && currentUser.role !== 'admin')) return;
    const input = window.prompt(
      'Ковер зураг эсвэл видеоны холбоос (URL) оруулна уу:\n\n• Зургийн линк (.jpg, .png, .webp)\n• Бичлэгийн линк (.mp4, .webm)',
      homeBannerUrl.startsWith('http') ? homeBannerUrl : ''
    );
    if (input !== null) {
      let formatted = input.trim();

      if (formatted.includes('pixeldrain.com/u/')) {
        formatted = formatted.replace('pixeldrain.com/u/', 'pixeldrain.com/api/file/');
      }

      const lower = formatted.toLowerCase();
      let detectedType: 'video' | 'image' = 'image';
      if (lower.match(/\.(mp4|webm|ogg|mov|m4v)($|\?)/i) || lower.startsWith('data:video/')) {
        detectedType = 'video';
      } else {
        detectedType = 'image';
      }

      setHomeBannerMediaType(detectedType);
      safeSetLocalStorage('ayako_homeBannerMediaType', detectedType);

      setHomeBannerUrl(formatted);
      if (formatted) {
        safeSetLocalStorage('ayako_homeBannerUrl', formatted);
      } else {
        localStorage.removeItem('ayako_homeBannerUrl');
      }
      await saveSiteConfigToDb({ homeBannerUrl: formatted, homeBannerMediaType: detectedType });
      if (formatted) {
        if (detectedType === 'video') {
          setToastMsg('🎬 Бичлэгэн ковер холбоос амжилттай тохируулагдлаа!');
        } else {
          setToastMsg('🖼️ Ковер зураг холбоос амжилттай тохируулагдлаа!');
        }
      } else {
        setToastMsg('Ковер устгагдлаа');
      }
      setTimeout(() => setToastMsg(''), 4000);
    }
  };

  // Bank Configuration State
  const [bankConfig, setBankConfig] = useState<BankConfig | undefined>();

  // Impersonation state: Store original admin user so admin can easily return back
  const [originalAdminUser, setOriginalAdminUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('ayako_originalAdminUser');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (originalAdminUser) {
      safeSetLocalStorage('ayako_originalAdminUser', originalAdminUser);
    } else {
      try {
        localStorage.removeItem('ayako_originalAdminUser');
      } catch (e) {}
    }
  }, [originalAdminUser]);

  // Reading history tracking with 3 months (90 days) expiration per request
  const [readingHistory, setReadingHistory] = useState<{ mangaId: string; chapterId: string; timestamp: number }[]>(() => {
    try {
      const saved = localStorage.getItem('ayako_reading_history');
      if (saved) {
        const parsed = JSON.parse(saved) as any[];
        if (Array.isArray(parsed)) {
          const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
          return parsed
            .map(entry => {
              let ts = Date.now();
              if (entry.timestamp) {
                const parsedTs = typeof entry.timestamp === 'string' ? new Date(entry.timestamp).getTime() : Number(entry.timestamp);
                if (!isNaN(parsedTs)) {
                  ts = parsedTs;
                }
              }
              return {
                mangaId: String(entry.mangaId || ''),
                chapterId: String(entry.chapterId || ''),
                timestamp: ts
              };
            })
            .filter(entry => entry.mangaId && entry.chapterId && entry.timestamp >= ninetyDaysAgo);
        }
      }
    } catch (e) {
      console.error(e);
    }
    return [];
  });

  useEffect(() => {
    if (activeChapter && selectedManga) {
      setReadingHistory(prev => {
        const filtered = prev.filter(entry => !(entry.mangaId === selectedManga.id && entry.chapterId === activeChapter.id));
        const updated = [
          {
            mangaId: selectedManga.id,
            chapterId: activeChapter.id,
            timestamp: Date.now()
          },
          ...filtered
        ].slice(0, 100);
        safeSetLocalStorage('ayako_reading_history', updated);
        return updated;
      });

      // Update currentUser readChapterIds and readingProgress for points & device sync
      if (currentUser) {
        const currentReadIds = currentUser.readChapterIds || [];
        const userProgress = currentUser.readingProgress || {};
        const isNewRead = !currentReadIds.includes(activeChapter.id);
        const currentChapterProg = userProgress[activeChapter.id] || 0;

        if (isNewRead || currentChapterProg === 0) {
          const updatedUser: User = {
            ...currentUser,
            readChapterIds: isNewRead ? [...currentReadIds, activeChapter.id] : currentReadIds,
            readingProgress: {
              ...userProgress,
              [activeChapter.id]: Math.max(1, currentChapterProg)
            }
          };
          setCurrentUser(updatedUser);
          saveUserToDb(updatedUser);
        }
      }
    }
  }, [activeChapter, selectedManga]);

  // Search & Filtering States (Home page)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('Бүгд');
  const [selectedGenre, setSelectedGenre] = useState('Бүгд');
  const [selectedStatus, setSelectedStatus] = useState('Бүх Төлөв'); // 'Бүх Төлөв', 'Гарч буй', 'Дууссан'
  const [activeDropdown, setActiveDropdown] = useState<'type' | 'genre' | 'status' | null>(null);
  const [showAllNewChapters, setShowAllNewChapters] = useState(false);
  const [specialFilter, setSpecialFilter] = useState<'all' | 'weekly_top10' | 'most_viewed30'>('all');
  const [adminSubTab, setAdminSubTab] = useState<'vip' | 'users' | 'genres' | 'financial' | 'theme'>('vip');
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [allGenres, setAllGenres] = useState<string[]>(DEFAULT_GENRES);

  const [isFreeSiteMode, setIsFreeSiteMode] = useState<boolean>(() => {
    const cached = getSiteConfigCache();
    if (cached?.isFreeSiteMode !== undefined) return cached.isFreeSiteMode;
    return localStorage.getItem('ayako_is_free_mode') === 'true';
  });

  const [themeColor, setThemeColor] = useState<string>(() => {
    const cached = getSiteConfigCache();
    if (cached?.themeColor) return cached.themeColor;
    const saved = localStorage.getItem('ayako_theme_color');
    if (saved) return saved;
    return '#ff2a85';
  });

  useEffect(() => {
    applyThemeColor(themeColor);
  }, [themeColor]);

  // Real-time synchronization hooks
  useEffect(() => {
    const unsub = subscribeToGenres((data) => {
      if (data && data.length > 0) {
        setAllGenres(data);
      }
    });
    return unsub;
  }, []);

  const handleAddGenre = (genre: string) => {
    if (currentUser?.role === 'super_admin') {
      addGenreToDb(genre);
      setToastMsg(`"${genre}" жанр нэмэгдлээ`);
      setTimeout(() => setToastMsg(''), 3000);
    }
  };

  const handleDeleteGenre = (genre: string) => {
    if (currentUser?.role === 'super_admin') {
      deleteGenreFromDb(genre);
      setToastMsg(`"${genre}" жанр устгагдлаа`);
      setTimeout(() => setToastMsg(''), 3000);
    }
  };

  // Initial sync with Firestore server on mount (safe throttled)
  useEffect(() => {
    forceSyncWithFirestoreServer().catch(() => {});
  }, []);

  useEffect(() => {
    const unsub = subscribeToMangas((data) => {
      setMangas(data);
      safeSetLocalStorage('ayako_mangas', data);
      setSelectedManga((prevSelected) => {
        if (!prevSelected) return null;
        const targetId = String(prevSelected.id || '').trim().toLowerCase();
        const fresh = data.find(m => m && String(m.id || '').trim().toLowerCase() === targetId);
        return fresh || prevSelected;
      });
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = subscribeToChapters((data) => {
      setChapters(data);
      safeSetLocalStorage('ayako_chapters', data);
      setActiveChapter((prevActive) => {
        if (!prevActive) return null;
        const targetId = String(prevActive.id || '').trim().toLowerCase();
        const fresh = data.find(c => c && String(c.id || '').trim().toLowerCase() === targetId);
        return fresh || prevActive;
      });
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = subscribeToUsers((data) => {
      setAllUsers(data);
      setCurrentUser((prevUser) => {
        if (!prevUser) return null;
        const fresh = data.find(u => u && (u.id === prevUser.id || (u.email && prevUser.email && u.email.toLowerCase() === prevUser.email.toLowerCase())));
        if (fresh) {
          const emailLower = fresh.email?.toLowerCase();
          const role = (emailLower === 'g.ayamenomin0826@gmail.com' || emailLower === 'misoraclan@gmail.com') ? 'super_admin' : (fresh.role || prevUser.role);
          const mergedUser: User = { ...prevUser, ...fresh, role };
          safeSetLocalStorage('ayako_currentUser', mergedUser);
          return mergedUser;
        }
        return prevUser;
      });
    });
    return unsub;
  }, []);

  // Continuous background session check with Firebase Auth
  useEffect(() => {
    const unsub = subscribeToAuth((authUser) => {
      if (authUser && authUser.email) {
        const emailLower = authUser.email.trim().toLowerCase();
        const isSuperAdminEmail = emailLower === 'g.ayamenomin0826@gmail.com' || emailLower === 'misoraclan@gmail.com';

        setCurrentUser((prev) => {
          if (prev && prev.email && prev.email.trim().toLowerCase() === emailLower) {
            return prev;
          }
          const existing = allUsers.find(u => u && u.email && u.email.trim().toLowerCase() === emailLower);
          if (existing) {
            const role = isSuperAdminEmail ? 'super_admin' : (existing.role || 'reader');
            const merged: User = { ...existing, role };
            safeSetLocalStorage('ayako_currentUser', merged);
            return merged;
          } else {
            const newId = 'u_' + Date.now();
            const newUser: User = {
              id: newId,
              email: authUser.email,
              username: authUser.displayName,
              code: '0000',
              role: isSuperAdminEmail ? 'super_admin' : 'reader',
              vipUntil: null,
              savedMangaIds: []
            };
            saveUserToDb(newUser).catch(() => {});
            safeSetLocalStorage('ayako_currentUser', newUser);
            return newUser;
          }
        });
      }
    });
    return unsub;
  }, [allUsers]);

  useEffect(() => {
    const unsub = subscribeToVipRequests((data) => {
      setVipRequests(data);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = subscribeToMovies((data) => {
      setMovies(data);
      safeSetLocalStorage('ayako_movies', data);
      setSelectedMovie((prevSelected) => {
        if (!prevSelected) return null;
        const targetId = String(prevSelected.id || '').trim().toLowerCase();
        const fresh = data.find(m => m && String(m.id || '').trim().toLowerCase() === targetId);
        return fresh || prevSelected;
      });
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = subscribeToMovieEpisodes((data) => {
      setMovieEpisodes(data);
      safeSetLocalStorage('ayako_movie_episodes', data);
      setActiveMovieEpisode((prevActive) => {
        if (!prevActive) return null;
        const targetId = String(prevActive.id || '').trim().toLowerCase();
        const fresh = data.find(e => e && String(e.id || '').trim().toLowerCase() === targetId);
        return fresh || prevActive;
      });
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = subscribeToSiteConfig(async (rawConfig) => {
      const config = Array.isArray(rawConfig) ? rawConfig[0] : rawConfig;
      if (!config) return;

      safeSetLocalStorage('ayako_siteConfig', JSON.stringify(config));

      if (config.siteName) {
        setSiteName(config.siteName);
        safeSetLocalStorage('ayako_siteName', config.siteName);
      }
      if (config.bannerTitle) {
        setBannerTitle(config.bannerTitle);
        safeSetLocalStorage('ayako_bannerTitle', config.bannerTitle);
      }
      if (config.bannerSubtitle) {
        setBannerSubtitle(config.bannerSubtitle);
        safeSetLocalStorage('ayako_bannerSubtitle', config.bannerSubtitle);
      }
      if (config.salaryConfig) setSalaryConfig(config.salaryConfig);
      if (config.vipPlans) setVipPlans(config.vipPlans);
      if (config.bankConfig) setBankConfig(config.bankConfig);
      if (config.employees && Array.isArray(config.employees)) {
        setEmployees(config.employees);
        safeSetLocalStorage('ayako_employees', config.employees);
      }
      if (config.isMoviesTabEnabled !== undefined) {
        setIsMoviesTabEnabled(config.isMoviesTabEnabled);
        safeSetLocalStorage('ayako_is_movies_enabled', String(config.isMoviesTabEnabled));
      }
      if (config.homeBannerMediaType) {
        setHomeBannerMediaType(config.homeBannerMediaType as 'video' | 'image' | 'gif');
        safeSetLocalStorage('ayako_homeBannerMediaType', config.homeBannerMediaType);
      } else if (config.homeBannerUrl) {
        if (config.homeBannerUrl.toLowerCase().includes('.gif')) {
          setHomeBannerMediaType('gif');
          safeSetLocalStorage('ayako_homeBannerMediaType', 'gif');
        } else if (config.homeBannerUrl.match(/\.(mp4|webm|ogg|mov|m4v)($|\?)/i) || config.homeBannerUrl.startsWith('data:video/')) {
          setHomeBannerMediaType('video');
          safeSetLocalStorage('ayako_homeBannerMediaType', 'video');
        } else {
          setHomeBannerMediaType('image');
          safeSetLocalStorage('ayako_homeBannerMediaType', 'image');
        }
      }
      if (config.homeBannerUrl !== undefined) {
        if (config.homeBannerUrl === '' || config.homeBannerUrl === null) {
          setHomeBannerUrl('');
          localStorage.removeItem('ayako_homeBannerUrl');
        } else if (config.homeBannerUrl.startsWith('http') || config.homeBannerUrl.startsWith('data:')) {
          setHomeBannerUrl(config.homeBannerUrl);
          safeSetLocalStorage('ayako_homeBannerUrl', config.homeBannerUrl);
        } else if (config.homeBannerUrl === 'idb:video' || config.homeBannerUrl.startsWith('blob:')) {
          const idbUrl = await getLocalVideoFromIDB('ayako_homeBannerVideo');
          if (idbUrl) {
            setHomeBannerUrl(prev => prev === idbUrl ? prev : idbUrl);
          }
        }
      }
      if (config.homeBannerAudioUrl !== undefined) {
        if (config.homeBannerAudioUrl === '' || config.homeBannerAudioUrl.startsWith('http') || config.homeBannerAudioUrl.startsWith('data:')) {
          setHomeBannerAudioUrl(config.homeBannerAudioUrl);
          if (config.homeBannerAudioUrl) {
            safeSetLocalStorage('ayako_homeBannerAudioUrl', config.homeBannerAudioUrl);
          } else {
            localStorage.removeItem('ayako_homeBannerAudioUrl');
          }
        } else if (config.homeBannerAudioUrl === 'idb:audio' || config.homeBannerAudioUrl.startsWith('blob:')) {
          const idbUrl = await getLocalVideoFromIDB('ayako_homeBannerAudio');
          if (idbUrl) {
            setHomeBannerAudioUrl(prev => prev === idbUrl ? prev : idbUrl);
          }
        }
      }
      if (config.themeColor !== undefined) {
        setThemeColor(config.themeColor);
        safeSetLocalStorage('ayako_theme_color', config.themeColor);
        applyThemeColor(config.themeColor);
      }
      if (config.isFreeSiteMode !== undefined) {
        setIsFreeSiteMode(config.isFreeSiteMode);
        safeSetLocalStorage('ayako_is_free_mode', String(config.isFreeSiteMode));
      }
    });
    return unsub;
  }, []);

  const handleToggleFreeSiteMode = async (free: boolean) => {
    setIsFreeSiteMode(free);
    safeSetLocalStorage('ayako_is_free_mode', String(free));
    await saveSiteConfigToDb({ isFreeSiteMode: free });
    setToastMsg(free ? 'Сайт ҮНЭГҮЙ (FREE) горимд шилжлээ' : 'Сайт ТӨЛБӨРТЭЙ (VIP) горимд шилжлээ');
    setTimeout(() => setToastMsg(''), 3000);
  };

  const handleToggleMoviesTab = async (enabled: boolean) => {
    setIsMoviesTabEnabled(enabled);
    safeSetLocalStorage('ayako_is_movies_enabled', String(enabled));
    await saveSiteConfigToDb({ isMoviesTabEnabled: enabled });
    setToastMsg(enabled ? 'Кино хэсэг АСААЛАА (Нийтэд харагдана)' : 'Кино хэсэг НУУЛАА (Зөвхөн Ерөнхий админд харагдана)');
    setTimeout(() => setToastMsg(''), 3000);
  };

  const handleAddMovie = async (movieData: Omit<MovieItem, 'id' | 'views' | 'likes'>) => {
    const newMovie: MovieItem = {
      ...movieData,
      id: 'movie_' + Date.now(),
      views: 0,
      likes: 0
    };
    await addMovieToDb(newMovie);
    setToastMsg('Шинэ кино амжилттай нэмэгдлээ!');
    setTimeout(() => setToastMsg(''), 3000);
  };

  const handleDeleteMovie = async (movieId: string) => {
    if (currentUser?.role !== 'super_admin') {
      alert('Зөвхөн Ерөнхий админ кино устгах эрхтэй.');
      return;
    }
    await deleteMovieFromDb(movieId);
    setToastMsg('Кино амжилттай устгагдлаа.');
    setTimeout(() => setToastMsg(''), 3000);
    if (selectedMovie?.id === movieId) {
      setSelectedMovie(null);
    }
  };

  const handleAddMovieEpisode = async (episodeData: Omit<MovieEpisode, 'id' | 'createdAt'>) => {
    const newEp: MovieEpisode = {
      ...episodeData,
      id: 'mep_' + Date.now(),
      createdAt: new Date().toISOString()
    };
    await addMovieEpisodeToDb(newEp);
    setToastMsg('Шинэ кино анги нэмэгдлээ!');
    setTimeout(() => setToastMsg(''), 3000);
  };

  const handleDeleteMovieEpisode = async (episodeId: string) => {
    if (currentUser?.role !== 'super_admin') {
      alert('Зөвхөн Ерөнхий админ анги устгах эрхтэй.');
      return;
    }
    await deleteMovieEpisodeFromDb(episodeId);
    setToastMsg('Кино анги устгагдлаа.');
    setTimeout(() => setToastMsg(''), 3000);
  };

  const handleSaveTheme = async (newHex: string) => {
    setThemeColor(newHex);
    applyThemeColor(newHex);
    safeSetLocalStorage('ayako_theme_color', newHex);
    await saveSiteConfigToDb({ themeColor: newHex });
  };

  useEffect(() => {
    if (homeBannerUrl) {
      safeSetLocalStorage('ayako_homeBannerUrl', homeBannerUrl);
      safeSetLocalStorage('ayako_homeBannerMediaType', homeBannerMediaType);
    }
  }, [homeBannerUrl, homeBannerMediaType]);

  // Update currentUser real-time when allUsers changes (role, avatar, saved items, vip, name, etc.)
  useEffect(() => {
    if (currentUser && allUsers.length > 0) {
      const updatedUser = allUsers.find(u => u.id === currentUser.id);
      if (updatedUser && JSON.stringify(updatedUser) !== JSON.stringify(currentUser)) {
        setCurrentUser(updatedUser);
      }
    }
  }, [allUsers]);

  // Scroll to top on page or active view navigation
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [activeTab, selectedManga?.id]);

  // Sync to localStorage safely
  useEffect(() => {
    safeSetLocalStorage('ayako_siteName', siteName);
  }, [siteName]);

  useEffect(() => {
    safeSetLocalStorage('ayako_users', allUsers);
  }, [allUsers]);

  useEffect(() => {
    if (currentUser) {
      safeSetLocalStorage('ayako_currentUser', currentUser);
    } else {
      try {
        localStorage.removeItem('ayako_currentUser');
      } catch (e) {}
    }
  }, [currentUser]);

  useEffect(() => {
    safeSetLocalStorage('ayako_mangas', mangas);
  }, [mangas]);

  useEffect(() => {
    safeSetLocalStorage('ayako_chapters', chapters);
  }, [chapters]);

  useEffect(() => {
    safeSetLocalStorage('ayako_employees', employees);
  }, [employees]);

  useEffect(() => {
    safeSetLocalStorage('ayako_vipRequests', vipRequests);
  }, [vipRequests]);

  const [hasHandledDeepLink, setHasHandledDeepLink] = useState(false);

  const isUserVip = () => {
    if (isFreeSiteMode) return true;
    if (!currentUser) return false;
    if (currentUser.role === 'super_admin' || currentUser.role === 'admin') return true;
    if (!currentUser.vipUntil) return false;
    return new Date(currentUser.vipUntil) > new Date();
  };

  const handleOpenChapter = (manga: Manga, chapter: Chapter) => {
    if (chapter.isVip && !isUserVip()) {
      alert('Энэ бүлэг VIP хэрэглэгчдэд зориулагдсан байна. Та VIP эрх авах хэсгээр орж хүсэлт илгээнэ үү.');
      setSelectedManga(manga);
      setActiveChapter(null);
      if (currentUser) {
        setActiveTab('admin_management');
        setAdminSubTab('vip');
      } else {
        setIsAuthModalOpen(true);
      }
      return;
    }
    setSelectedManga(manga);
    setActiveChapter(chapter);
  };

  // Reactive deep link parsing once mangas and chapters load from Firestore
  useEffect(() => {
    if (hasHandledDeepLink || mangas.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const mId = params.get('mangaId');
    const cId = params.get('chapterId');
    if (mId) {
      const foundM = mangas.find(m => String(m.id).trim().toLowerCase() === String(mId).trim().toLowerCase());
      if (foundM) {
        setSelectedManga(foundM);
        if (cId && chapters.length > 0) {
          const foundC = chapters.find(ch => String(ch.id).trim().toLowerCase() === String(cId).trim().toLowerCase());
          if (foundC) {
            if (!foundC.isVip || isUserVip()) {
              setActiveChapter(foundC);
            } else {
              alert('Энэ бүлэг VIP хэрэглэгчдэд зориулагдсан байна. Та VIP эрх авах хэсгээр орж хүсэлт илгээнэ үү.');
              setActiveChapter(null);
            }
          }
          setHasHandledDeepLink(true);
        } else if (!cId) {
          setHasHandledDeepLink(true);
        }
      }
    }
  }, [mangas, chapters, hasHandledDeepLink, currentUser, isFreeSiteMode]);

  // Continuously synchronize browser URL search params with active manga / chapter selection
  useEffect(() => {
    if (selectedManga && activeChapter) {
      window.history.replaceState({}, '', `?mangaId=${selectedManga.id}&chapterId=${activeChapter.id}`);
    } else if (selectedManga) {
      window.history.replaceState({}, '', `?mangaId=${selectedManga.id}`);
    } else {
      const params = new URLSearchParams(window.location.search);
      if (params.has('mangaId') || params.has('chapterId')) {
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [selectedManga, activeChapter]);

  useEffect(() => {
    safeSetLocalStorage('ayako_salary_config', salaryConfig);
  }, [salaryConfig]);

  // Auth helper handlers
  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
    safeSetLocalStorage('ayako_currentUser', user);
    setIsAuthModalOpen(false);
  };

  const handleRegisterUser = async (newUser: User) => {
    await saveUserToDb(newUser);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem('ayako_currentUser');
    } catch {}
    logoutFromFirebase().catch(() => {});
    setActiveTab('home');
    setSelectedManga(null);
    setActiveChapter(null);
  };

  // Profile update handler
  const handleUpdateProfile = async (newUsername: string, newCode: string) => {
    if (currentUser) {
      const updatedUser: User = {
        ...currentUser,
        username: newUsername,
        code: newCode
      };
      await saveUserToDb(updatedUser);
      setCurrentUser(updatedUser);
    }
  };

  // Manga management actions
  const handleAddManga = async (mangaData: Omit<Manga, 'id' | 'views' | 'likes'>) => {
    const newManga: Manga = {
      ...mangaData,
      id: 'm_' + Date.now(),
      views: 0,
      likes: 0
    };
    await addMangaToDb(newManga);
  };

  const handleUpdateManga = async (updatedManga: Manga) => {
    await updateMangaInDb(updatedManga);
    if (selectedManga?.id === updatedManga.id) {
      setSelectedManga(updatedManga);
    }
  };

  const handleDeleteManga = async (mangaId: string) => {
    if (currentUser?.role !== 'super_admin') {
      alert('Зөвхөн Ерөнхий админ манга устгах эрхтэй.');
      return;
    }
    await deleteMangaFromDb(mangaId);
    // Delete associated chapters in batch
    const associatedChapters = chapters.filter(c => String(c.mangaId || '').trim().toLowerCase() === String(mangaId || '').trim().toLowerCase());
    if (associatedChapters.length > 0) {
      await deleteChaptersBatchFromDb(associatedChapters.map(c => c.id));
    }
    if (selectedManga?.id === mangaId) {
      setSelectedManga(null);
    }
  };

  // Chapter management actions
  const handleAddChapter = async (
    chapterData: Omit<Chapter, 'id' | 'createdAt'>,
    onProgress?: (percent: number, msg: string) => void
  ) => {
    try {
      const targetMangaId = String(chapterData.mangaId || selectedManga?.id || '').trim();
      const newChapter: Chapter = {
        ...chapterData,
        mangaId: targetMangaId,
        id: 'ch_' + Date.now(),
        createdAt: new Date().toISOString()
      };
      await addChapterToDb(newChapter, onProgress);
      showToast('Шинэ бүлэг амжилттай нэмэгдлээ! 🎉');
    } catch (err: any) {
      console.error("Failed to add chapter:", err);
      showToast(`⚠️ Бүлэг нэмэхэд алдаа гарлаа: ${err?.message || 'Дахин оролдоно уу'}`);
      throw err;
    }
  };

  const handleDeleteChapter = async (chapterId: string) => {
    if (currentUser?.role !== 'super_admin') {
      alert('Зөвхөн Ерөнхий админ манга бүлэг устгах эрхтэй.');
      return;
    }
    try {
      await deleteChapterFromDb(chapterId);
      showToast('Бүлэг амжилттай устгагдлаа.');
    } catch (err: any) {
      console.error("Failed to delete chapter:", err);
      showToast('⚠️ Бүлэг устгахад алдаа гарлаа.');
    }
  };

  const handleUpdateChapter = async (updatedChapter: Chapter) => {
    try {
      await updateChapterInDb(updatedChapter);
      showToast('Бүлэг амжилттай шинэчлэгдлээ!');
    } catch (err: any) {
      console.error("Failed to update chapter:", err);
      showToast('⚠️ Бүлэг шинэчлэхэд алдаа гарлаа.');
    }
  };

  // VIP Actions
  const handleAddVipRequest = async (durationText: string, fileName: string, receiptImage?: string) => {
    if (!currentUser) return;
    const newRequest: VipRequest = {
      id: 'req_' + Date.now(),
      userId: currentUser.id,
      username: currentUser.username,
      userEmail: currentUser.email,
      durationText,
      receiptName: fileName,
      receiptImage,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    await addVipRequestToDb(newRequest);
  };

  const handleApproveVipRequest = async (requestId: string) => {
    const req = vipRequests.find(r => r.id === requestId);
    if (!req) return;

    // Update Request
    const updatedReq = { ...req, status: 'approved' as const };
    setVipRequests(prev => prev.map(r => r.id === requestId ? updatedReq : r));
    await updateVipRequestInDb(updatedReq);

    // Grant user VIP
    const u = allUsers.find(user => user.id === req.userId);
    if (u) {
      const newVipDate = computeNewVipDate(u.vipUntil, req.durationText);
      const updatedUser = { ...u, vipUntil: newVipDate };
      await saveUserToDb(updatedUser);
      if (currentUser && currentUser.id === req.userId) {
        setCurrentUser(updatedUser);
      }
    }
  };

  const handleRejectVipRequest = async (requestId: string) => {
    const req = vipRequests.find(r => r.id === requestId);
    if (!req) return;
    const updatedReq = { ...req, status: 'rejected' as const };
    setVipRequests(prev => prev.map(r => r.id === requestId ? updatedReq : r));
    await updateVipRequestInDb(updatedReq);
  };

  const handleDeleteVipRequests = async (requestIds: string[]) => {
    if (!requestIds || requestIds.length === 0) return;
    setVipRequests(prev => prev.filter(r => !requestIds.includes(r.id)));
    for (const id of requestIds) {
      await deleteVipRequestFromDb(id);
    }
  };

  const handleDirectVipGrant = async (userId: string, durationText: string) => {
    const u = allUsers.find(user => user.id === userId);
    if (u) {
      const newVipDate = computeNewVipDate(u.vipUntil, durationText);
      const updatedUser = { ...u, vipUntil: newVipDate };
      await saveUserToDb(updatedUser);
      if (currentUser && currentUser.id === userId) {
        setCurrentUser(updatedUser);
      }
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: UserRole) => {
    const u = allUsers.find(user => user.id === userId);
    if (u) {
      const updatedUser = { ...u, role: newRole };
      await saveUserToDb(updatedUser);
      if (currentUser && currentUser.id === userId) {
        setCurrentUser(updatedUser);
      }
    }
  };

  const handleDirectVipDateGrant = async (userId: string, dateStr: string | null) => {
    const u = allUsers.find(user => user.id === userId);
    if (u) {
      const updatedUser = { ...u, vipUntil: dateStr };
      await saveUserToDb(updatedUser);
      if (currentUser && currentUser.id === userId) {
        setCurrentUser(updatedUser);
      }
    }
  };

  const handleCopyLink = (manga: Manga) => {
    const url = `${window.location.origin}${window.location.pathname}?mangaId=${manga.id}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        showToast(`"${manga.title}" манганы линк амжилттай хуулагдлаа! 📋`);
      }).catch(() => {
        showToast(`Манганы линк амжилттай хуулагдлаа! 📋`);
      });
    } else {
      showToast(`Манганы линк амжилттай хуулагдлаа! 📋`);
    }
  };

  const handleToggleSaveManga = async (mangaId: string) => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }

    const currentSaved = currentUser.savedMangaIds || [];
    const isAlreadySaved = currentSaved.includes(mangaId);
    let updatedSaved: string[];

    if (isAlreadySaved) {
      updatedSaved = currentSaved.filter(id => id !== mangaId);
      showToast('Манга хадгалснаас хасагдлаа.');
    } else {
      updatedSaved = [...currentSaved, mangaId];
      showToast('Манга профайлд амжилттай хадгалагдлаа! ❤️');
    }

    const updatedUser: User = {
      ...currentUser,
      savedMangaIds: updatedSaved
    };

    setCurrentUser(updatedUser);
    setAllUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
    await saveUserToDb(updatedUser);

    const targetManga = mangas.find(m => m.id === mangaId);
    if (targetManga) {
      const delta = isAlreadySaved ? -1 : 1;
      const updatedLikes = Math.max(0, targetManga.likes + delta);
      const updatedManga = { ...targetManga, likes: updatedLikes };
      setMangas(prev => prev.map(m => m.id === mangaId ? updatedManga : m));
      incrementMangaLikesInDb(mangaId, delta).catch(() => {});
    }
  };

  // Filtered mangas for Home and Catalog
  const filteredMangas = mangas.filter(manga => {
    if (!manga) return false;
    const title = String(manga.title || '').toLowerCase();
    const author = String(manga.author || '').toLowerCase();
    const desc = String(manga.description || '').toLowerCase();
    const search = (searchQuery || '').toLowerCase().trim();
    const matchesSearch = !search || title.includes(search) || author.includes(search) || desc.includes(search);

    const mangaType = String(manga.type || 'manga').toLowerCase();
    const matchesType = selectedType === 'Бүгд' || mangaType === selectedType.toLowerCase();

    const genresList = Array.isArray(manga.genres) ? manga.genres : [];
    const matchesGenre = selectedGenre === 'Бүгд' || genresList.includes(selectedGenre);

    const matchesStatus = selectedStatus === 'Бүх Төлөв' || selectedStatus === 'Бүгд' ||
                          (selectedStatus === 'Гарч буй' && manga.status === 'publishing') ||
                          (selectedStatus === 'Дууссан' && manga.status === 'completed') ||
                          (selectedStatus === 'Гаргалт гүйцсэн' && manga.status === 'full_release');

    return matchesSearch && matchesType && matchesGenre && matchesStatus;
  });

  // Mappings for filters
  const typeLabels: Record<string, string> = {
    'Бүгд': 'Бүгд',
    'manga': 'Манга',
    'manhwa': 'Манхва',
    'bl': 'БЛ',
    'gl': 'ГЛ'
  };

  const statusLabels: Record<string, string> = {
    'Бүх Төлөв': 'Бүгд',
    'Бүгд': 'Бүгд',
    'Гарч буй': 'Гарч буй',
    'Дууссан': 'Дууссан',
    'Гаргалт гүйцсэн': 'Гаргалт гүйцсэн'
  };

  // Get all latest chapters sorted by date
  const latestChaptersForMangas = (() => {
    return chapters.map(ch => {
      if (!ch) return null;
      const manga = mangas.find(m => m && String(m.id || '').trim().toLowerCase() === String(ch.mangaId || '').trim().toLowerCase());
      if (!manga) return null;
      return {
        manga,
        chapter: ch,
        createdAt: parseTimestamp(ch.createdAt)
      };
    }).filter((item): item is { manga: Manga, chapter: Chapter, createdAt: number } => item !== null)
      .sort((a, b) => b.createdAt - a.createdAt);
  })();

  // 30 most recently added/updated mangas
  const new30Mangas = [...mangas]
    .filter(Boolean)
    .sort((a, b) => {
      const timeA = Math.max(parseTimestamp(a.updatedAt), parseTimestamp(a.createdAt));
      const timeB = Math.max(parseTimestamp(b.updatedAt), parseTimestamp(b.createdAt));
      if (timeA !== timeB) {
        return timeB - timeA;
      }
      const aNum = Number(a.id);
      const bNum = Number(b.id);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return bNum - aNum;
      }
      return String(b.id || '').localeCompare(String(a.id || ''));
    })
    .slice(0, 30);

  // Map reading history entries to actual Manga and Chapter objects
  // Up to 5 most recently viewed chapters per manga
  const recentHistoryItems = (() => {
    const mangaGroups = new Map<string, { manga: Manga; chapter: Chapter; timestamp: number }[]>();
    for (const entry of readingHistory) {
      const manga = mangas.find(m => String(m.id || '').trim().toLowerCase() === String(entry.mangaId || '').trim().toLowerCase());
      const chapter = chapters.find(c => c.id === entry.chapterId && String(c.mangaId || '').trim().toLowerCase() === String(entry.mangaId || '').trim().toLowerCase());
      if (manga && chapter) {
        const entryTime = typeof entry.timestamp === 'string' ? new Date(entry.timestamp).getTime() : Number(entry.timestamp) || 0;
        const existing = mangaGroups.get(manga.id) || [];
        if (!existing.some(item => item.chapter.id === chapter.id)) {
          existing.push({ manga, chapter, timestamp: entryTime });
          mangaGroups.set(manga.id, existing);
        }
      }
    }

    const items: { manga: Manga; chapter: Chapter; timestamp: number }[] = [];
    mangaGroups.forEach((group) => {
      const top5 = group.sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
      items.push(...top5);
    });

    return items.sort((a, b) => b.timestamp - a.timestamp);
  })();

  const getMangaProgressStats = (mangaId: string) => {
    const mangaChs = chapters.filter((ch) => String(ch.mangaId || '').trim().toLowerCase() === String(mangaId || '').trim().toLowerCase());
    const total = mangaChs.length;
    if (total === 0) return { readChaptersCount: 0, totalChaptersCount: 0, readPercentage: 0 };

    const readSet = new Set<string>();
    if (currentUser?.readChapterIds && Array.isArray(currentUser.readChapterIds)) {
      currentUser.readChapterIds.forEach(id => readSet.add(String(id).trim().toLowerCase()));
    }
    if (readingHistory && Array.isArray(readingHistory)) {
      readingHistory.forEach(h => {
        if (String(h.mangaId || '').trim().toLowerCase() === String(mangaId || '').trim().toLowerCase()) {
          readSet.add(String(h.chapterId).trim().toLowerCase());
        }
      });
    }

    const readCount = mangaChs.filter(c => readSet.has(String(c.id || '').trim().toLowerCase())).length;
    const percentage = Math.min(100, Math.round((readCount / total) * 100));
    return { readChaptersCount: readCount, totalChaptersCount: total, readPercentage: percentage };
  };

  // Map manga.id to its latest chapter title
  const latestChaptersMap = (() => {
    const map: Record<string, string> = {};
    for (const manga of mangas) {
      const mangaChapters = chapters.filter(c => String(c.mangaId || '').trim().toLowerCase() === String(manga.id || '').trim().toLowerCase());
      if (mangaChapters.length > 0) {
        const sorted = [...mangaChapters].sort((a, b) => parseTimestamp(b.createdAt) - parseTimestamp(a.createdAt));
        map[manga.id] = sorted[0].title;
      }
    }
    return map;
  })();

  // Calculate top users ranking with monthly points
  const topUsersWithPoints = (() => {
    // 1. Calculate comments count per user across chapters & mangas
    const userCommentsMap: Record<string, number> = {};
    chapters.forEach(ch => {
      ch.comments?.forEach(c => {
        const name = (c.username || '').trim().toLowerCase();
        if (name) userCommentsMap[name] = (userCommentsMap[name] || 0) + 1;
        c.replies?.forEach(r => {
          const rName = (r.username || '').trim().toLowerCase();
          if (rName) userCommentsMap[rName] = (userCommentsMap[rName] || 0) + 1;
        });
      });
    });

    mangas.forEach(m => {
      m.comments?.forEach(c => {
        const name = (c.username || '').trim().toLowerCase();
        if (name) userCommentsMap[name] = (userCommentsMap[name] || 0) + 1;
        c.replies?.forEach(r => {
          const rName = (r.username || '').trim().toLowerCase();
          if (rName) userCommentsMap[rName] = (userCommentsMap[rName] || 0) + 1;
        });
      });
    });

    return allUsers.map(u => {
      // 1 chapter read = 1 point
      const readChaptersCount = u.readChapterIds?.length || (u.id === currentUser?.id ? new Set(readingHistory.map(h => h.chapterId)).size : 0);
      const readPoints = readChaptersCount * 1;

      // 1 comment = 2 points
      const nameKey = (u.username || '').trim().toLowerCase();
      const commentsCount = userCommentsMap[nameKey] || 0;
      const commentPoints = commentsCount * 2;

      // 1 heart/like on manga = 2 points (unique manga saved/liked)
      const likedMangaCount = u.savedMangaIds?.length || 0;
      const heartPoints = likedMangaCount * 2;

      const totalPoints = readPoints + commentPoints + heartPoints;

      return {
        user: u,
        readCount: readChaptersCount,
        commentCount: commentsCount,
        likedCount: likedMangaCount,
        totalPoints
      };
    }).sort((a, b) => b.totalPoints - a.totalPoints);
  })();

  // Sort descending by the upload date of the latest chapter or special filters
  const sortedAndFilteredMangas = (() => {
    let list = [...filteredMangas];
    
    if (specialFilter === 'weekly_top10') {
      return list.sort((a, b) => (b.likes || 0) - (a.likes || 0)).slice(0, 10);
    } else if (specialFilter === 'most_viewed30') {
      return list.sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 30);
    }
    
    return list.sort((a, b) => {
      const aId = String(a?.id || '').trim().toLowerCase();
      const bId = String(b?.id || '').trim().toLowerCase();
      const aChapters = chapters.filter(ch => ch && String(ch.mangaId || '').trim().toLowerCase() === aId);
      const bChapters = chapters.filter(ch => ch && String(ch.mangaId || '').trim().toLowerCase() === bId);

      const aLatestChapter = aChapters.length > 0
        ? Math.max(...aChapters.map(ch => parseTimestamp(ch.createdAt)))
        : 0;
      const bLatestChapter = bChapters.length > 0
        ? Math.max(...bChapters.map(ch => parseTimestamp(ch.createdAt)))
        : 0;

      const aTime = Math.max(parseTimestamp(a?.updatedAt), parseTimestamp(a?.createdAt), aLatestChapter);
      const bTime = Math.max(parseTimestamp(b?.updatedAt), parseTimestamp(b?.createdAt), bLatestChapter);

      if (aTime !== bTime) {
        return bTime - aTime; // Descending (newest update / chapter first)
      }
      return String(b?.id || '').localeCompare(String(a?.id || '')); // fallback
    });
  })();

  return (
    <ScreenProtection currentUser={currentUser}>
      <div className="min-h-screen bg-brand-bg text-brand-text flex flex-col justify-between selection:bg-brand-accent/30 selection:text-brand-ice overflow-x-hidden">
      
      {/* Impersonation Banner for Super Admin */}
      {originalAdminUser && (
        <div className="bg-amber-500/20 border-b border-amber-500/40 text-amber-200 px-4 py-2 text-xs flex justify-between items-center z-50 sticky top-0 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
            <span>
              Та одоогоор <strong>{currentUser?.username}</strong> ({currentUser?.email}) хэрэглэгчийн хаягаар зочилж байна.
            </span>
          </div>
          <button
            onClick={() => {
              setCurrentUser(originalAdminUser);
              setOriginalAdminUser(null);
              setActiveTab('admin_management');
            }}
            className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-lg transition-all cursor-pointer shadow-md"
          >
            Буцаад өөрийн ({originalAdminUser.username}) админ хаяг руу орох
          </button>
        </div>
      )}

      {/* Navigation Header */}
      <Header
        siteName={siteName}
        onChangeSiteName={(name) => {
          setSiteName(name);
          saveSiteConfigToDb({ siteName: name });
        }}
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setSelectedManga(null); // Return from reader if navigating elsewhere
          setActiveChapter(null);
          setAdminForceAdd(false);
        }}
        onAddNewManga={() => {
          setIsAddMangaModalOpen(true);
        }}
        isReadingChapter={activeChapter !== null}
        onBackFromChapter={() => setActiveChapter(null)}
        searchQuery={searchQuery}
        setSearchQuery={(q) => {
          setSearchQuery(q);
          if (q.trim().length > 0) {
            setSelectedManga(null);
            setActiveTab('home');
          }
        }}
        isFreeSiteMode={isFreeSiteMode}
        isMoviesTabEnabled={isMoviesTabEnabled}
      />

      {/* Main Content Area */}
      <main className="flex-grow">
        {selectedManga && (
          /* SINGLE MANGA DETAILED CHAPTER READER PANEL */
          <ChapterReader
            manga={selectedManga}
            chapters={chapters}
            employees={employees}
            currentUser={currentUser}
            allUsers={allUsers}
            onBack={() => {
              setSelectedManga(null);
              setActiveChapter(null);
            }}
            onAddChapter={handleAddChapter}
            onDeleteChapter={handleDeleteChapter}
            onUpdateChapter={handleUpdateChapter}
            canDelete={currentUser?.role === 'super_admin'}
            canAdd={currentUser?.role === 'super_admin' || currentUser?.role === 'admin'}
            onGoToVipPanel={() => {
              setSelectedManga(null);
              setActiveTab('admin_management');
              setAdminSubTab('vip');
              setActiveChapter(null);
            }}
            onUpdateManga={handleUpdateManga}
            activeChapter={activeChapter}
            onActiveChapterChange={setActiveChapter}
            isSaved={currentUser?.savedMangaIds?.includes(selectedManga.id)}
            onToggleSave={handleToggleSaveManga}
            onCopyLink={handleCopyLink}
            isFreeSiteMode={isFreeSiteMode}
            allMangas={mangas}
            onSelectManga={(m) => {
              setSelectedManga(m);
              setActiveChapter(null);
            }}
          />
        )}

        {/* SECTION ROUTING PANELS - Home Dashboard and Sub-pages */}
        <div className={selectedManga ? 'hidden' : 'block'}>
          <div id="home-dashboard-container" className={`max-w-7xl mx-auto px-1 sm:px-4 pb-8 md:pb-12 pt-4 space-y-12 ${activeTab === 'home' ? 'block' : 'hidden'}`}>

                {/* Cover Flow Carousel */}
                <FeaturedCarousel
                  mangas={mangas}
                  onSelect={(manga) => setSelectedManga(manga)}
                />

                {/* 1. Шинэ манга (New Manga) Section - 30 recently added mangas */}
                {new30Mangas.length > 0 && (
                  <div className="space-y-4 pt-4 border-t border-brand-accent/5">
                    <div className="flex items-center justify-between px-1">
                      <h3 className="font-display font-extrabold text-sm sm:text-base md:text-lg text-brand-text tracking-wider uppercase flex items-center gap-2">
                        <span className="w-1.5 h-4 bg-cyan-400 rounded-full inline-block"></span>
                        Шинэ манга
                      </h3>
                      <button
                        onClick={() => setActiveTab('new_mangas')}
                        className="text-xs text-cyan-400 font-semibold uppercase tracking-wider hover:underline cursor-pointer"
                      >
                        Бүгд ▶
                      </button>
                    </div>

                    <div className="grid grid-flow-col auto-cols-[30%] sm:auto-cols-[24%] md:auto-cols-[20%] lg:auto-cols-[18.5%] gap-3 sm:gap-4 overflow-x-auto scrollbar-none pb-2 select-none">
                      {new30Mangas.map((manga) => (
                        <div
                          key={manga.id}
                          onClick={() => setSelectedManga(manga)}
                          className="flex flex-col cursor-pointer group shrink-0"
                        >
                          <div className="aspect-[3/4] rounded-xl overflow-hidden shadow-lg mb-2 relative">
                            <SmartImage
                              key={manga.coverUrl}
                              src={manga.coverUrl}
                              alt={manga.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            {manga.type && (
                              <span className="absolute top-1.5 left-1.5 bg-black/70 backdrop-blur-xs text-cyan-300 text-[8px] font-bold px-1.5 py-0.5 rounded uppercase">
                                {manga.type}
                              </span>
                            )}
                          </div>
                          <h4 className="font-sans font-extrabold text-[10px] sm:text-xs md:text-sm text-brand-text truncate leading-tight group-hover:text-cyan-400 transition-all">
                            {manga.title}
                          </h4>
                          <span className="text-[8px] sm:text-xs text-brand-text-dark font-mono mt-0.5 font-medium truncate">
                            {manga.author || 'Зохиолч тодорхойгүй'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. Шинэ бүлэг (New Chapters) Section */}
                {latestChaptersForMangas.length > 0 && (
                  <div className="space-y-4 pt-4 border-t border-brand-accent/5">
                    <div className="flex items-center justify-between px-1">
                      <h3 className="font-display font-extrabold text-sm sm:text-base md:text-lg text-brand-text tracking-wider uppercase flex items-center gap-2">
                        <span className="w-1.5 h-4 bg-brand-accent rounded-full inline-block"></span>
                        Шинэ бүлэг
                      </h3>
                      <button
                        onClick={() => setActiveTab('new_chapters')}
                        className="text-xs text-brand-accent font-semibold uppercase tracking-wider hover:underline cursor-pointer"
                      >
                        Бүгд ▶
                      </button>
                    </div>

                    <div className="grid grid-flow-col auto-cols-[30%] sm:auto-cols-[24%] md:auto-cols-[20%] lg:auto-cols-[18.5%] gap-3 sm:gap-4 overflow-x-auto scrollbar-none pb-2 select-none">
                      {latestChaptersForMangas.map(({ manga, chapter }) => (
                        <div
                          key={chapter.id}
                          onClick={() => handleOpenChapter(manga, chapter)}
                          className="flex flex-col cursor-pointer group shrink-0"
                        >
                          <div className="aspect-[3/4] rounded-xl overflow-hidden shadow-lg mb-2 relative">
                            <SmartImage
                              key={manga.coverUrl}
                              src={manga.coverUrl}
                              alt={manga.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                          <h4 className="font-sans font-extrabold text-[10px] sm:text-xs md:text-sm text-brand-text truncate leading-tight group-hover:text-brand-accent transition-all">
                            {manga.title}
                          </h4>
                          <div className="flex items-center justify-between gap-1 mt-0.5">
                            <span className="text-[8px] sm:text-xs text-brand-accent font-mono font-semibold truncate">
                              {chapter.title}
                            </span>
                            <span className="text-[8px] sm:text-[10px] text-zinc-400 font-mono flex items-center gap-0.5 shrink-0">
                              <Clock className="w-2.5 h-2.5 text-brand-accent/70" />
                              {getTimeAgo(chapter.createdAt)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Сүүлд үзсэн (Recently Viewed) Section - up to 5 chapters per manga */}
                {recentHistoryItems.length > 0 && (
                  <div className="space-y-4 pt-4 border-t border-brand-accent/5">
                    <div className="flex items-center justify-between px-1">
                      <h3 className="font-display font-extrabold text-sm sm:text-base md:text-lg text-brand-text tracking-wider uppercase flex items-center gap-2">
                        <span className="w-1.5 h-4 bg-cyan-400 rounded-full inline-block"></span>
                        Сүүлд үзсэн
                      </h3>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            setReadingHistory([]);
                            localStorage.removeItem('ayako_reading_history');
                          }}
                          className="text-[10px] text-red-400 font-semibold uppercase tracking-wider hover:underline cursor-pointer"
                        >
                          Түүх арилгах ✕
                        </button>
                        <button
                          onClick={() => setActiveTab('recently_viewed')}
                          className="text-xs text-cyan-400 font-semibold uppercase tracking-wider hover:underline cursor-pointer"
                        >
                          Бүгд ▶
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-flow-col auto-cols-[30%] sm:auto-cols-[24%] md:auto-cols-[20%] lg:auto-cols-[18.5%] gap-3 sm:gap-4 overflow-x-auto scrollbar-none pb-2 select-none">
                      {recentHistoryItems.map(({ manga, chapter }) => (
                        <div
                          key={`${manga.id}-${chapter.id}`}
                          onClick={() => {
                            setSelectedManga(manga);
                            setActiveChapter(chapter);
                          }}
                          className="flex flex-col cursor-pointer group shrink-0"
                        >
                          <div className="aspect-[3/4] rounded-xl overflow-hidden shadow-lg mb-2 relative">
                            <SmartImage
                              key={manga.coverUrl}
                              src={manga.coverUrl}
                              alt={manga.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                          <h4 className="font-sans font-extrabold text-[10px] sm:text-xs md:text-sm text-brand-text truncate leading-tight group-hover:text-cyan-400 transition-all">
                            {manga.title}
                          </h4>
                          <span className="text-[8px] sm:text-xs text-cyan-400 font-mono mt-0.5 font-semibold">
                            {chapter.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3.5. Сүүлд үзсэн хэсгийн яг доорх Ковер зураг / Бичлэг (Main Cover Banner) */}
                <div id="home-cover-banner" className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-cyan-500/20 shadow-2xl bg-[#0b0c0e] group transition-all min-h-[220px] h-auto sm:h-[300px] md:h-[380px] lg:h-[420px] flex flex-col justify-end">
                  <AnimatePresence mode="wait">
                    {isVideoUrl(homeBannerUrl) ? (
                      <motion.video
                        key={`video-${homeBannerUrl}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5, ease: 'easeInOut' }}
                        ref={bannerVideoRef}
                        src={homeBannerUrl}
                        autoPlay
                        loop
                        muted={isBannerMuted}
                        playsInline
                        preload="auto"
                        disablePictureInPicture
                        disableRemotePlayback
                        className="absolute inset-0 w-full h-full object-cover rounded-2xl sm:rounded-3xl pointer-events-none transform-gpu"
                        style={{ transform: 'translateZ(0)' }}
                      />
                    ) : (
                      <motion.img
                        key={`img-${homeBannerUrl || DEFAULT_HOME_BANNER}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.5, ease: 'easeInOut' }}
                        src={homeBannerUrl || DEFAULT_HOME_BANNER}
                        alt="Ковер баннер"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          if (e.currentTarget.src !== DEFAULT_HOME_BANNER) {
                            console.warn("Banner image load error:", homeBannerUrl);
                            e.currentTarget.src = DEFAULT_HOME_BANNER;
                          }
                        }}
                        className="absolute inset-0 w-full h-full object-cover rounded-2xl sm:rounded-3xl group-hover:scale-[1.01] transition-transform duration-500"
                      />
                    )}
                  </AnimatePresence>
                  {/* Vignette overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0b0c0e] via-black/40 to-black/10 pointer-events-none" />

                  {/* Overlay Content & Controls */}
                  <div className="relative p-3 sm:p-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3 z-20 max-w-full overflow-hidden">
                    <div className="space-y-1 max-w-xl w-full min-w-0 overflow-hidden break-words">
                      <h2 className="text-lg sm:text-2xl md:text-3xl font-display font-black text-white drop-shadow-md tracking-wide break-words line-clamp-2 max-w-full">
                        {bannerTitle}
                      </h2>
                      <p className="text-xs sm:text-sm text-cyan-200/90 font-medium drop-shadow leading-relaxed break-words line-clamp-2 sm:line-clamp-3 max-w-full">
                        {bannerSubtitle}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 max-w-full min-w-0 shrink-0">
                      {/* Sound toggle button for video or audio cover */}
                      {(isVideoUrl(homeBannerUrl) || !!homeBannerAudioUrl) && (
                        <button
                          type="button"
                          onClick={toggleBannerAudio}
                          className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-black/70 hover:bg-black/90 backdrop-blur-md border border-white/20 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-lg active:scale-95 shrink-0"
                          title={isBannerMuted ? "Дууг нээх" : "Дууг хаах"}
                        >
                          {isBannerMuted ? (
                            <>
                              <VolumeX className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400" />
                              <span className="text-[11px]">Дуугүй</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400 animate-pulse" />
                              <span className="text-[11px]">Дуутай</span>
                            </>
                          )}
                        </button>
                      )}

                      {/* Super Admin & Admin Controls */}
                      {(currentUser?.role === 'super_admin' || currentUser?.role === 'admin') && (
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 max-w-full min-w-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditTitleInput(bannerTitle);
                              setEditSubtitleInput(bannerSubtitle);
                              setIsEditingBannerText(true);
                            }}
                            className="px-2.5 py-1.5 sm:px-3.5 sm:py-2 bg-black/70 hover:bg-black/90 text-cyan-300 border border-cyan-500/40 font-extrabold text-[11px] sm:text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-lg transition-all active:scale-95 shrink-0 backdrop-blur-md"
                            title="Ковер бичвэр засах"
                          >
                            <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" />
                            <span>Бичвэр засах</span>
                          </button>

                          {/* Background Audio Selection for Cover (YouTube & TikTok Links Only) */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={handleAudioUrlPrompt}
                              className="px-2.5 py-1.5 sm:px-3.5 sm:py-2 bg-amber-950/80 hover:bg-amber-900 text-amber-200 border border-amber-500/50 font-extrabold text-[11px] sm:text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-lg transition-all active:scale-95 backdrop-blur-md"
                              title="YouTube эсвэл TikTok бичлэг/дууны линк оруулах"
                            >
                              <Music className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-300 animate-pulse" />
                              <span>Дууны линк (YouTube/TikTok)</span>
                            </button>
                          </div>

                          {homeBannerAudioUrl && (
                            <button
                              type="button"
                              onClick={handleRemoveAudio}
                              className="p-1.5 sm:p-2 bg-red-950/80 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/40 rounded-xl cursor-pointer shadow-lg transition-all active:scale-95 backdrop-blur-md shrink-0"
                              title="Дуу устгах"
                            >
                              <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={handleBannerUrlPrompt}
                            className="px-2.5 py-1.5 sm:px-3 sm:py-2 bg-black/70 hover:bg-black/90 text-cyan-300 border border-cyan-500/40 font-extrabold text-[11px] sm:text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-lg transition-all active:scale-95 shrink-0 backdrop-blur-md"
                            title="Ковер зураг эсвэл видеоны URL холбоос оруулах"
                          >
                            <LinkIcon className="w-3.5 h-3.5 text-cyan-300" />
                            <span>Ковер URL</span>
                          </button>

                          <label className="px-2.5 py-1.5 sm:px-3.5 sm:py-2 bg-cyan-400 hover:bg-cyan-300 text-black font-extrabold text-[11px] sm:text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-lg transition-all active:scale-95 shrink-0">
                            {isUploadingBanner ? (
                              <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin text-black" />
                            ) : (
                              <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            )}
                            <span>
                              {isUploadingBanner ? 'Уншиж байна...' : 'Ковер солих'}
                            </span>
                            <input
                              type="file"
                              accept="image/*,video/*"
                              className="hidden"
                              disabled={isUploadingBanner}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleBannerFileSelect(file);
                                e.target.value = '';
                              }}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3.6. Ковер зургийн доорх Жанрийн тусгай хэсгүүд (Romance, Action, Yaoi) */}
                <GenreShowcaseSections
                  mangas={mangas}
                  latestChaptersMap={latestChaptersMap}
                  onSelectManga={setSelectedManga}
                  canDelete={currentUser?.role === 'super_admin'}
                  onDeleteManga={handleDeleteManga}
                  savedMangaIds={currentUser?.savedMangaIds}
                  onToggleSave={handleToggleSaveManga}
                  onCopyLink={handleCopyLink}
                />

                {/* 3.7. Энэ долоо хоногийн трэнд (Popular This Week Chart) - Зөвхөн Админуудад харагдана */}
                {(currentUser?.role === 'super_admin' || currentUser?.role === 'admin') && (
                  <PopularThisWeekChart
                    mangas={mangas}
                    onSelectManga={setSelectedManga}
                  />
                )}

                {/* 4. Топ хэрэглэгчид (Top Users) Leaderboard Section */}
                <div className="bg-[#0b0c0e] border border-amber-500/15 p-4 sm:p-6 rounded-3xl shadow-2xl space-y-5 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-lg shadow-amber-500/10">
                        <Trophy className="w-5 h-5 sm:w-6 sm:h-6" />
                      </div>
                      <div>
                        <h3 className="font-serif italic font-extrabold text-base sm:text-xl text-amber-300 tracking-wide glow-text">
                          Топ хэрэглэгчид
                        </h3>
                        <p className="text-[10px] sm:text-xs text-brand-text-dark font-medium leading-tight">
                          Энэ сар хамгийн олон оноо цуглуулсан идэвхтэй уншигчид
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setActiveTab('top_users')}
                      className="text-xs text-amber-400 font-semibold uppercase tracking-wider hover:underline cursor-pointer shrink-0"
                    >
                      Бүгд ▶
                    </button>
                  </div>

                  {/* Points explanation banner */}
                  <div className="bg-brand-card/60 border border-amber-500/10 rounded-2xl p-3 text-[10px] sm:text-xs text-brand-text-dark flex flex-wrap gap-x-4 gap-y-1 items-center">
                    <span className="font-bold text-amber-400 uppercase tracking-wider">Онооны дүрэм:</span>
                    <span>📖 1 бүлэг унших = <strong>1 оноо</strong></span>
                    <span>💬 1 сэтгэгдэл бичих = <strong>2 оноо</strong></span>
                    <span>❤️ 1 манга дээр зүрх дарах = <strong>2 оноо</strong> (1 удаа)</span>
                  </div>

                  {/* Top 3 users ranking cards */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-4">
                    {topUsersWithPoints.slice(0, 3).map(({ user, readCount, commentCount, likedCount, totalPoints }, idx) => {
                      const rank = idx + 1;
                      const isTop1 = rank === 1;
                      const isTop2 = rank === 2;
                      const isTop3 = rank === 3;

                      return (
                        <div
                          key={user.id}
                          className={`p-2.5 sm:p-4 rounded-2xl border flex flex-col items-center text-center justify-between transition-all ${
                            isTop1
                              ? 'bg-gradient-to-b from-amber-500/20 via-amber-500/5 to-transparent border-amber-500/50 shadow-lg shadow-amber-500/10'
                              : isTop2
                              ? 'bg-gradient-to-b from-slate-400/20 via-slate-400/5 to-transparent border-slate-400/40'
                              : 'bg-gradient-to-b from-amber-700/20 via-amber-700/5 to-transparent border-amber-700/40'
                          }`}
                        >
                          <div className="mb-1.5">
                            {isTop1 ? (
                              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                                <Crown className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 animate-bounce" />
                              </div>
                            ) : isTop2 ? (
                              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-400/20 border border-slate-400/40 flex items-center justify-center text-slate-200 font-extrabold text-xs sm:text-sm">
                                #2
                              </div>
                            ) : (
                              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-amber-700/20 border border-amber-700/40 flex items-center justify-center text-amber-500 font-extrabold text-xs sm:text-sm">
                                #3
                              </div>
                            )}
                          </div>

                          <div className="w-full mb-2">
                            <h4 className="font-extrabold text-xs sm:text-sm text-brand-text truncate w-full" title={user.username}>
                              {user.username}
                            </h4>
                            <span className="inline-block text-[8px] sm:text-[10px] px-1.5 py-0.5 bg-brand-bg border border-brand-accent/10 rounded text-amber-400 font-semibold uppercase mt-0.5">
                              {user.role === 'super_admin' ? 'Админ' : user.role === 'admin' ? 'Админ' : 'Уншигч'}
                            </span>
                          </div>

                          <div className="w-full mb-1">
                            <span className="block w-full py-1 bg-amber-400/10 border border-amber-400/30 text-amber-300 font-black text-xs sm:text-sm rounded-xl">
                              {totalPoints} <span className="text-[9px] font-normal">оноо</span>
                            </span>
                          </div>

                          <div className="flex items-center justify-center gap-1 text-[8px] sm:text-[10px] text-brand-text-dark font-mono pt-1.5 border-t border-brand-accent/10 w-full">
                            <span title="Уншсан">📖 {readCount}</span>
                            <span>•</span>
                            <span title="Сэтгэгдэл">💬 {commentCount}</span>
                            <span>•</span>
                            <span title="Зүрх">❤️ {likedCount}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>

            {/* Dedicated View for "Топ хэрэглэгчид" (Top Users Leaderboard) */}
            {activeTab === 'top_users' && (
              <div className="max-w-7xl mx-auto px-2 sm:px-4 py-6 sm:py-10 space-y-6 animate-fade-in">
                <div className="flex items-center justify-between border-b border-amber-500/15 pb-4">
                  <div className="flex items-center gap-2.5 text-amber-300 font-serif italic font-extrabold text-lg sm:text-2xl">
                    <Trophy className="w-6 h-6 sm:w-7 sm:h-7 text-amber-400" />
                    <span>Топ хэрэглэгчдийн жагсаалт</span>
                  </div>
                  <button
                    onClick={() => setActiveTab('home')}
                    className="px-3 py-1.5 bg-brand-card hover:bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Нүүр хуудас
                  </button>
                </div>

                {/* Points explanation banner */}
                <div className="bg-brand-card/60 border border-amber-500/15 rounded-2xl p-3 sm:p-4 text-xs text-brand-text-dark flex flex-wrap gap-x-5 gap-y-1.5 items-center">
                  <span className="font-bold text-amber-400 uppercase tracking-wider">Онооны дүрэм:</span>
                  <span>📖 1 бүлэг унших = <strong>1 оноо</strong></span>
                  <span>💬 1 сэтгэгдэл бичих = <strong>2 оноо</strong></span>
                  <span>❤️ 1 манга дээр зүрх дарах = <strong>2 оноо</strong> (1 удаа)</span>
                </div>

                {/* All top users grid: 3 columns on phone (grid-cols-3), 5 columns on desktop (md:grid-cols-5) */}
                <div className="grid grid-cols-3 md:grid-cols-5 gap-2.5 sm:gap-4">
                  {topUsersWithPoints.map(({ user, readCount, commentCount, likedCount, totalPoints }, idx) => {
                    const rank = idx + 1;
                    const isTop1 = rank === 1;
                    const isTop2 = rank === 2;
                    const isTop3 = rank === 3;

                    return (
                      <div
                        key={user.id}
                        className={`p-2.5 sm:p-4 rounded-2xl border flex flex-col items-center text-center justify-between transition-all ${
                          isTop1
                            ? 'bg-gradient-to-b from-amber-500/20 via-amber-500/5 to-transparent border-amber-500/50 shadow-lg shadow-amber-500/10'
                            : isTop2
                            ? 'bg-gradient-to-b from-slate-400/20 via-slate-400/5 to-transparent border-slate-400/40'
                            : isTop3
                            ? 'bg-gradient-to-b from-amber-700/20 via-amber-700/5 to-transparent border-amber-700/40'
                            : 'bg-brand-card/60 border-brand-accent/10 hover:border-amber-500/30'
                        }`}
                      >
                        {/* Rank Badge */}
                        <div className="mb-2">
                          {isTop1 ? (
                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                              <Crown className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 animate-bounce" />
                            </div>
                          ) : isTop2 ? (
                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-400/20 border border-slate-400/40 flex items-center justify-center text-slate-200 font-extrabold text-xs sm:text-sm">
                              #2
                            </div>
                          ) : isTop3 ? (
                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-amber-700/20 border border-amber-700/40 flex items-center justify-center text-amber-500 font-extrabold text-xs sm:text-sm">
                              #3
                            </div>
                          ) : (
                            <div className="w-7 h-7 rounded-lg bg-brand-bg border border-brand-accent/10 flex items-center justify-center text-brand-text-dark font-mono text-xs font-bold">
                              #{rank}
                            </div>
                          )}
                        </div>

                        {/* User details */}
                        <div className="w-full mb-3">
                          <h4 className="font-extrabold text-xs sm:text-sm text-brand-text truncate w-full" title={user.username}>
                            {user.username}
                          </h4>
                          <span className="inline-block text-[8px] sm:text-[10px] px-1.5 py-0.5 bg-brand-bg border border-brand-accent/10 rounded text-amber-400 font-semibold uppercase mt-1">
                            {user.role === 'super_admin' ? 'Админ' : user.role === 'admin' ? 'Админ' : 'Уншигч'}
                          </span>
                        </div>

                        {/* Points Pill */}
                        <div className="w-full mb-2">
                          <span className="block w-full py-1 bg-amber-400/10 border border-amber-400/30 text-amber-300 font-black text-xs sm:text-sm rounded-xl">
                            {totalPoints} <span className="text-[9px] font-normal">оноо</span>
                          </span>
                        </div>

                        {/* Activity Breakdown */}
                        <div className="flex items-center justify-center gap-1.5 text-[9px] sm:text-[10px] text-brand-text-dark font-mono pt-2 border-t border-brand-accent/10 w-full">
                          <span title="Уншсан бүлэг">📖 {readCount}</span>
                          <span>•</span>
                          <span title="Сэтгэгдэл">💬 {commentCount}</span>
                          <span>•</span>
                          <span title="Зүрх">❤️ {likedCount}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Dedicated View for "Шинэ манга" (New Manga) */}
            {activeTab === 'new_mangas' && (
              <div className="max-w-7xl mx-auto px-2 sm:px-4 py-6 sm:py-10 space-y-6 animate-fade-in">
                <div className="flex items-center justify-between border-b border-cyan-500/10 pb-4">
                  <div className="flex items-center gap-2 text-cyan-400 font-serif italic font-extrabold text-base sm:text-2xl">
                    <Sparkles className="w-6 h-6 text-cyan-400" />
                    <span>Шинэ нэмэгдсэн 30 манга</span>
                  </div>
                  <button
                    onClick={() => setActiveTab('home')}
                    className="px-3 py-1.5 bg-brand-card hover:bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Нүүр хуудас
                  </button>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4 md:gap-5">
                  {new30Mangas.map((manga) => {
                    const stats = getMangaProgressStats(manga.id);
                    return (
                      <MangaCard
                        key={manga.id}
                        manga={manga}
                        onSelect={(m) => setSelectedManga(m)}
                        canDelete={currentUser?.role === 'super_admin'}
                        onDelete={handleDeleteManga}
                        isSaved={currentUser?.savedMangaIds?.includes(manga.id)}
                        onToggleSave={handleToggleSaveManga}
                        onCopyLink={handleCopyLink}
                        readChaptersCount={stats.readChaptersCount}
                        totalChaptersCount={stats.totalChaptersCount}
                        readPercentage={stats.readPercentage}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* Dedicated View for "Шинэ бүлэг" (New Chapters) */}
            {activeTab === 'new_chapters' && (
              <div className="max-w-7xl mx-auto px-2 sm:px-4 py-6 sm:py-10 space-y-6 animate-fade-in">
                <div className="flex items-center justify-between border-b border-brand-accent/10 pb-4">
                  <div className="flex items-center gap-2 text-brand-accent font-serif italic font-extrabold text-base sm:text-2xl">
                    <BookOpen className="w-6 h-6 text-brand-accent" />
                    <span>Бүх шинээр нэмэгдсэн бүлгүүд</span>
                  </div>
                  <button
                    onClick={() => setActiveTab('home')}
                    className="px-3 py-1.5 bg-brand-card hover:bg-brand-accent/10 border border-brand-accent/20 text-brand-accent rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Нүүр хуудас
                  </button>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4 md:gap-5">
                  {latestChaptersForMangas.map(({ manga, chapter }) => (
                    <div
                      key={chapter.id}
                      onClick={() => handleOpenChapter(manga, chapter)}
                      className="flex flex-col cursor-pointer group select-none bg-brand-card/40 p-1.5 sm:p-2 rounded-2xl border border-brand-accent/5 hover:border-brand-accent/30 transition-all"
                    >
                      <div className="aspect-[3/4] rounded-xl overflow-hidden shadow-lg mb-2 relative">
                        <SmartImage
                          key={manga.coverUrl}
                          src={manga.coverUrl}
                          alt={manga.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                      <h4 className="font-sans font-extrabold text-[11px] sm:text-xs md:text-sm text-brand-text line-clamp-2 leading-tight group-hover:text-brand-accent transition-all px-1">
                        {manga.title}
                      </h4>
                      <span className="text-[9px] sm:text-xs text-brand-accent font-mono mt-0.5 font-semibold px-1">
                        {chapter.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Dedicated View for "Сүүлд үзсэн" (Recently Viewed) */}
            {activeTab === 'recently_viewed' && (
              <div className="max-w-7xl mx-auto px-2 sm:px-4 py-6 sm:py-10 space-y-6 animate-fade-in">
                <div className="flex items-center justify-between border-b border-cyan-500/10 pb-4">
                  <div className="flex items-center gap-2 text-cyan-400 font-serif italic font-extrabold text-base sm:text-2xl">
                    <Clock className="w-6 h-6 text-cyan-400" />
                    <span>Сүүлд үзсэн манга ба бүлгүүд</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setReadingHistory([]);
                        localStorage.removeItem('ayako_reading_history');
                      }}
                      className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl text-xs font-semibold transition-all cursor-pointer border border-red-500/20"
                    >
                      Түүх арилгах ✕
                    </button>
                    <button
                      onClick={() => setActiveTab('home')}
                      className="px-3 py-1.5 bg-brand-card hover:bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Нүүр хуудас
                    </button>
                  </div>
                </div>

                {recentHistoryItems.length === 0 ? (
                  <div className="py-20 text-center text-brand-text-dark space-y-2 bg-brand-card/40 rounded-2xl border border-brand-accent/5">
                    <Clock className="w-8 h-8 text-cyan-400/40 mx-auto" />
                    <p className="text-sm">Одоогоор уншсан түүх байхгүй байна.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4 md:gap-5">
                    {recentHistoryItems.map(({ manga, chapter }) => {
                      const chThumb = chapter.posterUrl || (chapter.images && chapter.images.length > 0 ? chapter.images[0] : manga.coverUrl) || DEFAULT_FALLBACK_IMAGE;
                      return (
                        <div
                          key={`${manga.id}-${chapter.id}`}
                          onClick={() => handleOpenChapter(manga, chapter)}
                          className="flex flex-col cursor-pointer group select-none bg-brand-card/40 p-1.5 sm:p-2 rounded-2xl border border-brand-accent/5 hover:border-cyan-400/30 transition-all"
                        >
                          <div className="aspect-[3/4] rounded-xl overflow-hidden shadow-lg mb-2 relative">
                            <SmartImage
                              key={chThumb}
                              src={chThumb}
                              fallbackSrc={manga.coverUrl || DEFAULT_FALLBACK_IMAGE}
                              alt={manga.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                          <h4 className="font-sans font-extrabold text-[11px] sm:text-xs md:text-sm text-brand-text line-clamp-2 leading-tight group-hover:text-cyan-400 transition-all px-1">
                            {manga.title}
                          </h4>
                          <span className="text-[9px] sm:text-xs text-cyan-400 font-mono mt-0.5 font-semibold px-1">
                            {chapter.title}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Dedicated View for Search Results */}
            {activeTab === 'search_results' && (
              <div className="max-w-7xl mx-auto px-2 sm:px-4 py-6 sm:py-10 space-y-6 animate-fade-in">
                <div className="flex items-center justify-between border-b border-cyan-500/10 pb-4">
                  <div className="flex items-center gap-2 text-cyan-400 font-serif italic font-extrabold text-base sm:text-2xl">
                    <Search className="w-6 h-6 text-cyan-400" />
                    <span>"{searchQuery}" хайлтын илэрц</span>
                  </div>
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setActiveTab('home');
                    }}
                    className="px-3 py-1.5 bg-brand-card hover:bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Нүүр хуудас
                  </button>
                </div>

                {filteredMangas.length === 0 ? (
                  <div className="py-20 text-center text-brand-text-dark space-y-2 bg-brand-card/40 rounded-2xl border border-brand-accent/5">
                    <Search className="w-8 h-8 text-cyan-400/40 mx-auto" />
                    <p className="text-sm">"{searchQuery}" хайлтанд тохирох манга олдсонгүй.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4 md:gap-5">
                    {filteredMangas.map((manga) => (
                      <MangaCard
                        key={manga.id}
                        manga={manga}
                        onSelect={(m) => setSelectedManga(m)}
                        canDelete={currentUser?.role === 'super_admin'}
                        onDelete={handleDeleteManga}
                        isSaved={currentUser?.savedMangaIds?.includes(manga.id)}
                        onToggleSave={handleToggleSaveManga}
                        onCopyLink={handleCopyLink}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Dedicated View for "Манга" (Manga Catalog) */}
            {activeTab === 'manga' && (
              <div className="max-w-7xl mx-auto px-2 sm:px-4 py-6 sm:py-10 space-y-8 animate-fade-in">
                {/* Page Title & Navigation */}
                <div className="flex items-center justify-between border-b border-brand-accent/10 pb-4">
                  <div className="flex items-center gap-2.5 text-brand-accent font-serif italic font-extrabold text-lg sm:text-2xl">
                    <BookOpen className="w-6 h-6 sm:w-7 sm:h-7 text-brand-accent" />
                    <span>Манга хэсэг</span>
                  </div>
                  <button
                    onClick={() => setActiveTab('home')}
                    className="px-3 py-1.5 bg-brand-card hover:bg-brand-accent/10 border border-brand-accent/20 text-brand-accent rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Нүүр хуудас
                  </button>
                </div>

                {/* 1. Шилдэг бүтээлүүд хэсэг */}
                <div className="bg-[#0b0c0e] border border-cyan-500/10 p-4 sm:p-6 rounded-3xl shadow-2xl space-y-5">
                  <div className="flex items-center gap-3 sm:gap-4">
                    {/* Glowing trend icon box in water-blue (cyan) */}
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 shadow-lg shadow-cyan-500/10 animate-pulse">
                      <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
                    </div>
                    <div className="space-y-0.5">
                      <h3 className="font-serif italic font-extrabold text-base sm:text-xl text-cyan-300 tracking-wide glow-text">
                        Шилдэг бүтээлүүд
                      </h3>
                      <p className="text-[10px] sm:text-xs text-brand-text-dark font-medium leading-tight">
                        Энэ 7 хоногийн болон нийт хамгийн их уншигдсан мангануудыг шүүж харах
                      </p>
                    </div>
                  </div>

                  {/* 3 clickable buttons in water-blue (cyan) */}
                  <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
                    {/* Button 1: Бүх түүхүүд */}
                    <button
                      onClick={() => setSpecialFilter('all')}
                      className={`relative overflow-hidden h-20 sm:h-24 rounded-2xl flex items-center justify-center transition-all cursor-pointer p-2 active:scale-95 ${
                        specialFilter === 'all'
                          ? 'bg-gradient-to-br from-cyan-400 to-[#0096c7] text-[#0b0b0f] font-black shadow-lg shadow-cyan-500/30 ring-1 ring-white/20'
                          : 'bg-[#121316] border border-cyan-500/10 hover:border-cyan-400/30 text-brand-text-dark hover:text-brand-text'
                      }`}
                    >
                      <span className="text-center text-[10px] sm:text-[11px] font-sans font-semibold tracking-wide leading-tight">
                        📚 Бүх<br />түүхүүд
                      </span>
                    </button>

                    {/* Button 2: Энэ 7 хоногийн шилдэг 10 */}
                    <button
                      onClick={() => setSpecialFilter('weekly_top10')}
                      className={`relative overflow-hidden h-20 sm:h-24 rounded-2xl flex items-center justify-center transition-all cursor-pointer p-2 active:scale-95 ${
                        specialFilter === 'weekly_top10'
                          ? 'bg-gradient-to-br from-cyan-400 to-[#0096c7] text-[#0b0b0f] font-black shadow-lg shadow-cyan-500/30 ring-1 ring-white/20'
                          : 'bg-[#121316] border border-cyan-500/10 hover:border-cyan-400/30 text-brand-text-dark hover:text-brand-text'
                      }`}
                    >
                      <span className="text-center text-[10px] sm:text-[11px] font-sans font-semibold tracking-wide leading-tight">
                        🔥 Энэ 7<br />хоногийн<br />шилдэг 10
                      </span>
                    </button>

                    {/* Button 3: Хамгийн олон үзэлттэй 30 */}
                    <button
                      onClick={() => setSpecialFilter('most_viewed30')}
                      className={`relative overflow-hidden h-20 sm:h-24 rounded-2xl flex items-center justify-center transition-all cursor-pointer p-2 active:scale-95 ${
                        specialFilter === 'most_viewed30'
                          ? 'bg-gradient-to-br from-cyan-400 to-[#0096c7] text-[#0b0b0f] font-black shadow-lg shadow-cyan-500/30 ring-1 ring-white/20'
                          : 'bg-[#121316] border border-cyan-500/10 hover:border-cyan-400/30 text-brand-text-dark hover:text-brand-text'
                      }`}
                    >
                      <span className="text-center text-[10px] sm:text-[11px] font-sans font-semibold tracking-wide leading-tight">
                        👁️ Хамгийн<br />олон<br />үзэлттэй 30
                      </span>
                    </button>
                  </div>
                </div>

                {/* 2. МАНГА ШҮҮЛТҮҮРҮҮД: (Matching uploaded screenshot) */}
                <div className="space-y-3 pt-2">
                  <p className="text-[11px] sm:text-xs text-slate-200 font-extrabold uppercase tracking-widest px-1">
                    МАНГА ШҮҮЛТҮҮРҮҮД:
                  </p>

                  <div className="grid grid-cols-3 gap-2.5 max-w-2xl">
                    {/* Төрөл Dropdown Button */}
                    <button
                      onClick={() => setActiveDropdown(activeDropdown === 'type' ? null : 'type')}
                      className={`px-3 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold tracking-wide transition-all cursor-pointer flex items-center justify-between border ${
                        activeDropdown === 'type' || selectedType !== 'Бүгд'
                          ? 'bg-cyan-950/80 border-cyan-400 text-cyan-300 shadow-md shadow-cyan-500/10'
                          : 'bg-[#121316] border-slate-700/60 text-slate-200 hover:border-slate-500'
                      }`}
                    >
                      <span className="truncate">Төрөл: {typeLabels[selectedType] || selectedType}</span>
                      <span className="text-[9px] opacity-70 ml-1 shrink-0">{activeDropdown === 'type' ? '▲' : '▼'}</span>
                    </button>

                    {/* Жанр Dropdown Button */}
                    <button
                      onClick={() => setActiveDropdown(activeDropdown === 'genre' ? null : 'genre')}
                      className={`px-3 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold tracking-wide transition-all cursor-pointer flex items-center justify-between border ${
                        activeDropdown === 'genre' || selectedGenre !== 'Бүгд'
                          ? 'bg-cyan-950/80 border-cyan-400 text-cyan-300 shadow-md shadow-cyan-500/10'
                          : 'bg-[#121316] border-slate-700/60 text-slate-200 hover:border-slate-500'
                      }`}
                    >
                      <span className="truncate">Жанр: {selectedGenre}</span>
                      <span className="text-[9px] opacity-70 ml-1 shrink-0">{activeDropdown === 'genre' ? '▲' : '▼'}</span>
                    </button>

                    {/* Төлөв Dropdown Button */}
                    <button
                      onClick={() => setActiveDropdown(activeDropdown === 'status' ? null : 'status')}
                      className={`px-3 py-2.5 rounded-2xl text-xs sm:text-sm font-semibold tracking-wide transition-all cursor-pointer flex items-center justify-between border ${
                        activeDropdown === 'status' || (selectedStatus !== 'Бүх Төлөв' && selectedStatus !== 'Бүгд')
                          ? 'bg-cyan-950/80 border-cyan-400 text-cyan-300 shadow-md shadow-cyan-500/10'
                          : 'bg-[#121316] border-slate-700/60 text-slate-200 hover:border-slate-500'
                      }`}
                    >
                      <span className="truncate">Төлөв: {statusLabels[selectedStatus] || selectedStatus}</span>
                      <span className="text-[9px] opacity-70 ml-1 shrink-0">{activeDropdown === 'status' ? '▲' : '▼'}</span>
                    </button>
                  </div>

                  {/* Active Dropdown Options Panel */}
                  {activeDropdown && (
                    <div className="bg-[#121316] border border-cyan-500/30 rounded-2xl p-4 shadow-xl animate-fade-in space-y-3 max-w-2xl">
                      {activeDropdown === 'type' && (
                        <div>
                          <p className="text-[10px] text-brand-text-dark font-bold uppercase tracking-wider mb-2">Шүүх формат (Төрөл):</p>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(typeLabels).map(([key, label]) => {
                              const isSelected = selectedType === key;
                              return (
                                <button
                                  key={key}
                                  onClick={() => {
                                    setSelectedType(key);
                                    setActiveDropdown(null);
                                  }}
                                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                                    isSelected
                                      ? 'bg-cyan-400 text-black font-bold shadow-md shadow-cyan-500/20'
                                      : 'bg-brand-card border border-white/10 text-brand-text-dark hover:border-cyan-400/30 hover:text-brand-text'
                                  }`}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {activeDropdown === 'genre' && (
                        <div>
                          <p className="text-[10px] text-brand-text-dark font-bold uppercase tracking-wider mb-2">Шүүх жанрууд:</p>
                          <div className="flex flex-wrap gap-1.5 max-h-[180px] overflow-y-auto scrollbar-thin scrollbar-thumb-cyan-500/20">
                            <button
                              onClick={() => {
                                setSelectedGenre('Бүгд');
                                setActiveDropdown(null);
                              }}
                              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                                selectedGenre === 'Бүгд'
                                  ? 'bg-cyan-400 text-black font-bold shadow-md shadow-cyan-500/20'
                                  : 'bg-brand-card border border-white/10 text-brand-text-dark hover:border-cyan-400/30 hover:text-brand-text'
                              }`}
                            >
                              Бүгд
                            </button>
                            {allGenres.map((g) => {
                              const isSelected = selectedGenre === g;
                              return (
                                <button
                                  key={g}
                                  onClick={() => {
                                    setSelectedGenre(g);
                                    setActiveDropdown(null);
                                  }}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                                    isSelected
                                      ? 'bg-cyan-400 text-black font-bold shadow-md shadow-cyan-500/20'
                                      : 'bg-brand-card border border-white/10 text-brand-text-dark hover:border-cyan-400/30 hover:text-brand-text'
                                  }`}
                                >
                                  {g}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {activeDropdown === 'status' && (
                        <div>
                          <p className="text-[10px] text-brand-text-dark font-bold uppercase tracking-wider mb-2">Шүүх төлөв:</p>
                          <div className="flex flex-wrap gap-2">
                            {['Бүгд', 'Гарч буй', 'Дууссан', 'Гаргалт гүйцсэн'].map((statusOption) => {
                              const isSelected = selectedStatus === statusOption || (statusOption === 'Бүгд' && selectedStatus === 'Бүх Төлөв');
                              return (
                                <button
                                  key={statusOption}
                                  onClick={() => {
                                    setSelectedStatus(statusOption === 'Бүгд' ? 'Бүх Төлөв' : statusOption);
                                    setActiveDropdown(null);
                                  }}
                                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                                    isSelected
                                      ? 'bg-cyan-400 text-black font-bold shadow-md shadow-cyan-500/20'
                                      : 'bg-brand-card border border-white/10 text-brand-text-dark hover:border-cyan-400/30 hover:text-brand-text'
                                  }`}
                                >
                                  {statusOption}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 3. Бүх түүхүүд (matching uploaded screenshot title: 🧭 Бүх түүхүүд) */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="font-serif italic font-extrabold text-lg sm:text-2xl text-cyan-400 tracking-wide glow-text flex items-center gap-2">
                      <Compass className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400 shrink-0" />
                      <span>
                        {specialFilter === 'weekly_top10' 
                          ? 'Энэ 7 хоногийн шилдэг 10' 
                          : specialFilter === 'most_viewed30' 
                          ? 'Хамгийн олон үзэлттэй 30' 
                          : 'Бүх түүхүүд'}
                      </span>
                      <span className="text-xs font-sans not-italic text-brand-text-dark font-normal ml-1">({sortedAndFilteredMangas.length})</span>
                    </h3>
                    {(selectedType !== 'Бүгд' || selectedGenre !== 'Бүгд' || selectedStatus !== 'Бүх Төлөв') && (
                      <button
                        onClick={() => {
                          setSelectedType('Бүгд');
                          setSelectedGenre('Бүгд');
                          setSelectedStatus('Бүх Төлөв');
                        }}
                        className="text-xs text-rose-400 hover:underline font-semibold cursor-pointer"
                      >
                        Шүүлтүүр арилгах ✕
                      </button>
                    )}
                  </div>

                  {sortedAndFilteredMangas.length === 0 ? (
                    <div className="py-20 text-center text-brand-text-dark space-y-2 bg-brand-card/40 rounded-2xl border border-brand-accent/5">
                      <BookOpen className="w-8 h-8 text-brand-accent/40 mx-auto" />
                      <p className="text-sm">Таны сонгосон шүүлтүүрт тохирох манга олдсонгүй.</p>
                    </div>
                  ) : (
                    <>
                      {/* 3 columns on phone (grid-cols-3), 5 columns on desktop (md:grid-cols-5) */}
                      <div className="grid grid-cols-3 md:grid-cols-5 gap-2.5 sm:gap-4 md:gap-5">
                        {sortedAndFilteredMangas
                          .slice((catalogPage - 1) * CATALOG_PAGE_SIZE, catalogPage * CATALOG_PAGE_SIZE)
                          .map((manga, index) => {
                            const mangaChapters = chapters.filter((ch) => String(ch.mangaId || '').trim().toLowerCase() === String(manga.id || '').trim().toLowerCase());
                            const latestChapter = mangaChapters.length > 0
                              ? mangaChapters.reduce((latest, current) => {
                                  const currentNum = parseFloat(current.title.match(/\d+(\.\d+)?/)?.[0] || '0');
                                  const latestNum = parseFloat(latest.title.match(/\d+(\.\d+)?/)?.[0] || '0');
                                  return currentNum > latestNum ? current : latest;
                                }, mangaChapters[0])
                              : null;

                            const stats = getMangaProgressStats(manga.id);
                            const actualRank = (catalogPage - 1) * CATALOG_PAGE_SIZE + index + 1;
                            return (
                              <MangaCard
                                key={manga.id}
                                manga={manga}
                                latestChapterTitle={latestChapter ? latestChapter.title : undefined}
                                onSelect={(m) => setSelectedManga(m)}
                                canDelete={currentUser?.role === 'super_admin'}
                                onDelete={handleDeleteManga}
                                rank={specialFilter !== 'all' ? actualRank : undefined}
                                isSaved={currentUser?.savedMangaIds?.includes(manga.id)}
                                onToggleSave={handleToggleSaveManga}
                                onCopyLink={handleCopyLink}
                                readChaptersCount={stats.readChaptersCount}
                                totalChaptersCount={stats.totalChaptersCount}
                                readPercentage={stats.readPercentage}
                              />
                            );
                          })}
                      </div>

                      {/* Pagination Controls */}
                      {Math.ceil(sortedAndFilteredMangas.length / CATALOG_PAGE_SIZE) > 1 && (
                        <div className="flex items-center justify-center gap-2 pt-6 pb-2 select-none">
                          <button
                            disabled={catalogPage <= 1}
                            onClick={() => {
                              setCatalogPage((p) => Math.max(1, p - 1));
                              window.scrollTo({ top: 350, behavior: 'smooth' });
                            }}
                            className="px-4 py-2 bg-[#121316] border border-cyan-500/20 hover:border-cyan-400 text-cyan-300 disabled:opacity-30 disabled:pointer-events-none rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md"
                          >
                            ◀ Өмнөх
                          </button>
                          <div className="px-3.5 py-2 bg-cyan-950/40 border border-cyan-500/30 text-cyan-300 rounded-xl text-xs font-bold">
                            Хуудас {catalogPage} / {Math.ceil(sortedAndFilteredMangas.length / CATALOG_PAGE_SIZE)}
                          </div>
                          <button
                            disabled={catalogPage >= Math.ceil(sortedAndFilteredMangas.length / CATALOG_PAGE_SIZE)}
                            onClick={() => {
                              setCatalogPage((p) => Math.min(Math.ceil(sortedAndFilteredMangas.length / CATALOG_PAGE_SIZE), p + 1));
                              window.scrollTo({ top: 350, behavior: 'smooth' });
                            }}
                            className="px-4 py-2 bg-[#121316] border border-cyan-500/20 hover:border-cyan-400 text-cyan-300 disabled:opacity-30 disabled:pointer-events-none rounded-xl text-xs font-bold transition-all cursor-pointer shadow-md"
                          >
                            Дараах ▶
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Dedicated View for "Таалагдсан" (Liked / Saved Manga) */}
            {(activeTab === 'liked' || activeTab === 'saved') && (
              <div className="max-w-7xl mx-auto px-2 sm:px-4 py-6 sm:py-10 space-y-6 animate-fade-in">
                <div className="flex items-center justify-between border-b border-rose-500/20 pb-4">
                  <div className="flex items-center gap-2.5 text-rose-400 font-serif italic font-extrabold text-lg sm:text-2xl">
                    <Heart className="w-6 h-6 sm:w-7 sm:h-7 text-rose-500 fill-rose-500/20 animate-pulse" />
                    <span>Таалагдсан манганууд</span>
                    {currentUser?.savedMangaIds && currentUser.savedMangaIds.length > 0 && (
                      <span className="text-xs font-sans not-italic px-2.5 py-0.5 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-full font-bold">
                        {currentUser.savedMangaIds.length}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setActiveTab('home')}
                    className="px-3 py-1.5 bg-brand-card hover:bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Нүүр хуудас
                  </button>
                </div>

                {/* Liked Mangas Grid - strictly 3 columns on phone (mobile grid-cols-3), 5 columns on desktop (computer md:grid-cols-5) */}
                {(() => {
                  const likedMangaIds = currentUser?.savedMangaIds || [];
                  const likedMangas = mangas.filter(m => likedMangaIds.includes(m.id));

                  if (likedMangas.length === 0) {
                    return (
                      <div className="py-20 text-center text-brand-text-dark space-y-3 bg-brand-card/40 rounded-3xl border border-rose-500/10 p-6">
                        <Heart className="w-12 h-12 text-rose-500/30 mx-auto" />
                        <h4 className="text-base font-bold text-brand-text">Одоогоор таалагдсан манга байхгүй байна</h4>
                        <p className="text-xs text-brand-text-dark max-w-md mx-auto">
                          Дуртай манганыхаа зургийн баруун дээд өнцөгт байх эсвэл унших хуудсан дээрх <span className="text-rose-400 font-bold">❤️ зүрхэн товчийг</span> дарж энэхүү таалагдсан жагсаалтад нэмээрэй!
                        </p>
                        <button
                          onClick={() => setActiveTab('manga')}
                          className="mt-2 px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
                        >
                          Манга каталоги руу очих ▶
                        </button>
                      </div>
                    );
                  }

                  return (
                    /* Strict requirement: 3 columns on phone (grid-cols-3), 5 columns on desktop (md:grid-cols-5) */
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-2.5 sm:gap-4 md:gap-5">
                      {likedMangas.map((manga) => {
                        const mangaChapters = chapters.filter((ch) => String(ch.mangaId || '').trim().toLowerCase() === String(manga.id || '').trim().toLowerCase());
                        const latestChapter = mangaChapters.length > 0
                          ? mangaChapters.reduce((latest, current) => {
                              const currentNum = parseFloat(current.title.match(/\d+(\.\d+)?/)?.[0] || '0');
                              const latestNum = parseFloat(latest.title.match(/\d+(\.\d+)?/)?.[0] || '0');
                              return currentNum > latestNum ? current : latest;
                            }, mangaChapters[0])
                          : null;

                        const stats = getMangaProgressStats(manga.id);
                        return (
                          <MangaCard
                            key={manga.id}
                            manga={manga}
                            latestChapterTitle={latestChapter ? latestChapter.title : undefined}
                            onSelect={(m) => setSelectedManga(m)}
                            canDelete={currentUser?.role === 'super_admin'}
                            onDelete={handleDeleteManga}
                            isSaved={true}
                            onToggleSave={handleToggleSaveManga}
                            onCopyLink={handleCopyLink}
                            readChaptersCount={stats.readChaptersCount}
                            totalChaptersCount={stats.totalChaptersCount}
                            readPercentage={stats.readPercentage}
                          />
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            {activeTab === 'movies' && (
              <MoviesSection
                movies={movies}
                episodes={movieEpisodes}
                currentUser={currentUser}
                onAddMovie={async (movie) => {
                  await addMovieToDb(movie);
                  setToastMsg('Шинэ кино амжилттай нэмэгдлээ!');
                  setTimeout(() => setToastMsg(''), 3000);
                }}
                onDeleteMovie={handleDeleteMovie}
                onAddEpisode={async (ep) => {
                  await addMovieEpisodeToDb(ep);
                  setToastMsg('Шинэ кино анги нэмэгдлээ!');
                  setTimeout(() => setToastMsg(''), 3000);
                }}
                onDeleteEpisode={handleDeleteMovieEpisode}
                selectedMovie={selectedMovie}
                setSelectedMovie={setSelectedMovie}
                activeEpisode={activeMovieEpisode}
                setActiveEpisode={setActiveMovieEpisode}
                onBackToHome={() => {
                  setSelectedMovie(null);
                  setActiveMovieEpisode(null);
                  setActiveTab('home');
                }}
              />
            )}

            {activeTab === 'profile' && (
              <UserProfile
                currentUser={currentUser}
                onUpdateProfile={handleUpdateProfile}
                mangas={mangas}
                onSelectManga={(m) => setSelectedManga(m)}
                onToggleSave={handleToggleSaveManga}
                onCopyLink={handleCopyLink}
              />
            )}

            {activeTab === 'admin_management' && (
              <div className="w-full max-w-full px-2 sm:px-6 md:px-8 py-6 md:py-10 space-y-8 animate-fade-in">
                {/* Unified admin section layout with a stylish glass card */}
                <div className={`w-full bg-brand-card ${currentUser?.role === 'reader' || adminSubTab === 'vip' ? 'border-0' : 'border border-brand-accent/5'} rounded-3xl p-4 sm:p-8 shadow-2xl relative overflow-hidden`}>
                  
                  {/* Top bar with 3-dot dropdown menu on the left */}
                  <div className="flex items-center justify-between pb-6 border-b border-brand-accent/5 mb-6 relative">
                    <div className="flex items-center gap-3">
                      {/* Three-dot dropdown menu trigger for admins */}
                      {currentUser && currentUser.role !== 'reader' && (
                        <div className="relative">
                          <button
                            id="admin-menu-trigger"
                            onClick={() => setShowAdminMenu(!showAdminMenu)}
                            className="p-2 sm:p-2.5 rounded-xl bg-brand-bg hover:bg-brand-accent/10 border border-brand-accent/5 text-brand-text hover:text-brand-accent transition-all cursor-pointer flex items-center justify-center shadow-inner"
                            title="Удирдлагын цэс"
                          >
                            <MoreVertical className="w-5 h-5" />
                          </button>

                          {/* Dropdown Menu */}
                          {showAdminMenu && (
                            <>
                              {/* Backdrop click closer */}
                              <div 
                                className="fixed inset-0 z-10" 
                                onClick={() => setShowAdminMenu(false)}
                              />
                              <div className="absolute left-0 mt-2 w-56 rounded-2xl bg-[#0c0c0e] border border-brand-accent/10 shadow-2xl z-20 overflow-hidden divide-y divide-brand-accent/5 py-1 animate-fade-in">
                                <button
                                  onClick={() => {
                                    setAdminSubTab('manga');
                                    setShowAdminMenu(false);
                                  }}
                                  className={`w-full px-4 py-3 text-left text-xs font-semibold flex items-center gap-3 transition-colors ${
                                    adminSubTab === 'manga'
                                      ? 'text-brand-accent bg-brand-accent/5'
                                      : 'text-brand-text-dark hover:text-brand-text hover:bg-brand-bg'
                                  }`}
                                >
                                  <Kanban className="w-4 h-4 text-brand-accent" />
                                  Манга & Бүлэг удиулах
                                </button>
                                <button
                                  onClick={() => {
                                    setAdminSubTab('vip');
                                    setShowAdminMenu(false);
                                  }}
                                  className={`w-full px-4 py-3 text-left text-xs font-semibold flex items-center gap-3 transition-colors ${
                                    adminSubTab === 'vip'
                                      ? 'text-brand-accent bg-brand-accent/5'
                                      : 'text-brand-text-dark hover:text-brand-text hover:bg-brand-bg'
                                  }`}
                                >
                                  <Award className="w-4 h-4 text-brand-accent" />
                                  VIP эрх авах
                                </button>
                                
                                {currentUser?.role === 'super_admin' && (
                                  <>
                                    <button
                                      onClick={() => {
                                        setAdminSubTab('users');
                                        setShowAdminMenu(false);
                                      }}
                                      className={`w-full px-4 py-3 text-left text-xs font-semibold flex items-center gap-3 transition-colors ${
                                        adminSubTab === 'users'
                                          ? 'text-brand-accent bg-brand-accent/5'
                                          : 'text-brand-text-dark hover:text-brand-text hover:bg-brand-bg'
                                      }`}
                                    >
                                      <UserCheck className="w-4 h-4 text-[#ff2e63]" />
                                      Хэрэглэгчид
                                    </button>
                                    <button
                                      onClick={() => {
                                        setAdminSubTab('genres');
                                        setShowAdminMenu(false);
                                      }}
                                      className={`w-full px-4 py-3 text-left text-xs font-semibold flex items-center gap-3 transition-colors ${
                                        adminSubTab === 'genres'
                                          ? 'text-brand-accent bg-brand-accent/5'
                                          : 'text-brand-text-dark hover:text-brand-text hover:bg-brand-bg'
                                      }`}
                                    >
                                      <Tags className="w-4 h-4 text-brand-accent" />
                                      Жанрууд
                                    </button>
                                    <button
                                      onClick={() => {
                                        setAdminSubTab('financial');
                                        setShowAdminMenu(false);
                                      }}
                                      className={`w-full px-4 py-3 text-left text-xs font-semibold flex items-center gap-3 transition-colors ${
                                        adminSubTab === 'financial'
                                          ? 'text-brand-accent bg-brand-accent/5'
                                          : 'text-brand-text-dark hover:text-brand-text hover:bg-brand-bg'
                                      }`}
                                    >
                                      <Wallet className="w-4 h-4 text-brand-accent" />
                                      Цалин бодолт
                                    </button>
                                    <button
                                      onClick={() => {
                                        setAdminSubTab('theme');
                                        setShowAdminMenu(false);
                                      }}
                                      className={`w-full px-4 py-3 text-left text-xs font-semibold flex items-center gap-3 transition-colors ${
                                        adminSubTab === 'theme'
                                          ? 'text-brand-accent bg-brand-accent/5'
                                          : 'text-brand-text-dark hover:text-brand-text hover:bg-brand-bg'
                                      }`}
                                    >
                                      <Palette className="w-4 h-4 text-brand-accent" />
                                      Сайтын өнгө төрх
                                    </button>
                                  </>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      <div>
                        <h2 className="text-base sm:text-lg font-display font-black tracking-wider text-brand-accent uppercase">
                          {currentUser?.role === 'reader' 
                            ? 'VIP ЭРХ АВАХ' 
                            : adminSubTab === 'vip'
                            ? 'VIP ЭРХИЙН УДИРДЛАГА'
                            : adminSubTab === 'users'
                            ? 'ХЭРЭГЛЭГЧДИЙН ЖУРНАЛ'
                            : adminSubTab === 'genres'
                            ? 'ЖАНРУУДЫН УДИРДЛАГА'
                            : adminSubTab === 'theme'
                            ? 'САЙТЫН ӨНГӨ ТӨРХ'
                            : 'БАГИЙН ЦАЛИН БОДОЛТ'
                          }
                        </h2>
                        <p className="text-[10px] sm:text-xs text-brand-text-dark font-mono">
                          {currentUser?.role === 'reader'
                            ? 'Гишүүнчлэлийн эрх идэвхжүүлэх болон сунгалт хийх хэсэг'
                            : 'Админ панелиар удирдлага болон тохиргоог удирдах'
                          }
                        </p>
                      </div>
                    </div>

                    {/* Quick sub-tab indicator */}
                    {currentUser && currentUser.role !== 'reader' && (
                      <div className="hidden md:flex items-center gap-2 bg-brand-bg/50 px-3 py-1.5 rounded-full border border-brand-accent/5">
                        <span className="text-[10px] uppercase font-mono tracking-widest text-brand-text-dark">Идэвхтэй:</span>
                        <span className="text-[10px] uppercase font-bold text-brand-accent tracking-wider font-display">
                          {adminSubTab === 'vip' ? 'VIP эрх' : adminSubTab === 'users' ? 'Хэрэглэгчид' : adminSubTab === 'genres' ? 'Жанрууд' : adminSubTab === 'theme' ? 'Өнгө төрх' : 'Цалин бодолт'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Sub-panel content selection based on role & sub-tab */}
                  {currentUser?.role !== 'reader' && (adminSubTab === 'manga' || (!adminSubTab && currentUser?.role !== 'reader')) && (
                    <AdminPanel
                      mangas={mangas}
                      chapters={chapters}
                      employees={employees}
                      allGenres={allGenres}
                      onAddGenre={handleAddGenre}
                      onDeleteGenre={handleDeleteGenre}
                      canAddGenre={currentUser?.role === 'super_admin'}
                      canDeleteGenre={currentUser?.role === 'super_admin'}
                      onAddManga={handleAddManga}
                      onUpdateManga={handleUpdateManga}
                      onDeleteManga={currentUser?.role === 'super_admin' ? handleDeleteManga : undefined}
                      onAddChapter={handleAddChapter}
                      onUpdateChapter={handleUpdateChapter}
                      onDeleteChapter={handleDeleteChapter}
                    />
                  )}

                  {((currentUser?.role === 'reader') || adminSubTab === 'vip') && (
                    <VipPanel
                      currentUser={currentUser}
                      vipRequests={vipRequests}
                      allUsers={allUsers}
                      vipPlans={vipPlans}
                      bankConfig={bankConfig}
                      onAddVipRequest={handleAddVipRequest}
                      onApproveVipRequest={handleApproveVipRequest}
                      onRejectVipRequest={handleRejectVipRequest}
                      onDeleteVipRequests={handleDeleteVipRequests}
                      onDirectVipGrant={handleDirectVipGrant}
                      onUpdateVipPlans={(plans) => {
                        setVipPlans(plans);
                        saveSiteConfigToDb({ vipPlans: plans });
                      }}
                      onUpdateBankConfig={(updatedBank) => {
                        setBankConfig(updatedBank);
                        saveSiteConfigToDb({ bankConfig: updatedBank });
                      }}
                    />
                  )}

                  {currentUser?.role === 'super_admin' && adminSubTab === 'users' && (
                    <UsersPanel
                      currentUser={currentUser}
                      allUsers={allUsers}
                      onImpersonateUser={(user) => {
                        setOriginalAdminUser(currentUser);
                        setCurrentUser(user);
                        setActiveTab('home');
                      }}
                      onUpdateUserRole={handleUpdateUserRole}
                      onDirectVipGrant={handleDirectVipGrant}
                      onDirectVipDateGrant={handleDirectVipDateGrant}
                    />
                  )}

                  {currentUser?.role === 'super_admin' && adminSubTab === 'genres' && (
                    <div className="space-y-6">
                      <div className="bg-brand-bg/40 border border-brand-accent/10 rounded-2xl p-4 sm:p-6 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-accent/10 pb-4">
                          <div>
                            <h3 className="text-sm font-bold text-brand-text font-display uppercase tracking-wider">
                              Манга Жанруудын Удирдлага (English Genres)
                            </h3>
                            <p className="text-xs text-brand-text-dark">
                              Шинээр жанр англи хэлээр нэмэх болон ашиглагдахгүй жанрыг устгах
                            </p>
                          </div>
                          
                          {/* Add Genre Input */}
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              id="genre-tab-input"
                              placeholder="Жанр нэмэх (жишээ: Romance, Sci-Fi)"
                              className="px-3 py-1.5 bg-brand-bg border border-brand-accent/20 rounded-xl text-xs text-brand-text focus:outline-none focus:border-brand-accent w-48 sm:w-64"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const target = e.currentTarget;
                                  if (target.value.trim()) {
                                    handleAddGenre(target.value.trim());
                                    target.value = '';
                                  }
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const input = document.getElementById('genre-tab-input') as HTMLInputElement;
                                if (input && input.value.trim()) {
                                  handleAddGenre(input.value.trim());
                                  input.value = '';
                                }
                              }}
                              className="px-3 py-1.5 bg-brand-accent text-brand-bg font-bold rounded-xl text-xs flex items-center gap-1 hover:bg-brand-accent-hover transition-all cursor-pointer shrink-0"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Нэмэх
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 pt-2">
                          {allGenres.map((genre) => {
                            const mangaCount = mangas.filter(m => m.genres?.includes(genre)).length;
                            return (
                              <div
                                key={genre}
                                className="flex items-center justify-between p-3 bg-brand-card/80 border border-brand-accent/10 rounded-xl text-xs hover:border-brand-accent/30 transition-all group"
                              >
                                <div className="min-w-0 pr-2">
                                  <p className="font-bold text-brand-text truncate">{genre}</p>
                                  <p className="text-[10px] text-brand-text-dark">{mangaCount} мангатай</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (window.confirm(`"${genre}" жанрыг системээс устгах уу?`)) {
                                      handleDeleteGenre(genre);
                                    }
                                  }}
                                  className="p-1.5 text-brand-text-dark hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all cursor-pointer shrink-0"
                                  title="Устгах"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {currentUser?.role === 'super_admin' && adminSubTab === 'financial' && (
                    <FinancialPanel
                      chapters={chapters}
                      employees={employees}
                      mangas={mangas}
                      salaryConfig={salaryConfig}
                      users={allUsers}
                      onUpdateConfig={(cfg) => {
                        setSalaryConfig(cfg);
                        saveSiteConfigToDb({ salaryConfig: cfg });
                      }}
                      onUpdateEmployees={(newEmps) => {
                        setEmployees(newEmps);
                        saveSiteConfigToDb({ employees: newEmps });
                      }}
                    />
                  )}

                  {currentUser?.role === 'super_admin' && adminSubTab === 'theme' && (
                    <ThemeSettingsPanel
                      currentThemeColor={themeColor}
                      onSaveTheme={handleSaveTheme}
                      isFreeSiteMode={isFreeSiteMode}
                      onToggleFreeSiteMode={handleToggleFreeSiteMode}
                      isMoviesTabEnabled={isMoviesTabEnabled}
                      onToggleMoviesTab={handleToggleMoviesTab}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
      </main>

      {/* Footer */}
      <footer id="app-footer" className="bg-brand-card border-t border-brand-accent/5 px-4 py-8 md:px-8 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs text-brand-text-dark font-mono">
          <div className="space-y-1 text-center md:text-left">
            <p className="font-semibold text-brand-accent text-sm font-display tracking-widest">{siteName.toUpperCase()}</p>
            <p>© {new Date().getFullYear()} {siteName}. Бүх эрх хамгаалагдсан.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            <span>Үйлчилгээний нөхцөл</span>
            <span>Нууцлалын бодлого</span>
            <span>Холбоо барих</span>
            <span className="text-brand-accent">Системийн цаг: 2026</span>
          </div>
        </div>
      </footer>

      {/* Login & Sign Up Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
        allUsers={allUsers}
        onRegisterUser={handleRegisterUser}
      />

      {/* Add Manga Admin Modal Overlay */}
      {isAddMangaModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-brand-card rounded-3xl w-full max-w-5xl lg:max-w-6xl p-4 sm:p-6 relative max-h-[95vh] sm:max-h-[85vh] overflow-y-auto shadow-2xl break-words overflow-x-hidden">
            <button
              onClick={() => setIsAddMangaModalOpen(false)}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 p-1.5 text-brand-text-dark hover:text-brand-accent transition-colors cursor-pointer z-10 bg-brand-bg rounded-full"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <div className="space-y-3 pt-1 break-words overflow-x-hidden">
              <h2 className="text-xs sm:text-sm font-black text-brand-accent tracking-widest uppercase">ШИНЭ МАНГА НЭМЭХ</h2>
              <AdminPanel
                mangas={mangas}
                chapters={chapters}
                employees={employees}
                allGenres={allGenres}
                onAddGenre={handleAddGenre}
                onDeleteGenre={handleDeleteGenre}
                canAddGenre={currentUser?.role === 'super_admin'}
                canDeleteGenre={currentUser?.role === 'super_admin'}
                onAddManga={(newManga) => {
                  handleAddManga(newManga);
                  setIsAddMangaModalOpen(false);
                }}
                onUpdateManga={handleUpdateManga}
                onDeleteManga={currentUser?.role === 'super_admin' ? handleDeleteManga : undefined}
                onAddChapter={handleAddChapter}
                onUpdateChapter={handleUpdateChapter}
                onDeleteChapter={handleDeleteChapter}
                forceAddMode={true}
              />
            </div>
          </div>
        </div>
      )}
      {/* Banner Text Edit Modal for Super Admin */}
      {isEditingBannerText && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#121318] border border-cyan-500/30 rounded-3xl p-6 max-w-lg w-full space-y-5 shadow-2xl relative text-white">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-lg font-bold text-cyan-300 flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-cyan-400" />
                <span>Ковер бичвэр засах</span>
              </h3>
              <button
                onClick={() => setIsEditingBannerText(false)}
                className="p-1 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5">
                  Ковер гарчиг (Үндсэн гарчиг)
                </label>
                <input
                  type="text"
                  value={editTitleInput}
                  onChange={(e) => setEditTitleInput(e.target.value)}
                  placeholder="MANGA"
                  className="w-full bg-black/50 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1.5">
                  Ковер дэд гарчиг (Тайлбар бичвэр)
                </label>
                <textarea
                  rows={3}
                  value={editSubtitleInput}
                  onChange={(e) => setEditSubtitleInput(e.target.value)}
                  placeholder="Манга, Махвхуа, Комиксыг хамгийн хурднаар орчуулан хүргэж байна"
                  className="w-full bg-black/50 border border-white/15 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
              <button
                onClick={() => setIsEditingBannerText(false)}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-bold rounded-xl cursor-pointer"
              >
                Цуцлах
              </button>
              <button
                onClick={handleSaveBannerText}
                className="px-5 py-2 bg-cyan-400 hover:bg-cyan-300 text-black text-xs font-extrabold rounded-xl shadow-lg active:scale-95 cursor-pointer"
              >
                Хадгалах
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Banner Cropper & Resizer Modal */}
      <BannerCropperModal
        imageFile={cropperFile}
        isOpen={isCropperOpen}
        onClose={() => {
          setIsCropperOpen(false);
          setCropperFile(null);
        }}
        onSave={handleCroppedBannerSave}
      />

      {/* Toast Notification Overlay */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <div className="bg-brand-card border-2 border-brand-accent/60 text-brand-text px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 backdrop-blur-md">
            <Sparkles className="w-5 h-5 text-brand-accent animate-pulse shrink-0" />
            <span className="text-xs font-sans font-bold tracking-wide">{toastMsg}</span>
          </div>
        </div>
      )}

      {/* Global Background Audio Element */}
      {homeBannerAudioUrl && (() => {
        const ytId = getYouTubeVideoId(homeBannerAudioUrl);
        if (ytId) {
          const isMuted = !!(selectedManga || activeChapter || isBannerMuted);
          const originParam = typeof window !== 'undefined' ? encodeURIComponent(window.location.origin) : '';
          return (
            <iframe
              key={`${ytId}-${isMuted ? 'muted' : 'unmuted'}`}
              ref={youtubeIframeRef}
              id="youtube-bg-audio"
              width="1"
              height="1"
              src={`https://www.youtube.com/embed/${ytId}?autoplay=1&loop=1&playlist=${ytId}&enablejsapi=1&controls=0&modestbranding=1&rel=0&playsinline=1&origin=${originParam}&mute=${isMuted ? 1 : 0}`}
              title="YouTube Background Audio"
              allow="autoplay; encrypted-media; picture-in-picture"
              onLoad={() => {
                if (!isMuted) {
                  try {
                    const sendCmd = () => {
                      youtubeIframeRef.current?.contentWindow?.postMessage(
                        JSON.stringify({ event: 'command', func: 'unMute', args: [] }),
                        '*'
                      );
                      youtubeIframeRef.current?.contentWindow?.postMessage(
                        JSON.stringify({ event: 'command', func: 'playVideo', args: [] }),
                        '*'
                      );
                    };
                    sendCmd();
                    setTimeout(sendCmd, 500);
                    setTimeout(sendCmd, 1200);
                  } catch (e) {}
                }
              }}
              className="fixed bottom-0 right-0 w-1 h-1 opacity-0 pointer-events-none z-[-1]"
            />
          );
        }
        return (
          <audio
            ref={bannerAudioRef}
            src={homeBannerAudioUrl}
            autoPlay
            loop
            muted={!!(selectedManga || activeChapter || isBannerMuted)}
            preload="auto"
            playsInline
          />
        );
      })()}

      {/* Global Floating Background Audio Control Pill */}
      {homeBannerAudioUrl && !activeChapter && (
        <div className="fixed bottom-5 left-5 z-40 animate-fade-in">
          <button
            type="button"
            onClick={toggleBannerAudio}
            className={`px-3.5 py-2.5 sm:px-4 sm:py-2.5 rounded-2xl border shadow-2xl backdrop-blur-xl flex items-center gap-2.5 text-xs font-extrabold cursor-pointer transition-all active:scale-95 ${
              isBannerMuted
                ? 'bg-amber-950/90 border-amber-400/80 text-amber-300 hover:bg-amber-900/95 shadow-amber-500/30 animate-pulse'
                : 'bg-cyan-950/90 border-cyan-400/50 text-cyan-300 hover:bg-cyan-900/90 shadow-cyan-500/20'
            }`}
            title={isBannerMuted ? "Арын дууг тоглуулах (Энд дарна уу)" : "Арын дууг хаах"}
          >
            <Music className={`w-4 h-4 ${isBannerMuted ? 'text-amber-400 animate-bounce' : 'text-cyan-400 animate-spin'}`} style={{ animationDuration: isBannerMuted ? '1s' : '4s' }} />
            <span className="inline-block">{isBannerMuted ? '🎵 Арын дууг тоглуулах (Энд дарна уу)' : '🎵 Арын дуу: Тоглож байна'}</span>
            {isBannerMuted ? (
              <VolumeX className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <Volume2 className="w-4 h-4 text-cyan-400 shrink-0 animate-pulse" />
            )}
          </button>
        </div>
      )}
      </div>
    </ScreenProtection>
  );
}
