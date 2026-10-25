import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useData } from '../context/DataContext';
import { Page } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { formatCurrency } from '../utils/currencyUtils';
import BeneficiaryDetailsModal from './BeneficiaryDetailsModal';

interface GlobalSearchProps {
    isOpen: boolean;
    onClose: () => void;
    navigate: (page: Page, id?: number, tab?: string) => void;
}

type SearchMode = 'operation' | 'piece' | 'beneficiaire' | 'lot' | 'transfer';

const MODES: { key: SearchMode; label: string; icon: string; color: string }[] = [
    { key: 'beneficiaire', label: 'مستفيد', icon: 'bi-person-badge', color: 'text-purple-600' },
    { key: 'transfer', label: 'حوالة', icon: 'bi-arrow-left-right', color: 'text-cyan-600' },
    { key: 'operation', label: 'عملية', icon: 'bi-briefcase', color: 'text-blue-600' },
    { key: 'piece', label: 'وثيقة', icon: 'bi-file-earmark-text', color: 'text-green-600' },
    { key: 'lot', label: 'حصة', icon: 'bi-layers', color: 'text-amber-600' },
];

const GlobalSearch: React.FC<GlobalSearchProps> = ({ isOpen, onClose, navigate }) => {
    const { db } = useData();
    const { dir } = useLanguage();
    const [query, setQuery] = useState('');
    const [selectedModes, setSelectedModes] = useState<SearchMode[]>([]);
    const [beneficiaryId, setBeneficiaryId] = useState<number | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedModes([]);
            inputRef.current?.focus();
        }
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (beneficiaryId !== null) setBeneficiaryId(null);
                else if (isOpen) onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose, beneficiaryId]);

    const toggleMode = (mode: SearchMode) => {
        setSelectedModes(prev =>
            prev.includes(mode) ? prev.filter(m => m !== mode) : [...prev, mode]
        );
    };

    const results = useMemo(() => {
        if (query.trim().length < 2) return [];
        const q = query.toLowerCase().trim();
        const active = (m: SearchMode) => selectedModes.length === 0 || selectedModes.includes(m);

        const foundResults: { type: SearchMode; data: any; label: string; secondary: string; id: number; page: Page }[] = [];

        if (active('operation')) {
            db.T_OPERATION.forEach(op => {
                if ((op.INT_OPERATION || '').toLowerCase().includes(q) || (op.N_OPERATION || '').toLowerCase().includes(q)) {
                    foundResults.push({ type: 'operation', data: op, label: op.INT_OPERATION, secondary: op.N_OPERATION || '', id: op.ID_OPERATION, page: 'OPERATION_DETAILS' });
                }
            });
        }

        if (active('lot')) {
            db.T_LOT_OPERATION.forEach(lot => {
                if ((lot.INTITULE_LOT || '').toLowerCase().includes(q) || (lot.N_LOT || '').toLowerCase().includes(q)) {
                    foundResults.push({ type: 'lot', data: lot, label: lot.INTITULE_LOT, secondary: `الحصة رقم: ${lot.N_LOT} - ${formatCurrency(lot.MONTANT_INITIALE_LOT)}`, id: lot.ID_OPERATION, page: 'OPERATION_DETAILS' });
                }
            });
        }

        if (active('beneficiaire')) {
            db.T_BENEFICIAIRE.forEach(ben => {
                if ((ben.BENEFICIAIRE || '').toLowerCase().includes(q) || (ben.ADRESSE || '').toLowerCase().includes(q)) {
                    foundResults.push({ type: 'beneficiaire', data: ben, label: ben.BENEFICIAIRE, secondary: ben.ADRESSE || '', id: ben.ID_BENEFICIAIRE, page: 'BENEFICIARIES' });
                }
            });
        }

        if (active('piece')) {
            db.T_PIECE.forEach(p => {
                if ((p.PIECE || '').toLowerCase().includes(q) || (p.NAT_PIECE || '').toLowerCase().includes(q)) {
                    foundResults.push({ type: 'piece', data: p, label: p.PIECE, secondary: `${p.NAT_PIECE} - ${formatCurrency(p.MONTANT_PIECE)}`, id: p.ID_OPERATION, page: 'DOCUMENTS' });
                }
            });
        }

        if (active('transfer')) {
            db.T_PAIEMENT.forEach(p => {
                const byNum = (p.N_MANDAT || '').toLowerCase().includes(q);
                const amountStr = String(p.MONTANT_PAI).toLowerCase();
                const formattedAmount = formatCurrency(p.MONTANT_PAI).toLowerCase();
                const byAmount = amountStr.includes(q) || formattedAmount.includes(q);
                if (byNum || byAmount) {
                    foundResults.push({
                        type: 'transfer',
                        data: p,
                        label: `حوالة ${p.N_MANDAT || p.N_PAI}`,
                        secondary: `المبلغ: ${formatCurrency(p.MONTANT_PAI)} — ${p.ANNEE}`,
                        id: p.ID_OPERATION,
                        page: 'OPERATION_DETAILS',
                    });
                }
            });
        }

        return foundResults.slice(0, 50);
    }, [query, db, selectedModes]);

    const openBeneficiary = (id: number) => setBeneficiaryId(id);

    const handleSelect = (result: any) => {
        if (result.type === 'beneficiaire') {
            openBeneficiary(result.id);
            return;
        }
        if (result.type === 'transfer') {
            navigate('OPERATION_DETAILS', result.id, `PAIEMENTS:${result.data.ID_PAIEMENT}`);
        } else if (result.page === 'DOCUMENTS') {
            navigate(result.page, result.id, result.data.ID_PIECE.toString());
        } else if (result.type === 'lot') {
            navigate('OPERATION_DETAILS', result.id, `LOTS:${result.data.ID_LOT}`);
        } else {
            navigate(result.page, result.id);
        }
        onClose();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            const single = results.length === 1 ? results[0] : null;
            if (single?.type === 'beneficiaire') {
                e.preventDefault();
                openBeneficiary(single.id);
            }
        }
    };

    return (
        <>
            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-16 p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -20 }}
                            className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-gray-200"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* شريط اختيار نوع البحث */}
                            <div className="flex flex-wrap items-center gap-2 px-4 pt-3 pb-1 border-b border-gray-100">
                                <span className="text-[11px] font-bold text-gray-500 ml-1">ابحث في:</span>
                                {MODES.map(mode => {
                                    const on = selectedModes.length === 0 || selectedModes.includes(mode.key);
                                    return (
                                        <button
                                            key={mode.key}
                                            onClick={() => toggleMode(mode.key)}
                                            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border transition-all ${
                                                on ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-blue-300'
                                            }`}
                                        >
                                            <i className={`bi ${mode.icon} ${on ? '' : mode.color}`}></i>
                                            {mode.label}
                                        </button>
                                    );
                                })}
                                {selectedModes.length > 0 && (
                                    <button onClick={() => setSelectedModes([])} className="text-[11px] text-gray-400 hover:text-red-500 font-bold underline">
                                        عرض الكل
                                    </button>
                                )}
                            </div>

                            <div className="relative p-4 border-b">
                                <i className={`bi bi-search absolute ${dir === 'rtl' ? 'right-8' : 'left-8'} top-1/2 -translate-y-1/2 text-gray-400`}></i>
                                <input
                                    ref={inputRef}
                                    type="text"
                                    className="w-full bg-gray-100 border-none rounded-xl py-3 px-12 text-sm focus:ring-2 focus:ring-blue-500 transition-all outline-none"
                                    placeholder="اكتب ثم اضغط Enter... (مستفيد، حوالة بالرقم/المبلغ، عملية، وثيقة، حصة)"
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    autoComplete="off"
                                />
                                <div className={`absolute ${dir === 'rtl' ? 'left-8' : 'right-8'} top-1/2 -translate-y-1/2`}>
                                    <kbd className="hidden sm:inline-flex items-center gap-1 rounded border bg-white px-2 py-0.5 text-[10px] font-medium text-gray-500 opacity-60">
                                        Esc
                                    </kbd>
                                </div>
                            </div>

                            <div className="max-h-[55vh] overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-gray-200">
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
                                                    result.type === 'transfer' ? 'bg-cyan-100 text-cyan-600' :
                                                    'bg-green-100 text-green-600'
                                                }`}>
                                                    <i className={`bi ${
                                                        result.type === 'operation' ? 'bi-briefcase' :
                                                        result.type === 'beneficiaire' ? 'bi-person-badge' :
                                                        result.type === 'lot' ? 'bi-layers' :
                                                        result.type === 'transfer' ? 'bi-arrow-left-right' :
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
                                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
                                            {MODES.map(mode => (
                                                <div key={mode.key} className="bg-gray-50 p-4 rounded-2xl flex flex-col items-center">
                                                    <i className={`bi ${mode.icon} text-2xl mb-1 ${mode.color}`}></i>
                                                    <span className="text-[10px] font-bold">{mode.label}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-xs">استخدم البحث الموحد للوصول السريع للمعلومات</p>
                                    </div>
                                )}
                            </div>

                            <div className="bg-gray-50 p-2 sm:px-4 flex items-center justify-between text-[10px] text-gray-400 font-medium">
                                <div className="flex gap-4">
                                    <span className="flex items-center gap-1">
                                        <kbd className="border bg-white px-1.5 rounded text-[9px] shadow-sm">Enter</kbd>
                                        فتح نافذة المستفيد (إن كان البحث عن مستفيد)
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <kbd className="border bg-white px-1.5 rounded text-[9px] shadow-sm">ESC</kbd>
                                        للإغلاق
                                    </span>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <BeneficiaryDetailsModal
                isOpen={beneficiaryId !== null}
                beneficiaryId={beneficiaryId}
                onClose={() => setBeneficiaryId(null)}
            />
        </>
    );
};

export default GlobalSearch;
