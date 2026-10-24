
import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from 'react';
import Toast from '../components/Toast';
import { useData } from './DataContext';

type ToastType = 'success' | 'error' | 'info' | 'loading' | 'event';

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void;
    hideToast: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const getActionLabel = (type: string) => {
    switch (type) {
        case 'add': return 'قام بإضافة';
        case 'update': return 'قام بتعديل';
        case 'delete': return 'قام بحذف';
        case 'reset': return 'قام بمسح';
        case 'import': return 'قام باستيراد';
        case 'print': return 'قام بطباعة';
        case 'login': return 'دخل إلى النظام';
        case 'logout': return 'غادر النظام';
        default: return type;
    }
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);
    const { recentEvents } = useData();
    const lastEventIdRef = useRef<string | null>(null);

    const hideToast = useCallback(() => {
        setToast(null);
    }, []);

    const showToast = useCallback((message: string, type: ToastType = 'success') => {
        setToast({ message, type });
        
        // Only auto-dismiss if it's NOT a loading toast
        if (type !== 'loading') {
            const duration = type === 'event' ? 5000 : 3000;
            setTimeout(() => {
                setToast((current) => {
                    if (current && current.message === message && current.type === type) {
                        return null;
                    }
                    return current;
                });
            }, duration);
        }
    }, []);

    // Synchronize with real-time events
    useEffect(() => {
        if (recentEvents.length > 0) {
            const latestEvent = recentEvents[0];
            
            // Only trigger if it's a new event ID
            if (latestEvent.id !== lastEventIdRef.current) {
                lastEventIdRef.current = latestEvent.id;
                
                const actionLabel = getActionLabel(latestEvent.actionType);
                const message = latestEvent.actionType === 'login' || latestEvent.actionType === 'logout'
                    ? `المستخدم [${latestEvent.username}] ${actionLabel}`
                    : `المستخدم [${latestEvent.username}] ${actionLabel}: ${latestEvent.description}`;
                
                // Show the toast specifically for this event
                showToast(message, 'event');
            }
        }
    }, [recentEvents, showToast]);

    return (
        <ToastContext.Provider value={{ showToast, hideToast }}>
            {children}
            {toast && (
                <Toast 
                    message={toast.message} 
                    type={toast.type} 
                    onClose={hideToast} 
                />
            )}
        </ToastContext.Provider>
    );
};

export const useToast = (): ToastContextType => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};
