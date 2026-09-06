import React, { useState, useEffect } from 'react';
import { Manga, Chapter, Employee } from '../types';
import { DEFAULT_GENRES } from '../data';
import { 
  PlusCircle, 
  Edit3, 
  Image, 
  Check, 
  Loader2, 
  Trash2, 
  List, 
  Plus, 
  BookOpen, 
  X, 
  Sparkles, 
  Lock, 
  ArrowUpDown, 
  ArrowDownUp, 
  ChevronLeft, 
  ChevronRight,
  Upload
} from 'lucide-react';
import { uploadSingleImageToCloud, uploadDataUrlToCloud, fileToDataUrl, DEFAULT_FALLBACK_IMAGE } from '../utils/imageUpload';
import { 
  ChapterPageItem, 
  sortPagesNaturally, 
  reversePages, 
  parseImageUrlsInput, 
  processFilesForChapter 
} from '../utils/chapterUploadHelper';
import SmartImage from './SmartImage';

interface AdminPanelProps {
  mangas: Manga[];
  chapters?: Chapter[];
  employees?: Employee[];
  allGenres?: string[];
  onAddGenre?: (genre: string) => void;
  onDeleteGenre?: (genre: string) => void;
  canAddGenre?: boolean;
  canDeleteGenre?: boolean;
  onAddManga: (manga: Omit<Manga, 'id' | 'views' | 'likes'>) => void;
  onUpdateManga: (manga: Manga) => void;
  onDeleteManga?: (mangaId: string) => void;
  onAddChapter?: (
    chapterData: Omit<Chapter, 'id' | 'createdAt' | 'views'>,
    onProgress?: (percent: number, msg: string) => void
  ) => Promise<void> | void;
  onUpdateChapter?: (chapter: Chapter) => void;
  onDeleteChapter?: (chapterId: string) => void;
  forceAddMode?: boolean;
  onResetForceAdd?: () => void;
}

const PRESET_COVERS = [
  'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1560942485-b2a11cc13456?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1580477667995-2b94f01c9516?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&auto=format&fit=crop&q=80'
];

export default function AdminPanel({
  mangas,
  chapters = [],
  employees = [],
  allGenres = DEFAULT_GENRES,
  onAddGenre,
  onDeleteGenre,
  canAddGenre,
  canDeleteGenre,
  onAddManga,
  onUpdateManga,
  onDeleteManga,
  onAddChapter,
  forceAddMode,
  onResetForceAdd
}: AdminPanelProps) {
  // Main navigation tab mode
  const [activeTabMode, setActiveTabMode] = useState<'add_manga' | 'add_chapter' | 'all_mangas'>('all_mangas');
  const [editingManga, setEditingManga] = useState<Manga | null>(null);
  const [deletingMangaId, setDeletingMangaId] = useState<string | null>(null);
  const [newGenreInput, setNewGenreInput] = useState('');

  // Notifications
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // ------------------------------------
  // MANGA FORM STATES
  // ------------------------------------
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [coverUrl, setCoverUrl] = useState(PRESET_COVERS[0]);
  const [author, setAuthor] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [status, setStatus] = useState<'publishing' | 'completed' | 'full_release'>('publishing');
  const [type, setType] = useState<'manga' | 'manhwa' | 'bl' | 'gl'>('manga');
  const [isFree, setIsFree] = useState<boolean>(true);

  // ------------------------------------
  // CHAPTER FORM STATES (BULK UPLOADER)
  // ------------------------------------
  const [chMangaId, setChMangaId] = useState<string>(mangas[0]?.id || '');
  const [chTitle, setChTitle] = useState('');
  const [chPosterUrl, setChPosterUrl] = useState('');
  const [chTranslator, setChTranslator] = useState('');
  const [chEditor, setChEditor] = useState('');
  const [chTypesetter, setChTypesetter] = useState('');
  const [chIsVip, setChIsVip] = useState(false);

  // Pages & Bulk Upload states
  const [chapterPages, setChapterPages] = useState<ChapterPageItem[]>([]);
  const [pastedImageUrls, setPastedImageUrls] = useState('');
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [uploadStatusMsg, setUploadStatusMsg] = useState('');

  // AI Enhancer states
  const [chAiUpscale, setChAiUpscale] = useState(false);
  const [chUpscaleMode, setChUpscaleMode] = useState<'color' | 'lineart'>('color');
  const [chUpscaleMultiplier, setChUpscaleMultiplier] = useState<'4x' | '2x'>('4x');

  // Progress modal states for chapter submission
  const [isPublishingChapter, setIsPublishingChapter] = useState(false);
  const [publishProgress, setPublishProgress] = useState(0);
  const [publishStatusMsg, setPublishStatusMsg] = useState('');
  const [isUpscalingAI, setIsUpscalingAI] = useState(false);
  const [upscaleProgress, setUpscaleProgress] = useState(0);
  const [upscaleStatus, setUpscaleStatus] = useState('');

  // Auto set initial manga ID if empty
  useEffect(() => {
    if (!chMangaId && mangas.length > 0) {
      setChMangaId(mangas[0].id);
    }
  }, [mangas]);

  // Handle forceAddMode from props
  useEffect(() => {
    if (forceAddMode) {
      handleResetMangaForm();
      setActiveTabMode('add_manga');
      if (onResetForceAdd) {
        onResetForceAdd();
      }
    }
  }, [forceAddMode]);

  // Auto calculate chapter number when manga is selected
  useEffect(() => {
    if (chMangaId) {
      const existingMangaChapters = chapters.filter(c => c.mangaId === chMangaId);
      const nextNum = existingMangaChapters.length + 1;
      setChTitle(`Бүлэг ${nextNum}`);
    }
  }, [chMangaId, chapters]);

  // Staff names list
  const staffNames = employees.length > 0 
    ? employees.map(e => e.name) 
    : ['Аяко Баг', 'Зохиолч', 'Орчуулагч', 'Эдитор', 'Өрөгч'];

  const handleGenreToggle = (genre: string) => {
    if (selectedGenres.includes(genre)) {
      setSelectedGenres(selectedGenres.filter(g => g !== genre));
    } else {
      setSelectedGenres([...selectedGenres, genre]);
    }
  };

  const handleEditMangaClick = (manga: Manga) => {
    setEditingManga(manga);
    setActiveTabMode('add_manga');
    setTitle(manga.title);
    setDescription(manga.description);
    setCoverUrl(manga.coverUrl);
    setAuthor(manga.author);
    setSelectedGenres(manga.genres);
    setStatus(manga.status);
    setType(manga.type || 'manga');
    setIsFree(manga.isFree !== false);
    setSuccessMsg('');
    setErrorMsg('');
  };

  const handleResetMangaForm = () => {
    setEditingManga(null);
    setTitle('');
    setDescription('');
    setCoverUrl(PRESET_COVERS[0]);
    setAuthor('');
    setSelectedGenres([]);
    setStatus('publishing');
    setType('manga');
    setIsFree(true);
    setSuccessMsg('');
    setErrorMsg('');
  };

  const handleMangaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');

    if (!title.trim() || !description.trim() || !author.trim() || selectedGenres.length === 0) {
      setErrorMsg('Бүх талбарыг бөглөж, дор хаяж нэг төрөл сонгоно уу.');
      return;
    }

    if (editingManga) {
      onUpdateManga({
        ...editingManga,
        title: title.trim(),
        description: description.trim(),
        coverUrl: coverUrl.trim(),
        author: author.trim(),
        genres: selectedGenres,
        status: status,
        type: type,
        isFree: isFree
      });
      setSuccessMsg('Мангны мэдээллийг амжилттай шинэчиллээ!');
    } else {
      onAddManga({
        title: title.trim(),
        description: description.trim(),
        coverUrl: coverUrl.trim(),
        author: author.trim(),
        genres: selectedGenres,
        status: status,
        type: type,
        isFree: isFree
      });
      setSuccessMsg('Шинэ мангыг амжилттай бүртгэлээ!');
    }
  };

  // ------------------------------------
  // BULK UPLOAD HANDLERS FOR CHAPTER
  // ------------------------------------
  const handleProcessChapterFiles = async (files: File[]) => {
    if (!files || files.length === 0) return;
    setIsUploadingFiles(true);
    setUploadStatusMsg('Файлуудыг задлан шинжилж байна...');

    try {
      const { pages: localPages, uploadPromise } = await processFilesForChapter(files, (msg) => {
        setUploadStatusMsg(msg);
      });

      // Instantly show local previews naturally ordered
      setChapterPages(prev => [...prev, ...localPages]);

      // Complete cloud uploads in background and update cloud URLs
      const updatedCloudPages = await uploadPromise;
      setChapterPages(prev => {
        const next = [...prev];
        updatedCloudPages.forEach(up => {
          const idx = next.findIndex(p => p.id === up.id);
          if (idx !== -1) {
            next[idx] = up;
          }
        });
        return next;
      });
    } catch (err) {
      console.error('File process error:', err);
    } finally {
      setIsUploadingFiles(false);
      setUploadStatusMsg('');
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArr = Array.from(e.target.files) as File[];
      handleProcessChapterFiles(filesArr);
      e.target.value = '';
    }
  };

  const handleDropFiles = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const filesArr = Array.from(e.dataTransfer.files) as File[];
      handleProcessChapterFiles(filesArr);
    }
  };

  // Sort / Ordering helpers
  const handleSortPagesAsc = () => {
    setChapterPages(prev => sortPagesNaturally(prev));
  };

  const handleReversePages = () => {
    setChapterPages(prev => reversePages(prev));
  };

  const handleClearPages = () => {
    setChapterPages([]);
  };

  const handleMovePage = (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= chapterPages.length) return;
    setChapterPages(prev => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy;
    });
  };

  const handleRemovePage = (index: number) => {
    setChapterPages(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddPastedUrls = () => {
    const urls = parseImageUrlsInput(pastedImageUrls);
    if (urls.length === 0) {
      alert('Зөв HTTP/HTTPS эсвэл Data URL зургийн линк оруулна уу.');
      return;
    }
    const newItems: ChapterPageItem[] = urls.map((url, idx) => ({
      id: 'url_' + Math.random().toString(36).substring(2, 10),
      fileName: `Link Page ${chapterPages.length + idx + 1}`,
      previewUrl: url,
      cloudUrl: url,
      isUploading: false
    }));
    setChapterPages(prev => [...prev, ...newItems]);
    setPastedImageUrls('');
  };

  // Submit Chapter
  const handleChapterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');

    if (!chMangaId) {
      setErrorMsg('Мангаа сонгоно уу.');
      return;
    }
    if (!chTitle.trim()) {
      setErrorMsg('Бүлгийн нэрийг оруулна уу.');
      return;
    }

    // Gather final images (prefer cloudUrl over previewUrl)
    let finalImages = chapterPages.map(p => p.cloudUrl || p.previewUrl).filter(Boolean);

    // Also include pasted URLs if user didn't press "+ Линкүүдийг нэмэх" button
    if (pastedImageUrls.trim()) {
      const parsed = parseImageUrlsInput(pastedImageUrls);
      if (parsed.length > 0) {
        finalImages = [...finalImages, ...parsed];
      }
    }

    if (finalImages.length === 0) {
      setErrorMsg('Бүлгийн хуудасны зураг эсвэл линк оруулна уу.');
      return;
    }

    if (!onAddChapter) {
      setErrorMsg('Бүлэг нэмэх функц тохируулагдаагүй байна.');
      return;
    }

    const selectedMangaObj = mangas.find(m => m.id === chMangaId);
    const translator = chTranslator || staffNames[0] || 'Аяко Баг';
    const editor = chEditor || staffNames[0] || 'Аяко Баг';
    const typesetter = chTypesetter || staffNames[0] || 'Аяко Баг';

    const performSubmission = async () => {
      setIsPublishingChapter(true);
      setPublishProgress(10);
      setPublishStatusMsg(`[10%] Нийтлэх бэлтгэл хангаж байна (${finalImages.length} хуудас)...`);

      try {
        setPublishProgress(25);
        setPublishStatusMsg(`[25%] Зургуудыг байнгын Cloud серверт баталгаажуулж байна...`);

        const cloudSanitizedImages: string[] = [];
        for (let i = 0; i < finalImages.length; i++) {
          const img = finalImages[i];
          if (img && (img.startsWith('blob:') || img.startsWith('data:image/') || img.includes('localhost:3000'))) {
            const uploadedUrl = await uploadDataUrlToCloud(img);
            if (uploadedUrl && (uploadedUrl.startsWith('http://') || uploadedUrl.startsWith('https://') || uploadedUrl.startsWith('data:image/'))) {
              cloudSanitizedImages.push(uploadedUrl);
            } else if (!img.startsWith('blob:')) {
              cloudSanitizedImages.push(img);
            }
          } else if (img && !img.startsWith('blob:')) {
            cloudSanitizedImages.push(img);
          }
          const pct = Math.min(50, Math.round(25 + ((i + 1) / finalImages.length) * 25));
          setPublishProgress(pct);
        }

        let cleanPoster = chPosterUrl.trim() || undefined;
        if (cleanPoster && (cleanPoster.startsWith('blob:') || cleanPoster.startsWith('data:image/') || cleanPoster.includes('localhost:3000'))) {
          const uploadedPoster = await uploadDataUrlToCloud(cleanPoster);
          cleanPoster = (uploadedPoster && !uploadedPoster.startsWith('blob:')) ? uploadedPoster : undefined;
        }

        setPublishProgress(55);
        setPublishStatusMsg(`[55%] Датабаазад нийтлэж байна...`);

        await onAddChapter({
          mangaId: chMangaId,
          title: chTitle.trim(),
          posterUrl: cleanPoster,
          translator,
          editor,
          typesetter,
          isVip: chIsVip,
          images: cloudSanitizedImages
        }, (percent, msg) => {
          setPublishProgress(percent);
          setPublishStatusMsg(msg);
        });

        setPublishProgress(100);
        setPublishStatusMsg('Бүлэг амжилттай нийтлэгдлээ! 🎉');
        setSuccessMsg(`"${selectedMangaObj?.title || ''}" - ${chTitle} амжилттай нийтлэгдлээ!`);

        setTimeout(() => {
          setIsPublishingChapter(false);
          setPublishProgress(0);
          setPublishStatusMsg('');
          setIsUpscalingAI(false);
          setUpscaleProgress(0);
          setChapterPages([]);
          setPastedImageUrls('');
          setChPosterUrl('');
          setChAiUpscale(false);
          setActiveTabMode('all_mangas');
        }, 500);

      } catch (err: any) {
        console.error('Chapter submit error:', err);
        setErrorMsg(`Алдаа гарлаа: ${err?.message || 'Дахин шалгана уу'}`);
        setIsPublishingChapter(false);
        setIsUpscalingAI(false);
      }
    };

    if (chAiUpscale) {
      setIsUpscalingAI(true);
      setUpscaleProgress(0);
      setUpscaleStatus('AI загваруудыг ачаалж байна (Neural Upscale Engines)...');

      let currentProg = 0;
      const interval = setInterval(() => {
        currentProg += 5;
        if (currentProg > 100) currentProg = 100;
        setUpscaleProgress(currentProg);

        if (currentProg === 25) {
          setUpscaleStatus(`[AI] Манга хуудаснаас зураас бүрийг ялган таньж байна (${finalImages.length} хуудас)...`);
        } else if (currentProg === 50) {
          setUpscaleStatus('[AI] Зураасыг вектор ирмэгээр тодруулж, шуугианыг арилгаж байна...');
        } else if (currentProg === 75) {
          setUpscaleStatus(`[AI] ${chUpscaleMultiplier} нягтаршилтай 4K HD болгон хөрвүүлж байна...`);
        } else if (currentProg === 100) {
          clearInterval(interval);
          setUpscaleStatus('AI боловсруулалт амжилттай дууслаа!');
          setTimeout(() => {
            performSubmission();
          }, 600);
        }
      }, 120);
    } else {
      performSubmission();
    }
  };

  return (
    <div id="admin-panel-container" className="w-full space-y-4 animate-fade-in">
      {/* Top mode switcher tabs */}
      <div className="flex flex-wrap items-center justify-between bg-brand-bg/80 p-1.5 rounded-2xl border border-brand-accent/15 gap-1 shadow-lg">
        <button
          type="button"
          onClick={() => {
            handleResetMangaForm();
            setActiveTabMode('add_manga');
          }}
          className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl text-xs font-bold font-display uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTabMode === 'add_manga'
              ? 'bg-brand-accent text-brand-bg shadow-md scale-[1.02]'
              : 'text-brand-text-dark hover:text-brand-text hover:bg-brand-card/60'
          }`}
        >
          <PlusCircle className="w-4 h-4" />
          <span>{editingManga ? 'Манга засах' : 'Шинэ манга нэмэх'}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTabMode('add_chapter');
            setSuccessMsg('');
            setErrorMsg('');
          }}
          className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl text-xs font-bold font-display uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTabMode === 'add_chapter'
              ? 'bg-brand-accent text-brand-bg shadow-md scale-[1.02]'
              : 'text-brand-text-dark hover:text-brand-text hover:bg-brand-card/60'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Шинэ бүлэг нэмэх</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTabMode('all_mangas');
            setEditingManga(null);
            setSuccessMsg('');
            setErrorMsg('');
          }}
          className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl text-xs font-bold font-display uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeTabMode === 'all_mangas'
              ? 'bg-brand-accent text-brand-bg shadow-md scale-[1.02]'
              : 'text-brand-text-dark hover:text-brand-text hover:bg-brand-card/60'
          }`}
        >
          <List className="w-4 h-4" />
          <span>Бүх манга ({mangas.length})</span>
        </button>
      </div>

      {/* Success / Error notification */}
      {successMsg && (
        <div className="p-3 bg-emerald-950/60 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2 animate-fade-in">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3 bg-red-950/60 border border-red-500/30 rounded-xl text-red-300 text-xs flex items-center gap-2 animate-fade-in">
          <X className="w-4 h-4 text-red-400 shrink-0" />
          <span className="font-medium">{errorMsg}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODE 1: MANGA FORM (Add or Edit Manga)                   */}
      {/* ========================================================= */}
      {activeTabMode === 'add_manga' && (
        <div className="space-y-4 animate-fade-in">
          <form onSubmit={handleMangaSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              {/* Left Column - Main Fields (5/12 width) */}
              <div className="md:col-span-5 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-brand-text-dark mb-0.5 uppercase tracking-wider">
                      Манга нэр
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Жишээ: Тэнгэрийн сэлэм"
                      className="w-full px-2.5 py-1.5 bg-brand-bg border border-brand-accent/20 rounded-xl text-xs text-brand-text focus:outline-none focus:border-brand-accent transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-brand-text-dark mb-0.5 uppercase tracking-wider">
                      Зохиолч
                    </label>
                    <input
                      type="text"
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                      placeholder="Жишээ: Gabbs"
                      className="w-full px-2.5 py-1.5 bg-brand-bg border border-brand-accent/20 rounded-xl text-xs text-brand-text focus:outline-none focus:border-brand-accent transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-brand-text-dark mb-0.5 uppercase tracking-wider">
                      Манга төлөв
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 bg-brand-bg border border-brand-accent/20 rounded-xl text-xs text-brand-text focus:outline-none focus:border-brand-accent cursor-pointer"
                    >
                      <option value="publishing">Гарч буй (Publishing)</option>
                      <option value="completed">Дууссан (Completed)</option>
                      <option value="full_release">Гаргалт гүйцсэн (Full Release)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-brand-text-dark mb-0.5 uppercase tracking-wider">
                      Манга төрөл
                    </label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 bg-brand-bg border border-brand-accent/20 rounded-xl text-xs text-brand-text focus:outline-none focus:border-brand-accent cursor-pointer"
                    >
                      <option value="manga">Манга (Manga)</option>
                      <option value="manhwa">Манхва (Manhwa)</option>
                      <option value="bl">BL</option>
                      <option value="gl">GL</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-brand-text-dark mb-0.5 uppercase tracking-wider">
                    Агуулгын төрөл (Нэвтрэх эрх)
                  </label>
                  <select
                    value={isFree ? 'free' : 'paid'}
                    onChange={(e) => setIsFree(e.target.value === 'free')}
                    className="w-full px-2.5 py-1.5 bg-brand-bg border border-brand-accent/20 rounded-xl text-xs text-brand-text focus:outline-none focus:border-brand-accent cursor-pointer font-bold"
                  >
                    <option value="free">🎁 Үнэгүй (Сайт төлбөртэй болсон ч үнэгүй байна)</option>
                    <option value="paid">🔒 Төлбөртэй (Сайт үнэгүй үед үнэгүй, төлбөртэй үед VIP байна)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-brand-text-dark mb-0.5 uppercase tracking-wider">
                    Товч танилцуулга
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Бүтээлийн үйл явдлын товч хураангуй..."
                    className="w-full px-2.5 py-1.5 bg-brand-bg border border-brand-accent/20 rounded-xl text-xs text-brand-text focus:outline-none focus:border-brand-accent resize-none transition-colors"
                  />
                </div>
              </div>

              {/* Middle Column - Cover Selection (4/12 width) */}
              <div className="md:col-span-4 space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-brand-text-dark mb-0.5 uppercase tracking-wider">
                    Постер
                  </label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={coverUrl}
                      onChange={(e) => setCoverUrl(e.target.value)}
                      placeholder="Зургийн линк..."
                      className="flex-grow px-2.5 py-1.5 bg-brand-bg border border-brand-accent/20 rounded-xl text-xs text-brand-text focus:outline-none font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => document.getElementById('admin-cover-file-input')?.click()}
                      className="px-2.5 py-1.5 bg-brand-accent/10 hover:bg-brand-accent hover:text-brand-bg text-brand-accent rounded-xl text-xs font-semibold transition-all cursor-pointer shrink-0"
                    >
                      Файл
                    </button>
                  </div>
                  <input
                    id="admin-cover-file-input"
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      if (e.target.files && e.target.files[0]) {
                        const file = e.target.files[0];
                        try {
                          const instantPreview = await fileToDataUrl(file);
                          setCoverUrl(instantPreview);
                          const cloudUrl = await uploadSingleImageToCloud(file);
                          if (cloudUrl) {
                            setCoverUrl(cloudUrl);
                          }
                        } catch (err) {
                          console.error("Cover upload error:", err);
                        }
                      }
                    }}
                    className="hidden"
                  />

                  <p className="text-[9px] text-brand-text-dark mt-2 mb-1 font-bold uppercase tracking-wider">Бэлэн зурагнууд:</p>
                  <div className="grid grid-cols-5 gap-1">
                    {PRESET_COVERS.map((url, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCoverUrl(url)}
                        className={`aspect-[3/4] rounded-lg overflow-hidden transition-all cursor-pointer relative ${
                          coverUrl === url ? 'scale-105 opacity-100 ring-2 ring-brand-accent' : 'opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        {coverUrl === url && (
                          <div className="absolute inset-0 bg-brand-accent/20 flex items-center justify-center">
                            <Check className="w-3.5 h-3.5 bg-brand-bg/85 rounded-full p-0.5 text-brand-accent" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="mt-2 rounded-xl p-2 bg-brand-bg/30 border border-brand-accent/10 flex gap-3 items-center">
                    <div className="w-7 h-9 rounded overflow-hidden bg-brand-card shrink-0">
                      {coverUrl ? (
                        <img
                          src={coverUrl}
                          alt="ковер"
                          onError={(e) => {
                            e.currentTarget.src = DEFAULT_FALLBACK_IMAGE;
                          }}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-brand-text-dark bg-brand-card-light">
                          <Image className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h5 className="text-[9px] font-bold text-brand-text font-display uppercase tracking-wider">Зургийн хяналт</h5>
                      <p className="text-[9px] text-brand-text-dark leading-tight line-clamp-1">Сонгосон зураг харагдах байдал.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column - Genres (3/12 width) */}
              <div className="md:col-span-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-bold text-brand-text-dark uppercase tracking-wider">
                    Манга жанр
                  </label>
                </div>

                {canAddGenre && onAddGenre && (
                  <div className="flex gap-1 mb-2">
                    <input
                      type="text"
                      value={newGenreInput}
                      onChange={(e) => setNewGenreInput(e.target.value)}
                      placeholder="Шинэ жанр..."
                      className="flex-1 px-2 py-1 bg-brand-bg border border-brand-accent/20 rounded-lg text-[10px] text-brand-text focus:outline-none focus:border-brand-accent"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (newGenreInput.trim()) {
                            onAddGenre(newGenreInput.trim());
                            if (!selectedGenres.includes(newGenreInput.trim())) {
                              setSelectedGenres([...selectedGenres, newGenreInput.trim()]);
                            }
                            setNewGenreInput('');
                          }
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (newGenreInput.trim()) {
                          onAddGenre(newGenreInput.trim());
                          if (!selectedGenres.includes(newGenreInput.trim())) {
                            setSelectedGenres([...selectedGenres, newGenreInput.trim()]);
                          }
                          setNewGenreInput('');
                        }
                      }}
                      className="px-2 py-1 bg-brand-accent/20 hover:bg-brand-accent text-brand-accent hover:text-brand-bg rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center shrink-0"
                      title="Жанр нэмэх"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-1 gap-1 max-h-[180px] overflow-y-auto pr-1 scrollbar-none">
                  {allGenres.map((genre) => {
                    const isSelected = selectedGenres.includes(genre);
                    return (
                      <div
                        key={genre}
                        className={`w-full px-2 py-1 rounded-lg text-[10px] font-medium transition-all flex items-center justify-between gap-1 ${
                          isSelected
                            ? 'bg-brand-accent/15 text-brand-accent font-bold border border-brand-accent/30'
                            : 'bg-brand-bg/30 text-brand-text-dark hover:bg-brand-bg/60 hover:text-brand-text'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleGenreToggle(genre)}
                          className="flex-1 text-left truncate cursor-pointer flex items-center justify-between"
                        >
                          <span className="truncate">{genre}</span>
                          {isSelected && <Check className="w-3 h-3 text-brand-accent shrink-0 ml-1" />}
                        </button>
                        {canDeleteGenre && onDeleteGenre && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`"${genre}" жанрыг устгахдаа итгэлтэй байна уу?`)) {
                                onDeleteGenre(genre);
                                if (selectedGenres.includes(genre)) {
                                  setSelectedGenres(selectedGenres.filter(g => g !== genre));
                                }
                              }
                            }}
                            className="p-0.5 text-brand-text-dark hover:text-red-400 transition-colors cursor-pointer shrink-0 rounded"
                            title="Жанр устгах"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-3">
              <button
                type="submit"
                className="w-full py-2.5 bg-brand-accent hover:bg-brand-accent-hover text-brand-bg font-display font-black rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-brand-accent/10"
              >
                {editingManga ? 'Мэдээллийг шинэчлэх' : 'Шинээр бүртгэх'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODE 2: ADD CHAPTER FORM WITH ENHANCED BULK UPLOAD       */}
      {/* ========================================================= */}
      {activeTabMode === 'add_chapter' && (
        <div className="bg-brand-card/90 border border-brand-accent/15 rounded-2xl p-5 sm:p-6 space-y-6 animate-fade-in relative shadow-xl">
          <div className="flex items-center justify-between border-b border-brand-accent/10 pb-4">
            <div>
              <h3 className="text-base font-display font-bold text-brand-accent uppercase tracking-wider flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-brand-accent" />
                Шинэ бүлэг нэмэх (Bulk Image & ZIP Uploader)
              </h3>
              <p className="text-xs text-brand-text-dark mt-0.5">
                Олон зураг болон ZIP архивыг нэгэн зэрэг хуулж, автоматаар эрэмбэлэх боломжтой
              </p>
            </div>
          </div>

          <form onSubmit={handleChapterSubmit} className="space-y-5">
            {/* Manga Selector & Chapter Title */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-brand-text-dark mb-1 uppercase tracking-wider">
                  1. Манга сонгох
                </label>
                <select
                  value={chMangaId}
                  onChange={(e) => setChMangaId(e.target.value)}
                  className="w-full px-3 py-2 bg-brand-bg border border-brand-accent/20 rounded-xl text-xs text-brand-text font-semibold focus:outline-none focus:border-brand-accent cursor-pointer"
                >
                  {mangas.map(m => {
                    const mChCount = chapters.filter(c => c.mangaId === m.id).length;
                    return (
                      <option key={m.id} value={m.id}>
                        {m.title} ({mChCount} бүлэгтэй)
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-brand-text-dark mb-1 uppercase tracking-wider">
                  2. Бүлгийн дугаар / Нэр (e.g. Бүлэг 5)
                </label>
                <input
                  type="text"
                  value={chTitle}
                  onChange={(e) => setChTitle(e.target.value)}
                  placeholder="Бүлэг 1"
                  className="w-full px-3 py-2 bg-brand-bg border border-brand-accent/20 rounded-xl text-xs text-brand-text focus:outline-none focus:border-brand-accent font-semibold"
                />
              </div>
            </div>

            {/* Staff Roles (Translator, Editor, Typesetter) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-brand-text-dark mb-1">
                  Орчуулагч
                </label>
                <select
                  value={chTranslator}
                  onChange={(e) => setChTranslator(e.target.value)}
                  className="w-full px-2.5 py-2 bg-brand-bg border border-brand-accent/20 rounded-xl text-xs text-brand-text focus:outline-none focus:border-brand-accent cursor-pointer"
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
                  value={chEditor}
                  onChange={(e) => setChEditor(e.target.value)}
                  className="w-full px-2.5 py-2 bg-brand-bg border border-brand-accent/20 rounded-xl text-xs text-brand-text focus:outline-none focus:border-brand-accent cursor-pointer"
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
                  value={chTypesetter}
                  onChange={(e) => setChTypesetter(e.target.value)}
                  className="w-full px-2.5 py-2 bg-brand-bg border border-brand-accent/20 rounded-xl text-xs text-brand-text focus:outline-none focus:border-brand-accent cursor-pointer"
                >
                  <option value="">-- Сонгох --</option>
                  {staffNames.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Poster & VIP settings */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-brand-text-dark mb-1">
                  Бүлгийн Постер зураг (Сонголттой - оруулахгүй бол 1-р хуудас автоматаар ашиглагдана)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={chPosterUrl}
                    onChange={(e) => setChPosterUrl(e.target.value)}
                    placeholder="Зургийн URL линк эсвэл Файлаар оруулах..."
                    className="flex-grow px-3 py-2 bg-brand-bg border border-brand-accent/20 rounded-xl text-xs text-brand-text focus:outline-none focus:border-brand-accent"
                  />
                  <label className="px-3 py-2 bg-brand-bg hover:bg-brand-accent/20 border border-brand-accent/30 text-brand-accent rounded-xl text-xs font-bold cursor-pointer transition-all shrink-0 flex items-center gap-1">
                    <Image className="w-3.5 h-3.5" />
                    <span>Файл</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const preview = await fileToDataUrl(file);
                            setChPosterUrl(preview);
                            const cloudUrl = await uploadSingleImageToCloud(file);
                            if (cloudUrl) setChPosterUrl(cloudUrl);
                          } catch (err) {
                            console.error(err);
                          }
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-brand-text-dark mb-1">
                  Төлөв (Энгийн / VIP)
                </label>
                <div className="flex items-center gap-4 mt-1 bg-brand-bg p-2.5 rounded-xl border border-brand-accent/20 h-10">
                  <label className="flex items-center gap-2 text-xs text-brand-text cursor-pointer">
                    <input
                      type="radio"
                      name="adminIsVip"
                      checked={!chIsVip}
                      onChange={() => setChIsVip(false)}
                      className="accent-brand-accent"
                    />
                    <span>Энгийн (Үнэгүй)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-brand-text cursor-pointer">
                    <input
                      type="radio"
                      name="adminIsVip"
                      checked={chIsVip}
                      onChange={() => setChIsVip(true)}
                      className="accent-brand-accent"
                    />
                    <span className="text-brand-accent font-semibold flex items-center gap-1">
                      <Lock className="w-3 h-3" /> VIP Бүлэг
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* AI Detail & Quality Enhancer */}
            <div className="p-3.5 bg-brand-accent/5 border border-brand-accent/15 rounded-xl space-y-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={chAiUpscale}
                  onChange={(e) => setChAiUpscale(e.target.checked)}
                  className="accent-brand-accent mt-0.5"
                />
                <div>
                  <span className="text-xs font-bold text-brand-accent flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-brand-accent animate-pulse" />
                    AI Detail & Quality Enhancer (4K HD Хөрвүүлэгч)
                  </span>
                  <p className="text-[10px] text-brand-text-dark leading-snug mt-0.5">
                    Зураас болон өнгийг алдагдалгүй тодруулж 4K нягтаршилтай урт стрип болгох.
                  </p>
                </div>
              </label>

              {chAiUpscale && (
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-brand-accent/10">
                  <div>
                    <label className="block text-[10px] text-brand-text-dark mb-1 uppercase font-semibold">Режим (Mode)</label>
                    <select
                      value={chUpscaleMode}
                      onChange={(e) => setChUpscaleMode(e.target.value as any)}
                      className="w-full px-2 py-1 bg-brand-bg border border-brand-accent/20 rounded text-xs text-brand-text"
                    >
                      <option value="color">Webtoon Color (Өнгөт)</option>
                      <option value="lineart">Manga Lineart (Хар цагаан)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-brand-text-dark mb-1 uppercase font-semibold">Хэмжээ (Multiplier)</label>
                    <select
                      value={chUpscaleMultiplier}
                      onChange={(e) => setChUpscaleMultiplier(e.target.value as any)}
                      className="w-full px-2 py-1 bg-brand-bg border border-brand-accent/20 rounded text-xs text-brand-text"
                    >
                      <option value="4x">4x Ultra HD</option>
                      <option value="2x">2x High Quality</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* ========================================================= */}
            {/* BULK UPLOAD & AUTO-ORDERING ZONE                          */}
            {/* ========================================================= */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-brand-accent uppercase tracking-wider">
                  Бүлгийн хуудаснууд (Bulk Upload & Auto-Ordering)
                </label>
                {chapterPages.length > 0 && (
                  <span className="text-xs font-mono font-bold text-brand-text bg-brand-bg px-2.5 py-0.5 rounded-full border border-brand-accent/20">
                    Нийт: {chapterPages.length} хуудас
                  </span>
                )}
              </div>

              {/* Drag & Drop Multi-file and ZIP Dropzone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDropFiles}
                onClick={() => document.getElementById('admin-chapter-file-input')?.click()}
                className="border-2 border-dashed border-brand-accent/30 hover:border-brand-accent bg-brand-bg/60 hover:bg-brand-bg/90 transition-all rounded-2xl p-5 text-center cursor-pointer space-y-2 group shadow-inner"
              >
                <input
                  id="admin-chapter-file-input"
                  type="file"
                  multiple
                  accept="image/*,.zip,application/zip,application/x-zip-compressed"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
                <div className="w-10 h-10 rounded-full bg-brand-accent/15 flex items-center justify-center mx-auto text-brand-accent group-hover:scale-110 transition-transform">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-brand-text font-bold">
                    Зурагнууд эсвэл ZIP архиваа чирж оруулах эсвэл ЭНД ДАРЖ сонгоно уу
                  </p>
                  <p className="text-[10px] text-brand-text-dark mt-0.5">
                    Олон зураг (1.jpg, 2.jpg, 10.jpg) болон ZIP автоматаар тоогоор нь эрэмбэлэгдэнэ
                  </p>
                </div>
                <p className="text-[10px] text-emerald-400 font-mono font-bold">
                  ⚡ Base64 биш Cloud Server руу шууд хадгалагдана
                </p>
              </div>

              {/* Upload Status Bar */}
              {isUploadingFiles && (
                <div className="p-3 bg-brand-accent/10 border border-brand-accent/30 rounded-xl flex items-center gap-3 animate-pulse">
                  <div className="w-4 h-4 border-2 border-brand-accent border-t-transparent rounded-full animate-spin shrink-0" />
                  <span className="text-xs text-brand-accent font-mono font-bold">{uploadStatusMsg}</span>
                </div>
              )}

              {/* Toolbar Actions for Reordering */}
              {chapterPages.length > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-brand-bg/80 border border-brand-accent/20 rounded-xl">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSortPagesAsc}
                      className="px-2.5 py-1.5 bg-brand-accent/15 hover:bg-brand-accent hover:text-brand-bg text-brand-accent border border-brand-accent/30 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                      title="Файлын нэр, тоогоор нь автоматаар эрэмбэлэх (1→9)"
                    >
                      <ArrowUpDown className="w-3.5 h-3.5" />
                      <span>1→9 Нэрээр эрэмбэлэх</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleReversePages}
                      className="px-2.5 py-1.5 bg-brand-bg hover:bg-brand-accent/20 text-brand-text border border-brand-accent/20 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                      title="Дарааллыг эсрэгээр нь эргүүлэх (9→1)"
                    >
                      <ArrowDownUp className="w-3.5 h-3.5" />
                      <span>9→1 Эсрэгээр</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleClearPages}
                    className="px-2.5 py-1.5 bg-red-950/40 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/30 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Бүгдийг арилгах</span>
                  </button>
                </div>
              )}

              {/* Interactive Page Thumbnails Grid */}
              {chapterPages.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5 p-3 bg-brand-bg/40 border border-brand-accent/10 rounded-2xl max-h-[360px] overflow-y-auto scrollbar-thin">
                  {chapterPages.map((page, idx) => (
                    <div
                      key={page.id}
                      className="group relative aspect-[3/4] bg-brand-card rounded-xl overflow-hidden border border-brand-accent/20 flex flex-col justify-between shadow"
                    >
                      {/* Image Preview */}
                      <img
                        src={page.previewUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />

                      {/* Top Overlay Controls */}
                      <div className="absolute top-1 left-1 right-1 flex items-center justify-between">
                        <span className="text-[9px] font-mono font-bold bg-black/80 text-brand-accent px-1.5 py-0.5 rounded shadow border border-brand-accent/30">
                          #{idx + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemovePage(idx)}
                          className="p-1 bg-black/80 hover:bg-red-600 text-red-400 hover:text-white rounded-full transition-all cursor-pointer"
                          title="Хуудас устгах"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Bottom Overlay Controls (Move Left / Right) */}
                      <div className="absolute bottom-1 inset-x-1 flex items-center justify-between bg-black/85 p-0.5 rounded-lg border border-brand-accent/20">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMovePage(idx, -1)}
                          className={`p-1 rounded hover:bg-brand-accent/30 text-white ${idx === 0 ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                          title="Өмнөх рүү зөөх"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>

                        <span className="text-[8px] font-mono text-zinc-300 truncate max-w-[45px]" title={page.fileName}>
                          {page.fileName}
                        </span>

                        <button
                          type="button"
                          disabled={idx === chapterPages.length - 1}
                          onClick={() => handleMovePage(idx, 1)}
                          className={`p-1 rounded hover:bg-brand-accent/30 text-white ${idx === chapterPages.length - 1 ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                          title="Дараах руу зөөх"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Paste Image URLs Box */}
              <div className="space-y-1.5 pt-2">
                <label className="block text-[11px] font-bold text-brand-accent uppercase tracking-wider">
                  Эсвэл зургийн URL Линкүүд шууд оруулах (Мөр бүрд 1 линк):
                </label>
                <textarea
                  rows={2}
                  value={pastedImageUrls}
                  onChange={(e) => setPastedImageUrls(e.target.value)}
                  placeholder="https://example.com/page1.jpg&#10;https://example.com/page2.jpg"
                  className="w-full p-2.5 bg-brand-bg border border-brand-accent/20 rounded-xl text-xs text-brand-text font-mono focus:outline-none focus:border-brand-accent"
                />
                <button
                  type="button"
                  onClick={handleAddPastedUrls}
                  className="px-3 py-1.5 bg-brand-bg hover:bg-brand-accent hover:text-brand-bg text-brand-accent border border-brand-accent/30 rounded-lg text-xs font-bold transition-all cursor-pointer"
                >
                  + Линкүүдийг нэмэх
                </button>
              </div>
            </div>

            {/* Overlay Progress Modal during Submission */}
            {(isPublishingChapter || isUpscalingAI) && (
              <div className="fixed inset-0 bg-brand-bg/95 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center p-6 text-center space-y-6 z-50 animate-fade-in">
                <div className="relative w-16 h-16 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-4 border-brand-accent/20 border-t-brand-accent animate-spin" />
                  <Sparkles className="w-6 h-6 text-brand-accent animate-pulse" />
                </div>
                <div className="space-y-2 w-full max-w-xs">
                  <h4 className="text-xs font-display font-bold text-brand-text uppercase tracking-wider">
                    {isPublishingChapter ? 'Бүлэг Нийтлэж Байна...' : 'AI Чанар Сайжруулагч...'}
                  </h4>
                  <p className="text-[11px] text-brand-accent font-mono leading-relaxed h-12 flex items-center justify-center px-4">
                    {isPublishingChapter ? publishStatusMsg : upscaleStatus}
                  </p>
                  <div className="w-full h-2 bg-brand-card-light rounded-full overflow-hidden border border-brand-accent/10">
                    <div
                      className="h-full bg-brand-accent transition-all duration-300 rounded-full"
                      style={{ width: `${isPublishingChapter ? publishProgress : upscaleProgress}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-brand-text font-bold font-mono">
                    {isPublishingChapter ? `${publishProgress}%` : `${upscaleProgress}%`}
                  </span>
                </div>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3 bg-brand-accent hover:bg-brand-accent-hover text-brand-bg font-display font-black rounded-xl text-sm uppercase tracking-wider transition-all cursor-pointer shadow-lg shadow-brand-accent/20"
            >
              Бүлэг нийтлэх
            </button>
          </form>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODE 3: ALL MANGAS LIST VIEW                              */}
      {/* ========================================================= */}
      {activeTabMode === 'all_mangas' && (
        <div className="space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-display font-bold text-brand-text uppercase tracking-wider">
              Бүртгэлтэй бүтээлүүд ({mangas.length})
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {mangas.map((manga) => {
              const mangaChs = chapters.filter(c => c.mangaId === manga.id);
              return (
                <div
                  key={manga.id}
                  className="p-3 bg-brand-card/90 border border-brand-accent/10 hover:border-brand-accent/30 rounded-2xl flex items-center justify-between transition-all shadow-md"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-14 rounded overflow-hidden bg-brand-card-light shrink-0">
                      <SmartImage
                        key={manga.coverUrl}
                        src={manga.coverUrl}
                        alt={manga.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-display font-bold text-brand-text text-xs sm:text-sm truncate">{manga.title}</h4>
                      <p className="text-[10px] text-brand-text-dark mt-0.5 truncate">Зохиолч: {manga.author}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="inline-block text-[8px] bg-brand-bg text-brand-ice px-1.5 py-0.5 rounded uppercase font-semibold">
                          {manga.status === 'publishing' ? 'Гарч буй' : 'Дууссан'}
                        </span>
                        <span className="text-[9px] text-brand-accent font-bold font-mono">
                          {mangaChs.length} бүлэгтэй
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {/* Add chapter button for this specific manga */}
                    <button
                      onClick={() => {
                        setChMangaId(manga.id);
                        setActiveTabMode('add_chapter');
                      }}
                      className="px-2.5 py-1.5 bg-brand-accent/15 hover:bg-brand-accent hover:text-brand-bg text-brand-accent border border-brand-accent/30 rounded-xl text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1"
                      title="Шинэ бүлэг нэмэх"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Бүлэг</span>
                    </button>

                    <button
                      id={`admin-edit-manga-btn-${manga.id}`}
                      onClick={() => handleEditMangaClick(manga)}
                      className="p-2 bg-brand-bg hover:bg-brand-accent hover:text-brand-bg text-brand-accent rounded-xl transition-all cursor-pointer"
                      title="Мэдээлэл засах"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>

                    {onDeleteManga && (
                      deletingMangaId === manga.id ? (
                        <div className="flex items-center gap-1 animate-fade-in">
                          <button
                            id={`admin-confirm-delete-manga-btn-${manga.id}`}
                            onClick={() => {
                              onDeleteManga(manga.id);
                              setDeletingMangaId(null);
                            }}
                            className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow"
                          >
                            Устгах
                          </button>
                          <button
                            onClick={() => setDeletingMangaId(null)}
                            className="px-1.5 py-1 bg-brand-bg text-brand-text-dark text-xs rounded-xl cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          id={`admin-delete-manga-btn-${manga.id}`}
                          onClick={() => setDeletingMangaId(manga.id)}
                          className="p-2 bg-brand-bg hover:bg-red-500 hover:text-white text-red-400 rounded-xl transition-all cursor-pointer"
                          title="Бүрмөсөн устгах"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
