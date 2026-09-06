import React, { useState } from 'react';
import { User, VipRequest } from '../types';
import { Award, UploadCloud, CheckCircle, Search, ShieldAlert, FileText, Check, X, Sparkles, Settings, DollarSign, Eye, ZoomIn, ZoomOut, RotateCw, Maximize2, Trash2, CheckSquare, Square, RefreshCw } from 'lucide-react';
import { uploadSingleImageToCloud, compressImageFile } from '../utils/imageUpload';

export interface VipPlan {
  id: string;
  label: string;
  price: number;
  desc: string;
}

export interface BankConfig {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  instructions: string;
}

interface VipPanelProps {
  currentUser: User | null;
  vipRequests: VipRequest[];
  allUsers: User[];
  vipPlans: VipPlan[];
  bankConfig?: BankConfig;
  onAddVipRequest: (durationText: string, fileName: string, receiptImage?: string) => void;
  onApproveVipRequest: (requestId: string) => void;
  onRejectVipRequest: (requestId: string) => void;
  onDeleteVipRequests?: (requestIds: string[]) => void;
  onDirectVipGrant: (userId: string, durationText: string) => void;
  onUpdateVipPlans: (updatedPlans: VipPlan[]) => void;
  onUpdateBankConfig?: (updatedBank: BankConfig) => void;
}

export default function VipPanel({
  currentUser,
  vipRequests,
  allUsers,
  vipPlans,
  bankConfig,
  onAddVipRequest,
  onApproveVipRequest,
  onRejectVipRequest,
  onDeleteVipRequests,
  onDirectVipGrant,
  onUpdateVipPlans,
  onUpdateBankConfig
}: VipPanelProps) {
  // Reader Form state
  const [selectedDuration, setSelectedDuration] = useState('1m');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [mockFileName, setMockFileName] = useState('');
  const [receiptBase64, setReceiptBase64] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [requestSuccess, setRequestSuccess] = useState(false);

  // Super Admin direct grant state
  const [searchId, setSearchId] = useState('');
  const [foundUser, setFoundUser] = useState<User | null>(null);
  const [directDuration, setDirectDuration] = useState('1m');
  const [grantSuccess, setGrantSuccess] = useState('');
  const [expandedReceiptId, setExpandedReceiptId] = useState<string | null>(null);

  // Super Admin Price Editing state
  const [isEditingPrices, setIsEditingPrices] = useState(false);

  // Admin Receipt Zoom Modal state
  const [zoomModalRequest, setZoomModalRequest] = useState<VipRequest | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomRotate, setZoomRotate] = useState(0);

  // Reader History Selection state
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<string[]>([]);

  const handleOpenZoomModal = (req: VipRequest) => {
    setZoomModalRequest(req);
    setZoomScale(1);
    setZoomRotate(0);
  };

  const handleZoomIn = () => setZoomScale(prev => Math.min(4, +(prev + 0.25).toFixed(2)));
  const handleZoomOut = () => setZoomScale(prev => Math.max(0.4, +(prev - 0.25).toFixed(2)));
  const handleRotate = () => setZoomRotate(prev => (prev + 90) % 360);
  const handleResetZoom = () => {
    setZoomScale(1);
    setZoomRotate(0);
  };

  const userHistoryRequests = vipRequests.filter(
    r => (currentUser?.email && r.userEmail === currentUser.email) || (currentUser?.id && r.userId === currentUser.id)
  );

  const handleToggleSelectHistory = (id: string) => {
    setSelectedHistoryIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAllHistory = () => {
    if (selectedHistoryIds.length === userHistoryRequests.length) {
      setSelectedHistoryIds([]);
    } else {
      setSelectedHistoryIds(userHistoryRequests.map(r => r.id));
    }
  };

  const handleDeleteSelectedHistory = () => {
    if (selectedHistoryIds.length === 0) return;
    if (window.confirm(`Сонгосон ${selectedHistoryIds.length} хүсэлтийн түүхийг устгах уу?`)) {
      if (onDeleteVipRequests) {
        onDeleteVipRequests(selectedHistoryIds);
      }
      setSelectedHistoryIds([]);
    }
  };

  const handleDeleteSingleHistory = (id: string) => {
    if (window.confirm('Энэ хүсэлтийн түүхийг устгах уу?')) {
      if (onDeleteVipRequests) {
        onDeleteVipRequests([id]);
      }
      setSelectedHistoryIds(prev => prev.filter(item => item !== id));
    }
  };

  // Super Admin Bank Config state
  const [bankName, setBankName] = useState(bankConfig?.bankName || 'Хаан Банк');
  const [accountNumber, setAccountNumber] = useState(bankConfig?.accountNumber || '5041234567');
  const [accountHolder, setAccountHolder] = useState(bankConfig?.accountHolder || 'Аяко');
  const [bankInstructions, setBankInstructions] = useState(bankConfig?.instructions || 'Шилжүүлгийн утга дээр өөрийн ID код эсвэл Gmail хаягийг заавал бичнэ үү!');

  React.useEffect(() => {
    if (bankConfig) {
      setBankName(bankConfig.bankName || 'Хаан Банк');
      setAccountNumber(bankConfig.accountNumber || '5041234567');
      setAccountHolder(bankConfig.accountHolder || 'Аяко');
      setBankInstructions(bankConfig.instructions || 'Шилжүүлгийн утга дээр өөрийн ID код эсвэл Gmail хаягийг заавал бичнэ үү!');
    }
  }, [bankConfig]);
  const [priceEdits, setPriceEdits] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    vipPlans.forEach(p => {
      initial[p.id] = p.price;
    });
    return initial;
  });
  const [priceSaveSuccess, setPriceSaveSuccess] = useState(false);

  // Sync state if vipPlans change
  React.useEffect(() => {
    const updated: Record<string, number> = {};
    vipPlans.forEach(p => {
      updated[p.id] = p.price;
    });
    setPriceEdits(updated);
  }, [vipPlans]);

  // Helper to convert selected file to compressed url or cloud url
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);

  const processFile = async (file: File) => {
    setReceiptFile(file);
    setMockFileName(file.name);
    setIsUploadingReceipt(true);
    try {
      // 1. Instant local base64 compressed fallback so receipt is never empty
      const localBase64 = await compressImageFile(file, 800, 1200, 0.75);
      setReceiptBase64(localBase64);

      // 2. Persistent Cloud upload
      const cloudUrl = await uploadSingleImageToCloud(file);
      if (cloudUrl && cloudUrl.startsWith('http')) {
        setReceiptBase64(cloudUrl);
      }
    } catch (err) {
      console.warn("Vip receipt upload fallback warning:", err);
    } finally {
      setIsUploadingReceipt(false);
    }
  };

  // Reader file handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleSubmitRequest = (e: React.FormEvent) => {
    e.preventDefault();
    
    const durationLabel = vipPlans.find(d => d.id === selectedDuration)?.label || '1 сар';
    onAddVipRequest(durationLabel, mockFileName || 'Screenshot', receiptBase64 || undefined);
    setRequestSuccess(true);
    setReceiptFile(null);
    setMockFileName('');
    setReceiptBase64('');

    setTimeout(() => setRequestSuccess(false), 3000);
  };

  // Direct ID search and grant
  const handleIdSearch = () => {
    if (searchId.length !== 8) {
      alert('ID код нь заавал 8 оронтой байна.');
      return;
    }
    const user = allUsers.find(u => u.id === searchId);
    if (user) {
      setFoundUser(user);
    } else {
      alert('Уучлаарай, ийм ID-тай хэрэглэгч олдсонгүй.');
      setFoundUser(null);
    }
  };

  const handleDirectGrantSubmit = () => {
    if (!foundUser) return;
    const durationLabel = vipPlans.find(d => d.id === directDuration)?.label || '1 сар';
    onDirectVipGrant(foundUser.id, durationLabel);
    setGrantSuccess(`"${foundUser.username}" хэрэглэгчид ${durationLabel} хугацаатай VIP эрхийг шууд олголоо.`);
    setSearchId('');
    setFoundUser(null);

    setTimeout(() => setGrantSuccess(''), 4000);
  };

  const isUserVip = (user: User | null) => {
    if (!user) return false;
    if (user.role === 'super_admin' || user.role === 'admin') return true;
    if (!user.vipUntil) return false;
    return new Date(user.vipUntil) > new Date();
  };

  // Price Edit handlers
  const handlePriceChange = (id: string, value: string) => {
    const numValue = parseInt(value.replace(/\D/g, '')) || 0;
    setPriceEdits(prev => ({
      ...prev,
      [id]: numValue
    }));
  };

  const handleSavePrices = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedPlans = vipPlans.map(plan => ({
      ...plan,
      price: priceEdits[plan.id] !== undefined ? priceEdits[plan.id] : plan.price
    }));
    onUpdateVipPlans(updatedPlans);
    setPriceSaveSuccess(true);
    setIsEditingPrices(false);
    setTimeout(() => setPriceSaveSuccess(false), 3000);
  };

  return (
    <div id="vip-panel-view" className="max-w-4xl mx-auto px-4 py-8 space-y-8 animate-fade-in">
      {/* Header */}
      <div className="border-b border-brand-accent/15 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-extrabold text-brand-accent glow-text uppercase flex items-center gap-2">
            <Award className="w-6 h-6 text-brand-accent" />
            VIP Эрх ба Статус удирдах хэсэг
          </h2>
          <p className="text-sm text-brand-text-dark mt-1">
            Манга уншигчид VIP эрх авах хүсэлт илгээх болон Ерөнхий админ үнийн мэдээлэл засах, хүсэлт баталгаажуулах хэсэг.
          </p>
        </div>

        {currentUser?.role === 'super_admin' && (
          <button
            onClick={() => setIsEditingPrices(!isEditingPrices)}
            className="px-4 py-2 bg-brand-bg hover:bg-brand-card-light border border-brand-accent/20 hover:border-brand-accent rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer"
          >
            <Settings className="w-4 h-4 text-brand-accent" />
            <span>{isEditingPrices ? 'Буцах' : 'Үнэ өөрчлөх'}</span>
          </button>
        )}
      </div>

      {priceSaveSuccess && (
        <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>VIP багцуудын үнийн мэдээлэл амжилттай хадгалагдлаа!</span>
        </div>
      )}

      {currentUser?.role === 'super_admin' && isEditingPrices ? (
        /* SUPER ADMIN VIP PRICE EDITOR VIEW */
        <div className="bg-brand-card border border-brand-accent/20 rounded-3xl p-6 md:p-8 space-y-6 shadow-xl animate-fade-in">
          <div>
            <h3 className="text-base font-display font-bold text-brand-accent flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              VIP БАГЦЫН ҮНИЙН МЭДЭЭЛЭЛ ӨӨРЧЛӨХ
            </h3>
            <p className="text-xs text-brand-text-dark mt-1">
              Эндээс багцуудын үнийг засварлан хадгалснаар бүх уншигчдад шинэчлэгдсэн үнийн дүн харагдах болно.
            </p>
          </div>

          <form onSubmit={handleSavePrices} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {vipPlans.map((plan) => (
                <div key={plan.id} className="p-4 bg-brand-bg/60 border border-brand-accent/10 rounded-xl space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-brand-text uppercase">{plan.label}</span>
                    <span className="text-[10px] text-brand-text-dark font-mono italic">{plan.desc}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={priceEdits[plan.id] !== undefined ? priceEdits[plan.id] : plan.price}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setPriceEdits(prev => ({ ...prev, [plan.id]: val }));
                      }}
                      className="flex-grow px-3 py-2 bg-brand-bg border border-brand-accent/20 focus:border-brand-accent rounded-lg text-sm text-brand-accent font-semibold focus:outline-none font-mono"
                    />
                    <span className="text-sm text-brand-text-dark font-bold font-mono shrink-0">₮</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Bank account configuration for Super Admin */}
            <div className="pt-4 border-t border-brand-accent/10 space-y-3">
              <h4 className="text-xs font-bold text-brand-accent uppercase tracking-wider">Банкны дансны мэдээлэл өөрчлөх</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] text-brand-text-dark font-semibold mb-1">Банкны нэр</label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="Хаан Банк"
                    className="w-full px-3 py-1.5 bg-brand-bg border border-brand-accent/20 rounded-lg text-xs text-brand-text font-semibold focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-brand-text-dark font-semibold mb-1">Дансны дугаар</label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="5041234567"
                    className="w-full px-3 py-1.5 bg-brand-bg border border-brand-accent/20 rounded-lg text-xs text-brand-accent font-bold font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-brand-text-dark font-semibold mb-1">Дансны эзэмшигч</label>
                  <input
                    type="text"
                    value={accountHolder}
                    onChange={(e) => setAccountHolder(e.target.value)}
                    placeholder="Аяко"
                    className="w-full px-3 py-1.5 bg-brand-bg border border-brand-accent/20 rounded-lg text-xs text-brand-text font-semibold focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-brand-text-dark font-semibold mb-1">Заавар санамж</label>
                <input
                  type="text"
                  value={bankInstructions}
                  onChange={(e) => setBankInstructions(e.target.value)}
                  className="w-full px-3 py-1.5 bg-brand-bg border border-brand-accent/20 rounded-lg text-xs text-brand-text focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t border-brand-accent/10">
              <button
                type="button"
                onClick={() => setIsEditingPrices(false)}
                className="px-5 py-2.5 bg-brand-bg border border-brand-accent/10 rounded-xl text-xs font-semibold text-brand-text-dark hover:text-brand-text transition-all cursor-pointer"
              >
                Цуцлах
              </button>
              <button
                type="submit"
                onClick={() => {
                  if (onUpdateBankConfig) {
                    onUpdateBankConfig({
                      bankName: bankName.trim(),
                      accountNumber: accountNumber.trim(),
                      accountHolder: accountHolder.trim(),
                      instructions: bankInstructions.trim()
                    });
                  }
                }}
                className="px-6 py-2.5 bg-brand-accent hover:bg-brand-accent-hover text-brand-bg font-display font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md shadow-brand-accent/25"
              >
                Хадгалах
              </button>
            </div>
          </form>
        </div>
      ) : currentUser?.role === 'super_admin' ? (
        /* SUPER ADMIN MULTI-PATH VIP MANAGER SCREEN */
        <div className="space-y-8 animate-fade-in">
          {/* Direct ID search and grant panel - styled cleanly without excess borders or oversized text */}
          <div className="bg-brand-card/30 border border-brand-accent/5 rounded-2xl p-5 space-y-4 shadow-sm max-w-full">
            <h3 className="text-xs font-sans font-bold text-brand-text uppercase flex items-center gap-2 border-b border-brand-accent/5 pb-2">
              <Search className="w-3.5 h-3.5 text-brand-accent" />
              ID Кодоор хайж шууд VIP эрх олгох
            </h3>

            {grantSuccess && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{grantSuccess}</span>
              </div>
            )}

            <div className="flex gap-2 max-w-md">
              <input
                type="text"
                maxLength={8}
                value={searchId}
                onChange={(e) => setSearchId(e.target.value.replace(/\D/g, ''))}
                placeholder="8 оронтой ID бичнэ үү..."
                className="flex-grow px-3 py-1.5 bg-brand-bg border border-brand-accent/15 rounded-lg text-xs text-brand-text font-mono focus:outline-none focus:border-brand-accent"
              />
              <button
                id="direct-id-search-btn"
                onClick={handleIdSearch}
                className="px-3 py-1.5 bg-brand-accent hover:bg-brand-accent-hover text-brand-bg font-sans font-bold text-xs uppercase tracking-wider rounded-lg transition-all cursor-pointer"
              >
                Хайх
              </button>
            </div>

            {foundUser && (
              <div className="p-3.5 bg-brand-bg/50 border border-brand-accent/5 rounded-xl space-y-3 max-w-md">
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <p className="font-semibold text-brand-text">{foundUser.username}</p>
                    <p className="text-[10px] text-brand-text-dark font-mono mt-0.5">{foundUser.email}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono uppercase ${
                    isUserVip(foundUser) ? 'bg-brand-accent/20 text-brand-accent' : 'bg-brand-card-light text-brand-text-dark'
                  }`}>
                    {isUserVip(foundUser) ? '★ VIP' : 'Энгийн'}
                  </span>
                </div>

                {/* Duration picker */}
                <div>
                  <label className="block text-[10px] text-brand-text-dark uppercase font-semibold mb-1">Олгох VIP хугацаа</label>
                  <select
                    value={directDuration}
                    onChange={(e) => setDirectDuration(e.target.value)}
                    className="w-full px-2 py-1.5 bg-brand-bg border border-brand-accent/15 rounded-lg text-xs text-brand-text focus:outline-none cursor-pointer"
                  >
                    {vipPlans.map(d => (
                      <option key={d.id} value={d.id}>{d.label} - {d.desc} ({d.price.toLocaleString('mn-MN')}₮)</option>
                    ))}
                  </select>
                </div>

                <button
                  id="confirm-direct-grant-btn"
                  onClick={handleDirectGrantSubmit}
                  className="w-full py-1.5 bg-brand-accent hover:bg-brand-accent-hover text-brand-bg font-sans font-bold text-xs uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>VIP ИДЭВХЖҮҮЛЭХ</span>
                </button>
              </div>
            )}
          </div>

          {/* Pending requests list section */}
          <div className="bg-brand-card border border-brand-accent/10 rounded-2xl p-6 space-y-4">
            {(() => {
              const pendingRequests = vipRequests.filter(r => r.status === 'pending');
              return (
                <>
                  <h3 className="text-base font-display font-bold text-brand-text">
                    Ирсэн VIP хүсэлтүүд ({pendingRequests.length})
                  </h3>

                  {pendingRequests.length === 0 ? (
                    <div className="py-10 bg-brand-bg/40 border border-brand-accent/5 rounded-xl text-center">
                      <p className="text-xs text-brand-text-dark">Одоогоор ирсэн шийдвэрлээгүй хүсэлт байхгүй байна.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {pendingRequests.map((req) => (
                        <div
                          key={req.id}
                          className="p-4 bg-brand-bg/80 border border-brand-accent/10 rounded-xl flex flex-col gap-3"
                        >
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-display font-bold text-brand-text text-sm">{req.username}</span>
                                <span className="text-[10px] text-brand-text-dark font-mono">ID: {req.userId}</span>
                              </div>
                              <p className="text-xs text-brand-text-dark">{req.userEmail}</p>
                              <div className="flex flex-wrap gap-2.5 items-center text-[10px] text-brand-accent font-semibold uppercase">
                                <span>Сонгосон хугацаа: {req.durationText}</span>
                                {req.receiptImage ? (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenZoomModal(req)}
                                    className="text-brand-ice flex items-center gap-1 font-bold hover:underline cursor-pointer bg-brand-accent/10 px-2.5 py-1 rounded-lg border border-brand-accent/20 hover:bg-brand-accent/20 transition-all"
                                  >
                                    <ZoomIn className="w-3.5 h-3.5 text-brand-accent animate-pulse" /> {req.receiptName} (Томсгож харах)
                                  </button>
                                ) : (
                                  <span className="text-red-400 flex items-center gap-1 font-normal lowercase italic">
                                    <FileText className="w-3 h-3" /> {req.receiptName || 'Баримт хавсаргаагүй'}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 justify-end border-t md:border-t-0 border-brand-accent/5 pt-2.5 md:pt-0">
                              <button
                                id={`approve-req-btn-${req.id}`}
                                onClick={() => onApproveVipRequest(req.id)}
                                className="px-3.5 py-1.5 bg-brand-accent hover:bg-brand-accent-hover text-brand-bg text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-md shadow-brand-accent/15"
                              >
                                <Check className="w-3.5 h-3.5" /> Баталгаажуулах
                              </button>
                              <button
                                id={`reject-req-btn-${req.id}`}
                                onClick={() => onRejectVipRequest(req.id)}
                                className="px-3 py-1.5 bg-red-950/40 hover:bg-red-600 border border-red-500/20 hover:border-red-500 text-red-300 hover:text-white text-xs font-medium rounded-lg transition-all cursor-pointer"
                              >
                                Татгалзах
                              </button>
                            </div>
                          </div>

                          {/* Always-Visible Receipt Image Thumbnail & Click-to-Zoom */}
                          {req.receiptImage ? (
                            <div className="mt-2 p-3 bg-brand-bg/90 border border-brand-accent/15 rounded-xl flex flex-col gap-2">
                              <div className="flex justify-between items-center text-[11px] text-brand-accent font-bold">
                                <span>💳 Гүйлгээний төлбөрийн баримт:</span>
                                <button
                                  type="button"
                                  onClick={() => handleOpenZoomModal(req)}
                                  className="text-[10px] text-brand-ice hover:underline font-mono flex items-center gap-1 bg-brand-accent/10 px-2 py-0.5 rounded cursor-pointer"
                                >
                                  <ZoomIn className="w-3 h-3" /> Зургаар томруулж шалгах
                                </button>
                              </div>
                              <div
                                onClick={() => handleOpenZoomModal(req)}
                                className="relative max-w-sm bg-black/60 rounded-xl overflow-hidden cursor-pointer hover:opacity-90 border border-brand-accent/20 transition-all flex items-center justify-center p-1 group"
                              >
                                <img
                                  src={req.receiptImage}
                                  alt="Гүйлгээний баримт"
                                  className="max-h-48 w-auto object-contain rounded-lg transition-all duration-300 group-hover:scale-105"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white font-bold text-xs">
                                  <ZoomIn className="w-5 h-5 text-brand-accent" />
                                  <span>Томсгож харах</span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="p-3 bg-amber-950/20 border border-amber-500/20 rounded-lg text-amber-300 text-xs flex items-center gap-2 mt-1">
                              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                              <span>Анхаар: Энэ хүсэлт дээр гүйлгээний баримтын зураг илгээгдээгүй байна!</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      ) : (
        /* READER VIP REQUEST PANEL */
        <div className="flex flex-col gap-8 w-full">
          {/* Request Form */}
          <div className="w-full bg-brand-card border-0 rounded-3xl p-5 sm:p-8 space-y-8 relative overflow-hidden">
            <h3 className="text-lg sm:text-xl font-display font-extrabold text-brand-text border-b border-brand-accent/5 pb-3 flex items-center gap-2.5 tracking-wide">
              <Sparkles className="w-6 h-6 text-brand-accent" />
              VIP эрх авах хүсэлт илгээх
            </h3>

            {currentUser?.vipUntil && new Date(currentUser.vipUntil) > new Date() && (
              <div className="p-4 bg-brand-accent/10 border border-brand-accent/25 rounded-2xl text-brand-accent text-xs sm:text-sm flex flex-wrap items-center justify-between gap-2 shadow-sm">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-brand-accent animate-pulse shrink-0" />
                  <div>
                    <span className="font-bold">Таны VIP эрх идэвхтэй байна!</span>
                    <p className="text-[11px] text-brand-text-dark mt-0.5">
                      Нэмж эрх авбал таны одоогийн дуусах хугацаан дээр үргэлжлэн шууд сунгагдана.
                    </p>
                  </div>
                </div>
                <span className="font-mono font-bold bg-brand-accent/20 px-3 py-1 rounded-xl text-brand-ice text-xs">
                  {new Date(currentUser.vipUntil).getFullYear() >= 2090
                    ? '2100.01.01 (Хязгааргүй)'
                    : `${new Date(currentUser.vipUntil).toLocaleDateString()} хүртэл`}
                </span>
              </div>
            )}

            <div className="p-5 sm:p-6 bg-brand-bg/60 border-0 rounded-2xl text-xs sm:text-sm space-y-2.5 leading-relaxed text-brand-text-dark shadow-inner w-full">
              <p className="font-bold text-brand-accent text-sm sm:text-base">Төлбөр төлөх заавар:</p>
              <p className="text-brand-text">{bankConfig?.bankName || 'Хаан Банк'}: <strong className="text-brand-ice font-bold">{bankConfig?.accountNumber || '5041234567'} ({bankConfig?.accountHolder || 'Аяко'})</strong></p>
              <p>{bankConfig?.instructions ? (
                <>
                  {bankConfig.instructions}{' '}
                  <span className="text-brand-accent font-semibold">(Өөрийн ID: {currentUser?.id} эсвэл Gmail: {currentUser?.email})</span>
                </>
              ) : (
                <>
                  Шилжүүлгийн утга дээр өөрийн <strong className="text-brand-accent">ID код ({currentUser?.id})</strong> эсвэл <strong className="text-brand-accent">Gmail ({currentUser?.email})</strong> хаягийг заавал бичнэ үү!
                </>
              )}</p>
            </div>

            {requestSuccess && (
              <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs sm:text-sm flex items-center gap-2.5 animate-bounce w-full">
                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <p className="font-semibold">Хүсэлтийг амжилттай илгээлээ!</p>
                  <p className="text-[11px] text-emerald-300/80 mt-0.5">Админ төлбөрийн баримтыг шалгасны дараа таны VIP эрхийг баталгаажуулна.</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmitRequest} className="space-y-8 w-full">
              {/* Duration Select strictly in 2 columns stretching to both edges */}
              <div className="w-full">
                <label className="block text-xs font-bold text-brand-text-dark uppercase tracking-wider mb-3">
                  Хугацааны сонголт &amp; Үнэ
                </label>
                <div className="grid grid-cols-2 gap-3 sm:gap-5 w-full">
                  {vipPlans.map((dur) => {
                    const isSelected = selectedDuration === dur.id;
                    const basePrice1m = vipPlans.find(p => p.id === '1m' || p.label.includes('1 сар'))?.price || 15000;
                    
                    let months = 1;
                    if (dur.id === '2m' || dur.label.includes('2 сар')) months = 2;
                    else if (dur.id === '3m' || dur.label.includes('3 сар')) months = 3;
                    else if (dur.id === '6m' || dur.label.includes('6 сар')) months = 6;
                    else if (dur.id === '12m' || dur.label.includes('12 сар')) months = 12;

                    let savePercent = 0;
                    if (months > 1 && basePrice1m > 0) {
                      const fullPrice = basePrice1m * months;
                      if (fullPrice > dur.price) {
                        savePercent = Math.round(((fullPrice - dur.price) / fullPrice) * 100);
                      }
                    }

                    return (
                      <button
                        key={dur.id}
                        type="button"
                        onClick={() => setSelectedDuration(dur.id)}
                        className={`p-4 sm:p-5 rounded-2xl text-left transition-all flex flex-col justify-between gap-3 cursor-pointer border-0 w-full ${
                          isSelected
                            ? 'bg-brand-accent/20 text-brand-accent font-semibold shadow-lg shadow-brand-accent/10 ring-2 ring-brand-accent/40'
                            : 'bg-brand-bg/50 text-brand-text-dark hover:bg-brand-bg/80'
                        }`}
                      >
                        <div className="space-y-1.5 w-full">
                          <div className="flex items-center gap-1.5 flex-wrap justify-between w-full">
                            <p className="text-xs sm:text-base font-extrabold text-brand-text">{dur.label}</p>
                            {savePercent > 0 && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-black font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                {savePercent}% ХЭМНЭНЭ
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] sm:text-xs text-brand-text-dark font-normal line-clamp-2">{dur.desc}</p>
                        </div>
                        <div className="pt-2 border-t border-brand-accent/10 flex justify-end w-full">
                          <p className="text-sm sm:text-lg font-extrabold font-mono text-brand-accent">{dur.price.toLocaleString('mn-MN')}₮</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Receipt File Upload with Drag & Drop */}
              <div className="space-y-2.5 w-full">
                <label className="block text-xs font-bold text-brand-text-dark uppercase tracking-wider">
                  Гүйлгээ хийсэн баримтын зураг хавсаргах (Утасны Gallery-наас)
                </label>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('receipt-upload')?.click()}
                  className={`border-0 rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all duration-250 flex flex-col items-center justify-center space-y-3 w-full ${
                    isDragging
                      ? 'bg-brand-accent/10'
                      : mockFileName
                      ? 'bg-brand-bg/30'
                      : 'bg-brand-bg/50 hover:bg-brand-bg/70'
                  }`}
                >
                  <input
                    id="receipt-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileSelect}
                  />

                  <UploadCloud className={`w-10 h-10 ${mockFileName ? 'text-brand-accent animate-bounce' : 'text-brand-text-dark'}`} />

                  {mockFileName ? (
                    <div>
                      <p className="text-sm font-semibold text-brand-text font-mono max-w-xs truncate">{mockFileName}</p>
                      <p className="text-xs text-brand-accent mt-1 font-bold uppercase tracking-wider">Галлерейн зураг амжилттай сонгогдлоо</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs sm:text-sm text-brand-text font-medium">Өөрийн утасны Gallery (Галлерей)-аас гүйлгээний зургаа сонгох эсвэл чирч оруулна уу.</p>
                      <p className="text-[10px] text-brand-text-dark mt-1.5 font-mono">Дэмжих формат: PNG, JPG, JPEG, WEBP</p>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-brand-accent hover:bg-brand-accent-hover text-brand-bg font-display font-extrabold rounded-2xl text-sm sm:text-base uppercase tracking-wider shadow-lg shadow-brand-accent/20 hover:shadow-brand-accent/35 transition-all cursor-pointer text-center"
              >
                Баримт Илгээх
              </button>
            </form>
          </div>

          {/* Previous/Active VIP Requests History */}
          <div className="w-full bg-brand-card border-0 rounded-3xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-accent/10 pb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-display font-bold text-brand-text uppercase">
                  Хүсэлтийн түүх ({userHistoryRequests.length})
                </h3>
              </div>

              {userHistoryRequests.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleSelectAllHistory}
                    className="px-3 py-1.5 bg-brand-bg hover:bg-brand-bg/80 text-brand-text text-xs font-semibold rounded-xl border border-brand-accent/15 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    {selectedHistoryIds.length === userHistoryRequests.length ? (
                      <>
                        <CheckSquare className="w-3.5 h-3.5 text-brand-accent" /> Бүгдийг цуцлах
                      </>
                    ) : (
                      <>
                        <Square className="w-3.5 h-3.5 text-brand-text-dark" /> Бүгдийг сонгох
                      </>
                    )}
                  </button>

                  {selectedHistoryIds.length > 0 && (
                    <button
                      type="button"
                      onClick={handleDeleteSelectedHistory}
                      className="px-3 py-1.5 bg-red-950/60 hover:bg-red-600 border border-red-500/30 text-red-300 hover:text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer animate-pulse"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Сонгосныг устгах ({selectedHistoryIds.length})
                    </button>
                  )}
                </div>
              )}
            </div>

            {userHistoryRequests.length === 0 ? (
              <p className="text-xs text-brand-text-dark italic py-4">Одоогоор илгээсэн хүсэлт байхгүй байна.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full">
                {userHistoryRequests.map((req) => {
                  const isSelected = selectedHistoryIds.includes(req.id);
                  return (
                    <div
                      key={req.id}
                      className={`p-3.5 border rounded-2xl text-xs space-y-2 transition-all relative ${
                        isSelected
                          ? 'bg-brand-accent/15 border-brand-accent/40 shadow-md shadow-brand-accent/5'
                          : 'bg-brand-bg/60 border-brand-accent/10 hover:border-brand-accent/20'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleSelectHistory(req.id)}
                            className="text-brand-accent p-0.5 hover:scale-110 transition-transform cursor-pointer"
                            title={isSelected ? 'Сонголтыг хасах' : 'Сонгох'}
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-brand-accent" />
                            ) : (
                              <Square className="w-4 h-4 text-brand-text-dark/60" />
                            )}
                          </button>
                          <span className="font-bold text-brand-text text-sm">{req.durationText} VIP</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className={`text-[9px] font-bold uppercase font-mono px-2 py-0.5 rounded-full ${
                            req.status === 'approved'
                              ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/20'
                              : req.status === 'rejected'
                              ? 'bg-red-950/40 text-red-300 border border-red-500/20'
                              : 'bg-yellow-950/40 text-yellow-300 border border-yellow-500/20'
                          }`}>
                            {req.status === 'approved' ? 'Баталсан' : req.status === 'rejected' ? 'Татгалзсан' : 'Хүлээгдэж буй'}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleDeleteSingleHistory(req.id)}
                            className="p-1 text-brand-text-dark hover:text-red-400 hover:bg-red-950/40 rounded-lg transition-all cursor-pointer ml-1"
                            title="Хүсэлтийн түүхийг устгах"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <p className="text-[10px] text-brand-text-dark font-mono truncate">
                        Баримт: {req.receiptName}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Admin Receipt Zoom Modal Overlay */}
      {zoomModalRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-2 sm:p-6 animate-fade-in">
          <div className="relative w-full max-w-5xl bg-brand-card/95 border border-brand-accent/20 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
            
            {/* Modal Header */}
            <div className="p-4 bg-brand-bg/90 border-b border-brand-accent/15 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-display font-extrabold text-brand-text text-sm sm:text-base">{zoomModalRequest.username}</span>
                  <span className="text-xs text-brand-accent font-mono font-bold bg-brand-accent/10 px-2 py-0.5 rounded">
                    {zoomModalRequest.durationText} VIP
                  </span>
                </div>
                <p className="text-xs text-brand-text-dark font-mono">{zoomModalRequest.userEmail} (ID: {zoomModalRequest.userId})</p>
              </div>

              {/* Toolbar controls */}
              <div className="flex items-center gap-1.5 sm:gap-2 bg-black/50 p-1.5 rounded-xl border border-brand-accent/15 shadow-inner">
                <button
                  type="button"
                  onClick={handleZoomOut}
                  title="Жижигрүүлэх (-)"
                  className="p-1.5 hover:bg-brand-accent/20 text-brand-text hover:text-brand-accent rounded-lg transition-all cursor-pointer"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono font-bold text-brand-accent px-2 min-w-[50px] text-center">
                  {Math.round(zoomScale * 100)}%
                </span>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  title="Томруулах (+)"
                  className="p-1.5 hover:bg-brand-accent/20 text-brand-text hover:text-brand-accent rounded-lg transition-all cursor-pointer"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <div className="w-px h-4 bg-brand-accent/20 mx-0.5" />
                <button
                  type="button"
                  onClick={handleRotate}
                  title="Эргүүлэх (90°)"
                  className="p-1.5 hover:bg-brand-accent/20 text-brand-text hover:text-brand-accent rounded-lg transition-all cursor-pointer"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleResetZoom}
                  title="Хэвэнд нь оруулах"
                  className="p-1.5 hover:bg-brand-accent/20 text-brand-text hover:text-brand-accent rounded-lg transition-all cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <div className="w-px h-4 bg-brand-accent/20 mx-0.5" />
                <button
                  type="button"
                  onClick={() => setZoomModalRequest(null)}
                  className="p-1.5 bg-red-950/40 hover:bg-red-600 text-red-300 hover:text-white rounded-lg transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Image Display Canvas */}
            <div className="relative flex-1 bg-black/95 p-4 min-h-[350px] sm:min-h-[500px] flex items-center justify-center overflow-auto select-none">
              {zoomModalRequest.receiptImage ? (
                <div
                  className="transition-transform duration-200 ease-out max-w-full max-h-full flex items-center justify-center"
                  style={{
                    transform: `scale(${zoomScale}) rotate(${zoomRotate}deg)`,
                    transformOrigin: 'center center'
                  }}
                >
                  <img
                    src={zoomModalRequest.receiptImage}
                    alt="Гүйлгээний баримт"
                    className="max-w-full max-h-[65vh] object-contain rounded-lg shadow-2xl border border-brand-accent/20"
                  />
                </div>
              ) : (
                <div className="text-center p-8 text-red-400 font-medium">
                  Баримтын зураг хавсаргагдаагүй байна.
                </div>
              )}
            </div>

            {/* Modal Bottom Action Bar */}
            <div className="p-4 bg-brand-bg/90 border-t border-brand-accent/15 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-brand-text-dark font-mono">
                Баримтын зургийг сайтар шалгаад шууд шийдвэр гаргах боломжтой.
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onApproveVipRequest(zoomModalRequest.id);
                    setZoomModalRequest(null);
                  }}
                  className="px-4 py-2 bg-brand-accent hover:bg-brand-accent-hover text-brand-bg text-xs sm:text-sm font-extrabold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-lg shadow-brand-accent/20"
                >
                  <Check className="w-4 h-4" /> Баталгаажуулах
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onRejectVipRequest(zoomModalRequest.id);
                    setZoomModalRequest(null);
                  }}
                  className="px-3.5 py-2 bg-red-950/60 hover:bg-red-600 border border-red-500/30 text-red-300 hover:text-white text-xs sm:text-sm font-semibold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <X className="w-4 h-4" /> Татгалзах
                </button>
                <button
                  type="button"
                  onClick={() => setZoomModalRequest(null)}
                  className="px-3 py-2 bg-brand-card hover:bg-brand-bg text-brand-text-dark text-xs sm:text-sm font-medium rounded-xl border border-brand-accent/10 transition-all cursor-pointer"
                >
                  Хаах
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
