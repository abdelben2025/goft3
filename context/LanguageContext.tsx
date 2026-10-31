
/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, ReactNode } from 'react';
import { translations, Language } from '../i18n/translations';

interface LanguageContextType {
    t: (key: string, params?: { [key: string]: string | number }) => string;
    dir: 'rtl' | 'ltr';
    language: Language;
    setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const detectBrowserLanguage = (): Language => {
    if (typeof navigator !== 'undefined') {
        const langs = navigator.languages || [navigator.language];
        for (const lang of langs) {
            const code = (lang || '').toLowerCase();
            if (code.startsWith('ar')) return 'ar';
            if (code.startsWith('fr')) return 'fr';
        }
    }
    return 'ar';
};

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [language, setLanguageState] = React.useState<Language>(() => detectBrowserLanguage());
    const dir: 'rtl' | 'ltr' = language === 'ar' ? 'rtl' : 'ltr';

    // Ensure document direction/lang is always in sync with the active language
    React.useEffect(() => {
        document.documentElement.dir = dir;
        document.documentElement.lang = language;
        document.body.classList.toggle('font-cairo', language === 'ar');
        document.body.classList.toggle('font-sans-latin', language !== 'ar');
    }, [dir, language]);

    const t = React.useCallback((key: string, params?: { [key: string]: string | number }): string => {
        const langData = translations[language];
        let result = (langData as any)[key];

        if (!result) {
            return key;
        }

        if (params) {
            Object.keys(params).forEach(paramKey => {
                const value = String(params[paramKey]);
                result = result.split(`{${paramKey}}`).join(value);
            });
        }

        return result;
    }, [language]);

    return (
        <LanguageContext.Provider value={{ t, dir, language, setLanguage: setLanguageState }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = (): LanguageContextType => {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};
