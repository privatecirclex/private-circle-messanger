import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Plus, 
  Search, 
  MoreVertical, 
  User, 
  MessageCircle, 
  Smile,
  CheckCheck,
  Camera,
  X,
  Check,
  ZoomIn,
  ZoomOut,
  Eye,
  EyeOff,
  Loader2
} from 'lucide-react';

// Firebase Imports
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut,
  signInWithCustomToken,
  signInAnonymously
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  onSnapshot, 
  serverTimestamp, 
  doc, 
  setDoc, 
  getDoc,
  getDocs
} from 'firebase/firestore';

// Constants
const EMOJIS = ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠'];

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBaq_rTRyUBChFSaiwjW63gg0XP77mNmEc",
  authDomain: "private-circle-d0359.firebaseapp.com",
  projectId: "private-circle-d0359",
  storageBucket: "private-circle-d0359.firebasestorage.app",
  messagingSenderId: "574588063072",
  appId: "1:574588063072:web:096750b9ec53a48e086205"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'private-circle-messenger';

export default function App() {
  // Auth State
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // App State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [friends, setFriends] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showDonatePopup, setShowDonatePopup] = useState(false);
  
  // Profile/Edit States
  const [viewingProfile, setViewingProfile] = useState(null); 
  const [editingPhoto, setEditingPhoto] = useState(null); 
  const [photoFilter, setPhotoFilter] = useState('none');
  const [photoZoom, setPhotoZoom] = useState(1);
  const [photoPos, setPhotoPos] = useState({ x: 0, y: 0 });
  
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);

  // 1. Initial Auth Listener
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        try { await signInWithCustomToken(auth, __initial_auth_token); } catch (e) {}
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userDoc = await getDoc(doc(db, 'artifacts', appId, 'users', firebaseUser.uid, 'profile', 'info'));
        if (userDoc.exists()) {
          setUser({ ...firebaseUser, ...userDoc.data() });
        } else {
          setUser(firebaseUser);
        }
      } else {
        setUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Real-time Messages Listener
  useEffect(() => {
    if (!user || !activeChat) {
      setMessages([]);
      return;
    }

    // Creating a unique ID for the conversation
    const chatId = [user.uid, activeChat.uid].sort().join('_');
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', `messages_${chatId}`));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sorting in memory as per Rule 2
      const sortedMsgs = msgs.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
      setMessages(sortedMsgs);
    }, (error) => {
      console.error("Firestore error:", error);
    });

    return () => unsubscribe();
  }, [user, activeChat]);

  // 3. Friends Discovery (Search)
  useEffect(() => {
    if (!user) return;
    const fetchUsers = async () => {
      // Simplistic discovery: fetch all public profiles
      const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'profiles'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const allUsers = snapshot.docs
          .map(doc => ({ uid: doc.id, ...doc.data() }))
          .filter(u => u.uid !== user.uid);
        setFriends(allUsers);
      });
      return unsubscribe;
    };
    fetchUsers();
  }, [user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Handlers
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      if (authMode === 'signup') {
        if (password !== confirmPassword) throw new Error("Passwords do not match");
        const res = await createUserWithEmailAndPassword(auth, email, password);
        const profileData = {
          name: displayName,
          username: `@${displayName.toLowerCase().replace(/\s/g, '')}`,
          bio: 'Hey there! I am using Private Circle.',
          uid: res.user.uid,
          color: 'bg-indigo-600'
        };
        // Save to private and public
        await setDoc(doc(db, 'artifacts', appId, 'users', res.user.uid, 'profile', 'info'), profileData);
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'profiles', res.user.uid), profileData);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const switchAuthMode = () => {
    setAuthMode(authMode === 'login' ? 'signup' : 'login');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setDisplayName('');
    setAuthError('');
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChat || !user) return;

    const chatId = [user.uid, activeChat.uid].sort().join('_');
    const msgData = {
      senderId: user.uid,
      text: newMessage,
      createdAt: serverTimestamp(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isMe: true // Used for UI identification
    };

    setNewMessage('');
    setShowEmojiPicker(false);

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', `messages_${chatId}`), msgData);
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  const triggerDonatePopup = () => {
    setShowDonatePopup(true);
    setTimeout(() => setShowDonatePopup(false), 5000);
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (upload) => {
        setEditingPhoto(upload.target.result);
        setPhotoZoom(1);
        setPhotoPos({ x: 0, y: 0 });
      };
      reader.readAsDataURL(file);
    }
  };

  const saveProfilePhoto = async () => {
    const updated = { ...user, avatar: editingPhoto, filter: photoFilter };
    setUser(updated);
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info'), { avatar: editingPhoto, filter: photoFilter }, { merge: true });
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'profiles', user.uid), { avatar: editingPhoto, filter: photoFilter }, { merge: true });
    setEditingPhoto(null);
  };

  const Modal = ({ title, onClose, children }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh]">
        <div className="p-5 border-b border-slate-800 flex justify-between items-center">
          <h3 className="font-bold text-lg">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400">
            <X size={22} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-6">
          {children}
        </div>
      </div>
    </div>
  );

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 overflow-y-auto">
        <div className="bg-slate-900 p-8 md:p-10 rounded-[2.5rem] shadow-2xl w-full max-w-md border border-slate-800 my-8">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-indigo-600 p-5 rounded-3xl mb-5 shadow-2xl shadow-indigo-600/30">
              <MessageCircle className="text-white w-10 h-10" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tighter text-center">PRIVATE CIRCLE</h1>
            <p className="text-slate-500 font-medium text-center">{authMode === 'login' ? 'Welcome back to the circle' : 'Create your private identity'}</p>
          </div>
          
          <form onSubmit={handleAuth} className="space-y-4">
            {authMode === 'signup' && (
              <div className="relative">
                <input 
                  type="text" 
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Display Name"
                  className="w-full bg-slate-800 border-2 border-slate-700 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-600"
                  required
                />
              </div>
            )}
            
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email Address"
              className="w-full bg-slate-800 border-2 border-slate-700 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-600"
              required
            />

            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full bg-slate-800 border-2 border-slate-700 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-600"
                required
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                {showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
              </button>
            </div>

            {authMode === 'signup' && (
              <div className="relative">
                <input 
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm Password"
                  className="w-full bg-slate-800 border-2 border-slate-700 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-600"
                  required
                />
                <button 
                  type="button" 
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  {showConfirmPassword ? <EyeOff size={20}/> : <Eye size={20}/>}
                </button>
              </div>
            )}

            {authError && <p className="text-rose-500 text-xs font-bold text-center px-2">{authError}</p>}

            <button 
              type="submit" 
              disabled={authLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-indigo-600/30 active:scale-95 flex items-center justify-center gap-2"
            >
              {authLoading ? <Loader2 className="animate-spin" /> : (authMode === 'login' ? 'Login' : 'Sign Up')}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button onClick={switchAuthMode} className="text-sm font-bold text-slate-500 hover:text-indigo-400 transition-colors">
              {authMode === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Login"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const filteredFriends = friends.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    f.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans">
      
      {/* Sidebar */}
      <aside className={`${isSidebarCollapsed ? 'w-20' : 'w-80'} flex-shrink-0 border-r border-slate-800 bg-slate-900 transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) flex flex-col relative z-20 shadow-2xl`}>
        
        {/* MY PROFILE AREA */}
        <div className={`p-4 border-b border-slate-800 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
          <div 
            onClick={(e) => {
              e.stopPropagation();
              if (isSidebarCollapsed) {
                setIsSidebarCollapsed(false);
              } else {
                setViewingProfile('me');
              }
            }}
            className="relative flex-shrink-0 cursor-pointer group"
          >
            <div className={`w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg overflow-hidden group-hover:scale-105 transition-transform`}>
              {user.avatar ? <img src={user.avatar} className={`w-full h-full object-cover filter-${user.filter}`} alt="avatar" /> : (user.name?.[0] || 'U').toUpperCase()}
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-slate-900 rounded-full"></div>
          </div>
          {!isSidebarCollapsed && (
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-bold text-white truncate">{user.name}</p>
              <p className="text-xs text-slate-500 truncate">{user.username}</p>
            </div>
          )}
        </div>

        {/* Search / Discover */}
        {!isSidebarCollapsed && (
          <div className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Find friends..."
                className="w-full bg-slate-800/50 border border-slate-700 rounded-xl py-2 pl-10 pr-4 text-xs focus:border-indigo-500 outline-none transition-all"
              />
            </div>
          </div>
        )}

        {/* Friends List */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          <p className={`px-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 mb-4 ${isSidebarCollapsed ? 'hidden' : ''}`}>
            {searchQuery ? 'Search Results' : 'The Circle'}
          </p>
          {filteredFriends.map(friend => (
            <div 
              key={friend.uid}
              onClick={() => {
                if (isSidebarCollapsed) {
                  setIsSidebarCollapsed(false);
                } else {
                  setActiveChat(friend);
                  setShowEmojiPicker(false);
                }
              }}
              className={`w-full flex items-center gap-4 p-4 rounded-[1.25rem] mb-2 transition-all cursor-pointer group ${activeChat?.uid === friend.uid ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' : 'hover:bg-slate-800 text-slate-400'}`}
            >
              <div 
                className={`w-10 h-10 rounded-xl ${activeChat?.uid === friend.uid ? 'bg-white/20' : (friend.color || 'bg-slate-700')} flex-shrink-0 flex items-center justify-center text-white font-bold group-hover:scale-110 transition-transform overflow-hidden`}
              >
                {friend.avatar ? <img src={friend.avatar} className={`w-full h-full object-cover filter-${friend.filter}`} alt="" /> : friend.name[0]}
              </div>
              {!isSidebarCollapsed && (
                <div className="text-left overflow-hidden">
                  <p className={`text-sm font-bold truncate ${activeChat?.uid === friend.uid ? 'text-white' : 'text-slate-200'}`}>{friend.name}</p>
                  <p className="text-[10px] opacity-60">Available</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {!isSidebarCollapsed && (
          <div className="p-4 border-t border-slate-800">
            <button 
              onClick={() => signOut(auth)}
              className="w-full py-3 bg-slate-800 hover:bg-rose-900/20 hover:text-rose-500 rounded-xl text-xs font-bold transition-all"
            >
              Sign Out
            </button>
          </div>
        )}
      </aside>

      {/* Main Chat Area */}
      <main 
        onClick={() => setIsSidebarCollapsed(true)}
        className="flex-1 flex flex-col bg-slate-950 relative"
      >
        {/* Chat Header */}
        <header className="h-20 flex-shrink-0 border-b border-slate-800 bg-slate-900/60 backdrop-blur-xl px-8 flex items-center justify-between z-10">
          <div 
            className="flex items-center gap-4 cursor-pointer group" 
            onClick={(e) => { 
              e.stopPropagation(); 
              if (activeChat) setViewingProfile(activeChat); 
            }}
          >
            <div className={`w-11 h-11 rounded-2xl ${activeChat?.color || 'bg-slate-700'} flex items-center justify-center text-white font-black shadow-lg group-hover:ring-4 ring-indigo-500/30 transition-all overflow-hidden`}>
              {activeChat?.avatar ? <img src={activeChat.avatar} className={`w-full h-full object-cover filter-${activeChat.filter}`} alt="" /> : (activeChat?.name[0] || '?')}
            </div>
            <div>
              <h2 className="text-base font-bold text-white">{activeChat?.name || 'Select a Friend'}</h2>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">In the circle</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center g
