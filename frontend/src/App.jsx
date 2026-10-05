import React, { useState, useEffect, useRef } from 'react';
import {
  Upload, FileText, Trash2, Download, Eye, HardDrive,
  RefreshCw, CheckCircle2, AlertCircle, File, Image, FileArchive, Search, X,
  Film, Music, Code, Mail, Lock, User as UserIcon, LogIn, LogOut, EyeOff, ShieldCheck
} from 'lucide-react';

export default function App() {
  // Authentication State
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('vault_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('vault_token') || null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  // Files & Vault State
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState(null);
  const [selectedFileModal, setSelectedFileModal] = useState(null);
  const [modalTextContent, setModalTextContent] = useState('');
  const [modalTextLoading, setModalTextLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [serverHealthy, setServerHealthy] = useState(false);
  const fileInputRef = useRef(null);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const checkHealth = async () => {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setServerHealthy(data.success === true);
    } catch {
      setServerHealthy(false);
    }
  };

  // Verify authentication on mount
  useEffect(() => {
    checkHealth();
    if (token) {
      fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.user) {
            setUser(data.user);
            localStorage.setItem('vault_user', JSON.stringify(data.user));
          } else {
            // Token expired or invalid
            handleLogout(false);
          }
        })
        .catch(() => {
          // If server error, keep offline token for now
        });
    }
  }, []);

  const fetchFiles = async () => {
    if (!token) {
      setFiles([]);
      return;
    }

    try {
      setLoading(true);
      await checkHealth();
      const res = await fetch('/api/files', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.status === 401) {
        handleLogout(false);
        showNotification('Session expired. Please sign in again.', 'error');
        setAuthModalOpen(true);
        return;
      }
      if (data.success) {
        setFiles(data.files || []);
      } else {
        showNotification(data.message || 'Failed to fetch files', 'error');
      }
    } catch {
      showNotification('Network connection error to backend server', 'error');
      setServerHealthy(false);
    } finally {
      setLoading(false);
    }
  };

  // Fetch files whenever user is authenticated or changed
  useEffect(() => {
    if (token) {
      fetchFiles();
    } else {
      setFiles([]);
    }
  }, [token]);

  // Fetch text preview when text file is selected
  useEffect(() => {
    if (!selectedFileModal || !token) {
      setModalTextContent('');
      return;
    }

    const { mimeType = '', filename = '' } = selectedFileModal;
    const isText = mimeType.startsWith('text/') ||
      mimeType.includes('json') ||
      mimeType.includes('javascript') ||
      mimeType.includes('xml') ||
      /\.(txt|md|json|js|jsx|ts|tsx|html|css|py|sh|sql|yml|yaml|csv)$/i.test(filename);

    if (isText) {
      setModalTextLoading(true);
      fetch(`/api/files/${selectedFileModal.id}?token=${encodeURIComponent(token)}`)
        .then((res) => res.text())
        .then((text) => {
          setModalTextContent(text.slice(0, 100000));
          setModalTextLoading(false);
        })
        .catch(() => {
          setModalTextContent('Error loading text content.');
          setModalTextLoading(false);
        });
    } else {
      setModalTextContent('');
    }
  }, [selectedFileModal, token]);

  // Auth Submit: Login or Register
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);

    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const payload = authMode === 'login'
      ? { email: authForm.email, password: authForm.password }
      : { name: authForm.name, email: authForm.email, password: authForm.password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok && data.success) {
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem('vault_token', data.token);
        localStorage.setItem('vault_user', JSON.stringify(data.user));
        setAuthModalOpen(false);
        setAuthForm({ name: '', email: '', password: '' });
        showNotification(data.message || (authMode === 'login' ? 'Signed in successfully!' : 'Account registered successfully!'));
      } else {
        setAuthError(data.message || 'Authentication failed. Please verify credentials.');
      }
    } catch {
      setAuthError('Connection error. Ensure backend server is running.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = (notify = true) => {
    setToken(null);
    setUser(null);
    setFiles([]);
    localStorage.removeItem('vault_token');
    localStorage.removeItem('vault_user');
    if (notify) {
      showNotification('You have been signed out.');
    }
  };

  const processUpload = async (file) => {
    if (!token) {
      showNotification('Please sign in with your email to upload files.', 'error');
      setAuthModalOpen(true);
      return;
    }

    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showNotification('File size exceeds the 10MB permitted limit.', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    setUploadProgress(25);

    try {
      setUploadProgress(65);
      const res = await fetch('/api/files/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();

      setUploadProgress(100);
      if (res.ok && data.success) {
        showNotification(`File "${file.name}" uploaded successfully!`);
        fetchFiles();
      } else {
        showNotification(data.message || 'Upload failed', 'error');
      }
    } catch {
      showNotification('Server error during upload process.', 'error');
    } finally {
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }, 500);
    }
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      processUpload(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processUpload(file);
    }
  };

  const handleDelete = async (id, filename) => {
    if (!token) return;
    if (!confirm(`Are you sure you want to permanently delete "${filename}" from your vault?`)) return;

    try {
      const res = await fetch(`/api/files/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showNotification('File successfully deleted from MongoDB.');
        setFiles(files.filter((f) => f.id !== id));
        if (selectedFileModal?.id === id) {
          setSelectedFileModal(null);
        }
      } else {
        showNotification(data.message || 'Deletion failed', 'error');
      }
    } catch {
      showNotification('Error connecting to server for deletion.', 'error');
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType = '', filename = '') => {
    const lowerName = filename.toLowerCase();
    if (mimeType.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(lowerName)) {
      return <Image size={24} color="#34d399" />;
    }
    if (mimeType.includes('pdf') || lowerName.endsWith('.pdf')) {
      return <FileText size={24} color="#fb7185" />;
    }
    if (mimeType.startsWith('video/') || /\.(mp4|webm|mov|mkv)$/i.test(lowerName)) {
      return <Film size={24} color="#a855f7" />;
    }
    if (mimeType.startsWith('audio/') || /\.(mp3|wav|ogg|m4a)$/i.test(lowerName)) {
      return <Music size={24} color="#ec4899" />;
    }
    if (mimeType.includes('zip') || mimeType.includes('compressed') || /\.(zip|tar|gz|rar|7z)$/i.test(lowerName)) {
      return <FileArchive size={24} color="#fbbf24" />;
    }
    if (mimeType.includes('json') || mimeType.includes('javascript') || /\.(json|js|jsx|ts|tsx|html|css|py|sql|yml)$/i.test(lowerName)) {
      return <Code size={24} color="#38bdf8" />;
    }
    return <File size={24} color="#94a3b8" />;
  };

  const filteredFiles = files.filter(
    (f) =>
      f.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.mimeType.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen flex flex-col" style={{ color: '#f8fafc' }}>
      {/* Toast Notification */}
      {notification && (
        <div className={`toast ${notification.type}`}>
          {notification.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
          <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{notification.message}</span>
        </div>
      )}

      {/* Top Navbar */}
      <header>
        <div className="max-w-7xl px-4 h-full flex items-center justify-between">
          {/* Logo & App Title */}
          <div className="flex items-center gap-3">
            <div style={{ background: 'linear-gradient(135deg, #4f46e5, #8b5cf6)', padding: '0.5rem', borderRadius: '0.75rem', display: 'flex', alignItems: 'center' }}>
              <HardDrive size={22} color="white" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h1 style={{ fontWeight: 700, fontSize: '1.125rem', margin: 0, letterSpacing: '-0.02em' }}>GridFS Vault</h1>
                <span style={{ background: 'rgba(99, 102, 241, 0.2)', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#a5b4fc', fontSize: '0.65rem', fontWeight: 600, padding: '0.1rem 0.45rem', borderRadius: '9999px' }}>
                  v2.0 AUTH
                </span>
              </div>
              <p style={{ fontSize: '0.725rem', color: '#94a3b8', margin: 0 }}>MongoDB Cloud Storage</p>
            </div>
          </div>

          {/* Right Header Navigation & User Profile */}
          <div className="flex items-center gap-3">
            {/* Live Database Status Indicator */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.35rem 0.75rem',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: 500,
                background: serverHealthy ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                border: `1px solid ${serverHealthy ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                color: serverHealthy ? '#6ee7b7' : '#fca5a5'
              }}
            >
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: serverHealthy ? '#10b981' : '#ef4444',
                  boxShadow: serverHealthy ? '0 0 8px #10b981' : 'none',
                  display: 'inline-block'
                }}
              />
              <span>{serverHealthy ? 'MongoDB Connected' : 'Server Offline'}</span>
            </div>

            {user ? (
              // Authenticated User Controls
              <div className="flex items-center gap-2">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: '#1e293b', border: '1px solid #334155', borderRadius: '9999px', padding: '0.25rem 0.75rem 0.25rem 0.35rem' }}>
                  <div className="avatar-badge">
                    {user.name ? user.name.slice(0, 2).toUpperCase() : user.email.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#f1f5f9', lineHeight: 1.2 }}>{user.name || 'User'}</div>
                    <div style={{ fontSize: '0.675rem', color: '#94a3b8', lineHeight: 1.2 }}>{user.email}</div>
                  </div>
                </div>

                <button
                  onClick={() => fetchFiles()}
                  className="btn-secondary"
                  title="Refresh Vault"
                  style={{ padding: '0.5rem' }}
                >
                  <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                </button>

                <button
                  onClick={() => handleLogout(true)}
                  className="btn-secondary"
                  title="Sign Out"
                  style={{ padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#f87171' }}
                >
                  <LogOut size={16} />
                  <span style={{ fontSize: '0.75rem' }}>Sign Out</span>
                </button>
              </div>
            ) : (
              // Unauthenticated Actions
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setAuthMode('login');
                    setAuthError(null);
                    setAuthModalOpen(true);
                  }}
                  className="btn-secondary"
                  style={{ padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <LogIn size={16} />
                  <span>Sign In</span>
                </button>

                <button
                  onClick={() => {
                    setAuthMode('register');
                    setAuthError(null);
                    setAuthModalOpen(true);
                  }}
                  className="btn-primary"
                  style={{ padding: '0.5rem 1rem' }}
                >
                  <span>Sign Up</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl px-4 py-8 flex-1 w-full" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

        {!user ? (
          // Welcome Banner / Gate when not signed in
          <div className="card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem', background: 'radial-gradient(ellipse at 50% -20%, rgba(99, 102, 241, 0.25) 0%, rgba(15, 23, 42, 0.8) 70%)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
            <div style={{ maxWidth: '34rem', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem', alignItems: 'center' }}>
              <div style={{ width: '4.5rem', height: '4.5rem', borderRadius: '1.25rem', background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#818cf8' }}>
                <ShieldCheck size={36} />
              </div>

              <div>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, color: '#f8fafc', letterSpacing: '-0.02em' }}>
                  Secure MongoDB GridFS Cloud Vault
                </h2>
                <p style={{ fontSize: '0.95rem', color: '#94a3b8', marginTop: '0.75rem', lineHeight: 1.6 }}>
                  Sign in with your email to store, stream, preview, and manage private files directly backed by MongoDB GridFS stream storage.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <button
                  onClick={() => {
                    setAuthMode('login');
                    setAuthError(null);
                    setAuthModalOpen(true);
                  }}
                  className="btn-primary"
                  style={{ padding: '0.75rem 1.75rem', fontSize: '0.95rem' }}
                >
                  <Mail size={18} />
                  <span>Login with Email</span>
                </button>

                <button
                  onClick={() => {
                    setAuthMode('register');
                    setAuthError(null);
                    setAuthModalOpen(true);
                  }}
                  className="btn-secondary"
                  style={{ padding: '0.75rem 1.5rem', fontSize: '0.95rem' }}
                >
                  <UserIcon size={18} />
                  <span>Create Account</span>
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', fontSize: '0.75rem', color: '#64748b', marginTop: '1rem' }}>
                <span>🔒 JWT Encrypted Auth</span>
                <span>•</span>
                <span>⚡ Streamed Chunk Storage</span>
                <span>•</span>
                <span>👁 Instant File Preview</span>
              </div>
            </div>
          </div>
        ) : (
          // Upload Zone Card for Logged-In Users
          <div
            className="card"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              textAlign: 'center',
              position: 'relative',
              overflow: 'hidden',
              border: isDragging ? '2px dashed #6366f1' : '1px solid #1e293b',
              background: isDragging ? 'rgba(99, 102, 241, 0.08)' : 'rgba(15, 23, 42, 0.7)',
              transition: 'all 0.2s ease',
              cursor: 'pointer'
            }}
            onClick={() => {
              if (!uploading) fileInputRef.current?.click();
            }}
          >
            <div style={{ maxWidth: '32rem', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', pointerEvents: uploading ? 'none' : 'auto' }}>
              <div
                style={{
                  width: '4.5rem',
                  height: '4.5rem',
                  borderRadius: '1.25rem',
                  background: isDragging ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#818cf8',
                  transform: isDragging ? 'scale(1.08)' : 'scale(1)',
                  transition: 'transform 0.2s ease'
                }}
              >
                <Upload size={32} />
              </div>

              <h2 style={{ fontSize: '1.35rem', fontWeight: 600, margin: 0 }}>
                {isDragging ? 'Drop file here to upload' : 'Upload Files to Your GridFS Vault'}
              </h2>

              <p style={{ fontSize: '0.875rem', color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
                Drag & drop any file here, or click to browse. Images, PDFs, documents, audio, video, archives, and code files up to 10MB are streamed directly into your private GridFS storage.
              </p>

              <div onClick={(e) => e.stopPropagation()}>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileInputChange}
                  style={{ display: 'none' }}
                />
                <button
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-primary"
                >
                  {uploading ? (
                    <>
                      <RefreshCw size={18} className="animate-spin" />
                      <span>Uploading to GridFS... {uploadProgress}%</span>
                    </>
                  ) : (
                    <>
                      <Upload size={18} />
                      <span>Select File to Upload</span>
                    </>
                  )}
                </button>
              </div>

              {uploading && (
                <div style={{ width: '100%', background: '#1e293b', borderRadius: '9999px', height: '0.5rem', overflow: 'hidden', marginTop: '0.5rem' }}>
                  <div style={{ background: 'linear-gradient(90deg, #4f46e5, #8b5cf6)', height: '100%', width: `${uploadProgress}%`, transition: 'width 0.3s ease' }}></div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Files Explorer Section (Only when logged in) */}
        {user && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Stored Vault Files</h3>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>
                  {files.length} {files.length === 1 ? 'file' : 'files'} stored in your personal vault
                </p>
              </div>

              {/* Search Bar */}
              <div style={{ position: 'relative', width: '100%', maxWidth: '20rem' }}>
                <Search size={16} color="#94a3b8" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Search filename or type..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Grid View or Empty State */}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="card" style={{ height: '9rem', opacity: 0.5 }}></div>
                ))}
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
                <File size={48} color="#475569" style={{ margin: '0 auto 0.75rem auto' }} />
                <h4 style={{ color: '#cbd5e1', fontWeight: 500, margin: 0 }}>
                  {searchTerm ? 'No matching files found' : 'Your vault is empty'}
                </h4>
                <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.25rem' }}>
                  {searchTerm ? 'Try a different search query.' : 'Upload files above to store them in your secure MongoDB GridFS bucket.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredFiles.map((file) => (
                  <div key={file.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                        <div style={{ padding: '0.5rem', borderRadius: '0.5rem', background: '#1e293b', border: '1px solid #334155', display: 'flex', alignItems: 'center' }}>
                          {getFileIcon(file.mimeType, file.filename)}
                        </div>
                        <span style={{ fontSize: '0.65rem', fontWeight: 600, padding: '0.25rem 0.5rem', borderRadius: '9999px', background: '#1e293b', color: '#cbd5e1', border: '1px solid #334155', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {file.mimeType.split('/')[1] || file.filename.split('.').pop() || 'file'}
                        </span>
                      </div>

                      <div>
                        <h4 style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '0.9rem', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={file.filename}>
                          {file.filename}
                        </h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.35rem' }}>
                          <span>{formatFileSize(file.size)}</span>
                          <span>•</span>
                          <span>{new Date(file.uploadedAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Card Actions */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '1rem', marginTop: '1rem', borderTop: '1px solid #1e293b' }}>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button onClick={() => setSelectedFileModal(file)} title="Preview File" className="btn-secondary" style={{ padding: '0.45rem 0.75rem' }}>
                          <Eye size={15} />
                          <span style={{ fontSize: '0.75rem' }}>Preview</span>
                        </button>
                        <a
                          href={`/api/files/${file.id}/download?token=${encodeURIComponent(token)}`}
                          title="Download File"
                          className="btn-secondary"
                          style={{ padding: '0.45rem 0.75rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                        >
                          <Download size={15} />
                          <span style={{ fontSize: '0.75rem' }}>Download</span>
                        </a>
                      </div>
                      <button onClick={() => handleDelete(file.id, file.filename)} title="Delete File" className="btn-danger" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* File Preview Modal */}
      {selectedFileModal && (
        <div className="modal-backdrop" onClick={() => setSelectedFileModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem', borderBottom: '1px solid #1e293b' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                {getFileIcon(selectedFileModal.mimeType, selectedFileModal.filename)}
                <h3 style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '1rem', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedFileModal.filename}
                </h3>
              </div>
              <button onClick={() => setSelectedFileModal(null)} className="btn-secondary" style={{ padding: '0.375rem', borderRadius: '0.375rem' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '1.5rem', flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(2, 6, 23, 0.65)', minHeight: '18rem', maxHeight: '65vh' }}>
              {selectedFileModal.mimeType.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(selectedFileModal.filename) ? (
                <img
                  src={`/api/files/${selectedFileModal.id}?token=${encodeURIComponent(token || '')}`}
                  alt={selectedFileModal.filename}
                  style={{ maxHeight: '55vh', maxWidth: '100%', borderRadius: '0.5rem', objectFit: 'contain' }}
                />
              ) : selectedFileModal.mimeType.includes('pdf') || selectedFileModal.filename.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={`/api/files/${selectedFileModal.id}?token=${encodeURIComponent(token || '')}`}
                  title={selectedFileModal.filename}
                  style={{ width: '100%', height: '55vh', borderRadius: '0.5rem', border: '1px solid #1e293b', background: 'white' }}
                />
              ) : selectedFileModal.mimeType.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(selectedFileModal.filename) ? (
                <video
                  src={`/api/files/${selectedFileModal.id}?token=${encodeURIComponent(token || '')}`}
                  controls
                  autoPlay={false}
                  style={{ maxHeight: '55vh', maxWidth: '100%', borderRadius: '0.5rem' }}
                />
              ) : selectedFileModal.mimeType.startsWith('audio/') || /\.(mp3|wav|ogg)$/i.test(selectedFileModal.filename) ? (
                <div style={{ width: '100%', maxWidth: '28rem', textAlign: 'center', padding: '2rem 1rem' }}>
                  <Music size={48} color="#ec4899" style={{ margin: '0 auto 1rem auto' }} />
                  <audio
                    src={`/api/files/${selectedFileModal.id}?token=${encodeURIComponent(token || '')}`}
                    controls
                    style={{ width: '100%', borderRadius: '0.5rem' }}
                  />
                </div>
              ) : modalTextLoading ? (
                <div style={{ textAlign: 'center', color: '#94a3b8' }}>
                  <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 0.5rem auto' }} />
                  <p style={{ margin: 0, fontSize: '0.875rem' }}>Loading file contents...</p>
                </div>
              ) : modalTextContent ? (
                <pre
                  style={{
                    width: '100%',
                    maxHeight: '55vh',
                    overflow: 'auto',
                    background: '#020617',
                    border: '1px solid #1e293b',
                    borderRadius: '0.5rem',
                    padding: '1rem',
                    fontSize: '0.825rem',
                    lineHeight: '1.5',
                    color: '#e2e8f0',
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    textAlign: 'left',
                    margin: 0
                  }}
                >
                  {modalTextContent}
                </pre>
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                  <File size={48} color="#475569" style={{ margin: '0 auto 0.75rem auto' }} />
                  <p style={{ fontSize: '0.875rem', color: '#94a3b8', margin: '0 0 1rem 0' }}>
                    Direct inline preview is not supported for this binary file format.
                  </p>
                  <a
                    href={`/api/files/${selectedFileModal.id}/download?token=${encodeURIComponent(token || '')}`}
                    className="btn-primary"
                    style={{ textDecoration: 'none', display: 'inline-flex' }}
                  >
                    <Download size={16} />
                    <span>Download to Open</span>
                  </a>
                </div>
              )}
            </div>

            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #1e293b', background: 'rgba(15, 23, 42, 0.9)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: '#94a3b8' }}>
              <span>Size: {formatFileSize(selectedFileModal.size)}</span>
              <a
                href={`/api/files/${selectedFileModal.id}/download?token=${encodeURIComponent(token || '')}`}
                className="btn-primary"
                style={{ textDecoration: 'none', padding: '0.45rem 1rem', fontSize: '0.8rem' }}
              >
                <Download size={14} />
                <span>Download File</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Authentication Modal (Sign In / Register with Email) */}
      {authModalOpen && (
        <div className="modal-backdrop" onClick={() => setAuthModalOpen(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '28rem', borderRadius: '1.25rem', background: '#0b1120', border: '1px solid #1e293b' }}
          >
            {/* Header */}
            <div style={{ padding: '1.5rem 1.5rem 1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: '#f8fafc' }}>
                  {authMode === 'login' ? 'Sign In to Your Vault' : 'Create an Account'}
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '0.25rem', margin: 0 }}>
                  {authMode === 'login'
                    ? 'Enter your email and password to access your files.'
                    : 'Get started with your personal MongoDB GridFS vault.'}
                </p>
              </div>
              <button
                onClick={() => setAuthModalOpen(false)}
                className="btn-secondary"
                style={{ padding: '0.35rem', borderRadius: '0.5rem' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Tab Switcher */}
            <div style={{ padding: '0 1.5rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', background: '#020617', padding: '0.25rem', borderRadius: '0.75rem', border: '1px solid #1e293b' }}>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('login');
                    setAuthError(null);
                  }}
                  className={`auth-tab ${authMode === 'login' ? 'active' : ''}`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('register');
                    setAuthError(null);
                  }}
                  className={`auth-tab ${authMode === 'register' ? 'active' : ''}`}
                >
                  Create Account
                </button>
              </div>
            </div>

            {/* Error Message */}
            {authError && (
              <div style={{ margin: '0 1.5rem 1rem 1.5rem', padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '0.5rem', color: '#fca5a5', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertCircle size={16} />
                <span>{authError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleAuthSubmit} style={{ padding: '0 1.5rem 1.5rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {authMode === 'register' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.4rem' }}>
                    Full Name
                  </label>
                  <div className="auth-input-container">
                    <UserIcon size={16} color="#64748b" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Jane Doe"
                      value={authForm.name}
                      onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })}
                      className="auth-input"
                    />
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.4rem' }}>
                  Email Address
                </label>
                <div className="auth-input-container">
                  <Mail size={16} color="#64748b" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={authForm.email}
                    onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                    className="auth-input"
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#cbd5e1', marginBottom: '0.4rem' }}>
                  Password
                </label>
                <div className="auth-input-container">
                  <Lock size={16} color="#64748b" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    placeholder="••••••••"
                    value={authForm.password}
                    onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                    className="auth-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 0 }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {authMode === 'register' && (
                  <span style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.25rem', display: 'block' }}>
                    Minimum 6 characters required
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '0.8rem', marginTop: '0.5rem', fontSize: '0.9rem', fontWeight: 600 }}
              >
                {authLoading ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    <span>Please wait...</span>
                  </>
                ) : authMode === 'login' ? (
                  <>
                    <LogIn size={18} />
                    <span>Sign In</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={18} />
                    <span>Create Account</span>
                  </>
                )}
              </button>

              <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>
                {authMode === 'login' ? (
                  <span>
                    Don't have an account yet?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('register');
                        setAuthError(null);
                      }}
                      style={{ background: 'none', border: 'none', color: '#818cf8', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                    >
                      Sign Up
                    </button>
                  </span>
                ) : (
                  <span>
                    Already have an account?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode('login');
                        setAuthError(null);
                      }}
                      style={{ background: 'none', border: 'none', color: '#818cf8', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                    >
                      Sign In
                    </button>
                  </span>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(30, 41, 59, 0.8)', padding: '1.5rem 0', textAlign: 'center', fontSize: '0.75rem', color: '#64748b' }}>
        <p style={{ margin: 0 }}>File Uploader • Fullstack MongoDB GridFS Architecture with JWT Authentication</p>
      </footer>
    </div>
  );
}