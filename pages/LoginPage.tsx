import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { logoDataUrl, User } from '../types';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';

import { hashPassword, verifyPassword } from '../utils/authUtils';
import { tauriDb } from '../services/tauriService';

interface LoginPageProps {
    onLogin: (user: User) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
    const { db, saveConfig, isDbConfigured, loading, isOnline, updateItem, refreshData, onlineUsers } = useData();
    const { t, dir } = useLanguage();
    const { showToast } = useToast();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    
    // Config Modal State
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [setupUrl, setSetupUrl] = useState('');
    const [setupKey, setSetupKey] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const isDesktop = tauriDb.isAvailable();
        if (!isDbConfigured && isOnline && !isDesktop) {
            setError('يجب إعداد قاعدة البيانات أولاً.');
            setIsConfigOpen(true);
            return;
        }

        if (loading || isLoggingIn) {
            setError('جارٍ تحميل البيانات... يرجى الانتظار.');
            return;
        }

        setIsLoggingIn(true);
        try {
            const targetUsername = username.trim().toLowerCase();
            let user: User | undefined;

            // Block a second concurrent session: if this username is currently
            // online on another machine, refuse the login with a clear notice.
            if (isOnline && (onlineUsers || []).some(u => (u.username || '').trim().toLowerCase() === targetUsername)) {
                setError(`اسم المستخدم «${username.trim()}» متصل الآن على جهاز آخر. يجب أن يخرج أولًا قبل تسجيل الدخول هنا.`);
                showToast(`تم منع تسجيل الدخول: المستخدم «${username.trim()}» متصل الآن`, 'error');
                return;
            }

            // Offline: local SQLite is the authoritative source for credentials.
            // Always prefer its hash over in-memory state (which may be stale/backup).
            if (isDesktop && !isOnline) {
                try {
                    const localDb = await tauriDb.getDatabase();
                    const localUser = (localDb.T_USER || []).find(
                        (u: User) => u.USERNAME.trim().toLowerCase() === targetUsername
                    );
                    if (localUser) {
                        user = localUser;
                    }
                } catch (localErr) {
                    console.error('Failed to reload users from local SQLite:', localErr);
                }
            }

            // Fallback: in-memory users
            if (!user) {
                user = db.T_USER.find(u => u.USERNAME.trim().toLowerCase() === targetUsername);
            }

            // Last resort: full refresh then search again
            if (!user && isDesktop) {
                try {
                    await refreshData();
                    // db in this closure is stale; re-read via tauri
                    const localDb = await tauriDb.getDatabase();
                    user = (localDb.T_USER || []).find(
                        (u: User) => u.USERNAME.trim().toLowerCase() === targetUsername
                    );
                } catch {
                    // ignore
                }
            }

            if (user) {
                // PASSWORD is a bcrypt hash (or legacy SHA-256 / seed hash) stored in the DB.
                // verifyPassword compares the entered password against the stored hash (no decryption needed).
                const { valid, needsRehash } = await verifyPassword(password, user.PASSWORD);
                
                if (valid) {
                    if (needsRehash) {
                        try {
                            const newBcryptHash = await hashPassword(password);
                            // Auto-migrate legacy password to Bcrypt seamlessly in DB & cache
                            // (updateItem also mirrors to local SQLite when online)
                            updateItem('T_USER', user.ID_USER, {
                                ...user,
                                PASSWORD: newBcryptHash
                            }).catch(err => {
                                console.warn("Background auto-migration to Bcrypt deferred:", err);
                            });
                            user.PASSWORD = newBcryptHash;
                        } catch (rehashErr) {
                            console.warn("Could not rehash password on login:", rehashErr);
                        }
                    }

                    // After a successful ONLINE login: pull the full cloud DB and
                    // immediately mirror it into the local SQLite (goft3_local.db),
                    // reporting the result to the user via toast.
                    if (isOnline) {
                        // Refresh/mirror the local DB in the background after login. No toasts
                        // are shown here: they raced with logout/unmount and the full fetch can
                        // take a while, so we keep login instantaneous and silent.
                        refreshData().catch((syncErr) => {
                            console.warn('Post-login local DB sync failed:', syncErr);
                        });
                    }

                    onLogin(user);
                } else {
                    setError(t('login.error'));
                }
            } else {
                if (!isOnline && db.T_USER.length === 0) {
                    setError('لا توجد بيانات محلية محفوظة. يجب الاتصال بالإنترنت لتسجيل الدخول لأول مرة.');
                } else {
                    setError(t('login.error'));
                }
            }
        } catch (err) {
            console.error("Login verification error:", err);
            setError("خطأ في التحقق من كلمة المرور.");
        } finally {
            setIsLoggingIn(false);
        }
    };

    const handleSaveConfig = (e: React.FormEvent) => {
        e.preventDefault();
        saveConfig(setupUrl, setupKey);
        setIsConfigOpen(false);
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-200 relative p-4" dir={dir}>

            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="relative w-full max-w-md p-6 sm:p-8 space-y-8 bg-sky-300 rounded-lg shadow-xl border-t-4 border-blue-600"
            >
                
                <div className="text-center">
                    <img src={logoDataUrl} alt="App Logo" className="w-24 h-24 mx-auto mb-4 drop-shadow-md" />
                    <h1 className="text-3xl font-bold text-gray-800">GOFT3</h1>
                    <p className="mt-2 text-gray-700 font-medium">{t('login.title')}</p>
                    
                    {/* Offline Indicator */}
                    {!isOnline && (
                        <div className="mt-2 inline-flex items-center gap-2 bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-bold border border-yellow-300">
                            <i className="bi bi-wifi-off"></i>
                            <span>وضع غير متصل (نسخة محلية)</span>
                        </div>
                    )}
                </div>

                <form className="space-y-6" onSubmit={handleLogin}>
                    <div>
                        <label htmlFor="username" className="block text-sm font-medium text-gray-700 text-start">
                            {t('login.username')}
                        </label>
                        <input
                            id="username"
                            name="username"
                            type="text"
                            required
                            disabled={loading}
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-200 normal-case"
                        />
                    </div>
                    <div>
                        <label
                            htmlFor="password"
                            className="block text-sm font-medium text-gray-700 text-start">
                            {t('login.password')}
                        </label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            required
                            disabled={loading}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-50 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-200 normal-case"
                        />
                    </div>
                    
                    {loading && (
                        <div className="text-center text-blue-700 text-sm animate-pulse font-semibold">
                            <i className="bi bi-arrow-repeat animate-spin mr-2"></i>
                            جاري تهيئة قاعدة البيانات...
                        </div>
                    )}

                    {error && (
                        <div className="text-center p-2 bg-red-100 border border-red-200 rounded-md">
                            <p className="text-sm text-red-600 mb-1 font-bold">{error}</p>
                        </div>
                    )}
                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full px-4 py-2 font-bold text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-300 shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed">
                            {loading ? 'انتظر قليلاً...' : t('login.btn')}
                        </button>
                    </div>
                </form>
            </motion.div>

            {/* Config Modal */}
            <Modal isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} title="Database Configuration">
                <form onSubmit={handleSaveConfig} className="space-y-4" dir="ltr">
                    <div>
                        <label className="block text-gray-700 text-sm font-bold mb-2 text-left">Project URL</label>
                        <input 
                            type="url" 
                            value={setupUrl} 
                            onChange={e => setSetupUrl(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-left"
                            required 
                        />
                    </div>
                    <div>
                        <label className="block text-gray-700 text-sm font-bold mb-2 text-left">API Key (anon/public)</label>
                        <input 
                            type="password" 
                            value={setupKey} 
                            onChange={e => setSetupKey(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-left"
                            required 
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                        <button type="button" onClick={() => setIsConfigOpen(false)} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors">Cancel</button>
                        <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">Save & Connect</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};

export default LoginPage;