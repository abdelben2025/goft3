import React, { useEffect, useRef, useState } from 'react';
import { User, logoDataUrl } from '../types';
import { verifyPassword } from '../utils/authUtils';
import { errorMessage } from '../utils/errorMessage';
import { useData } from '../context/DataContext';
import { tauriDb } from '../services/tauriService';
import { signIn } from '../services/authService';
import { useLanguage } from '../context/LanguageContext';

interface IdleLockScreenProps {
    user: User;
    onUnlock: () => void;
}

const IdleLockScreen: React.FC<IdleLockScreenProps> = ({ user, onUnlock }) => {
    const { isOnline } = useData();
    const { t } = useLanguage();
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!password || busy) return;
        setBusy(true);
        setError('');
        try {
            // Unlock re-verifies through signIn, which prefers the cloud when a
            // connection is available and falls back to the local hash.
            const result = await signIn(user.USERNAME, password, {
                isOnline,
                isDesktop: tauriDb.isAvailable(),
            });

            if (result.user) {
                setPassword('');
                onUnlock();
            } else if (result.offlineCredentialMissing) {
                setError(t('lock.noCachedCredential'));
            } else {
                setError(t('lock.wrongPassword'));
            }
        } catch (err) {
            // Cloud unreachable: fall back to the hash cached on this workstation.
            if (user.PASSWORD) {
                try {
                    const { valid } = await verifyPassword(password, user.PASSWORD);
                    if (valid) {
                        setPassword('');
                        onUnlock();
                        return;
                    }
                    setError(t('lock.wrongPassword'));
                    return;
                } catch {
                    // fall through to the transport error below
                }
            }
            setError(errorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div dir="rtl" className="fixed inset-0 z-[4000] bg-gray-900/80 backdrop-blur-sm flex items-center justify-center p-4">
            <form
                onSubmit={handleSubmit}
                className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center border-t-4 border-blue-600"
            >
                <img src={logoDataUrl} alt="GOFT3" className="w-14 h-14 mx-auto mb-3" />
                <h2 className="font-bold text-gray-900 text-lg mb-1">{t('lock.title')}</h2>
                <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                    {t('lock.description')}
                </p>
                <div className="inline-flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-full mb-3">
                    <i className="bi bi-person-circle text-blue-600"></i>
                    <span className="text-xs font-bold text-gray-700">{user.USERNAME}</span>
                </div>
                <input
                    ref={inputRef}
                    type="password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    placeholder={t('login.password')}
                    autoComplete="current-password"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {error && <div className="text-xs text-red-600 font-bold mb-2">{error}</div>}
                <button
                    type="submit"
                    disabled={busy || !password}
                    className="w-full bg-blue-600 text-white font-bold rounded-lg py-2 text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                    {busy ? t('lock.checking') : t('lock.unlock')}
                </button>
                <p className="text-[10px] text-gray-400 mt-3">{t('lock.securityMode')}</p>
            </form>
        </div>
    );
};

export default IdleLockScreen;
