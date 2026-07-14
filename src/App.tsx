/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Pause, 
  RotateCcw, 
  Timer, 
  Users, 
  Flame, 
  Star, 
  Volume2, 
  VolumeX, 
  CheckCircle, 
  Home, 
  Plus, 
  Minus, 
  BookOpen, 
  Sparkles, 
  Bell, 
  ArrowLeft,
  ChevronDown,
  Mic,
  MicOff,
  Database,
  Lock,
  LogOut,
  User as UserIcon
} from 'lucide-react';
import { Recipe, Category, TimerState } from './types';
import { INITIAL_RECIPES } from './data/initialRecipes';
import { playAlarm, stopAlarm, unlockAudio, startSilentLoop, stopSilentLoop, playEscalatedAlarm, stopEscalatedAlarm, playFiveSecondWarningChime } from './utils/audio';
import AdminPanel from './components/AdminPanel';
import AuthModal from './components/AuthModal';
import UpgradeModal from './components/UpgradeModal';
import ProfileDashboard from './components/ProfileDashboard';
import BottomNavigation from './components/BottomNavigation';
import { auth, signOut, onAuthStateChanged } from './lib/firebase';

const SPONSORS_DATA = [
  {
    brand: "Tata Salt",
    slogan: "Desh Ka Namak",
    logo: "🧂",
    banner: "Tata Salt Lite is low sodium! 15% off on Blinkit."
  },
  {
    brand: "Catch Masala",
    slogan: "Kyunki Khana Hai Catchy",
    logo: "🌶️",
    banner: "Catch Pure Garam Masala: Flat ₹20 Off on Zepto."
  },
  {
    brand: "Fortune Mustard Oil",
    slogan: "Ghar ka khana, ghar ka pyaar",
    logo: "🍳",
    banner: "Fortune Kachi Ghani Oil: Buy 1 Get 1 on Instamart."
  },
  {
    brand: "Amul Butter",
    slogan: "Utterly Butterly Delicious",
    logo: "🧈",
    banner: "Fresh Amul Butter delivered in under 7 mins!"
  }
];

export default function App() {
  // Navigation & View States
  const [viewMode, setViewMode] = useState<'home' | 'detail' | 'cooking' | 'admin' | 'profile'>('home');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [recipes, setRecipes] = useState<Recipe[]>(INITIAL_RECIPES);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  
  // User Authentication & Pro Subscription State
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(localStorage.getItem('smartcook_token'));
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState<boolean>(false);

  // Synchronize authenticated user profile on load
  useEffect(() => {
    const fetchProfile = async () => {
      if (!authToken) return;
      try {
        const response = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${authToken}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setCurrentUser(data.user);
          } else {
            handleLogout();
          }
        } else {
          handleLogout();
        }
      } catch (err) {
        console.warn('Profile sync failed:', err);
      }
    };
    fetchProfile();
  }, [authToken]);

  // Listen to Firebase Auth state shifts to stay logged in and synchronize session
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        // If we have a Firebase user but no local auth token, perform background federated sync
        if (!localStorage.getItem('smartcook_token')) {
          try {
            const profile = {
              uid: fbUser.uid,
              name: fbUser.displayName || 'Google User',
              email: fbUser.email,
              photoURL: fbUser.photoURL || ''
            };
            const response = await fetch('/api/auth/google', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(profile),
            });
            const data = await response.json();
            if (response.ok && data.success) {
              handleAuthSuccess(data.token, data.user);
            }
          } catch (err) {
            console.warn('Firebase background sync failed:', err);
          }
        }
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('smartcook_token');
    setAuthToken(null);
    setCurrentUser(null);
    setViewMode('home');
    signOut(auth).catch(err => console.warn('Firebase signout failed:', err));
  };

  const handleAuthSuccess = (token: string, user: any) => {
    localStorage.setItem('smartcook_token', token);
    setAuthToken(token);
    setCurrentUser(user);
  };

  const handleBottomTabClick = (tab: 'home' | 'search' | 'premium' | 'profile') => {
    if (tab === 'home') {
      setViewMode('home');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (tab === 'search') {
      setViewMode('home');
      setTimeout(() => {
        const searchInput = document.getElementById('mobile-search-input');
        if (searchInput) {
          (searchInput as HTMLInputElement).focus();
          searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
    } else if (tab === 'premium') {
      if (currentUser?.isPremium) {
        setViewMode('profile');
        setTimeout(() => {
          const headings = Array.from(document.querySelectorAll('h3'));
          const billingHeading = headings.find(h => h.textContent?.toLowerCase().includes('billing details'));
          if (billingHeading) {
            billingHeading.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } else {
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
          }
        }, 150);
      } else {
        setIsUpgradeModalOpen(true);
      }
    } else if (tab === 'profile') {
      if (currentUser) {
        setViewMode('profile');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        setIsAuthModalOpen(true);
      }
    }
  };
  
  // Active Cooking State
  const [activeRecipe, setActiveRecipe] = useState<Recipe | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [servings, setServings] = useState<number>(2);
  const [checkedIngredients, setCheckedIngredients] = useState<Record<string, boolean>>({});

  // Ingredient Substitutions state: key of `${recipeId}_${originalIngredientName}` -> substituted ingredient detail
  const [ingredientSubstitutions, setIngredientSubstitutions] = useState<Record<string, { name: string; multiplier: number }>>({});
  const [openSubstituteMenu, setOpenSubstituteMenu] = useState<string | null>(null);

  // Pre-flight check modal states
  const [preFlightModalOpen, setPreFlightModalOpen] = useState<boolean>(false);
  const [preFlightWarnings, setPreFlightWarnings] = useState<string[]>([]);
  const [pendingCookingRecipe, setPendingCookingRecipe] = useState<Recipe | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [activeDifficulty, setActiveDifficulty] = useState<string>('All');
  const [fridgeIngredients, setFridgeIngredients] = useState<string[]>([]);
  const [dietaryDiabetic, setDietaryDiabetic] = useState<boolean>(false);
  const [dietaryKeto, setDietaryKeto] = useState<boolean>(false);
  const [dietaryHighProtein, setDietaryHighProtein] = useState<boolean>(false);

  // Alarm & Alert Settings
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [notificationPermission, setNotificationPermission] = useState<string>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );

  // Background Web Worker Timer State
  const [timerState, setTimerState] = useState<TimerState>({
    timeLeft: 0,
    isRunning: false,
    isPaused: false,
    isFinished: false,
    totalDuration: 0,
  });

  const workerRef = useRef<Worker | null>(null);
  const escalationTimeoutIdRef = useRef<any>(null);

  // Voice Recognition State
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState<boolean>(false);
  const [isVoiceActive, setIsVoiceActive] = useState<boolean>(false);
  const [voiceFeedback, setVoiceFeedback] = useState<string>('');
  const [isSpeechSupported, setIsSpeechSupported] = useState<boolean>(false);
  const [voiceError, setVoiceError] = useState<string>('');

  // Fetch recipes on load from server
  useEffect(() => {
    const fetchRecipes = async () => {
      try {
        const queryParams = new URLSearchParams();
        if (activeCategory !== 'All') queryParams.append('category', activeCategory);
        if (activeDifficulty !== 'All') queryParams.append('difficulty', activeDifficulty);
        if (searchQuery) queryParams.append('search', searchQuery);
        if (fridgeIngredients.length > 0) {
          queryParams.append('fridge', fridgeIngredients.join(','));
        }
        if (dietaryDiabetic) queryParams.append('is_diabetic_friendly', 'true');
        if (dietaryKeto) queryParams.append('is_keto', 'true');
        if (dietaryHighProtein) queryParams.append('is_high_protein', 'true');

        const response = await fetch(`/api/recipes?${queryParams.toString()}`);
        if (response.ok) {
          const data = await response.json();
          setRecipes(data);
        }
      } catch (err) {
        console.warn('API error, falling back to local dataset:', err);
      }
    };

    fetchRecipes();
  }, [searchQuery, activeCategory, activeDifficulty, fridgeIngredients, dietaryDiabetic, dietaryKeto, dietaryHighProtein, refreshTrigger]);

  // Push notification permission handler
  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
    }
  };

  // Voice Command Handlers & State Sync Refs (placed above worker to avoid hoisting / closure issues)
  const currentStepIndexRef = useRef(currentStepIndex);
  const activeRecipeRef = useRef(activeRecipe);
  const timerStateRef = useRef(timerState);
  const resumeTimerRef = useRef<(() => void) | null>(null);
  const pauseTimerRef = useRef<(() => void) | null>(null);
  const handleStepChangeRef = useRef<((index: number) => void) | null>(null);

  useEffect(() => {
    currentStepIndexRef.current = currentStepIndex;
  }, [currentStepIndex]);

  useEffect(() => {
    activeRecipeRef.current = activeRecipe;
  }, [activeRecipe]);

  useEffect(() => {
    timerStateRef.current = timerState;
  }, [timerState]);

  useEffect(() => {
    resumeTimerRef.current = resumeTimer;
    pauseTimerRef.current = pauseTimer;
    handleStepChangeRef.current = handleStepChange;
  });

  // Lock Screen & Notification shade Media Session API Syncer
  const syncMediaSession = (forcedTimeLeft?: number) => {
    if (!('mediaSession' in navigator)) return;
    const recipe = activeRecipeRef.current;
    if (!recipe) return;
    const idx = currentStepIndexRef.current;
    const step = recipe.steps[idx];
    if (!step) return;

    const secondsLeft = typeof forcedTimeLeft === 'number' ? forcedTimeLeft : timerStateRef.current.timeLeft;
    const isTimerActive = step.requires_timer;

    const rawInstruction = step.instruction.split('\n')[0] || '';
    const cleanInstruction = rawInstruction.trim();
    const truncatedInstruction = cleanInstruction.length > 40 ? cleanInstruction.substring(0, 37) + '...' : cleanInstruction;

    let titleStr = `Step ${step.step_number}: ${truncatedInstruction}`;
    if (isTimerActive && secondsLeft > 0) {
      const mins = Math.floor(secondsLeft / 60);
      const secs = secondsLeft % 60;
      const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      titleStr = `(${timeStr}) ${titleStr}`;
    } else if (isTimerActive && secondsLeft === 0) {
      titleStr = `⏰ DONE! - ${titleStr}`;
    }

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: titleStr,
        artist: 'SmartCook Live Assistant',
        album: recipe.title,
        artwork: [
          { src: recipe.cover_image, sizes: '512x512', type: 'image/jpeg' }
        ]
      });
    } catch (err) {
      console.warn("Media Session update error:", err);
    }
  };

  // Text-to-Speech Smart Narrator (SpeechSynthesis API)
  const narrateStep = (instruction: string) => {
    if (isMuted) return;
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        
        // Split text by paragraphs to process language per-paragraph
        const paragraphs = instruction.split('\n\n');
        paragraphs.forEach((para) => {
          const text = para.trim();
          if (!text) return;
          
          const utterance = new SpeechSynthesisUtterance(text);
          // Auto-detect Hindi vs English
          const isHindi = /[\u0900-\u097F]/.test(text);
          utterance.lang = isHindi ? 'hi-IN' : 'en-IN';
          utterance.rate = 0.90; // Optimal cooking pace
          window.speechSynthesis.speak(utterance);
        });
      }
    } catch (err) {
      console.warn("Smart narrator error:", err);
    }
  };

  const speakText = (msg: string) => {
    if (isMuted) return;
    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(msg);
        const isHindi = /[\u0900-\u097F]/.test(msg);
        utterance.lang = isHindi ? 'hi-IN' : 'en-IN';
        utterance.rate = 0.95;
        window.speechSynthesis.speak(utterance);
      }
    } catch (err) {
      console.warn("TTS error:", err);
    }
  };

  // Unified Media Session & Silent Audio Loop Controller
  useEffect(() => {
    if (viewMode === 'cooking' && activeRecipe) {
      // 1. Start silent audio loop to keep browser media context alive
      startSilentLoop();

      // 2. Setup Action Handlers
      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.setActionHandler('play', () => {
            if (resumeTimerRef.current) resumeTimerRef.current();
          });
          navigator.mediaSession.setActionHandler('pause', () => {
            if (pauseTimerRef.current) pauseTimerRef.current();
          });
          navigator.mediaSession.setActionHandler('previoustrack', () => {
            const idx = currentStepIndexRef.current;
            if (idx > 0 && handleStepChangeRef.current) {
              handleStepChangeRef.current(idx - 1);
            }
          });
          navigator.mediaSession.setActionHandler('nexttrack', () => {
            const idx = currentStepIndexRef.current;
            const recipe = activeRecipeRef.current;
            if (recipe && idx < recipe.steps.length - 1 && handleStepChangeRef.current) {
              handleStepChangeRef.current(idx + 1);
            }
          });
        } catch (err) {
          console.warn('Error setting Media Session handlers:', err);
        }
      }

      // 3. Sync initial media session metadata
      syncMediaSession();
    } else {
      // Clean up when leaving cooking mode
      stopSilentLoop();
      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.setActionHandler('play', null);
          navigator.mediaSession.setActionHandler('pause', null);
          navigator.mediaSession.setActionHandler('previoustrack', null);
          navigator.mediaSession.setActionHandler('nexttrack', null);
        } catch (e) {}
      }
    }

    return () => {
      stopSilentLoop();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [viewMode, activeRecipe]);

  // Read instructions aloud & sync lock screen when step changes
  useEffect(() => {
    if (viewMode === 'cooking' && activeRecipe) {
      const step = activeRecipe.steps[currentStepIndex];
      if (step) {
        narrateStep(step.instruction);
        syncMediaSession();
      }
    }
  }, [currentStepIndex, viewMode, activeRecipe]);

  // Setup Web Worker for Bulletproof Background Timer
  useEffect(() => {
    workerRef.current = new Worker('/timer.worker.js');

    workerRef.current.onmessage = (e) => {
      const { type, timeLeft } = e.data;

      if (type === 'tick') {
        setTimerState((prev) => ({
          ...prev,
          timeLeft,
          isRunning: true,
          isPaused: false,
          isFinished: false,
        }));
        syncMediaSession(timeLeft);
      } else if (type === 'paused') {
        setTimerState((prev) => ({
          ...prev,
          timeLeft,
          isRunning: false,
          isPaused: true,
        }));
        syncMediaSession(timeLeft);
      } else if (type === 'finished') {
        setTimerState((prev) => ({
          ...prev,
          timeLeft: 0,
          isRunning: false,
          isPaused: false,
          isFinished: true,
        }));
        syncMediaSession(0);
        
        // Trigger multi-sensory alerts
        triggerAlerts();
      } else if (type === 'stopped') {
        setTimerState((prev) => ({
          ...prev,
          timeLeft: 0,
          isRunning: false,
          isPaused: false,
          isFinished: false,
        }));
        syncMediaSession(0);
      }
    };

    // Keep background timer synchronized with absolute timestamps on tab focus / wake up
    const handleSync = () => {
      if (workerRef.current) {
        workerRef.current.postMessage({ action: 'sync' });
      }
    };

    window.addEventListener('visibilitychange', handleSync);
    window.addEventListener('focus', handleSync);

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
      window.removeEventListener('visibilitychange', handleSync);
      window.removeEventListener('focus', handleSync);
    };
  }, [isMuted]);

  const clearAllAlarmsAndEscalation = () => {
    stopAlarm();
    stopEscalatedAlarm();
    if (escalationTimeoutIdRef.current) {
      clearTimeout(escalationTimeoutIdRef.current);
      escalationTimeoutIdRef.current = null;
    }
  };

  const isCriticalHighHeatStep = (stepText: string) => {
    const keywords = ["boil", "fry", "heat", "simmer", "saute", "sauté", "bake", "grill", "steam", "cook", "roast", "pan", "flame", "stove", "ghee", "oil", "उबाल", "तल", "भून", "सेक", "पका"];
    const text = stepText.toLowerCase();
    return keywords.some(keyword => text.includes(keyword));
  };

  // Audio & Notification Alerts execution
  const triggerAlerts = () => {
    // 1. Web Audio API alarm
    if (!isMuted) {
      playAlarm();
    }

    // 2. Local Push Notification
    if ('Notification' in window && Notification.permission === 'granted' && activeRecipe) {
      const currentStep = activeRecipe.steps[currentStepIndex];
      new Notification('SmartCook Timer Complete!', {
        body: `Step ${currentStep.step_number} Done! Proceed to the next cooking step.`,
        icon: activeRecipe.cover_image,
        tag: 'smartcook-timer'
      });
    }

    // 3. Safety Escalation Protocol (Feature F)
    if (activeRecipe) {
      const currentStep = activeRecipe.steps[currentStepIndex];
      if (currentStep && currentStep.requires_timer && isCriticalHighHeatStep(currentStep.instruction)) {
        if (escalationTimeoutIdRef.current) {
          clearTimeout(escalationTimeoutIdRef.current);
        }
        escalationTimeoutIdRef.current = setTimeout(() => {
          if (!isMuted) {
            playEscalatedAlarm();
            setVoiceFeedback("🚨 SAFETY CRITICAL: High-heat timer exceeded 45s without attention!");
            speakText("Warning: High heat cooking time exceeded! Please tend to your stove immediately.");
          }
        }, 45000); // 45 seconds escalation
      }
    }
  };

  const handleMuteToggle = () => {
    const newMute = !isMuted;
    setIsMuted(newMute);
    if (newMute) {
      clearAllAlarmsAndEscalation();
    } else {
      unlockAudio();
    }
  };

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setIsSpeechSupported(true);
    }
  }, []);

  const executeVoiceCommand = (command: string) => {
    const text = command.toLowerCase().trim();
    console.log("Processing voice command:", text);

    if (text.includes('next') || text.includes('forward') || text.includes('आगे') || text.includes('अगला')) {
      const idx = currentStepIndexRef.current;
      const recipe = activeRecipeRef.current;
      if (recipe && idx < recipe.steps.length - 1) {
        handleStepChange(idx + 1);
        setVoiceFeedback("Action: Next step");
        speakText("Going to next step.");
        return true;
      } else {
        setVoiceFeedback("Already on the final step");
        speakText("This is already the last step.");
      }
    } else if (text.includes('previous') || text.includes('back') || text.includes('पीछे') || text.includes('पिछला')) {
      const idx = currentStepIndexRef.current;
      if (idx > 0) {
        handleStepChange(idx - 1);
        setVoiceFeedback("Action: Previous step");
        speakText("Going back one step.");
        return true;
      } else {
        setVoiceFeedback("Already on the first step");
        speakText("This is already the first step.");
      }
    } else if (text.includes('repeat') || text.includes('instruction') || text.includes('पढ़ें') || text.includes('दोहराएं')) {
      const idx = currentStepIndexRef.current;
      const recipe = activeRecipeRef.current;
      if (recipe && recipe.steps[idx]) {
        const instruction = recipe.steps[idx].instruction;
        const englishInstruction = instruction.split('\n\n')[0] || instruction;
        setVoiceFeedback("Action: Repeating instructions");
        speakText(englishInstruction);
        return true;
      }
    } else if (text.includes('pause') || text.includes('stop') || text.includes('रोकें') || text.includes('रुकें') || text.includes('रोको')) {
      const recipe = activeRecipeRef.current;
      const idx = currentStepIndexRef.current;
      if (recipe && recipe.steps[idx] && recipe.steps[idx].requires_timer) {
        pauseTimer();
        setVoiceFeedback("Action: Paused timer");
        speakText("Timer paused.");
        return true;
      } else {
        setVoiceFeedback("No active timer to pause");
        speakText("There is no active timer for this step.");
      }
    } else if (text.includes('resume') || text.includes('start') || text.includes('chalu') || text.includes('चालू') || text.includes('शुरू')) {
      const recipe = activeRecipeRef.current;
      const idx = currentStepIndexRef.current;
      if (recipe && recipe.steps[idx] && recipe.steps[idx].requires_timer) {
        if (timerStateRef.current.isPaused) {
          resumeTimer();
          setVoiceFeedback("Action: Resumed timer");
          speakText("Timer resumed.");
        } else {
          startTimer(recipe.steps[idx].duration_seconds);
          setVoiceFeedback("Action: Started timer");
          speakText("Timer started.");
        }
        return true;
      } else {
        setVoiceFeedback("No timer needed for this step");
        speakText("No timer is needed for this step.");
      }
    } else if (text.includes('reset') || text.includes('restart') || text.includes('फिर से')) {
      const recipe = activeRecipeRef.current;
      const idx = currentStepIndexRef.current;
      if (recipe && recipe.steps[idx] && recipe.steps[idx].requires_timer) {
        startTimer(recipe.steps[idx].duration_seconds);
        setVoiceFeedback("Action: Reset timer");
        speakText("Timer reset.");
        return true;
      } else {
        setVoiceFeedback("No active timer to reset");
        speakText("No timer is active on this step.");
      }
    } else if (text.includes('mute') || text.includes('shant') || text.includes('मौन')) {
      setIsMuted(true);
      stopAlarm();
      setVoiceFeedback("Action: Muted sound");
      return true;
    } else if (text.includes('unmute') || text.includes('आवाज़')) {
      setIsMuted(false);
      unlockAudio();
      setVoiceFeedback("Action: Unmuted sound");
      speakText("Sound active.");
      return true;
    }

    setVoiceFeedback(`Heard: "${command}" (Unrecognized command)`);
    return false;
  };

  useEffect(() => {
    if (viewMode !== 'cooking' || !isVoiceActive) {
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError("Speech recognition is not supported in this browser. Please use Chrome, Safari or Edge.");
      return;
    }

    let recognition: any = null;
    let shouldRestart = true;

    try {
      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-IN';

      recognition.onstart = () => {
        setVoiceError('');
        setVoiceFeedback('Listening for commands hands-free...');
      };

      recognition.onresult = (event: any) => {
        const lastResultIndex = event.results.length - 1;
        const transcript = event.results[lastResultIndex][0].transcript;
        if (transcript) {
          executeVoiceCommand(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setVoiceError('Microphone permission denied. Please allow microphone access or use the manual simulator below.');
          setIsVoiceActive(false);
          shouldRestart = false;
        } else if (event.error === 'no-speech') {
          // Standard quiet timeout
        } else {
          setVoiceError(`Speech error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        if (shouldRestart && isVoiceActive && viewMode === 'cooking') {
          try {
            recognition.start();
          } catch (e) {
            console.warn('Error restarting recognition:', e);
          }
        }
      };

      recognition.start();
    } catch (err: any) {
      console.warn('Recognition initiation failed:', err);
      setVoiceError(err?.message || 'Failed to start recognition engine.');
    }

    return () => {
      shouldRestart = false;
      if (recognition) {
        try {
          recognition.abort();
        } catch (e) {
          // Ignore
        }
      }
    };
  }, [viewMode, isVoiceActive]);

  // Timer Control actions routed to the Background Worker
  const startTimer = (duration: number) => {
    unlockAudio();
    if (workerRef.current) {
      setTimerState((prev) => ({ ...prev, totalDuration: duration }));
      workerRef.current.postMessage({ action: 'start', duration });
    }
  };

  const pauseTimer = () => {
    if (workerRef.current) {
      workerRef.current.postMessage({ action: 'pause' });
    }
  };

  const resumeTimer = () => {
    unlockAudio();
    if (workerRef.current) {
      workerRef.current.postMessage({ action: 'resume' });
    }
  };

  const stopActiveTimer = () => {
    if (workerRef.current) {
      workerRef.current.postMessage({ action: 'stop' });
      clearAllAlarmsAndEscalation();
    }
  };

  const getCleanShoppingItem = (name: string) => {
    // strip punctuation, common words, parenthetical notes
    let clean = name.replace(/\([^)]*\)/g, ''); // remove parentheses content
    clean = clean.split(',')[0]; // remove anything after commas
    const stopwords = [
      'fresh', 'organic', 'raw', 'gently', 'chopped', 'sliced', 'diced', 
      'pure', 'finely', 'grated', 'powder', 'chilled', 'warm', 'cold', 
      'melted', 'crushed', 'dry', 'dried', 'whole', 'leaves', 'sauce', 
      'paste', 'oil', 'extra virgin', 'unsalted', 'salted', 'cubes', 'cloves', 
      'grated', 'finely chopped', 'chopped', 'diced', 'peeled', 'mashed'
    ];
    stopwords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      clean = clean.replace(regex, '');
    });
    return clean.replace(/\s+/g, ' ').trim();
  };

  // Navigation Logic
  const checkRecipePremiumAccess = (recipe: Recipe): boolean => {
    if (recipe.isPremium && !currentUser?.isPremium) {
      if (!currentUser) {
        setIsAuthModalOpen(true);
      } else {
        setIsUpgradeModalOpen(true);
      }
      return false;
    }
    return true;
  };

  const handleSelectRecipe = (recipe: Recipe) => {
    if (!checkRecipePremiumAccess(recipe)) return;
    setSelectedRecipe(recipe);
    setServings(recipe.servings_base);
    setCheckedIngredients({});
    setViewMode('detail');
  };

  const handleApplySubstitution = (recipeId: string, originalName: string, subName: string, ratioStr: string) => {
    let multiplier = 1;
    const parts = ratioStr.split(':');
    if (parts.length === 2) {
      const baseVal = parseFloat(parts[0]);
      const subVal = parseFloat(parts[1]);
      if (!isNaN(baseVal) && !isNaN(subVal) && baseVal > 0) {
        multiplier = subVal / baseVal;
      }
    }
    setIngredientSubstitutions(prev => ({
      ...prev,
      [`${recipeId}_${originalName}`]: { name: subName, multiplier }
    }));
  };

  const handleResetSubstitution = (recipeId: string, originalName: string) => {
    setIngredientSubstitutions(prev => {
      const copy = { ...prev };
      delete copy[`${recipeId}_${originalName}`];
      return copy;
    });
  };

  const checkLongTermPrep = (recipe: Recipe): string[] => {
    const warnings: string[] = [];
    const keywords = [
      { english: 'marinate', hindi: 'मैरीनेट', label: 'Requires Marination / मैरीनेट की आवश्यकता है' },
      { english: 'soak', hindi: 'भिगो', label: 'Requires Soaking / भिगोने की आवश्यकता है' },
      { english: 'overnight', hindi: 'रातभर', label: 'Requires Overnight resting / रात भर रखने की आवश्यकता है' },
      { english: 'hours', hindi: 'घंटे', label: 'Requires Hours of resting / कुछ घंटों की तैयारी' }
    ];

    if (recipe.description) {
      const descLower = recipe.description.toLowerCase();
      keywords.forEach(kw => {
        if (descLower.includes(kw.english) || descLower.includes(kw.hindi)) {
          warnings.push(`Description mentions: "${kw.label}"`);
        }
      });
    }

    recipe.ingredients.forEach(ing => {
      const ingLower = ing.name.toLowerCase();
      keywords.forEach(kw => {
        if (ingLower.includes(kw.english) || ingLower.includes(kw.hindi)) {
          warnings.push(`Ingredient Checklist: "${kw.label}" (${ing.name})`);
        }
      });
    });

    recipe.steps.forEach((step, idx) => {
      const stepLower = step.instruction.toLowerCase();
      keywords.forEach(kw => {
        if (stepLower.includes(kw.english) || stepLower.includes(kw.hindi)) {
          warnings.push(`Step ${idx + 1} mentions: "${kw.label}"`);
        }
      });
      
      if (step.requires_timer && step.duration_seconds >= 900) {
        const mins = Math.floor(step.duration_seconds / 60);
        warnings.push(`Step ${idx + 1} has a long waiting period of ${mins} minutes.`);
      }
    });

    return Array.from(new Set(warnings));
  };

  const confirmStartCooking = () => {
    if (!pendingCookingRecipe) return;
    const recipe = pendingCookingRecipe;
    setPreFlightModalOpen(false);
    setPendingCookingRecipe(null);

    unlockAudio();
    setActiveRecipe(recipe);
    setCurrentStepIndex(0);
    setServings(recipe.servings_base);
    setCheckedIngredients({});
    setViewMode('cooking');

    const firstStep = recipe.steps[0];
    if (firstStep && firstStep.requires_timer) {
      startTimer(firstStep.duration_seconds);
    } else {
      stopActiveTimer();
    }
  };

  const handleStartCooking = (recipe: Recipe) => {
    if (!checkRecipePremiumAccess(recipe)) return;
    const warnings = checkLongTermPrep(recipe);
    if (warnings.length > 0) {
      setPendingCookingRecipe(recipe);
      setPreFlightWarnings(warnings);
      setPreFlightModalOpen(true);
      
      const alertMsg = "Alert! This recipe contains long-term preparation parameters like marinating or soaking. Please check the warnings before proceeding.";
      speakText(alertMsg);
    } else {
      unlockAudio();
      setActiveRecipe(recipe);
      setCurrentStepIndex(0);
      setServings(recipe.servings_base);
      setCheckedIngredients({});
      setViewMode('cooking');

      // Auto-start timer if required on the first step
      const firstStep = recipe.steps[0];
      if (firstStep && firstStep.requires_timer) {
        startTimer(firstStep.duration_seconds);
      } else {
        stopActiveTimer();
      }
    }
  };

  const handleStepChange = (index: number) => {
    unlockAudio();
    if (!activeRecipe) return;
    clearAllAlarmsAndEscalation(); // stop any ringing alarm or pending escalation
    setCurrentStepIndex(index);
    const step = activeRecipe.steps[index];
    if (step && step.requires_timer) {
      startTimer(step.duration_seconds);
    } else {
      stopActiveTimer();
    }
  };

  const handleIngredientCheck = (ingName: string) => {
    setCheckedIngredients((prev) => ({
      ...prev,
      [ingName]: !prev[ingName],
    }));
  };

  // Helper to scale quantities
  const scaleQuantity = (qty: number, baseServings: number) => {
    if (!qty) return 0;
    const factor = servings / baseServings;
    const result = qty * factor;
    // Format elegantly (e.g. 1.25, 2, or 1.5)
    return Math.round(result * 100) / 100;
  };

  // Format timer seconds into MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Categories list
  const categories: Category[] = ['Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Desserts', 'Fast Food', 'Beverages'];

  // Chef Secret generator based on categories
  const getChefSecret = (category: string) => {
    switch (category) {
      case 'Dinner':
        return "Basting with melted butter or ghee in the final 2 minutes adds a professional clay-oven glaze and deep smoky aroma.";
      case 'Breakfast':
        return "Always wash poha or rice gently. Do not rub, or the flakes will disintegrate during sautéing.";
      case 'Lunch':
        return "A tiny pinch of Kasuri Methi crushed between your palms at the very end elevates the gravy to restaurant grade.";
      case 'Snacks':
        return "Frying samosas or pakoras on low-medium heat creates a crisp, bubbly crust that doesn't go soggy.";
      case 'Desserts':
        return "Use ingredients at absolute room temperature to ensure perfect baking emulsions and gooey centers.";
      case 'Beverages':
        return "Slowly brewing tea on a gentle flame allows ginger juices and cardamom oils to fully infuse without evaporating the milk volume.";
      default:
        return "High-heat flash cooking locks in color and crunch for veggies. Avoid lid steaming unless recipe states so.";
    }
  };

  // Featured Recipe of the Day
  const featuredRecipe = recipes[0] || INITIAL_RECIPES[0];

  const sponsorIndex = currentStepIndex % SPONSORS_DATA.length;
  const activeSponsor = SPONSORS_DATA[sponsorIndex];

  return (
    <div id="smartcook-app" className="min-h-screen bg-[#FDFCFB] text-[#1A1A1A] flex flex-col font-sans">
      
      {/* Dynamic Native Style Banner */}
      {viewMode !== 'cooking' && viewMode !== 'admin' && (
        <div className="bg-orange-500 py-2 px-4 text-center text-white text-xs font-medium tracking-wide flex items-center justify-center gap-3">
          <Sparkles className="w-4 h-4 animate-bounce" />
          <span>Experience cooking with 100% accurate, sleep-proof background timers.</span>
          <button 
            onClick={requestNotificationPermission}
            className="underline hover:text-orange-100 font-semibold cursor-pointer ml-2"
          >
            {notificationPermission === 'granted' ? 'Notifications Active' : 'Enable Push Alerts'}
          </button>
        </div>
      )}

      {/* Sticky Top Navbar */}
      {viewMode !== 'cooking' && viewMode !== 'admin' && (
        <nav className="sticky top-0 z-50 h-16 px-4 md:px-8 border-b border-gray-100 flex items-center justify-between bg-white/95 backdrop-blur-md shrink-0 shadow-sm transition-all">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setViewMode('home')}>
            <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center shadow-md shadow-orange-500/20">
              <div className="w-4 h-4 border-2 border-white rounded-md"></div>
            </div>
            <span className="text-xl font-extrabold tracking-tight text-gray-900">
              SmartCook<span className="text-orange-500">.</span>
            </span>
          </div>

          {/* Quick Universal Search */}
          <div className="flex-1 max-w-md mx-6 md:mx-12 hidden sm:block">
            <div className="relative">
              <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-gray-400">
                <Search className="w-4 h-4" />
              </div>
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ingredients, category, or title..." 
                className="w-full bg-gray-50 border border-gray-200/80 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-gray-800 placeholder:text-gray-400"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Background running timer indicator (Global floating access) */}
            {timerState.isRunning && activeRecipe && (
              <button 
                onClick={() => setViewMode('cooking')}
                className="flex items-center gap-2 bg-orange-50 border border-orange-100 px-3 py-1.5 rounded-full text-xs font-semibold text-orange-600 animate-pulse hover:bg-orange-100 transition-colors"
              >
                <Timer className="w-3.5 h-3.5" />
                <span>Cooking Active: {formatTime(timerState.timeLeft)}</span>
              </button>
            )}

            {/* Notification Permission Quick Icon */}
            {notificationPermission !== 'granted' && (
              <button 
                onClick={requestNotificationPermission}
                className="p-2 text-gray-400 hover:text-orange-500 rounded-full hover:bg-gray-100 transition-colors relative"
                title="Enable Push Notifications"
              >
                <Bell className="w-5 h-5" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-500 rounded-full animate-ping"></span>
              </button>
            )}

            {/* Mute/Unmute Audio alarm global toggle */}
            <button 
              onClick={handleMuteToggle}
              className={`p-2 rounded-full transition-all ${isMuted ? 'text-red-500 bg-red-50 hover:bg-red-100' : 'text-gray-400 hover:bg-gray-100 hover:text-orange-500'}`}
              title={isMuted ? 'Unmute Alarms' : 'Mute Alarms'}
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>

            {/* Admin Database Portal button */}
            <button 
              onClick={() => setViewMode('admin')}
              className="p-2 rounded-full text-gray-400 hover:bg-gray-100 hover:text-orange-500 transition-all cursor-pointer"
              title="Admin Database Portal"
            >
              <Database className="w-5 h-5" />
            </button>

            {currentUser ? (
              <div className="flex items-center gap-3">
                <div 
                  className="text-right hidden md:block cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => setViewMode('profile')}
                >
                  <div className="text-xs font-black text-gray-900 leading-tight">
                    {currentUser.name}
                  </div>
                  <div className="flex items-center justify-end gap-1 mt-0.5">
                    {currentUser.isPremium ? (
                      <span className="bg-amber-100 text-amber-800 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border border-amber-200 uppercase tracking-widest flex items-center gap-0.5">
                        <Sparkles className="w-2.5 h-2.5 fill-amber-500 text-amber-500 animate-pulse" />
                        PRO
                      </span>
                    ) : (
                      <span className="bg-gray-100 text-gray-600 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border border-gray-200 uppercase tracking-widest">
                        FREE
                      </span>
                    )}
                  </div>
                </div>

                <div 
                  onClick={() => setViewMode('profile')}
                  className={`w-10 h-10 rounded-full border-2 shadow-sm flex items-center justify-center font-bold text-sm transition-all cursor-pointer hover:ring-2 hover:ring-orange-500/30 overflow-hidden ${
                    currentUser.isPremium 
                      ? 'bg-amber-50 border-amber-400 text-amber-600' 
                      : 'bg-orange-50 border-orange-200 text-orange-600'
                  }`}
                  title={`${currentUser.name} (${currentUser.isPremium ? 'Pro Member' : 'Free Member'} - Click to view Profile)`}
                >
                  {currentUser.photoURL ? (
                    <img 
                      src={currentUser.photoURL} 
                      referrerPolicy="no-referrer"
                      alt={currentUser.name} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    currentUser.name ? currentUser.name.substring(0, 2).toUpperCase() : 'US'
                  )}
                </div>

                {!currentUser.isPremium && (
                  <button
                    onClick={() => setIsUpgradeModalOpen(true)}
                    className="hidden sm:flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-full text-xs font-bold shadow-md shadow-orange-500/10 cursor-pointer transition-all"
                  >
                    <Sparkles className="w-3 h-3 fill-white" />
                    UPGRADE
                  </button>
                )}

                <button
                  onClick={handleLogout}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all cursor-pointer"
                  title="Log Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-full text-xs font-bold transition-all shadow-md shadow-orange-500/20 cursor-pointer"
                >
                  Login / Sign Up
                </button>
                <button
                  onClick={() => setIsUpgradeModalOpen(true)}
                  className="hidden sm:flex items-center gap-1 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-full text-xs font-extrabold shadow-md shadow-orange-500/15 cursor-pointer transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5 fill-white" />
                  GO PRO
                </button>
              </div>
            )}
          </div>
        </nav>
      )}

      {/* MOBILE ONLY SEARCH OVERLAY */}
      {viewMode === 'home' && (
        <div className="px-4 py-3 bg-white border-b border-gray-100 sm:hidden">
          <div className="relative">
            <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-gray-400">
              <Search className="w-4 h-4" />
            </div>
            <input 
              id="mobile-search-input"
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search recipes or ingredients..." 
              className="w-full bg-gray-50 border border-gray-200 rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-gray-800 placeholder:text-gray-400"
            />
          </div>
        </div>
      )}

      {/* VIEW: HOME DASHBOARD */}
      {viewMode === 'home' && (
        <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 max-w-7xl mx-auto w-full space-y-8 animate-fade-in">
          
          {/* HERO BANNER SECTION (Recipe of the Day) */}
          {featuredRecipe && (
            <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-gray-900 to-black border border-gray-800 shadow-xl group">
              <div className="absolute inset-0 bg-cover bg-center opacity-40 group-hover:scale-105 transition-transform duration-1000" style={{ backgroundImage: `url(${featuredRecipe.cover_image})` }}></div>
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"></div>
              
              <div className="relative z-10 p-6 md:p-12 flex flex-col justify-end min-h-[360px] md:min-h-[460px] max-w-2xl text-white">
                <div className="flex items-center gap-2 mb-4">
                  <span className="px-3 py-1 bg-orange-500 text-white rounded-full text-xs font-bold uppercase tracking-wider">Recipe of the Day</span>
                  <span className="flex items-center gap-1 text-xs text-orange-200 font-medium">
                    <Star className="w-3.5 h-3.5 fill-orange-400 text-orange-400" />
                    <span>{featuredRecipe.rating} ({featuredRecipe.reviews_count} reviews)</span>
                  </span>
                </div>
                
                <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4 leading-tight">
                  {featuredRecipe.title}
                </h1>
                
                <p className="text-sm md:text-base text-gray-300 mb-6 line-clamp-3">
                  {featuredRecipe.description}
                </p>
                
                <div className="flex flex-wrap items-center gap-4">
                  <button 
                    onClick={() => handleStartCooking(featuredRecipe)}
                    className="px-6 py-3.5 bg-orange-500 hover:bg-orange-600 text-white rounded-full font-bold text-sm tracking-wide transition-all shadow-lg shadow-orange-500/20 flex items-center gap-2 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    START LIVE COOKING
                  </button>
                  <button 
                    onClick={() => handleSelectRecipe(featuredRecipe)}
                    className="px-6 py-3.5 bg-white/15 hover:bg-white/25 border border-white/20 text-white rounded-full font-bold text-sm tracking-wide transition-all flex items-center gap-2 cursor-pointer"
                  >
                    <BookOpen className="w-4 h-4" />
                    VIEW INGREDIENTS
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* CATEGORY CAROUSEL */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black tracking-tight text-gray-900 uppercase">Explore Categories</h2>
              <span className="text-xs text-gray-400 font-medium">1000+ recipes available</span>
            </div>
            
            <div className="flex gap-4 overflow-x-auto pb-3 no-scrollbar -mx-4 px-4">
              <button 
                onClick={() => setActiveCategory('All')}
                className={`px-5 py-3 rounded-full font-bold text-sm shrink-0 transition-all border ${
                  activeCategory === 'All' 
                    ? 'bg-orange-500 border-orange-500 text-white shadow-md shadow-orange-500/10' 
                    : 'bg-white border-gray-200 text-gray-600 hover:border-orange-500'
                }`}
              >
                All Recipes
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-5 py-3 rounded-full font-bold text-sm shrink-0 transition-all border flex items-center gap-2 ${
                    activeCategory === cat 
                      ? 'bg-orange-500 border-orange-500 text-white shadow-md shadow-orange-500/10' 
                      : 'bg-white border-gray-200 text-gray-600 hover:border-orange-500'
                  }`}
                >
                  <span>{cat}</span>
                </button>
              ))}
            </div>
          </div>

          {/* FRIDGE INVENTORY SEARCH (Feature E) */}
          <div className="bg-white border border-gray-200 rounded-[32px] p-6 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-lg">
                ❄️
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-gray-900">Fridge Inventory Search</h3>
                <p className="text-xs text-gray-500">Select multiple ingredients from your kitchen. We'll rank 1,000+ recipes by ingredient overlap!</p>
              </div>
            </div>

            {/* Quick Suggestions */}
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Quick Select Common Items</span>
              <div className="flex flex-wrap gap-2">
                {['Potato', 'Tomato', 'Onion', 'Garlic', 'Paneer', 'Chicken', 'Rice', 'Flour', 'Milk', 'Egg'].map(ing => {
                  const isSelected = fridgeIngredients.some(item => item.toLowerCase() === ing.toLowerCase());
                  return (
                    <button
                      key={ing}
                      onClick={() => {
                        if (isSelected) {
                          setFridgeIngredients(prev => prev.filter(item => item.toLowerCase() !== ing.toLowerCase()));
                        } else {
                          setFridgeIngredients(prev => [...prev, ing]);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border cursor-pointer ${
                        isSelected 
                          ? 'bg-orange-500 border-orange-500 text-white shadow-sm shadow-orange-500/10' 
                          : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-orange-500'
                      }`}
                    >
                      {isSelected ? '✓ ' : ''}{ing}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Manual entry */}
            <div className="flex items-center gap-2 max-w-md">
              <input 
                type="text"
                placeholder="Type and add other ingredient..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const val = e.currentTarget.value.trim();
                    if (val && !fridgeIngredients.some(item => item.toLowerCase() === val.toLowerCase())) {
                      setFridgeIngredients(prev => [...prev, val]);
                      e.currentTarget.value = '';
                    }
                  }
                }}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-gray-800 placeholder:text-gray-400"
              />
              <button 
                onClick={(e) => {
                  const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                  const val = input.value.trim();
                  if (val && !fridgeIngredients.some(item => item.toLowerCase() === val.toLowerCase())) {
                    setFridgeIngredients(prev => [...prev, val]);
                    input.value = '';
                  }
                }}
                className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-bold transition-colors shrink-0 cursor-pointer"
              >
                Add
              </button>
            </div>

            {/* Currently Active Fridge List */}
            {fridgeIngredients.length > 0 && (
              <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-400 font-semibold mr-1">Your Fridge ({fridgeIngredients.length}):</span>
                {fridgeIngredients.map(ing => (
                  <span 
                    key={ing}
                    className="bg-orange-50 border border-orange-100 text-orange-700 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5"
                  >
                    <span>{ing}</span>
                    <button 
                      onClick={() => setFridgeIngredients(prev => prev.filter(item => item !== ing))}
                      className="text-orange-400 hover:text-orange-600 font-black text-xs cursor-pointer focus:outline-none"
                    >
                      ✕
                    </button>
                  </span>
                ))}
                <button 
                  onClick={() => setFridgeIngredients([])}
                  className="text-xs text-red-500 hover:text-red-600 font-bold ml-2 underline focus:outline-none cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            )}
          </div>

          {/* HEALTH & DIETARY MICRO-FILTERING (Feature G) */}
          <div className="bg-white border border-gray-200 rounded-[32px] p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-lg">
                  🥗
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-gray-900 font-sans">Health & Dietary Micro-Filtering</h3>
                  <p className="text-xs text-gray-500">Enable strict medical or nutritional tags to instantly parse and narrow down recipes.</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {(dietaryDiabetic || dietaryKeto || dietaryHighProtein) && (
                  <button 
                    onClick={() => {
                      setDietaryDiabetic(false);
                      setDietaryKeto(false);
                      setDietaryHighProtein(false);
                    }}
                    className="text-xs font-bold text-red-500 hover:text-red-600 underline focus:outline-none cursor-pointer"
                  >
                    Clear Dietary Filters
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Diabetic Friendly Toggle */}
              <button
                onClick={() => setDietaryDiabetic(!dietaryDiabetic)}
                className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between h-28 cursor-pointer ${
                  dietaryDiabetic 
                    ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-sm shadow-emerald-500/5' 
                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-emerald-300'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xl">🩺</span>
                  <div className={`w-2.5 h-2.5 rounded-full ${dietaryDiabetic ? 'bg-emerald-600 animate-pulse' : 'bg-gray-300'}`} />
                </div>
                <div>
                  <span className="text-xs font-black uppercase tracking-wider block font-sans">Diabetic Friendly</span>
                  <span className="text-[10px] text-gray-400 font-medium line-clamp-1">Low Sugar & Low Glycemic Index</span>
                </div>
              </button>

              {/* Keto Approved Toggle */}
              <button
                onClick={() => setDietaryKeto(!dietaryKeto)}
                className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between h-28 cursor-pointer ${
                  dietaryKeto 
                    ? 'bg-amber-50 border-amber-500 text-amber-900 shadow-sm shadow-amber-500/5' 
                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-amber-300'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xl">🥑</span>
                  <div className={`w-2.5 h-2.5 rounded-full ${dietaryKeto ? 'bg-amber-600 animate-pulse' : 'bg-gray-300'}`} />
                </div>
                <div>
                  <span className="text-xs font-black uppercase tracking-wider block font-sans">Keto Approved</span>
                  <span className="text-[10px] text-gray-400 font-medium line-clamp-1">Ultra Low Carb & High Healthy Fats</span>
                </div>
              </button>

              {/* High Protein Toggle */}
              <button
                onClick={() => setDietaryHighProtein(!dietaryHighProtein)}
                className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between h-28 cursor-pointer ${
                  dietaryHighProtein 
                    ? 'bg-blue-50 border-blue-500 text-blue-900 shadow-sm shadow-blue-500/5' 
                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-blue-300'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xl">🥚</span>
                  <div className={`w-2.5 h-2.5 rounded-full ${dietaryHighProtein ? 'bg-blue-600 animate-pulse' : 'bg-gray-300'}`} />
                </div>
                <div>
                  <span className="text-xs font-black uppercase tracking-wider block font-sans">High Protein</span>
                  <span className="text-[10px] text-gray-400 font-medium line-clamp-1">Build muscle & recover faster</span>
                </div>
              </button>
            </div>
          </div>

          {/* RECIPE FEED GRID */}
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-gray-900">
                  {activeCategory === 'All' ? 'Trending Recipes' : `${activeCategory} Collection`}
                </h2>
                <p className="text-xs text-gray-400 mt-1">Sourced from top-tier professional chefs</p>
              </div>

              {/* Advanced Filtering */}
              <div className="flex gap-2">
                <select 
                  value={activeDifficulty} 
                  onChange={(e) => setActiveDifficulty(e.target.value)}
                  className="bg-white border border-gray-200 text-xs font-bold text-gray-600 px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                >
                  <option value="All">All Difficulties</option>
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>
            </div>

            {recipes.length === 0 ? (
              <div className="text-center py-16 bg-white border border-gray-100 rounded-3xl">
                <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-gray-700">No recipes matched your search</h3>
                <p className="text-sm text-gray-400 mt-1 max-w-sm mx-auto">Try using simplified terms or search by general ingredients like chicken, flour, onion, butter, etc.</p>
                <button 
                  onClick={() => { setSearchQuery(''); setActiveCategory('All'); setActiveDifficulty('All'); }}
                  className="mt-4 px-4 py-2 bg-orange-500 text-white rounded-full font-bold text-xs"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {recipes.map((recipe) => (
                  <div 
                    key={recipe._id}
                    onClick={() => handleSelectRecipe(recipe)}
                    className="bg-white border border-gray-200/60 rounded-[28px] overflow-hidden shadow-sm hover:shadow-xl hover:border-orange-500/30 transition-all group cursor-pointer flex flex-col relative"
                  >
                    {recipe.isPremium && !currentUser?.isPremium && (
                      <div className="absolute inset-0 z-20 bg-white/75 backdrop-blur-[5px] flex flex-col items-center justify-center p-4 text-center select-none" onClick={(e) => { e.stopPropagation(); if (!currentUser) { setIsAuthModalOpen(true); } else { setIsUpgradeModalOpen(true); } }}>
                        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 mb-2 shadow-sm border border-amber-200">
                          <Lock className="w-4 h-4 text-amber-700" />
                        </div>
                        <span className="text-[9px] font-black tracking-widest text-amber-800 uppercase mb-1">PRO MEMBERS ONLY</span>
                        <p className="text-xs font-black text-gray-900 px-2 leading-snug mb-3">
                          This recipe is for Pro members. Unlock for just ₹9.
                        </p>
                        <button 
                          onClick={(e) => { e.stopPropagation(); if (!currentUser) { setIsAuthModalOpen(true); } else { setIsUpgradeModalOpen(true); } }}
                          className="px-4 py-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 hover:from-amber-600 hover:via-orange-600 text-white rounded-full text-[9px] font-black uppercase tracking-wider shadow-md shadow-orange-500/10 cursor-pointer"
                        >
                          Unlock Now
                        </button>
                      </div>
                    )}
                    <div className="relative aspect-[16/10] overflow-hidden shrink-0">
                      <img 
                        src={recipe.cover_image} 
                        alt={recipe.title} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      {recipe.isPremium && (
                        <div className="absolute top-3 left-3 z-10">
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider text-amber-800 bg-amber-100 border border-amber-300 shadow-sm flex items-center gap-1.5">
                            <Lock className="w-3 h-3 text-amber-700 shrink-0" />
                            <span>PRO PREMIUM</span>
                          </span>
                        </div>
                      )}
                      <div className="absolute top-3 right-3">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white shadow-sm ${
                          recipe.difficulty === 'Easy' ? 'bg-emerald-500' :
                          recipe.difficulty === 'Medium' ? 'bg-orange-500' : 'bg-red-500'
                        }`}>
                          {recipe.difficulty}
                        </span>
                      </div>
                      {recipe.overlapScore !== undefined && recipe.overlapScore > 0 && (
                        <div className="absolute bottom-3 left-3 bg-green-600/95 backdrop-blur-sm text-white px-2.5 py-1 rounded-full text-[10px] font-black flex items-center gap-1 shadow-sm">
                          <Sparkles className="w-3 h-3 fill-white" />
                          <span>{recipe.overlapScore}% OVERLAP MATCH</span>
                        </div>
                      )}
                    </div>

                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div className="space-y-2">
                        <span className="text-[10px] uppercase font-bold tracking-widest text-orange-500">{recipe.category}</span>
                        <h3 className="text-base font-bold text-gray-900 group-hover:text-orange-500 transition-colors line-clamp-1">
                          {recipe.title}
                        </h3>
                        <p className="text-xs text-gray-500 line-clamp-2">
                          {recipe.description}
                        </p>
                      </div>

                      {/* Dietary & Macro-Nutritional Indicators (Feature G) */}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {recipe.is_diabetic_friendly && (
                          <span className="bg-emerald-50 text-emerald-700 text-[9px] font-black px-1.5 py-0.5 rounded border border-emerald-100 uppercase tracking-wider">🩺 Diabetic</span>
                        )}
                        {recipe.is_keto && (
                          <span className="bg-amber-50 text-amber-700 text-[9px] font-black px-1.5 py-0.5 rounded border border-amber-100 uppercase tracking-wider">🥑 Keto</span>
                        )}
                        {recipe.is_high_protein && (
                          <span className="bg-blue-50 text-blue-700 text-[9px] font-black px-1.5 py-0.5 rounded border border-blue-100 uppercase tracking-wider">🥚 Protein</span>
                        )}
                      </div>

                      {recipe.macros && (
                        <div className="mt-3 grid grid-cols-4 gap-1 text-center bg-gray-50 border border-gray-100 rounded-xl p-1.5 text-[10px]">
                          <div>
                            <span className="block text-[8px] text-gray-400 font-bold uppercase">Cal</span>
                            <span className="font-extrabold text-gray-700">{recipe.macros.calories}</span>
                          </div>
                          <div>
                            <span className="block text-[8px] text-gray-400 font-bold uppercase">Prot</span>
                            <span className="font-extrabold text-blue-700">{recipe.macros.protein}g</span>
                          </div>
                          <div>
                            <span className="block text-[8px] text-gray-400 font-bold uppercase">Carb</span>
                            <span className="font-extrabold text-amber-700">{recipe.macros.carbs}g</span>
                          </div>
                          <div>
                            <span className="block text-[8px] text-gray-400 font-bold uppercase">Fat</span>
                            <span className="font-extrabold text-purple-700">{recipe.macros.fats}g</span>
                          </div>
                        </div>
                      )}

                      <div className="pt-4 mt-4 border-t border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 font-semibold">
                          <Timer className="w-3.5 h-3.5 text-gray-400" />
                          <span>{recipe.total_time_minutes} Mins</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 fill-orange-400 text-orange-400" />
                          <span className="text-xs font-bold text-gray-800">{recipe.rating}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      )}

      {/* VIEW: DETAIL PAGE */}
      {viewMode === 'detail' && selectedRecipe && (
        <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 max-w-4xl mx-auto w-full space-y-8 animate-fade-in">
          <button 
            onClick={() => setViewMode('home')}
            className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-gray-900 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            BACK TO RECIPES
          </button>

          <div className="bg-white border border-gray-200 rounded-[32px] overflow-hidden shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 md:p-8">
              {/* Product Cover image column */}
              <div className="space-y-4">
                <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-inner border border-gray-100">
                  <img 
                    src={selectedRecipe.cover_image} 
                    alt={selectedRecipe.title} 
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex gap-3">
                  <div className="bg-gray-50 flex-1 p-3.5 rounded-xl text-center border border-gray-100">
                    <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Time</span>
                    <span className="text-sm font-extrabold text-gray-800">{selectedRecipe.total_time_minutes} Minutes</span>
                  </div>
                  <div className="bg-gray-50 flex-1 p-3.5 rounded-xl text-center border border-gray-100">
                    <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Difficulty</span>
                    <span className="text-sm font-extrabold text-gray-800">{selectedRecipe.difficulty}</span>
                  </div>
                </div>

                {/* Macro-Nutritional Profile (Feature G) */}
                {selectedRecipe.macros && (
                  <div className="bg-gray-50 border border-gray-200/60 rounded-2xl p-5 space-y-4 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <span className="text-xs font-black uppercase tracking-widest text-gray-400 font-sans">Nutritional Profile</span>
                      <div className="flex flex-wrap gap-1">
                        {selectedRecipe.is_diabetic_friendly && (
                          <span className="bg-emerald-50 text-emerald-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-emerald-100 uppercase tracking-wider">🩺 Diabetic</span>
                        )}
                        {selectedRecipe.is_keto && (
                          <span className="bg-amber-50 text-amber-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-amber-100 uppercase tracking-wider">🥑 Keto</span>
                        )}
                        {selectedRecipe.is_high_protein && (
                          <span className="bg-blue-50 text-blue-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-blue-100 uppercase tracking-wider">🥚 Protein</span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="bg-white p-2.5 rounded-xl border border-gray-100 shadow-sm">
                        <span className="block text-[10px] font-bold text-gray-400 uppercase">Cal</span>
                        <span className="text-sm font-extrabold text-gray-900">{selectedRecipe.macros.calories}</span>
                        <span className="block text-[8px] text-gray-400 font-mono">kcal</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-gray-100 shadow-sm">
                        <span className="block text-[10px] font-bold text-gray-400 uppercase text-blue-600">Prot</span>
                        <span className="text-sm font-extrabold text-blue-700">{selectedRecipe.macros.protein}g</span>
                        <span className="block text-[8px] text-gray-400 font-mono">{selectedRecipe.macros.protein * 4} cal</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-gray-100 shadow-sm">
                        <span className="block text-[10px] font-bold text-gray-400 uppercase text-amber-600">Carb</span>
                        <span className="text-sm font-extrabold text-amber-700">{selectedRecipe.macros.carbs}g</span>
                        <span className="block text-[8px] text-gray-400 font-mono">{selectedRecipe.macros.carbs * 4} cal</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-gray-100 shadow-sm">
                        <span className="block text-[10px] font-bold text-gray-400 uppercase text-purple-600">Fat</span>
                        <span className="text-sm font-extrabold text-purple-700">{selectedRecipe.macros.fats}g</span>
                        <span className="block text-[8px] text-gray-400 font-mono">{selectedRecipe.macros.fats * 9} cal</span>
                      </div>
                    </div>

                    {/* Progress bars to show macro distribution */}
                    <div className="space-y-1.5 pt-1">
                      <div className="text-[9px] font-black text-gray-400 uppercase tracking-wider flex justify-between">
                        <span>Calorie Distribution</span>
                        <span>Total: {((selectedRecipe.macros.protein * 4) + (selectedRecipe.macros.carbs * 4) + (selectedRecipe.macros.fats * 9))} kcal</span>
                      </div>
                      <div className="h-2.5 w-full bg-gray-200 rounded-full overflow-hidden flex">
                        <div 
                          style={{ width: `${(selectedRecipe.macros.protein * 4) / ((selectedRecipe.macros.protein * 4) + (selectedRecipe.macros.carbs * 4) + (selectedRecipe.macros.fats * 9)) * 100}%` }} 
                          className="bg-blue-500 h-full transition-all" 
                          title="Protein"
                        />
                        <div 
                          style={{ width: `${(selectedRecipe.macros.carbs * 4) / ((selectedRecipe.macros.protein * 4) + (selectedRecipe.macros.carbs * 4) + (selectedRecipe.macros.fats * 9)) * 100}%` }} 
                          className="bg-amber-500 h-full transition-all" 
                          title="Carbohydrates"
                        />
                        <div 
                          style={{ width: `${(selectedRecipe.macros.fats * 9) / ((selectedRecipe.macros.protein * 4) + (selectedRecipe.macros.carbs * 4) + (selectedRecipe.macros.fats * 9)) * 100}%` }} 
                          className="bg-purple-500 h-full transition-all" 
                          title="Fats"
                        />
                      </div>
                      <div className="flex justify-between text-[9px] text-gray-400 font-bold">
                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-blue-500 rounded-full" /> Protein</span>
                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-amber-500 rounded-full" /> Carbs</span>
                        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-purple-500 rounded-full" /> Fats</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Description and Servings Selection */}
              <div className="flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <span className="text-xs uppercase font-extrabold tracking-widest text-orange-500 bg-orange-50 px-3 py-1 rounded-full">
                    {selectedRecipe.category}
                  </span>
                  <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-gray-900">
                    {selectedRecipe.title}
                  </h1>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    {selectedRecipe.description}
                  </p>
                </div>

                <div className="bg-orange-50/50 p-4 rounded-2xl border border-orange-100/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-black text-orange-800 uppercase tracking-wider block">Scale Recipe Servings</span>
                      <span className="text-[10px] text-orange-600 font-medium">Scales ingredients live instantly!</span>
                    </div>
                    <div className="flex items-center gap-3 bg-white border border-orange-200 rounded-xl p-1">
                      <button 
                        onClick={() => setServings(prev => Math.max(1, prev - 1))}
                        className="w-8 h-8 flex items-center justify-center bg-gray-50 hover:bg-orange-100 text-orange-600 rounded-lg font-bold text-lg cursor-pointer transition-colors"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="font-extrabold text-lg w-6 text-center text-orange-900">{servings}</span>
                      <button 
                        onClick={() => setServings(prev => prev + 1)}
                        className="w-8 h-8 flex items-center justify-center bg-gray-50 hover:bg-orange-100 text-orange-600 rounded-lg font-bold text-lg cursor-pointer transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => handleStartCooking(selectedRecipe)}
                  className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-extrabold text-base tracking-wide transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-3 cursor-pointer"
                >
                  <Play className="w-5 h-5 fill-white" />
                  START LIVE COOKING NOW
                </button>
              </div>
            </div>

            {/* Ingredients Scaled checklist */}
            <div className="border-t border-gray-100 p-6 md:p-8 bg-gray-50/50">
              <h2 className="text-lg font-extrabold tracking-tight text-gray-900 mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-orange-500" />
                <span>Ingredients Prep Checklist ({servings} Servings)</span>
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {selectedRecipe.ingredients.map((ing, i) => {
                  const subKey = `${selectedRecipe._id}_${ing.name}`;
                  const activeSub = ingredientSubstitutions[subKey];
                  const qty = scaleQuantity(ing.quantity, selectedRecipe.servings_base);
                  const finalQty = activeSub ? Math.round(qty * activeSub.multiplier * 100) / 100 : qty;
                  const displayName = activeSub ? activeSub.name : ing.name;
                  const isChecked = checkedIngredients[ing.name];
                  const hasSubstitutes = ing.substitutes && ing.substitutes.length > 0;

                  return (
                    <div 
                      key={i} 
                      onClick={() => handleIngredientCheck(ing.name)}
                      className={`p-3 rounded-xl border flex flex-col gap-2 cursor-pointer transition-all ${
                        isChecked 
                          ? 'bg-emerald-50/50 border-emerald-200 text-emerald-800' 
                          : 'bg-white border-gray-200 text-gray-700 hover:border-orange-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                            isChecked ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 bg-white'
                          }`}>
                            {isChecked && <CheckCircle className="w-4 h-4" />}
                          </div>
                          <div>
                            <span className={`text-sm ${isChecked ? 'line-through opacity-60' : 'font-medium'}`}>
                              {displayName}
                            </span>
                            {activeSub && (
                              <span className="block text-[9px] text-amber-700 font-extrabold uppercase bg-amber-50 border border-amber-100 px-1 py-0.5 rounded-md mt-0.5 max-w-max">
                                🔄 substituted from {ing.name}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-bold text-gray-900">
                            {finalQty > 0 ? `${finalQty} ` : ''}{ing.unit}
                          </span>
                          
                          {hasSubstitutes && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!currentUser?.isPremium) {
                                  if (!currentUser) {
                                    setIsAuthModalOpen(true);
                                  } else {
                                    setIsUpgradeModalOpen(true);
                                  }
                                  return;
                                }
                                setOpenSubstituteMenu(openSubstituteMenu === subKey ? null : subKey);
                              }}
                              className="px-2 py-1 bg-orange-50 hover:bg-orange-100 text-orange-600 border border-orange-200 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer transition-all"
                            >
                              <span>🔄 Substitute</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Dropdown Menu */}
                      {hasSubstitutes && openSubstituteMenu === subKey && (
                        <div 
                          onClick={(e) => e.stopPropagation()}
                          className="bg-gray-50 border border-gray-200 rounded-xl p-2.5 space-y-1.5 mt-1 relative z-10"
                        >
                          <div className="text-[9px] font-black uppercase tracking-widest text-gray-400 px-1 mb-1">
                            Select Substitute Ingredient:
                          </div>
                          {activeSub && (
                            <button
                              onClick={() => {
                                handleResetSubstitution(selectedRecipe._id, ing.name);
                                setOpenSubstituteMenu(null);
                              }}
                              className="w-full text-left px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg font-bold flex items-center justify-between cursor-pointer border border-red-100"
                            >
                              <span>Original: {ing.name}</span>
                              <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-mono font-black">RESET</span>
                            </button>
                          )}
                          {ing.substitutes.map((sub: any, sIdx: number) => {
                            const isSelected = activeSub?.name === sub.name;
                            return (
                              <button
                                key={sIdx}
                                onClick={() => {
                                  handleApplySubstitution(selectedRecipe._id, ing.name, sub.name, sub.ratio);
                                  setOpenSubstituteMenu(null);
                                }}
                                className={`w-full text-left px-2 py-1.5 text-xs rounded-lg font-medium flex items-center justify-between cursor-pointer transition-colors border ${
                                  isSelected 
                                    ? 'bg-orange-100 border-orange-200 text-orange-950 font-extrabold' 
                                    : 'bg-white hover:bg-orange-50/50 border-gray-200 text-gray-700'
                                }`}
                              >
                                <span>{sub.name}</span>
                                <span className="text-[10px] bg-gray-200/85 text-gray-700 px-1.5 py-0.5 rounded font-mono font-black">Ratio {sub.ratio}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* FEATURE D: SMART INGREDIENT-TO-CART EXPORTER */}
            <div className="bg-white border border-gray-200 rounded-[32px] p-6 md:p-8 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center text-lg shrink-0">
                    🛒
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-gray-900">Smart Ingredient-to-Cart Exporter</h2>
                    <p className="text-xs text-gray-500">Algoritmically cleans ingredients and generates direct quick-commerce affiliate links.</p>
                  </div>
                </div>
                
                <button
                  onClick={() => {
                    const selectedList = selectedRecipe.ingredients
                      .filter(ing => !checkedIngredients[ing.name])
                      .map(ing => {
                        const subKey = `${selectedRecipe._id}_${ing.name}`;
                        const activeSub = ingredientSubstitutions[subKey];
                        const qty = scaleQuantity(ing.quantity, selectedRecipe.servings_base);
                        const finalQty = activeSub ? Math.round(qty * activeSub.multiplier * 100) / 100 : qty;
                        const displayName = activeSub ? activeSub.name : ing.name;
                        const cleanName = getCleanShoppingItem(displayName);
                        return `- ${finalQty > 0 ? `${finalQty} ` : ''}${ing.unit} ${cleanName}`;
                      })
                      .join('\n');
                    
                    if (selectedList) {
                      navigator.clipboard.writeText(selectedList);
                      alert("Optimized shopping list copied to clipboard!");
                    } else {
                      alert("All ingredients are checked or your shopping list is empty.");
                    }
                  }}
                  className="px-4 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 transition-colors cursor-pointer self-start sm:self-auto"
                >
                  Copy Shopping List
                </button>
              </div>

              <div className="bg-orange-50/40 border border-orange-100 rounded-2xl p-4 text-xs text-orange-800 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-extrabold block mb-0.5">Quick-Commerce Optimization Engine Active</span>
                  <span>Our parsing engine has stripped out prep instructions (like "finely chopped", "gently boiled") and scaled quantities based on servings to find direct matches on Blinkit, Zepto, and Instamart.</span>
                </div>
              </div>

              <div className="space-y-3">
                <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Select needed items for instant ordering</span>
                <div className="divide-y divide-gray-100">
                  {selectedRecipe.ingredients.map((ing, i) => {
                    const subKey = `${selectedRecipe._id}_${ing.name}`;
                    const activeSub = ingredientSubstitutions[subKey];
                    const qty = scaleQuantity(ing.quantity, selectedRecipe.servings_base);
                    const finalQty = activeSub ? Math.round(qty * activeSub.multiplier * 100) / 100 : qty;
                    const displayName = activeSub ? activeSub.name : ing.name;
                    const cleanName = getCleanShoppingItem(displayName);
                    const isChecked = checkedIngredients[ing.name]; 

                    return (
                      <div key={i} className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <input 
                            type="checkbox"
                            checked={!isChecked}
                            onChange={() => handleIngredientCheck(ing.name)}
                            className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500 cursor-pointer"
                          />
                          <div>
                            <span className={`text-sm font-bold ${isChecked ? 'text-gray-400 line-through opacity-60' : 'text-gray-800'}`}>
                              {cleanName}
                            </span>
                            <span className="text-xs text-gray-400 ml-2">
                              ({finalQty > 0 ? `${finalQty} ` : ''}{ing.unit} {displayName})
                            </span>
                          </div>
                        </div>

                        {/* Order Anchors */}
                        <div className="flex items-center gap-2 pl-7 md:pl-0">
                          <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider mr-1">Buy on:</span>
                          <a 
                            href={`https://blinkit.com/s/?q=${encodeURIComponent(cleanName)}`}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="px-2.5 py-1.5 bg-yellow-400 hover:bg-yellow-500 text-black font-extrabold text-[10px] rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                          >
                            <span>⚡ Blinkit</span>
                          </a>
                          <a 
                            href={`https://www.zepto.com/search?query=${encodeURIComponent(cleanName)}`}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-[10px] rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                          >
                            <span>🍇 Zepto</span>
                          </a>
                          <a 
                            href={`https://www.swiggy.com/instamart/search?query=${encodeURIComponent(cleanName)}`}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="px-2.5 py-1.5 bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-[10px] rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                          >
                            <span>🛒 Instamart</span>
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </main>
      )}

      {/* VIEW: LIVE INTERACTIVE FOCUS COOKING MODE (Bento Grid Theme) */}
      {viewMode === 'cooking' && activeRecipe && (
        <div className="flex-1 bg-[#FDFCFB] flex flex-col h-full max-h-screen overflow-hidden">
          
          {/* Header Navigation */}
          <nav className="h-16 px-4 md:px-8 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-white rounded-sm"></div>
              </div>
              <span className="text-xl font-bold tracking-tight text-gray-900">
                SmartCook<span className="text-orange-500">.</span>
              </span>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
                <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></span>
                <span>Live Cooking Mode</span>
              </div>
              
              <button 
                onClick={handleMuteToggle}
                className={`p-2 rounded-xl transition-all ${isMuted ? 'text-red-500 bg-red-50' : 'text-gray-400 hover:bg-gray-100'}`}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>

              <button 
                onClick={() => {
                  unlockAudio();
                  if (!currentUser?.isPremium) {
                    if (!currentUser) {
                      setIsAuthModalOpen(true);
                    } else {
                      setIsUpgradeModalOpen(true);
                    }
                    return;
                  }
                  setIsVoiceModalOpen(true);
                }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                  isVoiceActive 
                    ? 'bg-orange-500 text-white border-orange-500 animate-pulse' 
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
                title="Voice Commands Helper"
              >
                {isVoiceActive ? (
                  <Mic className="w-4 h-4 animate-bounce text-white" />
                ) : (
                  <Mic className="w-4 h-4 text-gray-500" />
                )}
                <span className="hidden sm:inline">Voice Assistant</span>
              </button>

              <button 
                onClick={() => { stopActiveTimer(); setViewMode('home'); }}
                className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                EXIT FOCUS
              </button>
            </div>
          </nav>

          {/* Bento Column Layout Container */}
          <main className="flex-1 p-4 md:p-6 grid grid-cols-1 md:grid-cols-12 gap-6 overflow-y-auto no-scrollbar">
            
            {/* Left Column: Recipe Overview Bento Box (Span 3) */}
            <div className="md:col-span-3 flex flex-col gap-6">
              <div className="bg-white border border-gray-200 rounded-[32px] p-6 shadow-sm flex flex-col gap-4 overflow-hidden">
                <img 
                  src={activeRecipe.cover_image} 
                  alt={activeRecipe.title} 
                  className="w-full aspect-video md:aspect-square object-cover rounded-2xl shrink-0"
                />
                
                <div className="space-y-1">
                  <h2 className="text-lg font-extrabold text-gray-900 leading-snug">{activeRecipe.title}</h2>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2.5 py-0.5 bg-orange-50 text-orange-700 rounded-full text-[10px] font-bold">
                      {activeRecipe.difficulty}
                    </span>
                    <span className="px-2.5 py-0.5 bg-gray-100 text-gray-600 rounded-full text-[10px] font-bold">
                      {activeRecipe.total_time_minutes} Mins
                    </span>
                  </div>
                </div>
                
                <div className="h-[1px] bg-gray-100 w-full shrink-0"></div>
                
                {/* Servings Modifier within Live View */}
                <div className="flex items-center justify-between shrink-0">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Servings</span>
                  <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-0.5 border border-gray-100">
                    <button 
                      onClick={() => setServings(prev => Math.max(1, prev - 1))}
                      className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm text-xs font-black"
                    >
                      -
                    </button>
                    <span className="font-bold w-4 text-center text-xs">{servings}</span>
                    <button 
                      onClick={() => setServings(prev => prev + 1)}
                      className="w-6 h-6 flex items-center justify-center bg-white rounded shadow-sm text-xs font-black"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="h-[1px] bg-gray-100 w-full shrink-0"></div>

                {/* Live Ingredients Checked checklist */}
                <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 min-h-[160px] max-h-[300px]">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Ingredients Prep List</span>
                  {activeRecipe.ingredients.map((ing, i) => {
                    const qty = scaleQuantity(ing.quantity, activeRecipe.servings_base);
                    const isChecked = checkedIngredients[ing.name];
                    return (
                      <div 
                        key={i}
                        onClick={() => handleIngredientCheck(ing.name)}
                        className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                          isChecked 
                            ? 'bg-emerald-50/50 border-emerald-100 text-emerald-800' 
                            : 'bg-white border-gray-100 hover:border-orange-100'
                        }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                            isChecked ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300'
                          }`}>
                            {isChecked && <div className="w-2 h-2 bg-white rounded-full"></div>}
                          </div>
                          <span className={`truncate ${isChecked ? 'line-through opacity-55' : 'font-medium'}`}>{ing.name}</span>
                        </div>
                        <span className="font-bold shrink-0">{qty > 0 ? `${qty} ` : ''}{ing.unit}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Center Column: Focus Instruction Bento Box (Span 6) */}
            <div className="md:col-span-6 flex flex-col gap-6">
              
              {/* Top Progress Tracker */}
              <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-4 shrink-0 shadow-sm">
                <span className="text-xs font-black text-orange-600 shrink-0 uppercase tracking-wider">
                  STEP {currentStepIndex + 1} OF {activeRecipe.steps.length}
                </span>
                <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-orange-500 transition-all duration-300"
                    style={{ width: `${((currentStepIndex + 1) / activeRecipe.steps.length) * 100}%` }}
                  ></div>
                </div>
                <span className="text-xs font-bold text-gray-400 shrink-0">
                  {Math.round(((currentStepIndex + 1) / activeRecipe.steps.length) * 100)}% Done
                </span>
              </div>

              {/* Large Instruction Display Card */}
              <div className="flex-1 bg-white border border-gray-200 rounded-[32px] p-6 md:p-10 flex flex-col items-center justify-center text-center shadow-sm relative overflow-hidden min-h-[300px]">
                <div className="absolute top-0 right-0 p-6 md:p-8">
                  <svg className="w-12 h-12 text-orange-50/70" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14.017 21L14.017 18C14.017 16.8954 13.1216 16 12.017 16L9.01703 16C7.91246 16 7.01703 16.8954 7.01703 18L7.01703 21H14.017Z" />
                    <path d="M12.017 14C14.2261 14 16.017 12.2091 16.017 10C16.017 7.79086 14.2261 6 12.017 6C9.80789 6 8.01703 7.79086 8.01703 10C8.01703 12.2091 9.80789 14 12.017 14Z" />
                  </svg>
                </div>

                <div className="max-w-2xl space-y-6">
                  <h3 className="text-xl md:text-2xl font-serif italic text-gray-400">Step Instructions</h3>
                  
                  {/* Micro-Video Step Binding (Feature H) */}
                  {activeRecipe.steps[currentStepIndex].video_loop_url && (
                    <div className="w-full max-w-sm mx-auto aspect-video rounded-2xl overflow-hidden border border-gray-100 bg-black relative shadow-sm">
                      <video 
                        key={activeRecipe.steps[currentStepIndex].video_loop_url}
                        src={activeRecipe.steps[currentStepIndex].video_loop_url}
                        autoPlay 
                        loop 
                        muted 
                        playsInline
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2.5 left-2.5 bg-black/65 backdrop-blur-sm text-[8px] font-black uppercase tracking-widest px-2.5 py-1 text-white rounded-full">
                        🧑‍🍳 Step Loop
                      </div>
                    </div>
                  )}

                  {/* Dynamic Multilingual Font formatting */}
                  <div className="space-y-4">
                    {activeRecipe.steps[currentStepIndex].instruction.split('\n\n').map((paragraph, index) => {
                      const isHindi = /[\u0900-\u097F]/.test(paragraph);
                      return (
                        <p 
                          key={index}
                          className={`leading-relaxed text-gray-800 ${
                            isHindi 
                              ? 'text-lg md:text-2xl font-semibold text-orange-950 bg-orange-50/20 p-4 rounded-xl border border-dashed border-orange-100' 
                              : 'text-sm md:text-lg text-gray-600'
                          }`}
                        >
                          {paragraph}
                        </p>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Hands-Free Voice Status Banner */}
              <div 
                onClick={() => {
                  unlockAudio();
                  if (!currentUser?.isPremium) {
                    if (!currentUser) {
                      setIsAuthModalOpen(true);
                    } else {
                      setIsUpgradeModalOpen(true);
                    }
                    return;
                  }
                  setIsVoiceModalOpen(true);
                }}
                className="bg-orange-50/70 hover:bg-orange-100/70 border border-orange-100 rounded-2xl p-3.5 flex items-center justify-between text-xs text-orange-800 cursor-pointer transition-all shrink-0"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="relative">
                    <span className="absolute inline-flex h-2 w-2 rounded-full bg-orange-500 animate-ping"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                  </div>
                  <Mic className="w-4 h-4 text-orange-600 shrink-0" />
                  <span className="font-extrabold tracking-tight shrink-0 uppercase">Hands-Free:</span>
                  <span className="truncate text-gray-600 font-medium">
                    {voiceFeedback || "Say 'Next step' / 'Pause timer' or click here to view helper..."}
                  </span>
                </div>
                <span className="text-[10px] bg-orange-200/50 hover:bg-orange-200 text-orange-900 px-2.5 py-1 rounded-lg font-black shrink-0 transition-colors">
                  HELP
                </span>
              </div>

              {/* Step Navigation Controls */}
              <div className="grid grid-cols-2 gap-4 shrink-0">
                <button 
                  disabled={currentStepIndex === 0}
                  onClick={() => handleStepChange(currentStepIndex - 1)}
                  className={`h-16 rounded-2xl flex items-center justify-center gap-2 font-black text-sm transition-colors border-2 ${
                    currentStepIndex === 0 
                      ? 'bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed' 
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 cursor-pointer'
                  }`}
                >
                  <ChevronLeft className="w-5 h-5" />
                  PREVIOUS STEP
                </button>
                <button 
                  disabled={currentStepIndex === activeRecipe.steps.length - 1}
                  onClick={() => handleStepChange(currentStepIndex + 1)}
                  className={`h-16 rounded-2xl flex items-center justify-center gap-2 font-black text-sm transition-all ${
                    currentStepIndex === activeRecipe.steps.length - 1
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-black text-white hover:opacity-90 cursor-pointer'
                  }`}
                >
                  NEXT STEP
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

            </div>

            {/* Right Column: Timer & Alerts Bento Box (Span 3) */}
            <div className="md:col-span-3 flex flex-col gap-6">
              
              {/* Timer Widget Box */}
              <div className={`rounded-[32px] p-6 flex-1 flex flex-col items-center justify-center text-white shadow-xl relative border transition-all ${
                timerState.isFinished 
                  ? 'bg-red-600 border-red-500 animate-pulse' 
                  : 'bg-[#151619] border-gray-800'
              }`}>
                
                {/* Web Worker Status indicator */}
                <div className="absolute top-5 left-6 flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${timerState.isFinished ? 'bg-white' : 'bg-emerald-500 animate-pulse'}`}></div>
                  <span className={`text-[9px] uppercase tracking-widest font-mono ${timerState.isFinished ? 'text-white' : 'text-gray-400'}`}>
                    Background Worker Active
                  </span>
                </div>

                {/* Circular countdown visualization */}
                {activeRecipe.steps[currentStepIndex].requires_timer ? (
                  <div className="relative w-40 h-40 flex items-center justify-center mb-6 mt-4">
                    <svg className="absolute w-full h-full -rotate-90">
                      <circle cx="80" cy="80" r="72" stroke={timerState.isFinished ? '#EF4444' : '#2D2E32'} strokeWidth="6" fill="transparent" />
                      {timerState.totalDuration > 0 && (
                        <circle 
                          cx="80" 
                          cy="80" 
                          r="72" 
                          stroke={timerState.isFinished ? '#FFFFFF' : '#10B981'} 
                          strokeWidth="6" 
                          fill="transparent" 
                          strokeDasharray="452.3" 
                          strokeDashoffset={452.3 - (452.3 * (timerState.timeLeft / timerState.totalDuration))} 
                          strokeLinecap="round"
                          className="transition-all duration-1000 ease-linear"
                        />
                      )}
                    </svg>
                    <div className="text-center z-10 px-2">
                      <div className="text-4xl font-mono font-black tracking-tight leading-none">
                        {formatTime(timerState.timeLeft)}
                      </div>
                      <div className={`text-[9px] uppercase tracking-widest mt-1.5 ${timerState.isFinished ? 'text-white font-black' : 'text-gray-500'}`}>
                        {timerState.isFinished ? 'TIMER DONE!' : 'REMAINING'}
                      </div>

                      {/* Contextual Timer Sponsor Injection (Feature I) */}
                      {timerState.isRunning && !timerState.isFinished && (
                        <div className="mt-1 flex flex-col items-center justify-center bg-white/10 px-1 py-0.5 rounded-md border border-white/5 max-w-[100px] mx-auto">
                          <span className="text-[6px] text-orange-400 font-black uppercase tracking-widest leading-none">Ad</span>
                          <span className="text-[8px] font-black text-gray-200 mt-0.5 leading-tight truncate w-full flex items-center justify-center gap-0.5">
                            <span>{activeSponsor.logo}</span>
                            <span>{activeSponsor.brand}</span>
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 px-4 space-y-3">
                    <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mx-auto text-gray-400">
                      <Timer className="w-6 h-6" />
                    </div>
                    <span className="block text-xs text-gray-400 font-bold uppercase tracking-wider">No Timer Needed</span>
                    <span className="block text-[10px] text-gray-500">Perform step at your own casual pace.</span>
                  </div>
                )}

                {/* Contextual Timer Sponsor Companion Banner (Feature I) */}
                {activeRecipe.steps[currentStepIndex].requires_timer && timerState.isRunning && !timerState.isFinished && (
                  <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-3 space-y-1 mt-2 text-center text-[10px] text-gray-300 animate-pulse shrink-0">
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="text-xs">{activeSponsor.logo}</span>
                      <span className="font-extrabold text-orange-400 uppercase tracking-wider text-[9px]">{activeSponsor.brand}</span>
                      <span className="text-[8px] text-gray-500 font-mono italic">({activeSponsor.slogan})</span>
                    </div>
                    <p className="font-bold text-gray-400 leading-tight text-[9px]">{activeSponsor.banner}</p>
                  </div>
                )}

                {/* Alarm silence trigger */}
                {timerState.isFinished && (
                  <button 
                    onClick={() => { stopAlarm(); setTimerState(prev => ({ ...prev, isFinished: false })); }}
                    className="mb-4 px-5 py-2 bg-white text-red-600 font-extrabold text-xs rounded-full hover:bg-red-50 transition-colors animate-bounce cursor-pointer shadow-md"
                  >
                    GOT IT (STOP SOUND)
                  </button>
                )}

                {/* Timer Control panel */}
                {activeRecipe.steps[currentStepIndex].requires_timer && (
                  <div className="flex gap-3 shrink-0">
                    {/* Reset Button */}
                    <button 
                      onClick={() => startTimer(activeRecipe.steps[currentStepIndex].duration_seconds)}
                      className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors cursor-pointer text-gray-300"
                      title="Reset Timer"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    
                    {/* Play/Pause toggle */}
                    {timerState.isRunning ? (
                      <button 
                        onClick={pauseTimer}
                        className="w-10 h-10 bg-orange-500 hover:bg-orange-600 rounded-full flex items-center justify-center transition-colors cursor-pointer text-white"
                        title="Pause"
                      >
                        <Pause className="w-4 h-4 fill-white" />
                      </button>
                    ) : (
                      <button 
                        onClick={timerState.isPaused ? resumeTimer : () => startTimer(activeRecipe.steps[currentStepIndex].duration_seconds)}
                        className="w-10 h-10 bg-emerald-500 hover:bg-emerald-600 rounded-full flex items-center justify-center transition-colors cursor-pointer text-white"
                        title="Start/Resume"
                      >
                        <Play className="w-4 h-4 fill-white" />
                      </button>
                    )}
                  </div>
                )}

              </div>

              {/* Chef's Secret dynamic tip card */}
              <div className="bg-orange-500 rounded-[24px] p-5 text-white shadow-md">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 animate-pulse" />
                  <span className="font-extrabold uppercase text-[9px] tracking-widest">Chef's Secret Tip</span>
                </div>
                <p className="text-xs opacity-95 leading-relaxed font-medium">
                  {getChefSecret(activeRecipe.category)}
                </p>
              </div>

            </div>

          </main>

          {/* Bottom virtual phone home line */}
          <div className="h-4 w-32 bg-gray-200 rounded-full mx-auto mb-2 shrink-0 hidden md:block"></div>
        </div>
      )}

      {/* Visual 'Voice Commands' Helper Modal */}
      {isVoiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" id="voice-helper-modal">
          <div className="bg-white rounded-[32px] w-full max-w-lg overflow-hidden border border-gray-100 shadow-2xl flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-6 text-white shrink-0 relative">
              <button 
                onClick={() => setIsVoiceModalOpen(false)}
                className="absolute top-6 right-6 text-white hover:text-orange-100 transition-colors bg-white/10 hover:bg-white/20 w-8 h-8 rounded-full flex items-center justify-center font-extrabold text-sm cursor-pointer"
                title="Close"
              >
                ✕
              </button>
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <Mic className="w-5 h-5 text-white animate-pulse" />
                </div>
                <div>
                  <h3 className="text-xl font-extrabold tracking-tight">Voice Assistant & Commands</h3>
                  <p className="text-xs text-orange-50 font-medium">Keep your hands clean & control with your voice</p>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              
              {/* Mic Status Toggle */}
              <div className="bg-gray-50 border border-gray-200 p-4 rounded-2xl flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <span className="text-xs font-black text-gray-800 uppercase tracking-wider block">Hands-free Microphone</span>
                  <p className="text-[11px] text-gray-500 leading-normal">
                    {isSpeechSupported 
                      ? "Uses Web Speech recognition. Highly optimized for cooking environments."
                      : "Speech API not fully supported in this browser. Use the manual simulation buttons below!"}
                  </p>
                </div>
                
                <button
                  disabled={!isSpeechSupported && !isVoiceActive}
                  onClick={() => setIsVoiceActive(!isVoiceActive)}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    isVoiceActive 
                      ? 'bg-emerald-500 text-white hover:bg-emerald-600' 
                      : isSpeechSupported
                        ? 'bg-gray-900 text-white hover:bg-gray-800'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {isVoiceActive ? "ACTIVE (TAP TO STOP)" : "ACTIVATE MIC"}
                </button>
              </div>

              {/* Status Message / Error / Feedback */}
              {(voiceError || voiceFeedback) && (
                <div className={`p-3 rounded-xl text-xs border flex items-start gap-2.5 ${
                  voiceError 
                    ? 'bg-red-50 border-red-100 text-red-800' 
                    : 'bg-orange-50/60 border-orange-100 text-orange-950 font-medium'
                }`}>
                  <div className="w-2.5 h-2.5 rounded-full mt-1 shrink-0 bg-current animate-pulse"></div>
                  <div className="flex-1 min-w-0">
                    <span className="font-extrabold uppercase tracking-wide block text-[9px] mb-0.5">
                      {voiceError ? 'Status Warning' : 'Live Transcript'}
                    </span>
                    <span className="break-words">{voiceError || voiceFeedback}</span>
                  </div>
                </div>
              )}

              {/* Suggestions List & Click-to-Test simulation */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-gray-400 uppercase tracking-widest">
                    Suggested Commands
                  </span>
                  <span className="text-[10px] text-orange-500 font-extrabold">
                    💡 Click commands to simulate!
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {[
                    { cmd: "Next step", desc: "Advance to the next recipe instruction.", icon: ChevronRight },
                    { cmd: "Previous step", desc: "Go back to the previous recipe instruction.", icon: ChevronLeft },
                    { cmd: "Repeat instructions", desc: "Have the assistant read out instructions.", icon: Volume2 },
                    { cmd: "Pause timer", desc: "Pause the active countdown timer.", icon: Pause },
                    { cmd: "Resume timer", desc: "Resume counting down current step.", icon: Play },
                    { cmd: "Reset timer", desc: "Restart the timer to initial step length.", icon: RotateCcw },
                    { cmd: "Mute sound", desc: "Silence all alarms and speech speech synthesis.", icon: VolumeX },
                    { cmd: "Unmute sound", desc: "Enable audio alarms and synthesis feedback.", icon: Volume2 },
                  ].map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={idx}
                        onClick={() => executeVoiceCommand(item.cmd)}
                        className="group w-full p-3 rounded-2xl border border-gray-100 hover:border-orange-200 hover:bg-orange-50/40 text-left transition-all flex items-center justify-between gap-4 cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center group-hover:bg-orange-100/80 transition-colors shrink-0">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-extrabold text-sm text-gray-900 group-hover:text-orange-950 block">
                              "{item.cmd}"
                            </span>
                            <span className="text-[11px] text-gray-500">
                              {item.desc}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] opacity-0 group-hover:opacity-100 transition-opacity bg-orange-100 text-orange-800 px-2.5 py-1 rounded-md font-bold uppercase shrink-0">
                          Say Command
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-4 shrink-0">
              <span className="text-[10px] text-gray-400 font-medium">
                Tip: Speaks and listens in English & Hindi accents perfectly!
              </span>
              <button
                onClick={() => setIsVoiceModalOpen(false)}
                className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white text-xs font-extrabold rounded-xl transition-all cursor-pointer"
              >
                GOT IT
              </button>
            </div>

          </div>
        </div>
      )}

      {/* FEATURE M: PRE-FLIGHT PREPARATION SAFETY ALERT MODAL */}
      {preFlightModalOpen && pendingCookingRecipe && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[32px] max-w-lg w-full overflow-hidden shadow-2xl border border-amber-200 animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="bg-amber-50 border-b border-amber-100 p-6 flex items-start gap-4">
              <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-2xl shrink-0 animate-bounce">
                ⚠️
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-amber-950 uppercase tracking-tight">
                  Pre-Flight Safety Check Alert!
                </h3>
                <p className="text-xs text-amber-800 font-bold mt-1">
                  We detected that this recipe requires advance preparation steps or has long timers. Starting live cooking now without completing them may cause kitchen bottlenecks or burnt dishes!
                </p>
              </div>
            </div>

            {/* Warning Content */}
            <div className="p-6 space-y-4">
              <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">
                Detected Preparation Requirements:
              </span>
              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {preFlightWarnings.map((warning, idx) => (
                  <div key={idx} className="flex items-start gap-2 bg-amber-50/50 border border-amber-100 rounded-xl p-3 text-xs text-amber-900 font-medium">
                    <span className="text-amber-500 font-bold shrink-0">•</span>
                    <span>{warning}</span>
                  </div>
                ))}
              </div>

              <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                  📢
                </div>
                <p className="text-[11px] text-gray-500 leading-normal">
                  The Speech Synthesis engine has alerted you about these requirements. Make sure your ingredients are fully soaked, marinated, or prepared.
                </p>
              </div>
            </div>

            {/* Modal Action Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-end gap-3">
              <button
                onClick={() => {
                  setPreFlightModalOpen(false);
                  setPendingCookingRecipe(null);
                  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                }}
                className="w-full sm:w-auto px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-extrabold rounded-xl transition-all cursor-pointer text-center"
              >
                Go Back & Prepare
              </button>
              <button
                onClick={confirmStartCooking}
                className="w-full sm:w-auto px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-extrabold rounded-xl transition-all cursor-pointer text-center shadow-md shadow-orange-500/10"
              >
                Start Live Cooking Anyway
              </button>
            </div>

          </div>
        </div>
      )}

      {viewMode === 'admin' && (
        <AdminPanel 
          onClose={() => setViewMode('home')}
          recipes={recipes}
          onRefresh={async () => {
            setRefreshTrigger(prev => prev + 1);
          }}
        />
      )}

      {viewMode === 'profile' && (
        <ProfileDashboard
          currentUser={currentUser}
          onLogout={handleLogout}
          onUpgrade={() => setIsUpgradeModalOpen(true)}
          onClose={() => setViewMode('home')}
        />
      )}

      {/* AUTHENTICATION & LOGIN SYSTEM MODAL */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />

      {/* RAZORPAY SUBSCRIPTION UPGRADE MODAL */}
      <UpgradeModal
        isOpen={isUpgradeModalOpen}
        onClose={() => setIsUpgradeModalOpen(false)}
        userEmail={currentUser?.email}
        onSuccess={(updatedUser) => {
          setCurrentUser(updatedUser);
          setIsUpgradeModalOpen(false);
        }}
        triggerAuth={() => {
          setIsUpgradeModalOpen(false);
          setIsAuthModalOpen(true);
        }}
      />
      
      {viewMode !== 'cooking' && viewMode !== 'admin' && (
        <BottomNavigation
          viewMode={viewMode}
          currentUser={currentUser}
          isUpgradeModalOpen={isUpgradeModalOpen}
          onTabClick={handleBottomTabClick}
        />
      )}

    </div>
  );
}
