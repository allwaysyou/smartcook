import React, { useState } from 'react';
import { X, Mail, Lock, User, Sparkles, Check } from 'lucide-react';
import { auth, googleProvider, signInWithPopup } from '../lib/firebase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (token: string, user: any) => void;
}

export default function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const payload = isLogin ? { email, password } : { name, email, password };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setSuccess(isLogin ? 'Login successful!' : 'Registration successful!');
        setTimeout(() => {
          onSuccess(data.token, data.user);
          onClose();
        }, 1000);
      } else {
        setError(data.message || 'Something went wrong. Please try again.');
      }
    } catch (err) {
      setError('Connection to server failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;

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
        setSuccess(`Logged in via Google as ${profile.name}!`);
        setTimeout(() => {
          onSuccess(data.token, data.user);
          onClose();
        }, 1000);
      } else {
        setError(data.message || 'Google authentication failed on server.');
      }
    } catch (err: any) {
      console.error('Firebase Google Auth error:', err);
      // Clean up common firebase iframe/sandbox warning info
      let userFriendlyMessage = err.message || 'Failed to complete Google authentication.';
      if (err.code === 'auth/popup-blocked') {
        userFriendlyMessage = 'The login popup was blocked by your browser. Please enable popups or try clicking again.';
      } else if (err.code === 'auth/cancelled-popup-request') {
        userFriendlyMessage = 'Sign-in popup closed before completion. Please try again.';
      }
      setError(userFriendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div 
        className="w-full max-w-md bg-white rounded-2xl border border-gray-100 shadow-2xl overflow-hidden relative"
        id="auth-modal"
      >
        {/* Header decoration banner */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 h-2" />
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors p-1.5 hover:bg-gray-50 rounded-full"
          id="close-auth-btn"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-amber-50 rounded-full text-amber-600 mb-3">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
              {isLogin ? 'Welcome Back' : 'Create Account'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {isLogin ? 'Sign in to access recipe secrets & features' : 'Unlock a smarter culinary experience today'}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-start gap-2">
              <span className="font-semibold">Error:</span> {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 text-xs rounded-xl flex items-center gap-2">
              <Check className="w-4 h-4 text-green-600" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="E.g. Gordon Ramsay"
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-500 focus:bg-white transition-all text-gray-900"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="chef@smartcook.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-500 focus:bg-white transition-all text-gray-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-amber-500 focus:bg-white transition-all text-gray-900"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium text-sm rounded-xl hover:from-amber-600 hover:to-orange-600 transition-all shadow-md shadow-amber-500/10 active:scale-[0.98] disabled:opacity-50"
              id="submit-auth-btn"
            >
              {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Sign Up'}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-3 text-gray-400">Or continue with</span>
            </div>
          </div>

          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            type="button"
            className="w-full py-2.5 px-4 border border-gray-200 hover:bg-gray-50 text-gray-700 font-medium text-sm rounded-xl flex items-center justify-center gap-3 transition-colors active:scale-[0.98]"
            id="google-auth-btn"
          >
            {/* Google Vector Icon */}
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12 5.04c1.62 0 3.08.56 4.22 1.65l3.15-3.15C17.45 1.84 14.93 1 12 1 7.37 1 3.4 3.66 1.45 7.55l3.77 2.92C6.12 7.55 8.84 5.04 12 5.04z"
              />
              <path
                fill="#4285F4"
                d="M23.49 12.27c0-.81-.07-1.59-.2-2.36H12v4.51h6.46c-.28 1.46-1.1 2.69-2.33 3.51l3.63 2.82c2.12-1.95 3.33-4.83 3.33-8.48z"
              />
              <path
                fill="#FBBC05"
                d="M5.22 14.77c-.24-.72-.38-1.49-.38-2.27s.14-1.55.38-2.27L1.45 7.31C.52 9.16 0 11.23 0 13.41c0 2.18.52 4.25 1.45 6.1l3.77-2.92z"
              />
              <path
                fill="#34A853"
                d="M12 23c3.24 0 5.96-1.08 7.95-2.92l-3.63-2.82c-1.1.74-2.51 1.18-4.32 1.18-3.16 0-5.88-2.51-6.78-5.43L1.45 15.93C3.4 19.82 7.37 23 12 23z"
              />
            </svg>
            Sign In with Google
          </button>

          <p className="text-center text-xs text-gray-500 mt-6">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-amber-600 hover:text-amber-700 font-semibold hover:underline"
            >
              {isLogin ? 'Create one now' : 'Sign In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
