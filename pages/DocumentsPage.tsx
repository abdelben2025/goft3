
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Page, Piece, Database, User } from '../types';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { errorMessage } from '../utils/errorMessage';
import { useLanguage } from '../context/LanguageContext';
import PageWrapper from '../components/PageWrapper';
import Modal from '../components/Modal';
import ConfirmActionModal from '../components/ConfirmActionModal';
import AddDocumentForm from '../components/forms/AddDocumentForm';
import AddLotPieceForm from '../components/forms/AddLotPieceForm';
import AddOdsForm from '../components/forms/AddOdsForm';
import AddEngagementForm from '../components/forms/AddEngagementForm';
import AddPaiementForm from '../components/forms/AddPaiementForm';
import { formatCurrency } from '../utils/currencyUtils';
import { normalizeDate, parseDate, compareDates, calculateElapsedDays, getEffectiveDurationDays, isFinancialDuration, formatDurationArabic } from '../utils/dateUtils';
import CustomDropdown from '../components/CustomDropdown';
import ExcelJS from 'exceljs';
import { Search, X } from 'lucide-react';

interface DocumentsPageProps {
    navigate: (page: Page, operationId?: number, extraId?: string) => void;
    initialOperationId?: number | null;
    initialPieceId?: string;
    onGoBack?: () => void;
    currentUser: User;
}

const formatCurrencyForExcel = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return '0,00';
    return new Intl.NumberFormat('ar-DZ', {
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
};


const SearchHeader: React.FC<{
    title: string;
    isActive: boolean;
    children: React.ReactNode;
    tooltip?: string;
}> = ({ title, isActive, children, tooltip }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center justify-center gap-1">
                <span>{title}</span>
                <button 
                    onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                    className={`p-0.5 rounded-[20px] bg-blue-100 transition-colors ${isOpen || isActive ? 'bg-blue-300 text-blue-600' : 'hover:bg-blue-200 text-gray-400'}`}
                    title={tooltip}
                >
                    <Search size={10} />
                </button>
            </div>
            {(isOpen || isActive) && children}
        </div>
    );
};

const DocumentRow = React.memo<{
    piece: any;
    index: number;
    isSelected: boolean;
    isHighlighted: boolean;
    highlightColor: 'red' | 'amber' | 'blue' | null;
    onSelect: (piece: any) => void;
    onNavigate: (type: 'ENG' | 'PAI', piece: any) => void;
    onAction: (type: 'ENG' | 'PAI', pieceId: number) => void;
    onNavigateBeneficiary: (beneficiaryId: number) => void;
    onNavigateStructure: (rubricId: number, pieceOpId?: number) => void;
    isConcernedWithEngagement: (piece: any) => boolean;
    isConcernedWithPaiement: (piece: any) => boolean;
    isViewer: boolean;
    isChild?: boolean;
}>(({ 
    piece, index, isSelected, isHighlighted, highlightColor, 
    onSelect, onNavigate, onAction, onNavigateBeneficiary, onNavigateStructure,
    isConcernedWithEngagement, isConcernedWithPaiement, isViewer,
    isChild = false
}) => {
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
            <td className="p-1 text-right">
                <div className={`flex text-right items-right gap-2 justify-start ${isChild ? 'pr-5' : ''}`}>
                    {isChild && (
                        <i className="bi bi-arrow-return-left text-gray-400 text-[9px] ml-1 select-none"></i>
                    )}
                    <span className="opacity-70 group-hover:opacity-100 transition-opacity">{getIcon()}</span>
                    <span className={`font-bold ${piece.isDuplicate ? 'text-red-800' : (isSelected ? 'text-blue-700' : 'text-gray-900')} truncate max-w-[150px] text-[10px] `} title={piece.PIECE}>
                        {piece.PIECE}
                    </span>
                </div>
            </td>
            <td className="p-1 text-center">
                {piece.isContextOnly ? (
                    <span className="inline-flex items-center px-1 py-0.5 rounded text-[8px] font-bold bg-gray-100 text-gray-500 border border-gray-200">
                        {piece.NAT_PIECE} (مرجع)
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
                        {piece.NAT_PIECE}
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
                            title="انتقل إلى الالتزام"
                        >
                            <span className="w-1 h-1 rounded-full bg-blue-500 shadow-sm"></span>
                            <span className="text-[8px] font-bold text-blue-700">ملتزم</span>
                        </div>
                    ) : (
                        !isViewer && isConcernedWithEngagement(piece) && (
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onAction('ENG', piece.ID_PIECE);
                                }}
                                className="flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200 transition-all font-bold text-[8px] shadow-sm select-none"
                                title="إضافة التزام مباشر لهذا المستند"
                            >
                                <i className="bi bi-plus-square-fill text-[8px]"></i>
                                <span>التزام</span>
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
                            title="انتقل إلى الدفع"
                        >
                            <span className="w-1 h-1 rounded-full bg-green-500 shadow-sm"></span>
                            <span className="text-[8px] font-bold text-green-700">مسدد</span>
                        </div>
                    ) : (
                        !isViewer && isConcernedWithPaiement(piece) && (
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onAction('PAI', piece.ID_PIECE);
                                }}
                                className="flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200 transition-all font-bold text-[8px] shadow-sm select-none"
                                title="إضافة دفع مباشر لهذا المستند"
                             >
                                <i className="bi bi-plus-circle-fill text-[8px]"></i>
                                <span>دفع</span>
                            </button>
                        )
                    )}
                </div>
            </td>
            <td 
                className="p-1 text-center text-blue-600/70 hover:text-blue-800 hover:underline cursor-pointer max-w-[120px] truncate text-[10px] transition-colors" 
                title={piece.rubricName}
                onClick={(e) => {
                    if (!isSelected) {
                        // Let the click bubble up to the <tr>'s onClick which selects this row, without navigating yet
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
                className="p-1 text-center text-green-600/70 hover:text-green-800 hover:underline cursor-pointer max-w-[120px] truncate text-[9px] transition-colors" 
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

const DocumentsPage: React.FC<DocumentsPageProps> = ({ navigate, initialOperationId, initialPieceId, onGoBack, currentUser }) => {
    const { db, loading, addItem, updateItem, deleteItem, runInTransaction, connectionError, integrityIssues, refreshData } = useData();

    const { showToast } = useToast();
    const [isRetrying, setIsRetrying] = useState<boolean>(false);

    const handleRetry = useCallback(async () => {
        setIsRetrying(true);
        showToast('جاري إعادة المحاولة والاتصال بـ Supabase...', 'loading');
        try {
            await refreshData();
            showToast('تم تحديث البيانات والاتصال بنجاح', 'success');
        } catch (error) {
            console.error("Retry failed:", error);
            showToast(`فشلت محاولة الاتصال مجددًا بقاعدة البيانات — السبب: ${errorMessage(error)}`, 'error');
        } finally {
            setIsRetrying(false);
        }
    }, [refreshData, showToast]);
    const { t } = useLanguage();
    const [selectedOperationId, setSelectedOperationId] = useState<string>('');
    const [selectedPieceType, setSelectedPieceType] = useState<string>('');
    const [selectedStructureDetail, setSelectedStructureDetail] = useState<string>('');
    const [searchPieceName, setSearchPieceName] = useState<string>('');
    const [selectedBeneficiaireId, setSelectedBeneficiaireId] = useState<string>('');
    const [selectedSaiEng, setSelectedSaiEng] = useState<string>('');
    const [selectedSaiPai, setSelectedSaiPai] = useState<string>('');
    const [selectedPiece, setSelectedPiece] = useState<Piece | null>(null);
    const [isDeleting, setIsDeleting] = useState<boolean>(false);
    const [pendingDelete, setPendingDelete] = useState<{
        table: keyof Database;
        id: number | null;
        idField: string;
        kind?: 'item' | 'orphan' | 'orphanAll';
        message?: string;
    } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isViewer = currentUser.ROLE === 'viewer';

    const uniquePieceTypes = useMemo(() => {
        const types = new Set<string>();
        db.T_PIECE.forEach(p => {
            if (p.NAT_PIECE) {
                types.add(p.NAT_PIECE.trim());
            }
        });
        return Array.from(types).sort();
    }, [db.T_PIECE]);

    const uniqueRubrics = useMemo(() => {
        const rubricIds = new Set<number>();
        db.T_PIECE.forEach(p => {
            if (!selectedOperationId || Number(p.ID_OPERATION) === Number(selectedOperationId)) {
                if (p.ID_RUBRIQUE) {
                    rubricIds.add(p.ID_RUBRIQUE);
                }
            }
        });
        return db.T_RUBRIQUE
            .filter(r => rubricIds.has(r.ID_RUBRIQUE))
            .sort((a, b) => a.RUBRIQUE.localeCompare(b.RUBRIQUE));
    }, [db.T_RUBRIQUE, db.T_PIECE, selectedOperationId]);

    const [modalState, setModalState] = useState<{
        type: 'DOCUMENT' | 'LOT_PIECE' | 'ODS' | 'ENGAGEMENT' | 'PAIEMENT' | null;
        data?: any;
        timestamp?: number;
    }>({ type: null });

    const [highlightId, setHighlightId] = useState<number | null>(null);
    const [highlightColor, setHighlightColor] = useState<'red' | 'amber' | 'blue' | null>(null);

    useEffect(() => {
        if (initialOperationId) {
            setSelectedOperationId(String(initialOperationId));
        }
        if (initialPieceId && !loading) {
            if (initialPieceId.startsWith('BENEFICIAIRE:')) {
                const beneficiaryId = initialPieceId.split(':')[1];
                const bName = db.T_BENEFICIAIRE.find(b => b.ID_BENEFICIAIRE === Number(beneficiaryId))?.BENEFICIAIRE || '';
                setSelectedBeneficiaireId(bName);
                setSelectedPiece(null);
            } else {
                const [pieceIdStr, color] = initialPieceId.split(':');
                const pieceId = parseInt(pieceIdStr, 10);
                
                const piece = db.T_PIECE.find(p => p.ID_PIECE === pieceId);
                if (piece) {
                    setSelectedPiece(piece);
                    setHighlightId(pieceId);
                    setHighlightColor(color as any || 'amber');
                    // Wait for the render then scroll
                    setTimeout(() => {
                        const rowId = `piece-row-${pieceId}`;
                        const row = document.getElementById(rowId);
                        if (row) {
                            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                    }, 500);
                }
            }
        }
    }, [initialOperationId, initialPieceId, db.T_PIECE, db.T_BENEFICIAIRE, loading]);

    const displayPieces = useMemo(() => {
        // Create maps for faster lookups
        const beneficiaryMap = new Map(db.T_BENEFICIAIRE.map(b => [b.ID_BENEFICIAIRE, b.BENEFICIAIRE]));
        const rubricMap = new Map(db.T_RUBRIQUE.map(r => [r.ID_RUBRIQUE, r.RUBRIQUE]));
        const engagementPieceIds = new Set(db.T_ENGAGEMENT.map(e => e.ID_PIECE));
        const paiementPieceIds = new Set(db.T_PAIEMENT.map(p => p.ID_PIECE));
        
        // Count frequencies of each (NAT_PIECE, PIECE.trim()) for 'صفقة', 'اتفاقية', 'فاتورة'
        const duplicateCountMap = new Map<string, number>();
        const targetNatures = ['صفقة', 'اتفاقية', 'فاتورة', 'حكم قضائي'];
        db.T_PIECE.forEach(p => {
            if (p.NAT_PIECE && targetNatures.includes(p.NAT_PIECE)) {
                const key = `${p.NAT_PIECE.trim()}|||${(p.PIECE || '').trim().toLowerCase()}`;
                duplicateCountMap.set(key, (duplicateCountMap.get(key) || 0) + 1);
            }
        });

        // Pre-calculate sums for rubrics to speed up isConcernedWithEngagement
        const rubConsMap = new Map<string, number>();
        db.T_ENGAGEMENT.forEach(e => {
            const p = db.T_PIECE.find(piece => piece.ID_PIECE === e.ID_PIECE);
            if (p && p.ID_RUBRIQUE) {
                const key = `${e.ID_OPERATION}-${p.ID_RUBRIQUE}`;
                let amt = e.MONTANT_ENG;
                if (['إلغاء', 'إنخفاض التقييم'].includes(e.NATURE_ENG)) amt = -amt;
                rubConsMap.set(key, (rubConsMap.get(key) || 0) + amt);
            }
        });

        // Pre-calculate CP consumption per operation
        const cpConsumedMap = new Map<number, number>();
        db.T_PAIEMENT.forEach(p => {
            cpConsumedMap.set(p.ID_OPERATION, (cpConsumedMap.get(p.ID_OPERATION) || 0) + p.MONTANT_PAI);
        });

        const cpTotalMap = new Map<number, number>();
        db.T_CP.forEach(c => {
            cpTotalMap.set(c.ID_OPERATION, (cpTotalMap.get(c.ID_OPERATION) || 0) + (c.MONTANT_FINALE_CP ?? c.MONTANT_INITIALE_CP));
        });

        return db.T_PIECE.filter(piece => {
            // Check authorization
            if (currentUser.ROLE !== 'admin' && currentUser.ALLOWED_OPERATIONS) {
                try {
                    const allowedOps = JSON.parse(currentUser.ALLOWED_OPERATIONS) as any[];
                    if (allowedOps.length > 0 && !allowedOps.map(Number).includes(Number(piece.ID_OPERATION))) {
                        return false;
                    }
                } catch (e) {
                    console.error("Error parsing allowed operations", e);
                }
            }

            const operationMatch = !selectedOperationId || Number(piece.ID_OPERATION) === Number(selectedOperationId);
            
            const typeMatch = !selectedPieceType || (piece.NAT_PIECE && piece.NAT_PIECE.trim() === selectedPieceType);
            const nameMatch = !searchPieceName || piece.PIECE.toLowerCase().includes(searchPieceName.toLowerCase());
            const beneficiaryName = beneficiaryMap.get(piece.ID_BENEFICIAIRE || -1) || '---';
            const beneficiaryMatch = !selectedBeneficiaireId || beneficiaryName.toLowerCase().includes(selectedBeneficiaireId.toLowerCase());
            const structureMatch = !selectedStructureDetail || Number(piece.ID_RUBRIQUE) === Number(selectedStructureDetail);

            // Commitment Filter: Exclude irrelevant types when filter is active
            let saiEngMatch = true;
            if (selectedSaiEng !== '') {
                const commitmentTypes = ['مقرر', 'قرار', 'صفقة', 'اتفاقية', 'ملحق', 'قرار فسخ', 'فاتورة', 'حكم قضائي'];
                const isCommitmentDoc = commitmentTypes.some(type => piece.NAT_PIECE.trim() === type);
                saiEngMatch = isCommitmentDoc && String(!!piece.SAI_ENG) === selectedSaiEng;
            }

            // Payment Filter: Exclude specific types when filter is active
            let saiPaiMatch = true;
            if (selectedSaiPai !== '') {
                const paymentTypes = ['فاتورة', 'وضعية الأشغال', 'وضعية التسبيق الجزافي', 'وضعية التسبيق على التموين', 'حكم قضائي','رفع اليد عن الضمان'];
                const isPaymentDoc = paymentTypes.some(type => piece.NAT_PIECE.trim() === type);
                saiPaiMatch = isPaymentDoc && String(!!piece.SAI_PAI) === selectedSaiPai;
            }

            return operationMatch && typeMatch && nameMatch && beneficiaryMatch && structureMatch && saiEngMatch && saiPaiMatch;
        }).sort((a, b) => a.ID_PIECE - b.ID_PIECE)
        .map(piece => {
            const bName = beneficiaryMap.get(piece.ID_BENEFICIAIRE || -1) || '---';
            const rName = piece.ID_RUBRIQUE ? (rubricMap.get(piece.ID_RUBRIQUE) || '---') : '---';
            const hasEng = engagementPieceIds.has(piece.ID_PIECE);
            const hasPai = paiementPieceIds.has(piece.ID_PIECE);

            // Pre-calculate concern flags for each row to avoid expensive calculations in render
            let isConcernedEng = true;
            if (['وضعية الأشغال', 'وضعية التسبيق الجزافي', 'وضعية التسبيق على التموين'].includes(piece.NAT_PIECE.trim())) {
                isConcernedEng = false;
            } else if (piece.ID_RUBRIQUE) {
                const rubriqueOp = db.T_RUBRIQUE_OP.find(r => r.ID_OPERATION === piece.ID_OPERATION && r.ID_RUBRIQUE === piece.ID_RUBRIQUE);
                if (!rubriqueOp) isConcernedEng = false;
                else {
                    const totalAE = rubriqueOp.MONTANT_FINALE ?? rubriqueOp.MONTANT_INITIALE;
                    const committed = rubConsMap.get(`${piece.ID_OPERATION}-${piece.ID_RUBRIQUE}`) || 0;
                    if (piece.MONTANT_PIECE > (totalAE - committed) + 0.01) isConcernedEng = false;
                }
            }

            let isConcernedPai = true;
            if (['مقرر', 'صفقة', 'اتفاقية', 'ملحق', 'قرار فسخ'].includes(piece.NAT_PIECE.trim()) || piece.PIECE.includes('التكفل بباقي رخصة البرنامج')) {
                isConcernedPai = false;
            } else {
                if (['فاتورة', 'حكم قضائي'].includes(piece.NAT_PIECE.trim())) {
                    const eng = db.T_ENGAGEMENT.find(e => e.ID_PIECE === piece.ID_PIECE);
                    if (!eng || !eng.N_VISA_CB) isConcernedPai = false;
                }
                if (isConcernedPai) {
                    const totalCP = cpTotalMap.get(piece.ID_OPERATION) || 0;
                    const consumed = cpConsumedMap.get(piece.ID_OPERATION) || 0;
                    if (piece.MONTANT_PIECE > (totalCP - consumed) + 0.01) isConcernedPai = false;
                }
            }

            const pieceKey = `${piece.NAT_PIECE?.trim() || ''}|||${(piece.PIECE || '').trim().toLowerCase()}`;
            const isDuplicate = targetNatures.includes(piece.NAT_PIECE) && (duplicateCountMap.get(pieceKey) || 0) > 1;

            return {
                ...piece,
                beneficiaryName: bName,
                rubricName: rName,
                hasEngagement: hasEng,
                hasPaiement: hasPai,
                isConcernedEng,
                isConcernedPai,
                isDuplicate
            };
        });
    }, [db.T_PIECE, db.T_BENEFICIAIRE, db.T_RUBRIQUE, db.T_ENGAGEMENT, db.T_PAIEMENT, db.T_RUBRIQUE_OP, db.T_CP, selectedOperationId, selectedPieceType, searchPieceName, selectedBeneficiaireId, selectedStructureDetail, selectedSaiEng, selectedSaiPai, currentUser.ROLE, currentUser.ALLOWED_OPERATIONS]);

    const [visibleCount, setVisibleCount] = useState(200);

    const flattenedRows = useMemo(() => {
        const rows: { type: 'operation' | 'piece' | 'totals'; key: string; data?: any; isChild?: boolean; index?: number }[] = [];
        let pieceIndex = 0;

        if (displayPieces.length === 0) return [];

        // Group displayPieces by operation
        const opIds = Array.from(new Set(displayPieces.map(p => p.ID_OPERATION)));

        // Sort operation IDs by N_OPERATION to keep them ordered, placing orphaned ones at the bottom
        const sortedOpIds = opIds.sort((a, b) => {
            const opA = db.T_OPERATION.find(x => x.ID_OPERATION === a);
            const opB = db.T_OPERATION.find(x => x.ID_OPERATION === b);
            if (!opA && !opB) return 0;
            if (!opA) return 1;
            if (!opB) return -1;
            return opA.N_OPERATION.localeCompare(opB.N_OPERATION);
        });

        sortedOpIds.forEach(opId => {
            const originalOperation = db.T_OPERATION.find(op => op.ID_OPERATION === opId);
            const operation = originalOperation || {
                ID_OPERATION: opId,
                N_OPERATION: '⚠️ وثائق يتيمة (علاقة مكسورة)',
                INT_OPERATION: `تنبيه: ترتبط هذه الوثائق بمعرّف عملية (ID_OPERATION: ${opId}) غير متواجد في قاعدة البيانات T_OPERATION`,
                N_OPERATION_ANCIEN: null,
                ID_CATEGORIE: -1,
                ID_SCATEGORIE: null,
                status: 'جارية'
            } as any;
            const opFilteredPieces = displayPieces.filter(p => p.ID_OPERATION === opId);

            // Push operation header row
            rows.push({
                type: 'operation',
                key: `op-header-${opId}`,
                data: operation
            });

            // Find all main contracts (safqa or ittifaqiya) for this operation in the entire db
            const mainContractsInOp = db.T_PIECE.filter(p => p.ID_OPERATION === opId && ['صفقة', 'اتفاقية'].includes(p.NAT_PIECE));

            // Track which pieces in opFilteredPieces are already handled as child of some contract
            const handledPieceIds = new Set<number>();

            // For each main contract:
            mainContractsInOp.forEach(contract => {
                // Find children in the filtered pieces list
                const filteredChildren = opFilteredPieces.filter(p => p.ID_PIECE_INIT === contract.ID_PIECE);

                // Is the contract itself in the filtered pieces list?
                const contractInFiltered = opFilteredPieces.find(p => p.ID_PIECE === contract.ID_PIECE);

                if (contractInFiltered || filteredChildren.length > 0) {
                    // Determine the contract piece object to render
                    let contractObjToRender = contractInFiltered;

                    if (!contractObjToRender) {
                        // It's not in filtered list, we must construct a context one
                        const bName = db.T_BENEFICIAIRE.find(b => b.ID_BENEFICIAIRE === contract.ID_BENEFICIAIRE)?.BENEFICIAIRE || '---';
                        const rName = contract.ID_RUBRIQUE ? (db.T_RUBRIQUE.find(r => r.ID_RUBRIQUE === contract.ID_RUBRIQUE)?.RUBRIQUE || '---') : '---';
                        const hasEng = db.T_ENGAGEMENT.some(e => e.ID_PIECE === contract.ID_PIECE);
                        const hasPai = db.T_PAIEMENT.some(p => p.ID_PIECE === contract.ID_PIECE);

                        contractObjToRender = {
                            ...contract,
                            beneficiaryName: bName,
                            rubricName: rName,
                            hasEngagement: hasEng,
                            hasPaiement: hasPai,
                            isConcernedEng: false,
                            isConcernedPai: false,
                            isDuplicate: false,
                            isContextOnly: true
                        } as any;
                    } else {
                        handledPieceIds.add(contract.ID_PIECE);
                    }

                    // Add the contract row
                    rows.push({
                        type: 'piece',
                        key: `piece-${contract.ID_PIECE}`,
                        data: contractObjToRender,
                        isChild: false,
                        index: pieceIndex++
                    });

                    // Add its matching children
                    filteredChildren.forEach(child => {
                        rows.push({
                            type: 'piece',
                            key: `piece-${child.ID_PIECE}`,
                            data: child,
                            isChild: true,
                            index: pieceIndex++
                        });
                        handledPieceIds.add(child.ID_PIECE);
                    });
                }
            });

            // Now find all other pieces in opFilteredPieces that have NOT been handled (standalone pieces)
            const standalonePieces = opFilteredPieces.filter(p => !handledPieceIds.has(p.ID_PIECE));

            standalonePieces.forEach(piece => {
                rows.push({
                    type: 'piece',
                    key: `piece-${piece.ID_PIECE}`,
                    data: piece,
                    isChild: false,
                    index: pieceIndex++
                });
            });

            // Calculate totals of commitment and payment documents for this operation
            const commitmentTypes = ['قرار', 'صفقة', 'اتفاقية', 'ملحق', 'قرار فسخ', 'فاتورة','حكم قضائي'];
            const paymentTypes = ['فاتورة', 'وضعية الأشغال', 'وضعية التسبيق الجزافي', 'وضعية التسبيق على التموين','حكم قضائي'];

            const totalCommitment = opFilteredPieces
                .filter(p => p.NAT_PIECE && commitmentTypes.includes(p.NAT_PIECE.trim()))
                .reduce((sum, p) => sum + (p.MONTANT_PIECE || 0), 0);

            const totalPayment = opFilteredPieces
                .filter(p => p.NAT_PIECE && paymentTypes.includes(p.NAT_PIECE.trim()))
                .reduce((sum, p) => sum + (p.MONTANT_PIECE || 0), 0);

            rows.push({
                type: 'totals',
                key: `totals-${opId}`,
                data: {
                    totalCommitment,
                    totalPayment,
                    opId
                }
            });
        });

        return rows;
    }, [displayPieces, db.T_PIECE, db.T_OPERATION, db.T_BENEFICIAIRE, db.T_RUBRIQUE, db.T_ENGAGEMENT, db.T_PAIEMENT]);

    useEffect(() => {
        setVisibleCount(200);
    }, [flattenedRows]);

    const remainingCPForSelectedOp = useMemo(() => {
        if (!selectedOperationId) return null;
        const opId = parseInt(selectedOperationId, 10);
        
        // Sum all CP allocations for this operation
        const totalCP = db.T_CP
            .filter(c => c.ID_OPERATION === opId)
            .reduce((sum, c) => sum + (c.MONTANT_FINALE_CP ?? c.MONTANT_INITIALE_CP), 0);
        
        // Sum all payments made for this operation
        const consumedCP = db.T_PAIEMENT
            .filter(p => p.ID_OPERATION === opId)
            .reduce((sum, p) => sum + p.MONTANT_PAI, 0);

        return totalCP - consumedCP;
    }, [selectedOperationId, db.T_CP, db.T_PAIEMENT]);

    const remainingAEForSelectedOp = useMemo(() => {
        if (!selectedOperationId) return null;
        const opId = parseInt(selectedOperationId, 10);

        // Sum all AE allocations for this operation
        const totalAE = db.T_RUBRIQUE_OP
            .filter(r => r.ID_OPERATION === opId)
            .reduce((sum, r) => sum + (r.MONTANT_FINALE ?? r.MONTANT_INITIALE), 0);

        // Sum all engagements for this operation
        const totalEngaged = db.T_ENGAGEMENT
            .filter(e => e.ID_OPERATION === opId)
            .reduce((sum, e) => {
                if (['التزام', 'ملحق', 'فاتورة', 'قرار فسخ','حكم قضائي'].includes(e.NATURE_ENG)) {
                    return sum + e.MONTANT_ENG;
                }
                if (e.NATURE_ENG === 'سحب') {
                    return sum + (e.MONTANT_ENG < 0 ? e.MONTANT_ENG : -e.MONTANT_ENG);
                }
                return sum;
            }, 0);

        return totalAE - totalEngaged;
    }, [selectedOperationId, db.T_RUBRIQUE_OP, db.T_ENGAGEMENT]);

    const associatedLotPieces = useMemo(() => {
        if (!selectedPiece) return [];
        return db.T_LOT_PIECE.filter(lp => lp.ID_PIECE === selectedPiece.ID_PIECE);
    }, [selectedPiece, db.T_LOT_PIECE]);

    const associatedLotsData = useMemo(() => {
        return associatedLotPieces.map(lp => {
            const lotInfo = db.T_LOT_OPERATION.find(lot => lot.ID_LOT === lp.ID_LOT);
            if (!lotInfo) return null;
            return {
                ...lotInfo,
                ID_LOT_PIECE: lp.ID_LOT_PIECE,
                DELAI_EX_JOURS: lp.DELAI_EX_JOURS // Include Lot-specific duration
            };
        }).filter((item): item is NonNullable<typeof item> => item !== null);
    }, [associatedLotPieces, db.T_LOT_OPERATION]);

    const associatedLotObjects = useMemo(() => {
        return associatedLotsData.map(l => ({ 
            ID_LOT: l.ID_LOT, 
            N_LOT: l.N_LOT, 
            INTITULE_LOT: l.INTITULE_LOT,
            ID_OPERATION: l.ID_OPERATION,
            MONTANT_INITIALE_LOT: l.MONTANT_INITIALE_LOT,
            MONTANT_FINALE_LOT: l.MONTANT_FINALE_LOT,
            ATTRIBUER: l.ATTRIBUER
        }));
    }, [associatedLotsData]);

    const associatedOds = useMemo(() => {
        if (!selectedPiece) return [];
        return db.T_ODS.filter(ods => ods.ID_PIECE === selectedPiece.ID_PIECE);
    }, [selectedPiece, db.T_ODS]);

    const odsCalculations = useMemo(() => {
        if (!selectedPiece || !['صفقة', 'اتفاقية'].includes(selectedPiece.NAT_PIECE)) return null;

        const useFinancialRule = isFinancialDuration(selectedPiece.DELAI_EX_JOURS);
        const baseDuration = getEffectiveDurationDays(selectedPiece.DELAI_EX_JOURS);
        
        // Filter and sort ODS
        const sortedOds = [...associatedOds].sort((a, b) => compareDates(a.DATE_ODS, b.DATE_ODS));
        const commencementOds = sortedOds.find(o => o.NATURE_ODS === 'انطلاق');
        
        const terminationDocs = db.T_PIECE.filter(p => p.ID_PIECE_INIT === selectedPiece.ID_PIECE && p.NAT_PIECE === 'قرار فسخ');
        const totalTerminatedAmount = terminationDocs.reduce((sum, p) => sum + (p.MONTANT_PIECE || 0), 0);
        const isTerminated = terminationDocs.length > 0;
        const isFullyTerminated = isTerminated && totalTerminatedAmount >= (selectedPiece.MONTANT_PIECE || 0);

        if (!commencementOds) return { baseDuration, startDate: null, isTerminated, isFullyTerminated, totalTerminatedAmount };

        const startDate = parseDate(commencementOds.DATE_ODS);
        if (!startDate) return { baseDuration, startDate: null, isTerminated, isFullyTerminated, totalTerminatedAmount };

        let totalSuspensionDays = 0;
        let lastStopDate: Date | null = null;
        let isSuspended = false;

        sortedOds.forEach(ods => {
            const odsDate = parseDate(ods.DATE_ODS);
            if (!odsDate) return;

            if (ods.NATURE_ODS === 'ايقاف') {
                lastStopDate = odsDate;
                isSuspended = true;
            } else if (ods.NATURE_ODS === 'استئناف' && lastStopDate) {
                totalSuspensionDays += calculateElapsedDays(lastStopDate, odsDate, useFinancialRule);
                lastStopDate = null;
                isSuspended = false;
            } else if (ods.NATURE_ODS === 'ختام') {
                isSuspended = false; // Works are done
            }
        });

        // If currently suspended, calculate suspension days up to today for information
        let currentSuspensionDays = 0;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (isSuspended && lastStopDate) {
            currentSuspensionDays = calculateElapsedDays(lastStopDate, today, useFinancialRule);
        }

        // Expected End Date (Projected based on closed suspension periods)
        const expectedEndDate = new Date(startDate);
        // We add base duration and closed suspension periods
        expectedEndDate.setDate(startDate.getDate() + baseDuration + totalSuspensionDays);

        const isCompleted = sortedOds.some(o => o.NATURE_ODS === 'ختام');
        const remainingDays = isCompleted ? 0 : calculateElapsedDays(today, expectedEndDate, useFinancialRule);
        
        const isLate = !isCompleted && today > expectedEndDate;
        let delayDays = 0;
        if (isLate) {
            delayDays = calculateElapsedDays(expectedEndDate, today, useFinancialRule);
        }
        
        const closingOds = sortedOds.find(o => o.NATURE_ODS === 'ختام');
        const warrantyEndDate = closingOds ? new Date(parseDate(closingOds.DATE_ODS)!) : null;
        if (warrantyEndDate) {
            // Warranty is usually 1 year + 1 day from provisional acceptance
            warrantyEndDate.setDate(warrantyEndDate.getDate() + 1);
            warrantyEndDate.setFullYear(warrantyEndDate.getFullYear() + 1);
        }

        const isWarrantyExpired = warrantyEndDate ? today >= warrantyEndDate : false;

        return {
            baseDuration,
            startDate,
            totalSuspensionDays,
            currentSuspensionDays,
            expectedEndDate,
            remainingDays,
            delayDays,
            isLate,
            isSuspended,
            isCompleted,
            isTerminated,
            isFullyTerminated,
            totalTerminatedAmount,
            warrantyEndDate,
            isWarrantyExpired
        };
    }, [selectedPiece, associatedOds, db.T_PIECE]);

    const operationOptions = useMemo(() => {
        let ops = db.T_OPERATION;
        if (currentUser.ROLE !== 'admin' && currentUser.ALLOWED_OPERATIONS) {
            try {
                const allowedOps = JSON.parse(currentUser.ALLOWED_OPERATIONS) as any[];
                if (allowedOps.length > 0) {
                    ops = ops.filter(op => allowedOps.map(Number).includes(Number(op.ID_OPERATION)));
                }
            } catch (e) {
                console.error("Error parsing allowed operations", e);
            }
        }
        return ops.map(op => ({ value: String(op.ID_OPERATION), label: op.INT_OPERATION }));
    }, [db.T_OPERATION, currentUser]);



    const dataForEngagementForm = useMemo(() => {
        if (modalState.type !== 'ENGAGEMENT' || !modalState.data?.defaultPieceId) return null;
        
        let piece = db.T_PIECE.find(p => p.ID_PIECE === modalState.data.defaultPieceId);
        if (!piece && modalState.data.defaultPiece) {
            piece = modalState.data.defaultPiece;
        }

        if (!piece) return null;
        const opId = piece.ID_OPERATION;

        let opPieces = db.T_PIECE.filter(p => p.ID_OPERATION === opId);
        if (!opPieces.find(p => p.ID_PIECE === piece!.ID_PIECE)) {
            opPieces = [...opPieces, piece];
        }

        return {
            opId,
            pieces: opPieces,
            rubriqueOps: db.T_RUBRIQUE_OP.filter(r => r.ID_OPERATION === opId).sort((a,b) => a.ID_RUBRIQUE_OP - b.ID_RUBRIQUE_OP),
            engagements: db.T_ENGAGEMENT.filter(e => e.ID_OPERATION === opId),
        }
    }, [modalState, db]);

    const dataForPaiementForm = useMemo(() => {
        if (modalState.type !== 'PAIEMENT' || !modalState.data?.defaultPieceId) return null;
        
        let piece = db.T_PIECE.find(p => p.ID_PIECE === modalState.data.defaultPieceId);
        if (!piece && modalState.data.defaultPiece) {
            piece = modalState.data.defaultPiece;
        }

        if (!piece) return null;
        const opId = piece.ID_OPERATION;

        let opPieces = db.T_PIECE.filter(p => p.ID_OPERATION === opId);
        if (!opPieces.find(p => p.ID_PIECE === piece!.ID_PIECE)) {
            opPieces = [...opPieces, piece];
        }

        return {
            opId,
            pieces: opPieces,
            engagements: db.T_ENGAGEMENT.filter(e => e.ID_OPERATION === opId),
            paiements: db.T_PAIEMENT.filter(p => p.ID_OPERATION === opId),
        }
    }, [modalState, db]);


    const checkPermission = (operationId: number) => {
        if (isViewer) return false;
        const operation = db.T_OPERATION.find(op => op.ID_OPERATION === operationId);
        if (!operation) return false;
        return operation.CREATED_BY === currentUser.ID_USER || currentUser.ROLE === 'admin';
    };

    const handleSave = async (
        table: keyof Database,
        data: any,
        idField: string
    ) => {
        let opId = data.ID_OPERATION;
        
        if (!opId && data.ID_PIECE) {
            const piece = db.T_PIECE.find(p => p.ID_PIECE === data.ID_PIECE);
            if (piece) opId = piece.ID_OPERATION;
        }

        if (opId && !checkPermission(opId)) {
            alert('ليس لديك صلاحية التعديل على هذه العملية.');
            return;
        }

        // --- Proactive Foreign Key Integrity Checks ---
        if (table === 'T_PIECE') {
            const opExists = db.T_OPERATION.some(op => Number(op.ID_OPERATION) === Number(data.ID_OPERATION));
            if (!data.ID_OPERATION || !opExists) {
                alert('خطأ في سلامة العلاقات: لا يمكن ربط الوثيقة بمهام أو عملية غير صالحة أو غير موجودة بمخزن البيانات.');
                return;
            }
            if (data.ID_BENEFICIAIRE && data.NAT_PIECE !== 'مقرر') {
                const benExists = db.T_BENEFICIAIRE.some(b => Number(b.ID_BENEFICIAIRE) === Number(data.ID_BENEFICIAIRE));
                if (!benExists) {
                    alert('خطأ في سلامة العلاقات: المستفيد المحدد غير موجود في قاعدة البيانات.');
                    return;
                }
            }
            if (data.ID_SCATEGORIE) {
                const scatExists = db.T_SCATEGORIE.some(s => Number(s.ID_SCATEGORIE) === Number(data.ID_SCATEGORIE));
                if (!scatExists) {
                    alert('خطأ في سلامة العلاقات: الصنف الفرعي المحدد غير موجود في قاعدة البيانات.');
                    return;
                }
            }
            if (data.ID_RUBRIQUE) {
                const rubExists = db.T_RUBRIQUE.some(r => Number(r.ID_RUBRIQUE) === Number(data.ID_RUBRIQUE));
                if (!rubExists) {
                    alert('خطأ في سلامة العلاقات: تفصيل الهيكلة المحدد غير موجود في قاعدة البيانات.');
                    return;
                }
            }
            if (data.ID_PIECE_INIT) {
                const parentExists = db.T_PIECE.some(p => Number(p.ID_PIECE) === Number(data.ID_PIECE_INIT));
                if (!parentExists) {
                    alert('خطأ في سلامة العلاقات: الوثيقة الأصلية المرتبط بها غير موجودة في قاعدة البيانات.');
                    return;
                }
            }
        }

        if (table === 'T_ENGAGEMENT') {
            const opExists = db.T_OPERATION.some(op => Number(op.ID_OPERATION) === Number(data.ID_OPERATION));
            if (!data.ID_OPERATION || !opExists) {
                alert('خطأ في سلامة العلاقات: العملية المرتبطة بالالتزام غير موجودة.');
                return;
            }
            const pieceExists = db.T_PIECE.some(p => Number(p.ID_PIECE) === Number(data.ID_PIECE));
            if (!data.ID_PIECE || !pieceExists) {
                alert('خطأ في سلامة العلاقات: الوثيقة المرتبطة بالالتزام غير موجودة.');
                return;
            }
        }

        if (table === 'T_PAIEMENT') {
            const opExists = db.T_OPERATION.some(op => Number(op.ID_OPERATION) === Number(data.ID_OPERATION));
            if (!data.ID_OPERATION || !opExists) {
                alert('خطأ في سلامة العلاقات: العملية المرتبطة بالدفع غير موجودة.');
                return;
            }
            const pieceExists = db.T_PIECE.some(p => Number(p.ID_PIECE) === Number(data.ID_PIECE));
            if (!data.ID_PIECE || !pieceExists) {
                alert('خطأ في سلامة العلاقات: الوثيقة المرتبطة بالدفع غير موجودة.');
                return;
            }
        }

        try {
            if (data[idField]) {
                await updateItem(table, data[idField], data);
                showToast('تم التعديل بنجاح', 'success');
            } else {
                const nwItem = await addItem(table, data);
                showToast('تمت الإضافة بنجاح', 'success');
                if (nwItem && table === 'T_PIECE') {
                    if (nwItem.ID_OPERATION) {
                        setSelectedOperationId(String(nwItem.ID_OPERATION));
                        setSelectedPieceType('');
                        setSearchPieceName('');
                        setSelectedBeneficiaireId('');
                        setSelectedStructureDetail('');
                        setSelectedSaiEng('');
                        setSelectedSaiPai('');
                        setSelectedPiece(nwItem);
                        setHighlightId(nwItem.ID_PIECE);
                        setHighlightColor('amber');
                        setTimeout(() => {
                            const rowId = `piece-row-${nwItem.ID_PIECE}`;
                            const row = document.getElementById(rowId);
                            if (row) {
                                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                        }, 500);
                    }
                }
            }
            setModalState({ type: null });
        } catch (error) {
            showToast(`حدث خطأ أثناء الحفظ — السبب: ${errorMessage(error)}`, 'error');
        }
    };

    const handleSaveLotPiece = async (data: any) => {
        const piece = db.T_PIECE.find(p => p.ID_PIECE === data.ID_PIECE);
        if (piece && !checkPermission(piece.ID_OPERATION)) {
            alert('ليس لديك صلاحية التعديل على هذه العملية.');
            return;
        }

        if (data.ID_LOT) {
            const existingLink = db.T_LOT_PIECE.find(lp => lp.ID_LOT === data.ID_LOT && lp.ID_LOT_PIECE !== data.ID_LOT_PIECE);
            if (existingLink) {
                alert('هذه الحصة مرتبطة بالفعل بوثيقة أخرى أو بنفس الوثيقة.');
                return;
            }
        }

        try {
            await handleSave('T_LOT_PIECE', data, 'ID_LOT_PIECE');
            if (data.ID_LOT) {
                const lot = db.T_LOT_OPERATION.find(l => l.ID_LOT === data.ID_LOT);
                if (lot) {
                    await updateItem('T_LOT_OPERATION', lot.ID_LOT, { ...lot, ATTRIBUER: true });
                }
            }
        } catch (error) {
            showToast(`حدث خطأ أثناء ربط الحصة — السبب: ${errorMessage(error)}`, 'error');
        }
    };

    const handleDelete = async (table: keyof Database, id: number | null, idField: string) => {
        if (id === null || isViewer || isDeleting) return;

        let opId: number | undefined;

        if (table === 'T_PIECE') {
            const piece = db.T_PIECE.find(p => p.ID_PIECE === id);
            opId = piece?.ID_OPERATION;
        } else if (table === 'T_LOT_PIECE') {
            const lp = db.T_LOT_PIECE.find(l => l.ID_LOT_PIECE === id);
            const piece = lp ? db.T_PIECE.find(p => p.ID_PIECE === lp.ID_PIECE) : null;
            opId = piece?.ID_OPERATION;
        } else if (table === 'T_ODS') {
            const ods = db.T_ODS.find(o => o.ID_ODS === id);
            const piece = ods ? db.T_PIECE.find(p => p.ID_PIECE === ods.ID_PIECE) : null;
            opId = piece?.ID_OPERATION;
        }

        if (opId && !checkPermission(opId)) {
            alert('ليس لديك صلاحية الحذف في هذه العملية.');
            return;
        }

        // Show confirmation FIRST — nothing is deleted until the user confirms
        setPendingDelete({ table, id, idField, kind: 'item' });
    };

    const confirmPendingDelete = async () => {
        const pending = pendingDelete;
        setPendingDelete(null);
        if (!pending || pending.id === null) return;

        const { table, id, idField, kind } = pending;
        setIsDeleting(true);
        showToast('جاري الحذف...', 'loading');
        try {
            if (kind === 'orphan') {
                await deleteItem(table, id);
                showToast('تم حذف العنصر اليتيم وإصلاح قاعدة البيانات بنجاح', 'success');
                return;
            }
            if (kind === 'orphanAll') {
                if (integrityIssues) {
                    for (const item of integrityIssues.brokenEngagements) {
                        await deleteItem('T_ENGAGEMENT', item.id_engagement);
                    }
                }
                showToast('تم حذف الالتزامات اليتامى بنجاح واستعادة سلامة البيانات', 'success');
                return;
            }

            if (table === 'T_LOT_PIECE' && id) {
                const lp = db.T_LOT_PIECE.find(l => l.ID_LOT_PIECE === id);
                if (lp) {
                    const lotId = lp.ID_LOT;
                    await deleteItem(table, id);
                    const remainingLinks = db.T_LOT_PIECE.filter(l => l.ID_LOT === lotId && l.ID_LOT_PIECE !== id);
                    if (remainingLinks.length === 0) {
                        const lot = db.T_LOT_OPERATION.find(l => l.ID_LOT === lotId);
                        if (lot) {
                            await updateItem('T_LOT_OPERATION', lot.ID_LOT, { ...lot, ATTRIBUER: false });
                        }
                    }
                } else {
                    await deleteItem(table, id);
                }
            } else {
                await deleteItem(table, id);
            }
            showToast('تم الحذف بنجاح', 'success');
            if (idField === 'ID_PIECE') setSelectedPiece(null);
        } catch (error) {
            console.error("Delete failed", error);
            showToast(`حدث خطأ أثناء الحذف — السبب: ${errorMessage(error)}`, 'error');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleCleanOrphanedItem = async (table: keyof Database, id: number) => {
        if (isViewer || isDeleting) return;
        setPendingDelete({
            table, id, idField: '', kind: 'orphan',
            message: 'هل أنت متأكد من رغبتك في حذف هذا العنصر اليتيم لإصلاح السلامة المرجعية للداتابيز؟'
        });
    };

    const handleCleanAllOrphanedEngagements = async () => {
        if (!integrityIssues || isViewer || isDeleting) return;
        const count = integrityIssues.brokenEngagements.length;
        setPendingDelete({
            table: 'T_ENGAGEMENT', id: 0, idField: '', kind: 'orphanAll',
            message: `هل أنت متأكد من رغبتك في حذف جميع الالتزامات اليتامى (${count}) لإعادة السلامة المرجعية؟`
        });
    };
    
    const allLotsForOperation = useMemo(() => {
        if (!selectedPiece) return [];
        return db.T_LOT_OPERATION.filter(lot => lot.ID_OPERATION === selectedPiece.ID_OPERATION);
    }, [selectedPiece, db.T_LOT_OPERATION]);

    const alreadyAssociatedLotIds = useMemo(() => {
        return db.T_LOT_PIECE.map(lp => lp.ID_LOT);
    }, [db.T_LOT_PIECE]);

    const handleSelectPiece = useCallback((piece: Piece) => {
        setSelectedPiece(piece);
        setHighlightId(null);
    }, []);

    const selectedPieceDetails = useMemo(() => {
        if (!selectedPiece) return null;

        const isContract = ['صفقة', 'اتفاقية'].includes(selectedPiece.NAT_PIECE);
        const isAmendment = selectedPiece.NAT_PIECE === 'ملحق';
        const isTermination = selectedPiece.NAT_PIECE === 'قرار فسخ';
        const isWorkSituation = ['وضعية الأشغال', 'وضعية التسبيق الجزافي', 'وضعية التسبيق على التموين', 'فاتورة','حكم قضائي'].includes(selectedPiece.NAT_PIECE);
        
        let amendmentLabel = '';
        if (isAmendment) {
            if (selectedPiece.MONTANT_PIECE > 0) amendmentLabel = 'ملحق بالزيادة';
            else if (selectedPiece.MONTANT_PIECE < 0) amendmentLabel = 'ملحق بالنقصان';
            else amendmentLabel = 'ملحق بدون تأثير مالي';
        }
        
        // Final relevant ID for aggregations (use parent if amendment, termination, or work situation)
        const basePieceId = (isAmendment || isWorkSituation || isTermination) && selectedPiece.ID_PIECE_INIT 
            ? selectedPiece.ID_PIECE_INIT 
            : selectedPiece.ID_PIECE;

        const basePiece = db.T_PIECE.find(p => p.ID_PIECE === basePieceId);

        // Find engagement for Financial Controller visa
        const engagement = db.T_ENGAGEMENT.find(e => e.ID_PIECE === selectedPiece.ID_PIECE);

        // Find payment for invoice/work situation
        const paiement = db.T_PAIEMENT.find(p => p.ID_PIECE === selectedPiece.ID_PIECE);
        
        // Find all linked pieces (main contract + all its children/amendments/situations)
        const linkedPieceIds = db.T_PIECE
            .filter(p => p.ID_PIECE === basePieceId || p.ID_PIECE_INIT === basePieceId)
            .map(p => p.ID_PIECE);

        // Calculate totals based strictly on registered Engagements and Payments as requested
        const relatedEngagements = db.T_ENGAGEMENT.filter(e => linkedPieceIds.includes(e.ID_PIECE));
        const newTotalAmount = relatedEngagements.reduce((sum, e) => {
            let amt = e.MONTANT_ENG;
            if (['إلغاء', 'إنخفاض التقييم'].includes(e.NATURE_ENG)) amt = -amt;
            return sum + amt;
        }, 0);

        const relatedPayments = db.T_PAIEMENT.filter(p => linkedPieceIds.includes(p.ID_PIECE));
        const totalPaid = relatedPayments.reduce((sum, p) => sum + p.MONTANT_PAI, 0);

        // Delay penalty from all related payments
        const delayPenalty = relatedPayments.reduce((sum, p) => sum + (p.PENALITE_RETARD || 0), 0);

        // Counts for informational chips
        const amendmentsCount = db.T_PIECE.filter(p => p.ID_PIECE_INIT === basePieceId && p.NAT_PIECE === 'ملحق').length;
        const workSituationsCount = db.T_PIECE.filter(p => p.ID_PIECE_INIT === basePieceId && ['وضعية الأشغال', 'وضعية التسبيق الجزافي', 'وضعية التسبيق على التموين', 'فاتورة', 'حكم قضائي'].includes(p.NAT_PIECE)).length;

        const unregisteredRelatedCount = db.T_PIECE.filter(p => {
            if (p.ID_PIECE_INIT !== basePieceId) return false;
            const isCommitmentType = ['صفقة', 'اتفاقية', 'ملحق', 'فاتورة', 'مقرر', 'قرار','حكم قضائي'].includes(p.NAT_PIECE);
            const isPaymentType = ['وضعية الأشغال', 'فاتورة', 'قرار', 'وضعية التسبيق الجزافي', 'وضعية التسبيق على التموين','حكم قضائي'].includes(p.NAT_PIECE);
            const isUncommitted = isCommitmentType && !p.SAI_ENG;
            let isUnpaid = false;
            if (isPaymentType) {
                if (p.NAT_PIECE === 'وضعية الأشغال') {
                    isUnpaid = !p.SAI_ENG && !p.SAI_PAI;
                } else {
                    isUnpaid = !p.SAI_PAI;
                }
            }
            return isUncommitted || isUnpaid;
        }).length;

        const terminationPiece = db.T_PIECE.find(p => p.ID_PIECE_INIT === basePieceId && p.NAT_PIECE === 'قرار فسخ');
        const terminationAmount = terminationPiece?.MONTANT_PIECE || 0;

        let remainingAmount = newTotalAmount - totalPaid;
        if (Math.abs(remainingAmount) < 0.005) {
            remainingAmount = 0;
        }
        
        const progressPercent = newTotalAmount > 0 ? (totalPaid / newTotalAmount) * 100 : 0;

        const unregisteredPaymentsAmount = db.T_PIECE
            .filter(p => p.ID_PIECE === basePieceId || p.ID_PIECE_INIT === basePieceId)
            .filter(p => {
                const isPaymentType = ['وضعية الأشغال', 'فاتورة', 'قرار', 'حكم قضائي', 'وضعية التسبيق الجزافي', 'وضعية التسبيق على التموين'].includes(p.NAT_PIECE);
                if (!isPaymentType) return false;
                if (p.NAT_PIECE === 'قرار' && p.PIECE?.includes('فسخ')) return false;
                if (p.NAT_PIECE.includes('فسخ')) return false;
                
                if (p.NAT_PIECE === 'فاتورة') {
                    return !p.SAI_PAI;
                      
                } else if (p.NAT_PIECE === 'حكم قضائي') {
                    return !p.SAI_PAI;   

                } else if (p.NAT_PIECE === 'وضعية الأشغال') {
                    return !p.SAI_ENG && !p.SAI_PAI;
                } else {
                    return !p.SAI_PAI;
                }
            })
            .reduce((sum, p) => sum + (p.MONTANT_PIECE || 0), 0);

        const beneficiaire = selectedPiece.ID_BENEFICIAIRE 
            ? db.T_BENEFICIAIRE.find(b => b.ID_BENEFICIAIRE === selectedPiece.ID_BENEFICIAIRE) 
            : null;
        
        const compte = selectedPiece.ID_COMPTE 
            ? db.T_COMPTE_BANCAIRE.find(c => c.ID_COMPTE === selectedPiece.ID_COMPTE) 
            : null;

        return {
            isContract,
            isAmendment,
            amendmentLabel,
            basePiece,
            engagement,
            paiement,
            beneficiaire,
            compte,
            amendmentsCount,
            terminationAmount,
            workSituationsCount,
            unregisteredRelatedCount,
            totalPaid,
            delayPenalty,
            newTotalAmount,
            remainingAmount,
            progressPercent,
            unregisteredPaymentsAmount
        };
    }, [selectedPiece, db]);

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleExport = async () => {
        if (flattenedRows.length === 0) {
            alert('لا توجد بيانات للتصدير.');
            return;
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('الوثائق');
        worksheet.views = [{ rightToLeft: true }];

        // Define columns
        worksheet.columns = [
            { header: '#', key: 'index', width: 6 },
            { header: t('col.document'), key: 'document', width: 45 },
            { header: 'الطبيعة', key: 'nature', width: 18 },
            { header: 'الحالة', key: 'status', width: 15 },
            { header: 'تفصيل الهيكلة', key: 'structure', width: 25 },
            { header: t('col.beneficiary'), key: 'beneficiary', width: 35 },
            { header: t('col.amount'), key: 'amount', width: 22 }
        ];

        // Format and style headers (Row 1)
        const headerRow = worksheet.getRow(1);
        headerRow.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.height = 25;
        headerRow.eachCell((cell) => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF0B72AA' } // Brand blue / sky-700 equivalent
            };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                bottom: { style: 'medium', color: { argb: 'FF000000' } },
                left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
            };
        });

        // Loop through flattenedRows to build the Excel content
        for (const row of flattenedRows) {
            if (row.type === 'operation') {
                const opt = row.data;
                const opText = `العملية: ${opt?.N_OPERATION} - ${opt?.INT_OPERATION}`;
                const addedRow = worksheet.addRow({ index: opText });
                
                // Merge columns A to G (1 to 7) for operation title
                worksheet.mergeCells(addedRow.number, 1, addedRow.number, 7);
                
                addedRow.height = 24;
                const cell = addedRow.getCell(1);
                cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF0F172A' } };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFEBF5FF' } // very light blue bg (blue-50)
                };
                cell.alignment = { horizontal: 'right', vertical: 'middle' };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
                };
            } else if (row.type === 'totals') {
                const { totalCommitment, totalPayment } = row.data;
                const totalText = `مجموع الالتزام = ${formatCurrencyForExcel(totalCommitment)} دج    |    مجموع الدفع = ${formatCurrencyForExcel(totalPayment)} دج`;
                const addedRow = worksheet.addRow({ index: totalText });
                
                // Merge columns A to G
                worksheet.mergeCells(addedRow.number, 1, addedRow.number, 7);
                
                addedRow.height = 22;
                const cell = addedRow.getCell(1);
                cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E293B' } };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF1F5F9' } // gray-100 equivalent
                };
                cell.alignment = { horizontal: 'right', vertical: 'middle' };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
                };
            } else {
                const piece = row.data;
                const prefix = row.isChild ? '   ↳ ' : '';
                const pieceName = prefix + piece.PIECE;

                // Handle status text
                const statusArr: string[] = [];
                if (piece.hasEngagement) statusArr.push('ملتزم');
                if (piece.hasPaiement) statusArr.push('مسدد');
                const statusText = statusArr.join(' / ');
                
                const natureText = piece.isContextOnly ? `${piece.NAT_PIECE} (مرجع)` : piece.NAT_PIECE;

                const addedRow = worksheet.addRow({
                    index: row.index! + 1,
                    document: pieceName,
                    nature: natureText,
                    status: statusText,
                    structure: piece.rubricName || '---',
                    beneficiary: piece.beneficiaryName || '---',
                    amount: piece.MONTANT_PIECE
                });

                addedRow.height = 20;

                // Loop cells to apply cell styling/formatting
                addedRow.eachCell((cell, colNumber) => {
                    cell.font = { name: 'Arial', size: 9 };
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFF1F5F9' } },
                        bottom: { style: 'thin', color: { argb: 'FFF1F5F9' } },
                        left: { style: 'thin', color: { argb: 'FFF1F5F9' } },
                        right: { style: 'thin', color: { argb: 'FFF1F5F9' } }
                    };

                    // Alignment by column
                    if (colNumber === 1) { // Index
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                        cell.font = { name: 'Arial', size: 8, color: { argb: 'FF94A3B8' } };
                    } else if (colNumber === 2) { // Document
                        cell.alignment = { horizontal: 'right', vertical: 'middle' };
                        if (row.isChild) {
                            cell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF475569' } };
                        }
                    } else if (colNumber === 3) { // Nature
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                        if (piece.NAT_PIECE === 'صفقة' || piece.NAT_PIECE === 'اتفاقية' || piece.NAT_PIECE === 'ملحق') {
                            cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF2563EB' } }; // Blue-600
                        } else if (piece.NAT_PIECE === 'وضعية الأشغال' || piece.NAT_PIECE === 'فاتورة') {
                            cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF16A34A' } }; // Green-600
                        }
                    } else if (colNumber === 4) { // Status
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                        cell.font = { name: 'Arial', size: 8, bold: true };
                        if (piece.hasEngagement && piece.hasPaiement) { cell.font.color = { argb: 'FF0D9488' }; } // Teal
                        else if (piece.hasEngagement) { cell.font.color = { argb: 'FF2563EB' }; } // Blue
                        else if (piece.hasPaiement) { cell.font.color = { argb: 'FF16A34A' }; } // Green
                    } else if (colNumber === 5) { // Structure
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    } else if (colNumber === 6) { // Beneficiary
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    } else if (colNumber === 7) { // Amount
                        cell.alignment = { horizontal: 'right', vertical: 'middle' };
                        cell.numFmt = '#,##0.00';
                        cell.font = { name: 'Arial', size: 9, bold: true };
                    }
                });
            }
        }

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `جدول_الوثائق_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                showToast('جاري استيراد البيانات...', 'loading');
                const buffer = e.target?.result as ArrayBuffer;
                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.load(buffer);
                
                const worksheet = workbook.getWorksheet(1);
                if (!worksheet) {
                    showToast("الملف فارغ أو بصيغة غير صحيحة", 'error');
                    return;
                }

                const json: any[] = [];
                const headers: string[] = [];
                
                worksheet.getRow(1).eachCell((cell, colNumber) => {
                    headers[colNumber] = String(cell.value || '');
                });

                worksheet.eachRow((row, rowNumber) => {
                    if (rowNumber === 1) return;
                    const rowData: any = {};
                    row.eachCell((cell, colNumber) => {
                        const header = headers[colNumber];
                        if (header) {
                            rowData[header] = cell.value;
                        }
                    });
                    json.push(rowData);
                });

                if (json.length === 0) {
                    showToast("الملف فارغ أو بصيغة غير صحيحة", 'error');
                    return;
                }

                let successCount = 0;
                let skippedCount = 0;
                let errorCount = 0;
                const errors: string[] = [];
                const skipped: string[] = [];
                
                // Track pieces created during THIS loop to allow referencing them immediately
                const createdPiecesInBatch: Piece[] = [];

                await runInTransaction(async () => {
                    for (const [index, row] of (json as any[]).entries()) {
                        try {
                            const n_operation = row['رقم العملية']?.trim();
                            const piece_text = row['موضوع الوثيقة']?.trim();
                            const nat_piece = row['طبيعة الوثيقة']?.trim();
                            const linked_piece_name = row['الوثيقة المرتبط بها']?.trim();
                            const montant_str = String(row['المبلغ'] || '0').replace(',', '.');
                            const montant = parseFloat(montant_str);

                            if (!n_operation || !piece_text || !nat_piece || isNaN(montant)) {
                                errors.push(`السطر ${index + 2}: الحقول الأساسية (رقم العملية، موضوع، طبيعة، مبلغ) مفقودة أو غير صالحة.`);
                                errorCount++; continue;
                            }

                            const operation = db.T_OPERATION.find(op => op.N_OPERATION === n_operation);
                            if (!operation) {
                                errors.push(`السطر ${index + 2}: لم يتم العثور على العملية بالرقم '${n_operation}'.`);
                                errorCount++; continue;
                            }
                            
                            if (operation.CREATED_BY !== currentUser.ID_USER && currentUser.ROLE !== 'admin') {
                                errors.push(`السطر ${index + 2}: ليس لديك صلاحية إضافة وثائق للعملية '${n_operation}'.`);
                                errorCount++; continue;
                            }

                            const id_operation = operation.ID_OPERATION;

                            // 1. Resolve id_piece_init FIRST to enable more granular duplicate checking
                            let id_piece_init: number | null = null;
                            if (linked_piece_name) {
                                // Search in current DB
                                let parentPiece = db.T_PIECE.find(p => p.ID_OPERATION === id_operation && p.PIECE.trim().toLowerCase() === linked_piece_name.toLowerCase());
                                
                                // Search in pieces added in THIS loop (important if contract and addendum are in same file)
                                if (!parentPiece) {
                                    parentPiece = createdPiecesInBatch.find(p => p.ID_OPERATION === id_operation && p.PIECE.trim().toLowerCase() === linked_piece_name.toLowerCase());
                                }

                                if (parentPiece) {
                                    id_piece_init = parentPiece.ID_PIECE;
                                }
                            }

                            // 2. Perform duplicate check scoped to (Operation + Text + Parent Link)
                            // This allows same text "وضعية أشغال 01" for different contracts in same operation
                            const checkDuplicate = (p: Piece) => 
                                p.ID_OPERATION === id_operation && 
                                p.PIECE.trim().toLowerCase() === piece_text.toLowerCase() &&
                                p.ID_PIECE_INIT === id_piece_init;

                            const existingInDB = db.T_PIECE.find(checkDuplicate);
                            const existingInBatch = createdPiecesInBatch.find(checkDuplicate);
                            
                            if (existingInDB || existingInBatch) {
                                skipped.push(`السطر ${index + 2}: الوثيقة "${piece_text}" موجودة بالفعل لهذا الارتباط. تم تخطيها.`);
                                skippedCount++; continue;
                            }

                            let id_beneficiaire: number | null = null;
                            let id_compte: number | null = null;
                            if (row['المستفيد'] && nat_piece !== 'مقرر') {
                                const beneficiaire = db.T_BENEFICIAIRE.find(b => b.BENEFICIAIRE.trim().toLowerCase() === String(row['المستفيد']).trim().toLowerCase());
                                if (!beneficiaire) {
                                    errors.push(`السطر ${index + 2}: لم يتم العثور على المستفيد '${row['المستفيد']}'.`);
                                    errorCount++; continue;
                                }
                                id_beneficiaire = beneficiaire.ID_BENEFICIAIRE;

                                if (row['رقم الحساب']) {
                                    const compte = db.T_COMPTE_BANCAIRE.find(acc => acc.ID_BENEFICIAIRE === id_beneficiaire && acc.RIB === String(row['رقم الحساب']).trim());
                                    if (!compte) {
                                        errors.push(`السطر ${index + 2}: لم يتم العثور على الحساب البنكي '${row['رقم الحساب']}' للمستفيد.`);
                                        errorCount++; continue;
                                    }
                                    id_compte = compte.ID_COMPTE;
                                } else if (db.T_COMPTE_BANCAIRE.some(acc => acc.ID_BENEFICIAIRE === id_beneficiaire)) {
                                    errors.push(`السطر ${index + 2}: رقم الحساب مطلوب للمستفيد '${beneficiaire.BENEFICIAIRE}'.`);
                                    errorCount++; continue;
                                }
                            }
                            
                            let id_scat: number | null = null;
                            if (row['رمز الصنف الفرعي']) {
                                const scategorie = db.T_SCATEGORIE.find(sc => sc.C_SCATEGORIE === String(row['رمز الصنف الفرعي']).trim());
                                if (!scategorie) {
                                    errors.push(`السطر ${index + 2}: لم يتم العثور على الصنف الفرعي بالرمز '${row['رمز الصنف الفرعي']}'.`);
                                    errorCount++; continue;
                                }
                                id_scat = scategorie.ID_SCATEGORIE;
                            } else {
                                errors.push(`السطر ${index + 2}: رمز الصنف الفرعي مطلوب.`);
                                errorCount++; continue;
                            }
                            
                            let id_rubrique: number | null = null;
                            if (row['تفصيل الهيكلة']) {
                                const rubrique = db.T_RUBRIQUE.find(r => r.RUBRIQUE === row['تفصيل الهيكلة'].trim());
                                if (!rubrique) {
                                    errors.push(`السطر ${index + 2}: لم يتم العثور على هيكل الكلفة '${row['تفصيل الهيكلة']}'.`);
                                    errorCount++; continue;
                                }
                                id_rubrique = rubrique.ID_RUBRIQUE;
                            }
                            
                            let saiEng = false, saiPai = false;
                            const engTypes = ["مقرر", "اتفاقية", "صفقة", "ملحق", "فاتورة", "قرار",'حكم قضائي'];
                            const paiTypes = ["وضعية الأشغال","وضعية التسبيق الجزافي", "وضعية التسبيق على التموين"];
                            if (engTypes.includes(nat_piece)) saiEng = true;
                            else if (paiTypes.includes(nat_piece)) saiPai = true;

                            const newPiece = await addItem('T_PIECE', {
                                NAT_PIECE: nat_piece, ID_OPERATION: id_operation, PIECE: piece_text,
                                ID_BENEFICIAIRE: id_beneficiaire, ID_COMPTE: id_compte, MONTANT_PIECE: montant,
                                ID_SCATEGORIE: id_scat, ID_RUBRIQUE: id_rubrique,
                                DELAI_EX_JOURS: row['مدة الإنجاز (بالأيام)'] || null,
                                ID_PIECE_INIT: id_piece_init, N_VISA_CM: null, DATE_VISA_CM: null,
                                SAI_ENG: saiEng, SAI_PAI: saiPai
                            });
                            
                            if (newPiece) {
                                createdPiecesInBatch.push(newPiece);
                                successCount++;
                            }

                        } catch (innerError) {
                            console.error("Error processing row:", row, innerError);
                            errors.push(`السطر ${index + 2}: خطأ غير متوقع أثناء المعالجة.`);
                            errorCount++;
                        }
                    }
                });

                let summaryMessage = `اكتمل الاستيراد.\n\n- تمت إضافة ${successCount} وثائق بنجاح.\n- تم تخطي ${skippedCount} وثائق لأنها موجودة بالفعل.\n- فشلت معالجة ${errorCount} من السجلات.`;
                const details = [...skipped, ...errors];
                if (details.length > 0) {
                    summaryMessage += "\n\nالتفاصيل:\n" + details.slice(0, 10).join('\n');
                    if (details.length > 10) summaryMessage += `\n... و ${details.length - 10} ملاحظات أخرى.`
                }
                
                if (successCount > 0) showToast(`تم استيراد ${successCount} وثائق`, 'success');
                else if (errorCount > 0) showToast('فشل الاستيراد، راجع التفاصيل', 'error');

                alert(summaryMessage);

            } catch {
                alert('فشل استيراد البيانات. يرجى التحقق من أن الملف بصيغة Excel صحيحة وأن الأعمدة مطابقة للنموذج المطلوب.');
            } finally {
                if (event.target) event.target.value = '';
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleDownloadDocumentTemplate = async () => {
        const headers = [
            'رقم العملية', 
            'موضوع الوثيقة', 
            'طبيعة الوثيقة', 
            'المبلغ', 
            'المستفيد', 
            'رقم الحساب', 
            'رمز الصنف الفرعي', 
            'تفصيل الهيكلة', 
            'مدة الإنجاز (بالأيام)',
            'الوثيقة المرتبط بها'
        ];
        
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Template');
        worksheet.addRow(headers);
        
        // Style headers
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).alignment = { horizontal: 'center' };
        worksheet.views = [{ rightToLeft: true }]; // Arabic friendly

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "نموذج_استيراد_الوثائق.xlsx";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleNavigateToDoc = useCallback((type: 'ENG' | 'PAI', p: any) => {
        if (type === 'ENG') {
            const engId = db.T_ENGAGEMENT.find(eng => eng.ID_PIECE === p.ID_PIECE)?.ID_ENGAGEMENT;
            if (engId) navigate('OPERATION_DETAILS', p.ID_OPERATION, `ENGAGEMENTS:${engId}:blue`);
        } else {
            const paiId = db.T_PAIEMENT.find(pai => pai.ID_PIECE === p.ID_PIECE)?.ID_PAIEMENT;
            if (paiId) navigate('OPERATION_DETAILS', p.ID_OPERATION, `PAIEMENTS:${paiId}:blue`);
        }
    }, [db.T_ENGAGEMENT, db.T_PAIEMENT, navigate]);

    const handleActionOnDoc = useCallback((type: 'ENG' | 'PAI', id: number) => {
        setModalState({ type: type === 'ENG' ? 'ENGAGEMENT' : 'PAIEMENT', data: { defaultPieceId: id }, timestamp: Date.now() });
    }, []);

    const handleNavigateBeneficiary = useCallback((id: number) => navigate('BENEFICIARIES', id), [navigate]);
    const handleNavigateStructure = useCallback((rubricId: number, pieceOpId?: number) => {
        const opId = pieceOpId || (selectedPiece ? selectedPiece.ID_OPERATION : 0);
        if (!opId) return;
       
        navigate('FINANCIAL_STATUS_BY_STRUCTURE', opId, String(rubricId));
    }, [navigate, selectedPiece]);

    if (loading) return <div className="p-8 text-center">{t('loading')}</div>;

    return (
        <PageWrapper title={t('page.documents')} navigate={navigate} onGoBack={onGoBack} currentUser={currentUser} breadcrumb={[]} actions={
            <div className="flex items-center gap-2">
                 <button onClick={handleDownloadDocumentTemplate} className="bg-gray-100 text-gray-600 px-2 py-0.5 border border-gray-200 rounded-[20px] shadow.md hover:bg-gray-300 transition-colors text-xs">
                    <i className="bi bi-file-earmark-arrow-down mr-1"></i> نموذج
                 </button>
                 {!isViewer && (
                    <button onClick={handleImportClick} className="bg-purple-100 text-purple-600 px-2 py-0.5 border border-purple-200 rounded-[20px] shadow.md hover:bg-purple-300 transition-colors text-xs">
                        <i className="bi bi-file-earmark-excel mr-1"></i> {t('btn.import_excel')}
                    </button>
                 )}
                  <button onClick={handleExport} className="bg-teal-100 text-teal-600 px-2 py-0.5 border border-teal-200 rounded-[20px] shadow.md hover:bg-teal-300 transition-colors text-xs">
                    <i className="bi bi-file-earmark-excel mr-1"></i> {t('btn.export_excel')}
                 </button>
                 {!isViewer && (
                    <>
                        <div className="h-5 w-px bg-gray-200 mx-1 self-center"></div>
                        <button onClick={() => { if(loading) { alert("يجب الانتظار حتى يتم تحديث النافذة"); return; } setModalState({ type: 'DOCUMENT', timestamp: Date.now() }); }} className="bg-green-100 text-green-600 px-2 py-0.5 border border-green-200 rounded-[20px] shadow.md  hover:bg-green-200 transition-colors text-xs">
                            <i className="bi bi-plus-circle mr-1"></i> {t('btn.add_document')}
                        </button>
                        <button 
                            onClick={() => {
                                if(loading) { alert("يجب الانتظار حتى يتم تحديث النافذة"); return; }
                                if(selectedPiece && checkPermission(selectedPiece.ID_OPERATION)) {
                                    setModalState({ type: 'DOCUMENT', data: selectedPiece, timestamp: Date.now() });
                                } else {
                                    alert('ليس لديك صلاحية التعديل.');
                                }
                            }} 
                            disabled={selectedPiece === null} 
                            className="bg-yellow-100 text-yellow-600 px-2 py-0.5 border border-yellow-200 rounded-[20px] hover:bg-yellow-200 transition-colors disabled:bg-gray-400 text-xs"
                        >
                            <i className="bi bi-pencil-fill mr-1"></i> {t('btn.edit')}
                        </button>
                        <button onClick={() => handleDelete('T_PIECE', selectedPiece?.ID_PIECE ?? null, 'ID_PIECE')} disabled={selectedPiece === null || isDeleting} className="bg-red-100 text-red-600 px-2 py-0.5 border border-red-200 rounded-[20px] shadow.md hover:bg-red-200 transition-colors disabled:bg-gray-400 text-xs">
                            <i className="bi bi-trash-fill mr-1"></i> {t('btn.delete')}
                        </button>
                    </>
                 )}
            </div>
        }>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls" />
            
            {connectionError && (
                <div className="bg-red-50 border-r-4 border-red-500 p-3 mb-3 rounded shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
                    <div className="flex items-center gap-2 col-span-1">
                        <i className="bi bi-exclamation-triangle-fill text-red-500 text-lg"></i>
                        <div className="text-right">
                            <p className="font-bold text-red-800">فشل الاتصال بـ Supabase: تأكّد من اتصال الإنترنت أو إعدادات قاعدة البيانات</p>
                            <p className="text-red-600 mt-0.5">{connectionError}</p>
                        </div>
                    </div>
                    <button 
                        onClick={handleRetry}
                        disabled={isRetrying}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-1.5 rounded-[20px] shadow transition-colors flex items-center gap-1.5 cursor-pointer disabled:bg-gray-400"
                    >
                        <i className={`bi bi-arrow-clockwise ${isRetrying ? "animate-spin" : ""}`}></i>
                        <span>إعادة المحاولة (Retry)</span>
                    </button>
                </div>
            )}

            {integrityIssues && (integrityIssues.brokenPieces.length > 0 || integrityIssues.brokenEngagements.length > 0 || integrityIssues.brokenPaiements.length > 0) && (
                <div id="integrity-warning-banner" className="bg-amber-50 border border-amber-300 p-4 mb-3 rounded-lg shadow-md text-xs">
                    <div className="flex items-start gap-3">
                        <i className="bi bi-exclamation-octagon-fill text-amber-600 text-2xl mt-0.5 animate-pulse"></i>
                        <div className="text-right flex-1">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-200 pb-2 mb-2">
                                <span className="font-bold text-amber-900 text-sm">تنبيه بالسلامة المرجعية (Foreign Key Broken): تم كشف علاقات مكسورة بالبيانات</span>
                                {integrityIssues.brokenEngagements.length > 0 && (
                                    <button
                                        onClick={handleCleanAllOrphanedEngagements}
                                        disabled={isDeleting}
                                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-3 py-1 pb-1.5 rounded-[20px] shadow transition-colors text-xs flex items-center gap-1 cursor-pointer disabled:bg-gray-400"
                                    >
                                        <i className="bi bi-trash-fill"></i>
                                        <span>حذف كافة الالتزامات اليتامى ({integrityIssues.brokenEngagements.length}) دفعة واحدة</span>
                                    </button>
                                )}
                            </div>
                            
                            <div className="text-amber-800 space-y-2 leading-relaxed">
                                {integrityIssues.brokenPieces.length > 0 && (
                                    <div>
                                        <p className="font-bold mb-1">🛡️ الوثائق اليتامى (ترتبط بعملية/صنف غير موجود): <strong>{integrityIssues.brokenPieces.length}</strong></p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                                            {integrityIssues.brokenPieces.map(bPiece => (
                                                <div key={bPiece.id_piece} className="flex items-center justify-between gap-3 bg-white p-2 rounded border border-amber-200 text-xs shadow-sm">
                                                    <span>وثيقة: <strong className="text-amber-950">{bPiece.piece.PIECE || '---'}</strong> - معرّف العملية المفقود: {bPiece.id_operation}</span>
                                                    <button 
                                                        onClick={() => handleCleanOrphanedItem('T_PIECE', bPiece.id_piece)}
                                                        disabled={isDeleting}
                                                        className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 font-bold py-1 px-2 rounded-full text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
                                                    >
                                                        <i className="bi bi-trash-fill"></i>
                                                        <span>حذف وإصلاح</span>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                
                                {integrityIssues.brokenEngagements.length > 0 && (
                                    <div className="mt-3">
                                        <p className="font-bold mb-1">💼 الالتزامات اليتامى (ترتبط بوثيقة غير موجودة): <strong>{integrityIssues.brokenEngagements.length}</strong></p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                                            {integrityIssues.brokenEngagements.map(bEng => (
                                                <div key={bEng.id_engagement} className="flex items-center justify-between gap-3 bg-white p-2 rounded border border-amber-200 text-xs shadow-sm">
                                                    <span>التزام رقم: <strong className="text-amber-950">{bEng.engagement.N_ENG || '---'}</strong> - معرّف الوثيقة المفقود (ID_PIECE): {bEng.id_piece}</span>
                                                    <button 
                                                        onClick={() => handleCleanOrphanedItem('T_ENGAGEMENT', bEng.id_engagement)}
                                                        disabled={isDeleting}
                                                        className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 font-bold py-1 px-2 rounded-full text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
                                                    >
                                                        <i className="bi bi-trash-fill"></i>
                                                        <span>حذف وإصلاح</span>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                
                                {integrityIssues.brokenPaiements.length > 0 && (
                                    <div className="mt-3">
                                        <p className="font-bold mb-1">💸 الدفوعات اليتامى (ترتبط بوثيقة/عملية غير موجودة): <strong>{integrityIssues.brokenPaiements.length}</strong></p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                                            {integrityIssues.brokenPaiements.map(bPay => (
                                                <div key={bPay.id_paiement} className="flex items-center justify-between gap-3 bg-white p-2 rounded border border-amber-200 text-xs shadow-sm">
                                                    <span>دفع رقم: <strong className="text-amber-950">{bPay.paiement.N_PAI || '---'}</strong> - معرّف الوثيقة المفقود (ID_PIECE): {bPay.id_piece}</span>
                                                    <button 
                                                        onClick={() => handleCleanOrphanedItem('T_PAIEMENT', bPay.id_paiement)}
                                                        disabled={isDeleting}
                                                        className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 font-bold py-1 px-2 rounded-full text-[10px] flex items-center gap-1 transition-colors cursor-pointer"
                                                    >
                                                        <i className="bi bi-trash-fill"></i>
                                                        <span>حذف وإصلاح</span>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-blue-200 p-2 rounded-lg shadow-md mb-2 border border-blue-300">
                <div className="flex flex-col xl:flex-row gap-4">
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-4 items-end">
                        <div className="col-span-6 text-xs text-center">
                            <label className="flex items-center text-xs text-center font-bold text-gray-700 mb-1">
                                {t('filter.operation')} 
                            </label>
                            <CustomDropdown
                                options={[{ value: '', label: t('filter.all_operations') }, ...operationOptions]}
                                value={selectedOperationId}
                                onChange={(val) => { setSelectedOperationId(val); setSelectedPiece(null); setSelectedStructureDetail(''); }}
                                placeholder={t('filter.select_operation')}
                            />
                        </div>
                    </div>
                    <div className="flex-none flex items-center justify-between xl:justify-end gap-4 min-w-[120px]">
                         <div className="bg-white rounded-[20px] shadow-sm border border-blue-300 flex flex-col items-center w-11 sm:w-auto min-w-[100px] px-2 h-9 justify-center">
                            <span className="text-[8px] text-gray-500 font-bold whitespace-nowrap">عدد الوثائق</span>
                            <span className="text-xs font-black text-blue-700">{displayPieces.length}</span>
                         </div>
                         {selectedOperationId && remainingCPForSelectedOp !== null && (
                            <div className="bg-white rounded-[20px] shadow-sm border border-blue-300 flex flex-col items-center w-11 sm:w-auto min-w-[120px] px-2 h-9 justify-center">
                                <span className="text-[8px] text-gray-500 font-bold whitespace-nowrap">الإعتمادات المتبقية (CP)</span>
                                <span className="text-[10px] font-black text-green-700">{formatCurrency(remainingCPForSelectedOp)}</span>
                            </div>
                         )}
                         {selectedOperationId && remainingAEForSelectedOp !== null && (
                            <div className="bg-white rounded-[20px] shadow-sm border border-blue-300 flex flex-col items-center w-11 sm:w-auto min-w-[120px] px-2 h-9 justify-center">
                                <span className="text-[8px] text-gray-500 font-bold whitespace-nowrap">رخصة AE المتبقية</span>
                                <span className="text-[10px] font-black text-indigo-700">{formatCurrency(remainingAEForSelectedOp)}</span>
                            </div>
                         )}
                    </div>
                </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 space-y-4">
                    <div className="bg-white p-3 rounded-lg shadow-md">
                        <div className="overflow-auto max-h-[calc(100vh-16rem)]">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-sky-100 sticky top-0 z-10 border-b shadow-sm">
                                    <tr>
                                        <th className="p-1 text-center text-[8px] font-bold text-gray-500 uppercase tracking-wider w-8">#</th>
                                        <th className="p-1 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                            <SearchHeader 
                                                title={t('col.document')}
                                                isActive={!!searchPieceName}
                                                tooltip="بحث بالاسم"
                                            >
                                                <div className="relative">
                                                     <input
                                                        type="text"
                                                        className="w-full h-5 px-1 bg-white border border-blue-200 rounded text-[8px] font-medium normal-case outline-none"
                                                        value={searchPieceName}
                                                        onChange={(e) => setSearchPieceName(e.target.value)}
                                                        autoFocus
                                                        placeholder="..."
                                                    />
                                                    {searchPieceName && (
                                                        <button onClick={() => setSearchPieceName('')} className="absolute left-0.5 top-0.5 text-gray-400 hover:text-red-500">
                                                            <X size={8} />
                                                        </button>
                                                    )}
                                                </div>
                                            </SearchHeader>
                                        </th>
                                        <th className="p-1 text-center text-[9px] font-bold text-gray-500 uppercase tracking-wider">
                                            <SearchHeader 
                                                title="الطبيعة"
                                                isActive={!!selectedPieceType}
                                                tooltip="تصفية الطبيعة"
                                            >
                                                <div className="relative">
                                                    <select
                                                        className="w-full h-5 px-1 bg-white border border-blue-200 rounded text-[8px] font-bold outline-none"
                                                        value={selectedPieceType}
                                                        onChange={(e) => setSelectedPieceType(e.target.value)}
                                                    >
                                                        <option value="">الكل</option>
                                                        {uniquePieceTypes.map(type => (
                                                            <option key={type} value={type}>{type}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </SearchHeader>
                                        </th>
                                        <th className="p-1 text-center text-[9px] font-bold text-gray-500 uppercase tracking-wider w-24">
                                            <SearchHeader 
                                                title="الحالة"
                                                isActive={!!selectedSaiEng || !!selectedSaiPai}
                                                tooltip="تصفية الحالة"
                                            >
                                                <div className="flex flex-col gap-1 p-1 bg-white border border-blue-200 rounded-[20px] shadow-sm">
                                                    <select
                                                        className="w-full h-5 px-1 bg-white border border-gray-200 rounded-[20px] text-[8px] outline-none"
                                                        value={selectedSaiEng}
                                                        onChange={(e) => setSelectedSaiEng(e.target.value)}
                                                    >
                                                        <option value="">(الالتزام) الكل</option>
                                                        <option value="true">مسجل للالتزام</option>
                                                        <option value="false">غير مسجل للالتزام</option>
                                                    </select>
                                                    <select
                                                        className="w-full h-5 px-1 bg-white border border-gray-200 rounded-[20px] text-[8px] outline-none"
                                                        value={selectedSaiPai}
                                                        onChange={(e) => setSelectedSaiPai(e.target.value)}
                                                    >
                                                        <option value="">(الدفع) الكل</option>
                                                        <option value="true">مسجل للدفع</option>
                                                        <option value="false">غير مسجل للدفع</option>
                                                    </select>
                                                </div>
                                            </SearchHeader>
                                        </th>
                                        <th className="p-1 text-center text-[9px] font-bold text-gray-500 uppercase tracking-wider">
                                            <SearchHeader 
                                                title="تفصيل الهيكلة"
                                                isActive={!!selectedStructureDetail}
                                                tooltip="تصفية الهيكلة"
                                            >
                                                <div className="relative">
                                                    <select
                                                        className="w-full h-5 px-1 bg-white border border-blue-200 rounded text-[8px] font-bold outline-none"
                                                        value={selectedStructureDetail}
                                                        onChange={(e) => setSelectedStructureDetail(e.target.value)}
                                                    >
                                                        <option value="">الكل</option>
                                                        {uniqueRubrics.map(rub => (
                                                            <option key={rub.ID_RUBRIQUE} value={String(rub.ID_RUBRIQUE)}>{rub.RUBRIQUE}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </SearchHeader>
                                        </th>
                                        <th className="p-1 text-center text-[9px] font-bold text-gray-500 uppercase tracking-wider">
                                            <SearchHeader 
                                                title={t('col.beneficiary')}
                                                isActive={!!selectedBeneficiaireId}
                                                tooltip="بحث بالمستفيذ"
                                            >
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        className="w-full h-5 px-1 bg-white border border-blue-200 rounded text-[9px] font-medium normal-case outline-none"
                                                        value={selectedBeneficiaireId}
                                                        onChange={(e) => setSelectedBeneficiaireId(e.target.value)}
                                                        autoFocus
                                                        placeholder="..."
                                                    />
                                                    {selectedBeneficiaireId && (
                                                        <button onClick={() => setSelectedBeneficiaireId('')} className="absolute left-0.5 top-0.5 text-gray-400 hover:text-red-500">
                                                            <X size={8} />
                                                        </button>
                                                    )}
                                                </div>
                                            </SearchHeader>
                                        </th>
                                        <th className="p-1 text-right text-[9px] font-bold text-gray-500 uppercase tracking-wider">{t('col.amount')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {flattenedRows.slice(0, visibleCount).map((row) => {
                                        if (row.type === 'operation') {
                                            const opt = row.data;
                                            return (
                                                <tr key={row.key} className="bg-gradient-to-l from-blue-50 to-transparent text-right border-y border-blue-100/60 font-black">
                                                    <td colSpan={7} className="p-1.5 text-right">
                                                        <div className="flex items-center gap-2 justify-start leading-none pr-1">
                                                            <span className="bg-sky-300 text-black text-[8px] px-1.5 py-0.5 rounded-[20px] shadow-sm select-none">
                                                             {opt?.N_OPERATION}
                                                            </span>
                                                            <span className="text-[8px] font-black text-blue-900 truncate max-w-[600px]" title={opt?.INT_OPERATION}>
                                                                {opt?.INT_OPERATION}
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        } else if (row.type === 'totals') {
                                            const { totalCommitment, totalPayment } = row.data;
                                            return (
                                                <React.Fragment key={row.key}>
                                                    <tr className="bg-gray-100 text-black-600">
                                                        <td colSpan={7} className="p-1 text-right text-[9px] border border-black-200">
                                                            <div className="flex items-center gap-1.5 justify-end">
                                                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-sm"></span>
                                                                <span className="px-1 rounded-[20px] bg-blue-50 border border-blue-200"> مجموع الالتزام = {formatCurrency(totalCommitment)} </span>
                                                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-sm"></span>
                                                                <span className="px-1 rounded-[20px] bg-green-50 border border-green-200"> مجموع الدفع  = {formatCurrency(totalPayment)} </span>
                                                                
                                                            </div>
                                                        </td>
                                                        
                                                    </tr>
                                                    
                                                </React.Fragment>
                                            );
                                        } else {
                                            const piece = row.data;
                                            return (
                                                <DocumentRow 
                                                    key={row.key}
                                                    piece={piece}
                                                    index={row.index!}
                                                    isSelected={selectedPiece?.ID_PIECE === piece.ID_PIECE}
                                                    isHighlighted={highlightId === piece.ID_PIECE}
                                                    highlightColor={highlightColor}
                                                    onSelect={handleSelectPiece}
                                                    onNavigate={handleNavigateToDoc}
                                                    onAction={handleActionOnDoc}
                                                    onNavigateBeneficiary={handleNavigateBeneficiary}
                                                    onNavigateStructure={handleNavigateStructure}
                                                    isConcernedWithEngagement={() => piece.isConcernedEng}
                                                    isConcernedWithPaiement={() => piece.isConcernedPai}
                                                    isViewer={isViewer}
                                                    isChild={row.isChild}
                                                />
                                            );
                                        }
                                    })}
                                </tbody>
                            </table>
                            {visibleCount < flattenedRows.length && (
                                <div className="flex items-center justify-center gap-3 px-4 py-2 bg-gray-50 border-t border-gray-200">
                                    <span className="text-xs text-gray-500">عرض {Math.min(visibleCount, flattenedRows.length)} من {flattenedRows.length} صف</span>
                                    <button onClick={() => setVisibleCount(c => c + 500)} className="px-4 py-1.5 rounded-full bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors">عرض المزيد</button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-1 space-y-4">
                    <div className="bg-white p-3 rounded-lg shadow-md">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-xs font-bold text-gray-800">{t('lbl.linked_lots')}</h3>
                            {!isViewer && (
                                <button 
                                    onClick={() => {
                                        if(loading) { alert("يجب الانتظار حتى يتم تحديث النافذة"); return; }
                                        if (!selectedPiece) return;
                                        if (!['صفقة', 'اتفاقية', 'فاتورة'].includes(selectedPiece.NAT_PIECE)) {
                                            alert('عذراً، يمكن ربط الحصص فقط بـ "صفقة" أو "اتفاقية" أو "فاتورة".');
                                            return;
                                        }
                                        if (checkPermission(selectedPiece.ID_OPERATION)) {
                                            setModalState({ type: 'LOT_PIECE', timestamp: Date.now() });
                                        } else {
                                            alert('ليس لديك صلاحية الإضافة.');
                                        }
                                    }}
                                    disabled={!selectedPiece} 
                                    className="bg-indigo-300 text-black font-bold px-1 py-0.6 rounded-lg border border-indigo-200 shadow-md text-[12px] hover:bg-indigo-400 cursor-pointer disabled:bg-gray-150"
                                >
                                    <i className="bi bi-paperclip"></i>
                                </button>
                            )}
                        </div>
                        {selectedPiece && (() => {
                            const linkedOperation = db.T_OPERATION.find(op => op.ID_OPERATION === selectedPiece.ID_OPERATION);
                            if (linkedOperation) {
                                return (
                                    <div>
                                    <div className="leading-tight bg-indigo-50 p-1 border-0">
                                     <div className="text-[9px] text-center text-gray-500 font-bold leading-tight">
                                        العملية: {linkedOperation.N_OPERATION} 
                                     </div>
                                     <div className="text-[9px] text-center text-gray-500 font-medium leading-tight">
                                        {linkedOperation.INT_OPERATION}
                                     </div>
                                    </div>  
                                    </div>
                                    
                                );
                            }
                            return null;
                        })()}
                        {associatedLotsData.length > 0 ? (
                            <ul>
                                {associatedLotsData.map(lot => (
                                    <li key={lot.ID_LOT_PIECE} className="flex justify-between items-center border-t py-1 flex-wrap">
                                        <span className="text-[9px] text-center text-gray-700">{lot.N_LOT} - {lot.INTITULE_LOT}  {lot.DELAI_EX_JOURS && <span className="text-[9px] text-blue-600 bg-blue-50 px-1 rounded mx-1">{formatDurationArabic(lot.DELAI_EX_JOURS)}</span>}</span>
                                        
                                        {!isViewer && (
                                            <button onClick={() => handleDelete('T_LOT_PIECE', lot.ID_LOT_PIECE, 'ID_LOT_PIECE')} disabled={isDeleting} className="text-red-500 hover:text-red-700 text-xs disabled:text-gray-400 disabled:cursor-not-allowed">
                                                <i className="bi bi-trash"></i>
                                            </button>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-[9px] text-gray-500 text-center">{t('lbl.no_data')}</p>
                        )}
                    </div>

                    <div className="bg-white p-3 rounded-lg shadow-md">
                        <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2">
                                <h3 className="text-xs font-bold text-gray-800">{t('lbl.ods_table')}</h3>
                                {odsCalculations && selectedPiece && (
                                    <div className="flex gap-1">
                                        <span className="bg-blue-100 text-blue-700 text-[8px] font-bold px-0.5 py-0.5 rounded-full border border-blue-200">
                                            مدة الإنجاز: {formatDurationArabic(selectedPiece.DELAI_EX_JOURS)}
                                        </span>
                                        {selectedPiece.CAUTION && (
                                            <span className="bg-purple-100 text-purple-700 text-[8px] font-bold px-0.5 py-0.5 rounded-full border border-purple-200">
                                                نسبة الضمان: {selectedPiece.CAUTION}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                            {!isViewer && (
                                <button 
                                    onClick={() => {
                                        if(loading) { alert("يجب الانتظار حتى يتم تحديث النافذة"); return; }
                                        if (!selectedPiece) return;
                                        if (!['صفقة', 'اتفاقية'].includes(selectedPiece.NAT_PIECE)) {
                                            alert('عذراً، يمكن إضافة أوامر خدمة فقط لـ "صفقة" أو "اتفاقية".');
                                            return;
                                        }
                                        if (checkPermission(selectedPiece.ID_OPERATION)) {
                                            setModalState({ type: 'ODS', timestamp: Date.now() });
                                        } else {
                                            alert('ليس لديك صلاحية الإضافة.');
                                        }
                                    }}
                                    disabled={!selectedPiece}
                                    className="bg-indigo-300 text-black font-bold px-1 py-0.6 rounded-lg border border-indigo-200 shadow-md text-[12px] hover:bg-indigo-400 cursor-pointer disabled:bg-gray-150"
                                >
                                    <i className="bi bi-plus-circle"></i>
                                </button>
                            )}
                        </div>

                        {/* ODS Information and Deadline Alerts */}
                        {odsCalculations && (
                            <div className={`mb-2 p-2 rounded-lg border text-right space-y-1 ${
                                odsCalculations.isTerminated
                                    ? 'bg-red-100 border-red-300'
                                    : odsCalculations.startDate ? (
                                        odsCalculations.isCompleted 
                                            ? 'bg-green-50 border-green-200' 
                                            : odsCalculations.isSuspended 
                                                ? 'bg-amber-50 border-amber-200'
                                                : (odsCalculations.isLate || odsCalculations.remainingDays <= 15) 
                                                    ? 'bg-red-50 border-red-500 animate-blink-red'
                                                    : 'bg-blue-50 border-blue-200'
                                    ) : 'bg-gray-50 border-gray-200'
                            }`}>
                                {odsCalculations.isTerminated ? (
                                    <div className="text-center py-1">
                                        <span className="text-[9px] font-black text-red-700">
                                            <i className="bi bi-x-circle-fill ml-1"></i>
                                            {odsCalculations.isFullyTerminated 
                                                ? "تم فسخ العقد" 
                                                : `تم فسخ المبلغ (${formatCurrency(odsCalculations.totalTerminatedAmount)}) من العقد`
                                            }
                                        </span>
                                    </div>
                                ) : (odsCalculations.startDate && odsCalculations.baseDuration > 0) ? (
                                    <>
                                        <div className="flex justify-between items-center">
                                            <span className="text-[10px] font-bold text-gray-600">تاريخ الانتهاء المتوقع:</span>
                                            <span className={`text-[11px] font-black ${odsCalculations.remainingDays <= 15 && !odsCalculations.isCompleted ? 'text-red-700' : 'text-blue-800'}`}>
                                                {normalizeDate(odsCalculations.expectedEndDate.toISOString().split('T')[0])}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center border-t border-black/5 pt-1">
                                            <span className="text-[9px] font-bold text-gray-600">
                                                {odsCalculations.isLate ? 'عدد أيام التأخير' : 'الأيام المتبقية:'}
                                            </span>
                                            <span className={`text-[10px] font-black ${odsCalculations.isLate || (odsCalculations.remainingDays <= 15 && !odsCalculations.isCompleted) ? 'text-red-700' : 'text-blue-800'}`}>
                                                {odsCalculations.isCompleted ? 'مكتمل' : (odsCalculations.isLate ? `${odsCalculations.delayDays} يوم` : `${odsCalculations.remainingDays} يوم`)}
                                            </span>
                                        </div>
                                        {odsCalculations.isSuspended && (
                                            <div className="mt-1 bg-amber-100 text-amber-800 text-[9px] font-bold p-1 rounded text-center border border-amber-300">
                                                <i className="bi bi-pause-circle-fill ml-1"></i>
                                                الأشغال موقوفة حالياً ({odsCalculations.currentSuspensionDays} يوم)
                                            </div>
                                        )}
                                        {odsCalculations.isCompleted && (
                                            <div className="mt-1 bg-green-100 text-green-800 text-[9px] font-bold p-1 rounded text-center border border-green-300">
                                                <i className="bi bi-check-circle-fill ml-1"></i>
                                            انتهاء اشغال المشروع
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="text-center py-1">
                                        {odsCalculations.baseDuration === 0 ? (
                                            <span className="text-[10px] font-black text-gray-700">
                                                <i className="bi bi-info-circle ml-1"></i>
                                                العقد بدون مدة
                                            </span>
                                        ) : selectedPieceDetails?.engagement?.N_VISA_CB ? (
                                            <span className="text-[10px] font-black text-amber-700">
                                                <i className="bi bi-exclamation-circle ml-1"></i>
                                                الأشغال لم تنطلق بعد
                                            </span>
                                        ) : (
                                            <span className="text-[9px] font-bold text-gray-500 italic">في انتظار أمر انطلاق الأشغال</span>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {associatedOds.length > 0 ? (
                            <div className="max-h-60 overflow-y-auto">
                                <ul>
                                    {associatedOds.map(ods => {
                                        const lotName = ods.ID_LOT ? associatedLotsData.find(l => l.ID_LOT === ods.ID_LOT)?.N_LOT : null;
                                        return (
                                            <li key={ods.ID_ODS} className="border-b py-1 hover:bg-blue-100 cursor-pointer" 
                                                onClick={() => { 
                                                    if(loading) { alert("يجب الانتظار حتى يتم تحديث النافذة"); return; }
                                                    if (isViewer) return;
                                                    if(checkPermission(selectedPiece!.ID_OPERATION)) setModalState({ type: 'ODS', data: ods, timestamp: Date.now() }); 
                                                    else alert('ليس لديك صلاحية التعديل.');
                                                }}
                                            >
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-[10px] font-semibold text-gray-800">{ods.NATURE_ODS}  {normalizeDate(ods.DATE_ODS)}</p>
                                                            {lotName && <span className="text-[9px] bg-yellow-200 px-1 rounded text-gray-800">حصة {lotName}</span>}
                                                        </div>
                                                        <p className="text-[9px] text-gray-600 mt-0.5">{ods.OBJET_ODS}</p>
                                                    </div>
                                                    {!isViewer && (
                                                        <button onClick={(e) => { e.stopPropagation(); handleDelete('T_ODS', ods.ID_ODS, 'ID_ODS'); }} disabled={isDeleting} className="text-red-500 hover:text-red-700 text-xs disabled:text-gray-400 disabled:cursor-not-allowed">
                                                            <i className="bi bi-trash"></i>
                                                        </button>
                                                    )}
                                                </div>
                                                
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        ) : (
                            <p className="text-[10px] text-gray-500 text-center">{t('lbl.no_data')}</p>
                        )}
                    </div>

                    {/* Selected Piece Info Box */}
                    {selectedPiece && selectedPiece.NAT_PIECE !== 'أخرى' && (
                        <div className="bg-white rounded-lg shadow-md border-r-4 border-sky-400 overflow-hidden">
                            <div className="bg-gray-50 px-3 py-2 border-b flex items-center justify-between">
                                <h3 className="text-xs font-bold text-blue-800 flex items-center gap-2">
                                    <i className="bi bi-info-circle-fill"></i>
                                    {selectedPiece.NAT_PIECE === 'قرار فسخ' && selectedPieceDetails?.basePiece ? selectedPieceDetails.basePiece.PIECE : selectedPiece.PIECE}
                                </h3>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${selectedPieceDetails?.isAmendment ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                                    {selectedPieceDetails?.isAmendment ? selectedPieceDetails.amendmentLabel : selectedPiece.NAT_PIECE}
                                </span>
                            </div>

                            <div className="p-3 space-y-3">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {/* Parent Piece info - Show for Amendments, Decisions and Work Situations */}
                                    {(['ملحق', 'قرار فسخ', 'وضعية الأشغال', 'وضعية التسبيق الجزافي', 'وضعية التسبيق على التموين', 'فاتورة', 'حكم قضائي'].includes(selectedPiece.NAT_PIECE)) && selectedPieceDetails?.basePiece && (
                                        <div className="col-span-1 md:col-span-2 bg-blue-50 p-2 rounded border border-blue-100">
                                            <p className="text-[9px] text-gray-500 font-bold mb-1">الوثيقة الأصلية (الصفقة/الاتفاقية):</p>
                                            <p className="text-[10px] font-bold text-blue-900 leading-tight">
                                                {selectedPieceDetails.basePiece.PIECE}
                                            </p>
                                        </div>
                                    )}

                                    {/* Procurement Visa info - Only for Contracts (General info) */}
                                    {['صفقة', 'اتفاقية'].includes(selectedPiece.NAT_PIECE) && (
                                        <>
                                            <div className="col-span-1 md:col-span-2 grid grid-cols-2 gap-2 border-b pb-2">
                                                <div className="space-y-1">
                                                    <p className="text-[9px] text-gray-500 font-bold">رقم التعريف الجبائي (NIF):</p>
                                                    <p className="text-[10px] font-semibold text-gray-800 text-right" dir="ltr">
                                                        {selectedPieceDetails?.beneficiaire?.CODE_FISCALE || '---'}
                                                    </p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[9px] text-gray-500 font-bold">رقم السجل التجاري (NRC):</p>
                                                    <p className="text-[10px] font-semibold text-gray-800 text-right" dir="ltr">
                                                        {selectedPieceDetails?.beneficiaire?.RC || '---'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[9px] text-gray-500 font-bold">عنوان المستفيد:</p>
                                                <p className="text-[10px] font-semibold text-gray-800 leading-tight">
                                                    {selectedPieceDetails?.beneficiaire?.ADRESSE || '---'}
                                                </p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[9px] text-gray-500 font-bold">الحساب البنكي (RIB):</p>
                                                <div className="flex flex-wrap gap-x-2 items-center">
                                                    <p className="text-[10px] font-bold text-gray-800 font-mono">
                                                        {selectedPieceDetails?.compte?.RIB || '---'}
                                                    </p>
                                                    {selectedPieceDetails?.compte?.BANQUE && (
                                                        <span className="text-[8px] bg-blue-50 text-blue-700 px-1 py-0.2 rounded border border-blue-100 font-bold">
                                                            {selectedPieceDetails.compte.BANQUE}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {/* Procurement Visa info - Show for Contracts, and for Amendments if they have data */}
                                    {(selectedPiece.NAT_PIECE === 'صفقة' || (selectedPiece.NAT_PIECE === 'ملحق' && (selectedPiece.N_VISA_CM || selectedPiece.DATE_VISA_CM))) && (
                                        <div className="space-y-1 border-t pt-2">
                                            <p className="text-[9px] text-gray-500 font-bold mb-1">تأشيرة لجنة الصفقات:</p>
                                            <div className="bg-pink-50 p-1 rounded border border-pink-200">
                                                <p className="text-[10px] font-bold text-gray-700">
                                                    رقم: {selectedPiece.N_VISA_CM || '---'}
                                                </p>
                                                <p className="text-[9px] text-gray-500 font-semibold">
                                                    بتاريخ: {selectedPiece.DATE_VISA_CM ? normalizeDate(selectedPiece.DATE_VISA_CM) : '---'}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Commitment info - Show for relevant contract/decision types */}
                                    {(['صفقة', 'اتفاقية', 'ملحق', 'مقرر', 'قرار فسخ', 'فاتورة','حكم قضائي'].includes(selectedPiece.NAT_PIECE)) && (
                                        <div className={`space-y-1 ${['صفقة', 'اتفاقية'].includes(selectedPiece.NAT_PIECE) ? 'border-t pt-2' : 'border-t pt-2'}`}>
                                            <p className="text-[9px] text-gray-500 font-bold mb-1">تأشيرة المراقب المالي:</p>
                                            {selectedPieceDetails?.engagement ? (
                                                <div className="bg-blue-50 p-1 rounded border border-blue-200">
                                                    <p className="text-[10px] font-bold text-blue-700">
                                                        رقم: {selectedPieceDetails.engagement.N_VISA_CB || '---'} في: {normalizeDate(selectedPieceDetails.engagement.DATE_VISA_CB)}
                                                    </p>
                                                    <p className="text-[9px] text-blue-600 font-semibold">
                                                        بطاقة: {selectedPieceDetails.engagement.N_ENG}/{selectedPieceDetails.engagement.ANNEE}
                                                    </p>
                                                </div>
                                            ) : (
                                                <p className="text-[10px] font-semibold text-red-500 italic">غير ملتزم بها بعد</p>
                                            )}
                                        </div>
                                    )}

                                    {/* Payment Info - For specific groups */}
                                    {['فاتورة', 'وضعية الأشغال', 'وضعية التسبيق الجزافي', 'وضعية التسبيق على التموين','حكم قضائي'].includes(selectedPiece.NAT_PIECE) && (
                                        <div className="space-y-1 border-t pt-2">
                                            <p className="text-[9px] text-gray-500 font-bold mb-1">رقم و تاريخ الحوالة (تاريخ القبول):</p>
                                            <div className="bg-green-50 p-1 rounded border border-green-100">
                                                <div className="flex justify-between items-center">
                                                    <div>
                                                        <p className="text-[10px] font-bold text-green-700">
                                                            {selectedPieceDetails?.paiement?.N_MANDAT ? `رقم: ${selectedPieceDetails.paiement.N_MANDAT}` : 'بدون رقم'} 
                                                        </p>
                                                        <p className="text-[9px] text-green-600 font-semibold">
                                                            {selectedPieceDetails?.paiement?.DATE_MANDAT ? `بتاريخ: ${normalizeDate(selectedPieceDetails.paiement.DATE_MANDAT)}` : ''}
                                                        </p>
                                                    </div>
                                                    <div className="bg-white/50 px-1 py-0.5 rounded border border-green-200">
                                                        <p className="text-[8px] text-gray-500 font-bold leading-none mb-0.5">تاريخ القبول</p>
                                                        <p className="text-[10px] font-bold text-green-800 leading-none">
                                                            {selectedPieceDetails?.paiement?.DATE_ADMIS ? normalizeDate(selectedPieceDetails.paiement.DATE_ADMIS) : '---'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                            {selectedPieceDetails && selectedPieceDetails.delayPenalty !== 0 && (
                                                <div className="mt-1 bg-red-50 p-1.5 rounded border border-red-100 flex justify-between items-center">
                                                    <p className="text-[9px] text-red-500 font-bold">عقوبة التأخير:</p>
                                                    <p className="text-[10px] font-black text-red-700 text-left" dir="ltr">
                                                        {formatCurrency(selectedPieceDetails.delayPenalty)}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Financial totals for pieces related to a contract/agreement */}
                                {(['صفقة', 'اتفاقية', 'قرار فسخ', 'ملحق', 'وضعية الأشغال', 'فاتورة', 'وضعية التسبيق الجزافي', 'وضعية التسبيق على التموين','حكم قضائي'].includes(selectedPiece.NAT_PIECE)) && selectedPieceDetails && (
                                    <div className="border-t pt-2 space-y-2">
                                        <div className="grid grid-cols-2 gap-2">
                                            {selectedPieceDetails.terminationAmount !== 0 && (
                                                <div className="bg-red-50 p-1.5 rounded border border-red-100">
                                                    <p className="text-[9px] text-red-500 font-bold">مبلغ الفسخ: {formatCurrency(selectedPieceDetails.terminationAmount)}</p>
                                                    
                                                </div>
                                            )}
                                            <div className="bg-blue-50 p-1.5 rounded border border-blue-100 flex justify-between items-center">
                                                <p className="text-[9px] text-blue-500 font-bold">المبلغ الجديد: {formatCurrency(selectedPieceDetails.newTotalAmount)}</p>
                                                {selectedPieceDetails.amendmentsCount > 0 && (
                                                    <span className="text-[8px] bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded-full font-bold">
                                                        {selectedPieceDetails.amendmentsCount} ملحق
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="bg-orange-50 p-2 rounded border border-orange-100 flex justify-between items-center">
                                            <div>
                                                <p className="text-[9px] text-orange-600 font-bold">إجمالي الدفع: {formatCurrency(selectedPieceDetails.totalPaid)}</p>
                                                {selectedPieceDetails.unregisteredPaymentsAmount > 0 && (
                                                    <p className="text-[8px] text-red-600 font-bold mt-0.5">
                                                        دفع غير مسجل: {formatCurrency(selectedPieceDetails.unregisteredPaymentsAmount)}
                                                     </p>
                                                 )}
                                            </div>
                                            <div className="text-right space-y-1">
                                                {selectedPieceDetails.workSituationsCount > 0 && selectedPieceDetails.totalPaid > 0 && (
                                                    <span className="text-[9px] bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded-full font-bold block text-center">
                                                        {selectedPieceDetails.workSituationsCount} وضعية
                                                    </span>
                                                )}
                                                {selectedPieceDetails.unregisteredRelatedCount > 0 && (
                                                    <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold block text-center" title="عدد الوثائق غير المسجلة">
                                                        {selectedPieceDetails.unregisteredRelatedCount} غ. مسجلة
                                                    </span>
                                                )}
                                                {selectedPieceDetails.delayPenalty !== 0 && (
                                                    <div className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded border border-red-200">
                                                        <p className="text-[8px] font-bold leading-none mb-0.5">إجمالي العقوبات</p>
                                                        <p className="text-[9px] font-black leading-none text-left" dir="ltr">
                                                            {formatCurrency(selectedPieceDetails.delayPenalty)}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <div className="flex justify-between items-center">
                                                <p className="text-[9px] text-gray-500 font-bold">نسبة التقدم المالي:</p>
                                                <span className="text-[10px] font-bold text-gray-700">
                                                    {Math.min(100, selectedPieceDetails.progressPercent).toFixed(1)}%
                                                </span>
                                            </div>
                                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                                                <div 
                                                    className={`h-full ${selectedPieceDetails.progressPercent >= 100 ? 'bg-green-500' : 'bg-blue-500'}`} 
                                                    style={{ width: `${Math.min(100, selectedPieceDetails.progressPercent)}%` }}
                                                ></div>
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-center border-t pt-1">
                                            <p className="text-[9px] text-gray-500 font-bold">المبلغ المتبقي:</p>
                                            <p className={`text-[10px] font-black ${selectedPieceDetails.remainingAmount < 0 ? 'text-red-600' : 'text-gray-700'}`} dir="ltr">
                                              {formatCurrency(selectedPieceDetails.remainingAmount)}
                                            </p>
                                        </div>

                                        {/* Warranty Info Section */}
                                        {odsCalculations?.warrantyEndDate && (
                                            <div className="border-t border-dashed pt-2 mt-1">
                                                <div className="bg-purple-50 p-2 rounded border border-purple-200">
                                                    <div className="flex justify-between items-center mb-1">
                                                        <p className="text-[9px] text-purple-700 font-bold">تاريخ انتهاء الضمان:</p>
                                                        <span className="text-[10px] font-black text-purple-900">
                                                            {normalizeDate(odsCalculations.warrantyEndDate.toISOString().split('T')[0])}
                                                        </span>
                                                    </div>
                                                    {(selectedPiece.CAUTION || db.T_PIECE.some(p => p.ID_PIECE_INIT === (selectedPieceDetails.basePiece?.ID_PIECE || selectedPiece.ID_PIECE) && (p.PIECE.includes('ضمان') || p.PIECE.toLowerCase().includes('caution')))) && (
                                                        odsCalculations.isWarrantyExpired ? (
                                                            <div className="flex items-center gap-1 text-[9px] text-green-700 font-black mt-1 bg-green-100/50 px-1 rounded">
                                                                <i className="bi bi-shield-check"></i>
                                                                يمكن رفع اليد الضمان {selectedPiece.CAUTION ? `(${selectedPiece.CAUTION})` : ''}
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-1 text-[9px] text-red-600 font-black mt-1 bg-red-100/50 px-1 rounded border border-red-200">
                                                                <i className="bi bi-exclamation-triangle"></i>
                                                                لا يمكن رفع اليد الضمان
                                                            </div>
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <Modal isOpen={modalState.type === 'DOCUMENT'} onClose={() => setModalState({ type: null })} title={modalState.data ? "تعديل وثيقة" : "إضافة وثيقة جديدة"} maxWidth="2xl">
                <AddDocumentForm
                    key={modalState.timestamp ? `doc-${modalState.timestamp}` : 'add-doc'}
                    onClose={() => setModalState({ type: null })}
                    onSave={(data) => handleSave('T_PIECE', data, 'ID_PIECE')}
                    operations={db.T_OPERATION.filter(op => op.CREATED_BY === currentUser.ID_USER || currentUser.ROLE === 'admin')}
                    beneficiaires={db.T_BENEFICIAIRE}
                    comptesBancaires={db.T_COMPTE_BANCAIRE}
                    pieces={db.T_PIECE}
                    engagements={db.T_ENGAGEMENT}
                    paiements={db.T_PAIEMENT}
                    cps={db.T_CP}
                    rubriques={db.T_RUBRIQUE}
                    rubriqueOps={db.T_RUBRIQUE_OP}
                    scategories={db.T_SCATEGORIE}
                    scategorieOps={db.T_SCATEGORIE_OP}
                    initialData={modalState.data}
                    lots={db.T_LOT_OPERATION}
                    lotPieces={db.T_LOT_PIECE}
                    ods={db.T_ODS}
                    selectedOperationId={selectedOperationId ? parseInt(selectedOperationId) : null}
                />
            </Modal>
            <Modal isOpen={modalState.type === 'LOT_PIECE'} onClose={() => setModalState({ type: null })} title="ربط حصة">
                {selectedPiece && (
                    <AddLotPieceForm
                        key={modalState.timestamp ? `lot-piece-${modalState.timestamp}` : 'add-lot-piece'}
                        onClose={() => setModalState({ type: null })}
                        onSave={handleSaveLotPiece}
                        pieceId={selectedPiece.ID_PIECE}
                        allLotsForOperation={allLotsForOperation}
                        alreadyAssociatedLotIds={alreadyAssociatedLotIds}
                        initialData={modalState.data}
                    />
                )}
            </Modal>
            <Modal isOpen={modalState.type === 'ODS'} onClose={() => setModalState({ type: null })} title={modalState.data ? "تعديل أمر خدمة" : "إضافة أمر خدمة"}>
                {selectedPiece && (
                    <AddOdsForm
                        key={modalState.timestamp ? `ods-${modalState.timestamp}` : 'add-ods'}
                        onClose={() => setModalState({ type: null })}
                        onSave={(data) => handleSave('T_ODS', data, 'ID_ODS')}
                        pieceId={selectedPiece.ID_PIECE}
                        initialData={modalState.data}
                        associatedOds={associatedOds}
                        associatedLots={associatedLotObjects}
                    />
                )}
            </Modal>
            
            {/* New Modals for Immediate Engagement/Payment */}
            <Modal isOpen={modalState.type === 'ENGAGEMENT'} onClose={() => setModalState({ type: null })} title="إضافة التزام للوثيقة">
                {dataForEngagementForm && (
                    <AddEngagementForm
                        key={`add-eng-direct-${modalState.timestamp}`}
                        onClose={() => setModalState({ type: null })}
                        onSave={(data) => handleSave('T_ENGAGEMENT', data, 'ID_ENGAGEMENT')}
                        operationId={dataForEngagementForm.opId}
                        pieces={dataForEngagementForm.pieces}
                        rubriqueOps={dataForEngagementForm.rubriqueOps}
                        allEngagementsForOp={dataForEngagementForm.engagements}
                        selectedYear={new Date().getFullYear().toString()}
                        defaultPieceId={modalState.data.defaultPieceId}
                    />
                )}
            </Modal>
            
            <Modal isOpen={modalState.type === 'PAIEMENT'} onClose={() => setModalState({ type: null })} title="إضافة دفع للوثيقة">
                {dataForPaiementForm && (
                    <AddPaiementForm
                        key={`add-pai-direct-${modalState.timestamp}`}
                        onClose={() => setModalState({ type: null })}
                        onSave={(data) => handleSave('T_PAIEMENT', data, 'ID_PAIEMENT')}
                        operationId={dataForPaiementForm.opId}
                        engagements={dataForPaiementForm.engagements}
                        pieces={dataForPaiementForm.pieces}
                        cpItems={db.T_CP}
                        allPaiementsForOp={dataForPaiementForm.paiements}
                        selectedYear={new Date().getFullYear().toString()}
                        defaultPieceId={modalState.data.defaultPieceId}
                    />
                )}
            </Modal>
            <ConfirmActionModal
                isOpen={!!pendingDelete}
                title={pendingDelete?.kind === 'item' ? 'تأكيد الحذف' : 'إصلاح سلامة البيانات'}
                message={pendingDelete?.message || 'هل أنت متأكد أنك تريد حذف هذا العنصر؟'}
                onCancel={() => setPendingDelete(null)}
                onConfirm={confirmPendingDelete}
            />
        </PageWrapper>
    );
};

export default DocumentsPage;
