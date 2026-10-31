import React from 'react';
import { formatCurrency } from '../utils/currencyUtils';
import { useLanguage } from '../context/LanguageContext';
import { labelNaturePiece } from '../utils/dataLabels';

export interface DocumentRowProps {
    piece: any;
    index: number;
    isSelected: boolean;
    isHighlighted: boolean;
    highlightColor: 'red' | 'amber' | 'blue' | null;
    onSelect: (piece: any) => void;
    onShowDetails: (piece: any) => void;
    onNavigate: (type: 'ENG' | 'PAI', piece: any) => void;
    onAction: (type: 'ENG' | 'PAI', pieceId: number) => void;
    onNavigateBeneficiary: (beneficiaryId: number) => void;
    onNavigateStructure: (rubricId: number, pieceOpId?: number) => void;
    isConcernedWithEngagement: (piece: any) => boolean;
    isConcernedWithPaiement: (piece: any) => boolean;
    isViewer: boolean;
    isChild?: boolean;
}

const DocumentRow = React.memo<DocumentRowProps>(({
    piece, index, isSelected, isHighlighted, highlightColor,
    onSelect, onShowDetails, onNavigate, onAction, onNavigateBeneficiary, onNavigateStructure,
    isConcernedWithEngagement, isConcernedWithPaiement, isViewer,
    isChild = false
}) => {
    const { t } = useLanguage();
    const getIcon = () => {
        if (['صفقة', 'اتفاقية'].includes(piece.NAT_PIECE)) return <i className="bi bi-file-earmark-text font-bold text-sky-600"></i>;
        if (['وضعية الأشغال', 'وضعية التسبيق الجزافي', 'وضعية التسبيق على التموين', 'فاتورة','حكم قضائي'].includes(piece.NAT_PIECE)) return <i className="text-green-600">.</i>;
        if (piece.NAT_PIECE === 'ملحق') return <i className="text-sky-600">.</i>;
        if (piece.NAT_PIECE === 'قرار فسخ') return <i className="text-red-600">.</i>;
        return <i className="text-gray-600">.</i>;
    };

    return (
        <tr
            id={`piece-row-${piece.ID_PIECE}`}
            className={`group hover:bg-blue-50 cursor-pointer text-[9px] transition-all duration-200 ${
                piece.isContextOnly ? 'opacity-55 bg-gray-50/70 border-dashed border-gray-200' : ''
            } ${
                piece.isDuplicate
                    ? (isSelected ? 'bg-red-200 hover:bg-red-250 text-red-950 ring-2 ring-red-400 font-bold' : 'bg-red-50 hover:bg-red-100/80 text-red-900 border-b border-red-100')
                    : (isSelected ? 'bg-blue-200 ring-1 ring-inset ring-blue-200' : '')
            } ${isChild ? 'bg-blue' : ''} ${isHighlighted && !piece.isDuplicate ? (highlightColor === 'red' ? 'bg-red-50 ring-2 ring-red-300' : highlightColor === 'blue' ? 'bg-blue-200 ring-2 ring-blue-300' : 'bg-amber-50 ring-2 ring-amber-300') : ''}`}
            onClick={() => onSelect(piece)}
        >
            <td className="p-1 text-sky-600 text-right font-mono text-[8px]">{index + 1}</td>
            <td className="p-1 text-center">
                <button
                    onClick={(e) => { e.stopPropagation(); onShowDetails(piece); }}
                    className="inline-flex items-center gap-1 bg-sky-50 hover:bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded border border-sky-200 font-bold transition-colors text-[8px] shadow-sm select-none"
                    title={t('doc.details_title')}
                >
                    <i className="bi bi-eye-fill text-[8px]"></i>
                    <span>{t('col.details')}</span>
                </button>
            </td>
            <td className="p-1 text-right">
                <div className={`flex text-right items-right gap-2 justify-start w-64 flex-none ${isChild ? 'pr-5' : ''}`}>
                    {isChild && (
                        <i className="bi bi-arrow-return-left text-gray-400 text-[9px] ml-1 select-none"></i>
                    )}
                    <span className="opacity-70 group-hover:opacity-100 transition-opacity">{getIcon()}</span>
                    <span className={`font-bold ${piece.isDuplicate ? 'text-red-800' : (isSelected ? 'text-blue-700' : 'text-gray-900')} w-64 text-[10px] `} title={piece.PIECE}>
                        {piece.PIECE}
                    </span>
                </div>
            </td>
            <td className="p-1 text-center">
                {piece.isContextOnly ? (
                    <span className="inline-flex items-center px-1 py-0.5 rounded text-[8px] font-bold bg-gray-100 text-gray-500 border border-gray-200">
                        {labelNaturePiece(piece.NAT_PIECE, t)} ({t('doc.reference')})
                    </span>
                ) : (
                    <span className={`inline-flex items-center px-1 py-0.5 rounded text-[8px] font-bold ${
                        piece.isDuplicate ? 'bg-red-200 text-red-800 border border-red-300' :
                        piece.NAT_PIECE === 'صفقة' ? 'bg-blue-100 text-blue-600' :
                        piece.NAT_PIECE === 'اتفاقية' ? 'bg-blue-100 text-blue-600' :
                        piece.NAT_PIECE === 'ملحق' ? 'bg-blue-100 text-blue-600' :
                        piece.NAT_PIECE === 'وضعية الأشغال' ? 'bg-green-100 text-green-600' :
                        piece.NAT_PIECE === 'فاتورة' ? 'bg-green-100 text-green-600' :
                        piece.NAT_PIECE === 'حكم قضائي' ? 'bg-green-100 text-green-600' :
                        'bg-gray-100 text-gray-600'
                    }`}>
                        {labelNaturePiece(piece.NAT_PIECE, t)}
                    </span>
                )}
            </td>
            <td className="p-1">
                <div className="flex gap-2 items-center justify-center">
                    {piece.hasEngagement ? (
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                                onNavigate('ENG', piece);
                            }}
                            className="flex items-center gap-1 bg-blue-50 hover:bg-blue-100 cursor-pointer px-1.5 py-0.5 rounded border border-blue-100 transition-colors"
                            title={t('doc.navigate_commitment')}
                        >
                            <span className="w-1 h-1 rounded-full bg-blue-500 shadow-sm"></span>
                            <span className="text-[8px] font-bold text-blue-700">{t('doc.committed')}</span>
                        </div>
                    ) : (
                        !isViewer && isConcernedWithEngagement(piece) && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onAction('ENG', piece.ID_PIECE);
                                }}
                                className="flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200 transition-all font-bold text-[8px] shadow-sm select-none"
                                title={t('doc.add_commitment_direct')}
                            >
                                <i className="bi bi-plus-square-fill text-[8px]"></i>
                                <span>{t('doc.commitment')}</span>
                            </button>
                        )
                    )}
                    {piece.hasPaiement ? (
                        <div
                            onClick={(e) => {
                                e.stopPropagation();
                                onNavigate('PAI', piece);
                            }}
                            className="flex items-center gap-1 bg-green-50 hover:bg-green-100 cursor-pointer px-1.5 py-0.5 rounded border border-green-100 transition-colors"
                            title={t('doc.navigate_payment')}
                        >
                            <span className="w-1 h-1 rounded-full bg-green-500 shadow-sm"></span>
                            <span className="text-[8px] font-bold text-green-700">{t('doc.paid')}</span>
                        </div>
                    ) : (
                        !isViewer && isConcernedWithPaiement(piece) && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onAction('PAI', piece.ID_PIECE);
                                }}
                                className="flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200 transition-all font-bold text-[8px] shadow-sm select-none"
                                title={t('doc.add_payment_direct')}
                             >
                                <i className="bi bi-plus-circle-fill text-[8px]"></i>
                                <span>{t('doc.payment')}</span>
                            </button>
                        )
                    )}
                </div>
            </td>
            <td
                className="p-1 text-center text-blue-600/70 hover:text-blue-800 hover:underline cursor-pointer max-w-[120px] text-[10px] transition-colors"
                title={piece.rubricName}
                onClick={(e) => {
                    if (!isSelected) {
                        return;
                    }
                    e.stopPropagation();
                    if (piece.ID_RUBRIQUE) {
                        onNavigateStructure(piece.ID_RUBRIQUE, piece.ID_OPERATION);
                    }
                }}
            >
                {piece.rubricName}
            </td>
            <td
                className="p-1 text-center text-green-600/70 hover:text-green-800 hover:underline cursor-pointer max-w-[120px] text-[9px] transition-colors"
                title={piece.beneficiaryName}
                onClick={(e) => {
                    e.stopPropagation();
                    if (piece.ID_BENEFICIAIRE) {
                        onNavigateBeneficiary(piece.ID_BENEFICIAIRE);
                    }
                }}
            >
                {piece.beneficiaryName}
            </td>
            <td className={`p-1 text-[11px] text-right font-black tracking-tight ${isSelected ? 'text-blue-800' : (piece.MONTANT_PIECE < 0 ? 'text-red-600' : 'text-gray-950')}`}>
                {formatCurrency(piece.MONTANT_PIECE)}
            </td>
        </tr>
    );
});

export default DocumentRow;
