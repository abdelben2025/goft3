
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useData } from '../context/DataContext';
import { Page } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { formatCurrency } from '../utils/currencyUtils';

interface GlobalSearchProps {
    isOpen: boolean;
    onClose: () => void;
    navigate: (page: Page, id?: number, tab?: string) => void;
}

const GlobalSearch: React.FC<GlobalSearchProps> = ({ isOpen, onClose, navigate }) => {
    const { db } = useData();
    const { dir } = useLanguage();
    const [query, setQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setTimeout(() => inputRef.current?.focus(), 100);
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const results = useMemo(() => {
        if (query.trim().length < 2) return [];

        const q = query.toLowerCase().trim();
        const foundResults: { type: 'operation' | 'piece' | 'beneficiaire' | 'lot', data: any, label: string, secondary: string, id: number, page: Page }[] = [];

        // Search Operations
        db.T_OPERATION.forEach(op => {
            if ((op.INT_OPERATION || '').toLowerCase().includes(q) || (op.N_OPERATION || '').toLowerCase().includes(q)) {
                foundResults.push({
                    type: 'operation',
                    data: op,
                    label: op.INT_OPERATION,
                    secondary: op.N_OPERATION || '',
                    id: op.ID_OPERATION,
                    page: 'OPERATION_DETAILS'
                });
            }
        });

        // Search Lots
        db.T_LOT_OPERATION.forEach(lot => {
            if ((lot.INTITULE_LOT || '').toLowerCase().includes(q) || (lot.N_LOT || '').toLowerCase().includes(q)) {
                foundResults.push({
                    type: 'lot',
                    data: lot,
                    label: lot.INTITULE_LOT,
                    secondary: `الحصة رقه: ${lot.N_LOT} - ${formatCurrency(lot.MONTANT_INITIALE_LOT)}`,
                    id: lot.ID_OPERATION,
                    page: 'OPERATION_DETAILS'
                });
            }
        });

        // Search Beneficiaries
        db.T_BENEFICIAIRE.forEach(ben => {
            if ((ben.BENEFICIAIRE || '').toLowerCase().includes(q)) {
                foundResults.push({
                    type: 'beneficiaire',
                    data: ben,
                    label: ben.BENEFICIAIRE,
                    secondary: ben.ADRESSE || '',
                    id: ben.ID_BENEFICIAIRE,
                    page: 'BENEFICIARIES'
                });
            }
        });

        // Search Pieces (Contracts, Invoices, etc.)
        db.T_PIECE.forEach(p => {
            if ((p.PIECE || '').toLowerCase().includes(q)) {
                foundResults.push({
                    type: 'piece',
                    data: p,
                    label: p.PIECE,
                    secondary: `${p.NAT_PIECE} - ${formatCurrency(p.MONTANT_PIECE)}`,
                    id: p.ID_OPERATION,
                    page: 'DOCUMENTS'
                });
            }
        });

        return foundResults.slice(0, 50); // Limit to 50 results
    }, [query, db]);

    const handleSelect = (result: any) => {
        if (result.page === 'DOCUMENTS') {
             navigate(result.page, result.id, result.data.ID_PIECE.toString());
        } else if (result.type === 'lot') {
             // Navigate to operation details, lots tab, and pass the lot ID
             navigate('OPERATION_DETAILS', result.id, `LOTS:${result.data.ID_LOT}`);
        } else if (result.type === 'beneficiaire') {
             // Navigate to Documents page and filter by beneficiary
             navigate('DOCUMENTS', undefined, `BENEFICIAIRE:${result.id}`);
        } else {
             navigate(result.page, result.id);
        }
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-start justify-center pt-20 p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -20 }}
                        className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-gray-200"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="relative p-4 border-b">
                            <i className={`bi bi-search absolute ${dir === 'rtl' ? 'right-8' : 'left-8'} top-1/2 -translate-y-1/2 text-gray-400`}></i>
                            <input
                                ref={inputRef}
                                type="text"
                                className="w-full bg-gray-100 border-none rounded-xl py-3 px-12 text-sm focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                                placeholder="بحث شامل عن عمليات، مستفيدين، أو وثائق..."
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                autoComplete="off"
                            />
                            <div className={`absolute ${dir === 'rtl' ? 'left-8' : 'right-8'} top-1/2 -translate-y-1/2`}>
                                <kbd className="hidden sm:inline-flex items-center gap-1 rounded border bg-white px-2 py-0.5 text-[10px] font-medium text-gray-500 opacity-60">
                                    Esc
                                </kbd>
                            </div>
                        </div>

                        <div className="max-h-[60vh] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-200">
                            {query.trim().length > 0 && query.trim().length < 2 && (
                                <div className="p-8 text-center text-gray-500">
                                    <p className="text-sm">اكتب حرفين على الأقل للبحث...</p>
                                </div>
                            )}

                            {query.trim().length >= 2 && results.length === 0 && (
                                <div className="p-8 text-center text-gray-500">
                                    <i className="bi bi-search text-3xl mb-2 block opacity-20"></i>
                                    <p className="text-sm">لم يتم العثور على نتائج لـ "{query}"</p>
                                </div>
                            )}

                            {results.length > 0 && (
                                <div className="space-y-1 mt-1">
                                    {results.map((result, idx) => (
                                        <button
                                            key={`${result.type}-${idx}`}
                                            onClick={() => handleSelect(result)}
                                            className="w-full flex items-center gap-3 p-3 hover:bg-blue-50 rounded-xl transition-colors text-right group"
                                        >
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                                result.type === 'operation' ? 'bg-blue-100 text-blue-600' :
                                                result.type === 'beneficiaire' ? 'bg-purple-100 text-purple-600' :
                                                result.type === 'lot' ? 'bg-amber-100 text-amber-600' :
                                                'bg-green-100 text-green-600'
                                            }`}>
                                                <i className={`bi ${
                                                    result.type === 'operation' ? 'bi-briefcase' :
                                                    result.type === 'beneficiaire' ? 'bi-person-badge' :
                                                    result.type === 'lot' ? 'bi-layers' :
                                                    'bi-file-earmark-text'
                                                } text-lg`}></i>
                                            </div>
                                            <div className="flex-1 overflow-hidden">
                                                <div className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                                                    {result.label}
                                                </div>
                                                <div className="text-[10px] text-gray-500 truncate">
                                                    {result.secondary}
                                                </div>
                                            </div>
                                            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                <i className={`bi bi-chevron-${dir === 'rtl' ? 'left' : 'right'} text-blue-400`}></i>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}

                            {query.length === 0 && (
                                <div className="p-6 text-center text-gray-400">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                                        <div className="bg-gray-50 p-4 rounded-2xl flex flex-col items-center">
                                            <i className="bi bi-briefcase text-2xl mb-1 text-blue-400"></i>
                                            <span className="text-[10px] font-bold">العمليات</span>
                                        </div>
                                        <div className="bg-gray-50 p-4 rounded-2xl flex flex-col items-center">
                                            <i className="bi bi-person-badge text-2xl mb-1 text-purple-400"></i>
                                            <span className="text-[10px] font-bold">المستفيدين</span>
                                        </div>
                                        <div className="bg-gray-50 p-4 rounded-2xl flex flex-col items-center">
                                            <i className="bi bi-receipt text-2xl mb-1 text-green-400"></i>
                                            <span className="text-[10px] font-bold">الوثائق</span>
                                        </div>
                                        <div className="bg-gray-50 p-4 rounded-2xl flex flex-col items-center">
                                            <i className="bi bi-layers text-2xl mb-1 text-amber-400"></i>
                                            <span className="text-[10px] font-bold">الحصص</span>
                                        </div>
                                    </div>
                                    <p className="text-xs">استخدم البحث الموحد للوصول السريع للمعلومات</p>
                                </div>
                            )}
                        </div>

                        <div className="bg-gray-50 p-2 sm:px-4 flex items-center justify-between text-[10px] text-gray-400 font-medium">
                            <div className="flex gap-4">
                                <span className="flex items-center gap-1">
                                    <kbd className="border bg-white px-1.5 rounded text-[9px] shadow-sm">Enter</kbd>
                                    للاختيار
                                </span>
                                <span className="flex items-center gap-1">
                                    <kbd className="border bg-white px-1.5 rounded text-[9px] shadow-sm">ESC</kbd>
                                    للإغلاق
                                </span>
                            </div>
                            <div className="hidden sm:block">
                                نتائج البحث
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default GlobalSearch;
