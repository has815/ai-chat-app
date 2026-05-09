'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { User, Loader2, Sparkles } from 'lucide-react';

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [fullName, setFullName] = useState('');
  const [job, setJob] = useState('');
  const [user, setUser] = useState(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        console.log('❌ No session - redirecting to login');
        router.push('/login');
        return;
      }

      console.log('✅ Session found:', session.user.email);
      setUser(session.user);

      // Auto-fill from Google metadata
      const googleName = session.user.user_metadata?.full_name || 
                        session.user.user_metadata?.name || 
                        '';
      
      if (googleName) {
        setFullName(googleName);
      }

      // Check if profile already complete
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, onboarding_completed')
        .eq('id', session.user.id)
        .maybeSingle();

      console.log('📊 Profile check:', profile);

      if (profile?.full_name && profile?.onboarding_completed) {
        console.log('➡️ Profile complete - redirecting to chat');
        router.push('/chat');
        return;
      }

      setChecking(false);

    } catch (err) {
      console.error('Auth error:', err);
      router.push('/login');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!fullName.trim()) {
      setError('Please enter your name');
      return;
    }

    try {
      setLoading(true);

      if (!user) {
        throw new Error('User not found. Please log in again.');
      }

      console.log('💾 Saving profile for:', user.email);

      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          email: user.email,
          full_name: fullName.trim(),
          job: job.trim() || null,
          avatar_url: user.user_metadata?.avatar_url || null,
          onboarding_completed: true,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        });

      if (upsertError) {
        console.error('❌ Profile update error:', upsertError);
        throw upsertError;
      }

      console.log('✅ Profile saved successfully');
      console.log('➡️ Redirecting to chat');

      // Small delay for database propagation
      await new Promise(resolve => setTimeout(resolve, 500));
      
      router.push('/chat');

    } catch (err) {
      console.error('Submission error:', err);
      setError(err.message || 'Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-red-500 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-white to-purple-200 rounded-3xl blur-xl opacity-75 animate-pulse"></div>
            <div className="relative w-20 h-20 bg-white rounded-3xl flex items-center justify-center">
              <Sparkles className="w-10 h-10 text-purple-600 animate-pulse" />
            </div>
          </div>
          <p className="text-white text-lg font-medium">Setting up your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-red-500 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-500/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      {/* Onboarding Card */}
      <div className="relative w-full max-w-md">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-3xl blur-2xl opacity-30"></div>
        
        <div className="relative bg-white rounded-3xl shadow-2xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl blur-lg opacity-50"></div>
              <div className="relative w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center">
                <User className="w-10 h-10 text-white" />
              </div>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
              Welcome! 👋
            </h1>
            <p className="text-gray-600">Let's complete your profile</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-600 text-center">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Name *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                  required
                  disabled={loading}
                  className="w-full pl-11 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 outline-none transition disabled:opacity-50"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Job / Role <span className="text-gray-500">(optional)</span>
              </label>
              <input
                type="text"
                value={job}
                onChange={(e) => setJob(e.target.value)}
                placeholder="e.g., Software Developer"
                disabled={loading}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 outline-none transition disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !fullName.trim()}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-xl hover:from-purple-500 hover:to-pink-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Setting up...
                </>
              ) : (
                'Continue to Chat →'
              )}
            </button>
          </form>

          {/* User Info */}
          {user && (
            <p className="mt-6 text-center text-sm text-gray-500">
              Logged in as: <span className="text-gray-700 font-medium">{user.email}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
