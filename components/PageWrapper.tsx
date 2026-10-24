
import React, { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Page, logoDataUrl, User } from '../types';
import NotificationBell from './NotificationBell';
import { useLanguage } from '../context/LanguageContext';

interface BreadcrumbItem {
    label: string;
    page: Page;
    operationId?: number;
}

interface PageWrapperProps {
    title: string;
    navigate: (page: Page, operationId?: number, tab?: string) => void;
    backPage?: Page;
    onGoBack?: () => void;
    breadcrumb?: BreadcrumbItem[];
    children: ReactNode;
    actions?: ReactNode;
    currentUser?: User;
    className?: string;
}

const PageWrapper: React.FC<PageWrapperProps> = ({ title, navigate, backPage, onGoBack, breadcrumb, children, actions, currentUser, className }) => {
    const { t, dir } = useLanguage();

    return (
        <div className={`p-2 w-full min-h-[calc(100vh-3rem)] flex flex-col ${className || ''}`} dir={dir}>
            <motion.header 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col xl:flex-row items-center justify-between mb-3 gap-3 bg-white xl:bg-transparent p-2 xl:p-0 rounded-lg shadow xl:shadow-none"
            >
                <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-start w-full xl:w-auto justify-center xl:justify-start">
                     <img src={logoDataUrl} alt="App Logo" className="w-8 h-8" />
                    <div className="flex flex-col">
                        <nav className="flex items-center gap-1 text-[10px] text-gray-500 mb-0.5 overflow-x-auto whitespace-nowrap scrollbar-hide">
                            <button 
                                onClick={() => navigate('HOME')} 
                                className="hover:text-blue-600 transition-colors"
                            >
                                {t('menu.home')}
                            </button>
                            {breadcrumb && breadcrumb.map((item, idx) => (
                                <React.Fragment key={idx}>
                                    <span className="text-gray-300">/</span>
                                    <button 
                                        onClick={() => navigate(item.page, item.operationId)}
                                        className="hover:text-blue-600 transition-colors"
                                    >
                                        {item.label}
                                    </button>
                                </React.Fragment>
                            ))}
                            <span className="text-gray-300">/</span>
                            <span className="font-medium text-gray-600">{title}</span>
                        </nav>
                        <div className="flex items-center gap-1.5">
                            {(backPage || onGoBack) && (
                                <button 
                                    onClick={() => backPage ? navigate(backPage) : onGoBack?.()} 
                                    className="p-1 hover:bg-gray-100 rounded-lg text-blue-600 transition-colors flex items-center justify-center -mr-1"
                                    title={t('btn.back')}
                                >
                                    <i className={`bi bi-arrow-${dir === 'rtl' ? 'right' : 'left'}-short text-xl leading-none`}></i>
                                </button>
                            )}
                            <h1 className="text-base sm:text-lg font-bold text-gray-900 leading-tight">{title}</h1>
                        </div>
                    </div>
                </div>
                
                <div className="flex flex-col sm:flex-row items-center gap-3 w-full xl:w-auto justify-center xl:justify-end">
                    
                    {currentUser && (
                        <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-lg shadow-sm border border-gray-200 order-2 sm:order-1">
                            <i className="bi bi-person-circle text-base text-blue-600"></i>
                            <span className="font-bold text-gray-700 text-xs">{currentUser.USERNAME}</span>
                        </div>
                    )}
                    <div className="order-1 sm:order-2 flex items-center gap-4">
                        <button 
                            onClick={() => window.dispatchEvent(new CustomEvent('open-global-search'))}
                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-blue-600 transition-colors flex items-center justify-center"
                            title="بحث شامل (Ctrl+K)"
                        >
                            <i className="bi bi-search text-lg"></i>
                        </button>
                        <NotificationBell navigate={navigate} currentUser={currentUser} />
                    </div>
                </div>

                {actions && (
                    <div className="flex flex-wrap items-center justify-center gap-2 w-full xl:w-auto mt-2 xl:mt-0 order-3">
                        {actions}
                    </div>
                )}
            </motion.header>
            <main className="flex-grow">
                {children}
            </main>
        </div>
    );
};

export default PageWrapper;
