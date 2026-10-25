
import React, { useMemo } from 'react';
import { Page, logoDataUrl, User, Notification } from '../types';
import { useNotifications } from '../hooks/useNotifications';
import { useData } from '../context/DataContext';
import { formatDate } from '../utils/dateUtils';
import { useLanguage } from '../context/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import Card from '../components/Card';

interface HomePageProps {
    navigate: (page: Page, id?: number, tab?: string) => void;
    currentUser: User;
}

const HomePage: React.FC<HomePageProps> = ({ navigate, currentUser }) => {
    const { onlineUsers } = useData();
    const { t, dir } = useLanguage();
    
    const baseNavButtons = [
        { page: 'OPERATIONS', label: t('menu.operations'), icon: 'bi-kanban', color: 'bg-blue-500' },
        { page: 'DOCUMENTS', label: t('menu.documents'), icon: 'bi-file-earmark-text', color: 'bg-indigo-500' },
        { page: 'BENEFICIARIES', label: t('menu.beneficiaries'), icon: 'bi-people', color: 'bg-teal-500' },
        { page: 'FINANCIAL_STATUS', label: t('menu.financial_status'), icon: 'bi-bar-chart-line', color: 'bg-cyan-300' },
    ];

    let navButtons = baseNavButtons;

    if (currentUser.ROLE === 'viewer') {
        navButtons = baseNavButtons.filter(btn => 
            btn.page === 'FINANCIAL_STATUS' || 
            btn.page === 'OPERATIONS' || 
            btn.page === 'DOCUMENTS' || 
            btn.page === 'BENEFICIARIES'
        );
    } else if (currentUser.ROLE === 'admin') {
        navButtons = [...baseNavButtons, { page: 'SETTINGS', label: t('menu.settings'), icon: 'bi-gear', color: 'bg-slate-600' }];
    }

    const notifications = useNotifications(currentUser);
    const [selectedFilter, setSelectedFilter] = React.useState<string | null>(null);

    const alertStats = useMemo(() => {
        return {
            financial: notifications.filter(n => ['financial_alert', 'consumption_alert', 'payment_claim_alert'].includes(n.type)).length,
            aeInsufficiency: notifications.filter(n => n.type === 'ae_structure_insufficiency').length,
            unapproved: notifications.filter(n => n.type === 'unapproved_engagement').length,
            unaccepted: notifications.filter(n => n.type === 'unaccepted_payment').length,
            unregistered: notifications.filter(n => n.type === 'unregistered_document').length,
            delayed: notifications.filter(n => ['overdue', 'overdue_service_order', 'long_delays'].includes(n.type)).length,
            upcoming: notifications.filter(n => ['upcoming', 'approaching_service_order'].includes(n.type)).length,
        };
    }, [notifications]);

    const filteredNotifications = useMemo(() => {
        if (!selectedFilter) return notifications;
        
        switch (selectedFilter) {
            case 'financial':
                return notifications.filter(n => ['financial_alert', 'consumption_alert', 'payment_claim_alert'].includes(n.type));
            case 'aeInsufficiency':
                return notifications.filter(n => n.type === 'ae_structure_insufficiency');
            case 'unapproved':
                return notifications.filter(n => n.type === 'unapproved_engagement');
            case 'unaccepted':
                return notifications.filter(n => n.type === 'unaccepted_payment');
            case 'unregistered':
                return notifications.filter(n => n.type === 'unregistered_document');
            case 'delayed':
                return notifications.filter(n => ['overdue', 'overdue_service_order', 'long_delays'].includes(n.type));
            case 'upcoming':
                return notifications.filter(n => ['upcoming', 'approaching_service_order'].includes(n.type));
            default:
                return notifications;
        }
    }, [notifications, selectedFilter]);

    const getRoleLabel = (role: string) => {
        return t(`role.${role}`);
    };

    const getAvatarBgColor = (username: string) => {
        const colors = [
            'bg-blue-100 text-blue-600',
            'bg-purple-100 text-purple-600',
            'bg-green-100 text-green-600',
            'bg-yellow-100 text-yellow-600',
            'bg-pink-100 text-pink-600',
            'bg-indigo-100 text-indigo-600',
            'bg-teal-100 text-teal-600'
        ];
        let hash = 0;
        for (let i = 0; i < username.length; i++) {
            hash = username.charCodeAt(i) + ((hash << 5) - hash);
        }
        return colors[Math.abs(hash) % colors.length];
    };

    const handleNotificationClick = (notif: Notification) => {
        const styles = getNotificationStyles(notif.type);
        const color = styles.bg === 'bg-red-50' ? 'red' : styles.bg === 'bg-amber-50' ? 'amber' : 'blue';

        switch (notif.type) {
            case 'overdue':
            case 'upcoming':
            case 'overdue_service_order':
            case 'approaching_service_order':
            case 'missing_bordereau':
            case 'long_delays':
            case 'payment_claim_alert':
            case 'ae_structure_insufficiency':
            case 'unregistered_document':
                // navigate to documents and select the piece
                if (notif.type === 'payment_claim_alert') {
                    navigate('PAYMENT_CLAIMS', notif.operationId);
                } else if (notif.type === 'ae_structure_insufficiency') {
                    navigate('AE_INSUFFICIENCY', notif.operationId);
                } else {
                    navigate('DOCUMENTS', notif.operationId, `${notif.pieceId}:${color}`);
                }
                break;
            case 'unapproved_engagement':
                // navigate to details and select engagements tab and highlight the engagement
                navigate('OPERATION_DETAILS', notif.operationId, `ENGAGEMENTS:${notif.engagementId}:${color}`);
                break;
            case 'unaccepted_payment':
                // navigate to details and select payments tab and highlight the payment
                navigate('OPERATION_DETAILS', notif.operationId, `PAIEMENTS:${notif.paiementId}:${color}`);
                break;
            case 'financial_alert':
            case 'consumption_alert':
                // navigate to details overview
                navigate('OPERATION_DETAILS', notif.operationId, `OVERVIEW:0:${color}`);
                break;
            default:
                if (notif.operationId) {
                    navigate('OPERATION_DETAILS', notif.operationId);
                }
        }
    };

    const getNotificationStyles = (type: string) => {
        switch (type) {
            case 'financial_alert':
            case 'consumption_alert':
            case 'overdue':
            case 'overdue_service_order':
            case 'long_delays':
            case 'payment_claim_alert':
            case 'ae_structure_insufficiency':
            case 'unregistered_document':
                return {
                    bg: 'bg-red-50',
                    border: 'border-red-200',
                    accent: 'bg-red-500',
                    icon: 'bi-exclamation-octagon-fill text-red-500',
                    badge: 'bg-red-100 text-red-700'
                };
            case 'unapproved_engagement':
            case 'unaccepted_payment':
            case 'missing_bordereau':
                return {
                    bg: 'bg-amber-50',
                    border: 'border-amber-200',
                    accent: 'bg-amber-500',
                    icon: 'bi-exclamation-triangle-fill text-amber-500',
                    badge: 'bg-amber-100 text-amber-700'
                };
            case 'upcoming':
            case 'approaching_service_order':
                return {
                    bg: 'bg-blue-50',
                    border: 'border-blue-200',
                    accent: 'bg-blue-500',
                    icon: 'bi-clock-history text-blue-500',
                    badge: 'bg-blue-100 text-blue-700'
                };
            default:
                return {
                    bg: 'bg-gray-50',
                    border: 'border-gray-200',
                    accent: 'bg-gray-500',
                    icon: 'bi-app-indicator text-gray-500',
                    badge: 'bg-gray-100 text-gray-700'
                };
        }
    };

    const getNotificationTypeLabel = (type: string) => {
        switch (type) {
            case 'financial_alert': return 'تنبيه مالي';
            case 'overdue': return 'تأخير متجاوز';
            case 'upcoming': return 'استحقاق قريب';
            case 'unapproved_engagement': return 'التزام غير مؤشر';
            case 'unaccepted_payment': return 'دفع غير مقبول';
            case 'overdue_service_order': return 'تأخر تنفيذ ODS';
            case 'approaching_service_order': return 'اقتراب موعد ODS';
            case 'missing_bordereau': return 'جدول إرسال ناقص';
            case 'consumption_alert': return 'تنبيه استهلاك';
            case 'long_delays': return 'تأخر إداري';
            case 'payment_claim_alert': return 'مستحقات > CP';
            case 'ae_structure_insufficiency': return 'نقص AE هيكلة';
            case 'unregistered_document': return 'وثيقة غير مسجلة';
            default: return 'تنبيه';
        }
    };

    return (
        <div className="flex flex-col items-center justify-start min-h-screen p-4 bg-gray-50 overflow-x-hidden" dir={dir}>
            <header className="w-full max-w-none flex flex-col md:flex-row justify-between items-center mb-8 pt-4 gap-4">
                <motion.div 
                    initial={{ opacity: 0, x: dir === 'rtl' ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center gap-3"
                >
                    <img src={logoDataUrl} alt="App Logo" className="w-12 h-12 md:w-16 md:h-16 drop-shadow-md" />
                    <div className={dir === 'rtl' ? 'text-right' : 'text-left'}>
                        <h1 className="text-xl md:text-2xl font-extrabold text-gray-800 tracking-tight leading-tight">
                            {t('app.title')}
                        </h1>
                        <p className="text-sm md:text-lg text-gray-600 font-medium">{t('app.subtitle')}</p>
                    </div>
                </motion.div>
                
                <motion.div 
                    initial={{ opacity: 0, x: dir === 'rtl' ? -20 : 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center gap-2 w-full md:w-auto justify-end"
                >
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 md:px-4 md:py-2 rounded-xl shadow-sm border border-gray-200">
                        <div className="w-8 h-8 md:w-10 md:h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <i className="bi bi-person text-lg md:text-xl text-blue-600"></i>
                        </div>
                        <div className={`flex flex-col min-w-0 ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>
                            <span className="font-bold text-gray-800 leading-tight text-sm md:text-base truncate">{currentUser.USERNAME}</span>
                            <span className="text-[10px] md:text-xs font-semibold text-gray-500 uppercase tracking-wider truncate">
                                {getRoleLabel(currentUser.ROLE)}
                            </span>
                        </div>
                    </div>
                    <button 
                        onClick={() => window.dispatchEvent(new CustomEvent('open-global-search'))}
                        className="bg-white text-gray-400 border border-gray-200 p-2 md:p-3 rounded-xl shadow-sm hover:bg-blue-50 hover:text-blue-600 transition-all duration-100 flex items-center justify-center group flex-shrink-0"
                        title="بحث شامل (Ctrl+K)"
                    >
                        <i className="bi bi-search text-lg md:text-xl group-hover:scale-110 transfrom transition-transform"></i>
                    </button>
                </motion.div>
            </header>

            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 w-full max-w-none mb-4 h-auto"
            >
                {navButtons.map((button, idx) => (
                    <motion.button
                        key={button.page}
                        whileHover={{ y: -2, scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03, duration: 0.2 }}
                        onClick={() => navigate(button.page as Page)}
                        className="flex flex-col items-center justify-center p-3 bg-white rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 cursor-pointer group relative overflow-hidden h-full min-h-[110px]"
                    >
                        <div className={`absolute top-0 left-0 w-full h-1 ${button.color}`}></div>
                        <div className={`p-3 rounded-xl mb-2 ${button.color} bg-opacity-10 group-hover:bg-opacity-100 transition-all duration-300`}>
                           <i className={`${button.icon} text-xl text-blue-600 group-hover:text-white transition-colors duration-300`}></i>
                        </div>
                        <span className="text-sm font-bold text-gray-700 group-hover:text-gray-900 transition-colors duration-300 text-center leading-tight">
                            {button.label}
                        </span>
                    </motion.button>
                ))}
            </motion.div>

            {/* Important Alerts KPI Section */}
            <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: 0.1 }}
                className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-1.5 w-full max-w-none mb-8"
            >
                <div onClick={() => setSelectedFilter(selectedFilter === 'financial' ? null : 'financial')} className="cursor-pointer transition-transform hover:scale-102">
                    <Card 
                        title="تنبيهات مالية" 
                        value={alertStats.financial.toString()} 
                        icon="bi-exclamation-octagon-fill" 
                        color={selectedFilter === 'financial' ? "bg-red-700 ring-4 ring-red-100" : (alertStats.financial > 0 ? "bg-red-600" : "bg-gray-400")} 
                        compact
                    />
                </div>
                <div onClick={() => setSelectedFilter(selectedFilter === 'aeInsufficiency' ? null : 'aeInsufficiency')} className="cursor-pointer transition-transform hover:scale-102">
                    <Card 
                        title="نقص رخصة الالتزام" 
                        value={alertStats.aeInsufficiency.toString()} 
                        icon="bi-shield-exclamation" 
                        color={selectedFilter === 'aeInsufficiency' ? "bg-purple-700 ring-4 ring-purple-100" : (alertStats.aeInsufficiency > 0 ? "bg-purple-600" : "bg-gray-400")} 
                        compact
                    />
                </div>
                <div onClick={() => setSelectedFilter(selectedFilter === 'unapproved' ? null : 'unapproved')} className="cursor-pointer transition-transform hover:scale-102">
                    <Card 
                        title="التزامات غير مؤشرة" 
                        value={alertStats.unapproved.toString()} 
                        icon="bi-file-earmark-lock2-fill" 
                        color={selectedFilter === 'unapproved' ? "bg-amber-700 ring-4 ring-amber-100" : (alertStats.unapproved > 0 ? "bg-amber-600" : "bg-gray-400")} 
                        compact
                    />
                </div>
                <div onClick={() => setSelectedFilter(selectedFilter === 'unaccepted' ? null : 'unaccepted')} className="cursor-pointer transition-transform hover:scale-102">
                    <Card 
                        title="دفعات غير مقبولة" 
                        value={alertStats.unaccepted.toString()} 
                        icon="bi-cash-stack" 
                        color={selectedFilter === 'unaccepted' ? "bg-amber-700 ring-4 ring-amber-100" : (alertStats.unaccepted > 0 ? "bg-amber-600" : "bg-gray-400")} 
                        compact
                    />
                </div>
                <div onClick={() => setSelectedFilter(selectedFilter === 'unregistered' ? null : 'unregistered')} className="cursor-pointer transition-transform hover:scale-102">
                    <Card 
                        title="وثائق غير مسجلة" 
                        value={alertStats.unregistered.toString()} 
                        icon="bi-file-earmark-plus-fill" 
                        color={selectedFilter === 'unregistered' ? "bg-indigo-700 ring-4 ring-indigo-100" : (alertStats.unregistered > 0 ? "bg-indigo-600" : "bg-gray-400")} 
                        compact
                    />
                </div>
                <div onClick={() => setSelectedFilter(selectedFilter === 'delayed' ? null : 'delayed')} className="cursor-pointer transition-transform hover:scale-102">
                    <Card 
                        title="آجال متجاوزة" 
                        value={alertStats.delayed.toString()} 
                        icon="bi-calendar-x-fill" 
                        color={selectedFilter === 'delayed' ? "bg-orange-700 ring-4 ring-orange-100" : (alertStats.delayed > 0 ? "bg-orange-600" : "bg-gray-400")} 
                        compact
                    />
                </div>
                <div onClick={() => setSelectedFilter(selectedFilter === 'upcoming' ? null : 'upcoming')} className="cursor-pointer transition-transform hover:scale-102">
                    <Card 
                        title="آجال قريبة" 
                        value={alertStats.upcoming.toString()} 
                        icon="bi-clock-fill" 
                        color={selectedFilter === 'upcoming' ? "bg-blue-700 ring-4 ring-blue-100" : (alertStats.upcoming > 0 ? "bg-blue-600" : "bg-gray-400")} 
                        compact
                    />
                </div>
            </motion.div>

            {!selectedFilter && notifications.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.2 }}
                    className="w-full flex items-center justify-center gap-2 text-gray-400 text-sm mt-2 mb-4 select-none"
                >
                    <i className="bi bi-hand-index-thumb-fill text-base animate-bounce"></i>
                    <span>اضغط على أحد أزرار التنبيهات لعرض تفاصيلها</span>
                </motion.div>
            )}

            {selectedFilter && filteredNotifications.length === 0 && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="w-full flex items-center justify-center gap-2 text-gray-400 text-sm mt-4 mb-4"
                >
                    <i className="bi bi-check-circle-fill text-green-400 text-base"></i>
                    <span>لا توجد تنبيهات في هذه الفئة</span>
                </motion.div>
            )}

            {selectedFilter && filteredNotifications.length > 0 && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.15 }}
                    className="w-full max-w-none mt-8 mb-8"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 bg-red-100 rounded-lg text-red-600">
                                <i className="bi bi-bell-fill text-lg"></i>
                            </div>
                            <h2 className="text-xl font-bold text-gray-800">
                                {selectedFilter ? (
                                    selectedFilter === 'financial' ? 'تنبيهات مالية' :
                                    selectedFilter === 'aeInsufficiency' ? 'نقص رخصة الالتزام' :
                                    selectedFilter === 'unapproved' ? 'التزامات غير مؤشرة' :
                                    selectedFilter === 'unaccepted' ? 'دفعات غير مقبولة' :
                                    selectedFilter === 'unregistered' ? 'وثائق غير مسجلة' :
                                    selectedFilter === 'delayed' ? 'آجال متجاوزة' :
                                    selectedFilter === 'upcoming' ? 'آجال قريبة' :
                                    'تنبيهات'
                                ) : t('home.notifications')}
                            </h2>
                            {selectedFilter && (
                                <button 
                                    onClick={() => setSelectedFilter(null)}
                                    className="text-[10px] bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1 rounded transition-colors font-bold"
                                >
                                    غلق العرض 
                                </button>
                            )}
                        </div>
                        <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-bold">
                            {filteredNotifications.length}
                        </span>
                    </div>

                    <div className={`grid gap-2 ${filteredNotifications.length > 9 ? 'grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
                        <AnimatePresence mode="popLayout">
                            {filteredNotifications.map((notif, index) => {
                                const styles = getNotificationStyles(notif.type);
                                const isCompact = filteredNotifications.length > 9;
                                return (
                                    <motion.div
                                        key={notif.id}
                                        initial={{ opacity: 0, scale: 0.98 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ delay: index * 0.03, duration: 0.2 }}
                                        onClick={() => handleNotificationClick(notif)}
                                        className={`group relative ${isCompact ? 'p-2' : 'p-3'} rounded-xl border ${styles.border} ${styles.bg} flex items-start gap-2 transition-all duration-100 overflow-hidden cursor-pointer hover:shadow-md hover:border-gray-300`}
                                    >
                                        <div className={`absolute top-0 bottom-0 ${dir === 'rtl' ? 'right-0' : 'left-0'} w-1 ${styles.accent}`}></div>
                                        
                                        <div className={`mt-0.5 ${isCompact ? 'p-1' : 'p-1.5'} rounded-lg bg-white shadow-sm ring-1 ring-black ring-opacity-5 flex-shrink-0`}>
                                            <i className={`bi ${styles.icon} ${isCompact ? 'text-base' : 'text-lg'}`}></i>
                                        </div>

                                        <div className="flex-grow min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                                <span className={`${isCompact ? 'text-[8px]' : 'text-[9px]'} uppercase font-black px-1.5 py-0.5 rounded-md tracking-wider ${styles.badge}`}>
                                                    {getNotificationTypeLabel(notif.type)}
                                                </span>
                                                {notif.deadline && (
                                                    <span className={`${isCompact ? 'text-[8px]' : 'text-[9px]'} text-gray-400 font-bold flex items-center gap-1`}>
                                                        <i className="bi bi-calendar3"></i>
                                                        {formatDate(notif.deadline)}
                                                    </span>
                                                )}
                                            </div>
                                            <p className={`text-gray-800 ${isCompact ? 'text-[10px]' : 'text-xs'} font-bold leading-snug group-hover:text-black transition-colors line-clamp-2`}>
                                                {notif.message}
                                            </p>
                                        </div>
                                        
                                        {!isCompact && (
                                            <div className="self-center flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <i className={`bi ${dir === 'rtl' ? 'bi-arrow-left-short' : 'bi-arrow-right-short'} text-2xl text-gray-400`}></i>
                                            </div>
                                        )}
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                </motion.div>
            )}

            {/* Online Users Section for Admin */}
            {currentUser.ROLE === 'admin' && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3, duration: 0.2 }}
                    className="w-full max-w-none mt-8"
                >
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-1.5 bg-green-100 rounded-lg text-green-600">
                             <i className="bi bi-broadcast text-lg"></i>
                        </div>
                        <h2 className="text-xl font-bold text-gray-800">
                            {t('home.online_users')}
                        </h2>
                        <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full font-bold">{onlineUsers.length}</span>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3">
                        {onlineUsers.length > 0 ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                                {onlineUsers.map(user => (
                                    <div key={user.userId} className="flex items-center p-1.5 bg-gray-50 rounded-lg border border-gray-100 relative overflow-hidden group hover:border-green-200 transition-all hover:shadow-md cursor-default">
                                        <div className={`absolute top-0 bottom-0 ${dir === 'rtl' ? 'right-0' : 'left-0'} w-1 bg-green-500/20 group-hover:bg-green-500/40 transition-colors`}></div>
                                        <div className={`relative ${dir === 'rtl' ? 'ml-3' : 'mr-3'}`}>
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-sm border border-white font-bold text-sm ${getAvatarBgColor(user.username)}`}>
                                                {user.username.substring(0, 1).toUpperCase()}
                                            </div>
                                            <span className={`absolute bottom-0 ${dir === 'rtl' ? 'left-0' : 'right-0'} w-3 h-3 bg-green-500 border-2 border-white rounded-full animate-pulse-green`}></span>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-gray-800 text-sm leading-tight truncate group-hover:text-green-700 transition-colors">{user.username}</p>
                                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                                                {getRoleLabel(user.role)}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center py-8">
                                <p className="text-gray-400 font-medium italic">{t('loading')}</p>
                            </div>
                        )}
                    </div>
                </motion.div>
            )}

            {/* Shortcuts hint */}
            <div className="w-full max-w-none mt-8 text-center text-[10px] text-gray-400 font-medium leading-relaxed select-none">
                <span className="inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
                    <span><kbd className="border border-gray-300 bg-gray-100 rounded px-1 py-0.5 text-[9px] shadow-sm">Ctrl+O</kbd> العمليات</span>
                    <span><kbd className="border border-gray-300 bg-gray-100 rounded px-1 py-0.5 text-[9px] shadow-sm">Ctrl+D</kbd> الوثائق</span>
                    <span><kbd className="border border-gray-300 bg-gray-100 rounded px-1 py-0.5 text-[9px] shadow-sm">Ctrl+B</kbd> المستفيدين</span>
                    <span><kbd className="border border-gray-300 bg-gray-100 rounded px-1 py-0.5 text-[9px] shadow-sm">Ctrl+S</kbd> الإعدادات</span>
                    <span><kbd className="border border-gray-300 bg-gray-100 rounded px-1 py-0.5 text-[9px] shadow-sm">Ctrl+H</kbd> الرئيسية</span>
                    <span><kbd className="border border-gray-300 bg-gray-100 rounded px-1 py-0.5 text-[9px] shadow-sm">Ctrl+F</kbd> الوضعية المالية</span>
                    <span><kbd className="border border-gray-300 bg-gray-100 rounded px-1 py-0.5 text-[9px] shadow-sm">Ctrl+P</kbd> البرامج</span>
                    <span><kbd className="border border-gray-300 bg-gray-100 rounded px-1 py-0.5 text-[9px] shadow-sm">Ctrl+C</kbd> الأصناف</span>
                    <span><kbd className="border border-gray-300 bg-gray-100 rounded px-1 py-0.5 text-[9px] shadow-sm">Ctrl+K</kbd> البحث</span>
                    <span><kbd className="border border-gray-300 bg-gray-100 rounded px-1 py-0.5 text-[9px] shadow-sm">Alt+←</kbd> رجوع</span>
                </span>
            </div>
        </div>
    );
};

export default HomePage;
