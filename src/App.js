import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, Plus, Search, MoreVertical, MessageCircle, Smile,
  CheckCheck, Camera, X, Check, ZoomIn, ZoomOut,
  Eye, EyeOff, Loader2, UserPlus, Users, Bell, Trash2, Edit2, Image as ImageIcon
} from 'lucide-react';

// Firebase Imports
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, 
  onAuthStateChanged, signOut, signInWithCustomToken, signInAnonymously
} from 'firebase/auth';
import { 
  getFirestore, collection, addDoc, query, onSnapshot, serverTimestamp, 
  doc, setDoc, getDoc, updateDoc, deleteDoc, where, writeBatch
} from 'firebase/firestore';

// --- UTILITY: Image Compression (Fixes "Document Too Large" & Crashes) ---
const compressImage = (base64Str, maxWidth = 800, quality = 0.7) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height *= maxWidth / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = (err) => resolve(base64Str); // Fallback
  });
};

// --- CONFIGURATION ---
const EMOJIS = ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠'];

// Use environment config for stability in preview, fallback to provided values if needed
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
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
  // --- STATE ---
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Main UI State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [sidebarTab, setSidebarTab] = useState('chats'); // 'chats' or 'requests'
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  
  // Friend System State
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Message Input State
  const [newMessage, setNewMessage] = useState('');
  const [chatImage, setChatImage] = useState(null); // For the + button
  const [editingMessageId, setEditingMessageId] = useState(null); // For edit feature
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Profile Edit State
  const [viewingProfile, setViewingProfile] = useState(null); 
  const [editingPhoto, setEditingPhoto] = useState(null); 
  const [photoFilter, setPhotoFilter] = useState('none');
  const [photoZoom, setPhotoZoom] = useState(1);
  const [photoPos, setPhotoPos] = useState({ x: 0, y: 0 });
  
  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const chatImageInputRef = useRef(null);

  // --- 1. AUTH & USER INIT ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          // If no custom token, we wait for user manual login or existing session
        }
      } catch (e) {
        console.error("Auth init error:", e);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Fetch PRIVATE info first (for self)
          const userDoc = await getDoc(doc(db, 'artifacts', appId, 'users', firebaseUser.uid, 'profile', 'info'));
          
          // Also try to sync with PUBLIC info to ensure consistency
          const publicDoc = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'profiles', firebaseUser.uid));
          
          let userData = { ...firebaseUser };
          if (userDoc.exists()) {
            userData = { ...userData, ...userDoc.data() };
          }
          if (publicDoc.exists()) {
            // Prioritize public avatar/bio as that's what others see
            userData = { ...userData, ...publicDoc.data() };
          }
          
          setUser(userData);
        } catch (e) {
          console.error("Error fetching user profile:", e);
          setUser(firebaseUser);
        }
      } else {
        setUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // --- 2. FRIEND & REQUEST LISTENER ---
  useEffect(() => {
    if (!user) return;

    // Listen to my friends list
    const friendsQuery = query(collection(db, 'artifacts', appId, 'users', user.uid, 'friends'));
    const unsubFriends = onSnapshot(friendsQuery, (snapshot) => {
      const friendsList = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
      setFriends(friendsList);
    }, (error) => console.error("Friends list error:", error));

    // Listen to incoming requests
    const requestsQuery = query(collection(db, 'artifacts', appId, 'users', user.uid, 'requests'));
    const unsubRequests = onSnapshot(requestsQuery, (snapshot) => {
      const reqList = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
      setFriendRequests(reqList);
    }, (error) => console.error("Requests list error:", error));

    return () => {
      unsubFriends();
      unsubRequests();
    };
  }, [user]);

  // --- 2.5 LIVE PROFILE SYNC FOR ACTIVE CHAT ---
  // This fixes the issue where you don't see updated pics/bios of friends
  useEffect(() => {
    if (!activeChat || !activeChat.uid) return;

    // Listen to the PUBLIC profile of the person we are chatting with
    const profileRef = doc(db, 'artifacts', appId, 'public', 'data', 'profiles', activeChat.uid);
    
    const unsubProfile = onSnapshot(profileRef, (docSnap) => {
      if (docSnap.exists()) {
        const freshData = docSnap.data();
        
        // 1. Update the Active Chat view
        setActiveChat(prev => ({ ...prev, ...freshData }));

        // 2. Also update this friend in the Friends List state so sidebar updates
        setFriends(prevFriends => 
          prevFriends.map(f => f.uid === activeChat.uid ? { ...f, ...freshData } : f)
        );
      }
    });

    return () => unsubProfile();
  }, [activeChat?.uid]);

  // --- 3. SEARCH (DISCOVERY) ---
  useEffect(() => {
    if (!searchQuery.trim() || !user) {
      setSearchResults([]);
      return;
    }
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'profiles'));
    const unsub = onSnapshot(q, (snapshot) => {
      const results = snapshot.docs
        .map(doc => ({ uid: doc.id, ...doc.data() }))
        .filter(u => 
          u.uid !== user.uid && 
          (u.name?.toLowerCase().includes(searchQuery.toLowerCase()) || u.username?.toLowerCase().includes(searchQuery.toLowerCase()))
        );
      setSearchResults(results);
    }, (error) => console.error("Search error:", error));
    return () => unsub();
  }, [searchQuery, user]);

  // --- 4. MESSAGES & READ RECEIPTS ---
  useEffect(() => {
    if (!user || !activeChat) {
      setMessages([]);
      return;
    }

    const chatId = [user.uid, activeChat.uid].sort().join('_');
    const q = query(collection(db, 'artifacts', appId, 'public', 'data', `messages_${chatId}`));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const sortedMsgs = msgs.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
      setMessages(sortedMsgs);

      // --- MARK MESSAGES AS READ ---
      const unreadBatch = [];
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (data.senderId !== user.uid && !data.read) {
          unreadBatch.push(docSnap.ref);
        }
      });

      if (unreadBatch.length > 0) {
        const batch = writeBatch(db);
        unreadBatch.forEach(ref => batch.update(ref, { read: true }));
        batch.commit().catch(e => console.error("Read receipt error:", e));
      }
    }, (error) => console.error("Messages error:", error));

    return () => unsubscribe();
  }, [user, activeChat]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatImage]);


  // --- HANDLERS ---

  // Friend System Handlers
  const sendFriendRequest = async (targetUser) => {
    if (!user) return;
    try {
      // Add to target's requests
      await setDoc(doc(db, 'artifacts', appId, 'users', targetUser.uid, 'requests', user.uid), {
        uid: user.uid,
        name: user.name,
        username: user.username,
        avatar: user.avatar || null,
        filter: user.filter || 'none',
        status: 'pending'
      });
      console.log('Request sent!');
      setSearchQuery('');
    } catch (err) {
      console.error(err);
    }
  };

  const acceptRequest = async (requester) => {
    try {
      // 1. Add them to my friends
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'friends', requester.uid), requester);
      // 2. Add me to their friends
      await setDoc(doc(db, 'artifacts', appId, 'users', requester.uid, 'friends', user.uid), {
        uid: user.uid,
        name: user.name,
        username: user.username,
        avatar: user.avatar || null,
        filter: user.filter || 'none'
      });
      // 3. Remove request
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'requests', requester.uid));
    } catch (err) {
      console.error(err);
    }
  };

  // Auth Handler
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

  // Message Handlers
  const handleChatImageSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (upload) => {
        // Show preview immediately
        setChatImage(upload.target.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if ((!newMessage.trim() && !chatImage) || !activeChat || !user) return;

    const chatId = [user.uid, activeChat.uid].sort().join('_');
    const msgRef = collection(db, 'artifacts', appId, 'public', 'data', `messages_${chatId}`);

    try {
      if (editingMessageId) {
        // --- EDIT MODE ---
        await updateDoc(doc(msgRef, editingMessageId), {
          text: newMessage,
          isEdited: true
        });
        setEditingMessageId(null);
      } else {
        // --- SEND NEW MESSAGE ---
        let finalImage = null;
        if (chatImage) {
          finalImage = await compressImage(chatImage, 800, 0.7);
        }

        const msgData = {
          senderId: user.uid,
          text: newMessage,
          image: finalImage,
          createdAt: serverTimestamp(),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          read: false,
          isEdited: false
        };
        await addDoc(msgRef, msgData);
      }
      
      setNewMessage('');
      setChatImage(null);
      setShowEmojiPicker(false);
    } catch (err) {
      console.error("Error sending:", err);
    }
  };

  const deleteMessage = async (msgId) => {
    const chatId = [user.uid, activeChat.uid].sort().join('_');
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', `messages_${chatId}`, msgId));
    } catch (e) { console.error(e); }
  };

  const startEditMessage = (msg) => {
    setEditingMessageId(msg.id);
    setNewMessage(msg.text);
    // Focus textarea
    document.querySelector('textarea[name="chatInput"]')?.focus();
  };

  // Profile Photo Handlers
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
    // Compress before saving to avoid Firestore limits
    const compressed = await compressImage(editingPhoto, 400, 0.8);
    
    const updated = { ...user, avatar: compressed, filter: photoFilter };
    setUser(updated);
    
    // Save to private (user settings)
    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info'), updated, { merge: true });
    
    // Save to public (discovery & friends viewing)
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'profiles', user.uid), {
      avatar: compressed,
      filter: photoFilter,
      name: user.name,
      username: user.username,
      bio: user.bio || ''
    }, { merge: true });
    
    setEditingPhoto(null);
  };

  // --- RENDER HELPERS ---
  const Modal = ({ title, onClose, children }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh]">
        <div className="p-5 border-b border-slate-800 flex justify-between items-center">
          <h3 className="font-bold text-lg text-white">{title}</h3>
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

  // --- LOGIN SCREEN ---
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 overflow-y-auto font-sans">
        <div className="bg-slate-900 p-8 md:p-10 rounded-[2.5rem] shadow-2xl w-full max-w-md border border-slate-800 my-8">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-indigo-600 p-5 rounded-3xl mb-5 shadow-2xl shadow-indigo-600/30">
              <MessageCircle className="text-white w-10 h-10" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tighter text-center">PRIVATE CIRCLE</h1>
            <p className="text-slate-500 font-medium text-center">{authMode === 'login' ? 'Welcome back' : 'Create identity'}</p>
          </div>
          
          <form onSubmit={handleAuth} className="space-y-4">
            {authMode === 'signup' && (
              <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display Name" className="w-full bg-slate-800 border-2 border-slate-700 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-600" required />
            )}
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email Address" className="w-full bg-slate-800 border-2 border-slate-700 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-600" required />
            <div className="relative">
              <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full bg-slate-800 border-2 border-slate-700 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-600" required />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">{showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}</button>
            </div>
            {authMode === 'signup' && (
               <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm Password" className="w-full bg-slate-800 border-2 border-slate-700 rounded-2xl px-6 py-4 text-white focus:outline-none focus:border-indigo-500 transition-all placeholder:text-slate-600" required />
            )}
            {authError && <p className="text-rose-500 text-xs font-bold text-center px-2">{authError}</p>}
            <button type="submit" disabled={authLoading} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2">
              {authLoading ? <Loader2 className="animate-spin" /> : (authMode === 'login' ? 'Login' : 'Sign Up')}
            </button>
          </form>
          <div className="mt-6 text-center">
            <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="text-sm font-bold text-slate-500 hover:text-indigo-400 transition-colors">
              {authMode === 'login' ? "Need an account? Sign Up" : "Have an account? Login"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Determine list to show in sidebar
  const isSearching = searchQuery.trim().length > 0;
  const sidebarList = isSearching ? searchResults : (sidebarTab === 'chats' ? friends : friendRequests);

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans">
      
      {/* --- SIDEBAR --- */}
      <aside className={`${isSidebarCollapsed ? 'w-20' : 'w-80'} flex-shrink-0 border-r border-slate-800 bg-slate-900 transition-all duration-500 flex flex-col relative z-20 shadow-2xl`}>
        
        {/* My Profile Header */}
        <div className={`p-4 border-b border-slate-800 flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
          <div onClick={() => { if(isSidebarCollapsed) setIsSidebarCollapsed(false); else setViewingProfile('me'); }} className="relative flex-shrink-0 cursor-pointer group">
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

        {/* Search & Tabs */}
        {!isSidebarCollapsed && (
          <div className="p-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={16} />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search people..." className="w-full bg-slate-800/50 border border-slate-700 rounded-xl py-2 pl-10 pr-4 text-xs focus:border-indigo-500 outline-none transition-all" />
            </div>
            
            {/* Sidebar Tabs (Only if not searching) */}
            {!isSearching && (
              <div className="flex p-1 bg-slate-800 rounded-xl">
                <button onClick={() => setSidebarTab('chats')} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${sidebarTab === 'chats' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>
                  Friends
                </button>
                <button onClick={() => setSidebarTab('requests')} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all relative ${sidebarTab === 'requests' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>
                  Requests
                  {friendRequests.length > 0 && <span className="absolute top-0 right-1 w-2 h-2 bg-rose-500 rounded-full animate-pulse"/>}
                </button>
              </div>
            )}
          </div>
        )}

        {/* List (Friends / Requests / Search) */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          <p className={`px-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 mb-4 ${isSidebarCollapsed ? 'hidden' : ''}`}>
            {isSearching ? 'Discovery' : (sidebarTab === 'chats' ? 'My Circle' : 'Pending Requests')}
          </p>

          {sidebarList.length === 0 && !isSidebarCollapsed && (
            <div className="text-center text-slate-600 text-xs py-10 px-4">
              {isSearching ? "No users found" : (sidebarTab === 'chats' ? "No friends yet. Search to add!" : "No pending requests.")}
            </div>
          )}

          {sidebarList.map(item => {
            // Check if user is already a friend to toggle Add/Chat button
            const isFriend = friends.some(f => f.uid === item.uid);
            
            return (
              <div key={item.uid} 
                onClick={() => {
                   if(isSidebarCollapsed) setIsSidebarCollapsed(false);
                   else if(isSearching) { /* Do nothing on search click unless added logic */ }
                   else if(sidebarTab === 'chats') { setActiveChat(item); setShowEmojiPicker(false); }
                }}
                className={`w-full flex items-center gap-4 p-4 rounded-[1.25rem] mb-2 transition-all cursor-pointer group ${activeChat?.uid === item.uid && !isSearching ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' : 'hover:bg-slate-800 text-slate-400'}`}
              >
                <div className={`w-10 h-10 rounded-xl bg-slate-700 flex-shrink-0 flex items-center justify-center text-white font-bold overflow-hidden`}>
                  {item.avatar ? <img src={item.avatar} className={`w-full h-full object-cover filter-${item.filter}`} alt="" /> : item.name[0]}
                </div>
                {!isSidebarCollapsed && (
                  <div className="flex-1 overflow-hidden flex items-center justify-between">
                    <div className="overflow-hidden">
                      <p className={`text-sm font-bold truncate ${activeChat?.uid === item.uid ? 'text-white' : 'text-slate-200'}`}>{item.name}</p>
                      <p className="text-[10px] opacity-60 truncate">{item.username}</p>
                    </div>
                    {/* Action Buttons */}
                    {isSearching && !isFriend && (
                      <button onClick={(e) => { e.stopPropagation(); sendFriendRequest(item); }} className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500"><UserPlus size={14}/></button>
                    )}
                    {sidebarTab === 'requests' && !isSearching && (
                      <button onClick={(e) => { e.stopPropagation(); acceptRequest(item); }} className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-500 text-[10px] font-bold">Accept</button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {!isSidebarCollapsed && (
          <div className="p-4 border-t border-slate-800">
            <button onClick={() => signOut(auth)} className="w-full py-3 bg-slate-800 hover:bg-rose-900/20 hover:text-rose-500 rounded-xl text-xs font-bold transition-all">Sign Out</button>
          </div>
        )}
      </aside>

      {/* --- MAIN CHAT AREA --- */}
      <main onClick={() => setIsSidebarCollapsed(true)} className="flex-1 flex flex-col bg-slate-950 relative">
        {/* Chat Header */}
        <header className="h-20 flex-shrink-0 border-b border-slate-800 bg-slate-900/60 backdrop-blur-xl px-8 flex items-center justify-between z-10">
          <div className="flex items-center gap-4 cursor-pointer group" onClick={(e) => { e.stopPropagation(); if (activeChat) setViewingProfile(activeChat); }}>
            <div className={`w-11 h-11 rounded-2xl bg-slate-700 flex items-center justify-center text-white font-black shadow-lg overflow-hidden`}>
              {activeChat?.avatar ? <img src={activeChat.avatar} className={`w-full h-full object-cover filter-${activeChat.filter}`} alt="" /> : (activeChat?.name[0] || '?')}
            </div>
            <div>
              <h2 className="text-base font-bold text-white">{activeChat?.name || 'Private Circle'}</h2>
              {activeChat && (
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Encrypted</p>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar bg-[radial-gradient(circle_at_50%_50%,rgba(79,70,229,0.05),transparent_70%)]">
          {activeChat && messages.length > 0 ? (
            messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.senderId === user.uid ? 'justify-end' : 'justify-start'} group animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                <div className={`relative max-w-[70%] flex flex-col ${msg.senderId === user.uid ? 'items-end' : 'items-start'}`}>
                  
                  {/* Action Menu (Delete/Edit) for own messages */}
                  {msg.senderId === user.uid && (
                    <div className="absolute -top-6 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                      <button onClick={() => startEditMessage(msg)} className="p-1 text-slate-400 hover:text-white bg-slate-800 rounded-full"><Edit2 size={12}/></button>
                      <button onClick={() => deleteMessage(msg.id)} className="p-1 text-slate-400 hover:text-rose-500 bg-slate-800 rounded-full"><Trash2 size={12}/></button>
                    </div>
                  )}

                  <div className={`px-5 py-4 rounded-3xl shadow-xl overflow-hidden ${msg.senderId === user.uid ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-900 text-slate-200 rounded-tl-none border border-slate-800'}`}>
                    {msg.image && (
                      <div className="mb-3 rounded-xl overflow-hidden">
                        <img src={msg.image} alt="attachment" className="w-full h-auto object-cover max-h-60" />
                      </div>
                    )}
                    <p className="text-sm leading-relaxed font-medium whitespace-pre-wrap">{msg.text}</p>
                  </div>

                  <div className="flex items-center gap-1.5 mt-1 px-1 opacity-50 text-[9px] font-bold tracking-tighter">
                     {msg.isEdited && <span>(edited)</span>}
                     {msg.timestamp}
                     {msg.senderId === user.uid && (
                       <CheckCheck size={14} className={msg.read ? 'text-blue-400' : 'text-slate-400'} />
                     )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-4">
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-slate-800 flex items-center justify-center"><MessageCircle size={24} /></div>
              <p className="text-sm font-bold uppercase tracking-widest text-center">{activeChat ? "Say hello!" : "Select a friend to chat"}</p>
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        {/* Input Area */}
        {activeChat && (
          <footer className="p-6 bg-slate-900/40 backdrop-blur-xl" onClick={(e) => e.stopPropagation()}>
            {/* Image Preview */}
            {chatImage && (
              <div className="relative inline-block mb-4 ml-4 animate-in slide-in-from-bottom-4">
                <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-indigo-500 shadow-xl relative">
                  <img src={chatImage} className="w-full h-full object-cover" alt="preview" />
                </div>
                <button onClick={() => setChatImage(null)} className="absolute -top-2 -right-2 bg-rose-500 text-white p-1 rounded-full shadow-lg hover:scale-110 transition-transform"><X size={14}/></button>
              </div>
            )}
            
            {/* Editing Indicator */}
            {editingMessageId && (
               <div className="flex justify-between items-center px-6 py-2 text-xs font-bold text-indigo-400 bg-indigo-500/10 rounded-t-2xl mx-4">
                 <span>Editing Message...</span>
                 <button onClick={() => { setEditingMessageId(null); setNewMessage(''); }}><X size={14}/></button>
               </div>
            )}

            <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto flex items-center gap-4 relative">
              {showEmojiPicker && (
                <div className="absolute bottom-24 left-0 bg-slate-900 border border-slate-800 p-4 rounded-[2rem] shadow-2xl w-80 h-72 overflow-y-auto grid grid-cols-6 gap-2 z-50">
                  {EMOJIS.map(e => <button key={e} type="button" onClick={() => setNewMessage(p => p + e)} className="text-2xl hover:bg-slate-800 p-2 rounded-xl transition-all">{e}</button>)}
                </div>
              )}
              
              <div className="relative">
                <input type="file" ref={chatImageInputRef} className="hidden" accept="image/*" onChange={handleChatImageSelect} />
                <button type="button" onClick={() => chatImageInputRef.current?.click()} className="p-3 text-slate-500 hover:text-white hover:bg-slate-800 rounded-2xl transition-all">
                  <Plus size={24} />
                </button>
              </div>

              <div className="flex-1 relative">
                {/* REPLACED INPUT WITH TEXTAREA */}
                <textarea 
                  name="chatInput"
                  value={newMessage} 
                  onChange={(e) => setNewMessage(e.target.value)} 
                  onFocus={() => setIsSidebarCollapsed(true)} 
                  onKeyDown={(e) => {
                    if(e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e);
                    }
                  }}
                  placeholder="Type a message..." 
                  className="w-full bg-slate-900/50 border-2 border-slate-800 rounded-[1.5rem] py-4 px-6 text-sm focus:border-indigo-600 outline-none transition-all pr-14 resize-none h-14 custom-scrollbar leading-normal" 
                />
                <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-indigo-400"><Smile size={24} /></button>
              </div>
              <button disabled={(!newMessage.trim() && !chatImage)} type="submit" className="p-4 bg-indigo-600 text-white rounded-[1.5rem] hover:bg-indigo-500 disabled:opacity-20 shadow-2xl shadow-indigo-600/40 transition-all active:scale-95">
                {editingMessageId ? <Check size={24} /> : <Send size={24} />}
              </button>
            </form>
          </footer>
        )}
      </main>

      {/* --- MODALS (PROFILE & EDIT) --- */}
      {viewingProfile && (
        <Modal title={viewingProfile === 'me' ? 'My Profile' : 'Contact Info'} onClose={() => setViewingProfile(null)}>
          {viewingProfile === 'me' ? (
            <div className="space-y-8 py-4">
              <div className="flex flex-col items-center">
                <div className="relative">
                  <div className={`w-40 h-40 rounded-[2.5rem] bg-indigo-600 flex items-center justify-center text-5xl font-black text-white overflow-hidden shadow-2xl`}>
                    {user.avatar ? <img src={user.avatar} className={`w-full h-full object-cover filter-${user.filter}`} alt="avatar" /> : (user.name?.[0] || 'U').toUpperCase()}
                  </div>
                  <button onClick={() => fileInputRef.current?.click()} className="absolute -bottom-2 -right-2 p-4 bg-indigo-600 border-4 border-slate-900 rounded-3xl text-white hover:bg-indigo-500 transition-all shadow-xl"><Camera size={22} /></button>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                </div>
              </div>
              <div className="space-y-6">
                <div><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2 px-1">Display Name</label><input type="text" value={user.name || ''} readOnly className="w-full bg-slate-800 border-2 border-slate-700 rounded-2xl px-5 py-4 opacity-60" /></div>
                <div><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2 px-1">Bio</label><textarea value={user.bio || ''} onChange={e => setUser({...user, bio: e.target.value})} rows={3} className="w-full bg-slate-800 border-2 border-slate-700 rounded-2xl px-5 py-4 focus:border-indigo-600 outline-none resize-none" /></div>
                <button onClick={async () => {
                    await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'profile', 'info'), { bio: user.bio }, { merge: true });
                    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'profiles', user.uid), { bio: user.bio }, { merge: true });
                    // alert('Bio updated!'); 
                }} className="w-full bg-slate-800 hover:bg-indigo-600 py-4 rounded-2xl font-bold transition-all">Save Changes</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center space-y-6 py-4">
              <div className={`w-40 h-40 rounded-[2.5rem] bg-slate-700 flex items-center justify-center text-5xl font-black text-white shadow-2xl overflow-hidden`}>
                {viewingProfile.avatar ? <img src={viewingProfile.avatar} className={`w-full h-full object-cover filter-${viewingProfile.filter}`} alt="" /> : viewingProfile.name?.[0]}
              </div>
              <div><h2 className="text-3xl font-black tracking-tight">{viewingProfile.name}</h2><p className="text-indigo-400 font-bold mt-1">{viewingProfile.username}</p></div>
              <div className="bg-slate-800/40 p-6 rounded-[2rem] border border-slate-800 w-full text-sm leading-relaxed text-slate-300 italic">"{viewingProfile.bio || 'No bio available'}"</div>
            </div>
          )}
        </Modal>
      )}

      {/* PHOTO EDITOR */}
      {editingPhoto && (
        <Modal title="Edit Photo" onClose={() => setEditingPhoto(null)}>
          <div className="space-y-8">
            <div className="flex flex-col items-center gap-4">
              <div className="relative w-full aspect-square bg-slate-950 rounded-[2.5rem] overflow-hidden border-2 border-slate-800 flex items-center justify-center">
                <div style={{ transform: `scale(${photoZoom})`, filter: photoFilter !== 'none' ? `var(--tw-filter-${photoFilter})` : 'none' }} className="transition-transform duration-75">
                  <img src={editingPhoto} className="max-w-none w-full h-auto object-contain" alt="editing" />
                </div>
              </div>
              <div className="w-full flex items-center justify-center gap-4">
                <button onClick={() => setPhotoZoom(z => Math.max(0.5, z - 0.2))} className="p-3 bg-slate-800 rounded-xl"><ZoomOut size={20}/></button>
                <button onClick={() => setPhotoZoom(z => Math.min(3, z + 0.2))} className="p-3 bg-slate-800 rounded-xl"><ZoomIn size={20}/></button>
              </div>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-4 custom-scrollbar">
              {['none', 'grayscale', 'sepia', 'invert'].map(f => (
                <button key={f} onClick={() => setPhotoFilter(f)} className={`flex-shrink-0 px-5 py-3 rounded-2xl text-[10px] font-black uppercase transition-all ${photoFilter === f ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500'}`}>{f}</button>
              ))}
            </div>
            <button onClick={saveProfilePhoto} className="w-full py-4 bg-indigo-600 rounded-2xl font-bold flex items-center justify-center gap-2"><Check size={22} /> Apply Photo</button>
          </div>
        </Modal>
      )}

      <style>{`
        :root { --tw-filter-grayscale: grayscale(1); --tw-filter-sepia: sepia(0.8) contrast(1.2); --tw-filter-invert: invert(0.9); }
        .filter-grayscale { filter: var(--tw-filter-grayscale); } .filter-sepia { filter: var(--tw-filter-sepia); } .filter-invert { filter: var(--tw-filter-invert); }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 10px; }
      `}</style>
    </div>
  );
}
