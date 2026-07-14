import React, { useState } from 'react';
import { X, Sparkles, Check, Flame, Mic, RefreshCw, Star, CreditCard } from 'lucide-react';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string | undefined;
  onSuccess: (updatedUser: any) => void;
  triggerAuth: () => void;
}

export default function UpgradeModal({ isOpen, onClose, userEmail, onSuccess, triggerAuth }: UpgradeModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Simulation / Demo Mode State
  const [demoOrder, setDemoOrder] = useState<any | null>(null);
  const [showDemoGateway, setShowDemoGateway] = useState(false);

  if (!isOpen) return null;

  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleUpgrade = async () => {
    if (!userEmail) {
      triggerAuth();
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Create Order on our backend
      const response = await fetch('/api/subscribe/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 900 }) // ₹9 = 900 paise
      });

      const orderData = await response.json();
      if (!response.ok || !orderData.success) {
        throw new Error(orderData.message || 'Failed to initialize subscription order.');
      }

      // 2. If it is Demo / Test mode (no API keys configured in .env)
      if (orderData.isDemo) {
        setDemoOrder(orderData);
        setShowDemoGateway(true);
        setLoading(false);
        return;
      }

      // 3. If real keys exist, load the Razorpay checkout script dynamically
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Razorpay payment gateway failed to load. Are you offline?');
      }

      // 4. Configure Razorpay checkout options
      const options = {
        key: orderData.key,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'SmartCook Pro',
        description: 'Monthly Premium Recipe & Voice Assistant Subscription',
        image: 'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&q=80&w=150',
        order_id: orderData.orderId,
        handler: async function (response: any) {
          setLoading(true);
          try {
            // Verify payment on the server
            const verifyRes = await fetch('/api/subscribe/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                orderId: orderData.orderId,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                email: userEmail,
                isDemo: false
              })
            });

            const verifyData = await verifyRes.json();
            if (verifyRes.ok && verifyData.success) {
              onSuccess(verifyData.user);
              onClose();
            } else {
              setError(verifyData.message || 'Payment signature verification failed.');
            }
          } catch (err) {
            setError('Failed to reach server for payment validation.');
          } finally {
            setLoading(false);
          }
        },
        prefill: {
          email: userEmail,
        },
        theme: {
          color: '#F59E0B' // Amber color matching SmartCook theme
        },
        modal: {
          ondismiss: function() {
            setLoading(false);
          }
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();

    } catch (err: any) {
      setError(err.message || 'An error occurred during checkout setup.');
      setLoading(false);
    }
  };

  const handleSimulatePaymentSuccess = async () => {
    if (!demoOrder || !userEmail) return;
    setLoading(true);
    setShowDemoGateway(false);

    try {
      const verifyRes = await fetch('/api/subscribe/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: demoOrder.orderId,
          paymentId: 'pay_sim_' + Math.random().toString(36).substring(2, 11),
          signature: 'sig_sim_' + Math.random().toString(36).substring(2, 11),
          email: userEmail,
          isDemo: true
        })
      });

      const verifyData = await verifyRes.json();
      if (verifyRes.ok && verifyData.success) {
        onSuccess(verifyData.user);
        onClose();
      } else {
        setError(verifyData.message || 'Demo payment activation failed.');
      }
    } catch (err) {
      setError('Connection to verification server failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div 
        className="w-full max-w-lg bg-white rounded-2xl border border-gray-100 shadow-2xl overflow-hidden relative"
        id="upgrade-modal"
      >
        {/* Banner with a premium vibe */}
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 p-8 text-white relative">
          <div className="absolute top-4 right-4">
            <button 
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors p-1.5 hover:bg-white/10 rounded-full"
              id="close-upgrade-btn"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-xs font-semibold backdrop-blur-md mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>SMARTCOOK PRO ACCESS</span>
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight">Level Up Your Cooking</h2>
          <p className="text-white/90 text-sm mt-1 max-w-sm">
            Unlock the ultimate culinary toolkit. Experience cooking with high efficiency.
          </p>
        </div>

        {/* Content area */}
        <div className="p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
              <span className="font-semibold">Transaction Error:</span> {error}
            </div>
          )}

          {!showDemoGateway ? (
            <>
              {/* Premium Features Highlight */}
              <div className="space-y-4 mb-8">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Everything you get with Pro:</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex gap-3 items-start">
                    <div className="flex-shrink-0 w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600">
                      <Flame className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">100+ Secret Recipes</h4>
                      <p className="text-xs text-gray-500 mt-0.5">Explore our locked signature chef recipes.</p>
                    </div>
                  </div>

                  <div className="flex gap-3 items-start">
                    <div className="flex-shrink-0 w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600">
                      <Mic className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">Hands-Free Voice Assistant</h4>
                      <p className="text-xs text-gray-500 mt-0.5">Control timers & instructions by voice.</p>
                    </div>
                  </div>

                  <div className="flex gap-3 items-start">
                    <div className="flex-shrink-0 w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600">
                      <RefreshCw className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">Smart Substitutes Engine</h4>
                      <p className="text-xs text-gray-500 mt-0.5">Swap ingredients on-the-fly instantly.</p>
                    </div>
                  </div>

                  <div className="flex gap-3 items-start">
                    <div className="flex-shrink-0 w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600">
                      <Star className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">Zero Commercial Ads</h4>
                      <p className="text-xs text-gray-500 mt-0.5">No distractions or visual interruptions.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pricing & Checkout trigger button */}
              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-6 text-center">
                <div className="flex items-baseline justify-center gap-1.5 mb-1">
                  <span className="text-gray-500 text-sm font-medium">Only</span>
                  <span className="text-4xl font-black text-gray-900 tracking-tight">₹9</span>
                  <span className="text-gray-500 text-sm font-medium">/ month</span>
                </div>
                <p className="text-xs text-gray-400">Cancel anytime. Secure checkout powered by Razorpay.</p>

                <button
                  onClick={handleUpgrade}
                  disabled={loading}
                  className="w-full mt-4 py-3.5 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
                  id="upgrade-checkout-btn"
                >
                  <CreditCard className="w-4 h-4" />
                  {loading ? 'Processing Checkout...' : !userEmail ? 'Sign In to Upgrade' : 'Unlock All Features Now'}
                </button>
              </div>
            </>
          ) : (
            /* Demo Simulated Payment Gateway Portal */
            <div className="space-y-6 text-center py-4">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-amber-50 text-amber-600 rounded-full mb-2">
                <CreditCard className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Simulated Razorpay Sandbox</h3>
                <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                  SmartCook is running in the sandbox workspace. No real payment is charged.
                  We have pre-filled and generated a secure simulated transaction for your email <span className="font-semibold">{userEmail}</span>.
                </p>
              </div>

              <div className="bg-amber-50/50 border border-amber-200/50 rounded-2xl p-5 text-left max-w-sm mx-auto space-y-2.5">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Subscription Item:</span>
                  <span className="font-semibold text-gray-900">SmartCook Pro License</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Simulated Order ID:</span>
                  <span className="font-mono text-gray-900 select-all">{demoOrder?.orderId}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Pricing Tier:</span>
                  <span className="font-semibold text-gray-900">₹9.00 INR / Month</span>
                </div>
              </div>

              <div className="flex gap-3 justify-center max-w-sm mx-auto pt-2">
                <button
                  onClick={() => setShowDemoGateway(false)}
                  className="flex-1 py-3 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl text-xs transition-colors"
                  id="cancel-demo-payment-btn"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSimulatePaymentSuccess}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs transition-colors shadow-md shadow-emerald-600/10"
                  id="success-demo-payment-btn"
                >
                  Authorize Payment
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
