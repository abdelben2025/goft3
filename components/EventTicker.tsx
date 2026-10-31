import React from 'react';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';

const EventTicker: React.FC<{ onLogout?: () => void }> = ({ onLogout }) => {
    const { isOnline, isDbConfigured, pendingActionsCount, isLocalDbConnected } = useData();
    const { t } = useLanguage();

    return (
        <div className="fixed bottom-0 left-0 right-0 z-[1000] bg-gray-900 bg-opacity-95 text-white border-t border-gray-700 shadow-2xl py-1 px-4 flex items-center justify-between no-print animate-slide-up" dir="rtl">
            {/* Status Bar */}
            <div className="flex items-center gap-4">
                {!isOnline ? (
                    <div className="flex items-center gap-2 bg-red-600 px-3 py-0.5 rounded-full animate-pulse">
                        <i className="bi bi-wifi-off"></i>
                        <span className="text-xs font-bold">{t('ticker.offline')}</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 bg-green-600 px-3 py-0.5 rounded-full">
                        <i className="bi bi-wifi"></i>
                        <span className="text-xs font-bold">{t('ticker.online')}</span>
                    </div>
                )}
                
                {pendingActionsCount > 0 && (
                    <div className="flex items-center gap-2 bg-orange-600 px-3 py-0.5 rounded-full">
                        <i className="bi bi-arrow-repeat animate-spin"></i>
                        <span className="text-xs font-bold">{t('ticker.syncing', { count: pendingActionsCount })}</span>
                    </div>
                )}

                {isOnline && isDbConfigured ? (
                    <div className="hidden lg:flex items-center gap-2 bg-sky-700 px-3 py-0.5 rounded-full" title={t('ticker.data_source')}>
                        <i className="bi bi-cloud-fill"></i>
                        <span className="text-xs font-bold">{t('ticker.cloud_db')}</span>
                    </div>
                ) : (
                    <div className="hidden lg:flex items-center gap-2 bg-teal-700 px-3 py-0.5 rounded-full" title={t('ticker.data_source')}>
                        <i className="bi bi-hdd-fill"></i>
                        <span className="text-xs font-bold">{t('ticker.local_db')}</span>
                    </div>
                )}

                {!isLocalDbConnected && (
                    <div className="flex items-center gap-2 bg-red-100 text-red-700 border border-red-300 px-3 py-0.5 rounded-full" title={t('ticker.local_db_missing_title')}>
                        <i className="bi bi-database-x"></i>
                        <span className="text-xs font-bold">{t('ticker.local_db_missing')}</span>
                    </div>
                )}
            </div>

            {/* Global logout button (visible on all pages) */}
            <button
                type="button"
                onClick={onLogout}
                className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 active:scale-95 transition-all px-3 py-0.5 rounded-full text-white shrink-0 shadow-sm"
                title={t('ticker.logout_title')}
            >
                <i className="bi bi-box-arrow-left text-xs"></i>
                <span className="text-xs font-bold">{t('btn.logout')}</span>
            </button>
        </div>
    );
};

export default EventTicker;