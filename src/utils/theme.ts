export interface ThemePreset {
  id: string;
  name: string;
  hex: string;
  previewGradient: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: 'pink', name: 'Өгөгдмөл Ягаан (Pink)', hex: '#ff2a85', previewGradient: 'from-pink-500 to-rose-500' },
  { id: 'cyan', name: 'Цэнхэр (Cyan)', hex: '#06b6d4', previewGradient: 'from-cyan-500 to-blue-600' },
  { id: 'maroon', name: 'Улаан хүрэн (Maroon / Crimson)', hex: '#e11d48', previewGradient: 'from-rose-600 to-red-800' },
  { id: 'gold', name: 'Алтан шаргал (Gold / Amber)', hex: '#eab308', previewGradient: 'from-amber-400 to-yellow-600' },
  { id: 'green', name: 'Ногоон (Emerald Green)', hex: '#10b981', previewGradient: 'from-emerald-400 to-teal-600' },
  { id: 'purple', name: 'Нил ягаан (Violet / Purple)', hex: '#a855f7', previewGradient: 'from-purple-500 to-indigo-600' },
];

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  let c = hex.replace('#', '').trim();
  if (c.length === 3) {
    c = c.split('').map(x => x + x).join('');
  }
  const num = parseInt(c, 16);
  if (isNaN(num)) return { h: 334, s: 100, l: 58 }; // default pink fallback (#ff2a85)

  const r = ((num >> 16) & 255) / 255;
  const g = ((num >> 8) & 255) / 255;
  const b = (num & 255) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hslToHex(h: number, s: number, l: number): string {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function applyThemeColor(hexColor: string) {
  if (!hexColor || typeof document === 'undefined') return;

  const { h, s } = hexToHsl(hexColor);

  const cyan300 = hslToHex(h, Math.min(s, 95), 75); // bright lighter
  const cyan400 = hslToHex(h, s, 58);             // bright primary
  const cyan500 = hslToHex(h, s, 48);             // main primary
  const cyan600 = hslToHex(h, s, 38);             // darker
  const cyan950 = hslToHex(h, Math.min(s, 85), 10); // very dark bg tint

  const root = document.documentElement;

  // Override Tailwind v4 cyan palette variables
  root.style.setProperty('--color-cyan-300', cyan300);
  root.style.setProperty('--color-cyan-400', cyan400);
  root.style.setProperty('--color-cyan-500', cyan500);
  root.style.setProperty('--color-cyan-600', cyan600);
  root.style.setProperty('--color-cyan-950', cyan950);

  // Override brand variables
  root.style.setProperty('--color-brand-accent', cyan400);
  root.style.setProperty('--color-brand-accent-hover', cyan300);
  root.style.setProperty('--color-brand-ice', cyan300);

  // Custom property for inline styles or components
  root.style.setProperty('--theme-accent', cyan400);
}
