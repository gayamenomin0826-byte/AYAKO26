import React, { useState } from 'react';
import { Menu, X, User as UserIcon, LogOut, Settings, Award, Wallet, Kanban, Home, UserCheck, Edit3, PlusCircle, ArrowLeft, Search, BookOpen, Heart, Crown, Tv } from 'lucide-react';
import { User } from '../types';

interface HeaderProps {
  siteName: string;
  onChangeSiteName: (newName: string) => void;
  currentUser: User | null;
  onLogout: () => void;
  onOpenAuth: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onAddNewManga?: () => void;
  isReadingChapter?: boolean;
  onBackFromChapter?: () => void;
  searchQuery?: string;
  setSearchQuery?: (val: string) => void;
  isFreeSiteMode?: boolean;
  isMoviesTabEnabled?: boolean;
}

export default function Header({
  siteName,
  onChangeSiteName,
  currentUser,
  onLogout,
  onOpenAuth,
  activeTab,
  setActiveTab,
  onAddNewManga,
  isReadingChapter,
  onBackFromChapter,
  searchQuery,
  setSearchQuery,
  isFreeSiteMode = false,
  isMoviesTabEnabled = true
}: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(siteName);

  const handleSaveName = () => {
    if (tempName.trim()) {
      onChangeSiteName(tempName.trim());
      setIsEditingName(false);
    }
  };

  const showMovies = isMoviesTabEnabled || currentUser?.role === 'super_admin';

  const navItems = [
    { id: 'home', label: 'Нүүр', icon: Home, roles: ['reader', 'admin', 'super_admin'] },
    { id: 'manga', label: 'Манга', icon: BookOpen, roles: ['reader', 'admin', 'super_admin'] },
    ...(showMovies ? [{ id: 'movies', label: 'Кино', icon: Tv, roles: ['reader', 'admin', 'super_admin'] }] : []),
    { id: 'liked', label: 'Таалагдсан', icon: Heart, roles: ['reader', 'admin', 'super_admin'] },
    { id: 'profile', label: 'Профайл', icon: UserIcon, roles: ['reader', 'admin', 'super_admin'], requiresLogin: true },
    { id: 'admin_management', label: currentUser?.role === 'reader' ? 'VIP эрх авах' : 'Админы удирдлага', icon: currentUser?.role === 'reader' ? Award : Kanban, roles: ['reader', 'admin', 'super_admin'], requiresLogin: true },
  ];

  const allowedNavItems = navItems.filter(item => {
    if (item.requiresLogin && !currentUser) return false;
    // Hide 'VIP эрх авах' when site is in Free Mode for non-super_admin users
    if (item.id === 'admin_management' && isFreeSiteMode && currentUser?.role !== 'super_admin') {
      return false;
    }
    // Exclude 'admin_management' from the 3-line hamburger menu for admins/super_admins,
    // as requested so that it is accessed only via the gear icon next to the site name.
    if (item.id === 'admin_management' && (currentUser?.role === 'admin' || currentUser?.role === 'super_admin')) {
      return false;
    }
    if (currentUser) {
      return item.roles.includes(currentUser.role);
    }
    return item.roles.includes('reader') && !item.requiresLogin;
  });

  const isVipActive = (user: User | null): boolean => {
    if (!user) return false;
    if (user.role === 'super_admin' || user.role === 'admin') return true;
    if (!user.vipUntil) return false;
    return new Date(user.vipUntil) > new Date();
  };

  if (isReadingChapter) return null;

  return (
    <header id="app-header" className="sticky top-0 z-40 bg-brand-bg border-b border-b-brand-accent/5 px-4 py-2 md:px-8 shadow-md">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Left: Logo and Name */}
        <div className="flex items-center gap-1.5 sm:gap-2 flex-1 md:flex-initial mr-2">
              {/* Logo Star Icon: borderless glowing 4-pointed double pyramid star with water-blue radial glow from behind */}
              <div
                onClick={() => setActiveTab('home')}
                className="relative w-8 h-8 flex items-center justify-center text-cyan-400 cursor-pointer hover:opacity-90 transition-all shrink-0 select-none group"
                title="Нүүр хуудас руу шилжих"
              >
                {/* Gentle soft halo glow behind logo that works on all mobile screens */}
                <div 
                  className="absolute inset-[-4px] bg-cyan-400/30 rounded-full blur-md group-hover:bg-cyan-400/50 transition-all duration-300"
                  style={{ filter: 'blur(6px)', WebkitFilter: 'blur(6px)' }}
                />
                
                <svg
                  className="relative w-5 h-5 fill-current animate-pulse text-cyan-300"
                  style={{ filter: 'drop-shadow(0px 0px 6px rgba(34, 211, 238, 0.9))', WebkitFilter: 'drop-shadow(0px 0px 6px rgba(34, 211, 238, 0.9))' }}
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M12 2L14.8 9.2L22 12L14.8 14.8L12 22L9.2 14.8L2 12L9.2 9.2L12 2Z" />
                </svg>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {isEditingName && currentUser?.role === 'super_admin' ? (
                  <div className="flex items-center gap-1">
                    <input
                      id="header-edit-sitename-input"
                      type="text"
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      className="bg-brand-card border border-brand-accent text-brand-accent text-base font-display font-bold px-1.5 py-0.5 rounded focus:outline-none w-20 sm:w-28 md:w-40"
                      autoFocus
                      onBlur={handleSaveName}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveName();
                      }}
                    />
                    <button
                      id="header-save-sitename-btn"
                      onClick={handleSaveName}
                      className="text-[10px] bg-brand-accent text-brand-bg font-semibold px-1.5 py-0.5 rounded cursor-pointer"
                    >
                      Хадгалах
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 sm:gap-1.5">
                    <h1
                      id="app-sitename-title"
                      className="text-lg sm:text-xl font-serif font-black text-white tracking-widest uppercase select-none cursor-pointer hover:opacity-90 transition-all drop-shadow-sm"
                      onClick={() => setActiveTab('home')}
                      title="Нүүр хуудас"
                    >
                      {siteName}
                    </h1>
                    {currentUser?.role === 'super_admin' && (
                      <button
                        id="header-edit-site-btn"
                        onClick={() => setIsEditingName(true)}
                        className="text-brand-text-dark hover:text-brand-accent transition-colors"
                        title="Сайтын нэрийг засах"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                    )}
                    
                    {/* Gear settings button next to the site name - completely borderless/no background */}
                    {(currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && (
                      <button
                        id="header-admin-gear-btn"
                        onClick={() => setActiveTab('admin_management')}
                        className={`p-1 bg-transparent border-0 text-brand-text-dark hover:text-cyan-400 transition-all focus:outline-none cursor-pointer flex items-center justify-center ${
                          activeTab === 'admin_management' ? 'text-cyan-400' : ''
                        }`}
                        title="Админы удирдлага"
                      >
                        <Settings className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Search section right next to Site Name */}
              {setSearchQuery && (
                <div className="relative flex-1 max-w-[90px] xs:max-w-[120px] sm:max-w-[200px] ml-1.5 md:ml-3">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-brand-text-dark" />
                  <input
                    id="header-search-input"
                    type="text"
                    value={searchQuery || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSearchQuery(val);
                      if (val.trim().length > 0) {
                        if (activeTab !== 'search_results') {
                          setActiveTab('search_results');
                        }
                      } else if (activeTab === 'search_results') {
                        setActiveTab('home');
                      }
                    }}
                    placeholder="Хайх..."
                    className="w-full pl-6 pr-2 py-0.5 sm:py-1 bg-brand-card border border-brand-accent/10 rounded-lg text-[10px] sm:text-xs text-brand-text focus:outline-none focus:border-brand-accent transition-colors placeholder:text-brand-text-dark"
                  />
                </div>
              )}
            </div>

            {/* Center/Right Desktop Quick Stats & User Profile */}
            <div className="flex items-center gap-2 sm:gap-4">
              {currentUser ? (
                <div className="hidden md:flex items-center gap-3 bg-brand-card border border-brand-accent/15 px-3 py-1.5 rounded-full shadow-md">
                  <div className="relative w-7 h-7 rounded-full bg-brand-accent/20 border border-brand-accent/30 flex items-center justify-center text-brand-accent text-xs font-bold uppercase shrink-0">
                    {currentUser.username[0]}
                    {isVipActive(currentUser) && (
                      <Crown className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 text-amber-400 fill-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.9)]" />
                    )}
                  </div>
                  <div className="text-left text-xs">
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-white leading-tight">{currentUser.username}</p>
                      {isVipActive(currentUser) && (
                        <span 
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 text-[9px] font-black tracking-wider uppercase shadow-[0_0_8px_rgba(251,191,36,0.3)] select-none shrink-0"
                          title="VIP Хэрэглэгч Идэвхтэй"
                        >
                          <Crown className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                          <span>VIP</span>
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-brand-text-dark leading-none uppercase mt-0.5 font-medium">
                      {currentUser.role === 'super_admin' ? 'Ерөнхий Админ' : currentUser.role === 'admin' ? 'Админ' : 'Уншигч'}
                    </p>
                  </div>
                </div>
              ) : (
                <button
                  id="header-login-desktop-btn"
                  onClick={onOpenAuth}
                  className="hidden md:flex items-center gap-2 px-4 py-2 bg-brand-card hover:bg-brand-card-light border border-brand-accent/30 text-brand-accent rounded-full text-xs font-semibold tracking-wider uppercase transition-all cursor-pointer"
                >
                  <UserIcon className="w-3.5 h-3.5" />
                  Нэвтрэх
                </button>
              )}

              {/* Right Hamburger Icon for Menu */}
              <button
                id="header-hamburger-menu-btn"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-1.5 text-brand-accent hover:bg-brand-card rounded-lg border border-brand-accent/20 hover:border-brand-accent transition-all cursor-pointer z-50 relative"
                aria-label="Цэс"
              >
                {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
      </div>

      {/* Main Sub-Navigation Bar: Нүүр | Манга | Таалагдсан */}
      <nav id="header-sub-nav" className="border-t border-brand-accent/10 mt-2 pt-1.5 pb-0.5 flex items-center justify-center gap-2 sm:gap-6 md:gap-10 text-[11px] sm:text-xs font-semibold select-none overflow-x-auto scrollbar-none">
        <button
          id="subnav-tab-home"
          onClick={() => setActiveTab('home')}
          className={`px-3 sm:px-5 py-1 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'home'
              ? 'bg-cyan-950/80 text-cyan-400 font-extrabold border border-cyan-500/30 shadow-md shadow-cyan-500/10'
              : 'text-brand-text-dark hover:text-brand-text hover:bg-brand-card/40'
          }`}
        >
          <span>Нүүр</span>
        </button>

        <button
          id="subnav-tab-manga"
          onClick={() => setActiveTab('manga')}
          className={`px-3 sm:px-5 py-1 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'manga'
              ? 'bg-cyan-950/80 text-cyan-400 font-extrabold border border-cyan-500/30 shadow-md shadow-cyan-500/10'
              : 'text-brand-text-dark hover:text-brand-text hover:bg-brand-card/40'
          }`}
        >
          <span>Манга</span>
        </button>

        {showMovies && (
          <button
            id="subnav-tab-movies"
            onClick={() => setActiveTab('movies')}
            className={`px-3 sm:px-5 py-1 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'movies'
                ? 'bg-cyan-950/80 text-cyan-400 font-extrabold border border-cyan-500/30 shadow-md shadow-cyan-500/10'
                : 'text-brand-text-dark hover:text-brand-text hover:bg-brand-card/40'
            }`}
          >
            <span>Кино</span>
          </button>
        )}

        <button
          id="subnav-tab-liked"
          onClick={() => setActiveTab('liked')}
          className={`px-3 sm:px-5 py-1 rounded-xl transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
            activeTab === 'liked'
              ? 'bg-cyan-950/80 text-cyan-400 font-extrabold border border-cyan-500/30 shadow-md shadow-cyan-500/10'
              : 'text-brand-text-dark hover:text-brand-text hover:bg-brand-card/40'
          }`}
        >
          <span>Таалагдсан</span>
          {currentUser?.savedMangaIds && currentUser.savedMangaIds.length > 0 ? (
            <span className="ml-0.5 px-1.5 py-0.2 bg-cyan-500/20 text-cyan-300 rounded-full text-[9px] font-bold">
              {currentUser.savedMangaIds.length}
            </span>
          ) : null}
        </button>
      </nav>

      {/* Hamburger Sliding Drawer Overlay */}
      {isMenuOpen && (
        <div
          id="hamburger-drawer-overlay"
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-xs transition-opacity"
          onClick={() => setIsMenuOpen(false)}
        />
      )}

      {/* Hamburger Sliding Drawer */}
      <div
        id="hamburger-drawer-container"
        className={`fixed top-0 right-0 bottom-0 w-80 max-w-full bg-black border-l border-brand-accent/15 z-45 shadow-2xl p-6 pt-20 transition-transform duration-300 ease-out flex flex-col justify-between ${
          isMenuOpen ? 'translate-x-0' : 'translate-x-full invisible pointer-events-none'
        }`}
      >
        <div className="space-y-6">
          {/* Menu Header with User Info if logged in */}
          {currentUser ? (
            <div className="p-4 bg-brand-card border border-brand-accent/10 rounded-xl flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-full bg-brand-accent/20 border border-brand-accent/30 flex items-center justify-center text-brand-accent text-lg font-bold uppercase shrink-0">
                {currentUser.username[0]}
                {isVipActive(currentUser) && (
                  <Crown className="absolute -top-1.5 -right-1.5 w-4 h-4 text-amber-400 fill-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.9)]" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="font-bold text-white text-sm">{currentUser.username}</h4>
                  {isVipActive(currentUser) && (
                    <span 
                      className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 text-[10px] font-black uppercase shadow-[0_0_8px_rgba(251,191,36,0.4)]"
                      title="VIP Идэвхтэй"
                    >
                      <Crown className="w-3 h-3 text-amber-400 fill-amber-400" />
                      <span>VIP</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-brand-accent font-mono">ID: {currentUser.id}</p>
                <p className="text-[10px] text-brand-text-dark font-medium uppercase mt-0.5">
                  Эрх: {currentUser.role === 'super_admin' ? 'Ерөнхий Админ' : currentUser.role === 'admin' ? 'Админ' : 'Уншигч'}
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-brand-card border border-brand-accent/10 rounded-xl text-center">
              <p className="text-xs text-brand-text-dark mb-3">Хэрэглэгчийн эрхээр нэвтэрч бүрэн ашиглана уу.</p>
              <button
                id="header-login-drawer-btn"
                onClick={() => {
                  setIsMenuOpen(false);
                  onOpenAuth();
                }}
                className="w-full py-2 bg-brand-accent hover:bg-brand-accent-hover text-brand-bg font-display font-medium rounded-lg text-xs tracking-wider uppercase transition-all cursor-pointer"
              >
                Бүртгүүлэх / Нэвтрэх
              </button>
            </div>
          )}

          {/* Staff Add Manga Button */}
          {(currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && (
            <div className="px-1 pt-1">
              <button
                id="drawer-add-manga-direct-btn"
                onClick={() => {
                  setIsMenuOpen(false);
                  if (onAddNewManga) onAddNewManga();
                }}
                className="w-full flex items-center justify-center gap-2 py-3 bg-[#1e150d] hover:bg-[#2a1d12] border border-amber-500/30 hover:border-amber-500/60 text-[#efa01a] font-display font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-lg active:scale-95"
              >
                <PlusCircle className="w-4 h-4 text-amber-500" />
                <span>Шинэ Манга Нэмэх</span>
              </button>
            </div>
          )}

          {/* Navigation Items list */}
          <div>
            <h3 className="text-xs font-display font-semibold text-brand-text-dark tracking-widest uppercase mb-3 px-1">
              Сайтын цэсүүд
            </h3>
            <div className="space-y-1">
              {allowedNavItems.map((item) => {
                const IconComponent = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    id={`drawer-nav-item-${item.id}`}
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
                      isActive
                        ? 'bg-brand-accent/15 text-brand-accent border-l-4 border-brand-accent pl-3 font-semibold'
                        : 'text-brand-text-dark hover:bg-brand-card-light hover:text-brand-text'
                    }`}
                  >
                    <IconComponent className="w-5 h-5 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Drawer Footer Actions */}
        {currentUser && (
          <div className="border-t border-brand-accent/10 pt-4 mt-auto">
            <button
              id="drawer-logout-btn"
              onClick={() => {
                onLogout();
                setIsMenuOpen(false);
              }}
              className="w-full flex items-center justify-center gap-2 py-3 bg-red-950/20 hover:bg-red-950/40 border border-red-500/20 text-red-300 rounded-xl text-sm font-medium transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Гарах</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
