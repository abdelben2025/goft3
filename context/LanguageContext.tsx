
import React, { createContext, useContext, ReactNode } from 'react';
import { translations } from '../i18n/translations';

interface LanguageContextType {
    t: (key: string, params?: { [key: string]: string | number }) => string;
    dir: 'rtl';
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // Force Arabic settings
    const language = 'ar';
    const dir = 'rtl';

    // Ensure document direction is always RTL
    React.useEffect(() => {
        document.documentElement.dir = dir;
        document.documentElement.lang = language;
        document.body.classList.add('font-cairo');
        document.body.classList.remove('font-sans-latin');
    }, []);

    const t = (key: string, params?: { [key: string]: string | number }): string => {
        const langData = translations['ar'];
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
    };

    return (
        <LanguageContext.Provider value={{ t, dir }}>
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
