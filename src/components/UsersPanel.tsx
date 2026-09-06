import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { Search, LogIn, Shield, Key, Mail, UserCheck, ShieldAlert, BadgeCheck } from 'lucide-react';

interface UsersPanelProps {
  currentUser: User | null;
  allUsers: User[];
  onImpersonateUser: (user: User) => void;
  onUpdateUserRole: (userId: string, newRole: UserRole) => void;
  onDirectVipGrant: (userId: string, durationText: string) => void;
  onDirectVipDateGrant: (userId: string, dateStr: string | null) => void;
}

export default function UsersPanel({
  currentUser,
  allUsers,
  onImpersonateUser,
  onUpdateUserRole,
  onDirectVipGrant,
  onDirectVipDateGrant
}: UsersPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<'all' | UserRole>('all');
  const [successMessage, setSuccessMessage] = useState('');

  const filteredUsers = allUsers.filter(user => {
    const matchesSearch = 
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.id.includes(searchQuery);
    
    const matchesRole = selectedRole === 'all' || user.role === selectedRole;
    
    return matchesSearch && matchesRole;
  });

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'super_admin':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-red-950/40 border border-red-500/30 text-red-400 text-[10px] font-bold rounded-lg uppercase tracking-wider">
            <ShieldAlert className="w-3.5 h-3.5" />
            Ерөнхий Админ
          </span>
        );
      case 'admin':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-950/40 border border-amber-500/30 text-amber-400 text-[10px] font-bold rounded-lg uppercase tracking-wider">
            <Shield className="w-3.5 h-3.5" />
            Админ
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-950/40 border border-blue-500/30 text-blue-400 text-[10px] font-bold rounded-lg uppercase tracking-wider">
            <UserCheck className="w-3.5 h-3.5" />
            Уншигч
          </span>
        );
    }
  };

  const handleImpersonate = (user: User) => {
    onImpersonateUser(user);
    setSuccessMessage(`"${user.username}" хэрэглэгчээр амжилттай нэвтэрлээ.`);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  return (
    <div id="users-panel-view" className="w-full max-w-6xl mx-auto px-4 py-8 space-y-6 animate-fade-in">
      {/* Title */}
      <div className="border-b border-brand-accent/15 pb-6">
        <h2 className="text-2xl font-display font-extrabold text-brand-accent glow-text uppercase flex items-center gap-2">
          <UserCheck className="w-6 h-6 text-brand-accent" />
          Хэрэглэгчдийн нэгдсэн бүртгэл
        </h2>
        <p className="text-sm text-brand-text-dark mt-1">
          Сайтын бүх гишүүд болон админ багийн мэдээлэл, хандах эрхийг удирдах, хаягаар нь нэвтрэх хэсэг.
        </p>
      </div>

      {successMessage && (
        <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2 animate-pulse">
          <BadgeCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-brand-card border border-brand-accent/10 rounded-2xl p-4">
        {/* Search */}
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-dark" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Хэрэглэгчийн нэр, мэйл эсвэл ID-аар хайх..."
            className="w-full pl-10 pr-4 py-2 bg-brand-bg border border-brand-accent/20 rounded-xl text-xs text-brand-text focus:outline-none focus:border-brand-accent transition-colors placeholder:text-brand-text-dark font-sans"
          />
        </div>

        {/* Role Filter */}
        <div className="flex gap-2 w-full md:w-auto">
          {(['all', 'super_admin', 'admin', 'reader'] as const).map((role) => (
            <button
              key={role}
              onClick={() => setSelectedRole(role)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
                selectedRole === role
                  ? 'bg-brand-accent text-brand-bg font-bold shadow-sm shadow-brand-accent/20'
                  : 'bg-brand-bg border border-brand-accent/10 text-brand-text-dark hover:border-brand-accent/30'
              }`}
            >
              {role === 'all' ? 'Бүгд' : role === 'super_admin' ? 'Ерөнхий Админ' : role === 'admin' ? 'Админ' : 'Уншигч'}
            </button>
          ))}
        </div>
      </div>

      {/* Users List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredUsers.map((user) => {
          const isMe = currentUser?.id === user.id;
          return (
            <div
              key={user.id}
              className={`bg-brand-card border rounded-2xl p-5 space-y-4 shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg ${
                isMe ? 'border-brand-accent shadow-brand-accent/5' : 'border-brand-accent/10 hover:border-brand-accent/30'
              }`}
            >
              {/* Top Row: User Name & Role */}
              <div className="flex justify-between items-start gap-2">
                <div className="truncate">
                  <h3 className="font-display font-bold text-brand-text text-sm truncate flex items-center gap-1.5">
                    {user.username}
                    {isMe && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-brand-accent/20 text-brand-accent rounded font-bold uppercase tracking-wider">
                        Та
                      </span>
                    )}
                  </h3>
                  <p className="text-[10px] text-brand-text-dark font-mono mt-0.5">ID: {user.id}</p>
                </div>
                {getRoleBadge(user.role)}
              </div>

              {/* Middle Row: User sensitive info (Email and Code/PIN) */}
              <div className="space-y-2 bg-brand-bg/40 p-3 rounded-xl border border-brand-accent/5 text-xs text-brand-text font-mono">
                <div className="flex items-center gap-2 text-brand-text-dark">
                  <Mail className="w-3.5 h-3.5 text-brand-accent/60 shrink-0" />
                  <span className="truncate select-all">{user.email}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-brand-text-dark">
                    <Key className="w-3.5 h-3.5 text-brand-accent/60 shrink-0" />
                    <span>Нууц код (PIN):</span>
                  </div>
                  <strong className="text-brand-accent tracking-widest bg-brand-bg px-2 py-0.5 rounded border border-brand-accent/15 text-xs">
                    {user.code}
                  </strong>
                </div>
                {user.vipUntil && new Date(user.vipUntil) > new Date() && (
                  <div className="flex items-center justify-between text-[10px] pt-1 border-t border-brand-accent/5 mt-1">
                    <span className="text-brand-accent font-bold">★ VIP идэвхтэй:</span>
                    <span className="text-brand-ice font-semibold">
                      {new Date(user.vipUntil).getFullYear() >= 2090
                        ? '2100.01.01 (Хязгааргүй)'
                        : `${new Date(user.vipUntil).toLocaleDateString()} хүртэл`}
                    </span>
                  </div>
                )}
              </div>

              {/* Bottom Actions Row */}
              <div className="flex gap-2 pt-2">
                {/* Impersonation button */}
                <button
                  onClick={() => handleImpersonate(user)}
                  disabled={isMe}
                  className={`flex-grow py-2 rounded-xl text-xs font-bold uppercase flex items-center justify-center gap-1.5 transition-all ${
                    isMe
                      ? 'bg-brand-bg/20 text-brand-text-dark border border-brand-accent/5 cursor-not-allowed'
                      : 'bg-brand-accent/10 hover:bg-brand-accent text-brand-accent hover:text-brand-bg border border-brand-accent/25 transition-all cursor-pointer'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Хаягаар нэвтрэх</span>
                </button>

                {/* Role Changer for non-self users */}
                {!isMe && (
                  <select
                    value={user.role}
                    onChange={(e) => onUpdateUserRole(user.id, e.target.value as UserRole)}
                    className="px-2 py-2 bg-brand-bg border border-brand-accent/20 hover:border-brand-accent/40 rounded-xl text-[10px] font-bold text-brand-text-dark uppercase focus:outline-none cursor-pointer"
                  >
                    <option value="reader">Уншигч</option>
                    <option value="admin">Админ</option>
                    <option value="super_admin">Ерөнхий Админ</option>
                  </select>
                )}
              </div>

              {/* VIP Granting Section (for Super Admin user view) */}
              <div className="pt-3 border-t border-brand-accent/10 space-y-2">
                <span className="text-[10px] font-bold text-brand-accent uppercase tracking-wider flex items-center gap-1">
                  ★ VIP эрх удирдах
                </span>
                <div className="flex flex-wrap gap-1">
                  {['1 хоног', '7 хоног', '1 сар', '3 сар', '12 сар', 'Хязгааргүй'].map((dur) => (
                    <button
                      key={dur}
                      onClick={() => {
                        onDirectVipGrant(user.id, dur);
                        setSuccessMessage(`"${user.username}" хэрэглэгчид ${dur} VIP эрх олголоо.`);
                        setTimeout(() => setSuccessMessage(''), 3000);
                      }}
                      className="px-2 py-1 bg-brand-bg hover:bg-brand-accent/15 border border-brand-accent/10 hover:border-brand-accent text-[10px] text-brand-text-dark hover:text-brand-accent rounded font-medium transition-all cursor-pointer"
                    >
                      +{dur}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1.5 pt-1">
                  <input
                    type="date"
                    id={`vip-date-picker-${user.id}`}
                    min={new Date().toISOString().split('T')[0]}
                    className="flex-grow px-2 py-1 bg-brand-bg border border-brand-accent/20 rounded-lg text-[11px] text-brand-text focus:outline-none focus:border-brand-accent"
                  />
                  <button
                    onClick={() => {
                      const picker = document.getElementById(`vip-date-picker-${user.id}`) as HTMLInputElement;
                      if (picker && picker.value) {
                        const targetDate = new Date(picker.value);
                        targetDate.setHours(23, 59, 59, 999);
                        onDirectVipDateGrant(user.id, targetDate.toISOString());
                        setSuccessMessage(`"${user.username}" хэрэглэгчийн VIP эрхийг ${new Date(picker.value).toLocaleDateString()} хүртэл сунгалаа.`);
                        setTimeout(() => setSuccessMessage(''), 3000);
                        picker.value = '';
                      }
                    }}
                    className="px-2.5 py-1 bg-brand-accent text-brand-bg font-extrabold text-[10px] uppercase rounded-lg hover:opacity-90 transition-all cursor-pointer"
                  >
                    Өгөх
                  </button>
                  {user.vipUntil && (
                    <button
                      onClick={() => {
                        onDirectVipDateGrant(user.id, null);
                        setSuccessMessage(`"${user.username}" хэрэглэгчийн VIP эрхийг цуцаллаа.`);
                        setTimeout(() => setSuccessMessage(''), 3000);
                      }}
                      className="px-2 py-1 bg-red-950/40 hover:bg-red-600 border border-red-500/30 text-red-300 hover:text-white text-[10px] font-bold rounded-lg transition-all cursor-pointer"
                      title="VIP эрх цуцлах"
                    >
                      Цуцлах
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
