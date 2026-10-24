
import React from 'react';
import { logoDataUrl } from '../types';

const SplashScreen: React.FC = () => {
    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-gray-100 to-blue-50" dir="rtl">
            <div className="animate-bounce mb-6">
                <img src={logoDataUrl} alt="Logo" className="w-32 h-32 drop-shadow-lg" />
            </div>
            
            <h1 className="text-4xl font-extrabold text-gray-800 mb-2 tracking-wide">GOFT3</h1>
            <p className="text-xl text-gray-600 mb-8 font-medium">تسيير العمليات المالية لنفقات الإستثمار</p>
            
            <div className="flex flex-col items-center">
                <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                <span className="text-sm text-gray-500 animate-pulse">جارٍ بدء التشغيل...</span>
            </div>

            <div className="absolute bottom-8 text-gray-400 text-xs">
                <p>© {new Date().getFullYear()} جميع الحقوق محفوظة</p>
            </div>
        </div>
    );
};

export default SplashScreen;
