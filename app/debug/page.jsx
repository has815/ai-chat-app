// File: app/debug/page.js

'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase';

export default function DebugPage() {
  const [data, setData] = useState({
    user: null,
    session: null,
    profile: null,
    chats: null,
    loading: true,
    error: null
  })

  useEffect(() => {
    loadDebugData()
  }, [])

  async function loadDebugData() {
    try {
      console.log('🔍 Loading debug data...')

      // 1. Session check
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      console.log('Session:', session)

      // 2. User check
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      console.log('User:', user)

      let profile = null
      let chats = null

      if (user) {
        // 3. Profile check
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle()
        
        console.log('Profile:', profileData)
        profile = profileData

        // 4. Chats check
        const { data: chatsData, error: chatsError } = await supabase
          .from('chats')
          .select('*')
          .eq('user_id', user.id)
        
        console.log('Chats:', chatsData)
        chats = chatsData
      }

      setData({
        user,
        session,
        profile,
        chats,
        loading: false,
        error: null
      })

    } catch (error) {
      console.error('❌ Debug error:', error)
      setData(prev => ({ ...prev, loading: false, error: error.message }))
    }
  }

  async function testSignOut() {
    await supabase.auth.signOut()
    localStorage.clear()
    window.location.href = '/login'
  }

  async function testCreateProfile() {
    if (!data.user) {
      alert('Pehle login karo!')
      return
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: data.user.id,
          email: data.user.email,
          full_name: 'Test User',
          job: 'Tester',
          onboarding_completed: true
        })

      if (error) throw error
      alert('✅ Profile created!')
      loadDebugData()
    } catch (error) {
      alert('❌ Error: ' + error.message)
    }
  }

  if (data.loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p>Loading debug data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-8 text-purple-400">🐛 Debug Panel</h1>

        {data.error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-lg">
            <p className="text-red-400">{data.error}</p>
          </div>
        )}

        {/* User Info */}
        <div className="bg-gray-900 rounded-xl p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4 text-blue-400">👤 User</h2>
          {data.user ? (
            <div className="space-y-2">
              <p><span className="text-gray-400">ID:</span> <span className="text-yellow-400 font-mono text-sm">{data.user.id}</span></p>
              <p><span className="text-gray-400">Email:</span> <span className="text-green-400">{data.user.email}</span></p>
              <p><span className="text-gray-400">Created:</span> {new Date(data.user.created_at).toLocaleString()}</p>
            </div>
          ) : (
            <p className="text-red-400">❌ No user found - Not logged in</p>
          )}
        </div>

        {/* Session Info */}
        <div className="bg-gray-900 rounded-xl p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4 text-cyan-400">🔑 Session</h2>
          {data.session ? (
            <div className="space-y-2">
              <p><span className="text-gray-400">Status:</span> <span className="text-green-400">✅ Active</span></p>
              <p><span className="text-gray-400">Expires:</span> {new Date(data.session.expires_at * 1000).toLocaleString()}</p>
            </div>
          ) : (
            <p className="text-red-400">❌ No active session</p>
          )}
        </div>

        {/* Profile Info */}
        <div className="bg-gray-900 rounded-xl p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4 text-pink-400">📝 Profile</h2>
          {data.profile ? (
            <div className="space-y-2">
              <p><span className="text-gray-400">Name:</span> <span className="text-white">{data.profile.full_name}</span></p>
              <p><span className="text-gray-400">Job:</span> <span className="text-white">{data.profile.job || 'Not set'}</span></p>
              <p><span className="text-gray-400">Onboarding:</span> <span className={data.profile.onboarding_completed ? 'text-green-400' : 'text-yellow-400'}>{data.profile.onboarding_completed ? '✅ Complete' : '⚠️ Incomplete'}</span></p>
            </div>
          ) : (
            <div>
              <p className="text-yellow-400 mb-4">⚠️ No profile found</p>
              {data.user && (
                <button
                  onClick={testCreateProfile}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition"
                >
                  Create Test Profile
                </button>
              )}
            </div>
          )}
        </div>

        {/* Chats Info */}
        <div className="bg-gray-900 rounded-xl p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4 text-purple-400">💬 Chats</h2>
          {data.chats ? (
            <div>
              <p className="mb-4"><span className="text-gray-400">Total:</span> <span className="text-white">{data.chats.length}</span></p>
              {data.chats.length > 0 && (
                <div className="space-y-2">
                  {data.chats.slice(0, 3).map(chat => (
                    <div key={chat.id} className="p-3 bg-gray-800 rounded-lg">
                      <p className="text-white truncate">{chat.title}</p>
                      <p className="text-sm text-gray-500">{new Date(chat.created_at).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500">No chats found</p>
          )}
        </div>

        {/* Actions */}
        <div className="bg-gray-900 rounded-xl p-6">
          <h2 className="text-2xl font-bold mb-4 text-red-400">🔧 Actions</h2>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={loadDebugData}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition"
            >
              🔄 Refresh Data
            </button>
            <button
              onClick={() => window.location.href = '/login'}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition"
            >
              🔑 Go to Login
            </button>
            <button
              onClick={() => window.location.href = '/chat'}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition"
            >
              💬 Go to Chat
            </button>
            <button
              onClick={testSignOut}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition"
            >
              🚪 Sign Out & Clear
            </button>
          </div>
        </div>

        {/* Raw JSON */}
        <div className="mt-6 bg-gray-900 rounded-xl p-6">
          <h2 className="text-2xl font-bold mb-4 text-gray-400">📋 Raw Data</h2>
          <pre className="text-xs overflow-auto bg-black p-4 rounded max-h-96">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  )
}