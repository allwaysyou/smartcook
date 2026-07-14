import React from 'react';
import { 
  ChevronLeft, 
  Sparkles, 
  CreditCard, 
  Calendar, 
  Crown, 
  Unlock, 
  Lock, 
  LogOut, 
  Mail, 
  User as UserIcon, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';

interface ProfileDashboardProps {
  currentUser: any;
  onLogout: () => void;
  onUpgrade: () => void;
  onClose: () => void;
}

export default function ProfileDashboard({ 
  currentUser, 
  onLogout, 
  onUpgrade, 
  onClose 
}: ProfileDashboardProps) {

  const formatDate = (isoString?: string) => {
    if (!isoString) return 'N/A';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return isoString;
    }
  };

  const getDaysRemaining = (expiryString?: string) => {
    if (!expiryString) return 0;
    try {
      const expiry = new Date(expiryString);
      const diffTime = expiry.getTime() - Date.now();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 0 ? diffDays : 0;
    } catch (e) {
      return 0;
    }
  };

  const daysLeft = currentUser?.isPremium ? getDaysRemaining(currentUser.premiumUntil) : 0;

  return (
    <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 max-w-4xl mx-auto w-full space-y-6 animate-fade-in">
      {/* Back Button */}
      <button 
        onClick={onClose}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-600 hover:text-orange-600 bg-white border border-gray-100 hover:border-orange-100 rounded-full transition-all cursor-pointer shadow-sm"
      >
        <ChevronLeft className="w-4 h-4" />
        <span>Back to Recipes</span>
      </button>

      {/* Profile Overview Card */}
      <div className="bg-white rounded-[32px] border border-gray-100 shadow-xl overflow-hidden relative">
        {/* Banner Art Background */}
        <div className="h-32 bg-gradient-to-r from-orange-400 via-orange-500 to-amber-500 relative">
          {currentUser?.isPremium && (
            <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-md text-white text-[10px] font-black tracking-widest uppercase px-3 py-1.5 rounded-full border border-white/30 flex items-center gap-1.5 animate-pulse">
              <Crown className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
              <span>PRO ACTIVE MEMBER</span>
            </div>
          )}
        </div>

        {/* Profile Details Container */}
        <div className="px-6 md:px-10 pb-8 pt-0 relative flex flex-col md:flex-row items-center md:items-end gap-6 -mt-16">
          {/* Avatar frame */}
          <div className="relative">
            {currentUser?.photoURL ? (
              <img 
                src={currentUser.photoURL} 
                referrerPolicy="no-referrer"
                alt={currentUser.name} 
                className="w-28 h-28 rounded-full object-cover border-4 border-white bg-orange-50 shadow-md"
              />
            ) : (
              <div className="w-28 h-28 rounded-full border-4 border-white bg-gradient-to-br from-orange-100 to-orange-200 text-orange-600 flex items-center justify-center font-black text-3xl shadow-md uppercase">
                {currentUser?.name ? currentUser.name.substring(0, 2) : 'US'}
              </div>
            )}
            
            {currentUser?.isPremium && (
              <div className="absolute -bottom-1 -right-1 bg-amber-400 text-white p-1.5 rounded-full border-2 border-white shadow-md">
                <Crown className="w-4 h-4 fill-white text-white" />
              </div>
            )}
          </div>

          {/* User Text Info */}
          <div className="flex-1 text-center md:text-left space-y-1.5">
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">
                {currentUser?.name || 'Chef Gastronome'}
              </h1>
              <div className="inline-flex justify-center md:justify-start">
                {currentUser?.isPremium ? (
                  <span className="bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                    <Crown className="w-3 h-3 text-amber-600 fill-amber-500" />
                    PRO MEMBER
                  </span>
                ) : (
                  <span className="bg-gray-100 text-gray-600 border border-gray-200 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider">
                    FREE ACCOUNT
                  </span>
                )}
              </div>
            </div>

            <p className="text-gray-500 text-sm flex items-center justify-center md:justify-start gap-1.5 font-medium">
              <Mail className="w-4 h-4 text-gray-400" />
              <span>{currentUser?.email || 'notavailable@gmail.com'}</span>
            </p>
          </div>

          {/* Logout Action */}
          <button 
            onClick={onLogout}
            className="px-5 py-2.5 bg-red-50 hover:bg-red-100 border border-red-100 hover:border-red-200 text-red-600 hover:text-red-700 rounded-2xl text-xs font-bold tracking-wide transition-all cursor-pointer flex items-center gap-2 shadow-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>LOG OUT</span>
          </button>
        </div>
      </div>

      {/* Subscription details card & Features comparison side-by-side / bento */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {/* Subscription state card (takes 2 cols on md) */}
        <div className="md:col-span-2 bg-white rounded-3xl border border-gray-100 shadow-lg p-6 space-y-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
              <CreditCard className="w-5 h-5 text-orange-500" />
              <h3 className="font-extrabold text-sm text-gray-900 uppercase tracking-wider">Billing details</h3>
            </div>

            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">CURRENT PLAN</span>
                <span className="text-lg font-black text-gray-900">
                  {currentUser?.isPremium ? 'SmartCook Premium Pro' : 'SmartCook Standard (Free)'}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">MEMBERSHIP STATUS</span>
                <div className="mt-1">
                  {currentUser?.isPremium ? (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-bold">
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-ping"></span>
                      <span>Active Pro Member 👑</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-600 border border-red-200 rounded-full text-xs font-bold">
                      <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                      <span>Status: Free Account</span>
                    </div>
                  )}
                </div>
              </div>

              {currentUser?.isPremium && (
                <div className="space-y-3 bg-amber-50/50 border border-amber-100 rounded-2xl p-4">
                  <div className="flex items-center gap-2 text-xs text-amber-900 font-bold">
                    <Calendar className="w-4 h-4 text-amber-600" />
                    <span>Validity & Dates</span>
                  </div>
                  
                  <div className="space-y-1.5 text-[11px] text-amber-950 font-medium font-mono">
                    <div className="flex justify-between">
                      <span className="text-gray-500 font-sans">Purchased on:</span>
                      <span>{formatDate(currentUser.purchaseDate || currentUser.createdAt)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500 font-sans">Expires on:</span>
                      <span className="font-bold">{formatDate(currentUser.premiumUntil)}</span>
                    </div>
                    <div className="border-t border-amber-200/50 pt-1.5 flex justify-between font-bold">
                      <span className="text-gray-500 font-sans">Time remaining:</span>
                      <span className="text-amber-800">{daysLeft} days remaining</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            {currentUser?.isPremium ? (
              <div className="bg-green-50/70 border border-green-100 rounded-2xl p-4 text-center">
                <p className="text-xs text-green-800 font-bold leading-relaxed">
                  Thank you for being a Pro member! Your premium support allows us to maintain live timers & servers.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-center">
                  <span className="text-[10px] text-gray-400 font-medium">Get uninterrupted access for only ₹9/month!</span>
                </div>
                <button
                  onClick={onUpgrade}
                  className="w-full py-3 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-600 hover:via-orange-600 hover:to-red-600 text-white font-extrabold text-xs rounded-2xl transition-all shadow-md shadow-orange-500/25 cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  <Sparkles className="w-4 h-4 fill-white animate-bounce" />
                  <span>UPGRADE TO PRO (₹9/MONTH)</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Premium feature unlocked breakdown comparison (takes 3 cols on md) */}
        <div className="md:col-span-3 bg-white rounded-3xl border border-gray-100 shadow-lg p-6 space-y-5">
          <div className="pb-3 border-b border-gray-100">
            <h3 className="font-extrabold text-sm text-gray-900 uppercase tracking-wider">Features Checklist</h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-3.5">
              <div className={`p-2.5 rounded-xl shrink-0 ${currentUser?.isPremium ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500'}`}>
                {currentUser?.isPremium ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              </div>
              <div className="space-y-0.5">
                <span className="text-xs font-black text-gray-800 uppercase tracking-wide flex items-center gap-1.5">
                  Premium Recipes Secrets
                  {currentUser?.isPremium ? (
                    <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-md font-bold font-mono">UNLOCKED</span>
                  ) : (
                    <span className="text-[9px] bg-red-100 text-red-800 px-1.5 py-0.5 rounded-md font-bold font-mono">LOCKED</span>
                  )}
                </span>
                <p className="text-[11px] text-gray-500 leading-normal">
                  Unlock access to exclusive culinary secrets, ingredients replacement menus, diabetes & keto friendly variants.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className={`p-2.5 rounded-xl shrink-0 ${currentUser?.isPremium ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500'}`}>
                {currentUser?.isPremium ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              </div>
              <div className="space-y-0.5">
                <span className="text-xs font-black text-gray-800 uppercase tracking-wide flex items-center gap-1.5">
                  Hands-Free Voice Controls
                  {currentUser?.isPremium ? (
                    <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-md font-bold font-mono">UNLOCKED</span>
                  ) : (
                    <span className="text-[9px] bg-red-100 text-red-800 px-1.5 py-0.5 rounded-md font-bold font-mono">LOCKED</span>
                  )}
                </span>
                <p className="text-[11px] text-gray-500 leading-normal">
                  No dirty screens! Control the entire live cooking timer, step transitions, and ingredients checks purely with voice commands.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className={`p-2.5 rounded-xl shrink-0 ${currentUser?.isPremium ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500'}`}>
                {currentUser?.isPremium ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              </div>
              <div className="space-y-0.5">
                <span className="text-xs font-black text-gray-800 uppercase tracking-wide flex items-center gap-1.5">
                  Smart Contextual Timers
                  {currentUser?.isPremium ? (
                    <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-md font-bold font-mono">UNLOCKED</span>
                  ) : (
                    <span className="text-[9px] bg-red-100 text-red-800 px-1.5 py-0.5 rounded-md font-bold font-mono">LOCKED</span>
                  )}
                </span>
                <p className="text-[11px] text-gray-500 leading-normal">
                  Run sleep-proof alarms with push notification alerts so your pasta is never overboiled even if you close the application.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 flex gap-3 items-start">
            <div className="text-lg">👑</div>
            <div className="space-y-1">
              <span className="text-xs font-black text-orange-950 uppercase">About Pro Premium Status</span>
              <p className="text-[11px] text-orange-800 leading-normal">
                Subscriptions run on standard 30-day billing intervals. Alarms are fully verified using a local background clock service to prevent standard browser-tab timeouts.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
