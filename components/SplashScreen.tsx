
import React from 'react';
import { logoDataUrl } from '../types';
import { useLanguage } from '../context/LanguageContext';

const SplashScreen: React.FC = () => {
    const { t, dir, language, setLanguage } = useLanguage();
    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-gray-100 to-blue-50" dir={dir}>
            <div className="animate-bounce mb-6">
                <img src={logoDataUrl} alt="Logo" className="w-32 h-32 drop-shadow-lg" />
            </div>
            
            <h1 className="text-4xl font-extrabold text-gray-800 mb-2 tracking-wide">GOFT3</h1>
            <p className="text-xl text-gray-600 mb-8 font-medium">{t('app.title')}</p>
            
            <div className="flex flex-col items-center">
                <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                <span className="text-sm text-gray-500 animate-pulse">{t('splash.starting')}</span>
            </div>

            <div className="absolute bottom-8 flex flex-col items-center gap-2 text-gray-400 text-xs">
                <button
                    type="button"
                    onClick={() => setLanguage(language === 'ar' ? 'fr' : 'ar')}
                    className="px-4 py-1.5 rounded-full border border-gray-300 bg-white/70 hover:bg-white text-gray-700 font-medium transition-colors cursor-pointer text-sm"
                >
                    {language === 'ar' ? 'Français' : 'العربية'}
                </button>
                <p>{t('splash.copyright', { year: new Date().getFullYear() })}</p>
            </div>
        </div>
    );
};

export default SplashScreen;
