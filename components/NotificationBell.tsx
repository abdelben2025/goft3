import React, { useState, useEffect, useRef } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { Page, User } from '../types';
import { formatDate } from '../utils/dateUtils';

interface NotificationBellProps {
    navigate: (page: Page, operationId?: number, tab?: string) => void;
    currentUser?: User;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ navigate, currentUser }) => {
    const notifications = useNotifications(currentUser);
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [wrapperRef]);

    const handleNotificationClick = (notif: any) => {
        setIsOpen(false);
        
        const type = notif.type;
        const isRed = ['financial_alert', 'consumption_alert', 'overdue', 'overdue_service_order', 'long_delays'].includes(type);
        const isAmber = ['unapproved_engagement', 'unaccepted_payment', 'missing_bordereau'].includes(type);
        const color = isRed ? 'red' : isAmber ? 'amber' : 'blue';

        switch (type) {
            case 'overdue':
            case 'upcoming':
            case 'overdue_service_order':
            case 'approaching_service_order':
            case 'missing_bordereau':
            case 'long_delays':
                navigate('DOCUMENTS', notif.operationId, `${notif.pieceId}:${color}`);
                break;
            case 'unapproved_engagement':
                navigate('OPERATION_DETAILS', notif.operationId, `ENGAGEMENTS:${notif.engagementId}:${color}`);
                break;
            case 'unregistered_document':
                navigate('OPERATION_DETAILS', notif.operationId, `ENGAGEMENTS:0:blue`);
                break;
            case 'unaccepted_payment':
                navigate('OPERATION_DETAILS', notif.operationId, `PAIEMENTS:${notif.paiementId}:${color}`);
                break;
            case 'financial_alert':
            case 'consumption_alert':
                navigate('OPERATION_DETAILS', notif.operationId, `OVERVIEW:0:${color}`);
                break;
            case 'payment_claim_alert':
                navigate('PAYMENT_CLAIMS', notif.operationId);
                break;
            case 'ae_structure_insufficiency':
                navigate('AE_INSUFFICIENCY', notif.operationId);
                break;
            default:
                if (notif.operationId) {
                    navigate('OPERATION_DETAILS', notif.operationId);
                }
        }
    };

    const getNotificationTypeConfig = (type: string) => {
        const label = getNotificationLabel(type);
        
        switch (type) {
            case 'overdue':
            case 'overdue_service_order':
            case 'long_delays':
                return {
                    label,
                    icon: 'bi-calendar-x-fill',
                    colorClass: 'bg-red-50 hover:bg-red-100 border-red-100',
                    badgeClass: 'bg-red-100 text-red-800 border-red-200',
                    iconClass: 'text-red-500'
                };
            case 'financial_alert':
            case 'consumption_alert':
            case 'ae_structure_insufficiency':
                return {
                    label,
                    icon: 'bi-exclamation-octagon-fill',
                    colorClass: 'bg-red-50 hover:bg-red-100 border-red-100',
                    badgeClass: 'bg-red-100 text-red-800 border-red-200',
                    iconClass: 'text-red-500'
                };
            case 'upcoming':
            case 'approaching_service_order':
                return {
                    label,
                    icon: 'bi-clock-history',
                    colorClass: 'bg-amber-50 hover:bg-amber-100 border-amber-100',
                    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
                    iconClass: 'text-amber-500'
                };
            case 'payment_claim_alert':
                return {
                    label,
                    icon: 'bi-exclamation-triangle-fill',
                    colorClass: 'bg-amber-50 hover:bg-amber-100 border-amber-100',
                    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
                    iconClass: 'text-amber-500'
                };
            case 'unapproved_engagement':
                return {
                    label,
                    icon: 'bi-pencil-fill',
                    colorClass: 'bg-blue-50 hover:bg-blue-100 border-blue-100',
                    badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
                    iconClass: 'text-blue-500'
                };
            case 'unaccepted_payment':
                return {
                    label,
                    icon: 'bi-wallet2',
                    colorClass: 'bg-blue-50 hover:bg-blue-100 border-blue-100',
                    badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
                    iconClass: 'text-blue-500'
                };
            case 'missing_bordereau':
            case 'unregistered_document':
                return {
                    label,
                    icon: 'bi-file-earmark-x-fill',
                    colorClass: 'bg-blue-50 hover:bg-blue-100 border-blue-100',
                    badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
                    iconClass: 'text-blue-500'
                };
            default:
                return {
                    label: 'تنبيه',
                    icon: 'bi-bell-fill',
                    colorClass: 'bg-gray-50 hover:bg-gray-100 border-gray-100',
                    badgeClass: 'bg-gray-100 text-gray-800 border-gray-200',
                    iconClass: 'text-gray-500'
                };
        }
    };

    const getNotificationLabel = (type: string) => {
        switch(type) {
            case 'overdue': return 'متأخر';
            case 'financial_alert': return 'تجاوز مالي';
            case 'unapproved_engagement': return 'التزام غير مؤشر';
            case 'unaccepted_payment': return 'انتظار قبول الدفع';
            case 'upcoming': return 'تنبيه استحقاق';
            case 'overdue_service_order': return 'تأخر أمر الخدمة';
            case 'approaching_service_order': return 'وشيك أمر الخدمة';
            case 'missing_bordereau': return 'جدول إرسال مفقود';
            case 'long_delays': return 'تأخير طويل';
            case 'payment_claim_alert': return 'تنبيه دفع';
            case 'ae_structure_insufficiency': return 'نقص اعتمادات';
            case 'unregistered_document': return 'وثيقة غير مسجلة';
            default: return 'تنبيه';
        }
    };

    return (
        <div className="relative" ref={wrapperRef}>
            <button 
                onClick={() => setIsOpen(!isOpen)} 
                className="text-gray-500 hover:text-gray-700 transition-all p-2 rounded-full hover:bg-gray-100 focus:outline-none relative" 
                aria-label={`لديك ${notifications.length} إشعارات`}
            >
                {notifications.length > 0 ? (
                    <>
                        <i className="bi bi-bell-fill text-2xl text-yellow-500 animate-pulse"></i>
                        <span className="absolute top-1 right-1 bg-red-600 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-white">
                            {notifications.length}
                        </span>
                    </>
                ) : (
                     <i className="bi bi-bell text-2xl"></i>
                )}
            </button>
            {isOpen && (
                <div className="absolute left-0 mt-3 w-96 bg-white rounded-xl shadow-2xl z-50 overflow-hidden border border-gray-200 animate-slide-up transform origin-top-left">
                    <div className="px-4 py-3 font-bold border-b text-gray-800 bg-gray-50 flex justify-between items-center">
                        <span className="flex items-center gap-2">
                             <i className="bi bi-megaphone-fill text-blue-600"></i>
                             الإشعارات
                        </span>
                        {notifications.length > 0 && (
                            <span className="text-xs font-normal text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full">
                                {notifications.length} إشعارات
                            </span>
                        )}
                    </div>
                    <div className="overflow-y-auto max-h-[450px]">
                        {notifications.length > 0 ? (
                            <div className="flex flex-col">
                                {notifications.map(notif => {
                                    const config = getNotificationTypeConfig(notif.type);
                                    return (
                                        <button
                                            key={notif.id}
                                            onClick={(e) => { 
                                                e.preventDefault();
                                                handleNotificationClick(notif);
                                            }} 
                                            className={`group text-right w-full p-4 border-b border-gray-100 transition-all duration-200 outline-none ${config.colorClass}`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border ${config.badgeClass}`}>
                                                    {config.label}
                                                </span>
                                                <i className={`bi ${config.icon} ${config.iconClass} text-lg opacity-80 group-hover:opacity-100 transition-opacity`}></i>
                                            </div>
                                            
                                            <div className="space-y-1.5">
                                                <p className="text-sm text-gray-800 font-medium leading-relaxed">
                                                    {notif.message}
                                                </p>
                                                
                                                <div className="flex items-center justify-between mt-3 text-[11px]">
                                                    {notif.deadline ? (
                                                        <div className="flex items-center gap-1.5 bg-white/60 px-2 py-1 rounded border border-gray-100 text-gray-600" dir="ltr">
                                                            <i className="bi bi-calendar-event text-gray-400"></i>
                                                            <span className="font-mono">{formatDate(notif.deadline)}</span>
                                                            <span className="ml-1 text-gray-400 font-sans">:الاستحقاق</span>
                                                        </div>
                                                    ) : (
                                                        <div />
                                                    )}
                                                    
                                                    <span className="text-blue-600 font-semibold flex items-center gap-1 group-hover:translate-x-[-4px] transition-transform">
                                                        عرض التفاصيل
                                                        <i className="bi bi-chevron-left small"></i>
                                                    </span>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="py-12 px-6 text-center space-y-3">
                                <i className="bi bi-check-circle text-4xl text-gray-200"></i>
                                <p className="text-gray-500 font-medium">لا توجد إشعارات جديدة حالياً.</p>
                            </div>
                        )}
                    </div>
                    {notifications.length > 5 && (
                        <div className="bg-gray-50 p-2 text-center border-t">
                            <span className="text-[10px] text-gray-400 uppercase tracking-widest">قم بالتمرير لمشاهدة المزيد</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default NotificationBell;