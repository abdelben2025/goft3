import React from 'react';
import { useData } from '../context/DataContext';

const EventTicker: React.FC<{ onLogout?: () => void }> = ({ onLogout }) => {
    const { recentEvents, isOnline, isDbConfigured, pendingActionsCount, isLocalDbConnected } = useData();

    const getActionLabel = (type: string) => {
        switch (type) {
            case 'add': return 'إضافة';
            case 'update': return 'تعديل';
            case 'delete': return 'حذف';
            case 'print': return 'طباعة';
            case 'reset': return 'مسح';
            case 'import': return 'استيراد';
            default: return type;
        }
    };

    const getActionIcon = (type: string) => {
        switch (type) {
            case 'add': return 'bi-plus-circle-fill text-green-400';
            case 'update': return 'bi-pencil-square text-yellow-400';
            case 'delete': return 'bi-trash3-fill text-red-400';
            case 'print': return 'bi-printer-fill text-blue-400';
            case 'reset': return 'bi-exclamation-triangle-fill text-red-500';
            case 'import': return 'bi-file-earmark-arrow-up-fill text-purple-400';
            default: return 'bi-info-circle';
        }
    };

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

            {/* Events Ticker */}
            {recentEvents.length > 0 && (
            <div className="flex items-center gap-3 truncate mx-4 flex-grow justify-center opacity-80 hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-2 px-2">
                    <i className={`bi ${getActionIcon(recentEvents[0].actionType)}`}></i>
                    <span className="text-xs font-bold text-gray-300">{getActionLabel(recentEvents[0].actionType)}:</span>
                </div>
                <span className="text-xs truncate max-w-md text-gray-200">
                    {recentEvents[0].username} - {recentEvents[0].description}
                </span>
            </div>
            )}

            {/* History Icons */}
            <div className="hidden sm:flex items-center gap-2">
                <div className="flex -space-x-1 space-x-reverse overflow-hidden">
                    {recentEvents.slice(1, 4).map(ev => (
                         <div key={ev.id} title={`${ev.username}: ${getActionLabel(ev.actionType)}`} className="inline-block h-5 w-5 rounded-full ring-1 ring-gray-900 bg-gray-700 flex items-center justify-center">
                             <i className={`bi ${getActionIcon(ev.actionType)} text-[8px]`}></i>
                         </div>
                    ))}
                </div>
                {recentEvents.length > 0 && (
                    <span className="text-[9px] text-gray-500 italic mr-2">
                        {new Date(recentEvents[0].timestamp).toLocaleTimeString('ar-DZ', {hour: '2-digit', minute:'2-digit'})}
                    </span>
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