import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  AreaChart,
  Area
} from 'recharts';
import { TrendingUp, Eye, Heart, Sparkles } from 'lucide-react';
import { Manga } from '../types';

interface PopularThisWeekChartProps {
  mangas: Manga[];
  onSelectManga?: (manga: Manga) => void;
}

export const PopularThisWeekChart: React.FC<PopularThisWeekChartProps> = ({
  mangas,
  onSelectManga
}) => {
  const [chartType, setChartType] = useState<'bar' | 'area'>('bar');
  const [metricFilter, setMetricFilter] = useState<'all' | 'views' | 'likes'>('all');

  // Process & sort top 7 popular mangas based on engagement (views & likes)
  const chartData = useMemo(() => {
    if (!mangas || mangas.length === 0) return [];

    // Sort mangas by total popularity score (views + likes * 5)
    const sorted = [...mangas]
      .sort((a, b) => {
        const scoreA = (a.views || 0) + (a.likes || 0) * 5;
        const scoreB = (b.views || 0) + (b.likes || 0) * 5;
        return scoreB - scoreA;
      })
      .slice(0, 7);

    return sorted.map((m) => {
      // Shorten title for XAxis label if too long
      const rawTitle = String(m?.title || 'Манга');
      const shortTitle = rawTitle.length > 12 ? rawTitle.substring(0, 10) + '...' : rawTitle;
      return {
        id: m.id,
        fullTitle: rawTitle,
        title: shortTitle,
        views: m.views || 0,
        likes: m.likes || 0,
        type: m.type || 'manga',
        coverUrl: m.coverUrl,
        rawManga: m
      };
    });
  }, [mangas]);

  // Overall statistics summaries
  const totalViews = useMemo(() => mangas.reduce((acc, m) => acc + (m.views || 0), 0), [mangas]);
  const totalLikes = useMemo(() => mangas.reduce((acc, m) => acc + (m.likes || 0), 0), [mangas]);
  const topManga = chartData[0];

  if (chartData.length === 0) return null;

  return (
    <div className="space-y-4 pt-6 border-t border-cyan-500/10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <TrendingUp className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-display font-extrabold text-base sm:text-lg text-brand-text tracking-wider uppercase flex items-center gap-2">
              Энэ долоо хоногийн трэнд
              <span className="text-[10px] bg-cyan-500/20 text-cyan-300 font-mono px-2 py-0.5 rounded-full border border-cyan-500/30">
                TOP 7
              </span>
            </h3>
            <p className="text-xs text-brand-text-dark font-sans">
              Үзэлт болон таалагдсан тоогоор тэргүүлж буй мангануудын тойм
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="bg-[#12141a] p-1 rounded-xl border border-cyan-500/20 flex items-center gap-1 text-xs">
            <button
              type="button"
              onClick={() => setChartType('bar')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                chartType === 'bar'
                  ? 'bg-cyan-500 text-black shadow-md'
                  : 'text-brand-text-dark hover:text-white'
              }`}
            >
              Баган
            </button>
            <button
              type="button"
              onClick={() => setChartType('area')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                chartType === 'area'
                  ? 'bg-cyan-500 text-black shadow-md'
                  : 'text-brand-text-dark hover:text-white'
              }`}
            >
              График
            </button>
          </div>

          <div className="bg-[#12141a] p-1 rounded-xl border border-cyan-500/20 flex items-center gap-1 text-xs">
            <button
              type="button"
              onClick={() => setMetricFilter('all')}
              className={`px-2 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                metricFilter === 'all'
                  ? 'bg-brand-accent/20 text-brand-accent border border-brand-accent/40'
                  : 'text-brand-text-dark hover:text-white'
              }`}
            >
              Бүгд
            </button>
            <button
              type="button"
              onClick={() => setMetricFilter('views')}
              className={`px-2 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                metricFilter === 'views'
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                  : 'text-brand-text-dark hover:text-white'
              }`}
            >
              Үзэлт
            </button>
            <button
              type="button"
              onClick={() => setMetricFilter('likes')}
              className={`px-2 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                metricFilter === 'likes'
                  ? 'bg-pink-500/20 text-pink-400 border border-pink-500/40'
                  : 'text-brand-text-dark hover:text-white'
              }`}
            >
              Likes
            </button>
          </div>
        </div>
      </div>

      {/* Main Chart Card */}
      <div className="bg-[#0e1015]/90 border border-cyan-500/20 rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden backdrop-blur-md">
        {/* Subtle decorative glow background */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-brand-accent/5 rounded-full blur-3xl pointer-events-none" />

        {/* Quick Summary Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <div className="bg-[#141720] border border-cyan-500/10 rounded-xl p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 shrink-0">
              <Eye className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-brand-text-dark font-medium uppercase tracking-wider">Нийт үзэлт</p>
              <p className="text-sm sm:text-base font-extrabold text-cyan-400 font-mono truncate">
                {totalViews.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="bg-[#141720] border border-pink-500/10 rounded-xl p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-pink-500/10 text-pink-400 shrink-0">
              <Heart className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-brand-text-dark font-medium uppercase tracking-wider">Нийт Like</p>
              <p className="text-sm sm:text-base font-extrabold text-pink-400 font-mono truncate">
                {totalLikes.toLocaleString()}
              </p>
            </div>
          </div>

          {topManga && (
            <div
              onClick={() => onSelectManga?.(topManga.rawManga)}
              className="bg-[#141720] border border-amber-500/20 rounded-xl p-3 flex items-center gap-3 col-span-2 sm:col-span-1 cursor-pointer hover:border-amber-500/50 transition-all group"
            >
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 shrink-0">
                <Sparkles className="w-4 h-4 group-hover:rotate-12 transition-transform" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-amber-400/80 font-bold uppercase tracking-wider">#1 Тэргүүлэгч</p>
                <p className="text-xs sm:text-sm font-extrabold text-white truncate group-hover:text-amber-300 transition-colors">
                  {topManga.fullTitle}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Recharts Render Container */}
        <div className="h-64 sm:h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'bar' ? (
              <BarChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 25 }}
              >
                <defs>
                  <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#0891b2" stopOpacity={0.4} />
                  </linearGradient>
                  <linearGradient id="likesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ec4899" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#be185d" stopOpacity={0.4} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#262b36" vertical={false} />
                <XAxis
                  dataKey="title"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-[#12151d]/95 border border-cyan-500/30 rounded-xl p-3 shadow-2xl backdrop-blur-md max-w-xs">
                          <p className="font-extrabold text-xs text-white mb-2 pb-1 border-b border-white/10">
                            {data.fullTitle}
                          </p>
                          <div className="space-y-1 text-xs font-mono">
                            {(metricFilter === 'all' || metricFilter === 'views') && (
                              <div className="flex items-center justify-between gap-4 text-cyan-400">
                                <span className="flex items-center gap-1 font-sans text-brand-text-dark">
                                  <Eye className="w-3 h-3" /> Үзэлт:
                                </span>
                                <span className="font-bold">{data.views.toLocaleString()}</span>
                              </div>
                            )}
                            {(metricFilter === 'all' || metricFilter === 'likes') && (
                              <div className="flex items-center justify-between gap-4 text-pink-400">
                                <span className="flex items-center gap-1 font-sans text-brand-text-dark">
                                  <Heart className="w-3 h-3" /> Таалагдсан:
                                </span>
                                <span className="font-bold">{data.likes.toLocaleString()}</span>
                              </div>
                            )}
                          </div>
                          {onSelectManga && (
                            <p className="mt-2 text-[10px] text-cyan-300 italic font-sans">
                              Дэлгэрэнгүй үзэхийн тулд дараарай
                            </p>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend
                  wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }}
                  formatter={(value) => (
                    <span className="text-brand-text-dark text-xs font-semibold">{value}</span>
                  )}
                />
                {(metricFilter === 'all' || metricFilter === 'views') && (
                  <Bar
                    dataKey="views"
                    name="Үзэлт"
                    fill="url(#viewsGradient)"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={40}
                    cursor={onSelectManga ? 'pointer' : 'default'}
                    onClick={(entry) => onSelectManga?.(entry.rawManga)}
                  />
                )}
                {(metricFilter === 'all' || metricFilter === 'likes') && (
                  <Bar
                    dataKey="likes"
                    name="Таалагдсан"
                    fill="url(#likesGradient)"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={40}
                    cursor={onSelectManga ? 'pointer' : 'default'}
                    onClick={(entry) => onSelectManga?.(entry.rawManga)}
                  />
                )}
              </BarChart>
            ) : (
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 25 }}
              >
                <defs>
                  <linearGradient id="areaViews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="areaLikes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ec4899" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#262b36" vertical={false} />
                <XAxis
                  dataKey="title"
                  stroke="#64748b"
                  fontSize={11}
                  tickLine={false}
                  interval={0}
                  angle={-15}
                  textAnchor="end"
                />
                <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-[#12151d]/95 border border-cyan-500/30 rounded-xl p-3 shadow-2xl backdrop-blur-md max-w-xs">
                          <p className="font-extrabold text-xs text-white mb-2 pb-1 border-b border-white/10">
                            {data.fullTitle}
                          </p>
                          <div className="space-y-1 text-xs font-mono">
                            {(metricFilter === 'all' || metricFilter === 'views') && (
                              <div className="flex items-center justify-between gap-4 text-cyan-400">
                                <span className="flex items-center gap-1 font-sans text-brand-text-dark">
                                  <Eye className="w-3 h-3" /> Үзэлт:
                                </span>
                                <span className="font-bold">{data.views.toLocaleString()}</span>
                              </div>
                            )}
                            {(metricFilter === 'all' || metricFilter === 'likes') && (
                              <div className="flex items-center justify-between gap-4 text-pink-400">
                                <span className="flex items-center gap-1 font-sans text-brand-text-dark">
                                  <Heart className="w-3 h-3" /> Таалагдсан:
                                </span>
                                <span className="font-bold">{data.likes.toLocaleString()}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend
                  wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }}
                  formatter={(value) => (
                    <span className="text-brand-text-dark text-xs font-semibold">{value}</span>
                  )}
                />
                {(metricFilter === 'all' || metricFilter === 'views') && (
                  <Area
                    type="monotone"
                    dataKey="views"
                    name="Үзэлт"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#areaViews)"
                  />
                )}
                {(metricFilter === 'all' || metricFilter === 'likes') && (
                  <Area
                    type="monotone"
                    dataKey="likes"
                    name="Таалагдсан"
                    stroke="#ec4899"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#areaLikes)"
                  />
                )}
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
