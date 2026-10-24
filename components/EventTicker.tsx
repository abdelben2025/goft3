import React from 'react';
import { useData } from '../context/DataContext';

const EventTicker: React.FC<{ onLogout?: () => void }> = ({ onLogout }) => {
    const { isOnline, isDbConfigured, pendingActionsCount, isLocalDbConnected } = useData();

    return (
        <div className="fixed bottom-0 left-0 right-0 z-[1000] bg-gray-900 bg-opacity-95 text-white border-t border-gray-700 shadow-2xl py-1 px-4 flex items-center justify-between no-print animate-slide-up" dir="rtl">
            {/* Status Bar */}
            <div className="flex items-center gap-4">
                {!isOnline ? (
                    <div className="flex items-center gap-2 bg-red-600 px-3 py-0.5 rounded-full animate-pulse">
                        <i className="bi bi-wifi-off"></i>
                        <span className="text-xs font-bold">وضع غير متصل</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 bg-green-600 px-3 py-0.5 rounded-full">
                        <i className="bi bi-wifi"></i>
                        <span className="text-xs font-bold">متصل</span>
                    </div>
                )}
                
                {pendingActionsCount > 0 && (
                    <div className="flex items-center gap-2 bg-orange-600 px-3 py-0.5 rounded-full">
                        <i className="bi bi-arrow-repeat animate-spin"></i>
                        <span className="text-xs font-bold">جاري المزامنة ({pendingActionsCount})</span>
                    </div>
                )}

                {isOnline && isDbConfigured ? (
                    <div className="hidden lg:flex items-center gap-2 bg-sky-700 px-3 py-0.5 rounded-full" title="مصدر البيانات الحالي">
                        <i className="bi bi-cloud-fill"></i>
                        <span className="text-xs font-bold">الآن أنت تعمل على قاعدة البيانات السحابية</span>
                    </div>
                ) : (
                    <div className="hidden lg:flex items-center gap-2 bg-teal-700 px-3 py-0.5 rounded-full" title="مصدر البيانات الحالي">
                        <i className="bi bi-hdd-fill"></i>
                        <span className="text-xs font-bold">الآن أنت تعمل على قاعدة البيانات المحلية</span>
                    </div>
                )}

                {isLocalDbConnected ? (
                    <div className="flex items-center gap-2 bg-blue-600 px-3 py-0.5 rounded-full" title="قاعدة البيانات المحلية (goft3_local.db)">
                        <i className="bi bi-database-check"></i>
                        <span className="text-xs font-bold">قاعدة البيانات المحلية موجودة</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 bg-gray-600 px-3 py-0.5 rounded-full" title="قاعدة البيانات المحلية (goft3_local.db)">
                        <i className="bi bi-database-x"></i>
                        <span className="text-xs font-bold">قاعدة البينات المحلية غير موجودة</span>
                    </div>
                )}
            </div>

            {/* Global logout button (visible on all pages) */}
            <button
                type="button"
                onClick={onLogout}
                className="flex items-center gap-1.5 bg-red-600 hover:bg-red-500 active:scale-95 transition-all px-3 py-0.5 rounded-full text-white shrink-0 shadow-sm"
                title="تسجيل الخروج (يتم تحديث القاعدة المحلية أولًا)"
            >
                <i className="bi bi-box-arrow-left text-xs"></i>
                <span className="text-xs font-bold">خروج</span>
            </button>
        </div>
    );
};

export default EventTicker;