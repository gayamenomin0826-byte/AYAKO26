import React, { useState, useEffect } from 'react';
import { Palette, Check, RefreshCw, Sparkles, Eye, ShieldAlert } from 'lucide-react';
import { THEME_PRESETS, applyThemeColor } from '../utils/theme';

interface ThemeSettingsPanelProps {
  currentThemeColor?: string;
  onSaveTheme: (colorHex: string) => Promise<void> | void;
  isFreeSiteMode?: boolean;
  onToggleFreeSiteMode?: (free: boolean) => Promise<void> | void;
  isMoviesTabEnabled?: boolean;
  onToggleMoviesTab?: (enabled: boolean) => Promise<void> | void;
}

export default function ThemeSettingsPanel({
  currentThemeColor = '#ff2a85',
  onSaveTheme,
  isFreeSiteMode = false,
  onToggleFreeSiteMode,
  isMoviesTabEnabled = true,
  onToggleMoviesTab
}: ThemeSettingsPanelProps) {
  const [selectedHex, setSelectedHex] = useState<string>(currentThemeColor);
  const [customHexInput, setCustomHexInput] = useState<string>(currentThemeColor);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    if (currentThemeColor) {
      setSelectedHex(currentThemeColor);
      setCustomHexInput(currentThemeColor);
      applyThemeColor(currentThemeColor);
    }
  }, [currentThemeColor]);

  // Live preview when user clicks preset or changes color picker
  const handleColorChange = (newHex: string) => {
    setSelectedHex(newHex);
    setCustomHexInput(newHex);
    applyThemeColor(newHex);
    setSuccessMsg('');
  };

  const handleCustomHexTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomHexInput(val);
    if (/^#([0-9A-F]{3}){1,2}$/i.test(val)) {
      setSelectedHex(val);
      applyThemeColor(val);
      setSuccessMsg('');
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      applyThemeColor(selectedHex);
      await onSaveTheme(selectedHex);
      setSuccessMsg('Сайтын үндсэн өнгө амжилттай хадгалагдлаа!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error('Error saving theme:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefault = async () => {
    const defaultPink = '#ff2a85';
    handleColorChange(defaultPink);
    await onSaveTheme(defaultPink);
    setSuccessMsg('Өгөгдмөл ягаан өнгө рүү сэргээгдлээ!');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  return (
    <div className="w-full space-y-6 animate-fade-in text-brand-text">
      {/* Site Mode Control Section (Free vs Paid) */}
      <div className="bg-[#0b0c0e] border border-cyan-500/20 p-5 sm:p-6 rounded-3xl shadow-2xl space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${
              isFreeSiteMode ? 'bg-emerald-950/80 border border-emerald-500/50 text-emerald-400' : 'bg-amber-950/80 border border-amber-500/50 text-amber-400'
            }`}>
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif italic font-extrabold text-base sm:text-lg text-brand-text">
                  Сайтын Төлбөрийн Горим
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  isFreeSiteMode ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}>
                  {isFreeSiteMode ? '🟢 ҮНЭГҮЙ (FREE)' : '🔒 ТӨЛБӨРТЭЙ (VIP)'}
                </span>
              </div>
              <p className="text-xs text-brand-text-dark mt-1">
                {isFreeSiteMode 
                  ? 'Сайт бүхэлдээ үнэгүй горимд байна. Бүх хэрэглэгч нар манга, бүлгийг шууд уншина. "VIP эрх авах" цэс хэрэглэгчдэд нуугдсан.'
                  : 'Сайт төлбөртэй (VIP) горимд байна. VIP бүлгүүдийг уншихад эрх шаардагдана.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleFreeSiteMode?.(true)}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                isFreeSiteMode
                  ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20 ring-2 ring-emerald-400'
                  : 'bg-brand-card hover:bg-emerald-950/40 border border-emerald-500/30 text-emerald-400'
              }`}
            >
              <span>Үнэгүй болгох (Free Mode)</span>
            </button>
            <button
              type="button"
              onClick={() => onToggleFreeSiteMode?.(false)}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                !isFreeSiteMode
                  ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20 ring-2 ring-amber-400'
                  : 'bg-brand-card hover:bg-amber-950/40 border border-amber-500/30 text-amber-400'
              }`}
            >
              <span>Төлбөртэй болгох (VIP Mode)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Movies Section Visibility Control */}
      <div className="bg-[#0b0c0e] border border-cyan-500/20 p-5 sm:p-6 rounded-3xl shadow-2xl space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${
              isMoviesTabEnabled ? 'bg-cyan-950/80 border border-cyan-500/50 text-cyan-400' : 'bg-red-950/80 border border-red-500/50 text-red-400'
            }`}>
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-serif italic font-extrabold text-base sm:text-lg text-brand-text">
                  "Кино" Хэсгийн Харагдах Байдал
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                  isMoviesTabEnabled ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-red-500/20 text-red-300 border border-red-500/40'
                }`}>
                  {isMoviesTabEnabled ? '👁️ ИДЭВХТЭЙ (НИЙТЭД ХАРАГДАНА)' : '🙈 НУУЦАЛСАН (ЗӨВХӨН СУПЕР АДМИН)'}
                </span>
              </div>
              <p className="text-xs text-brand-text-dark mt-1">
                {isMoviesTabEnabled
                  ? 'Сайтын цэс дээр "Кино" цэс гарч ирэх ба бүх хэрэглэгчид үзэх боломжтой.'
                  : 'Сайтын цэснээс "Кино" цэсийг нуусан. Зөвхөн Ерөнхий админд харагдана.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleMoviesTab?.(true)}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                isMoviesTabEnabled
                  ? 'bg-cyan-400 text-black shadow-lg shadow-cyan-400/20 ring-2 ring-cyan-300'
                  : 'bg-brand-card hover:bg-cyan-950/40 border border-cyan-500/30 text-cyan-400'
              }`}
            >
              <span>Харагддаг болгох</span>
            </button>
            <button
              type="button"
              onClick={() => onToggleMoviesTab?.(false)}
              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 ${
                !isMoviesTabEnabled
                  ? 'bg-red-500 text-white shadow-lg shadow-red-500/20 ring-2 ring-red-400'
                  : 'bg-brand-card hover:bg-red-950/40 border border-red-500/30 text-red-400'
              }`}
            >
              <span>Нуух</span>
            </button>
          </div>
        </div>
      </div>
      {/* Top Banner */}
      <div className="bg-[#0b0c0e] border border-cyan-500/20 p-5 sm:p-6 rounded-3xl shadow-2xl relative overflow-hidden space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0 shadow-lg animate-pulse">
            <Palette className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <h3 className="font-serif italic font-extrabold text-base sm:text-xl text-cyan-300 tracking-wide glow-text">
              Сайтын Өнгө Төрх Тохируулах
            </h3>
            <p className="text-[10px] sm:text-xs text-brand-text-dark font-medium leading-tight">
              Ерөнхий админ сайтын үндсэн акцент өнгийг хүссэнээрээ солих боломжтой.
            </p>
          </div>
        </div>

        {successMsg && (
          <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-2xl text-emerald-300 text-xs font-bold flex items-center gap-2 shadow-lg animate-fade-in">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
      </div>

      {/* Preset Colors Grid */}
      <div className="space-y-3">
        <label className="block text-xs font-extrabold text-cyan-300 uppercase tracking-wider">
          1. Бэлэн Өнгөнүүд (Presets)
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {THEME_PRESETS.map((preset) => {
            const isSelected = selectedHex.toLowerCase() === preset.hex.toLowerCase();

            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleColorChange(preset.hex)}
                className={`relative p-3 rounded-2xl border transition-all cursor-pointer flex flex-col items-center gap-2 group ${
                  isSelected
                    ? 'bg-cyan-950/40 border-cyan-400 shadow-lg shadow-cyan-500/20 scale-105'
                    : 'bg-[#15151e]/80 border-cyan-500/10 hover:border-cyan-500/30 hover:scale-[1.02]'
                }`}
              >
                {/* Color Swatch Circle */}
                <div
                  className="w-10 h-10 rounded-full shadow-inner border border-white/20 flex items-center justify-center transition-transform group-hover:scale-110"
                  style={{ backgroundColor: preset.hex }}
                >
                  {isSelected && <Check className="w-5 h-5 text-white drop-shadow-md" />}
                </div>

                <span className="text-[11px] font-extrabold text-center text-brand-text group-hover:text-cyan-300 transition-colors">
                  {preset.name}
                </span>

                {isSelected && (
                  <span className="absolute -top-1.5 -right-1.5 px-2 py-0.5 bg-cyan-400 text-black font-black text-[9px] rounded-full uppercase tracking-tighter shadow-md">
                    Идэвхтэй
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom Color Selector Section */}
      <div className="bg-[#0b0c0e] border border-cyan-500/10 p-5 rounded-3xl space-y-4">
        <label className="block text-xs font-extrabold text-cyan-300 uppercase tracking-wider">
          2. Гараар өнгө тохируулах (Custom Hex Color)
        </label>
        <p className="text-xs text-brand-text-dark">
          Код суваг эсвэл Color Picker ашиглан хүссэн ямар ч өнгийг оруулна уу:
        </p>

        <div className="flex flex-wrap items-center gap-4">
          {/* Native HTML Color Picker */}
          <div className="flex items-center gap-2 bg-[#15151e] border border-cyan-500/20 p-2 rounded-2xl">
            <input
              type="color"
              value={selectedHex}
              onChange={(e) => handleColorChange(e.target.value)}
              className="w-10 h-10 rounded-xl cursor-pointer bg-transparent border-0 p-0"
            />
            <span className="text-xs font-mono font-bold text-brand-accent">Color Picker</span>
          </div>

          {/* Hex code text input */}
          <div className="flex items-center gap-2 bg-[#15151e] border border-brand-accent/20 px-3 py-2 rounded-2xl flex-1 max-w-xs">
            <span className="text-xs font-mono text-brand-accent font-bold">HEX:</span>
            <input
              type="text"
              value={customHexInput}
              onChange={handleCustomHexTextChange}
              placeholder="#ff2a85"
              className="bg-transparent text-xs font-mono text-brand-text font-extrabold focus:outline-none w-full uppercase"
            />
          </div>

          {/* Color preview circle */}
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full border-2 border-white/20 shadow-md"
              style={{ backgroundColor: selectedHex }}
            />
            <span className="text-xs font-mono font-bold text-brand-text-dark">{selectedHex}</span>
          </div>
        </div>
      </div>

      {/* Live Preview Demonstration Card */}
      <div className="bg-[#0b0c0e] border border-cyan-500/20 p-5 rounded-3xl space-y-4 shadow-xl">
        <div className="flex items-center gap-2 border-b border-cyan-500/10 pb-3">
          <Eye className="w-4 h-4 text-cyan-400" />
          <h4 className="text-xs font-extrabold text-cyan-300 uppercase tracking-wider">
            Шууд харагдах байдал (Live Preview)
          </h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Sample Heading & Glow */}
          <div className="bg-[#15151e] p-4 rounded-2xl border border-cyan-500/20 space-y-2">
            <span className="text-[10px] uppercase font-mono text-brand-text-dark">Товч ба Гарчиг</span>
            <h5 className="font-serif italic font-extrabold text-base text-cyan-400 glow-text">
              Аяко Манга Тавтай Морил!
            </h5>
            <button className="w-full py-2 bg-cyan-400 text-black font-extrabold text-xs rounded-xl shadow-lg hover:bg-cyan-300 transition-all cursor-pointer">
              Товчлуурын харагдах байдал
            </button>
          </div>

          {/* Sample Card Badge */}
          <div className="bg-[#15151e] p-4 rounded-2xl border border-cyan-500/20 space-y-2">
            <span className="text-[10px] uppercase font-mono text-brand-text-dark">Шошго & Хүрээ</span>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-cyan-950 text-cyan-300 border border-cyan-500/30 font-bold text-xs rounded-lg">
                Шинэ Бүлэг
              </span>
              <span className="px-2.5 py-1 bg-cyan-500/20 text-cyan-400 font-bold text-xs rounded-lg">
                VIP Гишүүн
              </span>
            </div>
            <div className="p-2.5 bg-cyan-950/40 border border-cyan-500/30 rounded-xl text-xs text-cyan-300 font-medium">
              Энэ бол хүрээний ба өнгөний элементүүд.
            </div>
          </div>

          {/* Sample Icon & Text */}
          <div className="bg-[#15151e] p-4 rounded-2xl border border-cyan-500/20 space-y-2 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-mono text-brand-text-dark">Икон & Тохиргоо</span>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-md">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="text-xs">
                <p className="font-bold text-cyan-300">Акцент Икон</p>
                <p className="text-[10px] text-brand-text-dark">Сайт даяар ижил хэв маягаар харагдана.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons: Save & Reset */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
        <button
          type="button"
          onClick={handleResetDefault}
          className="px-4 py-2.5 bg-brand-card hover:bg-white/5 border border-white/10 text-brand-text-dark hover:text-brand-text text-xs font-bold rounded-2xl flex items-center gap-2 transition-all cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Өгөгдмөл цэнхэр рүү буцах</span>
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-3 bg-cyan-400 hover:bg-cyan-300 text-black font-extrabold text-xs sm:text-sm rounded-2xl shadow-2xl flex items-center gap-2 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
        >
          <Check className="w-5 h-5" />
          <span>{isSaving ? 'Хадгалж байна...' : 'Сайтын өнгийг хадгалах'}</span>
        </button>
      </div>
    </div>
  );
}
