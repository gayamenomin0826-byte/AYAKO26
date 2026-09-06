export type UserRole = 'super_admin' | 'admin' | 'reader';

export interface User {
  id: string; // 8-digit unique code
  email: string;
  username: string;
  code: string; // 4-digit pin
  role: UserRole;
  vipUntil: string | null; // ISO timestamp or null
  savedMangaIds?: string[]; // Array of manga IDs saved/liked by user
  readChapterIds?: string[]; // Array of chapter IDs read by user for point calculation
  readingProgress?: Record<string, number>; // Record<chapterId, percentageNumber>
  readingHistory?: { mangaId: string; chapterId: string; timestamp: number }[];
}

export interface Manga {
  id: string;
  title: string;
  description: string;
  coverUrl: string;
  author: string;
  genres: string[];
  status: 'publishing' | 'completed' | 'full_release'; // 'Гарч буй' | 'Дууссан' | 'Гаргалт гүйцсэн'
  views: number;
  likes: number;
  type?: 'manga' | 'manhwa' | 'bl' | 'gl';
  isFree?: boolean; // true = free access even when site is paid, false = paid/VIP required in paid mode
  comments?: ChapterComment[];
  createdAt?: string;
  updatedAt?: string;
}

export interface CommentReply {
  id: string;
  username: string;
  text: string;
  createdAt: string;
}

export interface ChapterComment {
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

export interface Chapter {
  id: string;
  mangaId: string;
  title: string; // e.g., "Бүлэг 5"
  posterUrl?: string; // Custom chapter poster/thumbnail image
  translator: string;
  editor: string;
  typesetter: string;
  isVip: boolean;
  createdAt: string; // ISO string for date filtering
  images?: string[]; // list of vertical page images (base64 or urls)
  comments?: ChapterComment[];
}

export interface VipRequest {
  id: string;
  userId: string;
  username: string;
  userEmail: string;
  durationText: string; // e.g., "1 сар", "7 хоног"
  receiptName: string;
  receiptImage?: string; // Base64 data or image url
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface SalaryConfig {
  translatorRate: number; // base rate in MNT
  editorRate: number;
  typesetterRate: number;
}

export interface Employee {
  id: string;
  name: string;
  role: 'translator' | 'editor' | 'typesetter' | 'all';
}

export interface MovieItem {
  id: string;
  title: string;
  description: string;
  coverUrl: string;
  genres: string[];
  status: 'publishing' | 'completed';
  type?: 'Анимэ' | 'Кино' | 'Олон ангит';
  isFree?: boolean; // true = free access even when site is paid, false = VIP required in paid mode
  views: number;
  likes: number;
  comments?: ChapterComment[];
  createdAt?: string;
  updatedAt?: string;
}

export interface MovieEpisode {
  id: string;
  movieId: string;
  title: string; // e.g., "1-р анги"
  episodeNumber: number;
  videoUrl: string; // Direct video URL or embed iframe URL
  posterUrl?: string;
  isVip?: boolean;
  isFree?: boolean;
  comments?: ChapterComment[];
  createdAt: string;
}

export interface InitialData {
  siteConfig?: any;
  mangas?: Manga[];
  chapters?: Chapter[];
  genres?: string[];
  movies?: MovieItem[];
  movieEpisodes?: MovieEpisode[];
}

declare global {
  interface Window {
    __INITIAL_DATA__?: InitialData;
  }
}

