import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { X, Mail, Lock, AlertCircle, RefreshCw } from 'lucide-react';

export default function AuthModal({ isOpen, onClose }) {
  const [isLogin, setIsLogin] = useState(true);
  const [isReset, setIsReset] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const { login, signup, loginWithGoogle, resetPassword } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (isReset) {
        await resetPassword(email);
        setMessage('Check your inbox for password reset instructions');
      } else if (isLogin) {
        await login(email, password);
        onClose();
      } else {
        await signup(email, password);
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Failed to authenticate');
    }

    setLoading(false);
  };

  const handleGoogleSignIn = async () => {
    try {
      setError('');
      setLoading(true);
      await loginWithGoogle();
      onClose();
    } catch {
      setError('Failed to sign in with Google');
    }
    setLoading(false);
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setIsReset(false);
    setError('');
    setMessage('');
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md animate-in fade-in zoom-in duration-200 relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100 transition-colors"
        >
          <X size={20} />
        </button>

        <h2 className="text-2xl font-bold text-slate-800 mb-6 text-center">
          {isReset ? 'Reset Password' : isLogin ? 'Welcome Back' : 'Create Account'}
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm flex gap-2 items-center rounded-r-lg">
            <AlertCircle size={16} className="shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {message && (
          <div className="mb-4 p-3 bg-green-50 border-l-4 border-green-500 text-green-700 text-sm flex gap-2 items-center rounded-r-lg">
            <p>{message}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                placeholder="you@example.com"
              />
            </div>
          </div>

          {!isReset && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-shadow"
                  placeholder="••••••••"
                />
              </div>
            </div>
          )}

          <button
            disabled={loading}
            type="submit"
            className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-70 shadow-lg shadow-blue-200"
          >
            {loading && <RefreshCw className="animate-spin" size={18} />}
            {isReset ? 'Send Reset Link' : isLogin ? 'Sign In' : 'Sign Up'}
          </button>
        </form>

        {!isReset && (
          <>
            <div className="mt-6 border-t border-slate-100 flex justify-center -translate-y-3">
              <span className="bg-white px-4 text-xs font-medium text-slate-400">OR</span>
            </div>
            
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 border-2 border-slate-200 rounded-xl font-semibold text-slate-700 hover:bg-slate-50 transition-colors mb-4"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                <path fill="none" d="M1 1h22v22H1z" />
              </svg>
              Continue with Google
            </button>
          </>
        )}

        <div className="mt-6 text-center text-sm text-slate-600 flex flex-col gap-2">
          {!isReset ? (
            <p>
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button 
                onClick={toggleMode} 
                className="font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                type="button"
              >
                {isLogin ? 'Sign up' : 'Log in'}
              </button>
            </p>
          ) : (
             <p>
              Remember your password?{" "}
              <button 
                onClick={() => setIsReset(false)} 
                className="font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                type="button"
              >
                Log in
              </button>
            </p>
          )}

          {isLogin && !isReset && (
            <p>
              Forgot your password?{" "}
              <button 
                onClick={() => setIsReset(true)} 
                className="font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                type="button"
              >
                Reset it
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
