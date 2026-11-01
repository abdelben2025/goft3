import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { logoDataUrl, User } from '../types';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';

import { signIn, authErrorMessage } from '../services/authService';
import { configuredHost } from '../services/supabaseClient';
import { tauriDb } from '../services/tauriService';

interface LoginPageProps {
    onLogin: (user: User) => void;
    onCloseApp?: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin, onCloseApp }) => {
    const { db, saveConfig, isDbConfigured, loading, isOnline, refreshData, onlineUsers } = useData();
    const { t, dir, language, setLanguage } = useLanguage();
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
            setError(t('login.dbNotConfigured'));
            setIsConfigOpen(true);
            return;
        }

        if (loading || isLoggingIn) {
            setError(t('login.loadingData'));
            return;
        }

        setIsLoggingIn(true);
        try {
            // Block a second concurrent session: if this username is currently
            // online on another machine, refuse the login with a clear notice.
            const targetUsername = username.trim().toLowerCase();
            if (isOnline && (onlineUsers || []).some(u => (u.username || '').trim().toLowerCase() === targetUsername)) {
                setError(t('login.alreadyOnline', { name: username.trim() }));
                showToast(t('login.onlineBlocked', { name: username.trim() }), 'error');
                return;
            }

            const result = await signIn(username, password, { isOnline, isDesktop }, db.T_USER);

            if (result.user) {
                const user = result.user;
                if (result.needsPasswordChange) {
                    user.NEEDS_PASSWORD_CHANGE = true;
                }

                // After a successful ONLINE login: pull the full cloud DB and
                // immediately mirror it into the local SQLite (goft3_local.db).
                // No toasts: they raced with logout/unmount and the full fetch can
                // take a while, so we keep login instantaneous and silent.
                if (isOnline) {
                    refreshData().catch((syncErr) => {
                        console.warn('Post-login local DB sync failed:', syncErr);
                    });
                }

                onLogin(user);
            } else if (result.offlineCredentialMissing) {
                // The account exists locally, but this workstation never cached a
                // verifiable hash for it (passwords no longer leave the server).
                setError(t('login.noCachedCredential'));
            } else if (!isOnline && db.T_USER.length === 0) {
                setError(t('login.noLocalData'));
            } else {
                // The same wording covers a server rejection and a local one, which
                // is exactly what makes "the user exists but cannot log in" opaque.
                const where = result.source === 'cloud'
                    ? t('', { host: configuredHost || t('login.notConfiguredHost') }) // login.checkCloud
                    : t('login.checkLocal');
                setError(`${t('login.error')}  ${where}`);
            }
        } catch (err) {
            console.error("Login verification error:", err);
            setError(authErrorMessage(err));
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
                {onCloseApp && (
                    <button
                        type="button"
                        onClick={onCloseApp}
                        className="absolute top-3 right-3 flex items-center gap-1.5 bg-red-100 text-red-700 hover:bg-red-200 border border-red-200 px-3 py-1 rounded-full text-xs font-bold transition-colors"
                        title={t('login.closeAppTitle')}
                    >
                        <i className="bi bi-x-square"></i>
                        <span>{t('login.closeApp')}</span>
                    </button>
                )}

                <button
                    type="button"
                    onClick={() => setLanguage(language === 'ar' ? 'fr' : 'ar')}
                    className="absolute top-3 left-3 px-3 py-1 rounded-full border border-gray-400 bg-white/70 hover:bg-white text-gray-700 text-xs font-bold transition-colors cursor-pointer"
                >
                    {language === 'ar' ? 'Français' : 'العربية'}
                </button>

                <div className="text-center">
                    <img src={logoDataUrl} alt="App Logo" className="w-24 h-24 mx-auto mb-4 drop-shadow-md" />
                    <h1 className="text-3xl font-bold text-gray-800">GOFT3</h1>
                    <p className="mt-2 text-gray-700 font-medium">{t('login.title')}</p>
                    
                    {/* Offline Indicator */}
                    {!isOnline && (
                        <div className="mt-2 inline-flex items-center gap-2 bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-bold border border-yellow-300">
                            <i className="bi bi-wifi-off"></i>
                            <span>{t('login.offlineMode')}</span>
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
                            {t('login.initDb')}
                        </div>
                    )}

                    {error && (
                        <div className="text-center p-2 bg-red-100 border border-red-200 rounded-md">
                            <p className="text-sm text-red-600 mb-1 font-bold whitespace-pre-line">{error}</p>
                        </div>
                    )}
                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full px-4 py-2 font-bold text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-300 shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed">
                            {loading ? t('login.wait') : t('login.btn')}
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