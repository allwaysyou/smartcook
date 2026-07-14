import React from 'react';
import { Home, Search, Crown, User, Sparkles } from 'lucide-react';

interface BottomNavigationProps {
  viewMode: 'home' | 'detail' | 'cooking' | 'admin' | 'profile';
  currentUser: any;
  isUpgradeModalOpen: boolean;
  onTabClick: (tab: 'home' | 'search' | 'premium' | 'profile') => void;
}

export default function BottomNavigation({
  viewMode,
  currentUser,
  isUpgradeModalOpen,
  onTabClick
}: BottomNavigationProps) {
  
  // Decide which tab is active based on current state
  const getActiveTab = (): 'home' | 'search' | 'premium' | 'profile' => {
    if (viewMode === 'profile') {
      return 'profile';
    }
    if (isUpgradeModalOpen) {
      return 'premium';
    }
    // We'll let the user tap 'search' which sets home view. 
    // If we are in home, default is home.
    return 'home';
  };

  const activeTab = getActiveTab();

  return (
    <div 
      id="mobile-bottom-nav" 
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/80 backdrop-blur-md border-t border-gray-100 shadow-[0_-8px_24px_rgba(0,0,0,0.04)] px-4 py-2 pb-safe-bottom transition-all duration-300"
    >
      <div className="flex items-center justify-around max-w-md mx-auto h-14">
        {/* HOME TAB */}
        <button
          onClick={() => onTabClick('home')}
          className="flex flex-col items-center justify-center w-12 h-full relative group cursor-pointer"
        >
          <div className={`p-1.5 rounded-full transition-all duration-200 ${
            activeTab === 'home' 
              ? 'scale-110 text-orange-500' 
              : 'text-gray-400 group-hover:text-gray-600'
          }`}>
            <Home 
              className={`w-6 h-6 transition-all duration-200 ${
                activeTab === 'home' ? 'fill-orange-500/10' : ''
              }`} 
            />
          </div>
          <span className={`text-[9px] font-bold tracking-wider uppercase transition-colors ${
            activeTab === 'home' ? 'text-orange-500' : 'text-gray-400'
          }`}>
            Feed
          </span>
          {activeTab === 'home' && (
            <span className="absolute bottom-[-4px] w-1.5 h-1.5 bg-orange-500 rounded-full animate-fade-in" />
          )}
        </button>

        {/* SEARCH & CATEGORIES TAB */}
        <button
          onClick={() => onTabClick('search')}
          className="flex flex-col items-center justify-center w-12 h-full relative group cursor-pointer"
        >
          <div className={`p-1.5 rounded-full transition-all duration-200 ${
            activeTab === 'search' 
              ? 'scale-110 text-orange-500' 
              : 'text-gray-400 group-hover:text-gray-600'
          }`}>
            <Search 
              className="w-6 h-6" 
            />
          </div>
          <span className={`text-[9px] font-bold tracking-wider uppercase transition-colors ${
            activeTab === 'search' ? 'text-orange-500' : 'text-gray-400'
          }`}>
            Search
          </span>
          {activeTab === 'search' && (
            <span className="absolute bottom-[-4px] w-1.5 h-1.5 bg-orange-500 rounded-full animate-fade-in" />
          )}
        </button>

        {/* PREMIUM / PRO SUBSCRIPTION TAB */}
        <button
          onClick={() => onTabClick('premium')}
          className="flex flex-col items-center justify-center w-16 h-full relative group cursor-pointer"
        >
          <div className={`p-1 rounded-full transition-all duration-300 relative ${
            activeTab === 'premium' || currentUser?.isPremium
              ? 'scale-110 text-amber-500' 
              : 'text-gray-400 group-hover:text-amber-500'
          }`}>
            {/* Ambient subtle glow for Premium tab */}
            {(currentUser?.isPremium || activeTab === 'premium') ? (
              <div className="absolute inset-0 bg-amber-400/20 rounded-full blur-md animate-pulse" />
            ) : (
              <div className="absolute inset-0 bg-orange-400/10 rounded-full blur-sm opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
            
            <Crown 
              className={`w-6 h-6 relative z-10 transition-all duration-300 ${
                currentUser?.isPremium ? 'fill-amber-400 text-amber-500' : 'text-gray-400 group-hover:text-amber-500'
              }`} 
            />
          </div>
          <span className={`text-[9px] font-black tracking-wider uppercase transition-colors relative z-10 ${
            currentUser?.isPremium 
              ? 'text-amber-600 font-extrabold' 
              : activeTab === 'premium' ? 'text-amber-500' : 'text-gray-400 group-hover:text-amber-500'
          }`}>
            {currentUser?.isPremium ? 'Pro 👑' : 'Go Pro'}
          </span>
          {activeTab === 'premium' && (
            <span className="absolute bottom-[-4px] w-1.5 h-1.5 bg-amber-500 rounded-full animate-fade-in" />
          )}
        </button>

        {/* PROFILE TAB */}
        <button
          onClick={() => onTabClick('profile')}
          className="flex flex-col items-center justify-center w-12 h-full relative group cursor-pointer"
        >
          <div className={`p-1 transition-all duration-200 ${
            activeTab === 'profile' 
              ? 'scale-110 text-orange-500' 
              : 'text-gray-400 group-hover:text-gray-600'
          }`}>
            {currentUser?.photoURL ? (
              <img 
                src={currentUser.photoURL} 
                referrerPolicy="no-referrer"
                alt={currentUser.name} 
                className={`w-6 h-6 rounded-full object-cover border transition-all ${
                  activeTab === 'profile' 
                    ? 'border-orange-500 ring-2 ring-orange-500/20' 
                    : 'border-gray-200 group-hover:border-gray-400'
                }`}
              />
            ) : (
              <User 
                className={`w-6 h-6 transition-all duration-200 ${
                  activeTab === 'profile' ? 'fill-orange-500/10' : ''
                }`} 
              />
            )}
          </div>
          <span className={`text-[9px] font-bold tracking-wider uppercase transition-colors ${
            activeTab === 'profile' ? 'text-orange-500' : 'text-gray-400'
          }`}>
            Profile
          </span>
          {activeTab === 'profile' && (
            <span className="absolute bottom-[-4px] w-1.5 h-1.5 bg-orange-500 rounded-full animate-fade-in" />
          )}
        </button>
      </div>
    </div>
  );
}
