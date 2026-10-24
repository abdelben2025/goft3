import React from 'react';
import { FileText } from 'lucide-react';
import { Page } from '../types';
import { formatCurrency } from '../utils/currencyUtils';

interface OperationRowProps {
    op: any;
    isSelected: boolean;
    onSelect: (id: number | null) => void;
    navigate: (page: Page, id?: number) => void;
}

const OperationRow: React.FC<OperationRowProps> = ({ op, isSelected, onSelect, navigate }) => {
    return (
        <tr 
            data-testid={`operation-row-${op.ID_OPERATION}`}
            className={`hover:bg-blue-50/50 transition-colors cursor-pointer group ${isSelected ? 'bg-blue-100 ring-2 ring-blue-400 ring-inset' : ''}`}
            onClick={() => onSelect(isSelected ? null : op.ID_OPERATION)}
        >
            <td className="p-3 text-center">
                <button 
                    onClick={(e) => { e.stopPropagation(); navigate('OPERATION_DETAILS', op.ID_OPERATION); }}
                    className="bg-white border text-gray-600 hover:text-blue-600 hover:border-blue-300 p-1.5 rounded-lg transition-all shadow-sm group-hover:scale-110 active:scale-95"
                    title="عرض التفاصيل"
                >
                    <i className="bi bi-eye-fill"></i>
                </button>
            </td>
            <td className="p-3 text-center">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border ${
                    op.status === 'جارية' 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                        : 'bg-rose-50 text-rose-700 border-rose-100'
                }`}>
                    {op.status === 'جارية' ? <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-1.5 animate-pulse"></span> : null}
                    {op.status}
                </span>
            </td>
            <td className="p-3">
                <div className="flex flex-col gap-1.5">
                    <div className="flex flex-wrap gap-1 items-center">
                        <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                            {op.N_OPERATION}
                        </span>
                        {op.TYPE_OP && (
                            <span className="text-[10px] font-bold text-sky-800 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-100 uppercase tracking-wide">
                                {op.TYPE_OP}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 group/name">
                        <span className="operation-name text-xs font-medium text-gray-700 leading-relaxed group-hover:text-blue-900 transition-colors line-clamp-2" title={op.INT_OPERATION}>
                            {op.INT_OPERATION}
                        </span>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                navigate('DOCUMENTS', op.ID_OPERATION);
                            }}
                            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all opacity-0 group-hover:opacity-100 flex-shrink-0"
                            title="عرض الوثائق"
                        >
                            <FileText size={14} />
                        </button>
                    </div>
                </div>
            </td>
            <td className="p-3 text-xs font-semibold text-gray-600">{formatCurrency(op.aeFinale)}</td>
            <td className="p-3 text-xs font-semibold text-gray-600">{formatCurrency(op.totalEngagements)}</td>
            <td className="p-3 text-xs font-bold text-amber-700">{formatCurrency(op.totalEngagementsCurrentYear)}</td>
            <td className="p-3 text-xs font-bold text-rose-600">{formatCurrency(op.remainingAE)}</td>
            <td className="p-3 text-xs font-semibold text-gray-600">{formatCurrency(op.totalPaiements)}</td>
            <td className="p-3 text-xs font-bold text-indigo-700">{formatCurrency(op.cpFinaleCurrentYear)}</td>
            <td className="p-3 text-xs font-bold text-emerald-600">{formatCurrency(op.paiementsCurrentYear)}</td>
            <td className="p-3 text-xs font-bold text-rose-600">{formatCurrency(op.remainingCP)}</td>
        </tr>
    );
};

export default React.memo(OperationRow);
