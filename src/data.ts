import { Manga, Chapter, Employee, SalaryConfig, User, MovieItem, MovieEpisode } from './types';

export const INITIAL_MOVIES: MovieItem[] = [];

export const INITIAL_MOVIE_EPISODES: MovieEpisode[] = [];

export const INITIAL_MANGAS: Manga[] = [];

export const INITIAL_EMPLOYEES: Employee[] = [];

export const INITIAL_CHAPTERS: Chapter[] = [];

export const DEFAULT_SALARY_CONFIG: SalaryConfig = {
  translatorRate: 15000, // 15,000 MNT per chapter
  editorRate: 10000,     // 10,000 MNT per chapter
  typesetterRate: 8000   // 8,000 MNT per chapter
};

export const INITIAL_USERS: User[] = [
  {
    id: '99999999',
    email: 'g.ayamenomin0826@gmail.com',
    username: 'Super Admin',
    code: '1111',
    role: 'super_admin',
    vipUntil: null,
    savedMangaIds: []
  },
  {
    id: '88888888',
    email: 'misoraclan@gmail.com',
    username: 'AYAKO',
    code: '1234',
    role: 'super_admin',
    vipUntil: null,
    savedMangaIds: []
  }
];

export const DEFAULT_GENRES = [
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Ecchi',
  'Fantasy',
  'Historical',
  'Horror',
  'Isekai',
  'Josei',
  'Martial Arts',
  'Mecha',
  'Mystery',
  'Psychological',
  'Romance',
  'School',
  'Sci-Fi',
  'Seinen',
  'Shoujo',
  'Shounen',
  'Slice of Life',
  'Sports',
  'Supernatural',
  'Thriller'
];

export const ALL_GENRES = DEFAULT_GENRES;
