import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { Key, Mail, User as UserIcon, X, ShieldAlert, LogIn, Trash2, CheckCircle2, Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import { loginWithGooglePopup } from '../firebase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: User) => void;
  allUsers: User[];
  onRegisterUser: (newUser: User) => void;
}

export default function AuthModal({ isOpen, onClose, onAuthSuccess, allUsers, onRegisterUser }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  // State for saved recent accounts on this device
  const [recentAccounts, setRecentAccounts] = useState<User[]>([]);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      try {
        const saved = localStorage.getItem('ayako_recent_accounts');
        if (saved) {
          const parsed: User[] = JSON.parse(saved);
          setRecentAccounts(parsed);
        }
      } catch (e) {
        console.error('Error loading recent accounts', e);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const saveToRecent = (userToSave: User) => {
    try {
      const saved = localStorage.getItem('ayako_recent_accounts');
      let list: User[] = saved ? JSON.parse(saved) : [];
      list = list.filter(u => u.id !== userToSave.id && u.email.trim().toLowerCase() !== userToSave.email.trim().toLowerCase());
      list.unshift(userToSave);
      if (list.length > 8) list = list.slice(0, 8);
      localStorage.setItem('ayako_recent_accounts', JSON.stringify(list));
      setRecentAccounts(list);
    } catch (e) {}
  };

  const removeFromRecent = (userId: string, userEmail: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const updated = recentAccounts.filter(u => u.id !== userId && u.email.trim().toLowerCase() !== userEmail.trim().toLowerCase());
      localStorage.setItem('ayako_recent_accounts', JSON.stringify(updated));
      setRecentAccounts(updated);
    } catch (err) {}
  };

  const handleGenerate8DigitId = () => {
    let id = '';
    for (let i = 0; i < 8; i++) {
      id += Math.floor(Math.random() * 10).toString();
    }
    if (allUsers.some(u => u.id === id)) {
      return handleGenerate8DigitId();
    }
    return id;
  };

  // Direct 1-Click login without 4-digit PIN for recent saved account or Google login
  const handleQuickLogin = (targetUser: User) => {
    const emailLower = targetUser.email.trim().toLowerCase();
    const isSuperAdminEmail = emailLower === 'g.ayamenomin0826@gmail.com' || emailLower === 'misoraclan@gmail.com';
    
    // Find latest user data from allUsers if exists
    const existing = allUsers.find(u => u.email.trim().toLowerCase() === emailLower || u.id === targetUser.id);
    const userToAuth: User = existing ? {
      ...existing,
      role: isSuperAdminEmail ? 'super_admin' : existing.role
    } : {
      ...targetUser,
      role: isSuperAdminEmail ? 'super_admin' : targetUser.role
    };

    if (isSuperAdminEmail && userToAuth.role !== 'super_admin') {
      onRegisterUser(userToAuth);
    }

    saveToRecent(userToAuth);
    onAuthSuccess(userToAuth);
    onClose();
  };

  // Quick Google Sign-In action
  const handleGoogleSignIn = (targetEmail: string, customName?: string) => {
    const cleanEmail = targetEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Зөв Google Gmail хаяг олдсонгүй.');
      return;
    }

    const isSuperAdmin = cleanEmail === 'g.ayamenomin0826@gmail.com' || cleanEmail === 'misoraclan@gmail.com';
    const existingUser = allUsers.find(u => u.email.trim().toLowerCase() === cleanEmail);

    if (existingUser) {
      handleQuickLogin(existingUser);
    } else {
      // Create new Google authenticated user immediately
      const newUserId = handleGenerate8DigitId();
      const defaultName = customName || cleanEmail.split('@')[0];
      const googleUser: User = {
        id: newUserId,
        email: cleanEmail,
        username: defaultName.charAt(0).toUpperCase() + defaultName.slice(1),
        code: '0000',
        role: isSuperAdmin ? 'super_admin' : 'reader',
        vipUntil: null,
        savedMangaIds: []
      };
      onRegisterUser(googleUser);
      handleQuickLogin(googleUser);
    }
  };

  const handleTriggerGooglePopup = async () => {
    setError('');
    setIsGoogleLoading(true);
    try {
      const res = await loginWithGooglePopup();
      if (res && res.email) {
        handleGoogleSignIn(res.email, res.displayName);
      }
    } catch (err: any) {
      console.warn("Google popup login error:", err);
      const code = err?.code || '';
      if (code === 'auth/popup-closed-by-user') {
        setError('Google нэвтрэх цонх хаагдсан байна.');
      } else if (code === 'auth/popup-blocked') {
        setError('Хөтөч Google нэвтрэх цонхыг хаасан байна. Pop-up зөвшөөрнө үү.');
      } else if (code === 'auth/cancelled-popup-request') {
        setError('Өмнөх хүсэлт цуцлагдсан байна.');
      } else {
        setError(err?.message || 'Google нэвтрэх үед алдаа гарлаа. Дахин оролдоно уу.');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const emailTrimmed = email.trim();
    const pinTrimmed = pin.trim();

    if (!emailTrimmed || !pinTrimmed) {
      setError('Бүх талбарыг бөглөнө үү.');
      return;
    }

    if (pinTrimmed.length !== 4 || isNaN(Number(pinTrimmed))) {
      setError('Нууц код нь заавал 4 оронтой тоо байна.');
      return;
    }

    const emailLower = emailTrimmed.toLowerCase();
    const isSuperAdminEmail = emailLower === 'g.ayamenomin0826@gmail.com' || emailLower === 'misoraclan@gmail.com';

    if (isLogin) {
      // Find user by Gmail
      const userByEmail = allUsers.find(u => u.email.trim().toLowerCase() === emailLower);

      if (userByEmail) {
        const isCodeValid = String(userByEmail.code).trim() === pinTrimmed;

        if (isCodeValid) {
          const userToAuth: User = {
            ...userByEmail,
            role: isSuperAdminEmail ? 'super_admin' : userByEmail.role,
            code: userByEmail.code
          };
          if (isSuperAdminEmail && userByEmail.role !== 'super_admin') {
            onRegisterUser(userToAuth);
          }
          saveToRecent(userToAuth);
          onAuthSuccess(userToAuth);
          onClose();
          setEmail('');
          setPin('');
        } else {
          setError('4 оронтой нууц код буруу байна.');
        }
      } else {
        setError('Энэ Gmail хаягаар бүртгэлтэй хэрэглэгч олдсонгүй. Эхлээд бүртгүүлнэ үү.');
      }
    } else {
      if (!username.trim()) {
        setError('Профайл нэрээ оруулна уу.');
        return;
      }

      const existing = allUsers.find(u => u.email.trim().toLowerCase() === emailLower);
      if (existing) {
        const isCodeValid = String(existing.code).trim() === pinTrimmed;

        if (isCodeValid) {
          const updated: User = {
            ...existing,
            username: username.trim(),
            role: isSuperAdminEmail ? 'super_admin' : existing.role,
            code: existing.code
          };
          onRegisterUser(updated);
          saveToRecent(updated);
          onAuthSuccess(updated);
          onClose();
          setEmail('');
          setUsername('');
          setPin('');
          return;
        } else {
          setError('Энэ Gmail хаяг аль хэдийн бүртгэгдсэн байна. Нууц кодоо оруулж нэвтрэх хэсгээр орно уу.');
          return;
        }
      }

      const newUserId = handleGenerate8DigitId();
      const newUser: User = {
        id: newUserId,
        email: emailTrimmed,
        username: username.trim(),
        code: pinTrimmed,
        role: isSuperAdminEmail ? 'super_admin' : 'reader',
        vipUntil: null,
        savedMangaIds: []
      };

      onRegisterUser(newUser);
      saveToRecent(newUser);
      onAuthSuccess(newUser);
      onClose();
      setEmail('');
      setUsername('');
      setPin('');
    }
  };

  return (
    <div id="auth-modal-overlay" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div id="auth-modal-content" className="w-full max-w-md bg-brand-card border border-brand-accent/20 rounded-2xl p-6 shadow-2xl relative my-8">
        {/* Close Button */}
        <button
          id="auth-modal-close-btn"
          onClick={onClose}
          className="absolute top-4 right-4 text-brand-text-dark hover:text-brand-accent transition-colors cursor-pointer z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-5">
          <h2 id="auth-modal-title" className="text-2xl font-display font-semibold text-brand-accent glow-text">
            {isLogin ? 'Нэвтрэх' : 'Бүртгүүлэх'}
          </h2>
          <p id="auth-modal-subtitle" className="text-xs text-brand-text-dark mt-1">
            {isLogin ? 'Сайтад нэвтрэн өөрийн дуртай мангаагаа уншина уу.' : 'Шинэ хэрэглэгч болон бүртгүүлнэ үү.'}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div id="auth-modal-error-box" className="mb-4 p-3 bg-red-950/40 border border-red-500/50 rounded-lg text-red-300 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. Google Direct Login Button */}
        <div className="mb-5 space-y-1.5">
          <button
            id="auth-google-signin-btn"
            type="button"
            disabled={isGoogleLoading}
            onClick={handleTriggerGooglePopup}
            className="w-full py-3 px-4 bg-white hover:bg-gray-50 active:scale-[0.99] text-gray-800 font-semibold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-3 shadow-lg border border-gray-200 transition-all cursor-pointer group disabled:opacity-70 select-none"
          >
            {isGoogleLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
            ) : (
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
            )}
            <span>{isGoogleLoading ? 'Google цонх нээгдэж байна...' : 'Google хаягаар нэвтрэх'}</span>
          </button>
          <p className="text-[11px] text-center text-brand-text-dark/80">
            Таны төхөөрөмж дээрх Google хаягууд гарч ирэх ба сонгож шууд баталгаажуулна
          </p>
        </div>

        {/* 2. Recently Logged In Accounts (Өмнө нь нэвтэрсэн хаягууд) */}
        {isLogin && recentAccounts.length > 0 && (
          <div className="mb-5 space-y-2 border-t border-brand-accent/15 pt-4">
            <div className="flex items-center justify-between text-xs font-semibold text-brand-accent">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-brand-accent" />
                Өмнө нь нэвтэрсэн хаягууд (Нууц кодгүй шууд орох)
              </span>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
              {recentAccounts.map((acc) => {
                const isSuper = acc.role === 'super_admin' || acc.email.toLowerCase() === 'misoraclan@gmail.com' || acc.email.toLowerCase() === 'g.ayamenomin0826@gmail.com';
                const isAdmin = acc.role === 'admin';
                return (
                  <div
                    key={acc.id + acc.email}
                    onClick={() => handleQuickLogin(acc)}
                    className="group p-2.5 bg-brand-bg/70 hover:bg-brand-accent/15 border border-brand-accent/20 hover:border-brand-accent/50 rounded-xl flex items-center justify-between cursor-pointer transition-all shadow-sm"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                        isSuper ? 'bg-gradient-to-tr from-cyan-600 to-blue-500 text-white' : 'bg-brand-accent/20 text-brand-accent'
                      }`}>
                        {(acc.username || acc.email)[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-xs text-brand-text truncate group-hover:text-brand-accent transition-colors">
                            {acc.username || acc.email.split('@')[0]}
                          </span>
                          <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-bold shrink-0 ${
                            isSuper ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/30' :
                            isAdmin ? 'bg-purple-950 text-purple-300 border border-purple-500/30' :
                            'bg-brand-accent/10 text-brand-accent'
                          }`}>
                            {isSuper ? 'Ерөнхий админ' : isAdmin ? 'Админ' : 'Хэрэглэгч'}
                          </span>
                        </div>
                        <div className="text-[10px] text-brand-text-dark truncate">
                          {acc.email}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      <span className="text-[10px] font-bold text-brand-accent bg-brand-accent/10 px-2 py-1 rounded-md group-hover:bg-brand-accent group-hover:text-brand-bg transition-all">
                        Орох
                      </span>
                      <button
                        type="button"
                        onClick={(e) => removeFromRecent(acc.id, acc.email, e)}
                        className="p-1 text-gray-500 hover:text-red-400 transition-colors cursor-pointer"
                        title="Түүхээс устгах"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-brand-accent/15"></div>
          </div>
          <div className="relative flex justify-center text-[10px] uppercase font-mono tracking-widest">
            <span className="bg-brand-card px-3 text-brand-text-dark">
              {isLogin ? 'эсвэл Нууц кодоор нэвтрэх' : 'эсвэл Шинэ бүртгэл'}
            </span>
          </div>
        </div>

        {/* Standard Form */}
        <form id="auth-modal-form" onSubmit={handleSubmit} className="space-y-3.5">
          {!isLogin && (
            <div>
              <label id="auth-label-username" className="block text-xs font-medium text-brand-text-dark mb-1">
                Профайл нэр (Хэрэглэгчийн нэр)
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-dark" />
                <input
                  id="auth-input-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Жишээ: Төмөрөө"
                  className="w-full pl-10 pr-4 py-2 bg-brand-bg border border-brand-accent/20 rounded-lg text-xs text-brand-text focus:outline-none focus:border-brand-accent transition-colors"
                />
              </div>
            </div>
          )}

          <div>
            <label id="auth-label-email" className="block text-xs font-medium text-brand-text-dark mb-1">
              Gmail хаяг
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-dark" />
              <input
                id="auth-input-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@gmail.com"
                className="w-full pl-10 pr-4 py-2 bg-brand-bg border border-brand-accent/20 rounded-lg text-xs text-brand-text focus:outline-none focus:border-brand-accent transition-colors"
              />
            </div>
          </div>

          <div>
            <label id="auth-label-pin" className="block text-xs font-medium text-brand-text-dark mb-1">
              4 оронтой нууц код (PIN)
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-dark" />
              <input
                id="auth-input-pin"
                type="password"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="****"
                className="w-full pl-10 pr-4 py-2 bg-brand-bg border border-brand-accent/20 rounded-lg text-xs text-brand-text focus:outline-none focus:border-brand-accent tracking-widest transition-colors"
              />
            </div>
          </div>

          <button
            id="auth-submit-btn"
            type="submit"
            className="w-full py-2.5 mt-2 bg-brand-accent hover:bg-brand-accent-hover text-brand-bg font-display font-bold rounded-lg text-xs uppercase tracking-wider shadow-lg shadow-brand-accent/20 hover:shadow-brand-accent/35 transition-all cursor-pointer text-center"
          >
            {isLogin ? 'Нэвтрэх' : 'Бүртгүүлэх'}
          </button>
        </form>

        {/* Toggle link */}
        <div className="text-center mt-4">
          <button
            id="auth-toggle-mode-btn"
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            className="text-xs text-brand-accent hover:underline transition-all cursor-pointer"
          >
            {isLogin
              ? 'Шинээр бүртгүүлэх үү? Энд дарна уу.'
              : 'Аль хэдийн бүртгэлтэй юу? Нэвтрэх хэсэг рүү очих.'}
          </button>
        </div>
      </div>
    </div>
  );
}

