import React, { useState, useEffect, useMemo } from 'react';
import JSZip from 'jszip';
import { Manga, Chapter, Employee, User } from '../types';
import {
  ArrowLeft,
  Lock,
  Plus,
  Trash2,
  Eye,
  Heart,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  BookOpen,
  AlertTriangle,
  X,
  Edit3,
  Check,
  Sparkles,
  MessageSquare,
  Link,
  Image,
  Clock
} from 'lucide-react';

function getTimeAgo(timestampString?: string | number): string {
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
import { DEFAULT_GENRES } from '../data';
import { uploadMultipleImagesToCloud, uploadSingleImageToCloud, uploadDataUrlToCloud, fileToDataUrl, compressDataUrl, parseImageUrlsInput, normalizeImageUrl, isValidImageUrl, DEFAULT_FALLBACK_IMAGE } from '../utils/imageUpload';
import { saveUserToDb, parseTimestamp, incrementMangaViewsInDb, getChapterFromDb } from '../firebase';
import SmartImage from './SmartImage';

const DEFAULT_MANGA_PAGES = [
  'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=1000&auto=format&fit=crop&q=90',
  'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1000&auto=format&fit=crop&q=90',
  'https://images.unsplash.com/photo-1560942485-b2a11cc13456?w=1000&auto=format&fit=crop&q=90'
];

const GALLERY_PRESETS = [
  'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800&auto=format&fit=crop&q=90',
  'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=800&auto=format&fit=crop&q=90',
  'https://images.unsplash.com/photo-1560942485-b2a11cc13456?w=800&auto=format&fit=crop&q=90',
  'https://images.unsplash.com/photo-1580477667995-2b94f01c9516?w=800&auto=format&fit=crop&q=90',
  'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=800&auto=format&fit=crop&q=90',
  'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop&q=90',
  'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=90',
  'https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?w=800&auto=format&fit=crop&q=90',
  'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=90',
  'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=800&auto=format&fit=crop&q=90',
  'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=800&auto=format&fit=crop&q=90',
  'https://images.unsplash.com/photo-1618336753974-aae8e04506aa?w=800&auto=format&fit=crop&q=90'
];

interface CommentReply {
  id: string;
  username: string;
  text: string;
  createdAt: string;
}

interface ChapterComment {
  id: string;
  username: string;
  text: string;
  createdAt: string;
  replies?: CommentReply[];
  reactions?: {
    likes?: number;
    hearts?: number;
    fires?: number;
  };
}

interface ChapterReaderProps {
  manga: Manga;
  chapters: Chapter[];
  employees: Employee[];
  currentUser: User | null;
  allUsers?: User[];
  allGenres?: string[];
  onBack: () => void;
  onAddChapter: (
    chapterData: Omit<Chapter, 'id' | 'createdAt'>,
    onProgress?: (percent: number, msg: string) => void
  ) => void;
  onDeleteChapter: (chapterId: string) => void;
  onUpdateChapter?: (updatedChapter: Chapter) => void;
  canDelete: boolean;
  canAdd: boolean;
  onGoToVipPanel: () => void;
  onUpdateManga?: (manga: Manga) => void;
  activeChapter?: Chapter | null;
  onActiveChapterChange?: (chapter: Chapter | null) => void;
  isSaved?: boolean;
  onToggleSave?: (mangaId: string) => void;
  onCopyLink?: (manga: Manga) => void;
  isFreeSiteMode?: boolean;
  allMangas?: Manga[];
  onSelectManga?: (manga: Manga) => void;
}

const safeSetLocalStorage = (key: string, value: any) => {
  try {
    const str = typeof value === 'string' ? value : JSON.stringify(value);
    localStorage.setItem(key, str);
  } catch (err) {
    console.warn(`[Storage Warning] safeSetLocalStorage failed for ${key}:`, err);
  }
};

const MangaPageImage: React.FC<{ src: string; pageNum: number }> = ({ src, pageNum }) => {
  const getInitialSrc = (url: string) => {
    const raw = typeof url === 'string' ? url.trim() : '';
    if (!raw || raw === 'undefined' || raw === 'null') {
      return '';
    }
    return normalizeImageUrl(raw);
  };

  const [currentSrc, setCurrentSrc] = useState<string>(() => getInitialSrc(src));
  const [retryStage, setRetryStage] = useState<number>(0);
  const [hasFatalError, setHasFatalError] = useState<boolean>(false);

  useEffect(() => {
    const raw = typeof src === 'string' ? src.trim() : '';
    if (!raw || raw === 'undefined' || raw === 'null') {
      setCurrentSrc('');
      setHasFatalError(true);
      return;
    }

    const normalized = normalizeImageUrl(raw);
    setCurrentSrc(normalized);
    setRetryStage(0);
    setHasFatalError(false);
  }, [src, pageNum]);

  const handleImageError = () => {
    const raw = typeof src === 'string' ? src.trim() : '';

    if (!raw || raw === 'undefined' || raw === 'null') {
      setHasFatalError(true);
      return;
    }

    let cleanUrl = raw.replace(/^["'`(<[]+|[)"'`>\]]+$/g, '');
    if (cleanUrl.startsWith('//')) {
      cleanUrl = `https:${cleanUrl}`;
    }

    if (cleanUrl.includes('/uploads/')) {
      const localRel = cleanUrl.substring(cleanUrl.indexOf('/uploads/'));
      if (retryStage === 0) {
        setRetryStage(1);
        setCurrentSrc(localRel);
        return;
      }
    }

    if (retryStage === 0 && (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://'))) {
      // Stage 1: Local server backend proxy (/api/proxy-image)
      setRetryStage(1);
      const localProxyUrl = `/api/proxy-image?url=${encodeURIComponent(cleanUrl)}`;
      setCurrentSrc(localProxyUrl);
      return;
    }

    if (retryStage === 1 && (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://'))) {
      // Stage 2: Weserv Cloudflare Image CDN Proxy
      setRetryStage(2);
      const urlWithoutProto = cleanUrl.replace(/^https?:\/\//, '');
      const weservUrl = `https://images.weserv.nl/?url=${encodeURIComponent(urlWithoutProto)}&default=${encodeURIComponent(cleanUrl)}`;
      setCurrentSrc(weservUrl);
      return;
    }

    if (retryStage === 2 && (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://'))) {
      // Stage 3: AllOrigins CORS proxy
      setRetryStage(3);
      const allOriginsUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(cleanUrl)}`;
      setCurrentSrc(allOriginsUrl);
      return;
    }

    setHasFatalError(true);
  };

  const handleManualRetry = () => {
    setRetryStage(0);
    setHasFatalError(false);
    const raw = typeof src === 'string' ? src.trim() : '';
    if (raw.startsWith('http://') || raw.startsWith('https://')) {
      const cacheBustUrl = `${raw}${raw.includes('?') ? '&' : '?'}retry=${Date.now()}`;
      setCurrentSrc(cacheBustUrl);
    } else {
      setCurrentSrc(normalizeImageUrl(raw));
    }
  };

  return (
    <div className="relative w-full p-0 m-0 bg-black min-h-[50px] flex flex-col items-center justify-center select-none">
      {currentSrc && !hasFatalError && (
        <img
          src={currentSrc}
          alt={`Хуудас ${pageNum}`}
          referrerPolicy="no-referrer"
          loading="eager"
          decoding="async"
          onError={handleImageError}
          className="manga-page-img w-full h-auto block p-0 m-0 object-contain max-w-4xl mx-auto"
        />
      )}

      {hasFatalError && (
        <div className="w-full max-w-2xl mx-auto my-4 p-4 bg-zinc-950/90 border border-zinc-800/80 rounded-xl flex flex-col items-center text-center gap-2.5 z-10">
          <div className="flex items-center gap-2 text-amber-400 text-xs sm:text-sm font-bold font-sans">
            <AlertTriangle className="w-4 h-4" />
            <span>Хуудас {pageNum}: Зураг ачаалахад алдаа гарлаа</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={handleManualRetry}
              className="px-3 py-1 bg-brand-accent hover:bg-brand-accent-hover text-brand-bg text-xs font-bold rounded-lg transition-colors cursor-pointer font-sans"
            >
              Дахин ачаалах
            </button>
            {typeof src === 'string' && (src.startsWith('http://') || src.startsWith('https://')) && (
              <a
                href={src}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded-lg transition-colors font-sans"
              >
                Линк шалгах
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default function ChapterReader({
  manga,
  chapters,
  employees,
  currentUser,
  allUsers,
  allGenres = DEFAULT_GENRES,
  onBack,
  onAddChapter,
  onDeleteChapter,
  onUpdateChapter,
  canDelete,
  canAdd,
  onGoToVipPanel,
  onUpdateManga,
  activeChapter: activeChapterProp,
  onActiveChapterChange,
  isSaved,
  onToggleSave,
  onCopyLink,
  isFreeSiteMode = false,
  allMangas = [],
  onSelectManga
}: ChapterReaderProps) {
  const [localActiveChapter, setLocalActiveChapter] = useState<Chapter | null>(null);

  // Recommendation Engine: Calculate top similar mangas based on matching genres, author, and type
  const recommendedMangas = useMemo(() => {
    if (!allMangas || allMangas.length === 0 || !manga) return [];
    const currentGenres = manga.genres || [];
    const currentType = manga.type;
    const currentAuthor = manga.author?.trim().toLowerCase();

    return allMangas
      .filter(m => m.id !== manga.id)
      .map(m => {
        let score = 0;
        // Genre match: +3 points per matching genre
        if (m.genres && currentGenres.length > 0) {
          const matches = m.genres.filter(g => currentGenres.includes(g)).length;
          score += matches * 3;
        }
        // Type match (Manga/Manhwa/Manhua): +2 points
        if (currentType && m.type === currentType) {
          score += 2;
        }
        // Author match: +5 points
        if (currentAuthor && m.author && m.author.trim().toLowerCase() === currentAuthor) {
          score += 5;
        }
        // Popularity bonus
        if (m.likes) score += Math.min((m.likes || 0) / 10, 3);
        if (m.views) score += Math.min((m.views || 0) / 1000, 2);

        return { manga: m, score };
      })
      .filter(item => item.score > 0 || allMangas.length <= 6)
      .sort((a, b) => b.score - a.score)
      .map(item => item.manga)
      .slice(0, 6);
  }, [allMangas, manga]);
  const isControlled = activeChapterProp !== undefined && onActiveChapterChange !== undefined;
  const activeChapter = isControlled ? activeChapterProp : localActiveChapter;
  const setActiveChapter = (ch: Chapter | null) => {
    if (activeChapter) {
      const currentScrollY = window.scrollY || window.pageYOffset || 0;
      safeSetLocalStorage(`read_pos_${activeChapter.id}`, currentScrollY.toString());
    }
    if (!ch) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    if (isControlled) {
      onActiveChapterChange?.(ch);
    } else {
      setLocalActiveChapter(ch);
    }
  };

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [deletingChapterId, setDeletingChapterId] = useState<string | null>(null);
  const [currentReadingPercent, setCurrentReadingPercent] = useState<number>(0);

  // Increment manga view count atomically on open (0 reads cost)
  useEffect(() => {
    if (activeChapter?.id && manga?.id) {
      incrementMangaViewsInDb(manga.id).catch(() => {});
    }
  }, [activeChapter?.id, manga?.id]);

  // Get saved reading progress percentage for any chapter
  const getChapterProgress = (chapterId: string): number => {
    if (activeChapter && activeChapter.id === chapterId) {
      return currentReadingPercent;
    }
    try {
      const savedProg = localStorage.getItem(`read_progress_${chapterId}`);
      if (savedProg !== null && savedProg !== undefined) {
        const parsed = parseInt(savedProg, 10);
        if (!isNaN(parsed)) {
          return Math.min(100, Math.max(0, parsed));
        }
      }
    } catch (e) {}
    if (currentUser?.readingProgress && typeof currentUser.readingProgress[chapterId] === 'number') {
      const uVal = currentUser.readingProgress[chapterId];
      return Math.min(100, Math.max(0, uVal));
    }
    if (currentUser?.readChapterIds?.includes(chapterId)) {
      return 100;
    }
    return 0;
  };

  // Link share state & helper
  const [copiedChapterId, setCopiedChapterId] = useState<string | null>(null);
  const handleCopyLink = (e: React.MouseEvent, chapterId: string) => {
    e.stopPropagation();
    const url = `${window.location.origin}${window.location.pathname}?mangaId=${manga.id}&chapterId=${chapterId}`;
    navigator.clipboard.writeText(url)
      .then(() => {
        setCopiedChapterId(chapterId);
        setTimeout(() => setCopiedChapterId(null), 2000);
      })
      .catch(err => {
        console.error('Failed to copy: ', err);
      });
  };

  // Comments state (Chapter)
  const [comments, setComments] = useState<ChapterComment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  // Manga Comments state
  const [mangaComments, setMangaComments] = useState<ChapterComment[]>([]);
  const [newMangaCommentText, setNewMangaCommentText] = useState('');
  const [mangaReplyingToId, setMangaReplyingToId] = useState<string | null>(null);
  const [mangaReplyText, setMangaReplyText] = useState('');

  // Edit existing chapter state
  const [editingChapter, setEditingChapter] = useState<Chapter | null>(null);
  const [editChTitle, setEditChTitle] = useState('');
  const [editChPosterUrl, setEditChPosterUrl] = useState('');
  const [editChTranslator, setEditChTranslator] = useState('');
  const [editChEditor, setEditChEditor] = useState('');
  const [editChTypesetter, setEditChTypesetter] = useState('');
  const [editChImages, setEditChImages] = useState<string[]>([]);
  const [editChIsVip, setEditChIsVip] = useState(false);

  // Unified Gallery Picker State
  const [galleryModalOpen, setGalleryModalOpen] = useState(false);
  const [gallerySelectionMode, setGallerySelectionMode] = useState<'single' | 'multiple'>('single');
  const [selectedGalleryImages, setSelectedGalleryImages] = useState<string[]>([]);
  const [galleryCallback, setGalleryCallback] = useState<((urls: string[]) => void) | null>(null);

  const openGalleryPicker = (mode: 'single' | 'multiple', callback: (urls: string[]) => void) => {
    setGallerySelectionMode(mode);
    setSelectedGalleryImages([]);
    setGalleryCallback(() => callback);
    setGalleryModalOpen(true);
  };

  // New chapter form state
  const [chTitle, setChTitle] = useState('');
  const [chPosterUrl, setChPosterUrl] = useState('');
  const [selectedTranslator, setSelectedTranslator] = useState('');
  const [selectedEditor, setSelectedEditor] = useState('');
  const [selectedTypesetter, setSelectedTypesetter] = useState('');
  const [isVip, setIsVip] = useState(false);
  const [formError, setFormError] = useState('');

  // File Upload and AI Upscaling states
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [aiUpscale, setAiUpscale] = useState(false);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [upscaleProgress, setUpscaleProgress] = useState(0);
  const [upscaleStatus, setUpscaleStatus] = useState('');
  const [upscaleMode, setUpscaleMode] = useState<'lineart' | 'color'>('color');
  const [upscaleMultiplier, setUpscaleMultiplier] = useState<'2x' | '4x'>('4x');

  // Publishing & Progress states
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState(0);
  const [publishStatusMsg, setPublishStatusMsg] = useState('');

  // Edit Manga Form states
  const [isEditMode, setIsEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState(manga.title);
  const [editAuthor, setEditAuthor] = useState(manga.author);
  const [editDescription, setEditDescription] = useState(manga.description);
  const [editCoverUrl, setEditCoverUrl] = useState(manga.coverUrl);
  const [editStatus, setEditStatus] = useState<'publishing' | 'completed' | 'full_release'>(manga.status);
  const [editGenres, setEditGenres] = useState<string[]>(manga.genres);
  const [editSuccessMsg, setEditSuccessMsg] = useState('');
  const [editErrorMsg, setEditErrorMsg] = useState('');

  // Chapter sort order and view pagination state
  const [chapterSortOrder, setChapterSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showAllChapters, setShowAllChapters] = useState(false);

  // Update form fields and live display when manga prop updates
  React.useEffect(() => {
    if (!isEditMode) {
      setEditTitle(manga.title);
      setEditAuthor(manga.author);
      setEditDescription(manga.description);
      setEditCoverUrl(manga.coverUrl);
      setEditStatus(manga.status);
      setEditGenres(manga.genres);
    }
  }, [manga.id, manga.title, manga.author, manga.description, manga.coverUrl, manga.status, manga.genres, isEditMode]);

  // Reset edit mode when manga ID changes
  React.useEffect(() => {
    setIsEditMode(false);
    setEditSuccessMsg('');
    setEditErrorMsg('');
    setShowAllChapters(false);
  }, [manga.id]);

  // Load manga comments directly from live Firestore object
  React.useEffect(() => {
    if (Array.isArray(manga.comments)) {
      setMangaComments(manga.comments);
    } else {
      setMangaComments([]);
    }
  }, [manga.id, manga.comments]);

  // Load comments & restore scroll position on activeChapter change
  React.useEffect(() => {
    if (activeChapter) {
      // Load comments directly from activeChapter object (synced in real-time with Firestore)
      if (Array.isArray(activeChapter.comments)) {
        setComments(activeChapter.comments);
      } else {
        setComments([]);
      }

      // Restore scroll position from last reading session
      const savedPosStr = localStorage.getItem(`read_pos_${activeChapter.id}`);
      const savedPos = savedPosStr ? parseInt(savedPosStr, 10) : 0;
      const targetY = !isNaN(savedPos) && savedPos > 0 ? savedPos : 0;

      const restoreScroll = () => {
        window.scrollTo({ top: targetY, behavior: 'instant' });
      };

      restoreScroll();
      const t1 = setTimeout(restoreScroll, 50);
      const t2 = setTimeout(restoreScroll, 150);
      const t3 = setTimeout(restoreScroll, 300);
      const t4 = setTimeout(restoreScroll, 600);
      const t5 = setTimeout(restoreScroll, 1000);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        clearTimeout(t4);
        clearTimeout(t5);
      };
    }
  }, [activeChapter?.id, activeChapter?.comments]);

  // Ensure window scrolls to the top of the manga detail page when exiting a chapter
  const prevActiveChapterRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (prevActiveChapterRef.current && !activeChapter) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      const t1 = setTimeout(() => window.scrollTo({ top: 0, behavior: 'instant' }), 20);
      const t2 = setTimeout(() => window.scrollTo({ top: 0, behavior: 'instant' }), 100);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
    prevActiveChapterRef.current = activeChapter ? activeChapter.id : null;
  }, [activeChapter]);

  // Set up scroll listener to save reading position & percentage in real-time
  useEffect(() => {
    if (activeChapter) {
      const savedKey = `read_progress_${activeChapter.id}`;
      let cloudSyncTimer: ReturnType<typeof setTimeout> | null = null;

      const calculateScrollPercent = (): number => {
        const scrollY = window.scrollY || window.pageYOffset || 0;
        if (scrollY <= 10) return 0; // Exactly at top

        const windowHeight = window.innerHeight || 1;
        const fullHeight = Math.max(
          document.documentElement.scrollHeight || 0,
          document.body.scrollHeight || 0
        );
        const scrollable = fullHeight - windowHeight;

        if (scrollable <= 30) return 100;

        const raw = Math.round((scrollY / scrollable) * 100);
        const clamped = Math.min(100, Math.max(0, raw));
        return clamped >= 98 ? 100 : clamped;
      };

      const handleScroll = () => {
        const currentPercent = calculateScrollPercent();
        const scrollY = window.scrollY || window.pageYOffset || 0;

        safeSetLocalStorage(`read_pos_${activeChapter.id}`, scrollY.toString());

        setCurrentReadingPercent(currentPercent);
        safeSetLocalStorage(savedKey, currentPercent.toString());

        // Debounce cloud update to prevent Firestore write spam
        if (currentUser) {
          if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
          cloudSyncTimer = setTimeout(() => {
            const updatedUser: User = {
              ...currentUser,
              readingProgress: {
                ...(currentUser.readingProgress || {}),
                [activeChapter.id]: currentPercent
              }
            };
            saveUserToDb(updatedUser);
          }, 1000);
        }
      };

      // Initial execution
      handleScroll();
      const t1 = setTimeout(handleScroll, 150);
      const t2 = setTimeout(handleScroll, 600);

      window.addEventListener('scroll', handleScroll, { passive: true });
      return () => {
        if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
        clearTimeout(t1);
        clearTimeout(t2);
        window.removeEventListener('scroll', handleScroll);
      };
    }
  }, [activeChapter?.id]);

  const handleEditGenreToggle = (genre: string) => {
    if (editGenres.includes(genre)) {
      setEditGenres(editGenres.filter(g => g !== genre));
    } else {
      setEditGenres([...editGenres, genre]);
    }
  };

  const handleUpdateMangaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setEditSuccessMsg('');
    setEditErrorMsg('');

    if (!editTitle.trim() || !editAuthor.trim() || !editDescription.trim() || editGenres.length === 0) {
      setEditErrorMsg('Бүх талбарыг бөглөж, дор хаяж нэг төрөл сонгоно уу.');
      return;
    }

    if (onUpdateManga) {
      onUpdateManga({
        ...manga,
        title: editTitle.trim(),
        author: editAuthor.trim(),
        description: editDescription.trim(),
        coverUrl: editCoverUrl.trim(),
        status: editStatus,
        genres: editGenres,
      });
      setEditSuccessMsg('Мэдээлэл амжилттай шинэчлэгдлээ!');
      setTimeout(() => {
        setIsEditMode(false);
        setEditSuccessMsg('');
      }, 1500);
    }
  };

  const mangaChapters = chapters.filter(c => String(c.mangaId || '').trim().toLowerCase() === String(manga.id || '').trim().toLowerCase());

  // Strictly ascending chapters for prev/next reader navigation
  const ascSortedChapters = [...mangaChapters].sort((a, b) => {
    const aNum = parseFloat(a.title.match(/\d+(\.\d+)?/)?.[0] || '0');
    const bNum = parseFloat(b.title.match(/\d+(\.\d+)?/)?.[0] || '0');
    if (aNum !== bNum) return aNum - bNum;
    return parseTimestamp(a.createdAt) - parseTimestamp(b.createdAt);
  });

  // Sort chapters based on user preference ('asc': 1->Last or 'desc': Last->1)
  const sortedMangaChapters = [...mangaChapters].sort((a, b) => {
    const aNum = parseFloat(a.title.match(/\d+(\.\d+)?/)?.[0] || '0');
    const bNum = parseFloat(b.title.match(/\d+(\.\d+)?/)?.[0] || '0');
    if (aNum !== bNum) {
      return chapterSortOrder === 'asc' ? aNum - bNum : bNum - aNum;
    }
    const timeA = parseTimestamp(a.createdAt);
    const timeB = parseTimestamp(b.createdAt);
    return chapterSortOrder === 'asc' ? timeA - timeB : timeB - timeA;
  });

  // Limit initially to 20 chapters unless showAllChapters is true
  const displayedChapters = showAllChapters ? sortedMangaChapters : sortedMangaChapters.slice(0, 20);

  const staffNames = useMemo(() => {
    const names = new Set<string>();
    (employees || []).forEach(e => {
      if (e.name && e.name.trim()) names.add(e.name.trim());
    });
    (allUsers || []).forEach(u => {
      if ((u.role === 'admin' || u.role === 'super_admin') && u.username) {
        names.add(u.username.trim());
      }
    });
    return Array.from(names);
  }, [employees, allUsers]);

  const translators = employees.filter(e => e.role === 'translator' || e.role === 'all');
  const editors = employees.filter(e => e.role === 'editor' || e.role === 'all');
  const typesetters = employees.filter(e => e.role === 'typesetter' || e.role === 'all');

  const isUserVip = () => {
    if (isFreeSiteMode) return true;
    if (!currentUser) return false;
    if (currentUser.role === 'super_admin' || currentUser.role === 'admin') return true;
    if (!currentUser.vipUntil) return false;
    return new Date(currentUser.vipUntil) > new Date();
  };

  const [uploadStatusMsg, setUploadStatusMsg] = useState<string>('');
  const [isUploadingFiles, setIsUploadingFiles] = useState<boolean>(false);
  const [pastedImageUrls, setPastedImageUrls] = useState<string>('');

  const extractImageFilesFromZip = async (zipFile: File): Promise<File[]> => {
    const zip = new JSZip();
    const loadedZip = await zip.loadAsync(zipFile);
    const fileEntries: { name: string; promise: Promise<File> }[] = [];

    loadedZip.forEach((relativePath, file) => {
      const isImage = /\.(png|jpe?g|webp|gif)$/i.test(relativePath);
      const isMacTrash = relativePath.includes('__MACOSX') || relativePath.startsWith('.');

      if (!file.dir && isImage && !isMacTrash) {
        const promise = file.async('blob').then((blob) => {
          const fileName = relativePath.split('/').pop() || 'page.png';
          return new File([blob], fileName, { type: blob.type || 'image/png' });
        });
        fileEntries.push({ name: relativePath, promise });
      }
    });

    // Sort alphabetically so chapter pages stay in order
    fileEntries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    return Promise.all(fileEntries.map(item => item.promise));
  };

  const processFiles = async (files: File[]) => {
    const filesToUpload: File[] = [];
    const imageFiles = files.filter(f => /\.(png|jpe?g|webp|gif)$/i.test(f.name));
    const zipFiles = files.filter(f => /\.zip$/i.test(f.name));

    filesToUpload.push(...imageFiles);

    if (zipFiles.length > 0) {
      for (const zipFile of zipFiles) {
        try {
          const zipExtracted = await extractImageFilesFromZip(zipFile);
          filesToUpload.push(...zipExtracted);
        } catch (err) {
          console.error("ZIP уншихад алдаа гарлаа:", err);
          alert(`"${zipFile.name}" ZIP файлыг задлахад алдаа гарлаа. Зөв ZIP файл эсэхийг шалгана уу.`);
        }
      }
    }

    if (filesToUpload.length > 0) {
      // 1. Instant local base64 previews
      const localBase64s = await Promise.all(
        filesToUpload.map(async (f) => {
          try {
            return await fileToDataUrl(f);
          } catch (_) {
            return '';
          }
        })
      );
      setUploadedImages(prev => [...prev, ...localBase64s]);

      setIsUploadingFiles(true);
      setUploadStatusMsg(`[0/${filesToUpload.length}] (0%) Cloud сервер рүү уншиж байна...`);

      try {
        const cloudUrls = await uploadMultipleImagesToCloud(filesToUpload, (curr, tot, msg) => {
          setUploadStatusMsg(msg);
        });

        if (cloudUrls && cloudUrls.length > 0) {
          // Swap local base64 preview URLs with permanent Cloud HTTPS URLs if cloud upload succeeded
          setUploadedImages(prev => {
            const updated = [...prev];
            localBase64s.forEach((preview, i) => {
              if (cloudUrls[i] && (cloudUrls[i].startsWith('http://') || cloudUrls[i].startsWith('https://'))) {
                const pos = updated.indexOf(preview);
                if (pos !== -1) updated[pos] = cloudUrls[i];
              }
            });
            return updated;
          });
        }
      } catch (err) {
        console.error("Cloud upload error:", err);
      } finally {
        setIsUploadingFiles(false);
        setUploadStatusMsg('');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files) as File[];
    processFiles(files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.dataTransfer.files) return;
    const files = Array.from(e.dataTransfer.files) as File[];
    processFiles(files);
  };

  const removeUploadedImage = (idx: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== idx));
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!chTitle.trim()) {
      setFormError('Бүлгийн нэрийг оруулна уу.');
      return;
    }

    // Auto-parse pasted URLs if any exist in textarea
    let finalImages = [...uploadedImages];
    if (pastedImageUrls.trim()) {
      const parsed = parseImageUrlsInput(pastedImageUrls);
      if (parsed.length > 0) {
        finalImages = [...finalImages, ...parsed];
      }
    }

    if (finalImages.length === 0) {
      setFormError('Бүлгийн хуудасны зураг эсвэл линк оруулна уу.');
      return;
    }

    const translator = selectedTranslator || (staffNames[0] || 'Аяко Баг');
    const editor = selectedEditor || (staffNames[0] || 'Аяко Баг');
    const typesetter = selectedTypesetter || (staffNames[0] || 'Аяко Баг');

    const submitChapter = async () => {
      setIsPublishing(true);
      setPublishProgress(10);
      setPublishStatusMsg(`[10%] Нийтлэх бэлтгэл хангаж байна (${finalImages.length} хуудас)...`);

      try {
        setPublishProgress(25);
        setPublishStatusMsg(`[25%] Хуудасны зургуудыг баталгаажуулж байна...`);

        setPublishProgress(45);
        setPublishStatusMsg(`[45%] Датабаазад нийтлэх мэдээллийг илгээж байна...`);

        await onAddChapter({
          mangaId: manga.id,
          title: chTitle.trim(),
          posterUrl: chPosterUrl.trim() || undefined,
          translator: translator,
          editor: editor,
          typesetter: typesetter,
          isVip: isVip,
          images: finalImages
        }, (prog, msg) => {
          setPublishProgress(prog);
          setPublishStatusMsg(msg);
        });

        setPublishProgress(100);
        setPublishStatusMsg(`[100%] Бүлэг амжилттай нийтлэгдлээ! 🎉`);

        setTimeout(() => {
          setIsPublishing(false);
          setPublishProgress(0);
          setPublishStatusMsg('');
          setChTitle('');
          setChPosterUrl('');
          setIsVip(false);
          setUploadedImages([]);
          setPastedImageUrls('');
          setAiUpscale(false);
          setIsUpscaling(false);
          setUpscaleProgress(0);
          setIsAddModalOpen(false);
        }, 350);
      } catch (err: any) {
        console.error("Chapter submit error:", err);
        setFormError(`Алдаа гарлаа: ${err?.message || 'Дахин шалгана уу'}`);
        setIsUpscaling(false);
        setIsPublishing(false);
        setPublishProgress(0);
      }
    };

    if (aiUpscale) {
      setIsUpscaling(true);
      setUpscaleProgress(0);
      setUpscaleStatus('AI загваруудыг ачаалж байна (Initializing Neural Engines)...');

      let currentProgress = 0;
      const interval = setInterval(() => {
        currentProgress += 5;
        if (currentProgress > 100) currentProgress = 100;
        setUpscaleProgress(currentProgress);

        if (currentProgress === 20) {
          setUpscaleStatus(`[AI] Манга хуудаснуудаас зураасуудыг ялган таньж байна (${finalImages.length} хуудас)...`);
        } else if (currentProgress === 40) {
          setUpscaleStatus('[AI] Зураас бүрийг алдагдалгүй тодруулж, вектор ирмэгүүдийг тэгшилж байна...');
        } else if (currentProgress === 65) {
          setUpscaleStatus('[AI] Өнгөний уусах сувгуудыг шинжилж, нягтралыг өндөрсгөж байна (Color restoration)...');
        } else if (currentProgress === 85) {
          setUpscaleStatus(`[AI] Огт чанар алдагдалгүй ${upscaleMultiplier} хэмжээстэй 4K болгон хөрвүүлж байна (Upscale ${upscaleMultiplier} HD)...`);
        } else if (currentProgress === 100) {
          clearInterval(interval);
          setUpscaleStatus('Боловсруулалт амжилттай дууслаа! Төгс чанартай болгож орууллаа.');
          
          setTimeout(() => {
            submitChapter();
          }, 800);
        }
      }, 150);
    } else {
      // Normal upload without AI
      submitChapter();
    }
  };

  const handleReadChapter = (chapter: Chapter) => {
    if (chapter.isVip && !isUserVip()) {
      alert('Энэ бүлэг VIP хэрэглэгчдэд зориулагдсан байна. Та VIP эрх авах хэсгээр орж хүсэлт илгээнэ үү.');
      if (onGoToVipPanel) {
        onGoToVipPanel();
      }
      return;
    }
    setActiveChapter(chapter);
    setShowControls(true);
  };

  // Immediate protection guard: If activeChapter is set to a VIP chapter but user is NOT VIP, block access
  React.useEffect(() => {
    if (activeChapter && activeChapter.isVip && !isUserVip()) {
      setActiveChapter(null);
      alert('Энэ бүлэг VIP хэрэглэгчдэд зориулагдсан байна. Та VIP эрх авах хэсгээр орж хүсэлт илгээнэ үү.');
      if (onGoToVipPanel) {
        onGoToVipPanel();
      }
    }
  }, [activeChapter, isFreeSiteMode, currentUser?.vipUntil, currentUser?.role]);

  // Screen Tap listener to toggle reader controls
  const handleToggleControls = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('textarea') ||
      target.closest('input') ||
      target.closest('form') ||
      target.closest('#comment-box')
    ) {
      return;
    }
    setShowControls(prev => !prev);
  };

  const handleAddCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || !activeChapter) return;

    const newComment: ChapterComment = {
      id: 'comm_' + Date.now(),
      username: currentUser ? currentUser.username : 'Зочин',
      text: newCommentText.trim(),
      createdAt: new Date().toISOString(),
      replies: [],
      reactions: { likes: 0, hearts: 0, fires: 0 }
    };

    const updated = [...comments, newComment];
    setComments(updated);
    safeSetLocalStorage(`ayako_comments_${activeChapter.id}`, updated);
    onUpdateChapter({ ...activeChapter, comments: updated });
    setNewCommentText('');
  };

  const handleReplySubmit = (e: React.FormEvent, commentId: string) => {
    e.preventDefault();
    if (!replyText.trim() || !activeChapter) return;

    const newReply: CommentReply = {
      id: 'reply_' + Date.now(),
      username: currentUser ? currentUser.username : 'Зочин',
      text: replyText.trim(),
      createdAt: new Date().toISOString()
    };

    const updated = comments.map(c => {
      if (c.id === commentId) {
        return {
          ...c,
          replies: [...(c.replies || []), newReply]
        };
      }
      return c;
    });

    setComments(updated);
    safeSetLocalStorage(`ayako_comments_${activeChapter.id}`, updated);
    onUpdateChapter({ ...activeChapter, comments: updated });
    setReplyText('');
    setReplyingToId(null);
  };

  const handleReactionClick = (commentId: string, reactionType: 'likes' | 'hearts' | 'fires') => {
    if (!activeChapter) return;

    const updated = comments.map(c => {
      if (c.id === commentId) {
        const reactions = c.reactions || {};
        return {
          ...c,
          reactions: {
            ...reactions,
            [reactionType]: (reactions[reactionType] || 0) + 1
          }
        };
      }
      return c;
    });

    setComments(updated);
    safeSetLocalStorage(`ayako_comments_${activeChapter.id}`, updated);
    onUpdateChapter({ ...activeChapter, comments: updated });
  };

  const handleDeleteComment = (commentId: string) => {
    if (!activeChapter) return;
    const updated = comments.filter(c => c.id !== commentId);
    setComments(updated);
    safeSetLocalStorage(`ayako_comments_${activeChapter.id}`, updated);
    onUpdateChapter({ ...activeChapter, comments: updated });
  };

  // Manga Comment Handlers
  const handleAddMangaCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMangaCommentText.trim()) return;

    const newComment: ChapterComment = {
      id: 'mcomm_' + Date.now(),
      username: currentUser ? currentUser.username : 'Зочин',
      text: newMangaCommentText.trim(),
      createdAt: new Date().toISOString(),
      replies: [],
      reactions: { likes: 0, hearts: 0, fires: 0 }
    };

    const updated = [newComment, ...mangaComments];
    setMangaComments(updated);
    safeSetLocalStorage(`ayako_manga_comments_${manga.id}`, updated);
    if (onUpdateManga) {
      onUpdateManga({ ...manga, comments: updated });
    }
    setNewMangaCommentText('');
  };

  const handleMangaReplySubmit = (e: React.FormEvent, commentId: string) => {
    e.preventDefault();
    if (!mangaReplyText.trim()) return;

    const newReply: CommentReply = {
      id: 'mreply_' + Date.now(),
      username: currentUser ? currentUser.username : 'Зочин',
      text: mangaReplyText.trim(),
      createdAt: new Date().toISOString()
    };

    const updated = mangaComments.map(c => {
      if (c.id === commentId) {
        return {
          ...c,
          replies: [...(c.replies || []), newReply]
        };
      }
      return c;
    });

    setMangaComments(updated);
    safeSetLocalStorage(`ayako_manga_comments_${manga.id}`, updated);
    if (onUpdateManga) {
      onUpdateManga({ ...manga, comments: updated });
    }
    setMangaReplyText('');
    setMangaReplyingToId(null);
  };

  const handleMangaCommentReactionClick = (commentId: string, reactionType: 'likes' | 'hearts' | 'fires') => {
    const updated = mangaComments.map(c => {
      if (c.id === commentId) {
        const reactions = c.reactions || {};
        return {
          ...c,
          reactions: {
            ...reactions,
            [reactionType]: (reactions[reactionType] || 0) + 1
          }
        };
      }
      return c;
    });

    setMangaComments(updated);
    safeSetLocalStorage(`ayako_manga_comments_${manga.id}`, updated);
    if (onUpdateManga) {
      onUpdateManga({ ...manga, comments: updated });
    }
  };

  const handleDeleteMangaComment = (commentId: string) => {
    const updated = mangaComments.filter(c => c.id !== commentId);
    setMangaComments(updated);
    safeSetLocalStorage(`ayako_manga_comments_${manga.id}`, updated);
    if (onUpdateManga) {
      onUpdateManga({ ...manga, comments: updated });
    }
  };

  const handleStartEditChapter = (chapter: Chapter) => {
    setEditingChapter(chapter);
    setEditChTitle(chapter.title);
    setEditChPosterUrl(chapter.posterUrl || '');
    setEditChTranslator(chapter.translator);
    setEditChEditor(chapter.editor);
    setEditChTypesetter(chapter.typesetter);
    setEditChImages(chapter.images || DEFAULT_MANGA_PAGES);
    setEditChIsVip(chapter.isVip);
  };

  // Find adjacent chapters
  const currentChapterIdx = activeChapter ? ascSortedChapters.findIndex(c => c.id === activeChapter.id) : -1;
  const prevChapter = currentChapterIdx > 0 ? ascSortedChapters[currentChapterIdx - 1] : null;
  const nextChapter = currentChapterIdx !== -1 && currentChapterIdx < ascSortedChapters.length - 1 ? ascSortedChapters[currentChapterIdx + 1] : null;

  return (
    <div id="manga-detail-container" className="max-w-4xl mx-auto px-4 py-6 md:py-10 space-y-8 animate-fade-in">
      
      {/* Back to Home layout */}
      {!activeChapter && (
        <div className="flex items-center justify-between">
          <button
            id="manga-detail-back-btn"
            onClick={onBack}
            className="flex items-center gap-2 text-brand-accent hover:text-brand-accent-hover font-display font-medium text-sm transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Буцах</span>
          </button>

          {canAdd && (
            <button
              id="manga-detail-add-chapter-btn"
              onClick={() => {
                const defaultStaff = staffNames[0] || currentUser?.username || 'Аяко Баг';
                if (!selectedTranslator) setSelectedTranslator(defaultStaff);
                if (!selectedEditor) setSelectedEditor(defaultStaff);
                if (!selectedTypesetter) setSelectedTypesetter(defaultStaff);
                if (!chTitle) {
                  const maxChapterNum = mangaChapters.reduce((max, c) => {
                    const match = c.title.match(/\d+(\.\d+)?/);
                    if (match) {
                      const num = parseFloat(match[0]);
                      return num > max ? num : max;
                    }
                    return max;
                  }, 0);
                  const nextNum = maxChapterNum > 0 ? maxChapterNum + 1 : 1;
                  setChTitle(`Бүлэг ${nextNum}`);
                }
                setIsAddModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-accent hover:bg-brand-accent-hover text-brand-bg font-display font-bold rounded-lg text-[10px] sm:text-xs uppercase tracking-wider transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Шинэ бүлэг нэмэх</span>
            </button>
          )}
        </div>
      )}

      {activeChapter ? (
        /* FULL-SCREEN VERTICAL STRIP READING VIEW WITH ABSOLUTELY ZERO GAPS */
        <div
          id="reading-view"
          onClick={handleToggleControls}
          className="relative min-h-screen bg-black text-white w-full max-w-none px-0 py-0 flex flex-col justify-start select-none"
        >
          {/* Floating Overlay Controls (Back, Copy Link, Progress, Prev & Next Chapter Buttons) */}
          <div
            className={`fixed top-3 left-3 right-3 sm:top-6 sm:left-6 sm:right-6 z-50 flex flex-wrap items-center justify-between gap-2 pointer-events-none transition-all duration-300 transform ${
              showControls ? 'translate-y-0 opacity-100' : '-translate-y-12 opacity-0'
            }`}
          >
            {/* Left Controls: Back button, Copy Link, Reading % */}
            <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto flex-wrap">
              <button
                id="reading-close-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  safeSetLocalStorage(`read_pos_${activeChapter.id}`, window.scrollY.toString());
                  setActiveChapter(null);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-black/85 backdrop-blur-md border border-brand-accent/30 hover:border-brand-accent text-brand-accent hover:bg-brand-accent hover:text-brand-bg rounded-xl text-[10px] sm:text-xs font-display font-extrabold uppercase tracking-wider shadow-2xl transition-all cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>БУЦАХ</span>
              </button>

              <button
                id="reading-copy-link-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onCopyLink?.(manga);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-black/85 backdrop-blur-md border border-brand-accent/30 hover:border-brand-accent text-brand-accent hover:bg-brand-card rounded-xl text-[10px] sm:text-xs font-sans font-bold shadow-2xl transition-all cursor-pointer"
                title="Линк хуулах"
              >
                <Link className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Линк хуулах</span>
              </button>

              {/* Live scroll reading progress indicator */}
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-black/85 backdrop-blur-md border border-brand-accent/30 rounded-xl text-[10px] sm:text-xs font-mono font-bold text-brand-accent shadow-2xl">
                <span>📖 {currentReadingPercent}%</span>
              </div>
            </div>

            {/* Right Controls: Previous & Next Chapter Navigation */}
            <div className="flex items-center gap-1.5 sm:gap-2 pointer-events-auto">
              {prevChapter && (
                <button
                  id="reading-prev-ch-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReadChapter(prevChapter);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-black/85 backdrop-blur-md border border-brand-accent/30 hover:border-brand-accent text-brand-accent hover:bg-brand-accent hover:text-brand-bg rounded-xl text-[10px] sm:text-xs font-sans font-bold uppercase tracking-wider shadow-2xl transition-all cursor-pointer"
                  title="Өмнөх бүлэг"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Өмнөх<span className="hidden sm:inline"> бүлэг</span></span>
                </button>
              )}

              {nextChapter && (
                <button
                  id="reading-next-ch-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReadChapter(nextChapter);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-brand-accent backdrop-blur-md border border-brand-accent hover:bg-brand-accent-hover text-brand-bg rounded-xl text-[10px] sm:text-xs font-sans font-extrabold uppercase tracking-wider shadow-2xl transition-all cursor-pointer"
                  title="Дараагийн бүлэг"
                >
                  <span>Дараагийн<span className="hidden sm:inline"> бүлэг</span></span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Zero-gap continuous high-quality vertical image strip */}
          <div className="w-full flex flex-col gap-0 p-0 m-0 bg-black">
            {(activeChapter.images && activeChapter.images.length > 0 ? activeChapter.images : DEFAULT_MANGA_PAGES).map((imgUrl, idx) => (
              <MangaPageImage key={`${activeChapter.id}_p_${idx}`} src={imgUrl} pageNum={idx + 1} />
            ))}
          </div>

          {/* Previous & Next navigation arrows block placed at the end of the strip */}
          <div className="w-full max-w-4xl mx-auto px-4 py-10 bg-black border-t border-brand-accent/5 flex flex-col items-center space-y-8">
            <div className="flex justify-between items-center w-full max-w-md gap-2 sm:gap-4 px-2">
              {prevChapter ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReadChapter(prevChapter);
                  }}
                  className="flex items-center gap-1 sm:gap-2 px-2.5 py-1.5 sm:px-3.5 sm:py-2 bg-brand-card hover:bg-brand-accent hover:text-brand-bg text-brand-accent border border-brand-accent/25 rounded-lg transition-all duration-200 cursor-pointer text-[10px] sm:text-xs uppercase font-sans font-bold tracking-wider shrink-0"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Өмнөх<span className="hidden sm:inline"> бүлэг</span></span>
                </button>
              ) : (
                <div className="w-[80px]" />
              )}

              <span className="text-[10px] sm:text-xs text-brand-text-dark font-display font-medium px-2.5 py-1 bg-brand-bg/60 rounded-full border border-brand-accent/5 shrink-0 text-center">
                {activeChapter.title.replace('Бүлэг', '#')}
              </span>

              {nextChapter ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleReadChapter(nextChapter);
                  }}
                  className="flex items-center gap-1 sm:gap-2 px-2.5 py-1.5 sm:px-3.5 sm:py-2 bg-brand-accent hover:bg-brand-accent-hover text-brand-bg border border-transparent rounded-lg transition-all duration-200 cursor-pointer text-[10px] sm:text-xs uppercase font-sans font-extrabold tracking-wider shadow-lg shadow-brand-accent/15 shrink-0"
                >
                  <span>Дараагийн<span className="hidden sm:inline"> бүлэг</span></span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <div className="w-[80px]" />
              )}
            </div>

            {/* Embedded behind-the-scenes Employee Work Info (Admins only) */}
            {(currentUser?.role === 'super_admin' || currentUser?.role === 'admin') && (
              <div className="w-full max-w-xl p-4 bg-brand-card border border-brand-accent/15 rounded-2xl text-left space-y-2">
                <p className="text-xs text-brand-accent uppercase font-bold tracking-wider flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  Ажилтны суулгасан мэдээлэл (Зөвхөн Админд харагдана)
                </p>
                <div className="grid grid-cols-3 gap-4 pt-1 text-xs text-brand-text font-mono">
                  <div>
                    <span className="text-brand-text-dark block">Орчуулагч:</span>
                    <strong className="text-brand-ice">{activeChapter.translator}</strong>
                  </div>
                  <div>
                    <span className="text-brand-text-dark block">Эдитор:</span>
                    <strong className="text-brand-ice">{activeChapter.editor}</strong>
                  </div>
                  <div>
                    <span className="text-brand-text-dark block">Өрөлт хийсэн:</span>
                    <strong className="text-brand-ice">{activeChapter.typesetter}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* INTERACTIVE COMMENTS COMPONENT (Placed strictly at the bottom) */}
            <div
              id="comment-box"
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl bg-transparent border-0 p-0 space-y-5 animate-fade-in shadow-none"
            >
              <h4 className="text-xs font-display font-bold text-brand-accent tracking-wider uppercase flex items-center gap-2 pb-1 border-0">
                <MessageSquare className="w-4 h-4" />
                Сэтгэгдлүүд ({comments.length})
              </h4>

              {/* List */}
              <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1.5 scrollbar-thin">
                {comments.length === 0 ? (
                  <p className="text-xs text-brand-text-dark italic py-4">Одоогоор сэтгэгдэл бичигдээгүй байна. Та анхныхыг нь бичээрэй!</p>
                ) : (
                  comments.map((c) => (
                    <div key={c.id} className="p-3 bg-brand-bg/40 rounded-xl space-y-2 border-0">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="font-bold text-brand-text-dark">{c.username}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-brand-text-dark/50 font-mono">
                            {new Date(c.createdAt).toLocaleDateString()} {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {(currentUser?.role === 'super_admin' || currentUser?.role === 'admin' || (currentUser && currentUser.username === c.username)) && (
                            <button
                              onClick={() => handleDeleteComment(c.id)}
                              className="text-red-400 hover:text-red-300 p-0.5 rounded transition-all cursor-pointer"
                              title="Сэтгэгдэл устгах"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-brand-text leading-relaxed font-sans text-left">{c.text}</p>
                      
                      {/* Reaction & Reply buttons bar */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-0">
                        {/* Reactions block */}
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <button
                            onClick={() => handleReactionClick(c.id, 'likes')}
                            className="flex items-center gap-1 px-2 py-0.5 rounded bg-brand-card/60 hover:bg-brand-accent/10 text-brand-text-dark hover:text-brand-accent transition-all cursor-pointer border-0"
                            title="Дэмжих"
                          >
                            <span>👍</span>
                            <span>{c.reactions?.likes || 0}</span>
                          </button>
                          <button
                            onClick={() => handleReactionClick(c.id, 'hearts')}
                            className="flex items-center gap-1 px-2 py-0.5 rounded bg-brand-card/60 hover:bg-brand-accent/10 text-brand-text-dark hover:text-brand-accent transition-all cursor-pointer border-0"
                            title="Хайрлах"
                          >
                            <span>❤️</span>
                            <span>{c.reactions?.hearts || 0}</span>
                          </button>
                          <button
                            onClick={() => handleReactionClick(c.id, 'fires')}
                            className="flex items-center gap-1 px-2 py-0.5 rounded bg-brand-card/60 hover:bg-brand-accent/10 text-brand-text-dark hover:text-brand-accent transition-all cursor-pointer border-0"
                            title="Гал"
                          >
                            <span>🔥</span>
                            <span>{c.reactions?.fires || 0}</span>
                          </button>
                        </div>

                        {/* Reply trigger */}
                        <button
                          onClick={() => {
                            if (replyingToId === c.id) {
                              setReplyingToId(null);
                            } else {
                              setReplyingToId(c.id);
                              setReplyText('');
                            }
                          }}
                          className="text-[10px] text-brand-accent hover:underline font-semibold cursor-pointer"
                        >
                          Хариулах
                        </button>
                      </div>

                      {/* Inline Reply Form */}
                      {replyingToId === c.id && (
                        <form onSubmit={(e) => handleReplySubmit(e, c.id)} className="flex gap-2 pt-2 border-0 animate-fade-in">
                          <input
                            type="text"
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Хариулт бичих..."
                            className="flex-grow px-2.5 py-1.5 bg-brand-bg/60 border-0 focus:ring-0 rounded-lg text-xs text-brand-text focus:outline-none placeholder:text-brand-text-dark/40 shadow-inner"
                            autoFocus
                          />
                          <button
                            type="submit"
                            className="px-3 py-1.5 bg-brand-accent hover:bg-brand-accent-hover text-brand-bg text-[10px] font-display font-extrabold rounded-lg uppercase tracking-wider transition-all cursor-pointer"
                          >
                            Илгээх
                          </button>
                        </form>
                      )}

                      {/* Thread Replies List */}
                      {c.replies && c.replies.length > 0 && (
                        <div className="pl-4 mt-2 space-y-2 border-l border-brand-accent/5">
                          {c.replies.map((reply) => (
                            <div key={reply.id} className="p-2 bg-brand-bg/25 rounded-lg space-y-0.5 border-0">
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="font-bold text-brand-text-dark/80">{reply.username}</span>
                                <span className="text-[8px] text-brand-text-dark/40 font-mono">
                                  {new Date(reply.createdAt).toLocaleDateString()} {new Date(reply.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-[11px] text-brand-text/90 leading-relaxed font-sans text-left">{reply.text}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Submit form */}
              <form onSubmit={handleAddCommentSubmit} className="flex gap-2 pt-2 border-0">
                <input
                  type="text"
                  value={newCommentText}
                  onChange={(e) => setNewCommentText(e.target.value)}
                  placeholder="Энд сэтгэгдлээ үлдээнэ үү..."
                  className="flex-grow px-3 py-2 bg-brand-bg/60 border-0 focus:ring-0 rounded-xl text-xs text-brand-text focus:outline-none placeholder:text-brand-text-dark/50 shadow-inner"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-accent hover:bg-brand-accent-hover text-brand-bg text-xs font-display font-extrabold rounded-xl uppercase tracking-wider transition-all cursor-pointer shrink-0"
                >
                  Илгээх
                </button>
              </form>
            </div>
          </div>

          {/* Recommendation Engine: Similar Mangas in Active Chapter View */}
          {recommendedMangas.length > 0 && (
            <div className="bg-brand-card/90 border border-brand-accent/15 rounded-3xl p-4 sm:p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-brand-accent/10 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
                  <h3 className="text-xs sm:text-sm font-display font-black text-amber-300 uppercase tracking-wider">
                    Танд санал болгох (Төстэй зохиолууд)
                  </h3>
                </div>
                <span className="text-[10px] text-brand-text-dark font-mono">
                  {manga.genres?.[0] || manga.type || 'Сонгомол'} жанрын зохиолууд
                </span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 sm:gap-3">
                {recommendedMangas.map((recManga) => {
                  const matchingGenres = recManga.genres?.filter(g => manga.genres?.includes(g)) || [];
                  return (
                    <div
                      key={recManga.id}
                      onClick={() => {
                        if (onSelectManga) {
                          onSelectManga(recManga);
                        }
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="group cursor-pointer bg-brand-bg/60 border border-brand-accent/10 hover:border-amber-400/50 rounded-2xl p-2 transition-all duration-300 hover:scale-[1.03] flex flex-col justify-between"
                    >
                      <div className="aspect-[3/4] rounded-xl overflow-hidden mb-1.5 relative shadow-md">
                        <SmartImage
                          src={recManga.coverUrl}
                          alt={recManga.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <span className="absolute top-1 left-1 bg-black/80 backdrop-blur-xs text-amber-300 text-[8px] font-black px-1.5 py-0.5 rounded uppercase">
                          {recManga.type || 'MANGA'}
                        </span>
                        {matchingGenres.length > 0 && (
                          <span className="absolute bottom-1 left-1 bg-amber-500/90 text-black text-[7px] font-black px-1 py-0.2 rounded shadow truncate max-w-[80%]">
                            {matchingGenres[0]}
                          </span>
                        )}
                      </div>
                      <div>
                        <h4 className="text-[11px] sm:text-xs font-extrabold text-brand-text group-hover:text-amber-300 transition-colors line-clamp-1">
                          {recManga.title}
                        </h4>
                        <p className="text-[9px] text-brand-text-dark line-clamp-1">
                          {recManga.author || 'Зохиолч тодорхойгүй'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div id="manga-profile-card" className="bg-brand-card border border-brand-accent/10 rounded-3xl overflow-hidden p-6 md:p-8 space-y-8 shadow-2xl relative">
          {isEditMode ? (
            <form onSubmit={handleUpdateMangaSubmit} className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between border-b border-brand-accent/10 pb-4">
                <h3 className="text-sm font-display font-bold text-brand-accent uppercase tracking-wider">Манганы мэдээлэл засах</h3>
                <button
                  type="button"
                  onClick={() => setIsEditMode(false)}
                  className="px-3 py-1.5 bg-brand-bg hover:bg-brand-card-light border border-brand-accent/15 hover:border-brand-accent rounded-lg text-xs font-semibold text-brand-text hover:text-brand-accent transition-all cursor-pointer"
                >
                  Цуцлах
                </button>
              </div>

              {editSuccessMsg && (
                <div className="p-3 bg-emerald-950/40 border border-emerald-500/20 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{editSuccessMsg}</span>
                </div>
              )}
              {editErrorMsg && (
                <div className="p-3 bg-red-950/40 border border-red-500/20 text-red-300 text-xs rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{editErrorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-brand-text-dark uppercase tracking-wider mb-1.5">Манганы Нэр</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full px-3 py-2 bg-brand-bg border border-brand-accent/10 focus:border-brand-accent/40 rounded-xl text-sm text-brand-text focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-brand-text-dark uppercase tracking-wider mb-1.5">Зохиолч</label>
                    <input
                      type="text"
                      value={editAuthor}
                      onChange={(e) => setEditAuthor(e.target.value)}
                      className="w-full px-3 py-2 bg-brand-bg border border-brand-accent/10 focus:border-brand-accent/40 rounded-xl text-sm text-brand-text focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-brand-text-dark uppercase tracking-wider mb-1.5">Нийтлэлтийн Төлөв</label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as any)}
                      className="w-full px-3 py-2 bg-brand-bg border border-brand-accent/10 focus:border-brand-accent/40 rounded-xl text-xs text-brand-text focus:outline-none cursor-pointer"
                    >
                      <option value="publishing">Гарч буй (Publishing)</option>
                      <option value="completed">Дууссан (Completed)</option>
                      <option value="full_release">Гаргалт гүйцсэн (Full Release)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-brand-text-dark uppercase tracking-wider mb-1.5">Нүүр Зургийн холбоос (URL)</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={editCoverUrl}
                        onChange={(e) => setEditCoverUrl(e.target.value)}
                        className="flex-grow px-3 py-2 bg-brand-bg border border-brand-accent/10 focus:border-brand-accent/40 rounded-xl text-xs text-brand-text focus:outline-none font-mono"
                      />
                      <div className="relative shrink-0 flex gap-1">
                        <button
                          type="button"
                          onClick={() => document.getElementById('edit-cover-file-input')?.click()}
                          className="px-3 py-2 bg-brand-card-light hover:bg-brand-accent/10 hover:text-brand-accent border border-brand-accent/15 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                        >
                          Сонгох
                        </button>
                        <button
                          type="button"
                          onClick={() => openGalleryPicker('single', (urls) => {
                            if (urls.length > 0) setEditCoverUrl(urls[0]);
                          })}
                          className="px-3 py-2 bg-[#1e150d] hover:bg-[#2a1d12] text-[#efa01a] border border-[#efa01a]/30 rounded-xl text-xs font-bold transition-all cursor-pointer animate-pulse-glow"
                        >
                          Галлерей
                        </button>
                        <input
                          id="edit-cover-file-input"
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            if (e.target.files && e.target.files[0]) {
                              const file = e.target.files[0];
                              try {
                                const instantPreview = await fileToDataUrl(file);
                                setEditCoverUrl(instantPreview);

                                const cloudUrl = await uploadSingleImageToCloud(file);
                                if (cloudUrl) {
                                  setEditCoverUrl(cloudUrl);
                                }
                              } catch (err) {
                                console.error("Cover upload error:", err);
                              }
                            }
                          }}
                          className="hidden"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-brand-text-dark uppercase tracking-wider mb-1.5">Товч танилцуулга</label>
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 bg-brand-bg border border-brand-accent/10 focus:border-brand-accent/40 rounded-xl text-sm text-brand-text focus:outline-none resize-none"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2 border-t border-brand-accent/10 pt-4">
                <label className="block text-xs font-semibold text-brand-text-dark uppercase tracking-wider">Жанрууд</label>
                <div className="flex flex-wrap gap-2">
                  {allGenres.map((genre) => {
                    const isSelected = editGenres.includes(genre);
                    return (
                      <button
                        key={genre}
                        type="button"
                        onClick={() => handleEditGenreToggle(genre)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-brand-accent/15 border-brand-accent text-brand-accent shadow-sm'
                            : 'bg-brand-bg border-brand-accent/10 text-brand-text-dark hover:border-brand-accent/40'
                        }`}
                      >
                        {genre}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-brand-accent hover:bg-brand-accent-hover text-brand-bg font-display font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-brand-accent/20"
                >
                  Шинэчлэх
                </button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col md:flex-row gap-6 md:gap-10">
              <div className="w-full md:w-1/3 shrink-0 rounded-2xl overflow-hidden aspect-[3/4] bg-brand-card-light border border-brand-accent/15 relative">
                <SmartImage
                  id="manga-detail-cover"
                  key={manga.coverUrl}
                  loading="eager"
                  src={manga.coverUrl}
                  alt={manga.title}
                  className="w-full h-full object-cover"
                />
                <span className="absolute top-3 left-3 text-[10px] bg-brand-accent text-brand-bg font-extrabold px-2.5 py-1 rounded-md uppercase tracking-wider">
                  {manga.status === 'publishing' ? 'Гарч буй' : manga.status === 'completed' ? 'Дууссан' : 'Гаргалт гүйцсэн'}
                </span>
              </div>

              <div className="flex-grow space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-brand-accent font-mono tracking-widest uppercase">Зохиолч: {manga.author}</p>
                    
                    {/* ELEGANT SMALLER GLOWING CURVY MANGA TITLE */}
                    <h2
                      id="manga-detail-title"
                      className="font-serif font-semibold italic text-brand-accent drop-shadow-[0_0_10px_rgba(56,189,248,0.45)] select-none text-xl md:text-2xl mt-1 text-transparent bg-clip-text bg-gradient-to-r from-brand-accent to-brand-ice leading-tight"
                    >
                      {manga.title}
                    </h2>
                  </div>
                  {(currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && (
                    <button
                      onClick={() => setIsEditMode(true)}
                      className="px-3 py-1.5 bg-[#1e150d] hover:bg-[#2a1d12] text-[#efa01a] border border-amber-500/25 hover:border-amber-500/50 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-[#efa01a]" />
                      <span>Засах</span>
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-2.5 sm:gap-4 text-xs font-mono text-brand-text-dark items-center">
                  <div className="flex items-center gap-1.5 bg-brand-bg/60 px-3 py-1.5 rounded-full border border-brand-accent/5">
                    <Eye className="w-4 h-4 text-brand-accent" />
                    <span>{manga.views} уншсан</span>
                  </div>

                  {/* Interactive Heart Save Button */}
                  <button
                    id={`manga-detail-heart-btn-${manga.id}`}
                    onClick={() => onToggleSave?.(manga.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all cursor-pointer font-sans text-xs ${
                      isSaved
                        ? 'bg-red-500/20 border-red-500/60 text-red-400 font-bold shadow-md shadow-red-500/20'
                        : 'bg-brand-bg/60 border-brand-accent/10 text-brand-text-dark hover:text-red-400 hover:border-red-500/40'
                    }`}
                    title={isSaved ? 'Хадгалснаас гаргах' : 'Хадгалах (Таалагдлаа)'}
                  >
                    <Heart className={`w-4 h-4 ${isSaved ? 'fill-red-500 text-red-500 animate-pulse' : ''}`} />
                    <span>{manga.likes} таалагдсан {isSaved && '(Хадгалсан)'}</span>
                  </button>

                  {/* Share/Copy Link Button - Always visible to all users */}
                  <button
                    id={`manga-detail-copy-link-btn-${manga.id}`}
                    onClick={() => onCopyLink?.(manga)}
                    className="flex items-center gap-1.5 bg-brand-bg/80 hover:bg-brand-card text-brand-accent hover:text-brand-ice px-3.5 py-1.5 rounded-full border border-brand-accent/20 hover:border-brand-accent/60 transition-all cursor-pointer font-sans font-semibold shadow-sm"
                    title="Манганы линк хуулах"
                  >
                    <Link className="w-4 h-4 text-brand-accent shrink-0" />
                    <span>Линк хуулах</span>
                  </button>
                </div>

                <div className="space-y-1">
                  <p className="text-[11px] text-brand-text-dark uppercase font-semibold tracking-wider">Төрөл жанр</p>
                  <div className="flex flex-wrap gap-1.5">
                    {manga.genres.map((g, i) => (
                      <span
                        key={i}
                        className="text-xs bg-brand-card-light text-brand-ice border border-brand-accent/10 px-3 py-1 rounded-lg font-medium"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-1 pt-2">
                  <p className="text-[11px] text-brand-text-dark uppercase font-semibold tracking-wider">Товч танилцуулга</p>
                  <p className="text-sm text-brand-text-dark leading-relaxed">
                    {manga.description}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4 pt-6 border-t border-brand-accent/10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-xl font-display font-bold text-brand-text flex items-center gap-2">
                <span>Бүлгүүд ({sortedMangaChapters.length})</span>
              </h3>

              {/* Sort Order Toggle Controls */}
              {sortedMangaChapters.length > 0 && (
                <div className="flex items-center gap-1.5 bg-brand-bg/80 border border-brand-accent/15 p-1 rounded-xl text-xs">
                  <span className="text-[10px] text-brand-text-dark font-mono px-1.5 hidden sm:inline">Эрэмбэ:</span>
                  <button
                    type="button"
                    onClick={() => setChapterSortOrder('asc')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      chapterSortOrder === 'asc'
                        ? 'bg-brand-accent text-brand-bg shadow-md'
                        : 'text-brand-text-dark hover:text-brand-text'
                    }`}
                    title="1-ээс эхэлж жагсаах"
                  >
                    <span>1 ➔ Сүүл</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setChapterSortOrder('desc')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      chapterSortOrder === 'desc'
                        ? 'bg-brand-accent text-brand-bg shadow-md'
                        : 'text-brand-text-dark hover:text-brand-text'
                    }`}
                    title="Сүүлчээс эхэлж жагсаах"
                  >
                    <span>Сүүл ➔ 1</span>
                  </button>
                </div>
              )}
            </div>

            {sortedMangaChapters.length === 0 ? (
              <div className="py-12 bg-brand-bg/30 border border-dashed border-brand-accent/10 rounded-2xl text-center space-y-2">
                <AlertTriangle className="w-8 h-8 text-brand-accent/40 mx-auto" />
                <p className="text-sm text-brand-text-dark">Одоогоор бүлэг ороогүй байна.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {displayedChapters.map((chapter) => {
                    const userHasVip = isUserVip();
                    const isLocked = chapter.isVip && !userHasVip;
                    const progress = getChapterProgress(chapter.id);
                    // Automatic fallback to 1st main page image if no poster is uploaded
                    const chapterThumb = chapter.posterUrl || (chapter.images && chapter.images.length > 0 ? chapter.images[0] : manga.coverUrl);

                  return (
                    <div
                      id={`chapter-item-${chapter.id}`}
                      key={chapter.id}
                      onClick={() => handleReadChapter(chapter)}
                      className="group p-2 sm:p-2.5 bg-brand-bg/80 border hover:border-brand-accent/40 rounded-xl flex flex-col justify-between transition-all cursor-pointer relative overflow-hidden"
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                          {/* Chapter Poster Image on Left */}
                          <div className="relative w-9 h-12 sm:w-10 sm:h-14 rounded-md overflow-hidden shrink-0 border border-brand-accent/20 bg-brand-card-light shadow-sm">
                            <img
                              src={chapterThumb || manga.coverUrl || DEFAULT_FALLBACK_IMAGE}
                              alt={chapter.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              referrerPolicy="no-referrer"
                              loading="lazy"
                              onError={(e) => {
                                const target = e.currentTarget;
                                if (chapterThumb && chapterThumb.startsWith('http') && !target.dataset.proxied) {
                                  target.dataset.proxied = 'true';
                                  target.src = `/api/proxy-image?url=${encodeURIComponent(chapterThumb)}`;
                                  return;
                                }
                                if (target.src !== (manga.coverUrl || DEFAULT_FALLBACK_IMAGE)) {
                                  target.src = manga.coverUrl || DEFAULT_FALLBACK_IMAGE;
                                }
                              }}
                            />
                            {isLocked && (
                              <div className="absolute inset-0 bg-black/70 backdrop-blur-[1px] flex items-center justify-center">
                                <Lock className="w-3.5 h-3.5 text-brand-accent" />
                              </div>
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="font-display font-semibold text-brand-text group-hover:text-brand-accent transition-colors text-xs sm:text-sm truncate">
                                {chapter.title}
                              </p>
                              {chapter.isVip && (
                                <span className="px-1 py-0.2 bg-brand-accent/20 text-[8px] sm:text-[9px] text-brand-accent rounded font-bold uppercase">
                                  VIP
                                </span>
                              )}
                              {progress > 0 && (
                                <span className={`px-1.5 py-0.2 text-[9px] sm:text-[10px] font-bold rounded-full border flex items-center gap-1 ${
                                  progress >= 95
                                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                }`}>
                                  <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-current" />
                                  {progress >= 95 ? '✓ 100% уншсан' : `${progress}% уншсан`}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {chapter.createdAt && (
                                <span className="text-[9px] sm:text-[10px] text-zinc-400 font-mono flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5 text-cyan-400" />
                                  {getTimeAgo(chapter.createdAt)}
                                </span>
                              )}
                              {(currentUser?.role === 'super_admin' || currentUser?.role === 'admin') && (
                                <p className="text-[9px] sm:text-[10px] text-brand-accent/70 font-mono leading-none">
                                  Орчуулга: <span className="text-brand-ice font-medium">{chapter.translator}</span>
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Bottom Chapter Reading Progress Bar */}
                        {progress > 0 && (
                          <div className="absolute bottom-0 left-0 right-0 h-1 bg-brand-bg/80 overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${
                                progress >= 95 ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]'
                              }`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                          {/* Copy Link Button */}
                          <button
                            onClick={(e) => handleCopyLink(e, chapter.id)}
                            className="p-1 text-brand-text-dark hover:text-brand-accent hover:bg-brand-bg/60 rounded-lg transition-all cursor-pointer flex items-center gap-1 text-[11px]"
                            title="Линк хуулах"
                          >
                            {copiedChapterId === chapter.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400 animate-bounce" />
                                <span className="text-[9px] text-emerald-400 font-bold hidden sm:inline">Хуулагдлаа!</span>
                              </>
                            ) : (
                              <>
                                <Link className="w-3 h-3 text-brand-text-dark/80 group-hover:text-brand-accent" />
                                <span className="text-[9px] text-brand-text-dark/50 hidden sm:inline">Хуулах</span>
                              </>
                            )}
                          </button>

                          {isLocked ? (
                            <button
                              id={`chapter-vip-unlock-btn-${chapter.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onGoToVipPanel();
                              }}
                              className="text-[9px] sm:text-[10px] px-2 py-0.5 bg-brand-accent/15 hover:bg-brand-accent text-brand-accent hover:text-brand-bg rounded-lg border border-brand-accent/35 font-semibold uppercase transition-all cursor-pointer"
                            >
                              Нээх
                            </button>
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5 text-brand-text-dark group-hover:text-brand-accent" />
                          )}

                          {/* Chapter edit button for admins */}
                          {(currentUser?.role === 'super_admin' || currentUser?.role === 'admin') && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEditChapter(chapter);
                              }}
                              className="p-1 text-brand-text-dark hover:text-brand-accent hover:bg-brand-bg/60 rounded transition-all cursor-pointer"
                              title="Бүлэг засах"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          )}

                          {canDelete && (
                            deletingChapterId === chapter.id ? (
                              <div className="flex items-center gap-1 bg-red-950/90 border border-red-500 rounded-lg p-1 animate-fade-in shadow-lg">
                                <button
                                  id={`chapter-confirm-delete-btn-${chapter.id}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteChapter(chapter.id);
                                    setDeletingChapterId(null);
                                  }}
                                  className="px-1.5 py-0.5 bg-red-600 hover:bg-red-500 text-white text-[9px] font-bold rounded cursor-pointer"
                                >
                                  Устгах!
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeletingChapterId(null);
                                  }}
                                  className="px-1 py-0.5 text-zinc-300 hover:text-white text-[9px] font-bold cursor-pointer"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <button
                                id={`chapter-delete-btn-${chapter.id}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingChapterId(chapter.id);
                                }}
                                className="p-1 text-brand-text-dark hover:text-red-400 hover:bg-red-950/20 rounded transition-all cursor-pointer"
                                title="Бүлэг устгах"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )
                          )}
                        </div>
                      </div>

                      {/* Visual progress bar at bottom of card */}
                      {progress > 0 && (
                        <div className="w-full h-0.5 bg-brand-card-light/60 rounded-full overflow-hidden mt-1.5">
                          <div
                            className={`h-full transition-all duration-300 ${
                              progress >= 95 ? 'bg-emerald-400' : 'bg-amber-400'
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Show More / Collapse Button */}
              {sortedMangaChapters.length > 20 && (
                <div className="pt-4 flex justify-center">
                  {!showAllChapters ? (
                    <button
                      type="button"
                      id="manga-chapters-load-more-btn"
                      onClick={() => setShowAllChapters(true)}
                      className="px-6 py-3 bg-brand-bg hover:bg-brand-accent/10 border border-brand-accent/30 hover:border-brand-accent text-brand-accent font-extrabold text-xs sm:text-sm rounded-2xl flex items-center gap-2 shadow-lg transition-all cursor-pointer active:scale-95 group"
                    >
                      <span>Үргэлжлүүлж бүх бүлгийг харах ({sortedMangaChapters.length - 20} бүлэг үлдсэн)</span>
                      <ChevronDown className="w-4 h-4 text-brand-accent group-hover:translate-y-0.5 transition-transform" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowAllChapters(false)}
                      className="px-5 py-2.5 bg-brand-bg hover:bg-white/5 border border-white/10 text-brand-text-dark hover:text-brand-text font-bold text-xs rounded-xl flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <span>Эхний 20 бүлгийг харуулах (Хураах)</span>
                      <ChevronDown className="w-3.5 h-3.5 text-brand-text-dark rotate-180 transition-transform" />
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>

          {/* MANGA COMMENTS SECTION (Comments directly on the Manga itself) */}
          <div className="space-y-4 pt-6 border-t border-brand-accent/10">
            <h3 className="text-sm font-display font-bold text-brand-accent tracking-wider uppercase flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-brand-accent" />
              Манганы сэтгэгдлүүд ({mangaComments.length})
            </h3>

            <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1.5 scrollbar-thin">
              {mangaComments.length === 0 ? (
                <p className="text-xs text-brand-text-dark italic py-2">
                  Энэ манга дээр одоогоор сэтгэгдэл бичигдээгүй байна. Та анхныхыг нь бичээрэй!
                </p>
              ) : (
                mangaComments.map((c) => (
                  <div key={c.id} className="p-3.5 bg-brand-bg/40 border border-brand-accent/10 rounded-2xl space-y-2">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="font-bold text-brand-text">{c.username}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] text-brand-text-dark/60 font-mono">
                          {new Date(c.createdAt).toLocaleDateString()} {new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {(currentUser?.role === 'super_admin' || currentUser?.role === 'admin' || (currentUser && currentUser.username === c.username)) && (
                          <button
                            type="button"
                            onClick={() => handleDeleteMangaComment(c.id)}
                            className="text-red-400 hover:text-red-300 p-0.5 rounded transition-all cursor-pointer"
                            title="Сэтгэгдэл устгах"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-brand-text leading-relaxed font-sans">{c.text}</p>
                    
                    {/* Reactions & Reply button */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5">
                      <div className="flex items-center gap-1.5 text-[10px]">
                        <button
                          type="button"
                          onClick={() => handleMangaCommentReactionClick(c.id, 'likes')}
                          className="flex items-center gap-1 px-2 py-0.5 rounded bg-brand-card/60 hover:bg-brand-accent/10 text-brand-text-dark hover:text-brand-accent transition-all cursor-pointer"
                          title="Дэмжих"
                        >
                          <span>👍</span>
                          <span>{c.reactions?.likes || 0}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMangaCommentReactionClick(c.id, 'hearts')}
                          className="flex items-center gap-1 px-2 py-0.5 rounded bg-brand-card/60 hover:bg-brand-accent/10 text-brand-text-dark hover:text-brand-accent transition-all cursor-pointer"
                          title="Хайрлах"
                        >
                          <span>❤️</span>
                          <span>{c.reactions?.hearts || 0}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMangaCommentReactionClick(c.id, 'fires')}
                          className="flex items-center gap-1 px-2 py-0.5 rounded bg-brand-card/60 hover:bg-brand-accent/10 text-brand-text-dark hover:text-brand-accent transition-all cursor-pointer"
                          title="Гал"
                        >
                          <span>🔥</span>
                          <span>{c.reactions?.fires || 0}</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (mangaReplyingToId === c.id) {
                            setMangaReplyingToId(null);
                          } else {
                            setMangaReplyingToId(c.id);
                            setMangaReplyText('');
                          }
                        }}
                        className="text-[10px] text-brand-accent hover:underline font-semibold cursor-pointer"
                      >
                        Хариулах
                      </button>
                    </div>

                    {/* Reply form */}
                    {mangaReplyingToId === c.id && (
                      <form onSubmit={(e) => handleMangaReplySubmit(e, c.id)} className="flex gap-2 pt-2 animate-fade-in">
                        <input
                          type="text"
                          value={mangaReplyText}
                          onChange={(e) => setMangaReplyText(e.target.value)}
                          placeholder="Хариулт бичих..."
                          className="flex-grow px-2.5 py-1.5 bg-brand-bg/80 border border-brand-accent/20 rounded-lg text-xs text-brand-text focus:outline-none focus:border-brand-accent"
                          autoFocus
                        />
                        <button
                          type="submit"
                          className="px-3 py-1.5 bg-brand-accent hover:bg-brand-accent-hover text-brand-bg text-[10px] font-display font-extrabold rounded-lg uppercase tracking-wider transition-all cursor-pointer"
                        >
                          Илгээх
                        </button>
                      </form>
                    )}

                    {/* Replies list */}
                    {c.replies && c.replies.length > 0 && (
                      <div className="pl-4 mt-2 space-y-2 border-l border-brand-accent/10">
                        {c.replies.map((reply) => (
                          <div key={reply.id} className="p-2 bg-brand-bg/25 rounded-lg space-y-0.5">
                            <div className="flex justify-between items-center text-[10px]">
                              <span className="font-bold text-brand-text-dark/80">{reply.username}</span>
                              <span className="text-[8px] text-brand-text-dark/40 font-mono">
                                {new Date(reply.createdAt).toLocaleDateString()} {new Date(reply.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <p className="text-[11px] text-brand-text/90 leading-relaxed font-sans">{reply.text}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* New Manga Comment Form */}
            <form onSubmit={handleAddMangaCommentSubmit} className="flex gap-2 pt-2">
              <input
                type="text"
                value={newMangaCommentText}
                onChange={(e) => setNewMangaCommentText(e.target.value)}
                placeholder="Манганы тухай сэтгэгдэл үлдээх..."
                className="flex-grow px-3.5 py-2 bg-brand-bg/80 border border-brand-accent/20 rounded-xl text-xs text-brand-text focus:outline-none focus:border-brand-accent placeholder:text-brand-text-dark/50"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-brand-accent hover:bg-brand-accent-hover text-brand-bg text-xs font-display font-extrabold rounded-xl uppercase tracking-wider transition-all cursor-pointer shrink-0 shadow-md shadow-brand-accent/20"
              >
                Илгээх
              </button>
            </form>
          </div>

          {/* Recommendation Engine: Similar Mangas on Manga Profile Page */}
          {recommendedMangas.length > 0 && (
            <div className="space-y-4 pt-8 border-t border-brand-accent/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
                  <h3 className="text-sm sm:text-base font-display font-black text-amber-300 uppercase tracking-wider">
                    Танд санал болгох (Төстэй зохиолууд)
                  </h3>
                </div>
                <span className="text-[10px] text-brand-text-dark font-mono">
                  Автомат санал болгох систем
                </span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 sm:gap-3">
                {recommendedMangas.map((recManga) => {
                  const matchingGenres = recManga.genres?.filter(g => manga.genres?.includes(g)) || [];
                  return (
                    <div
                      key={recManga.id}
                      onClick={() => {
                        if (onSelectManga) {
                          onSelectManga(recManga);
                        }
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="group cursor-pointer bg-brand-bg/60 border border-brand-accent/10 hover:border-amber-400/50 rounded-2xl p-2 transition-all duration-300 hover:scale-[1.03] flex flex-col justify-between"
                    >
                      <div className="aspect-[3/4] rounded-xl overflow-hidden mb-1.5 relative shadow-md">
                        <img
                          src={recManga.coverUrl || DEFAULT_FALLBACK_IMAGE}
                          alt={recManga.title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => { e.currentTarget.src = DEFAULT_FALLBACK_IMAGE; }}
                        />
                        <span className="absolute top-1 left-1 bg-black/80 backdrop-blur-xs text-amber-300 text-[8px] font-black px-1.5 py-0.5 rounded uppercase">
                          {recManga.type || 'MANGA'}
                        </span>
                        {matchingGenres.length > 0 && (
                          <span className="absolute bottom-1 left-1 bg-amber-500/90 text-black text-[7px] font-black px-1 py-0.2 rounded shadow truncate max-w-[80%]">
                            {matchingGenres[0]}
                          </span>
                        )}
                      </div>
                      <div>
                        <h4 className="text-[11px] sm:text-xs font-extrabold text-brand-text group-hover:text-amber-300 transition-colors line-clamp-1">
                          {recManga.title}
                        </h4>
                        <p className="text-[9px] text-brand-text-dark line-clamp-1">
                          {recManga.author || 'Зохиолч тодорхойгүй'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Chapter Modal (Sized and scrollable to prevent overflow) */}
      {isAddModalOpen && (
        <div id="add-chapter-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div
            id="add-chapter-modal-content"
            className="w-full max-w-lg bg-brand-card border border-brand-accent/20 rounded-2xl p-6 shadow-2xl relative max-h-[85vh] overflow-y-auto scrollbar-thin"
          >
            <button
              id="add-chapter-modal-close"
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 text-brand-text-dark hover:text-brand-accent transition-colors bg-brand-bg/50 p-1 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-display font-bold text-brand-accent mb-1 uppercase">
              Шинэ бүлэг нэмэх
            </h3>
            <p className="text-xs text-brand-text-dark mb-4 uppercase font-mono">Манга: {manga.title}</p>

            {formError && (
              <div className="mb-4 p-3 bg-red-950/40 border border-red-500/30 rounded-lg text-red-300 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold text-brand-text-dark mb-1">
                  Бүлгийн нэр / Дугаар (e.g. Бүлэг 5)
                </label>
                <input
                  type="text"
                  value={chTitle}
                  onChange={(e) => setChTitle(e.target.value)}
                  placeholder="Бүлэг 5"
                  className="w-full px-3 py-2 bg-brand-bg border border-brand-accent/20 rounded-lg text-sm text-brand-text focus:outline-none focus:border-brand-accent font-sans"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-brand-text-dark mb-1">
                    Орчуулагч
                  </label>
                  <select
                    value={selectedTranslator}
                    onChange={(e) => setSelectedTranslator(e.target.value)}
                    className="w-full px-2 py-2 bg-brand-bg border border-brand-accent/20 rounded-lg text-xs text-brand-text focus:outline-none focus:border-brand-accent cursor-pointer"
                  >
                    <option value="">-- Сонгох --</option>
                    {staffNames.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-brand-text-dark mb-1">
                    Эдитор
                  </label>
                  <select
                    value={selectedEditor}
                    onChange={(e) => setSelectedEditor(e.target.value)}
                    className="w-full px-2 py-2 bg-brand-bg border border-brand-accent/20 rounded-lg text-xs text-brand-text focus:outline-none focus:border-brand-accent cursor-pointer"
                  >
                    <option value="">-- Сонгох --</option>
                    {staffNames.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-brand-text-dark mb-1">
                    Өрөлт
                  </label>
                  <select
                    value={selectedTypesetter}
                    onChange={(e) => setSelectedTypesetter(e.target.value)}
                    className="w-full px-2 py-2 bg-brand-bg border border-brand-accent/20 rounded-lg text-xs text-brand-text focus:outline-none focus:border-brand-accent cursor-pointer"
                  >
                    <option value="">-- Сонгох --</option>
                    {staffNames.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-brand-text-dark mb-1">
                  Бүлгийн постер зураг (Сонголттой - оруулахгүй бол 1-р хуудас автоматаар ашиглагдана)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={chPosterUrl}
                    onChange={(e) => setChPosterUrl(e.target.value)}
                    placeholder="Зургийн URL холбоос эсвэл Файлаар оруулах..."
                    className="flex-grow px-3 py-2 bg-brand-bg border border-brand-accent/20 rounded-lg text-xs text-brand-text focus:outline-none focus:border-brand-accent font-sans"
                  />
                  <label className="px-3 py-2 bg-brand-card hover:bg-brand-accent/20 border border-brand-accent/30 text-brand-accent rounded-lg text-xs font-bold cursor-pointer transition-all shrink-0 flex items-center gap-1">
                    <Image className="w-3.5 h-3.5" />
                    <span>Файл сонгох</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const instantDataUrl = await fileToDataUrl(file);
                            if (instantDataUrl) setChPosterUrl(instantDataUrl);
                            const url = await uploadSingleImageToCloud(file);
                            if (url) {
                              setChPosterUrl(url);
                            }
                          } catch (err) {
                            console.error(err);
                          }
                        }
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
                {chPosterUrl && (
                  <div className="mt-2 flex items-center gap-2 bg-brand-bg/50 p-1.5 rounded-lg border border-brand-accent/20">
                    <img src={chPosterUrl} alt="Poster preview" className="w-10 h-14 object-cover rounded shadow border border-brand-accent/30" />
                    <span className="text-[11px] text-emerald-400 font-bold flex-grow truncate">Постер зураг сонгогдлоо!</span>
                    <button
                      type="button"
                      onClick={() => setChPosterUrl('')}
                      className="text-[10px] text-red-400 hover:text-red-300 font-bold px-2 py-1 bg-red-950/40 rounded cursor-pointer"
                    >
                      Арилгах
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-brand-text-dark mb-1">
                  Төлөв (Энгийн / VIP)
                </label>
                <div className="flex items-center gap-4 mt-1 bg-brand-bg p-3 rounded-lg border border-brand-accent/10">
                  <label className="flex items-center gap-2 text-xs text-brand-text cursor-pointer">
                    <input
                      type="radio"
                      name="isVip"
                      checked={!isVip}
                      onChange={() => setIsVip(false)}
                      className="accent-brand-accent"
                    />
                    <span>Энгийн (Үнэгүй)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-brand-text cursor-pointer">
                    <input
                      type="radio"
                      name="isVip"
                      checked={isVip}
                      onChange={() => setIsVip(true)}
                      className="accent-brand-accent"
                    />
                    <span className="text-brand-accent font-semibold flex items-center gap-1">
                      <Lock className="w-3 h-3" /> VIP Бүлэг
                    </span>
                  </label>
                </div>
              </div>

              {/* AI Quality Detail Enhancer (Rendered FIRST so it is configured before file select!) */}
              <div className="p-3.5 bg-brand-accent/5 border border-brand-accent/10 rounded-xl space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={aiUpscale}
                    onChange={(e) => setAiUpscale(e.target.checked)}
                    className="accent-brand-accent mt-0.5"
                  />
                  <div>
                    <span className="text-xs font-bold text-brand-accent flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-brand-accent animate-pulse" />
                      AI Detail & Quality Enhancer
                    </span>
                    <p className="text-[10px] text-brand-text-dark leading-snug mt-0.5">
                      Зураас болон өнгийг алдагдалгүй тодруулж 4K нягтаршилтай урт стрип болгох.
                    </p>
                  </div>
                </label>

                {aiUpscale && (
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-brand-accent/5">
                    <div>
                      <label className="block text-[10px] text-brand-text-dark mb-1 uppercase font-semibold">Режим (Mode)</label>
                      <select
                        value={upscaleMode}
                        onChange={(e) => setUpscaleMode(e.target.value as any)}
                        className="w-full px-2 py-1 bg-brand-bg border border-brand-accent/10 rounded text-xs text-brand-text"
                      >
                        <option value="color">Webtoon Color (Өнгөт)</option>
                        <option value="lineart">Manga Lineart (Хар цагаан)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-brand-text-dark mb-1 uppercase font-semibold">Хэмжээ (Multiplier)</label>
                      <select
                        value={upscaleMultiplier}
                        onChange={(e) => setUpscaleMultiplier(e.target.value as any)}
                        className="w-full px-2 py-1 bg-brand-bg border border-brand-accent/10 rounded text-xs text-brand-text"
                      >
                        <option value="4x">4x Ultra HD</option>
                        <option value="2x">2x High Quality</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Multiple High Quality File Upload Zone (User has set AI toggle first!) */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-brand-text-dark uppercase tracking-wider">
                  Бүлгийн хуудаснууд (Cloud серверт шууд хуулагдана)
                </label>

                <div className="flex gap-2 mb-1.5">
                  <button
                    type="button"
                    onClick={() => openGalleryPicker('multiple', (urls) => {
                      setUploadedImages(prev => [...prev, ...urls]);
                    })}
                    className="flex-grow py-2 px-3 bg-brand-accent/15 hover:bg-brand-accent hover:text-brand-bg text-brand-accent border border-brand-accent/30 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Image className="w-4 h-4 text-brand-accent" />
                    <span>Зургийн Галлерейгаас хуудаснууд сонгох</span>
                  </button>
                </div>

                {/* Drag and Drop Zone */}
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('chapter-file-input')?.click()}
                  className="border-2 border-dashed border-brand-accent/20 hover:border-brand-accent/50 bg-brand-bg/50 hover:bg-brand-bg/80 transition-all rounded-xl p-4 text-center cursor-pointer space-y-1.5 group"
                >
                  <input
                    id="chapter-file-input"
                    type="file"
                    multiple
                    accept="image/*,.zip,application/zip,application/x-zip-compressed"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="w-8 h-8 rounded-full bg-brand-accent/10 flex items-center justify-center mx-auto text-brand-accent group-hover:scale-110 transition-transform">
                    <Plus className="w-4 h-4" />
                  </div>
                  <p className="text-xs text-brand-text font-semibold">Утасны галерей, компьютерээс зураг болон ZIP сонгох</p>
                  <p className="text-[10px] text-emerald-400 font-mono font-bold">
                    ⚡ Зургууд Base64 биш Cloud Server руу шууд хадгалагдана
                  </p>
                </div>

                {/* Upload Status Bar */}
                {isUploadingFiles && (
                  <div className="p-3 bg-brand-accent/10 border border-brand-accent/30 rounded-xl flex items-center gap-3 animate-pulse">
                    <div className="w-4 h-4 border-2 border-brand-accent border-t-transparent rounded-full animate-spin shrink-0" />
                    <span className="text-xs text-brand-accent font-mono font-bold">{uploadStatusMsg}</span>
                  </div>
                )}

                {/* Direct Image URLs Paste Box */}
                <div className="space-y-1 pt-1">
                  <label className="block text-[11px] font-bold text-brand-accent uppercase tracking-wider">
                    Эсвэл зургийн URL Линкүүд оруулах (Мөр бүрд 1 линк):
                  </label>
                  <textarea
                    rows={3}
                    value={pastedImageUrls}
                    onChange={(e) => setPastedImageUrls(e.target.value)}
                    placeholder="https://example.com/page1.jpg&#10;https://example.com/page2.jpg"
                    className="w-full p-2.5 bg-brand-bg border border-brand-accent/20 rounded-xl text-xs text-brand-text font-mono focus:outline-none focus:border-brand-accent"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const urls = parseImageUrlsInput(pastedImageUrls);
                      if (urls.length > 0) {
                        setUploadedImages(prev => [...prev, ...urls]);
                        setPastedImageUrls('');
                      } else {
                        alert('Зөв HTTP/HTTPS зургийн линк оруулна уу.');
                      }
                    }}
                    className="px-3 py-1.5 bg-brand-card hover:bg-brand-accent hover:text-brand-bg text-brand-accent border border-brand-accent/30 rounded-lg text-xs font-bold transition-all cursor-pointer"
                  >
                    + Линкүүдийг нэмэх
                  </button>
                </div>

                {/* Selected File Previews */}
                {uploadedImages.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-brand-text-dark font-semibold uppercase font-mono">
                        Оруулсан хуудасны тоо: {uploadedImages.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => setUploadedImages([])}
                        className="text-[10px] text-red-400 hover:underline font-semibold"
                      >
                        Бүгдийг арилгах
                      </button>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
                      {uploadedImages.map((img, idx) => (
                        <div key={idx} className="relative w-14 h-18 bg-brand-bg border border-brand-accent/15 rounded-lg overflow-hidden shrink-0 group">
                          <img src={img} alt="" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeUploadedImage(idx)}
                            className="absolute top-0.5 right-0.5 p-0.5 bg-black/85 rounded-full text-red-400 hover:text-red-300 border border-red-500/10"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                          <span className="absolute bottom-0 inset-x-0 text-[8px] bg-black/60 text-center text-white py-0.5 font-mono">{idx + 1}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Progress Overlay when publishing or upscaling */}
              {(isPublishing || isUpscaling) && (
                <div className="absolute inset-0 bg-brand-bg/95 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center p-6 text-center space-y-6 z-50 animate-fade-in">
                  <div className="relative w-16 h-16 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full border-4 border-brand-accent/20 border-t-brand-accent animate-spin" />
                    <Sparkles className="w-6 h-6 text-brand-accent animate-pulse" />
                  </div>
                  <div className="space-y-2 w-full max-w-xs">
                    <h4 className="text-xs font-display font-bold text-brand-text uppercase tracking-wider">
                      {isPublishing ? 'Бүлэг Нийтлэж Байна...' : 'AI Чанар Сайжруулагч...'}
                    </h4>
                    <p className="text-[11px] text-brand-accent font-mono leading-relaxed h-12 flex items-center justify-center px-4">
                      {isPublishing ? publishStatusMsg : upscaleStatus}
                    </p>
                    {/* Progress Bar */}
                    <div className="w-full h-2 bg-brand-card-light rounded-full overflow-hidden border border-brand-accent/10">
                      <div
                        className="h-full bg-brand-accent transition-all duration-300 rounded-full"
                        style={{ width: `${isPublishing ? publishProgress : upscaleProgress}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-brand-text font-bold font-mono">
                      {isPublishing ? `${publishProgress}% нийтэлсэн` : `${upscaleProgress}% боловсруулсан`}
                    </span>
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2.5 bg-brand-accent hover:bg-brand-accent-hover text-brand-bg font-display font-semibold rounded-lg text-sm uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-brand-accent/20"
              >
                Бүлэг оруулах
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Chapter Modal (Custom built to edit title, assigned workers, and detailed page deletion/replacement) */}
      {editingChapter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-brand-card border border-brand-accent/20 rounded-3xl p-6 relative max-h-[90vh] overflow-y-auto shadow-2xl scrollbar-thin">
            <button
              onClick={() => setEditingChapter(null)}
              className="absolute top-4 right-4 text-brand-text-dark hover:text-brand-accent transition-colors bg-brand-bg/50 p-1.5 rounded-full"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-base font-display font-bold text-brand-accent uppercase tracking-wider mb-1">
              Бүлгийн мэдээлэл болон зураг засах
            </h3>
            <p className="text-xs text-brand-text-dark font-mono uppercase mb-4">Манга: {manga.title}</p>

            <div className="space-y-4 text-left">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-brand-text-dark mb-1">Бүлгийн дугаар / нэр</label>
                  <input
                    type="text"
                    value={editChTitle}
                    onChange={(e) => setEditChTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-brand-bg border border-brand-accent/20 rounded-xl text-sm text-brand-text focus:outline-none focus:border-brand-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-brand-text-dark mb-1">Төлөв</label>
                  <select
                    value={editChIsVip ? 'vip' : 'free'}
                    onChange={(e) => setEditChIsVip(e.target.value === 'vip')}
                    className="w-full px-3 py-2 bg-brand-bg border border-brand-accent/20 rounded-xl text-sm text-brand-text focus:outline-none focus:border-brand-accent cursor-pointer"
                  >
                    <option value="free">Энгийн (Үнэгүй)</option>
                    <option value="vip">★ VIP Бүлэг</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-brand-text-dark mb-1">
                  Бүлгийн постер зураг (Сонголттой - оруулахгүй бол 1-р гол зураг автоматаар ашиглагдана)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editChPosterUrl}
                    onChange={(e) => setEditChPosterUrl(e.target.value)}
                    placeholder="Зургийн URL холбоос эсвэл Файлаар оруулах..."
                    className="flex-grow px-3 py-2 bg-brand-bg border border-brand-accent/20 rounded-xl text-xs text-brand-text focus:outline-none focus:border-brand-accent font-sans"
                  />
                  <label className="px-3 py-2 bg-brand-card hover:bg-brand-accent/20 border border-brand-accent/30 text-brand-accent rounded-xl text-xs font-bold cursor-pointer transition-all shrink-0 flex items-center gap-1">
                    <Image className="w-3.5 h-3.5" />
                    <span>Файл сонгох</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const instantDataUrl = await fileToDataUrl(file);
                            if (instantDataUrl) setEditChPosterUrl(instantDataUrl);
                            const url = await uploadSingleImageToCloud(file);
                            if (url) {
                              setEditChPosterUrl(url);
                            }
                          } catch (err) {
                            console.error(err);
                          }
                        }
                        e.target.value = '';
                      }}
                    />
                  </label>
                </div>
                {editChPosterUrl && (
                  <div className="mt-2 flex items-center gap-2 bg-brand-bg/50 p-1.5 rounded-lg border border-brand-accent/20">
                    <img src={editChPosterUrl} alt="Poster preview" className="w-10 h-14 object-cover rounded shadow border border-brand-accent/30" />
                    <span className="text-[11px] text-emerald-400 font-bold flex-grow truncate">Постер зураг сонгогдлоо!</span>
                    <button
                      type="button"
                      onClick={() => setEditChPosterUrl('')}
                      className="text-[10px] text-red-400 hover:text-red-300 font-bold px-2 py-1 bg-red-950/40 rounded cursor-pointer"
                    >
                      Арилгах
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-brand-text-dark mb-1">Орчуулагч</label>
                  <select
                    value={editChTranslator}
                    onChange={(e) => setEditChTranslator(e.target.value)}
                    className="w-full px-2 py-2 bg-brand-bg border border-brand-accent/20 rounded-xl text-xs text-brand-text focus:outline-none focus:border-brand-accent cursor-pointer"
                  >
                    <option value="">-- Сонгох --</option>
                    {staffNames.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-brand-text-dark mb-1">Эдитор</label>
                  <select
                    value={editChEditor}
                    onChange={(e) => setEditChEditor(e.target.value)}
                    className="w-full px-2 py-2 bg-brand-bg border border-brand-accent/20 rounded-xl text-xs text-brand-text focus:outline-none focus:border-brand-accent cursor-pointer"
                  >
                    <option value="">-- Сонгох --</option>
                    {staffNames.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-brand-text-dark mb-1">Өрөлт</label>
                  <select
                    value={editChTypesetter}
                    onChange={(e) => setEditChTypesetter(e.target.value)}
                    className="w-full px-2 py-2 bg-brand-bg border border-brand-accent/20 rounded-xl text-xs text-brand-text focus:outline-none focus:border-brand-accent cursor-pointer"
                  >
                    <option value="">-- Сонгох --</option>
                    {staffNames.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Manage Chapter Pages */}
              <div className="space-y-2">
                <div className="flex justify-between items-center border-b border-brand-accent/10 pb-1.5">
                  <label className="block text-xs font-bold text-brand-accent uppercase tracking-wider">
                    Хуудаснуудын урсгал ({editChImages.length})
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => openGalleryPicker('multiple', (urls) => {
                        setEditChImages(prev => [...prev, ...urls]);
                      })}
                      className="px-2.5 py-1 bg-[#1e150d] hover:bg-[#2a1d12] text-[#efa01a] border border-amber-500/20 text-[10px] font-bold uppercase rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Image className="w-3 h-3 text-[#efa01a]" /> Галлерей
                    </button>
                    <button
                      type="button"
                      onClick={() => document.getElementById('edit-ch-add-images')?.click()}
                      className="px-2.5 py-1 bg-brand-accent/10 hover:bg-brand-accent hover:text-brand-bg text-brand-accent text-[10px] font-bold uppercase rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Файлаас Нэмэх
                    </button>
                    <input
                      id="edit-ch-add-images"
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={async (e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          const files = Array.from(e.target.files) as File[];
                          try {
                            // 1. INSTANT LOCAL PREVIEWS (< 50ms)
                            const localPreviews = await Promise.all(files.map(f => fileToDataUrl(f)));
                            setEditChImages(prev => [...prev, ...localPreviews]);

                            // 2. Background Cloud Upload
                            const cloudUrls = await uploadMultipleImagesToCloud(files);
                            if (cloudUrls.length > 0) {
                              setEditChImages(prev => {
                                const updated = [...prev];
                                localPreviews.forEach((preview, i) => {
                                  if (cloudUrls[i]) {
                                    const pos = updated.indexOf(preview);
                                    if (pos !== -1) updated[pos] = cloudUrls[i];
                                  }
                                });
                                return updated;
                              });
                            }
                          } catch (err) {
                            console.error("Image upload error:", err);
                          }
                        }
                      }}
                      className="hidden"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 pt-2 max-h-64 overflow-y-auto p-2 bg-brand-bg/50 rounded-xl border border-brand-accent/10 scrollbar-thin">
                  {editChImages.map((img, idx) => (
                    <div key={idx} className="relative aspect-[3/4] bg-brand-bg border border-brand-accent/15 rounded-lg overflow-hidden group">
                      <img src={img} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/85 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-1.5 z-10">
                        {/* Top action row */}
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[9px] text-brand-accent font-bold font-mono bg-black/45 px-1 rounded">#{idx + 1}</span>
                          <button
                            type="button"
                            onClick={() => setEditChImages(prev => prev.filter((_, i) => i !== idx))}
                            className="p-1 bg-red-950/85 border border-red-500/30 text-red-400 hover:text-white rounded cursor-pointer"
                            title="Хасах"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Reorder controls (Move left, Move right) */}
                        <div className="flex items-center justify-center gap-1 bg-black/45 py-0.5 rounded">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => {
                              const copy = [...editChImages];
                              const tmp = copy[idx];
                              copy[idx] = copy[idx - 1];
                              copy[idx - 1] = tmp;
                              setEditChImages(copy);
                            }}
                            className="p-1 bg-brand-bg/85 hover:bg-brand-accent/25 border border-brand-accent/10 hover:border-brand-accent text-brand-text disabled:opacity-30 rounded cursor-pointer transition-colors"
                            title="Өмнөх рүү"
                          >
                            <ChevronLeft className="w-3 h-3" />
                          </button>
                          
                          <button
                            type="button"
                            disabled={idx === editChImages.length - 1}
                            onClick={() => {
                              const copy = [...editChImages];
                              const tmp = copy[idx];
                              copy[idx] = copy[idx + 1];
                              copy[idx + 1] = tmp;
                              setEditChImages(copy);
                            }}
                            className="p-1 bg-brand-bg/85 hover:bg-brand-accent/25 border border-brand-accent/10 hover:border-brand-accent text-brand-text disabled:opacity-30 rounded cursor-pointer transition-colors"
                            title="Дараах руу"
                          >
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Insert after & Swap actions */}
                        <div className="flex flex-col gap-0.5 w-full text-[8px] font-mono">
                          <button
                            type="button"
                            onClick={() => {
                              openGalleryPicker('single', (urls) => {
                                if (urls.length > 0) {
                                  const copy = [...editChImages];
                                  copy.splice(idx + 1, 0, urls[0]);
                                  setEditChImages(copy);
                                }
                              });
                            }}
                            className="py-0.5 bg-cyan-950 hover:bg-cyan-600 text-cyan-300 hover:text-brand-bg font-bold uppercase rounded text-center cursor-pointer transition-colors"
                          >
                            + Галлерей
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const fileInput = document.createElement('input');
                              fileInput.type = 'file';
                              fileInput.accept = 'image/*';
                              fileInput.onchange = async (e) => {
                                const files = (e.target as HTMLInputElement).files;
                                if (files && files[0]) {
                                  const file = files[0];
                                  try {
                                    // Instant preview insertion (< 30ms)
                                    const instantPreview = await fileToDataUrl(file);
                                    setEditChImages(prev => {
                                      const copy = [...prev];
                                      copy.splice(idx + 1, 0, instantPreview);
                                      return copy;
                                    });

                                    // Background cloud upload
                                    const cloudUrl = await uploadSingleImageToCloud(file);
                                    if (cloudUrl) {
                                      setEditChImages(prev => prev.map(img => img === instantPreview ? cloudUrl : img));
                                    }
                                  } catch (err) {
                                    console.error("Image upload error:", err);
                                  }
                                }
                              };
                              fileInput.click();
                            }}
                            className="py-0.5 bg-emerald-950 hover:bg-emerald-600 text-emerald-300 hover:text-brand-bg font-bold uppercase rounded text-center cursor-pointer transition-colors"
                          >
                            + Файл
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const fileInput = document.getElementById(`swap-file-input-${idx}`);
                              fileInput?.click();
                            }}
                            className="py-0.5 bg-brand-accent/90 hover:bg-brand-accent text-brand-bg font-bold uppercase rounded text-center cursor-pointer"
                          >
                            Солих
                          </button>
                        </div>

                        <input
                          id={`swap-file-input-${idx}`}
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            if (e.target.files && e.target.files[0]) {
                              const file = e.target.files[0];
                              try {
                                // 1. INSTANT LOCAL PREVIEW (< 30ms) - Image swaps immediately on screen!
                                const instantPreview = await fileToDataUrl(file);
                                setEditChImages(prev => prev.map((img, i) => i === idx ? instantPreview : img));

                                // 2. Background Cloud Storage Upload
                                const cloudUrl = await uploadSingleImageToCloud(file);
                                if (cloudUrl) {
                                  setEditChImages(prev => prev.map((img, i) => i === idx ? cloudUrl : img));
                                }
                              } catch (err) {
                                console.error("Swap image upload error:", err);
                              }
                            }
                          }}
                          className="hidden"
                        />
                      </div>
                      <span className="absolute bottom-1 left-1 px-1 py-0.5 bg-black/75 rounded text-[8px] text-white font-mono">{idx + 1}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-brand-accent/10">
                <button
                  type="button"
                  onClick={() => setEditingChapter(null)}
                  className="px-4 py-2 bg-brand-bg hover:bg-brand-card-light text-brand-text-dark hover:text-brand-text border border-brand-accent/10 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Цуцлах
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!editChTitle.trim()) {
                      alert('Бүлгийн нэрийг оруулна уу.');
                      return;
                    }

                    // Convert any local dataUrl or blob URLs to permanent storage URLs
                    const sanitizedImages: string[] = [];
                    for (const img of editChImages) {
                      if (img && (img.startsWith('data:image/') || img.startsWith('blob:'))) {
                        const cloudUrl = await uploadDataUrlToCloud(img);
                        sanitizedImages.push(cloudUrl || img);
                      } else {
                        sanitizedImages.push(img);
                      }
                    }

                    let poster = editChPosterUrl.trim() || undefined;
                    if (poster && (poster.startsWith('data:image/') || poster.startsWith('blob:'))) {
                      poster = await uploadDataUrlToCloud(poster);
                    }

                    if (onUpdateChapter) {
                      onUpdateChapter({
                        ...editingChapter,
                        title: editChTitle.trim(),
                        posterUrl: poster,
                        translator: editChTranslator,
                        editor: editChEditor,
                        typesetter: editChTypesetter,
                        images: sanitizedImages,
                        isVip: editChIsVip
                      });
                      setEditingChapter(null);
                    }
                  }}
                  className="px-5 py-2 bg-brand-accent hover:bg-brand-accent-hover text-brand-bg font-display font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-lg shadow-brand-accent/15"
                >
                  Хадгалах
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Unified Image Gallery Picker Modal */}
      {galleryModalOpen && (
        <div id="gallery-picker-modal-overlay" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in">
          <div className="w-full max-w-xl bg-brand-card border border-brand-accent/25 rounded-3xl p-6 relative max-h-[85vh] overflow-y-auto shadow-2xl flex flex-col justify-between">
            <div>
              <button
                onClick={() => setGalleryModalOpen(false)}
                className="absolute top-4 right-4 text-brand-text-dark hover:text-brand-accent bg-brand-bg/60 p-1.5 rounded-full transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              <h4 className="text-sm sm:text-base font-display font-extrabold text-brand-accent uppercase tracking-wider mb-1">
                Галлерейгаас зураг сонгох
              </h4>
              <p className="text-[11px] text-brand-text-dark font-mono uppercase mb-4">
                {gallerySelectionMode === 'multiple' ? 'Олон зураг зэрэг сонгоод [ИЛГЭЭХ] товч дарна уу' : 'Зураг дээр дарж шууд сонгоно уу'}
              </p>

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-[50vh] overflow-y-auto p-1.5 scrollbar-thin">
                {GALLERY_PRESETS.map((url, idx) => {
                  const isSelected = selectedGalleryImages.includes(url);
                  const selectionIndex = selectedGalleryImages.indexOf(url) + 1;
                  
                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        if (gallerySelectionMode === 'single') {
                          if (galleryCallback) galleryCallback([url]);
                          setGalleryModalOpen(false);
                        } else {
                          if (isSelected) {
                            setSelectedGalleryImages(prev => prev.filter(item => item !== url));
                          } else {
                            setSelectedGalleryImages(prev => [...prev, url]);
                          }
                        }
                      }}
                      className={`relative aspect-[3/4] rounded-xl overflow-hidden cursor-pointer border-2 transition-all hover:scale-[1.03] duration-200 ${
                        isSelected 
                          ? 'border-brand-accent ring-2 ring-brand-accent/35 shadow-lg shadow-brand-accent/20' 
                          : 'border-brand-accent/10 hover:border-brand-accent/50'
                      }`}
                    >
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      
                      {/* Checkbox badge overlay */}
                      {gallerySelectionMode === 'multiple' && (
                        <div className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center border transition-all text-[10px] font-bold ${
                          isSelected 
                            ? 'bg-brand-accent border-brand-accent text-brand-bg scale-110' 
                            : 'bg-black/60 border-white/40 text-transparent'
                        }`}>
                          {isSelected ? selectionIndex : ''}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {gallerySelectionMode === 'multiple' && (
              <div className="flex gap-3 justify-end pt-5 mt-4 border-t border-brand-accent/10">
                <button
                  type="button"
                  onClick={() => setGalleryModalOpen(false)}
                  className="px-4 py-2 bg-brand-bg hover:bg-brand-card-light text-brand-text-dark border border-brand-accent/10 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Цуцлах
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedGalleryImages.length === 0) {
                      alert('Дор хаяж нэг зураг сонгоно уу.');
                      return;
                    }
                    if (galleryCallback) galleryCallback(selectedGalleryImages);
                    setGalleryModalOpen(false);
                  }}
                  className="px-5 py-2 bg-brand-accent hover:bg-brand-accent-hover text-brand-bg font-display font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-lg shadow-brand-accent/20"
                >
                  Сонгох ({selectedGalleryImages.length})
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
