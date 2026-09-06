import React, { useEffect, useState } from 'react';
import { ShieldAlert, Lock } from 'lucide-react';
import { User } from '../types';

interface ScreenProtectionProps {
  currentUser: User | null;
  children: React.ReactNode;
}

export const ScreenProtection: React.FC<ScreenProtectionProps> = ({ currentUser, children }) => {
  const isStaff = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
  const [isCaptured, setIsCaptured] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    // Admins and Super Admins have no restrictions
    if (isStaff) {
      document.body.classList.remove('reader-protected');
      return;
    }

    // Apply CSS class to prevent text selection & copy
    document.body.classList.add('reader-protected');

    // Prevent context menu (right click) except inside inputs
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      e.preventDefault();
      showToast('Контент хамгаалагдсан: Баруун даралт ашиглахыг хориглосон');
    };

    // Prevent image drag
    const handleDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }
      e.preventDefault();
    };

    // Keyboard shortcuts prevention
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);

      // PrintScreen key
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen') {
        e.preventDefault();
        triggerCaptureGuard();
        showToast('🔒 Дэлгэцийн зураг авахыг хориглосон');
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText('').catch(() => {});
        }
        return;
      }

      const isCmdOrCtrl = e.ctrlKey || e.metaKey;

      // Don't intercept standard typing shortcuts like Ctrl+A, Ctrl+C, Ctrl+V inside form inputs
      if (isInput && isCmdOrCtrl && ['a', 'A', 'c', 'C', 'v', 'V', 'x', 'X', 'z', 'Z'].includes(e.key)) {
        return;
      }

      // Ctrl+P (Print), Ctrl+S (Save), Ctrl+U (View Source)
      if (isCmdOrCtrl && ['p', 'P', 's', 'S', 'u', 'U'].includes(e.key)) {
        e.preventDefault();
        showToast('🔒 Хэвлэх болон хадгалах үйлдэл хориглогдсон');
        return;
      }

      // DevTools (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C)
      if (
        e.key === 'F12' ||
        (isCmdOrCtrl && e.shiftKey && ['I', 'i', 'J', 'j', 'C', 'c'].includes(e.key))
      ) {
        e.preventDefault();
        showToast('🔒 Хөгжүүлэгчийн цэс ашиглах хориотой');
        return;
      }

      // Shift+Cmd+S or Cmd+Shift+3 / Cmd+Shift+4 / Cmd+Shift+5 (Mac Screenshots)
      if (e.metaKey && e.shiftKey && ['3', '4', '5', 's', 'S'].includes(e.key)) {
        if (!isInput) {
          triggerCaptureGuard();
          showToast('🔒 Дэлгэцийн зураг авахыг хориглосон');
        }
        return;
      }
    };

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('dragstart', handleDragStart);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.classList.remove('reader-protected');
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('dragstart', handleDragStart);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isStaff]);

  const triggerCaptureGuard = () => {
    setIsCaptured(true);
    setTimeout(() => {
      setIsCaptured(false);
    }, 1800);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2500);
  };

  return (
    <div className="relative min-h-screen">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100000] bg-red-950/95 border border-red-500/50 text-red-200 px-5 py-2.5 rounded-2xl shadow-2xl text-xs sm:text-sm font-semibold flex items-center gap-2 animate-bounce">
          <Lock className="w-4 h-4 text-red-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Screenshot / Record Warning Overlay (Shows only on capture attempt) */}
      {!isStaff && isCaptured && (
        <div className="fixed inset-0 z-[99999] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center text-center p-6 select-none pointer-events-auto">
          <div className="p-4 bg-brand-accent/10 rounded-3xl border border-brand-accent/20 mb-4 animate-pulse">
            <ShieldAlert className="w-12 h-12 text-brand-accent" />
          </div>
          <h2 className="text-lg sm:text-xl font-display font-extrabold text-white mb-2 tracking-wide">
            🔒 ДЭЛГЭЦИЙН ЗУРАГ АВАХ ХОРИОТОЙ
          </h2>
          <p className="text-xs sm:text-sm text-brand-text-dark max-w-md leading-relaxed mb-4">
            Аяко Манга веб сайтын зохиогчийн эрхийг хамгаалах зорилгоор дэлгэцийн зураг авахыг хязгаарласан болно.
          </p>
          <button
            onClick={() => setIsCaptured(false)}
            className="px-5 py-2.5 bg-brand-accent text-brand-bg font-bold rounded-xl text-xs hover:scale-105 transition-all cursor-pointer shadow-lg"
          >
            Хаах / Буцах
          </button>
          <div className="mt-4 px-3 py-1 bg-brand-bg/80 border border-brand-accent/10 rounded-full text-[10px] text-brand-accent font-mono">
            Хэрэглэгчийн ID: {currentUser?.id || 'Уншигч'} • Статус: Хамгаалагдсан
          </div>
        </div>
      )}

      {/* Main Content without heavy filter recalculations */}
      {children}
    </div>
  );
};

