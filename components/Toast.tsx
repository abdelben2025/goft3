
import React, { useEffect } from 'react';

interface ToastProps {
    message: string;
    type: 'success' | 'error' | 'info' | 'loading' | 'event';
    onClose: () => void;
}

const SOUND_FILES: Record<string, string> = {
    success: 'sounds/success.wav',
    error: 'sounds/error.wav',
    info: 'sounds/info.wav',
    event: 'sounds/event.wav',
    delete: 'sounds/delete.wav',
};

const audioCache: Record<string, HTMLAudioElement> = {};

const getAudio = (key: string): HTMLAudioElement | null => {
    try {
        const src = SOUND_FILES[key];
        if (!src) return null;
        if (!audioCache[key]) {
            const audio = new Audio(src);
            audio.preload = 'auto';
            audio.volume = 0.72;
            audioCache[key] = audio;
        }
        return audioCache[key];
    } catch {
        return null;
    }
};

// WebAudio fallback if the WAV files are unavailable for any reason
const playSynthFallback = (type: string) => {
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;

        const ctx = new AudioContext();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        const now = ctx.currentTime;

        if (type === 'error') {
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(150, now);
            oscillator.frequency.exponentialRampToValueAtTime(40, now + 0.3);
            gainNode.gain.setValueAtTime(0.2, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
            oscillator.start(now);
            oscillator.stop(now + 0.3);
        } else if (type === 'delete') {
            oscillator.type = 'triangle';
            oscillator.frequency.setValueAtTime(440, now);
            oscillator.frequency.exponentialRampToValueAtTime(349, now + 0.25);
            gainNode.gain.setValueAtTime(0.18, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
            oscillator.start(now);
            oscillator.stop(now + 0.35);
        } else if (type === 'event') {
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(523.25, now);
            oscillator.frequency.exponentialRampToValueAtTime(880, now + 0.1);
            gainNode.gain.setValueAtTime(0.1, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
            oscillator.start(now);
            oscillator.stop(now + 0.4);
        } else {
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, now);
            oscillator.frequency.exponentialRampToValueAtTime(1046.5, now + 0.1);
            gainNode.gain.setValueAtTime(0.1, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            oscillator.start(now);
            oscillator.stop(now + 0.2);
        }
    } catch (e) {
        console.warn('Audio playback failed', e);
    }
};

const playNotificationSound = (type: string, message: string = '') => {
    if (type === 'loading') return;

    // Deletions use their own descending tone even though they are "success" toasts
    const key = type === 'success' && /حذف|مسح|إزالة/.test(message) ? 'delete' : type;

    const audio = getAudio(key);
    if (audio) {
        try {
            audio.currentTime = 0;
            const played = audio.play();
            if (played && typeof played.catch === 'function') {
                played.catch(() => playSynthFallback(key));
            }
            return;
        } catch {
            /* fall through to synth */
        }
    }
    playSynthFallback(key);
};

const TOAST_STYLES: Record<string, { badge: string; icon: string; title: string; accent: string }> = {
    success: {
        badge: 'bg-green-50 ring-green-100',
        icon: 'bi-check-circle-fill text-green-600',
        title: 'نجحت العملية',
        accent: 'bg-green-500',
    },
    error: {
        badge: 'bg-red-50 ring-red-100',
        icon: 'bi-x-octagon-fill text-red-600',
        title: 'تنبيه خطأ',
        accent: 'bg-red-500',
    },
    info: {
        badge: 'bg-blue-50 ring-blue-100',
        icon: 'bi-info-circle-fill text-blue-600',
        title: 'معلومة',
        accent: 'bg-blue-500',
    },
    event: {
        badge: 'bg-indigo-50 ring-indigo-100',
        icon: 'bi-broadcast text-indigo-600',
        title: 'نشاط مباشر',
        accent: 'bg-indigo-500',
    },
    loading: {
        badge: 'bg-blue-50 ring-blue-100',
        icon: 'bi-arrow-repeat text-blue-600 animate-spin',
        title: 'جاري المعالجة...',
        accent: 'bg-blue-500',
    },
};

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
    useEffect(() => {
        // Play sound on mount (loading state stays silent)
        if (type !== 'loading') {
            playNotificationSound(type, message);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [type]);

    const style = TOAST_STYLES[type] || TOAST_STYLES.info;
    const isLoading = type === 'loading';

    return (
        <div
            dir="rtl"
            className="fixed top-4 left-0 right-0 z-[100] flex justify-center px-4 pointer-events-none"
        >
            <div
                className={`pointer-events-auto relative min-w-[320px] max-w-[420px] rounded-xl bg-white shadow-xl shadow-gray-200/80 ring-1 ring-black/5 overflow-hidden animate-slide-down ${type === 'event' ? 'animate-bounce-in-right' : ''}`}
            >
                <div className="relative flex items-start gap-3 px-4 py-3.5">
                    <span className={`absolute inset-y-0 right-0 w-1 ${style.accent}`}></span>
                    <div className={`flex-shrink-0 mt-0.5 p-2 rounded-lg bg-white shadow-sm ring-1 ${style.badge}`}>
                        <i className={`bi ${style.icon} text-xl leading-none`}></i>
                    </div>
                    <div className="flex-grow min-w-0 pr-1">
                        <span className="block text-[10px] font-black uppercase tracking-wider text-gray-400 mb-0.5">
                            {style.title}
                        </span>
                        <span className="block text-sm font-bold text-gray-800 leading-snug break-words">
                            {message}
                        </span>
                    </div>
                    {!isLoading && (
                        <button
                            onClick={onClose}
                            className="flex-shrink-0 mt-0.5 text-gray-300 hover:text-gray-600 transition-colors"
                            aria-label="إغلاق"
                        >
                            <i className="bi bi-x-lg text-sm"></i>
                        </button>
                    )}
                </div>
                {isLoading && (
                    <div className="w-full bg-gray-100 h-1">
                        <div className="bg-blue-600 h-1 rounded-full animate-loading-bar"></div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Toast;
