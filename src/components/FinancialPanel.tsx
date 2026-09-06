import React, { useState, useEffect, useMemo } from 'react';
import { Chapter, Employee, SalaryConfig, Manga, User } from '../types';
import { Wallet, Settings, Calendar, Calculator, Sparkles, Check, TrendingUp, ChevronDown, ChevronUp, Clock, BookOpen, Briefcase, UserPlus, Trash2, Users, ShieldCheck } from 'lucide-react';

interface FinancialPanelProps {
  chapters: Chapter[];
  employees: Employee[];
  mangas: Manga[];
  salaryConfig: SalaryConfig;
  onUpdateConfig: (config: SalaryConfig) => void;
  onUpdateEmployees?: (employees: Employee[]) => void;
  users?: User[];
}

interface WorkerPayrollResult {
  employeeName: string;
  translatorCount: number;
  editorCount: number;
  typesetterCount: number;
  totalChapters: number;
  totalSalary: number;
}

export default function FinancialPanel({
  chapters,
  employees,
  mangas,
  salaryConfig,
  onUpdateConfig,
  onUpdateEmployees,
  users = []
}: FinancialPanelProps) {
  // Config state
  const [translatorRate, setTranslatorRate] = useState(salaryConfig.translatorRate);
  const [editorRate, setEditorRate] = useState(salaryConfig.editorRate);
  const [typesetterRate, setTypesetterRate] = useState(salaryConfig.typesetterRate);
  const [isConfigSaved, setIsConfigSaved] = useState(false);

  // New employee state
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpRole, setNewEmpRole] = useState<'translator' | 'editor' | 'typesetter' | 'all'>('translator');

  // Expanded employee detail tracker
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);

  const [removedStaffNames, setRemovedStaffNames] = useState<string[]>([]);

  // Combined staff members: Admins/SuperAdmins + Custom Employees
  const allStaffMembers = useMemo(() => {
    const list: { id: string; name: string; roleDisplay: string; isSystemAdmin?: boolean; canDelete: boolean }[] = [];
    const addedNames = new Set<string>();

    // 1. Add employees from managed list
    (employees || []).forEach(emp => {
      if (emp.name) {
        const trimmed = emp.name.trim();
        const lower = trimmed.toLowerCase();
        if (!addedNames.has(lower) && !removedStaffNames.includes(lower)) {
          list.push({
            id: emp.id,
            name: trimmed,
            roleDisplay: emp.role === 'translator' ? 'Орчуулагч' : emp.role === 'editor' ? 'Эдитор' : emp.role === 'typesetter' ? 'Өрөгч' : 'Багийн гишүүн',
            isSystemAdmin: false,
            canDelete: true
          });
          addedNames.add(lower);
        }
      }
    });

    // 2. Add registered admins and super admins if not present
    (users || []).forEach(u => {
      const uName = (u as any).name || u.username;
      if ((u.role === 'admin' || u.role === 'super_admin') && uName) {
        const trimmed = uName.trim();
        const lower = trimmed.toLowerCase();
        if (!addedNames.has(lower) && !removedStaffNames.includes(lower)) {
          list.push({
            id: 'user_' + u.id,
            name: trimmed,
            roleDisplay: u.role === 'super_admin' ? 'Ерөнхий админ' : 'Админ',
            isSystemAdmin: true,
            canDelete: true
          });
          addedNames.add(lower);
        }
      }
    });

    return list;
  }, [users, employees, removedStaffNames]);

  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpName.trim()) return;
    const nameTrimmed = newEmpName.trim();
    setRemovedStaffNames(prev => prev.filter(n => n !== nameTrimmed.toLowerCase()));

    const newEmp: Employee = {
      id: 'emp_' + Date.now(),
      name: nameTrimmed,
      role: newEmpRole
    };
    const updated = [...employees.filter(e => e.name.toLowerCase() !== nameTrimmed.toLowerCase()), newEmp];
    if (onUpdateEmployees) {
      onUpdateEmployees(updated);
    }
    setNewEmpName('');
  };

  const handleDeleteEmployee = (id: string, name: string) => {
    const updated = employees.filter(e => e.id !== id && e.name.toLowerCase() !== name.toLowerCase());
    if (onUpdateEmployees) {
      onUpdateEmployees(updated);
    }
    setRemovedStaffNames(prev => [...prev, name.toLowerCase()]);
  };

  // Date range state - initialize to current month or full year range
  const todayStr = new Date().toISOString().split('T')[0];
  const firstDayOfMonthStr = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
  
  const [startDate, setStartDate] = useState(firstDayOfMonthStr || '2026-07-01');
  const [endDate, setEndDate] = useState(todayStr || '2026-07-31');
  const [payrollResults, setPayrollResults] = useState<WorkerPayrollResult[]>([]);

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateConfig({
      translatorRate: Number(translatorRate),
      editorRate: Number(editorRate),
      typesetterRate: Number(typesetterRate)
    });
    setIsConfigSaved(true);
    setTimeout(() => setIsConfigSaved(false), 2000);
  };

  // Auto-calculate payroll whenever date range, chapters, staff, or rate settings change
  useEffect(() => {
    if (!startDate || !endDate) return;

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    if (start > end) return;

    // Filter chapters created within date range
    const filteredChapters = chapters.filter(ch => {
      const chDate = new Date(ch.createdAt);
      return chDate >= start && chDate <= end;
    });

    // Compute payroll for each staff member
    const results: WorkerPayrollResult[] = allStaffMembers.map(emp => {
      const empLower = emp.name.toLowerCase().trim();
      const translatorCount = filteredChapters.filter(ch => ch.translator && ch.translator.toLowerCase().trim() === empLower).length;
      const editorCount = filteredChapters.filter(ch => ch.editor && ch.editor.toLowerCase().trim() === empLower).length;
      const typesetterCount = filteredChapters.filter(ch => ch.typesetter && ch.typesetter.toLowerCase().trim() === empLower).length;

      const totalSalary =
        translatorCount * salaryConfig.translatorRate +
        editorCount * salaryConfig.editorRate +
        typesetterCount * salaryConfig.typesetterRate;

      const totalChapters = translatorCount + editorCount + typesetterCount;

      return {
        employeeName: emp.name,
        translatorCount,
        editorCount,
        typesetterCount,
        totalChapters,
        totalSalary
      };
    }).filter(r => r.totalChapters > 0);

    setPayrollResults(results);
  }, [startDate, endDate, chapters, allStaffMembers, salaryConfig]);

  const handleCalculatePayroll = () => {
    // Manual trigger button refresh feedback
    if (!startDate || !endDate) {
      alert('Эхлэх болон дуусах хугацааг сонгоно уу.');
      return;
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('mn-MN', { style: 'currency', currency: 'MNT', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div id="financial-panel" className="max-w-4xl mx-auto px-4 py-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="border-b border-brand-accent/15 pb-6">
        <h2 className="text-2xl font-display font-extrabold text-brand-accent glow-text uppercase flex items-center gap-2">
          <Wallet className="w-6 h-6 animate-bounce" />
          Санхүү & Цалин Бодолт
        </h2>
        <p className="text-sm text-brand-text-dark mt-1">
          Зөвхөн Ерөнхий Админд харагдах ажилчдын цалингийн систем болон тохиргоо.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Config rates */}
        <div className="lg:col-span-1 bg-brand-card border border-brand-accent/10 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-display font-bold text-brand-text uppercase flex items-center gap-2 border-b border-brand-accent/5 pb-2">
            <Settings className="w-4 h-4 text-brand-accent" />
            Үнэлгээний тохиргоо
          </h3>

          {isConfigSaved && (
            <div className="p-2 bg-emerald-950/40 border border-emerald-500/30 rounded-lg text-emerald-300 text-xs flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Амжилттай хадгалагдлаа!</span>
            </div>
          )}

          <form onSubmit={handleSaveConfig} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-brand-text-dark mb-1">
                Орчуулах суурь үнэлгээ (1 бүлэг)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={translatorRate}
                  onChange={(e) => setTranslatorRate(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-brand-bg border border-brand-accent/20 rounded-lg text-xs text-brand-text focus:outline-none focus:border-brand-accent"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-brand-accent font-semibold">MNT</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-brand-text-dark mb-1">
                Эдитлэх суурь үнэлгээ (1 бүлэг)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={editorRate}
                  onChange={(e) => setEditorRate(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-brand-bg border border-brand-accent/20 rounded-lg text-xs text-brand-text focus:outline-none focus:border-brand-accent"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-brand-accent font-semibold">MNT</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-brand-text-dark mb-1">
                Өрөх суурь үнэлгээ (1 бүлэг)
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={typesetterRate}
                  onChange={(e) => setTypesetterRate(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-brand-bg border border-brand-accent/20 rounded-lg text-xs text-brand-text focus:outline-none focus:border-brand-accent"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-brand-accent font-semibold">MNT</span>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-brand-accent hover:bg-brand-accent-hover text-brand-bg font-display font-semibold rounded-lg text-xs uppercase tracking-wider transition-all cursor-pointer"
            >
              Үнэлгээ шинэчлэх
            </button>
          </form>

          {/* Employee / Staff Management */}
          <div className="pt-4 border-t border-brand-accent/10 space-y-4">
            <h3 className="text-sm font-display font-bold text-brand-text uppercase flex items-center gap-2">
              <Users className="w-4 h-4 text-brand-accent" />
              Багийн ажилчид удирдах
            </h3>

            <form onSubmit={handleAddEmployee} className="space-y-2">
              <input
                type="text"
                placeholder="Ажилчны нэр..."
                value={newEmpName}
                onChange={(e) => setNewEmpName(e.target.value)}
                className="w-full px-3 py-2 bg-brand-bg border border-brand-accent/20 rounded-lg text-xs text-brand-text focus:outline-none focus:border-brand-accent"
              />
              <div className="flex gap-2">
                <select
                  value={newEmpRole}
                  onChange={(e) => setNewEmpRole(e.target.value as any)}
                  className="flex-grow px-2 py-1.5 bg-brand-bg border border-brand-accent/20 rounded-lg text-xs text-brand-text focus:outline-none"
                >
                  <option value="translator">Орчуулагч</option>
                  <option value="editor">Эдитор</option>
                  <option value="typesetter">Өрөгч</option>
                  <option value="all">Бүгд</option>
                </select>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-brand-accent text-brand-bg font-bold text-xs rounded-lg hover:opacity-90 flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Нэмэх
                </button>
              </div>
            </form>

            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {allStaffMembers.map(emp => (
                <div key={emp.id} className="flex items-center justify-between p-2 bg-brand-bg/60 border border-brand-accent/10 rounded-lg text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {emp.isSystemAdmin && <ShieldCheck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                    <span className="font-semibold text-brand-text truncate">{emp.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] uppercase font-mono px-1.5 py-0.5 rounded font-bold ${
                      emp.isSystemAdmin
                        ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/30'
                        : 'bg-brand-accent/10 text-brand-accent'
                    }`}>
                      {emp.roleDisplay}
                    </span>
                    {emp.canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDeleteEmployee(emp.id, emp.name)}
                        className="text-red-400 hover:text-red-300 p-1 cursor-pointer"
                        title="Устгах"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Calculator panel */}
        <div className="lg:col-span-2 bg-brand-card border border-brand-accent/10 rounded-2xl p-6 space-y-6">
          <h3 className="text-sm font-display font-bold text-brand-text uppercase flex items-center gap-2 border-b border-brand-accent/5 pb-2">
            <Calculator className="w-4 h-4 text-brand-accent" />
            Цалингийн автомат тооцоолуур
          </h3>

          {/* Date Picker inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-brand-text-dark mb-1.5">
                Эхлэх хугацаа
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2.5 bg-brand-bg border border-brand-accent/20 rounded-lg text-xs text-brand-text focus:outline-none focus:border-brand-accent font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-brand-text-dark mb-1.5">
                Дуусах хугацаа
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2.5 bg-brand-bg border border-brand-accent/20 rounded-lg text-xs text-brand-text focus:outline-none focus:border-brand-accent font-mono"
                />
              </div>
            </div>
          </div>

          <button
            id="calculate-salary-btn"
            onClick={handleCalculatePayroll}
            className="w-full py-3 bg-brand-accent hover:bg-brand-accent-hover text-brand-bg font-display font-extrabold rounded-xl text-sm uppercase tracking-wider shadow-lg shadow-brand-accent/20 hover:shadow-brand-accent/35 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>БОДОХ (Цалин тооцоолох)</span>
          </button>

          {/* Calculations Result (Auto-updated live on date range selection) */}
          {true && (
            <div className="space-y-4 pt-4 border-t border-brand-accent/5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-display font-bold text-brand-text uppercase tracking-wider">
                  Бодогдсон үр дүнгүүд
                </h4>
                <div className="flex items-center gap-1 text-[11px] text-brand-accent font-mono">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>{payrollResults.length} ажилтан олдлоо</span>
                </div>
              </div>

              {payrollResults.length === 0 ? (
                <div className="py-8 bg-brand-bg/40 border border-brand-accent/5 rounded-xl text-center">
                  <p className="text-xs text-brand-text-dark">Тухайн сонгосон хугацаанд ажилласан ажилтан олдсонгүй.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {payrollResults.map((result, idx) => {
                    const isExpanded = expandedEmployee === result.employeeName;
                    
                    const start = new Date(startDate);
                    const end = new Date(endDate);
                    end.setHours(23, 59, 59, 999);
                    
                    // Retrieve exact chapters worked on by this employee in the range
                    const empChapters = chapters.filter(ch => {
                      const chDate = new Date(ch.createdAt);
                      const isWithinDate = chDate >= start && chDate <= end;
                      const hasWorked = ch.translator === result.employeeName || 
                                        ch.editor === result.employeeName || 
                                        ch.typesetter === result.employeeName;
                      return isWithinDate && hasWorked;
                    });

                    return (
                      <div
                        key={idx}
                        className="bg-brand-bg/60 border border-brand-accent/10 rounded-2xl overflow-hidden hover:border-brand-accent/25 transition-all"
                      >
                        <div
                          onClick={() => setExpandedEmployee(isExpanded ? null : result.employeeName)}
                          className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer select-none"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <h5 className="font-display font-bold text-brand-text text-sm">{result.employeeName}</h5>
                              <span className="text-[9px] bg-brand-accent/10 text-brand-accent font-semibold px-1.5 py-0.5 rounded font-mono uppercase tracking-wider">
                                Ажилтан
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-[10px] text-brand-text-dark font-mono">
                              <span>Орчуулга: <strong className="text-brand-ice">{result.translatorCount}</strong></span>
                              <span>Эдит: <strong className="text-brand-ice">{result.editorCount}</strong></span>
                              <span>Өрөлт: <strong className="text-brand-ice">{result.typesetterCount}</strong></span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 border-brand-accent/5 pt-2 md:pt-0">
                            <div className="text-left md:text-right font-mono">
                              <p className="text-[10px] text-brand-text-dark uppercase">Нийт ажилласан бүлэг</p>
                              <p className="text-xs font-bold text-brand-text">{result.totalChapters} бүлэг</p>
                            </div>
                            <div className="text-right font-mono">
                              <p className="text-[10px] text-brand-accent uppercase font-bold">Авах нийт цалин</p>
                              <p className="text-sm font-extrabold text-brand-accent glow-text">{formatCurrency(result.totalSalary)}</p>
                            </div>
                            <div className="text-brand-text-dark hover:text-brand-accent transition-colors">
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </div>
                          </div>
                        </div>

                        {/* Expanded Work Logs (Only visible to the super_admin / general admin) */}
                        {isExpanded && (
                          <div className="bg-brand-bg/35 border-t border-brand-accent/10 p-4 space-y-3 animate-fade-in text-xs">
                            <p className="text-[10px] text-brand-accent uppercase font-extrabold tracking-wider flex items-center gap-1.5">
                              <Briefcase className="w-3.5 h-3.5" />
                              {result.employeeName}-ий хийсэн ажлуудын нарийвчилсан түүх:
                            </p>
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                              {empChapters.map((ch, cIdx) => {
                                const isTrans = ch.translator === result.employeeName;
                                const isEdit = ch.editor === result.employeeName;
                                const isType = ch.typesetter === result.employeeName;
                                
                                const chManga = mangas.find(m => m.id === ch.mangaId);
                                
                                return (
                                  <div key={cIdx} className="p-3 bg-brand-card/50 border border-brand-accent/5 rounded-lg flex items-center justify-between gap-4">
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-brand-text font-bold font-display">{chManga ? chManga.title : 'Манга'}</span>
                                        <span className="text-brand-accent font-semibold font-mono">{ch.title}</span>
                                      </div>
                                      <div className="flex items-center gap-3 text-[10px] text-brand-text-dark font-mono">
                                        <span className="flex items-center gap-1">
                                          <Clock className="w-3 h-3 text-brand-text-dark" />
                                          {new Date(ch.createdAt).toLocaleDateString('mn-MN')} {new Date(ch.createdAt).toLocaleTimeString('mn-MN', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="flex flex-col items-end gap-1 font-mono">
                                      <div className="flex flex-wrap gap-1 justify-end">
                                        {isTrans && (
                                          <span className="px-1.5 py-0.5 bg-sky-950/40 text-sky-400 border border-sky-500/20 rounded text-[9px] uppercase font-semibold">
                                            Орчуулга ({formatCurrency(salaryConfig.translatorRate)})
                                          </span>
                                        )}
                                        {isEdit && (
                                          <span className="px-1.5 py-0.5 bg-emerald-950/40 text-emerald-400 border border-emerald-500/20 rounded text-[9px] uppercase font-semibold">
                                            Эдит ({formatCurrency(salaryConfig.editorRate)})
                                          </span>
                                        )}
                                        {isType && (
                                          <span className="px-1.5 py-0.5 bg-purple-950/40 text-purple-400 border border-purple-500/20 rounded text-[9px] uppercase font-semibold">
                                            Өрөлт ({formatCurrency(salaryConfig.typesetterRate)})
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-brand-accent font-extrabold text-[11px]">
                                        +{formatCurrency(
                                          (isTrans ? salaryConfig.translatorRate : 0) +
                                          (isEdit ? salaryConfig.editorRate : 0) +
                                          (isType ? salaryConfig.typesetterRate : 0)
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
