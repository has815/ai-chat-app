'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import {
  MessageSquare, Plus, Send, Menu, Loader2, ChevronLeft,
  Trash2, LogOut, Sparkles, Zap, Circle, Paperclip, X,
  Download, Share2, Moon, Sun, Globe, AlertTriangle,
  CheckCircle, XCircle, Info, Mic, MicOff, Search,
  Pencil, Copy, CheckCheck
} from 'lucide-react';
import jsPDF from 'jspdf';

// ============================================
// Image With Loader — Pollinations slow hai
// ============================================
function ImageWithLoader({ img, darkMode }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retries, setRetries] = useState(0);
  const isAiImage = img.url.includes('pollinations.ai');

  const handleRetry = () => {
    setFailed(false);
    setRetries(prev => prev + 1);
  };

  return (
    <div className="relative group">
      {!loaded && !failed && (
        <div className={`w-full max-w-md rounded-lg border-2 border-dashed ${darkMode ? 'border-violet-500/30 bg-violet-500/5' : 'border-violet-300 bg-violet-50'} flex flex-col items-center justify-center py-12`}>
          <div className="w-8 h-8 border-3 border-violet-500 border-t-transparent rounded-full animate-spin mb-3"></div>
          <p className="text-[10px] text-gray-400">
            {isAiImage ? '🎨 AI generating image...' : '📸 Loading photo...'}
          </p>
          {isAiImage && <p className="text-[8px] text-gray-500 mt-1">AI images take 10-30 seconds</p>}
        </div>
      )}

      {failed && (
        <div className={`w-full max-w-md rounded-lg border-2 ${darkMode ? 'border-red-500/30 bg-red-500/5' : 'border-red-300 bg-red-50'} flex flex-col items-center justify-center py-8`}>
          <p className="text-xs text-red-400 mb-2">
            {isAiImage ? 'AI image still generating...' : 'Image failed to load'}
          </p>
          <div className="flex gap-2">
            {isAiImage && retries < 3 && (
              <button onClick={handleRetry} className="px-3 py-1.5 bg-violet-600 text-white rounded-lg text-[10px] hover:bg-violet-500 transition">
                Retry ({3 - retries} left)
              </button>
            )}
            <a href={img.url} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-gray-600 text-white rounded-lg text-[10px] hover:bg-gray-500 transition">
              Open in new tab
            </a>
          </div>
        </div>
      )}

      <img
        key={retries}
        src={img.url}
        alt={img.alt}
        className={`w-full rounded-lg border-2 border-violet-500/30 max-w-md shadow-xl cursor-pointer hover:shadow-2xl transition-all ${!loaded || failed ? 'hidden' : ''}`}
        loading="eager"
        onClick={() => window.open(img.url, '_blank')}
        onLoad={() => setLoaded(true)}
        onError={() => { setFailed(true); }}
      />

      {loaded && (
        <a href={img.url} download target="_blank" rel="noopener noreferrer"
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/80 p-1.5 rounded-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <Download className="w-3 h-3 text-white" />
        </a>
      )}

      <p className="text-[9px] mt-1 text-gray-500 capitalize">
        {isAiImage ? '🎨 AI Generated' : '📸 Photo'} — {img.alt}
      </p>
    </div>
  );
}

// ============================================
// MAIN CHAT PAGE
// ============================================
export default function ChatPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [currentChatId, setCurrentChatId] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(true);
  const [avatarError, setAvatarError] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [language, setLanguage] = useState('auto');
  const [isListening, setIsListening] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [deleteModal, setDeleteModal] = useState({ show: false, chatId: null, chatTitle: '' });
  const [logoutModal, setLogoutModal] = useState(false);
  const [renameModal, setRenameModal] = useState({ show: false, chatId: null, currentTitle: '' });
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const messagesEndRef = useRef(null);
  const hasCheckedAuth = useRef(false);
  const fileInputRef = useRef(null);
  const toastTimer = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (!hasCheckedAuth.current) { hasCheckedAuth.current = true; checkAuth(); }
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages]);

  useEffect(() => {
    const h = () => { if (window.innerWidth < 768) setSidebarOpen(false); };
    h();
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); };

  const showToast = (message, type = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ show: true, message, type });
    toastTimer.current = setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  const toggleVoiceInput = () => {
    if (isListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsListening(false);
    } else {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) { showToast('Voice not supported!', 'error'); return; }
      const r = new SR();
      r.lang = language === 'ur' ? 'ur-PK' : 'en-US';
      r.continuous = false;
      r.interimResults = true;
      r.onstart = () => setIsListening(true);
      r.onresult = (e) => { let t = ''; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; setInputMessage(t); };
      r.onerror = () => setIsListening(false);
      r.onend = () => setIsListening(false);
      recognitionRef.current = r;
      r.start();
      showToast('Listening...', 'info');
    }
  };

  const getAvatarUrl = () => { if (avatarError) return null; return user?.user_metadata?.avatar_url || user?.user_metadata?.picture; };

  const handleFileSelect = (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 5 * 1024 * 1024) { showToast('Too large!', 'error'); return; }
    setUploadedFile(f);
    if (f.type.startsWith('image/')) { const r = new FileReader(); r.onload = (e) => setFilePreview(e.target.result); r.readAsDataURL(f); }
    else setFilePreview(null);
  };

  const removeFile = () => { setUploadedFile(null); setFilePreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; };

  const exportChatAsPDF = () => {
    if (messages.length === 0) { showToast('No messages!', 'error'); return; }
    const doc = new jsPDF(); let y = 20;
    doc.setFontSize(18); doc.setTextColor(124, 58, 237); doc.text('NexusAI Chat', 20, y); y += 10;
    doc.setFontSize(10); doc.setTextColor(100, 100, 100); doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, y); y += 10;
    messages.forEach((m) => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFont('helvetica', 'bold'); doc.setTextColor(m.role === 'user' ? 124 : 59, m.role === 'user' ? 58 : 130, 237);
      doc.text(`${m.role === 'user' ? 'You' : 'AI'}:`, 20, y); y += 6;
      doc.setFont('helvetica', 'normal'); doc.setTextColor(50, 50, 50);
      const c = m.content.replace(/!\[[^\]]*\]\([^)]+\)/g, '[Img]').replace(/```[\s\S]*?```/g, '[Code]').trim();
      doc.splitTextToSize(c, 170).forEach(l => { if (y > 280) { doc.addPage(); y = 20; } doc.text(l, 20, y); y += 5; }); y += 3;
    });
    doc.save(`chat-${new Date().toISOString().slice(0, 10)}.pdf`); showToast('PDF exported!');
  };

  const shareChatLink = async () => {
    if (!currentChatId) { showToast('No chat!', 'error'); return; }
    const u = `${window.location.origin}/chat/${currentChatId}`;
    if (navigator.share) { try { await navigator.share({ title: 'NexusAI', url: u }); } catch { } }
    else { navigator.clipboard.writeText(u); showToast('Link copied!'); }
  };

  const getEmailIcon = (email) => {
    if (!email) return null;
    const d = email.split('@')[1]?.toLowerCase();
    if (d?.includes('gmail')) return <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor"><path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" /></svg>;
    return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>;
  };

  const getEmailIconColor = (email) => {
    if (!email) return 'from-violet-500 to-purple-500';
    const d = email.split('@')[1]?.toLowerCase();
    if (d?.includes('gmail')) return 'from-red-500 to-orange-500';
    return 'from-violet-500 to-purple-500';
  };

  const checkAuth = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) { router.replace('/login'); return; }
      const { data: p } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
      if (!p?.full_name || !p?.onboarding_completed) { router.replace('/onboarding'); return; }
      setUser(session.user); setProfile(p);
      await loadChatHistory(session.user.id); setLoading(false);
    } catch { router.replace('/login'); }
  };

  const loadChatHistory = async (uid) => {
    try { const { data } = await supabase.from('chats').select('*').eq('user_id', uid).order('updated_at', { ascending: false }).limit(30); setChatHistory(data || []); } catch { }
  };

  const loadChat = async (cid) => {
    try {
      const { data } = await supabase.from('messages').select('*').eq('chat_id', cid).order('created_at', { ascending: true });
      setMessages(data.map(m => ({ id: m.id, role: m.role, content: m.content, timestamp: new Date(m.created_at) })));
      setCurrentChatId(cid);
      if (window.innerWidth < 768) setSidebarOpen(false);
    } catch { }
  };

  const createNewChat = () => { setMessages([]); setCurrentChatId(null); if (window.innerWidth < 768) setSidebarOpen(false); showToast('New chat!', 'info'); };

  const saveChat = async (cid, title) => {
    try { const { data } = await supabase.from('chats').upsert({ id: cid, user_id: user.id, title, updated_at: new Date().toISOString() }).select().single(); await loadChatHistory(user.id); return data.id; } catch { return cid; }
  };

  const saveMessage = async (cid, role, content) => {
    try { await supabase.from('messages').insert({ chat_id: cid, role, content, created_at: new Date().toISOString() }); } catch { }
  };

  const confirmDelete = (e, cid, title) => { e.stopPropagation(); setDeleteModal({ show: true, chatId: cid, chatTitle: title }); };
  const executeDelete = async () => {
    const { chatId } = deleteModal; setDeleteModal({ show: false, chatId: null, chatTitle: '' });
    try { await supabase.from('messages').delete().eq('chat_id', chatId); await supabase.from('chats').delete().eq('id', chatId); if (currentChatId === chatId) { setMessages([]); setCurrentChatId(null); } await loadChatHistory(user.id); showToast('Deleted!'); } catch { showToast('Failed!', 'error'); }
  };

  const confirmRename = (e, cid, title) => { e.stopPropagation(); setRenameModal({ show: true, chatId: cid, currentTitle: title }); };
  const executeRename = async () => {
    const { chatId, currentTitle } = renameModal; setRenameModal({ show: false, chatId: null, currentTitle: '' });
    try { await supabase.from('chats').update({ title: currentTitle, updated_at: new Date().toISOString() }).eq('id', chatId); await loadChatHistory(user.id); showToast('Renamed!'); } catch { showToast('Failed!', 'error'); }
  };

  const executeLogout = async () => {
    setLogoutModal(false);
    try { setUser(null); setProfile(null); setMessages([]); setChatHistory([]); await supabase.auth.signOut(); router.replace('/login'); } catch { router.replace('/login'); }
  };

  const copyCode = (code, id) => { navigator.clipboard.writeText(code); setCopiedId(id); showToast('Copied!'); setTimeout(() => setCopiedId(null), 2000); };

  const getAIResponse = async (userMessage) => {
    try {
      const lp = language !== 'auto' ? `Respond in ${language === 'ur' ? 'Urdu' : 'English'}. ` : '';
      const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: lp + userMessage, history: messages.slice(-10) }) });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      if (data.error) return `Error: ${data.error}`;
      return data.response || "Sorry, no response.";
    } catch (e) { console.error('AI error:', e); return "I'm having trouble connecting. Try again!"; }
  };

  const handleSendMessage = async () => {
    if ((!inputMessage.trim() && !uploadedFile) || isTyping || !user) return;
    const text = inputMessage.trim() || (uploadedFile ? `[File: ${uploadedFile.name}]` : '');
    setInputMessage(''); removeFile();
    const chatId = currentChatId || crypto.randomUUID();
    if (!currentChatId) setCurrentChatId(chatId);
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', content: text, timestamp: new Date() }]);
    setIsTyping(true);
    try {
      await saveMessage(chatId, 'user', text);
      const aiText = await getAIResponse(text);
      setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: aiText, timestamp: new Date() }]);
      await saveMessage(chatId, 'assistant', aiText);
      if (messages.length === 0) await saveChat(chatId, text.substring(0, 50));
    } catch { setMessages(prev => [...prev, { id: Date.now() + 1, role: 'assistant', content: "Error!", timestamp: new Date() }]); }
    finally { setIsTyping(false); }
  };

  const handleKeyPress = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } };

  // ============================================
  // RENDER MESSAGE — Code + Images + Text
  // ============================================
  const renderMessageContent = (msg) => {
    const content = msg.content;
    if (/```(\w*)\n[\s\S]*?```/.test(content)) {
      const parts = []; let last = 0; const re = /```(\w*)\n([\s\S]*?)```/g; let m;
      while ((m = re.exec(content)) !== null) {
        if (m.index > last) { const t = content.slice(last, m.index).trim(); if (t) parts.push({ type: 'text', content: t }); }
        parts.push({ type: 'code', language: m[1] || 'code', code: m[2].trim(), id: `c-${msg.id}-${m.index}` });
        last = m.index + m[0].length;
      }
      if (last < content.length) { const t = content.slice(last).trim(); if (t) parts.push({ type: 'text', content: t }); }
      return (
        <div className="space-y-3">
          {parts.map((p, i) => p.type === 'code' ? (
            <div key={i} className={`rounded-xl overflow-hidden border ${darkMode ? 'border-white/10' : 'border-gray-300'}`}>
              <div className="flex items-center justify-between px-3 py-1 bg-black/60 border-b border-white/10">
                <span className="text-[10px] text-gray-400 font-mono">{p.language}</span>
                <button onClick={() => copyCode(p.code, p.id)} className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-white transition">
                  {copiedId === p.id ? <CheckCheck className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                  {copiedId === p.id ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <pre className="p-3 overflow-x-auto bg-black/30"><code className="text-[11px] leading-relaxed font-mono text-green-300">{p.code}</code></pre>
            </div>
          ) : <div key={i}>{renderTextWithImages(p.content)}</div>)}
        </div>
      );
    }
    return renderTextWithImages(content);
  };

  const renderTextWithImages = (text) => {
    // FIXED: regex now matches relative URLs like /api/ai-image?prompt=...
    const imgRe = /!\[([^\]]*)\]\(([^)\s]+)\)/g;
    if (imgRe.test(text)) {
      const images = [];
      let m;
      const re = /!\[([^\]]*)\]\(([^)\s]+)\)/g;
      while ((m = re.exec(text)) !== null) images.push({ alt: m[1], url: m[2] });
      const txt = text.replace(/!\[[^\]]*\]\([^)]+\)/g, '').replace(/Here('s| are) your?.*?:/gi, '').trim();
      return (
        <div className="space-y-3">
          {images.length > 1 ? (
            <div className={`grid ${images.length === 2 ? 'grid-cols-2' : 'grid-cols-1'} gap-2`}>
              {images.map((img, i) => <ImageWithLoader key={i} img={img} darkMode={darkMode} />)}
            </div>
          ) : <ImageWithLoader img={images[0]} darkMode={darkMode} />}
          {txt && <p className="text-xs leading-relaxed whitespace-pre-wrap break-words">{txt}</p>}
        </div>
      );
    }
    return <p className="text-xs leading-relaxed whitespace-pre-wrap break-words">{text}</p>;
  };

  const filteredChats = chatHistory.filter(c => !searchQuery || c.title?.toLowerCase().includes(searchQuery.toLowerCase()));

  // ============================================
  // LOADING
  // ============================================
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-900 via-gray-900 to-black flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-24 h-24 mx-auto mb-8">
            <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-3xl blur-xl opacity-75 animate-pulse"></div>
            <div className="relative w-24 h-24 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-3xl flex items-center justify-center"><Sparkles className="w-12 h-12 text-white animate-pulse" /></div>
          </div>
          <Loader2 className="w-6 h-6 text-violet-400 animate-spin mx-auto mb-2" />
          <p className="text-gray-300">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  // ============================================
  // MAIN RENDER
  // ============================================
  return (
    <div className={`flex h-screen ${darkMode ? 'bg-gradient-to-br from-violet-900 via-gray-900 to-black' : 'bg-gray-50'} overflow-hidden`}>
      {darkMode && <div className="fixed inset-0 overflow-hidden pointer-events-none"><div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-500/15 rounded-full blur-3xl animate-pulse"></div><div className="absolute bottom-0 right-1/4 w-96 h-96 bg-fuchsia-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div></div>}

      {/* Toast */}
      <div className={`fixed top-4 right-4 z-[100] transition-all duration-500 ${toast.show ? 'translate-x-0 opacity-100' : 'translate-x-[120%] opacity-0'}`}>
        <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-xl ${toast.type === 'success' ? 'bg-emerald-500/15 border-emerald-500/30' : toast.type === 'error' ? 'bg-red-500/15 border-red-500/30' : 'bg-blue-500/15 border-blue-500/30'}`}>
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${toast.type === 'success' ? 'bg-emerald-500/20' : toast.type === 'error' ? 'bg-red-500/20' : 'bg-blue-500/20'}`}>
            {toast.type === 'success' && <CheckCircle className="w-4 h-4 text-emerald-400" />}
            {toast.type === 'error' && <XCircle className="w-4 h-4 text-red-400" />}
            {toast.type === 'info' && <Info className="w-4 h-4 text-blue-400" />}
          </div>
          <p className={`text-xs font-medium ${toast.type === 'success' ? 'text-emerald-300' : toast.type === 'error' ? 'text-red-300' : 'text-blue-300'}`}>{toast.message}</p>
        </div>
      </div>

      {/* Delete Modal */}
      {deleteModal.show && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteModal({ show: false, chatId: null, chatTitle: '' })}></div>
          <div className={`relative w-full max-w-sm rounded-2xl shadow-2xl border overflow-hidden ${darkMode ? 'bg-gray-900 border-white/10' : 'bg-white border-gray-200'}`}>
            <div className="h-1 bg-gradient-to-r from-red-500 to-orange-500"></div>
            <div className="p-6">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-500/15 flex items-center justify-center"><AlertTriangle className="w-7 h-7 text-red-400" /></div>
              <h3 className={`text-lg font-bold text-center mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Delete Chat?</h3>
              <p className={`text-sm text-center mb-6 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Delete <span className="font-semibold text-red-400">"{deleteModal.chatTitle}"</span>?</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteModal({ show: false, chatId: null, chatTitle: '' })} className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium ${darkMode ? 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10' : 'bg-gray-100 text-gray-700'}`}>Cancel</button>
                <button onClick={executeDelete} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-xl text-sm font-medium hover:shadow-lg transition">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {renameModal.show && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setRenameModal({ show: false, chatId: null, currentTitle: '' })}></div>
          <div className={`relative w-full max-w-sm rounded-2xl shadow-2xl border overflow-hidden ${darkMode ? 'bg-gray-900 border-white/10' : 'bg-white border-gray-200'}`}>
            <div className="h-1 bg-gradient-to-r from-violet-500 to-fuchsia-500"></div>
            <div className="p-6">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-violet-500/15 flex items-center justify-center"><Pencil className="w-7 h-7 text-violet-400" /></div>
              <h3 className={`text-lg font-bold text-center mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Rename Chat</h3>
              <input type="text" value={renameModal.currentTitle} onChange={(e) => setRenameModal(p => ({ ...p, currentTitle: e.target.value }))} className={`w-full px-4 py-2.5 rounded-xl text-sm border outline-none mb-4 ${darkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`} autoFocus />
              <div className="flex gap-3">
                <button onClick={() => setRenameModal({ show: false, chatId: null, currentTitle: '' })} className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium ${darkMode ? 'bg-white/5 text-gray-300 border border-white/10' : 'bg-gray-100 text-gray-700'}`}>Cancel</button>
                <button onClick={executeRename} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl text-sm font-medium hover:shadow-lg transition">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Logout Modal */}
      {logoutModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setLogoutModal(false)}></div>
          <div className={`relative w-full max-w-sm rounded-2xl shadow-2xl border overflow-hidden ${darkMode ? 'bg-gray-900 border-white/10' : 'bg-white border-gray-200'}`}>
            <div className="h-1 bg-gradient-to-r from-orange-500 to-yellow-500"></div>
            <div className="p-6">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-orange-500/15 flex items-center justify-center"><LogOut className="w-7 h-7 text-orange-400" /></div>
              <h3 className={`text-lg font-bold text-center mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Logout?</h3>
              <p className={`text-sm text-center mb-6 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Your chats will be saved.</p>
              <div className="flex gap-3">
                <button onClick={() => setLogoutModal(false)} className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium ${darkMode ? 'bg-white/5 text-gray-300 border border-white/10' : 'bg-gray-100 text-gray-700'}`}>Stay</button>
                <button onClick={executeLogout} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-orange-600 to-yellow-600 text-white rounded-xl text-sm font-medium hover:shadow-lg transition">Logout</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'fixed inset-0 z-50 md:relative md:inset-auto md:z-auto w-80' : 'hidden md:flex md:w-0'} ${darkMode ? 'bg-black/90 md:bg-black/40 backdrop-blur-2xl border-white/10' : 'bg-white border-gray-200'} border-r flex flex-col transition-all duration-300 overflow-hidden`}>
        <div className="md:hidden flex justify-end p-2"><button onClick={() => setSidebarOpen(false)} className="p-2 hover:bg-white/5 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button></div>
        <div className={`p-3 ${darkMode ? 'border-white/10' : 'border-gray-200'} border-b`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-lg flex items-center justify-center"><MessageSquare className="w-3.5 h-3.5 text-white" /></div>
              <h2 className={`${darkMode ? 'text-white' : 'text-gray-900'} font-semibold text-xs`}>Chats ({chatHistory.length})</h2>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="p-1 hover:bg-white/5 rounded-lg hidden md:block"><ChevronLeft className="w-4 h-4 text-gray-400" /></button>
          </div>
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search..." className={`w-full pl-7 pr-3 py-1.5 rounded-lg text-[10px] border outline-none ${darkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'}`} />
          </div>
          <button onClick={createNewChat} className="w-full px-3 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-lg flex items-center justify-center gap-1.5 text-xs font-medium hover:shadow-lg transition"><Plus className="w-3.5 h-3.5" />New Chat</button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
          {filteredChats.map((chat) => (
            <div key={chat.id} className={`group flex items-center gap-1.5 p-1.5 rounded-lg cursor-pointer transition-all ${currentChatId === chat.id ? darkMode ? 'bg-violet-500/20 border border-violet-500/30' : 'bg-violet-100 border border-violet-300' : darkMode ? 'hover:bg-white/5 border border-transparent' : 'hover:bg-gray-100 border border-transparent'}`}>
              <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 ${currentChatId === chat.id ? 'bg-gradient-to-br from-violet-500 to-fuchsia-500' : darkMode ? 'bg-white/5' : 'bg-gray-200'}`}><MessageSquare className={`w-3 h-3 ${currentChatId === chat.id ? 'text-white' : 'text-gray-400'}`} /></div>
              <button onClick={() => loadChat(chat.id)} className="flex-1 text-left min-w-0"><p className={`text-[10px] font-medium truncate ${currentChatId === chat.id ? darkMode ? 'text-white' : 'text-violet-700' : darkMode ? 'text-gray-300' : 'text-gray-900'}`}>{chat.title || 'New Chat'}</p></button>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                <button onClick={(e) => confirmRename(e, chat.id, chat.title || '')} className="p-0.5 hover:bg-violet-500/20 rounded"><Pencil className="w-2.5 h-2.5 text-violet-400" /></button>
                <button onClick={(e) => confirmDelete(e, chat.id, chat.title || '')} className="p-0.5 hover:bg-red-500/20 rounded"><Trash2 className="w-2.5 h-2.5 text-red-400" /></button>
              </div>
            </div>
          ))}
          {filteredChats.length === 0 && searchQuery && <p className="text-center text-gray-500 text-[10px] py-4">No chats found</p>}
        </div>
        <div className={`p-3 ${darkMode ? 'border-white/10' : 'border-gray-200'} border-t`}>
          <div className={`flex items-center gap-2 p-2 ${darkMode ? 'bg-white/5 border-white/10' : 'bg-gray-100 border-gray-200'} rounded-lg border mb-2`}>
            {getAvatarUrl() && !avatarError ? <img src={getAvatarUrl()} alt="" className="w-7 h-7 rounded-lg object-cover" onError={() => setAvatarError(true)} /> : <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${getEmailIconColor(user?.email)} flex items-center justify-center text-white`}>{getEmailIcon(user?.email)}</div>}
            <div className="flex-1 min-w-0"><p className={`${darkMode ? 'text-white' : 'text-gray-900'} text-[10px] font-semibold truncate`}>{profile?.full_name || user?.email}</p><div className="flex items-center gap-1"><Circle className="w-1 h-1 text-green-400 fill-green-400" /><span className="text-gray-500 text-[8px]">Online</span></div></div>
          </div>
          <button onClick={() => setLogoutModal(true)} className={`w-full px-3 py-2 ${darkMode ? 'bg-orange-500/10 border-orange-500/20' : 'bg-orange-50 border-orange-200'} text-orange-400 rounded-lg flex items-center justify-center gap-1 text-[10px] font-medium border transition`}><LogOut className="w-3 h-3" />Logout</button>
        </div>
      </div>

      {/* Main Chat */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        <div className={`${darkMode ? 'bg-black/20 backdrop-blur-xl border-white/10' : 'bg-white border-gray-200'} border-b px-3 py-2`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {!sidebarOpen && <button onClick={() => setSidebarOpen(true)} className={`p-1 ${darkMode ? 'hover:bg-white/5' : 'hover:bg-gray-100'} rounded-lg`}><Menu className="w-4 h-4 text-gray-400" /></button>}
              <div className="w-7 h-7 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-xl flex items-center justify-center"><Sparkles className="w-3.5 h-3.5 text-white" /></div>
              <div><h1 className="text-xs font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">NexusAI</h1><p className="text-[8px] text-gray-500"><Zap className="w-2 h-2 inline" /> Groq + Pexels + AI Gen</p></div>
            </div>
            <div className="flex items-center gap-1">
              <select value={language} onChange={(e) => setLanguage(e.target.value)} className={`px-2 py-1 rounded-lg text-[9px] border outline-none ${darkMode ? 'bg-gray-800 text-white border-white/20' : 'bg-gray-100 text-gray-900 border-gray-300'}`} style={{ colorScheme: darkMode ? 'dark' : 'light' }}>
                <option value="auto">Auto</option><option value="en">EN</option><option value="ur">UR</option>
              </select>
              <button onClick={() => setDarkMode(!darkMode)} className={`p-1 ${darkMode ? 'hover:bg-white/5' : 'hover:bg-gray-100'} rounded-lg`}>{darkMode ? <Sun className="w-4 h-4 text-yellow-500" /> : <Moon className="w-4 h-4 text-gray-600" />}</button>
              <button onClick={exportChatAsPDF} disabled={messages.length === 0} className={`p-1 ${darkMode ? 'hover:bg-white/5' : 'hover:bg-gray-100'} rounded-lg disabled:opacity-50`}><Download className="w-3.5 h-3.5 text-gray-400" /></button>
              <button onClick={shareChatLink} disabled={!currentChatId} className={`p-1 ${darkMode ? 'hover:bg-white/5' : 'hover:bg-gray-100'} rounded-lg disabled:opacity-50`}><Share2 className="w-3.5 h-3.5 text-gray-400" /></button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-2xl blur-xl opacity-50 animate-pulse"></div>
                <div className="relative w-20 h-20 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-2xl flex items-center justify-center"><Sparkles className="w-10 h-10 text-white" /></div>
              </div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent mb-2">Start Your Journey</h2>
              <p className="text-gray-400 text-xs mb-4">Ask questions, show photos, generate AI art, code help!</p>
              <div className="flex flex-wrap gap-2 justify-center">
                <button onClick={() => setInputMessage('Hello!')} className="px-3 py-1.5 rounded-xl text-[10px] font-medium border border-violet-500/30 text-violet-300 hover:bg-violet-500/10 transition">👋 Hello</button>
                <button onClick={() => setInputMessage('car ki photo dikhao')} className="px-3 py-1.5 rounded-xl text-[10px] font-medium border border-fuchsia-500/30 text-fuchsia-300 hover:bg-fuchsia-500/10 transition">📸 Photo</button>
                <button onClick={() => setInputMessage('AI se lion ka drawing banao')} className="px-3 py-1.5 rounded-xl text-[10px] font-medium border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10 transition">🎨 AI Art</button>
                <button onClick={() => setInputMessage('javascript ka code likho')} className="px-3 py-1.5 rounded-xl text-[10px] font-medium border border-green-500/30 text-green-300 hover:bg-green-500/10 transition">💻 Code</button>
                <button onClick={() => setInputMessage('Urdu mein bat karo')} className="px-3 py-1.5 rounded-xl text-[10px] font-medium border border-orange-500/30 text-orange-300 hover:bg-orange-500/10 transition">🇵🇰 Urdu</button>
              </div>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-3">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? `bg-gradient-to-br ${getEmailIconColor(user?.email)} text-white` : 'bg-gradient-to-br from-cyan-500 to-blue-500'}`}>
                      {msg.role === 'user' ? getEmailIcon(user?.email) : <Sparkles className="w-3 h-3 text-white" />}
                    </div>
                    <div className={`rounded-xl px-3 py-2 ${msg.role === 'user' ? 'bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-lg shadow-violet-500/30' : darkMode ? 'bg-gray-800/80 text-gray-100 border border-white/10' : 'bg-gray-100 text-gray-900 border border-gray-200'}`}>
                      {renderMessageContent(msg)}
                      <p className={`text-[8px] mt-1 ${msg.role === 'user' ? 'text-violet-200' : 'text-gray-500'}`}>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start"><div className="flex gap-2"><div className="w-6 h-6 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center"><Sparkles className="w-3 h-3 text-white" /></div><div className={`rounded-xl px-3 py-2 ${darkMode ? 'bg-gray-800/80 border border-white/10' : 'bg-white border border-gray-200'}`}><div className="flex gap-1"><span className="w-1.5 h-1.5 bg-violet-500 rounded-full animate-bounce"></span><span className="w-1.5 h-1.5 bg-fuchsia-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></span><span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span></div></div></div></div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className={`${darkMode ? 'bg-black/20 backdrop-blur-xl border-white/10' : 'bg-white border-gray-200'} border-t px-3 py-2`}>
          <div className="max-w-4xl mx-auto">
            {uploadedFile && (
              <div className={`mb-2 p-2 ${darkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-300'} rounded-lg border flex items-center gap-2`}>
                {filePreview ? <img src={filePreview} alt="" className="w-10 h-10 rounded-lg object-cover border border-violet-500" /> : <Paperclip className="w-4 h-4 text-violet-400" />}
                <div className="flex-1 min-w-0"><p className={`text-[10px] font-medium truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>{uploadedFile.name}</p></div>
                <button onClick={removeFile} className="p-1 hover:bg-red-500/20 rounded"><X className="w-3 h-3 text-red-400" /></button>
              </div>
            )}
            <div className="flex gap-1.5 items-center">
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*,.pdf,.txt" className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className={`p-2 ${darkMode ? 'hover:bg-white/5' : 'hover:bg-gray-100'} rounded-xl transition`}><Paperclip className="w-4 h-4 text-gray-400" /></button>
              <button onClick={toggleVoiceInput} className={`p-2 rounded-xl transition ${isListening ? 'bg-red-500/20 text-red-400 animate-pulse' : darkMode ? 'hover:bg-white/5 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <input type="text" value={inputMessage} onChange={(e) => setInputMessage(e.target.value)} onKeyPress={handleKeyPress} placeholder={isListening ? 'Listening...' : 'Type your message...'} disabled={isTyping} className={`flex-1 px-3 py-2 ${darkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-gray-100 border-gray-200 text-gray-900'} border rounded-xl text-sm focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/20 disabled:opacity-50 transition`} />
              <button onClick={handleSendMessage} disabled={(!inputMessage.trim() && !uploadedFile) || isTyping} className="px-3 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl disabled:opacity-50 transition flex items-center hover:shadow-lg hover:shadow-violet-500/30">
                {isTyping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}