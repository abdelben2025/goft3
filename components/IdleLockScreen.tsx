import React, { useEffect, useRef, useState } from 'react';
import { User, logoDataUrl } from '../types';
import { verifyPassword } from '../utils/authUtils';
import { errorMessage } from '../utils/errorMessage';

interface IdleLockScreenProps {
    user: User;
    onUnlock: () => void;
}

const IdleLockScreen: React.FC<IdleLockScreenProps> = ({ user, onUnlock }) => {
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
            const { valid } = await verifyPassword(password, user.PASSWORD);
            if (valid) {
                setPassword('');
                onUnlock();
            } else {
                setError('كلمة المرور غير صحيحة');
            }
        } catch (err) {
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
                <h2 className="font-bold text-gray-900 text-lg mb-1">الجلسة مقفلة</h2>
                <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                    تم قفل الجلسة تلقائيًا بعد فترة من عدم النشاط لحماية البيانات المالية.
                    أدخل كلمة المرور للمتابعة.
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
                    placeholder="كلمة المرور"
                    autoComplete="current-password"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {error && <div className="text-xs text-red-600 font-bold mb-2">{error}</div>}
                <button
                    type="submit"
                    disabled={busy || !password}
                    className="w-full bg-blue-600 text-white font-bold rounded-lg py-2 text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                    {busy ? 'جارٍ التحقق...' : 'فتح'}
                </button>
                <p className="text-[10px] text-gray-400 mt-3">GOFT3 — وضع الأمان</p>
            </form>
        </div>
    );
};

export default IdleLockScreen;
