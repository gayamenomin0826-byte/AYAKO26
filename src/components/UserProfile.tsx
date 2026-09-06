import React, { useState } from 'react';
import { User, Manga } from '../types';
import { User as UserIcon, Key, Copy, Check, ShieldAlert, Sparkles, Heart, Award, Clock, Calendar, ShieldCheck } from 'lucide-react';
import MangaCard from './MangaCard';

interface UserProfileProps {
  currentUser: User | null;
  onUpdateProfile: (newUsername: string, newCode: string) => void;
  mangas?: Manga[];
  onSelectManga?: (manga: Manga) => void;
  onToggleSave?: (mangaId: string) => void;
  onCopyLink?: (manga: Manga) => void;
}

export default function UserProfile({
  currentUser,
  onUpdateProfile,
  mangas = [],
  onSelectManga,
  onToggleSave,
  onCopyLink
}: UserProfileProps) {
  const [username, setUsername] = useState(currentUser?.username || '');
  const [pin, setPin] = useState(currentUser?.code || '');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  if (!currentUser) {
    return (
      <div className="max-w-md mx-auto py-12 text-center text-brand-text-dark space-y-3">
        <ShieldAlert className="w-12 h-12 text-brand-accent mx-auto animate-pulse" />
        <p className="text-sm">Хувийн профайлаа үзэх, мэдээллээ солихын тулд нэвтэрсэн байх шаардлагатай.</p>
      </div>
    );
  }

  const savedMangas = mangas.filter(m => currentUser.savedMangaIds?.includes(m.id));

  const isStaff = currentUser.role === 'admin' || currentUser.role === 'super_admin';
  const vipDateObj = currentUser.vipUntil ? new Date(currentUser.vipUntil) : null;
  const isVipValid = isStaff || (vipDateObj !== null && !isNaN(vipDateObj.getTime()) && vipDateObj > new Date());
  const isUnlimitedVip = isStaff || (vipDateObj !== null && vipDateObj.getFullYear() >= 2090);

  const getRemainingDaysText = () => {
    if (isStaff || isUnlimitedVip || !vipDateObj) return null;
    const diffMs = vipDateObj.getTime() - new Date().getTime();
    if (diffMs <= 0) return null;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (diffDays > 0) {
      return `${diffDays} өдөр ${diffHours} цаг үлдсэн`;
    }
    return `${diffHours} цаг үлдсэн`;
  };

  const remainingText = getRemainingDaysText();

  const handleCopyId = () => {
    navigator.clipboard.writeText(currentUser.id);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!username.trim()) {
      setErrorMsg('Профайл нэр хоосон байж болохгүй.');
      return;
    }

    if (pin.length !== 4 || isNaN(Number(pin))) {
      setErrorMsg('Нууц код нь заавал 4 оронтой тоо байна.');
      return;
    }

    onUpdateProfile(username.trim(), pin);
    setSuccessMsg('Профайл амжилттай шинэчлэгдлээ!');
    setTimeout(() => setSuccessMsg(''), 2000);
  };

  return (
    <div id="user-profile-view" className="max-w-lg mx-auto px-4 py-8 space-y-6 animate-fade-in">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-display font-extrabold text-brand-accent glow-text uppercase">
          Хувийн Профайл
        </h2>
        <p className="text-xs text-brand-text-dark">
          Та өөрийн нэр болон 4 оронтой нууц кодоо эндээс хэзээ ч шууд сольж болно.
        </p>
      </div>

      {/* Unique ID Card Display (Aesthetic and glowing) */}
      <div className="bg-gradient-to-br from-brand-card to-brand-card-light border border-brand-accent/30 rounded-2xl p-6 relative overflow-hidden shadow-2xl shadow-brand-accent/5 glow-border">
        {/* Glow effect overlay */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-accent/10 rounded-full blur-2xl" />

        <div className="flex justify-between items-start">
          <div className="space-y-4">
            <div>
              <p className="text-[10px] text-brand-accent font-semibold tracking-widest uppercase font-mono">Дахин давтагдашгүй ID код</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-2xl font-mono font-extrabold text-brand-ice tracking-wider glow-text">
                  {currentUser.id}
                </span>
                <button
                  id="profile-copy-id-btn"
                  onClick={handleCopyId}
                  className="p-1 text-brand-text-dark hover:text-brand-accent transition-colors"
                  title="ID хуулах"
                >
                  {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <p className="text-[10px] text-brand-text-dark font-semibold tracking-wider uppercase font-mono">Хэрэглэгчийн Gmail</p>
              <p className="text-sm font-medium text-brand-text">{currentUser.email}</p>
            </div>

            <div>
              <p className="text-[10px] text-brand-text-dark font-semibold tracking-wider uppercase font-mono">Одоогийн эрхийн түвшин</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="inline-block px-2.5 py-0.5 bg-brand-accent/15 text-brand-accent border border-brand-accent/25 rounded-full text-xs font-bold uppercase tracking-wider">
                  {currentUser.role === 'super_admin' ? 'Ерөнхий Админ' : currentUser.role === 'admin' ? 'Админ' : 'Уншигч'}
                </span>
                {isVipValid && (
                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" /> VIP
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="w-12 h-12 rounded-2xl bg-brand-accent/20 border border-brand-accent/40 flex items-center justify-center text-brand-accent text-xl font-bold uppercase shrink-0">
            {currentUser.username[0]}
          </div>
        </div>
      </div>

      {/* VIP Expiry & Status Card */}
      <div className={`border rounded-2xl p-5 shadow-xl transition-all relative overflow-hidden ${
        isVipValid
          ? 'bg-gradient-to-r from-amber-950/40 via-brand-card to-brand-card border-amber-500/30 shadow-amber-500/5'
          : 'bg-brand-card border-brand-accent/10'
      }`}>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Award className={`w-5 h-5 ${isVipValid ? 'text-amber-400 animate-pulse' : 'text-brand-text-dark'}`} />
              <h3 className="text-sm font-display font-bold text-brand-text uppercase tracking-wider">
                VIP Эрхийн Төлөв
              </h3>
            </div>

            {isVipValid ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-full text-xs font-extrabold uppercase tracking-widest flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" /> VIP Идэвхтэй
                  </span>
                  {remainingText && (
                    <span className="text-[11px] font-mono text-amber-200/90 bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-500/20 font-semibold">
                      ({remainingText})
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs text-brand-text font-medium pt-1">
                  <Calendar className="w-4 h-4 text-brand-accent shrink-0" />
                  <span>
                    Дуусах хугацаа:{' '}
                    <strong className="text-brand-ice font-mono font-bold">
                      {isStaff
                        ? 'Хугацаагүй (Админ эрхтэй)'
                        : isUnlimitedVip
                        ? 'Хугацаагүй VIP'
                        : vipDateObj
                        ? `${vipDateObj.getFullYear()}.${String(vipDateObj.getMonth() + 1).padStart(2, '0')}.${String(vipDateObj.getDate()).padStart(2, '0')} ${String(vipDateObj.getHours()).padStart(2, '0')}:${String(vipDateObj.getMinutes()).padStart(2, '0')}`
                        : 'Мэдээлэлгүй'}
                    </strong>
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 bg-gray-800 text-brand-text-dark border border-gray-700 rounded-full text-xs font-bold uppercase tracking-wider">
                    VIP Идэвхгүй
                  </span>
                  {vipDateObj && (
                    <span className="text-xs text-red-400 font-mono font-medium">
                      (Хугацаа дууссан)
                    </span>
                  )}
                </div>
                <p className="text-xs text-brand-text-dark">
                  VIP эрх авснаар шинэ ангиудыг саадгүй шууд унших боломжтой.
                </p>
              </div>
            )}
          </div>

          <div className={`shrink-0 p-3 rounded-2xl border ${isVipValid ? 'bg-amber-950/30 border-amber-500/30' : 'bg-brand-bg/60 border-brand-accent/10'}`}>
            <Clock className={`w-6 h-6 ${isVipValid ? 'text-amber-400 animate-spin-slow' : 'text-brand-text-dark/40'}`} />
          </div>
        </div>
      </div>

      {/* Edit Profile Form */}
      <div className="bg-brand-card border border-brand-accent/10 rounded-2xl p-6 shadow-xl">
        <h3 className="text-sm font-display font-bold text-brand-text border-b border-brand-accent/5 pb-2 mb-4 uppercase">
          Мэдээлэл шинэчлэх
        </h3>

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="mb-4 p-3 bg-red-950/40 border border-red-500/30 rounded-xl text-red-300 text-xs">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-brand-text-dark mb-1">
              Профайл нэр солих
            </label>
            <div className="relative">
              <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-dark" />
              <input
                id="profile-username-input"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-brand-bg border border-brand-accent/20 rounded-lg text-sm text-brand-text focus:outline-none focus:border-brand-accent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-brand-text-dark mb-1">
              4 оронтой шинэ нууц код (PIN)
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-dark" />
              <input
                id="profile-pin-input"
                type="text"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                className="w-full pl-10 pr-4 py-2 bg-brand-bg border border-brand-accent/20 rounded-lg text-sm text-brand-text focus:outline-none focus:border-brand-accent tracking-widest"
              />
            </div>
          </div>

          <button
            id="profile-save-btn"
            type="submit"
            className="w-full py-2.5 mt-2 bg-brand-accent hover:bg-brand-accent-hover text-brand-bg font-display font-semibold rounded-lg text-sm uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md shadow-brand-accent/20"
          >
            <Sparkles className="w-4 h-4 animate-pulse" />
            <span>Шинэчлэх</span>
          </button>
        </form>
      </div>

      {/* Saved/Liked Mangas Section */}
      <div id="user-saved-manga-section" className="bg-brand-card border border-brand-accent/10 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-brand-accent/10 pb-3">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-red-500 fill-red-500 animate-pulse" />
            <h3 className="text-base font-display font-bold text-brand-text uppercase tracking-wider">
              Хадгалсан манга ({savedMangas.length})
            </h3>
          </div>
        </div>

        {savedMangas.length === 0 ? (
          <div className="py-8 px-4 text-center bg-brand-bg/50 border border-dashed border-brand-accent/10 rounded-xl space-y-2">
            <Heart className="w-8 h-8 text-brand-text-dark/40 mx-auto" />
            <p className="text-xs text-brand-text-dark">
              Танд хадгалсан манга одоогоор байхгүй байна. Дуртай манга дээрээ зүрх (❤️) даран профайлдаа хадгалаарай!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {savedMangas.map((manga) => (
              <MangaCard
                key={manga.id}
                manga={manga}
                onSelect={(m) => onSelectManga?.(m)}
                canDelete={false}
                isSaved={true}
                onToggleSave={onToggleSave}
                onCopyLink={onCopyLink}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
