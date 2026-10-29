import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Page, Database, Operation, Categorie, Cp, RubriqueOp, ScategorieOp, LotOperation, Engagement, Paiement, User } from '../types';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { errorMessage } from '../utils/errorMessage';
import { useLanguage } from '../context/LanguageContext';
import PageWrapper from '../components/PageWrapper';
import Modal from '../components/Modal';
import ConfirmActionModal from '../components/ConfirmActionModal';
import Card from '../components/Card';
import AddCpForm from '../components/forms/AddCpForm';
import AddRubriqueOpForm from '../components/forms/AddRubriqueOpForm';
import AddScategorieOpForm from '../components/forms/AddScategorieOpForm';
import AddLotForm from '../components/forms/AddLotForm';
import AddEngagementForm from '../components/forms/AddEngagementForm';
import AddPaiementForm from '../components/forms/AddPaiementForm';
import AddBordereauForm from '../components/forms/AddBordereauForm';
import { formatCurrency, parseCurrency } from '../utils/currencyUtils';
import { normalizeDate } from '../utils/dateUtils';
import { exportToFormattedExcel } from '../utils/exportToCsv';
import CustomDropdown from '../components/CustomDropdown';

import ExcelJS from 'exceljs';
import { saveBlobToFile } from '../utils/saveFile';

// Arabic normalization helper to handle flexible text matching
const normalizeArabic = (text: string): string => {
    if (!text) return '';
    return text
        .trim()
        .replace(/[\u064B-\u0652]/g, '') // remove diacritics
        .replace(/[أإآٱ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/\s+/g, ' ');
};

const isUnallocatedText = (text: string): boolean => {
    const normalizedText = normalizeArabic(text);
    const normalizedKeywords = [
        'غير موزع',
        'غير موزعة',
        'مبالغ غير موزعة',
        'مبلغ العملية غير الموزع',
        'غير الموزع',
        'مبلغ غير موزع'
    ].map(normalizeArabic);
    return normalizedKeywords.some(keyword => normalizedText.includes(keyword));
};

interface OperationDetailsPageProps {
    navigate: (page: Page, id?: number, tab?: string) => void;
    operationId: number;
    initialTab?: string;
    onGoBack?: () => void;
    currentUser: User;
}

const OperationDetailsPage: React.FC<OperationDetailsPageProps> = ({ navigate, operationId, initialTab, onGoBack, currentUser }) => {
    const { db, loading, addItem, updateItem, deleteItem, runInTransaction, broadcastEvent } = useData();
    const { showToast } = useToast();
    const { t } = useLanguage();

    const operation: Operation | undefined = db.T_OPERATION.find(op => Number(op.ID_OPERATION) === Number(operationId));

    // Safety check: if operationId is missing or operation doesn't exist, go back to list entirely
    // Also check if current user is allowed to see this operation
    useEffect(() => {
        if (!loading) {
            if (!operationId || !operation) {
                navigate('OPERATIONS');
                return;
            }

            if (currentUser.ROLE !== 'admin' && currentUser.ALLOWED_OPERATIONS) {
                try {
                    const allowedOps = JSON.parse(currentUser.ALLOWED_OPERATIONS) as number[];
                    if (allowedOps.length > 0 && !allowedOps.includes(operationId)) {
                        navigate('HOME');
                    }
                } catch (e) {
                    console.error("Error parsing allowed operations", e);
                }
            }
        }
    }, [operationId, operation, loading, navigate, currentUser]);

    const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'STRUCTURE' | 'LOTS' | 'ENGAGEMENTS' | 'PAIEMENTS' | 'BORDEREAUX'>('OVERVIEW');
    const [pendingDelete, setPendingDelete] = useState<{
        table: keyof Database;
        id: number;
        message: string;
        kind?: 'item' | 'bordereau';
    } | null>(null);
    
    useEffect(() => {
        if (initialTab) {
            const [tabName, subId, color, action, pieceId] = initialTab.split(':');
            setActiveTab(tabName as any);
            
            if (subId && subId !== '0') {
                const parsedSubId = parseInt(subId, 10);
                if (tabName === 'ENGAGEMENTS') {
                    setSelectedengagementId(parsedSubId);
                }
                if (tabName === 'PAIEMENTS') {
                    setSelectedpaiementId(parsedSubId);
                    // Clear filters so the selected payment row is visible and rendered in the table
                    setSelectedPaiObject('');
                    setSelectedPaiYear('');
                    setSelectedPaiBeneficiaryId('');
                }
            }

            if (action === 'DIRECT_CREATE' && pieceId) {
                const parsedPieceId = parseInt(pieceId, 10);
                if (tabName === 'ENGAGEMENTS') {
                    setModalState({ type: 'ENGAGEMENT', extraData: { defaultPieceId: parsedPieceId }, timestamp: Date.now() });
                } else if (tabName === 'PAIEMENTS') {
                    setModalState({ type: 'PAIEMENT', extraData: { defaultPieceId: parsedPieceId }, timestamp: Date.now() });
                }
            }
            
            // Auto-scroll to section and highlight target row
            if (!loading) {
                const tryScrollAndHighlight = () => {
                    const sectionId = tabName === 'ENGAGEMENTS' ? 'engagements-section' : 
                                    tabName === 'PAIEMENTS' ? 'paiements-section' : 
                                    tabName === 'LOTS' ? 'lots-section' : 
                                    tabName === 'OVERVIEW' ? 'overview-section' : null;
                    if (sectionId) {
                        const element = document.getElementById(sectionId);
                        if (element) {
                            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                    }

                    if (subId && subId !== '0') {
                        const rowId = `${tabName.toLowerCase()}-row-${subId}`;
                        const rowElement = document.getElementById(rowId);
                        if (rowElement) {
                            rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            
                            // Apply animated highlight
                            const highlightClass = color === 'red' ? 'animate-highlight-red' : 
                                                 color === 'amber' ? 'animate-highlight-amber' : 
                                                 'animate-highlight-blue';
                            
                            rowElement.classList.remove('animate-highlight-red', 'animate-highlight-amber', 'animate-highlight-blue');
                            void rowElement.offsetWidth; // Force reflow
                            rowElement.classList.add(highlightClass);
                            setTimeout(() => rowElement.classList.remove(highlightClass), 3500);
                            return true;
                        }
                    } else if (sectionId) {
                        const element = document.getElementById(sectionId);
                        if (element) {
                            const highlightRing = color === 'red' ? 'ring-red-500' : 
                                                  color === 'amber' ? 'ring-amber-500' : 
                                                  'ring-blue-500';
                            
                            element.classList.add('ring-4', highlightRing, 'ring-opacity-30', 'transition-all', 'duration-500');
                            setTimeout(() => element.classList.remove('ring-4', highlightRing, 'ring-opacity-30'), 3000);
                        }
                    }
                    return false;
                };

                const timer1 = setTimeout(() => {
                    const success = tryScrollAndHighlight();
                    if (!success && subId && subId !== '0') {
                        setTimeout(tryScrollAndHighlight, 300);
                    }
                }, 150);

                return () => clearTimeout(timer1);
            }
        }
    }, [initialTab, loading]);

    const [modalState, setModalState] = useState<{
        type: 'CP' | 'RUBRIQUE_OP' | 'SCATEGORIE_OP' | 'LOT' | 'ENGAGEMENT' | 'PAIEMENT' | 'BORDEREAU' | null;
        data?: any;
        extraData?: any;
        timestamp?: number;
    }>({ type: null });

    const [printMenu, setPrintMenu] = useState<{ id: number, top: number, left: number } | null>(null);

    // Filter states for Engagements
    const [selectedEngObject, setSelectedEngObject] = useState<string>('');
    const [selectedEngYear, setSelectedEngYear] = useState<string>('');
    const [selectedEngBeneficiaryId, setSelectedEngBeneficiaryId] = useState<string>('');

    // Filter states for Payments
    const [selectedPaiObject, setSelectedPaiObject] = useState<string>('');
    const [selectedPaiYear, setSelectedPaiYear] = useState<string>('');
    const [selectedPaiBeneficiaryId, setSelectedPaiBeneficiaryId] = useState<string>('');

    const [selectedpaiementId, setSelectedpaiementId] = useState<number | null>(null);
    const [selectedengagementId, setSelectedengagementId] = useState<number | null>(null);
    const [selectedPaymentYear] = useState<string>(() => sessionStorage.getItem('goft3_selectedYear') || new Date().getFullYear().toString());

    const fileInputLotsRef = useRef<HTMLInputElement>(null);
    const fileInputEngagementsRef = useRef<HTMLInputElement>(null);
    const fileInputPaiementsRef = useRef<HTMLInputElement>(null);

    const isViewer = currentUser.ROLE === 'viewer';

    useEffect(() => {
        const handleClickOutside = () => {
            setPrintMenu(null);
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const handlePrintClick = (e: React.MouseEvent<HTMLButtonElement>, id: number) => {
        e.stopPropagation();
        setSelectedpaiementId(id);
        const rect = e.currentTarget.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const menuHeight = 200;
        let top = rect.bottom;
        if (spaceBelow < menuHeight) {
            top = rect.top - menuHeight;
        }
        setPrintMenu({ id, top, left: rect.left });
    };

    const categorie: Categorie | undefined = operation ? db.T_CATEGORIE.find(c => c.ID_CATEGORIE === operation.ID_CATEGORIE) : undefined;

    const canEdit = useMemo(() => {
        if (!operation) return false;
        return operation.CREATED_BY === currentUser.ID_USER || currentUser.ROLE === 'admin';
    }, [operation, currentUser]);

    const handlePermissionCheck = (action: () => void) => {
        if (loading) {
            alert("يجب الانتظار حتى يتم تحديث النافذة");
            return;
        }
        if (canEdit && !isViewer) {
            action();
        } else {
            alert('ليس لديك صلاحية التعديل على هذه العملية.');
        }
    };

    const cps: Cp[] = useMemo(() => {
        if (!operationId) return [];
        return db.T_CP.filter(cp => Number(cp.ID_OPERATION) === Number(operationId)).sort((a, b) => parseInt(a.ANNEE) - parseInt(b.ANNEE));
    }, [db.T_CP, operationId]);

    const rubriquesOp: RubriqueOp[] = useMemo(() => {
        if (!operationId) return [];
        return db.T_RUBRIQUE_OP
            .filter(r => Number(r.ID_OPERATION) === Number(operationId))
            .sort((a, b) => {
                const rubNameA = db.T_RUBRIQUE.find(r => Number(r.ID_RUBRIQUE) === Number(a.ID_RUBRIQUE))?.RUBRIQUE || '';
                const rubNameB = db.T_RUBRIQUE.find(r => Number(r.ID_RUBRIQUE) === Number(b.ID_RUBRIQUE))?.RUBRIQUE || '';
                const aIsUnallocated = isUnallocatedText(rubNameA);
                const bIsUnallocated = isUnallocatedText(rubNameB);

                if (aIsUnallocated && !bIsUnallocated) return 1;
                if (!aIsUnallocated && bIsUnallocated) return -1;
                return a.ID_RUBRIQUE_OP - b.ID_RUBRIQUE_OP;
            });
    }, [db.T_RUBRIQUE_OP, db.T_RUBRIQUE, operationId]);

    const scategoriesOp: ScategorieOp[] = useMemo(() => {
        if (!operationId) return [];
        return db.T_SCATEGORIE_OP
            .filter(s => Number(s.ID_OPERATION) === Number(operationId))
            .sort((a, b) => {
                const scatA = db.T_SCATEGORIE.find(s => Number(s.ID_SCATEGORIE) === Number(a.ID_SCATEGORIE));
                const scatB = db.T_SCATEGORIE.find(s => Number(s.ID_SCATEGORIE) === Number(b.ID_SCATEGORIE));
                const aIsUnallocated = scatA ? isUnallocatedText(scatA.INT_SCATEGORIE) : false;
                const bIsUnallocated = scatB ? isUnallocatedText(scatB.INT_SCATEGORIE) : false;

                if (aIsUnallocated && !bIsUnallocated) return 1;
                if (!aIsUnallocated && bIsUnallocated) return -1;
                return a.ID_SCATEGORIE_OP - b.ID_SCATEGORIE_OP;
            });
    }, [db.T_SCATEGORIE_OP, db.T_SCATEGORIE, operationId]);
    const lots: LotOperation[] = useMemo(() => db.T_LOT_OPERATION.filter(l => Number(l.ID_OPERATION) === Number(operationId)).sort((a,b) => a.ID_LOT - b.ID_LOT), [db.T_LOT_OPERATION, operationId]);
    const engagements: Engagement[] = useMemo(() => db.T_ENGAGEMENT.filter(e => Number(e.ID_OPERATION) === Number(operationId)), [db.T_ENGAGEMENT, operationId]);
    const paiements: Paiement[] = useMemo(() => db.T_PAIEMENT.filter(p => Number(p.ID_OPERATION) === Number(operationId)), [db.T_PAIEMENT, operationId]);
    const bordereaux = useMemo(() => {
        const opBordereauIds = new Set(
            db.T_ENGAGEMENT
                .filter(e => Number(e.ID_OPERATION) === Number(operationId) && e.ID_BORDEREAU)
                .map(e => e.ID_BORDEREAU)
        );
        return (db.T_BORDEREAU || [])
            .filter(b => opBordereauIds.has(b.ID_BORDEREAU))
            .sort((a, b) => Number(b.ID_BORDEREAU) - Number(a.ID_BORDEREAU));
    }, [db.T_BORDEREAU, db.T_ENGAGEMENT, operationId]);
    
    const operationPieces = useMemo(() => db.T_PIECE.filter(p => Number(p.ID_OPERATION) === Number(operationId)), [db.T_PIECE, operationId]);

    // Data for Engagements Filtering
    const engYears = useMemo(() => [...new Set(engagements.map(e => e.ANNEE))].sort((a, b) => b.localeCompare(a)), [engagements]);
    const engBeneficiaries = useMemo(() => {
        const benIds = new Set(engagements.map(e => {
            const p = db.T_PIECE.find(piece => piece.ID_PIECE === e.ID_PIECE);
            return p?.ID_BENEFICIAIRE;
        }).filter(id => id !== null && id !== undefined));
        return db.T_BENEFICIAIRE.filter(b => benIds.has(b.ID_BENEFICIAIRE)).sort((a, b) => a.BENEFICIAIRE.localeCompare(b.BENEFICIAIRE));
    }, [engagements, db.T_PIECE, db.T_BENEFICIAIRE]);
    
    const engObjects = useMemo(() => {
        const objects = new Set(engagements.map(e => e.OBJET_ENG));
        return Array.from(objects).sort();
    }, [engagements]);

    // Data for Payments Filtering
    const paiYears = useMemo(() => [...new Set(paiements.map(p => p.ANNEE))].sort((a, b) => b.localeCompare(a)), [paiements]);
    const paiBeneficiaries = useMemo(() => {
        const benIds = new Set(paiements.map(p => {
            const piece = db.T_PIECE.find(pc => pc.ID_PIECE === p.ID_PIECE);
            return piece?.ID_BENEFICIAIRE;
        }).filter(id => id !== null && id !== undefined));
        return db.T_BENEFICIAIRE.filter(b => benIds.has(b.ID_BENEFICIAIRE)).sort((a, b) => a.BENEFICIAIRE.localeCompare(b.BENEFICIAIRE));
    }, [paiements, db.T_PIECE, db.T_BENEFICIAIRE]);

    const paiObjects = useMemo(() => {
        const objects = new Set(paiements.map(p => p.OBJET_PAI));
        return Array.from(objects).sort();
    }, [paiements]);

    const filteredEngagements = useMemo(() => {
        return engagements.filter(e => {
            const matchesObject = !selectedEngObject || e.OBJET_ENG === selectedEngObject;
            const matchesYear = !selectedEngYear || e.ANNEE === selectedEngYear;
            let matchesBeneficiary = true;
            if (selectedEngBeneficiaryId) {
                const piece = db.T_PIECE.find(p => p.ID_PIECE === e.ID_PIECE);
                matchesBeneficiary = Number(piece?.ID_BENEFICIAIRE) === Number(selectedEngBeneficiaryId);
            }
            return matchesObject && matchesYear && matchesBeneficiary;
        }).sort((a, b) => a.ID_ENGAGEMENT - b.ID_ENGAGEMENT);
    }, [engagements, selectedEngObject, selectedEngYear, selectedEngBeneficiaryId, db.T_PIECE]);

    const totalEngAmount = useMemo(() => {
        return filteredEngagements.reduce((sum, e) => {
            // Include all relevant natures: Commitment, Addendum, Invoice, Cancellation, Withdrawal
            if (['التزام', 'ملحق', 'فاتورة'].includes(e.NATURE_ENG)) {
                return sum + e.MONTANT_ENG;
            }
            if (['سحب', 'فسخ'].includes(e.NATURE_ENG)) {
                // Withdrawal reduces the total. Ensure it's treated as negative regardless of stored sign.
                return sum + (e.MONTANT_ENG < 0 ? e.MONTANT_ENG : -e.MONTANT_ENG);
            }
            return sum;
        }, 0);
    }, [filteredEngagements]);

    const filteredPaiements = useMemo(() => {
        return paiements.filter(p => {
            const matchesObject = !selectedPaiObject || p.OBJET_PAI === selectedPaiObject;
            const matchesYear = !selectedPaiYear || p.ANNEE === selectedPaiYear;
            let matchesBeneficiary = true;
            if (selectedPaiBeneficiaryId) {
                const piece = db.T_PIECE.find(pc => pc.ID_PIECE === p.ID_PIECE);
                matchesBeneficiary = Number(piece?.ID_BENEFICIAIRE) === Number(selectedPaiBeneficiaryId);
            }
            return matchesObject && matchesYear && matchesBeneficiary;
        }).sort((a, b) => a.ID_PAIEMENT - b.ID_PAIEMENT);
    }, [paiements, selectedPaiObject, selectedPaiYear, selectedPaiBeneficiaryId, db.T_PIECE]);

    const totalPaiAmount = useMemo(() => {
        return filteredPaiements.reduce((sum, p) => sum + p.MONTANT_PAI, 0);
    }, [filteredPaiements]);

    const availableRubriques = useMemo(() => {
        const usedIds = new Set(rubriquesOp.map(r => r.ID_RUBRIQUE));
        if (modalState.type === 'RUBRIQUE_OP' && modalState.data) {
            usedIds.delete(Number(modalState.data.ID_RUBRIQUE));
        }
        return db.T_RUBRIQUE
            .filter(r => !usedIds.has(r.ID_RUBRIQUE))
            .sort((a, b) => {
                const aIsUnallocated = isUnallocatedText(a.RUBRIQUE);
                const bIsUnallocated = isUnallocatedText(b.RUBRIQUE);
                if (aIsUnallocated && !bIsUnallocated) return 1;
                if (!aIsUnallocated && bIsUnallocated) return -1;
                return a.RUBRIQUE.localeCompare(b.RUBRIQUE, 'ar');
            });
    }, [db.T_RUBRIQUE, rubriquesOp, modalState]);

    const availableScategories = useMemo(() => {
        const usedIds = new Set(scategoriesOp.map(s => s.ID_SCATEGORIE));
        if (modalState.type === 'SCATEGORIE_OP' && modalState.data) {
            usedIds.delete(Number(modalState.data.ID_SCATEGORIE));
        }
        return db.T_SCATEGORIE
            .filter(s => s.ID_CATEGORIE === operation?.ID_CATEGORIE && !usedIds.has(s.ID_SCATEGORIE))
            .sort((a, b) => {
                const aIsUnallocated = isUnallocatedText(a.INT_SCATEGORIE);
                const bIsUnallocated = isUnallocatedText(b.INT_SCATEGORIE);
                if (aIsUnallocated && !bIsUnallocated) return 1;
                if (!aIsUnallocated && bIsUnallocated) return -1;
                return a.INT_SCATEGORIE.localeCompare(b.INT_SCATEGORIE, 'ar');
            });
    }, [db.T_SCATEGORIE, scategoriesOp, operation, modalState]);

    const totalAE = useMemo(() => rubriquesOp.reduce((sum, r) => sum + (r.MONTANT_FINALE ?? r.MONTANT_INITIALE), 0), [rubriquesOp]);
    const totalCP = useMemo(() => cps.reduce((sum, c) => sum + c.MONTANT_FINALE_CP, 0), [cps]);
    const totalEngagedTotal = useMemo(() => 
        engagements.reduce((sum, e) => {
            if (['التزام', 'ملحق', 'فاتورة', 'فسخ', 'حكم قضائي'].includes(e.NATURE_ENG)) {
                return sum + e.MONTANT_ENG;
            }
            if (e.NATURE_ENG === 'سحب') {
                return sum + (e.MONTANT_ENG < 0 ? e.MONTANT_ENG : -e.MONTANT_ENG);
            }
            return sum;
        }, 0)
    , [engagements]);
    const totalPaidTotal = useMemo(() => paiements.reduce((sum, p) => sum + p.MONTANT_PAI, 0), [paiements]);

    const remainingAE = totalAE - totalEngagedTotal;
    const totalCpInitial = useMemo(() => cps.reduce((sum, item) => sum + item.MONTANT_INITIALE_CP, 0), [cps]);
    const totalCpFinal = useMemo(() => cps.reduce((sum, item) => sum + item.MONTANT_FINALE_CP, 0), [cps]);
    const totalRubriqueAmount = useMemo(() => rubriquesOp.reduce((sum, item) => sum + (item.MONTANT_FINALE ?? item.MONTANT_INITIALE), 0), [rubriquesOp]);
    const totalScatAmount = useMemo(() => scategoriesOp.reduce((sum, item) => sum + (item.MONTANT_FINALE ?? item.MONTANT_INITIALE), 0), [scategoriesOp]);
    const totalLotInitial = useMemo(() => lots.reduce((sum, item) => sum + item.MONTANT_INITIALE_LOT, 0), [lots]);
    const totalLotFinal = useMemo(() => lots.reduce((sum, item) => sum + item.MONTANT_FINALE_LOT, 0), [lots]);

    const { cpYearAmount, paidYearAmount, remainingCpYear } = useMemo(() => {
        const cpForYear = cps.find(c => c.ANNEE === selectedPaymentYear);
        const amountCP = cpForYear ? cpForYear.MONTANT_FINALE_CP : 0;
        const paymentsForYear = paiements.filter(p => p.ANNEE === selectedPaymentYear);
        const amountPaid = paymentsForYear.reduce((sum, p) => sum + p.MONTANT_PAI, 0);
        return { cpYearAmount: amountCP, paidYearAmount: amountPaid, remainingCpYear: amountCP - amountPaid };
    }, [cps, paiements, selectedPaymentYear]);

    const getTabForTable = (table: keyof Database) => {
        if (['T_CP', 'T_RUBRIQUE_OP', 'T_SCATEGORIE_OP'].includes(table)) return 'STRUCTURE';
        if (table === 'T_LOT_OPERATION') return 'LOTS';
        if (table === 'T_ENGAGEMENT') return 'ENGAGEMENTS';
        if (table === 'T_PAIEMENT') return 'PAIEMENTS';
        if (table === 'T_BORDEREAU') return 'BORDEREAUX';
        return 'OVERVIEW';
    };

    const syncStructureTables = async (rubriquesOverride?: RubriqueOp[], operationOverride?: Operation) => {
        if (!operationId || (!operation && !operationOverride)) return;

        const currentOperation = operationOverride || operation;
        if (!currentOperation) return;

        // 1. Get rubriques (use override if provided to avoid stale db state)
        const currentRubriquesOp = rubriquesOverride || db.T_RUBRIQUE_OP.filter(r => Number(r.ID_OPERATION) === Number(operationId));
        
        // 2. Identify unallocated rubriques
        const unallocatedRubriques = db.T_RUBRIQUE.filter(r => isUnallocatedText(r.RUBRIQUE));
        const unallocatedRubriqueIds = unallocatedRubriques.map(r => Number(r.ID_RUBRIQUE));
        
        // Find unallocated scategorie specifically in the current operation's category
        let unallocatedScat = db.T_SCATEGORIE.find(s => 
            Number(s.ID_CATEGORIE) === Number(currentOperation.ID_CATEGORIE) && isUnallocatedText(s.INT_SCATEGORIE)
        );
        
        const roadScat = db.T_SCATEGORIE.find(s => s.INT_SCATEGORIE.includes('المنشآت القاعدية للطرقات'));
        
        const unallocatedScatId = unallocatedScat ? Number(unallocatedScat.ID_SCATEGORIE) : undefined;
        const roadScatId = roadScat ? Number(roadScat.ID_SCATEGORIE) : undefined;
        
        // 3. Calculate totals:
        let initAllocated = 0;
        let finalAllocated = 0;
        let hasFinalAllocated = false;
        
        let initUnallocated = 0;
        let finalUnallocated = 0;
        let hasFinalUnallocated = false;
        
        currentRubriquesOp.forEach(rop => {
            const rubName = db.T_RUBRIQUE.find(r => Number(r.ID_RUBRIQUE) === Number(rop.ID_RUBRIQUE))?.RUBRIQUE || '';
            const isUnallocated = unallocatedRubriqueIds.some(id => Number(id) === Number(rop.ID_RUBRIQUE)) || isUnallocatedText(rubName);
            const rInit = rop.MONTANT_INITIALE || 0;
            const rFinal = rop.MONTANT_FINALE;
            
            if (isUnallocated) {
                initUnallocated += rInit;
                const effectiveFinal = (rFinal !== null && rFinal !== undefined) ? rFinal : rInit;
                finalUnallocated += effectiveFinal;
                if (rFinal !== null && rFinal !== undefined) hasFinalUnallocated = true;
            } else {
                initAllocated += rInit;
                const effectiveFinal = (rFinal !== null && rFinal !== undefined) ? rFinal : rInit;
                finalAllocated += effectiveFinal;
                if (rFinal !== null && rFinal !== undefined) hasFinalAllocated = true;
            }
        });
        
        // 4. Update ScatOps inside transaction
        await runInTransaction(async () => {
            let activeUnallocatedScatId = unallocatedScatId;
            
            // If the unallocated scategorie doesn't exist, automatically create it
            if (!activeUnallocatedScatId && initUnallocated > 0) {
                const currentCat = db.T_CATEGORIE.find(c => Number(c.ID_CATEGORIE) === Number(currentOperation.ID_CATEGORIE));
                const rawCatCode = currentCat?.C_CATEGORIE || '00';
                const cleanCatCode = rawCatCode.replace(/\s+/g, '');
                
                const newScat = await addItem('T_SCATEGORIE', {
                    ID_CATEGORIE: Number(currentOperation.ID_CATEGORIE),
                    C_SCATEGORIE: `${cleanCatCode}-00`,
                    INT_SCATEGORIE: 'مبلغ العملية غير الموزع'
                });
                activeUnallocatedScatId = Number(newScat.ID_SCATEGORIE);
            }
            
            // Determine main scategorie
            let mainScatId: number | undefined = undefined;
            if (Number(currentOperation.ID_SCATEGORIE || 0) !== Number(activeUnallocatedScatId || 0) && currentOperation.ID_SCATEGORIE !== null && currentOperation.ID_SCATEGORIE !== undefined) {
                mainScatId = Number(currentOperation.ID_SCATEGORIE);
            } else if (roadScatId) {
                mainScatId = Number(roadScatId);
            }
            
            if (!mainScatId) {
                const matchedScat = scategoriesOp.find(s => Number(s.ID_SCATEGORIE) !== Number(activeUnallocatedScatId));
                mainScatId = matchedScat ? Number(matchedScat.ID_SCATEGORIE) : undefined;
            }
            
            if (!mainScatId) {
                const otherScat = db.T_SCATEGORIE.find(s => Number(s.ID_CATEGORIE) === Number(currentOperation.ID_CATEGORIE) && !isUnallocatedText(s.INT_SCATEGORIE));
                mainScatId = otherScat ? Number(otherScat.ID_SCATEGORIE) : undefined;
            }
            
            const existingScatOps = db.T_SCATEGORIE_OP.filter(s => Number(s.ID_OPERATION) === Number(operationId));
            
            // Update Main Scategorie Op
            if (mainScatId) {
                const existingMainScatOp = existingScatOps.find(s => Number(s.ID_SCATEGORIE) === Number(mainScatId));
                const mainData = {
                    ID_OPERATION: Number(operationId),
                    ID_SCATEGORIE: Number(mainScatId),
                    MONTANT_INITIALE: initAllocated,
                    MONTANT_FINALE: hasFinalAllocated ? finalAllocated : null
                };
                
                if (existingMainScatOp) {
                    await updateItem('T_SCATEGORIE_OP', existingMainScatOp.ID_SCATEGORIE_OP, {
                        ...existingMainScatOp,
                        ...mainData
                    });
                } else if (initAllocated > 0) {
                    await addItem('T_SCATEGORIE_OP', mainData as any);
                }
            }
            
            // Update Unallocated Scategorie Op
            if (activeUnallocatedScatId && Number(activeUnallocatedScatId) !== Number(mainScatId)) {
                const existingUnallocatedScatOp = existingScatOps.find(s => Number(s.ID_SCATEGORIE) === Number(activeUnallocatedScatId));
                const unallocData = {
                    ID_OPERATION: Number(operationId),
                    ID_SCATEGORIE: Number(activeUnallocatedScatId),
                    MONTANT_INITIALE: initUnallocated,
                    MONTANT_FINALE: hasFinalUnallocated ? finalUnallocated : null
                };
                
                if (existingUnallocatedScatOp) {
                    await updateItem('T_SCATEGORIE_OP', existingUnallocatedScatOp.ID_SCATEGORIE_OP, {
                        ...existingUnallocatedScatOp,
                        ...unallocData
                    });
                } else if (initUnallocated > 0) {
                    await addItem('T_SCATEGORIE_OP', unallocData as any);
                }
            }

            // Reset other scat ops to preserve consistency
            for (const scatOp of existingScatOps) {
                if (Number(scatOp.ID_SCATEGORIE) !== Number(mainScatId) && Number(scatOp.ID_SCATEGORIE) !== Number(activeUnallocatedScatId)) {
                    await updateItem('T_SCATEGORIE_OP', scatOp.ID_SCATEGORIE_OP, {
                        ...scatOp,
                        MONTANT_INITIALE: 0,
                        MONTANT_FINALE: null
                    });
                }
            }
        });
    };

    const handleSave = async (table: keyof Database, data: any, idField: string) => {
        const targetTab = getTabForTable(table);
        navigate('OPERATION_DETAILS', operationId, targetTab);
        showToast('جاري الحفظ...', 'loading');
        try {
            let savedItem = data;
            if (data[idField]) {
                savedItem = await updateItem(table, data[idField], data);
                showToast('تم التعديل بنجاح', 'success');
            } else {
                savedItem = await addItem(table, data);
                showToast('تمت الإضافة بنجاح', 'success');
            }

            // Auto-update piece registration status
            if (table === 'T_ENGAGEMENT' && savedItem.ID_PIECE) {
                const piece = db.T_PIECE.find(p => p.ID_PIECE === Number(savedItem.ID_PIECE));
                if (piece && !piece.SAI_ENG) {
                    await updateItem('T_PIECE', piece.ID_PIECE, { ...piece, SAI_ENG: true });
                }
            } else if (table === 'T_PAIEMENT' && savedItem.ID_PIECE) {
                const piece = db.T_PIECE.find(p => p.ID_PIECE === Number(savedItem.ID_PIECE));
                if (piece && !piece.SAI_PAI) {
                    await updateItem('T_PIECE', piece.ID_PIECE, { ...piece, SAI_PAI: true });
                }
            }

            // Sync scategories if rubrique structure changed
            if (table === 'T_RUBRIQUE_OP' || table === 'T_OPERATION') {
                let currentRubriques = [...db.T_RUBRIQUE_OP.filter(r => Number(r.ID_OPERATION) === Number(operationId))];
                if (table === 'T_RUBRIQUE_OP') {
                    const idValue = (savedItem as any)[idField];
                    const existingIdx = idValue ? currentRubriques.findIndex(r => Number((r as any)[idField]) === Number(idValue)) : -1;
                    
                    if (existingIdx >= 0) {
                        currentRubriques[existingIdx] = savedItem;
                    } else {
                        currentRubriques.push(savedItem);
                    }

                    // Scan to detect if this rubrique represents 'Non-distributed amounts'
                    const rubrique = db.T_RUBRIQUE.find(r => Number(r.ID_RUBRIQUE) === Number(savedItem.ID_RUBRIQUE));
                    if (rubrique && isUnallocatedText(rubrique.RUBRIQUE)) {
                        console.log("رصد تعديل/إدخال في بند 'المبالغ غير الموزعة'. يتم الآن إرسال أمر تحديث ومزامنة تلقائي لجدول الأصناف الفرعية T_SCATEGORIE_OP.");
                    }
                }
                const opOverride = table === 'T_OPERATION' ? savedItem : operation;
                await syncStructureTables(currentRubriques, opOverride);
            }

            setModalState({ type: null }); 
        } catch (error) {
            console.error('Save error:', error);
            showToast(`حدث خطأ أثناء الحفظ — السبب: ${errorMessage(error)}`, 'error');
        }
    };

    const handleDelete = async (table: keyof Database, id: number, confirmMsg: string) => {
        if (canEdit && !isViewer) {
            // Confirmation ONLY — delete runs after user confirms in the modal
            setPendingDelete({ table, id, message: confirmMsg, kind: 'item' });
        } else {
            alert('ليس لديك صلاحية الحذف.');
        }
    };

    const confirmPendingDelete = async () => {
        const pending = pendingDelete;
        setPendingDelete(null);
        if (!pending) return;

        if (pending.kind === 'bordereau') {
            showToast('جاري الحذف...', 'loading');
            try {
                const linkedEngs = db.T_ENGAGEMENT.filter(eng => eng.ID_BORDEREAU === pending.id);
                for (const eng of linkedEngs) {
                    await updateItem('T_ENGAGEMENT', eng.ID_ENGAGEMENT, { ...eng, ID_BORDEREAU: null });
                }
                await deleteItem('T_BORDEREAU', pending.id);
                showToast('تم حذف جدول الإرسال بنجاح', 'success');
            } catch (error) {
                console.error(error);
                showToast(`حدث خطأ أثناء الحذف — السبب: ${errorMessage(error)}`, 'error');
            }
            return;
        }

        const targetTab = getTabForTable(pending.table);
        navigate('OPERATION_DETAILS', operationId, targetTab);
        showToast('جاري الحذف...', 'loading');
        try {
            await deleteItem(pending.table, pending.id);
            showToast('تم الحذف بنجاح', 'success');

            // Sync scategories if a rubrique was deleted
            if (pending.table === 'T_RUBRIQUE_OP') {
                const remainingRubriques = db.T_RUBRIQUE_OP.filter(r => Number(r.ID_OPERATION) === Number(operationId) && Number(r.ID_RUBRIQUE_OP) !== Number(pending.id));
                await syncStructureTables(remainingRubriques);
            }
        } catch (error) {
            showToast(`حدث خطأ أثناء الحذف — السبب: ${errorMessage(error)}`, 'error');
        }
    };

    const handleDeleteBordereau = async (id: number) => {
        if (canEdit && !isViewer) {
            setPendingDelete({ table: 'T_BORDEREAU', id, message: 'هل أنت متأكد من حذف جدول الإرسال هذا؟', kind: 'bordereau' });
        } else {
            alert('ليس لديك صلاحية الحذف.');
        }
    };

    const handleDownloadTemplate = async (type: 'LOTS' | 'ENGAGEMENTS' | 'PAIEMENTS') => {
        let headers: string[] = [];
        let fileName = '';
        switch (type) {
            case 'LOTS': headers = ['رقم الحصة', 'عنوان الحصة', 'المبلغ الأولي', 'المبلغ النهائي', 'حالة الإسناد']; fileName = 'نموذج_الحصص.xlsx'; break;
            case 'ENGAGEMENTS': headers = ['رقم الإلتزام', 'السنة', 'طبيعة الإلتزام', 'موضوع الإلتزام', 'موضوع الوثيقة', 'المبلغ', 'تاريخ الإلتزام', 'رقم التأشيرة', 'تاريخ التأشيرة']; fileName = 'نموذج_الإلتزامات.xlsx'; break;
            case 'PAIEMENTS': headers = ['رقم الدفع', 'السنة', 'موضوع الدفع', 'وثيقة الدفع', 'المبلغ', 'تاريخ الدفع', 'رقم الحوالة', 'تاريخ الحوالة', 'تاريخ القبول', 'مبلغ الأشغال', 'تسبيق جزافي', 'تسبيق تموين', 'اقتطاع ضمان', 'عقوبة تأخير', 'اقتطاع آخر', 'تسديد تسبيق جزافي', 'تسديد تسبيق تموين']; fileName = 'نموذج_الدفعات.xlsx'; break;
        }
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Template');
        worksheet.addRow(headers);
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        await saveBlobToFile(blob, fileName);
    };

    const handleLotsFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !canEdit || isViewer) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                showToast('جاري استيراد الحصص...', 'loading');
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

                let successCount = 0;
                await runInTransaction(async () => {
                    for (const row of json) {
                        const nLot = String(row['رقم الحصة'] || '').trim();
                        const intituleLot = String(row['عنوان الحصة'] || '').trim();
                        if (!nLot || !intituleLot) continue;
                        if (lots.find(l => l.N_LOT === nLot)) continue;
                        await addItem('T_LOT_OPERATION', {
                            ID_OPERATION: operationId, N_LOT: nLot, INTITULE_LOT: intituleLot,
                            MONTANT_INITIALE_LOT: parseCurrency(row['المبلغ الأولي']), MONTANT_FINALE_LOT: parseCurrency(row['المبلغ النهائي']),
                            ATTRIBUER: String(row['حالة الإسناد'] || '').trim() === 'مسندة'
                        });
                        successCount++;
                    }
                });
                if (successCount > 0) {
                    showToast(`تم استيراد ${successCount} حصص`, 'success');
                    broadcastEvent('import', `عدد ${successCount} من الحصص للعملية`);
                }
            } catch (error) { alert("فشل قراءة الملف."); } finally { if(event.target) event.target.value = ''; }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleEngagementsFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !canEdit || isViewer) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
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

                if (json.length === 0) return;

                json.sort((a, b) => {
                    const yearA = parseInt(a['السنة']) || 0;
                    const yearB = parseInt(b['السنة']) || 0;
                    if (yearA !== yearB) return yearA - yearB;
                    return (parseInt(a['رقم الإلتزام']) || 0) - (parseInt(b['رقم الإلتزام']) || 0);
                });

                const nextNumbersByYear: Record<string, number> = {};
                const errors: string[] = [];

                for (const [idx, row] of json.entries()) {
                    const rowNum = idx + 2;
                    const nEngStr = String(row['رقم الإلتزام'] || '').trim();
                    const annee = String(row['السنة'] || '').trim();
                    const pieceName = String(row['موضوع الوثيقة'] || '').trim();
                    
                    if (!nEngStr || !annee || !pieceName) {
                        errors.push(`السطر ${rowNum}: بيانات أساسية مفقودة.`);
                        continue;
                    }

                    const nEng = parseInt(nEngStr, 10);
                    const piece = operationPieces.find(p => p.PIECE.trim() === pieceName);
                    
                    if (!piece) {
                        errors.push(`السطر ${rowNum}: لم يتم العثور على وثيقة بعنوان "${pieceName}".`);
                    }

                    if (!nextNumbersByYear[annee]) {
                        const existingEngs = engagements.filter(e => e.ANNEE === annee);
                        const maxNum = existingEngs.length > 0 ? Math.max(...existingEngs.map(e => parseInt(e.N_ENG, 10) || 0)) : 0;
                        nextNumbersByYear[annee] = maxNum + 1;
                    }

                    if (nEng !== nextNumbersByYear[annee]) {
                        errors.push(`السطر ${rowNum}: خطأ في تسلسل الأرقام لسنة ${annee}. المتوقع ${String(nextNumbersByYear[annee]).padStart(2, '0')} ولكن وُجد ${nEngStr}.`);
                    } else {
                        nextNumbersByYear[annee]++;
                    }
                }

                if (errors.length > 0) {
                    alert("فشل الاستيراد بسبب أخطاء:\n\n" + errors.slice(0, 10).join('\n'));
                    return;
                }

                showToast('جاري استيراد الإلتزامات...', 'loading');
                let successCount = 0;
                await runInTransaction(async () => {
                    for (const row of json) {
                        const piece = operationPieces.find(p => p.PIECE.trim() === String(row['موضوع الوثيقة']).trim());
                        if (piece) {
                            await addItem('T_ENGAGEMENT', {
                                ID_OPERATION: operationId, 
                                ID_PIECE: piece.ID_PIECE, 
                                N_ENG: String(row['رقم الإلتزام']).trim().padStart(2, '0'), 
                                ANNEE: String(row['السنة']).trim(),
                                NATURE_ENG: String(row['طبيعة الإلتزام'] || '').trim(), 
                                OBJET_ENG: String(row['موضوع الإلتزام'] || '').trim(),
                                MONTANT_ENG: parseCurrency(row['المبلغ']), 
                                AE_ENG: 0, TOTAL_ENG_ANTERIEURE: 0, SOLDE_ANTERIEURE: 0, SOLDE_RELIQUAT: 0, 
                                DATE_ENG: normalizeDate(row['تاريخ الإلتزام']), 
                                N_VISA_CB: String(row['رقم التأشيرة'] || ''), 
                                DATE_VISA_CB: normalizeDate(row['تاريخ التأشيرة'])
                            });
                            
                            if (!piece.SAI_ENG) {
                                await updateItem('T_PIECE', piece.ID_PIECE, { ...piece, SAI_ENG: true });
                            }
                            successCount++;
                        }
                    }
                });
                showToast(`تم استيراد ${successCount} التزامات بنجاح`, 'success');
            } catch (error) { alert("حدث خطأ أثناء الاستيراد."); } finally { if(event.target) event.target.value = ''; }
        };
        reader.readAsArrayBuffer(file);
    };

    const handlePaiementsFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !canEdit || isViewer) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
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

                if (json.length === 0) return;

                json.sort((a, b) => {
                    const yearA = parseInt(a['السنة']) || 0;
                    const yearB = parseInt(b['السنة']) || 0;
                    if (yearA !== yearB) return yearA - yearB;
                    return (parseInt(a['رقم الدفع']) || 0) - (parseInt(b['رقم الدفع']) || 0);
                });

                const nextNumbersByYear: Record<string, number> = {};
                const errors: string[] = [];

                for (const [idx, row] of json.entries()) {
                    const rowNum = idx + 2;
                    const nPaiStr = String(row['رقم الدفع'] || '').trim();
                    const annee = String(row['السنة'] || '').trim();
                    const pieceName = String(row['وثيقة الدفع'] || '').trim();

                    if (!nPaiStr || !annee || !pieceName) {
                        errors.push(`السطر ${rowNum}: بيانات مفقودة.`);
                        continue;
                    }

                    const nPai = parseInt(nPaiStr, 10);
                    const piece = operationPieces.find(p => p.PIECE.trim() === pieceName);
                    
                    if (!piece) {
                        errors.push(`السطر ${rowNum}: لم يتم العثور على وثيقة "${pieceName}".`);
                    } else {
                        const relatedEngId = ['فاتورة', 'حكم قضائي'].includes(piece.NAT_PIECE)
                            ? (engagements.find(e => e.ID_PIECE === piece.ID_PIECE)?.ID_ENGAGEMENT || engagements.find(e => e.ID_PIECE === piece.ID_PIECE_INIT)?.ID_ENGAGEMENT)
                            : engagements.find(e => e.ID_PIECE === piece.ID_PIECE_INIT)?.ID_ENGAGEMENT;
                        
                        if (!relatedEngId) errors.push(`السطر ${rowNum}: الوثيقة ليس لها التزام.`);
                    }

                    if (!nextNumbersByYear[annee]) {
                        const existingPaiements = paiements.filter(p => p.ANNEE === annee);
                        const maxNum = existingPaiements.length > 0 ? Math.max(...existingPaiements.map(p => parseInt(p.N_PAI, 10) || 0)) : 0;
                        nextNumbersByYear[annee] = maxNum + 1;
                    }

                    if (nPai !== nextNumbersByYear[annee]) {
                        errors.push(`السطر ${rowNum}: خطأ في تسلسل سنة ${annee}. المتوقع ${String(nextNumbersByYear[annee]).padStart(2, '0')}.`);
                    } else {
                        nextNumbersByYear[annee]++;
                    }
                }

                if (errors.length > 0) {
                    alert("فشل الاستيراد:\n\n" + errors.slice(0, 10).join('\n'));
                    return;
                }

                showToast('جاري استيراد الدفعات...', 'loading');
                let successCount = 0;
                await runInTransaction(async () => {
                    for (const row of json) {
                        const piece = operationPieces.find(p => p.PIECE.trim() === String(row['وثيقة الدفع']).trim());
                        if (piece) {
                            const relatedEngId = ['فاتورة', 'حكم قضائي'].includes(piece.NAT_PIECE)
                                ? (engagements.find(e => e.ID_PIECE === piece.ID_PIECE)?.ID_ENGAGEMENT || engagements.find(e => e.ID_PIECE === piece.ID_PIECE_INIT)?.ID_ENGAGEMENT)
                                : engagements.find(e => e.ID_PIECE === piece.ID_PIECE_INIT)?.ID_ENGAGEMENT;

                            await addItem('T_PAIEMENT', {
                                ID_OPERATION: operationId, 
                                ID_ENG: relatedEngId!, 
                                ID_PIECE: piece.ID_PIECE, 
                                N_PAI: String(row['رقم الدفع']).trim().padStart(2, '0'), 
                                ANNEE: String(row['السنة']).trim(),
                                DATE_PAI: normalizeDate(row['تاريخ الدفع']), 
                                OBJET_PAI: String(row['موضوع الدفع'] || '').trim(), 
                                MONTANT_PAI: parseCurrency(row['المبلغ']),
                                TOTAL_PAI: 0, 
                                N_MANDAT: String(row['رقم الحوالة'] || ''), 
                                DATE_MANDAT: normalizeDate(row['تاريخ الحوالة']), 
                                DATE_ADMIS: normalizeDate(row['تاريخ القبول']),
                                MONTANT_TRAVAUX_REALISES: parseCurrency(row['مبلغ الأشغال']), 
                                AVANCE_FORFAITAIRE: parseCurrency(row['تسبيق جزافي']),
                                AVANCE_APPROVISIONNEMENT: parseCurrency(row['تسبيق تموين']), 
                                RETENUE_GARANTIE: parseCurrency(row['اقتطاع ضمان']),
                                PENALITE_RETARD: parseCurrency(row['عقوبة تأخير']), 
                                AUTRE_DEDUCTION: parseCurrency(row['اقتطاع آخر']),
                                REMBOURSEMENT_AVANCE_FORFAITAIRE: parseCurrency(row['تسديد تسبيق جزافي']), 
                                REMBOURSEMENT_AVANCE_APPROVISIONNEMENT: parseCurrency(row['تسديد تسبيق تموين']),
                            });

                            if (!piece.SAI_PAI) {
                                await updateItem('T_PIECE', piece.ID_PIECE, { ...piece, SAI_PAI: true });
                            }
                            successCount++;
                        }
                    }
                });
                showToast(`تم استيراد ${successCount} دفعات بنجاح`, 'success');
            } catch (error) { alert("حدث خطأ أثناء استيراد الدفعات."); } finally { if(event.target) event.target.value = ''; }
        };
        reader.readAsArrayBuffer(file);
    };

    const handlePrintNavigate = (page: Page, id: number, description: string) => {
        broadcastEvent('print', description);
        navigate(page, id);
    };

    const exportTableToExcel = (tableId: string, filename: string) => {
        const tableElement = document.getElementById(tableId);
        if (!tableElement) return;
        exportToFormattedExcel(tableElement.outerHTML, filename);
    };

    if (loading) return <div className="p-8 text-center">جار تحميل البيانات...</div>;
    if (!operation) return null; // Component will unmount soon due to the navigate() in useEffect

    return (
        <PageWrapper 
            title={operation.N_OPERATION} 
            navigate={navigate} 
            onGoBack={onGoBack}
            currentUser={currentUser}
            breadcrumb={[
                { label: t('page.operations'), page: 'OPERATIONS' }
            ]}
        >
            <div className="sticky top-0 z-20 bg-[#f8fafc] pb-4">
                {/* Header Info */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-4 flex flex-col md:flex-row justify-between items-start gap-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                            <span className="text-sm font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                                {operation.N_OPERATION}
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                operation.status === 'جارية' 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                    : 'bg-rose-50 text-rose-700 border-rose-100'
                            }`}>
                                {operation.status}
                            </span>
                        </div>
                        <h2 className="text-sm md:text-base font-bold text-gray-800 leading-tight">{operation.INT_OPERATION}</h2>
                        <div className="flex gap-4 mt-2 text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                            <span><i className="bi bi-folder-fill ml-1 text-blue-400"></i>الصنف: {categorie?.INT_CATEGORIE}</span>
                        </div>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-1 flex space-x-1 space-x-reverse overflow-x-auto no-scrollbar">
                    {[
                        { id: 'OVERVIEW', label: 'نظرة عامة', icon: 'bi-grid-1x2' },
                        { id: 'STRUCTURE', label: 'الهيكلة', icon: 'bi-diagram-3' },
                        { id: 'LOTS', label: 'الحصص', icon: 'bi-layers' },
                        { id: 'ENGAGEMENTS', label: 'الإلتزامات', icon: 'bi-pen' },
                        { id: 'PAIEMENTS', label: 'الدفعات', icon: 'bi-cash-stack' },
                        { id: 'BORDEREAUX', label: 'جداول الإرسال', icon: 'bi-send' },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`px-4 py-2 rounded-lg font-bold text-xs transition-all duration-200 flex items-center justify-center whitespace-nowrap shrink-0 flex-1
                                ${activeTab === tab.id
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
                                }`}
                        >
                            <i className={`bi ${tab.icon} ml-2`}></i>
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Areas */}
            {activeTab === 'OVERVIEW' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <Card title="رخصة الإلتزام" value={formatCurrency(totalAE)} icon="bi-journal-check" color="bg-blue-600" isLargeValue />
                        <Card title="مجموع الإلتزامات" value={formatCurrency(totalEngagedTotal)} icon="bi-pen" color="bg-amber-600" isLargeValue />
                        <Card title="مجموع اعتمادات الدفع" value={formatCurrency(totalCP)} icon="bi-calendar-check" color="bg-indigo-600" isLargeValue />
                        <Card title="مجموع الدفعات" value={formatCurrency(totalPaidTotal)} icon="bi-cash-coin" color="bg-emerald-600" isLargeValue />
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-6">
                            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <i className="bi bi-activity text-blue-500"></i>
                                    مؤشرات الإستهلاك الإجمالية
                                </h3>
                                <div className="space-y-6">
                                    <div>
                                        <div className="flex justify-between items-end mb-2">
                                            <span className="text-xs font-bold text-gray-600">إستهلاك رخصة الإلتزام (AE)</span>
                                            <span className="text-sm font-black text-blue-600">
                                                {totalAE > 0 ? ((totalEngagedTotal / totalAE) * 100).toFixed(1) : '0.0'}%
                                            </span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-3 border border-gray-200 overflow-hidden shadow-inner">
                                            <div className="bg-blue-600 h-full rounded-full transition-all duration-1000 shadow-lg shadow-blue-200" style={{ width: `${Math.min(100, (totalEngagedTotal / (totalAE || 1)) * 100)}%` }}></div>
                                        </div>
                                        <div className="flex justify-between mt-1 text-[10px] text-gray-400 font-bold">
                                            <span>إجمالي الإلتزامات: {formatCurrency(totalEngagedTotal)}</span>
                                            <span>رخصة AE المتبقية: {formatCurrency(remainingAE)}</span>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex justify-between items-end mb-2">
                                            <span className="text-xs font-bold text-gray-600">إستهلاك إعتمادات الدفع الكلية (CP)</span>
                                            <span className="text-sm font-black text-emerald-600">
                                                {totalCP > 0 ? ((totalPaidTotal / totalCP) * 100).toFixed(1) : '0.0'}%
                                            </span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-3 border border-gray-200 overflow-hidden shadow-inner">
                                            <div className="bg-emerald-600 h-full rounded-full transition-all duration-1000 shadow-lg shadow-emerald-200" style={{ width: `${Math.min(100, (totalPaidTotal / (totalCP || 1)) * 100)}%` }}></div>
                                        </div>
                                        <div className="flex justify-between mt-1 text-[10px] text-gray-400 font-bold">
                                            <span>إجمالي المدفوعات: {formatCurrency(totalPaidTotal)}</span>
                                            <span>إعتمادات CP المتبقية: {formatCurrency(totalCP - totalPaidTotal)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 h-full">
                                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <i className="bi bi-calendar3 text-indigo-500"></i>
                                    مؤشرات السنة المالية {selectedPaymentYear}
                                </h3>
                                <div className="space-y-2">
                                    <div className="p-1 bg-gray-50 rounded-lg border border-gray-100">
                                        <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">إعتماد الدفع (CP) للسنة</p>
                                        <p className="text-lg font-black text-indigo-700">{formatCurrency(cpYearAmount)}</p>
                                    </div>
                                    <div className="p-1 bg-emerald-50 rounded-lg border border-emerald-100">
                                        <p className="text-[10px] text-emerald-600 font-bold uppercase mb-1">مدفوعات السنة</p>
                                        <p className="text-lg font-black text-emerald-700">{formatCurrency(paidYearAmount)}</p>
                                    </div>
                                    <div className={`p-1 rounded-lg border ${remainingCpYear < 0 ? 'bg-rose-50 border-rose-100 text-rose-700' : 'bg-blue-50 border-blue-100 text-blue-700'}`}>
                                        <p className="text-[10px] font-bold uppercase mb-1">الرصيد المتبقي (CP) للسنة</p>
                                        <p className="text-lg font-black">{formatCurrency(remainingCpYear)}</p>
                                    </div>
                                    
                                    <div className="pt-1">
                                         <div className="flex justify-between items-end mb-1">
                                            <span className="text-[10px] font-bold text-gray-400">كفاءة استغلال CP السنة</span>
                                            <span className="text-xs font-black text-indigo-600">
                                                {cpYearAmount > 0 ? ((paidYearAmount / cpYearAmount) * 100).toFixed(1) : '0.0'}%
                                            </span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                            <div className="bg-indigo-600 h-full rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, (paidYearAmount / (cpYearAmount || 1)) * 100)}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'STRUCTURE' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    {/* CP Section */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <i className="bi bi-calendar-check text-blue-500"></i>
                                اعتمادات الدفع (CP)
                            </h3>
                            {!isViewer && (
                                <button onClick={() => handlePermissionCheck(() => setModalState({ type: 'CP', timestamp: Date.now() }))} className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-[10px] font-bold shadow-sm">
                                    <i className="bi bi-plus-lg ml-1"></i> إضافة CP
                                </button>
                            )}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-right" id="table-cp">
                                <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase font-bold tracking-wider">
                                    <tr>
                                        <th className="px-4 py-3 border-b">السنة</th>
                                        <th className="px-4 py-3 border-b">المبلغ الأولي</th>
                                        <th className="px-4 py-3 border-b">المبلغ النهائي</th>
                                        {!isViewer && <th className="px-4 py-3 border-b text-center">إجراءات</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {cps.map(cp => (
                                        <tr key={cp.ID_CP} className="hover:bg-blue-50/30 transition-colors group">
                                            <td className="px-4 py-3 text-xs font-mono font-bold text-gray-700">{cp.ANNEE}</td>
                                            <td className="px-4 py-3 text-xs font-medium text-gray-600">{formatCurrency(cp.MONTANT_INITIALE_CP)}</td>
                                            <td className="px-4 py-3 text-xs font-bold text-emerald-600">{formatCurrency(cp.MONTANT_FINALE_CP)}</td>
                                            {!isViewer && (
                                                <td className="px-4 py-3">
                                                    <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => handlePermissionCheck(() => setModalState({ type: 'CP', data: cp, timestamp: Date.now() }))} className="p-1 text-amber-500 hover:bg-amber-50 rounded"><i className="bi bi-pencil-square"></i></button>
                                                        <button onClick={() => handleDelete('T_CP', cp.ID_CP, 'حذف CP؟')} className="p-1 text-rose-500 hover:bg-rose-50 rounded"><i className="bi bi-trash3"></i></button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-gray-900 text-white font-bold text-xs">
                                    <tr>
                                        <td className="px-4 py-3">المجموع</td>
                                        <td className="px-4 py-3">{formatCurrency(totalCpInitial)}</td>
                                        <td className="px-4 py-3 text-emerald-400">{formatCurrency(totalCpFinal)}</td>
                                        {!isViewer && <td></td>}
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Rubriques Section */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <i className="bi bi-collection text-indigo-500"></i>
                                هيكلة الكلفة (Rubriques)
                            </h3>
                            {!isViewer && (
                                <button onClick={() => handlePermissionCheck(() => setModalState({ type: 'RUBRIQUE_OP', timestamp: Date.now() }))} className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-[10px] font-bold shadow-sm">
                                    <i className="bi bi-plus-lg ml-1"></i> إضافة هيكل
                                </button>
                            )}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-right" id="table-rubrique">
                                <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase font-bold tracking-wider">
                                    <tr>
                                        <th className="px-4 py-3 border-b">الهيكل</th>
                                        <th className="px-4 py-3 border-b">المبلغ الأولي</th>
                                        <th className="px-4 py-3 border-b">المبلغ النهائي</th>
                                        {!isViewer && <th className="px-4 py-3 border-b text-center">إجراءات</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {rubriquesOp.map(ro => (
                                        <tr key={ro.ID_RUBRIQUE_OP} className="hover:bg-blue-50/30 transition-colors group">
                                            <td className="px-4 py-3 text-xs font-bold text-gray-800">{db.T_RUBRIQUE.find(r => r.ID_RUBRIQUE === ro.ID_RUBRIQUE)?.RUBRIQUE}</td>
                                            <td className="px-4 py-3 text-xs font-medium text-gray-600">{formatCurrency(ro.MONTANT_INITIALE)}</td>
                                            <td className="px-4 py-3 text-xs font-bold text-blue-600">{formatCurrency(ro.MONTANT_FINALE ?? ro.MONTANT_INITIALE)}</td>
                                            {!isViewer && (
                                                <td className="px-4 py-3">
                                                    <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => handlePermissionCheck(() => setModalState({ type: 'RUBRIQUE_OP', data: ro, timestamp: Date.now() }))} className="p-1 text-amber-500 hover:bg-amber-50 rounded"><i className="bi bi-pencil-square"></i></button>
                                                        <button onClick={() => handleDelete('T_RUBRIQUE_OP', ro.ID_RUBRIQUE_OP, 'حذف هيكل؟')} className="p-1 text-rose-500 hover:bg-rose-50 rounded"><i className="bi bi-trash3"></i></button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-gray-900 text-white font-bold text-xs">
                                    <tr>
                                        <td className="px-4 py-3">المجموع</td>
                                        <td className="px-4 py-3"></td>
                                        <td className="px-4 py-3 text-blue-400">{formatCurrency(totalRubriqueAmount)}</td>
                                        {!isViewer && <td></td>}
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* Scategories Section */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <i className="bi bi-diagram-2 text-purple-500"></i>
                                الأصناف الفرعية (Sous-catégories)
                            </h3>
                            {!isViewer && (
                                <button onClick={() => handlePermissionCheck(() => setModalState({ type: 'SCATEGORIE_OP', timestamp: Date.now() }))} className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-[10px] font-bold shadow-sm">
                                    <i className="bi bi-plus-lg ml-1"></i> إضافة صنف
                                </button>
                            )}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-right" id="table-scat">
                                <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase font-bold tracking-wider">
                                    <tr>
                                        <th className="px-4 py-3 border-b">الرمز</th>
                                        <th className="px-4 py-3 border-b">العنوان</th>
                                        <th className="px-4 py-3 border-b">المبلغ الأولي</th>
                                        <th className="px-4 py-3 border-b">المبلغ النهائي</th>
                                        {!isViewer && <th className="px-4 py-3 border-b text-center">إجراءات</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {scategoriesOp.map(so => {
                                        const scat = db.T_SCATEGORIE.find(s => s.ID_SCATEGORIE === so.ID_SCATEGORIE);
                                        return (
                                            <tr key={so.ID_SCATEGORIE_OP} className="hover:bg-blue-50/30 transition-colors group">
                                                <td className="px-4 py-3 text-xs font-mono font-bold text-gray-500">{scat?.C_SCATEGORIE}</td>
                                                <td className="px-4 py-3 text-xs font-bold text-gray-800">{scat?.INT_SCATEGORIE}</td>
                                                <td className="px-4 py-3 text-xs font-medium text-gray-600">{formatCurrency(so.MONTANT_INITIALE)}</td>
                                                <td className="px-4 py-3 text-xs font-bold text-purple-600">{formatCurrency(so.MONTANT_FINALE ?? so.MONTANT_INITIALE)}</td>
                                                {!isViewer && (
                                                    <td className="px-4 py-3">
                                                        <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button onClick={() => handlePermissionCheck(() => setModalState({ type: 'SCATEGORIE_OP', data: so, timestamp: Date.now() }))} className="p-1 text-amber-500 hover:bg-amber-50 rounded"><i className="bi bi-pencil-square"></i></button>
                                                            <button onClick={() => handleDelete('T_SCATEGORIE_OP', so.ID_SCATEGORIE_OP, 'حذف صنف فرعي؟')} className="p-1 text-rose-500 hover:bg-rose-50 rounded"><i className="bi bi-trash3"></i></button>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot className="bg-gray-900 text-white font-bold text-xs">
                                    <tr>
                                        <td colSpan={2} className="px-4 py-3 text-center">المجموع</td>
                                        <td className="px-4 py-3"></td>
                                        <td className="px-4 py-3 text-purple-400">{formatCurrency(totalScatAmount)}</td>
                                        {!isViewer && <td></td>}
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'LOTS' && (
                <div id="lots-section" className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-center bg-gray-50/50 gap-4">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <i className="bi bi-layers text-blue-500"></i>
                            إدارة حصص العملية (Lots)
                        </h3>
                        <div className="flex gap-2 flex-wrap justify-center sm:justify-end">
                            {!isViewer && (
                                <>
                                    <button onClick={() => handlePermissionCheck(() => setModalState({ type: 'LOT', timestamp: Date.now() }))} className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-[10px] font-bold shadow-sm flex items-center">
                                        <i className="bi bi-plus-lg ml-1"></i> إضافة حصة
                                    </button>
                                    <button onClick={() => handleDownloadTemplate('LOTS')} className="px-3 py-1 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-[10px] font-bold flex items-center">
                                        <i className="bi bi-download ml-1"></i> نموذج
                                    </button>
                                    <button onClick={() => fileInputLotsRef.current?.click()} className="px-3 py-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-[10px] font-bold flex items-center">
                                        <i className="bi bi-upload ml-1"></i> استيراد
                                    </button>
                                    <input type="file" ref={fileInputLotsRef} onChange={handleLotsFileChange} className="hidden" accept=".xlsx, .xls" />
                                </>
                            )}
                            <button onClick={() => exportTableToExcel('table-lots', `lots_op_${operationId}.xls`)} className="px-3 py-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-[10px] font-bold flex items-center">
                                <i className="bi bi-file-earmark-excel ml-1"></i> تصدير
                            </button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-right" id="table-lots">
                            <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase font-bold tracking-wider sticky top-0 z-10 box-shadow-sm">
                                <tr>
                                    <th className="px-4 py-3 border-b">رقم الحصة</th>
                                    <th className="px-4 py-3 border-b">عنوان الحصة</th>
                                    <th className="px-4 py-3 border-b">المبلغ الأولي</th>
                                    <th className="px-4 py-3 border-b">المبلغ النهائي</th>
                                    <th className="px-4 py-3 border-b text-center">الحالة</th>
                                    {!isViewer && <th className="px-4 py-3 border-b text-center">إجراءات</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {lots.map(lot => (
                                    <tr 
                                        key={lot.ID_LOT} 
                                        id={`lots-row-${lot.ID_LOT}`}
                                        className="hover:bg-blue-50/30 transition-colors group"
                                    >
                                        <td className="px-4 py-3 text-xs font-mono font-bold text-gray-900">{lot.N_LOT}</td>
                                        <td className="px-4 py-3 text-xs font-bold text-gray-800">{lot.INTITULE_LOT}</td>
                                        <td className="px-4 py-3 text-xs font-medium text-gray-600">{formatCurrency(lot.MONTANT_INITIALE_LOT)}</td>
                                        <td className="px-4 py-3 text-xs font-bold text-blue-600">{formatCurrency(lot.MONTANT_FINALE_LOT)}</td>
                                        <td 
                                            className="px-4 py-3 text-center cursor-pointer hover:scale-105 transition-transform"
                                            onClick={() => {
                                                if (lot.ATTRIBUER) {
                                                    const lotPiece = db.T_LOT_PIECE.find(lp => lp.ID_LOT === lot.ID_LOT);
                                                    if (lotPiece) {
                                                        navigate('DOCUMENTS', lot.ID_OPERATION, lotPiece.ID_PIECE.toString());
                                                    }
                                                }
                                            }}
                                        >
                                            {lot.ATTRIBUER ? (
                                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100" title="انقر للتوجه للوثيقة">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                    مسندة
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-50 text-gray-500 border border-gray-200">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
                                                    غير مسندة
                                                </span>
                                            )}
                                        </td>
                                        {!isViewer && (
                                            <td className="px-4 py-3">
                                                <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => handlePermissionCheck(() => setModalState({ type: 'LOT', data: lot, timestamp: Date.now() }))} className="p-1 text-amber-500 hover:bg-amber-50 rounded"><i className="bi bi-pencil-square"></i></button>
                                                    <button onClick={() => handleDelete('T_LOT_OPERATION', lot.ID_LOT, 'حذف حصة؟')} className="p-1 text-rose-500 hover:bg-rose-50 rounded"><i className="bi bi-trash3"></i></button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-900 text-white font-bold text-xs">
                                <tr>
                                    <td colSpan={2} className="px-4 py-3 text-center">المجموع الإجمالي للحصص</td>
                                    <td className="px-4 py-3">{formatCurrency(totalLotInitial)}</td>
                                    <td className="px-4 py-3 text-blue-400">{formatCurrency(totalLotFinal)}</td>
                                    <td colSpan={isViewer ? 1 : 2}></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'ENGAGEMENTS' && (
                <div id="engagements-section" className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <i className="bi bi-pen text-blue-500"></i>
                                سجل الإلتزامات المالية
                            </h3>
                            <div className="flex gap-2">
                                {!isViewer && (
                                    <>
                                        <button onClick={() => handlePermissionCheck(() => setModalState({ type: 'ENGAGEMENT', timestamp: Date.now() }))} className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-[10px] font-bold shadow-sm flex items-center">
                                            <i className="bi bi-plus-lg ml-1"></i> إضافة إلتزام
                                        </button>
                                        <button onClick={() => fileInputEngagementsRef.current?.click()} className="px-3 py-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-[10px] font-bold flex items-center">
                                            <i className="bi bi-upload ml-1"></i> استيراد
                                        </button>
                                        <input type="file" ref={fileInputEngagementsRef} onChange={handleEngagementsFileChange} className="hidden" accept=".xlsx, .xls" />
                                    </>
                                )}
                                <button onClick={() => exportTableToExcel('table-eng', 'engagements.xls')} className="px-3 py-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-[10px] font-bold flex items-center">
                                    <i className="bi bi-file-earmark-excel ml-1"></i> تصدير
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">السنة المالية</label>
                                <CustomDropdown
                                    options={[{ value: '', label: 'كل السنوات' }, ...engYears.map(y => ({ value: y, label: y }))]}
                                    value={selectedEngYear}
                                    onChange={setSelectedEngYear}
                                    placeholder="تصفية حسب السنة"
                                    className="bg-white"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">اسم المستفيد</label>
                                <CustomDropdown
                                    options={[{ value: '', label: 'كل المستفيدين' }, ...engBeneficiaries.map(b => ({ value: b.ID_BENEFICIAIRE, label: b.BENEFICIAIRE }))]}
                                    value={selectedEngBeneficiaryId}
                                    onChange={setSelectedEngBeneficiaryId}
                                    placeholder="تصفية حسب المستفيد"
                                    className="bg-white"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">موضوع الإلتزام</label>
                                <CustomDropdown
                                    options={[{ value: '', label: 'كل المواضيع' }, ...engObjects.map(o => ({ value: o, label: o }))]}
                                    value={selectedEngObject}
                                    onChange={setSelectedEngObject}
                                    placeholder="البحث في المواضيع"
                                    className="bg-white"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto max-h-[calc(100vh-16rem)]">
                        <table className="w-full text-right" id="table-eng">
                            <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase font-bold tracking-wider sticky top-0 z-10 box-shadow-sm">
                                <tr>
                                    <th className="px-4 py-3 border-b">رقم / سنة</th>
                                    <th className="px-4 py-3 border-b">التاريخ</th>
                                    <th className="px-4 py-3 border-b">الطبيعة</th>
                                    <th className="px-4 py-3 border-b w-1/4">الموضوع</th>
                                    <th className="px-4 py-3 border-b">المستفيد</th>
                                    <th className="px-4 py-3 border-b">المبلغ</th>
                                    <th className="px-4 py-3 border-b">التأشيرة</th>
                                    <th className="px-4 py-3 border-b text-center">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredEngagements.map(eng => {
                                    const piece = operationPieces.find(p => p.ID_PIECE === eng.ID_PIECE);
                                    const beneficiary = piece?.ID_BENEFICIAIRE ? db.T_BENEFICIAIRE.find(b => b.ID_BENEFICIAIRE === piece.ID_BENEFICIAIRE) : null;
                                    
                                    return (
                                        <tr 
                                            key={eng.ID_ENGAGEMENT} 
                                            id={`engagements-row-${eng.ID_ENGAGEMENT}`}
                                            onClick={() => { setSelectedengagementId(eng.ID_ENGAGEMENT); }} 
                                            className={`cursor-pointer transition-all duration-200 group ${selectedengagementId === eng.ID_ENGAGEMENT ? 'bg-blue-100/90 ring-2 ring-inset ring-blue-500 font-semibold' : 'hover:bg-blue-50/50'}`}
                                        >
                                            <td className="px-4 py-3">
                                                <span className="font-mono text-xs font-bold text-gray-900">{eng.N_ENG} / {eng.ANNEE}</span>
                                            </td>
                                            <td className="px-4 py-3 text-[11px] font-medium text-gray-500" dir="ltr">{normalizeDate(eng.DATE_ENG)}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1 w-fit ${
                                                    (eng.NATURE_ENG === 'سحب' || eng.NATURE_ENG === 'إلغاء')
                                                        ? 'bg-rose-50 text-rose-700 border-rose-100' 
                                                        : (eng.NATURE_ENG === 'إعادة التقييم' || eng.NATURE_ENG === 'إنخفاض التقييم')
                                                        ? 'bg-amber-50 text-amber-700 border-amber-100'
                                                        : 'bg-blue-50 text-blue-700 border-blue-100'
                                                }`}>
                                                    {eng.NATURE_ENG === 'التزام' && <i className="bi bi-check-circle-fill text-emerald-500"></i>}
                                                    {(eng.NATURE_ENG === 'سحب' || eng.NATURE_ENG === 'إلغاء') && <i className="bi bi-x-circle-fill text-rose-500"></i>}
                                                    {(eng.NATURE_ENG === 'إعادة التقييم' || eng.NATURE_ENG === 'إنخفاض التقييم') && <i className="bi bi-exclamation-triangle-fill text-amber-500"></i>}
                                                    {eng.NATURE_ENG}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-[11px] font-medium text-gray-700 leading-snug">
                                                <div className="flex items-center gap-2 group/subj">
                                                    {eng.OBJET_ENG}
                                                    <button 
                                                        onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            navigate('DOCUMENTS', operationId, eng.ID_PIECE.toString() + ':blue'); 
                                                        }}
                                                        className="h-6 w-6 flex items-center justify-center text-blue-500 hover:bg-blue-50 rounded-full opacity-0 group-hover/subj:opacity-100 transition-opacity"
                                                        title="انتقل إلى الوثيقة"
                                                    >
                                                        <i className="bi bi-box-arrow-up-right text-[10px]"></i>
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-[11px] font-bold text-gray-600">{beneficiary?.BENEFICIAIRE || '---'}</td>
                                            <td className={`px-4 py-3 text-xs font-black ${eng.NATURE_ENG === 'سحب' ? 'text-rose-700' : 'text-blue-900'}`}>{formatCurrency(eng.MONTANT_ENG)}</td>
                                            <td className="px-4 py-3">
                                                {eng.N_VISA_CB ? (
                                                    <div className="flex flex-col">
                                                        <span className="text-emerald-700 text-[10px] font-black flex items-center gap-1">
                                                            <i className="bi bi-patch-check-fill"></i> {eng.N_VISA_CB}
                                                        </span>
                                                        <span className="text-[9px] text-emerald-600/70 font-bold" dir="ltr">{normalizeDate(eng.DATE_VISA_CB)}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-rose-500 text-[10px] font-bold flex items-center gap-1">
                                                        <i className="bi bi-hourglass-split"></i> قيد التأشير
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex justify-center gap-2">
                                                    {!isViewer && (
                                                        <>
                                                            <button onClick={() => handlePermissionCheck(() => setModalState({ type: 'ENGAGEMENT', data: eng, timestamp: Date.now() }))} className="p-1 text-amber-500 hover:bg-amber-50 rounded" title="تعديل"><i className="bi bi-pencil-square"></i></button>
                                                            <button onClick={() => handleDelete('T_ENGAGEMENT', eng.ID_ENGAGEMENT, 'حذف التزام؟')} className="p-1 text-rose-500 hover:bg-rose-50 rounded" title="حذف"><i className="bi bi-trash3"></i></button>
                                                        </>
                                                    )}
                                                    <button onClick={(e) => { e.stopPropagation(); handlePrintNavigate('PRINT_ENGAGEMENT', eng.ID_ENGAGEMENT, `بطاقة التزام رقم ${eng.N_ENG}`); }} className="p-1 text-gray-600 hover:bg-gray-100 rounded" title="طباعة">
                                                        <i className="bi bi-printer"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="p-4 bg-gray-900 text-white font-bold text-xs flex justify-between items-center">
                        <span className="text-gray-400">إجمالي الالتزامات المعروضة:</span>
                        <span className="text-blue-400 text-sm tracking-wide ltr">{formatCurrency(totalEngAmount)}</span>
                    </div>
                </div>
            )}

            {activeTab === 'PAIEMENTS' && (
                <div id="paiements-section" className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <i className="bi bi-wallet2 text-emerald-500"></i>
                                سجل المدفوعات (Paiements)
                            </h3>
                            <div className="flex gap-2">
                                {!isViewer && (
                                    <>
                                        <button onClick={() => handlePermissionCheck(() => setModalState({ type: 'PAIEMENT', timestamp: Date.now() }))} className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-[10px] font-bold shadow-sm flex items-center">
                                            <i className="bi bi-plus-lg ml-1"></i> إضافة دفع
                                        </button>
                                        <button onClick={() => fileInputPaiementsRef.current?.click()} className="px-3 py-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-[10px] font-bold flex items-center">
                                            <i className="bi bi-upload ml-1"></i> استيراد
                                        </button>
                                        <input type="file" ref={fileInputPaiementsRef} onChange={handlePaiementsFileChange} className="hidden" accept=".xlsx, .xls" />
                                    </>
                                )}
                                <button onClick={() => exportTableToExcel('table-pai', 'paiements.xls')} className="px-3 py-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-[10px] font-bold flex items-center">
                                    <i className="bi bi-file-earmark-excel ml-1"></i> تصدير
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">السنة المالية</label>
                                <CustomDropdown
                                    options={[{ value: '', label: 'كل السنوات' }, ...paiYears.map(y => ({ value: y, label: y }))]}
                                    value={selectedPaiYear}
                                    onChange={setSelectedPaiYear}
                                    placeholder="تصفية حسب السنة"
                                    className="bg-white"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">اسم المستفيد</label>
                                <CustomDropdown
                                    options={[{ value: '', label: 'كل المستفيدين' }, ...paiBeneficiaries.map(b => ({ value: b.ID_BENEFICIAIRE, label: b.BENEFICIAIRE }))]}
                                    value={selectedPaiBeneficiaryId}
                                    onChange={setSelectedPaiBeneficiaryId}
                                    placeholder="تصفية حسب المستفيد"
                                    className="bg-white"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">موضوع الدفع</label>
                                <CustomDropdown
                                    options={[{ value: '', label: 'كل المواضيع' }, ...paiObjects.map(o => ({ value: o, label: o }))]}
                                    value={selectedPaiObject}
                                    onChange={setSelectedPaiObject}
                                    placeholder="البحث في المواضيع"
                                    className="bg-white"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto max-h-[calc(100vh-16rem)]" onScroll={() => setPrintMenu(null)}>
                        <table className="w-full text-right" id="table-pai">
                            <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase font-bold tracking-wider sticky top-0 z-10 box-shadow-sm">
                                <tr>
                                    <th className="px-4 py-3 border-b">رقم / سنة</th>
                                    <th className="px-4 py-3 border-b">التاريخ</th>
                                    <th className="px-4 py-3 border-b w-1/4">الموضوع</th>
                                    <th className="px-4 py-3 border-b">المستفيد</th>
                                    <th className="px-4 py-3 border-b">المبلغ</th>
                                    <th className="px-4 py-3 border-b">بيانات الحوالة</th>
                                    <th className="px-4 py-3 border-b text-center">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredPaiements.map(pai => {
                                    const piece = operationPieces.find(p => p.ID_PIECE === pai.ID_PIECE);
                                    const beneficiary = piece?.ID_BENEFICIAIRE ? db.T_BENEFICIAIRE.find(b => b.ID_BENEFICIAIRE === piece.ID_BENEFICIAIRE) : null;

                                    return (
                                        <tr 
                                            key={pai.ID_PAIEMENT} 
                                            id={`paiements-row-${pai.ID_PAIEMENT}`}
                                            onClick={() => { setSelectedpaiementId(pai.ID_PAIEMENT); }} 
                                            className={`cursor-pointer transition-all duration-200 group ${selectedpaiementId === pai.ID_PAIEMENT ? 'bg-blue-100/90 ring-2 ring-inset ring-blue-500 font-semibold' : 'hover:bg-blue-50/50'}`}
                                        >
                                            <td className="px-4 py-3 text-xs font-mono font-bold text-gray-900">{pai.N_PAI} / {pai.ANNEE}</td>
                                            <td className="px-4 py-3 text-[11px] font-medium text-gray-500" dir="ltr">{normalizeDate(pai.DATE_PAI)}</td>
                                            <td className="px-4 py-3 text-[11px] font-medium text-gray-700 leading-snug">
                                                <div className="flex items-center gap-2 group/subj">
                                                    {pai.OBJET_PAI}
                                                    <button 
                                                        onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            navigate('DOCUMENTS', operationId, pai.ID_PIECE.toString() + ':blue'); 
                                                        }}
                                                        className="h-6 w-6 flex items-center justify-center text-blue-500 hover:bg-blue-50 rounded-full opacity-0 group-hover/subj:opacity-100 transition-opacity"
                                                        title="انتقل إلى الوثيقة"
                                                    >
                                                        <i className="bi bi-box-arrow-up-right text-[10px]"></i>
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-[11px] font-bold text-gray-600">{beneficiary?.BENEFICIAIRE || '---'}</td>
                                            <td className="px-4 py-3 text-xs font-black text-emerald-700">{formatCurrency(pai.MONTANT_PAI)}</td>
                                            <td className="px-4 py-3">
                                                {pai.N_MANDAT ? (
                                                    <div className="flex flex-col">
                                                        <span className="text-blue-700 text-[10px] font-black flex items-center gap-1">
                                                            <i className="bi bi-file-earmark-text-fill"></i> {pai.N_MANDAT}
                                                        </span>
                                                        <span className="text-[9px] text-blue-600/70 font-bold" dir="ltr">{normalizeDate(pai.DATE_MANDAT)}</span>
                                                        {pai.DATE_ADMIS && (
                                                            <span className="text-[9px] text-emerald-600 font-bold mt-0.5 flex items-center gap-1">
                                                                <i className="bi bi-check-circle-fill"></i> مقبول {normalizeDate(pai.DATE_ADMIS)}
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400 text-[10px] font-bold">---</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex justify-center gap-2">
                                                    {!isViewer && (
                                                        <>
                                                            <button onClick={() => handlePermissionCheck(() => setModalState({ type: 'PAIEMENT', data: pai, timestamp: Date.now() }))} className="p-1 text-amber-500 hover:bg-amber-50 rounded" title="تعديل"><i className="bi bi-pencil-square"></i></button>
                                                            <button onClick={() => handleDelete('T_PAIEMENT', pai.ID_PAIEMENT, 'حذف دفع؟')} className="p-1 text-rose-500 hover:bg-rose-50 rounded" title="حذف"><i className="bi bi-trash3"></i></button>
                                                        </>
                                                    )}
                                                    <button onClick={(e) => handlePrintClick(e, pai.ID_PAIEMENT)} className="p-1 text-gray-600 hover:bg-gray-100 rounded" title="طباعة">
                                                        <i className="bi bi-printer"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="p-4 bg-gray-900 text-white font-bold text-xs flex justify-between items-center">
                        <span className="text-gray-400">إجمالي المدفوعات المعروضة:</span>
                        <span className="text-emerald-400 text-sm tracking-wide ltr">{formatCurrency(totalPaiAmount)}</span>
                    </div>
                </div>
            )}

            {activeTab === 'BORDEREAUX' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <i className="bi bi-send-check text-blue-500"></i>
                            جداول الإرسال (Bordereaux)
                        </h3>
                        {!isViewer && (
                            <button 
                                onClick={() => handlePermissionCheck(() => setModalState({ type: 'BORDEREAU', timestamp: Date.now() }))}
                                className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-[10px] font-bold shadow-sm"
                            >
                                <i className="bi bi-plus-lg ml-1"></i> إضافة جدول إرسال
                            </button>
                        )}
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-right" id="table-bordereaux">
                            <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase font-bold tracking-wider">
                                <tr>
                                    <th className="px-4 py-3 border-b">رقم جدول الإرسال</th>
                                    <th className="px-4 py-3 border-b">السنة</th>
                                    <th className="px-4 py-3 border-b">التاريخ</th>
                                    <th className="px-4 py-3 border-b">المرسل إليه</th>
                                    <th className="px-4 py-3 border-b">الوثائق المرفقة</th>
                                    <th className="px-4 py-3 border-b text-center">إجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {bordereaux.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-8 text-center text-gray-400 italic text-xs">لا توجد جداول إرسال مسجلة لهذه العملية.</td>
                                    </tr>
                                ) : (
                                    bordereaux.map((bor) => {
                                        const linkedEngs = db.T_ENGAGEMENT.filter(e => e.ID_BORDEREAU === bor.ID_BORDEREAU);
                                        const docsList = linkedEngs.map(eng => {
                                            const piece = db.T_PIECE.find(p => p.ID_PIECE === eng.ID_PIECE);
                                            return {
                                                n_eng: eng.N_ENG,
                                                annee: eng.ANNEE,
                                                pieceStr: piece?.PIECE || eng.BORD_OBJET || 'التزام'
                                            };
                                        });

                                        return (
                                            <tr key={bor.ID_BORDEREAU} className="hover:bg-blue-50/30 transition-colors group">
                                                <td className="px-4 py-3 text-xs font-mono font-bold text-gray-900">{bor.N_BORDEREAU}</td>
                                                <td className="px-4 py-3 text-xs font-bold text-gray-500">{bor.ANNEE}</td>
                                                <td className="px-4 py-3 text-[11px] font-medium text-gray-500" dir="ltr">{normalizeDate(bor.DATE_BORDEREAU)}</td>
                                                <td className="px-4 py-3 text-[11px] font-bold text-gray-700">{bor.DESTINATAIRE}</td>
                                                <td className="px-4 py-3 text-[11px] text-gray-700">
                                                    {docsList.length === 0 ? (
                                                        <span className="text-gray-400 italic">-- بدون وثائق --</span>
                                                    ) : (
                                                        <div className="flex flex-col gap-1.5 max-w-[340px] max-h-[140px] overflow-y-auto text-right font-medium">
                                                            {docsList.map((doc, idx) => (
                                                                <div key={idx} className="bg-sky-50/65 border border-sky-100 rounded px-2.5 py-1 text-gray-800 leading-relaxed shadow-sm">
                                                                    <span className="font-bold text-blue-700 block text-[10px] mb-0.5">بطاقة: {doc.n_eng}/{doc.annee}</span>
                                                                    <span className="text-[10px] text-gray-700 break-words">{doc.pieceStr}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button 
                                                            onClick={() => handlePrintNavigate('PRINT_BORDEREAU', bor.ID_BORDEREAU, 'جدول إرسال')}
                                                            className="p-1 text-gray-600 hover:bg-gray-100 rounded"
                                                            title="طباعة"
                                                        >
                                                            <i className="bi bi-printer"></i>
                                                        </button>
                                                        {!isViewer && (
                                                            <>
                                                                <button 
                                                                    onClick={() => handlePermissionCheck(() => setModalState({ type: 'BORDEREAU', data: bor, timestamp: Date.now() }))}
                                                                    className="p-1 text-amber-500 hover:bg-amber-50 rounded"
                                                                    title="تعديل"
                                                                >
                                                                    <i className="bi bi-pencil-square"></i>
                                                                </button>
                                                                <button 
                                                                    onClick={() => handleDeleteBordereau(bor.ID_BORDEREAU)}
                                                                    className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                                                                    title="حذف"
                                                                >
                                                                    <i className="bi bi-trash3"></i>
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {printMenu && ( activeTab === 'PAIEMENTS' ) && (
                <div 
                    className="fixed bg-white border border-gray-200 shadow-xl rounded-md z-[100] py-1 w-48"
                    style={{ top: printMenu.top, left: printMenu.left }}
                >
                    <button onClick={() => handlePrintNavigate('PRINT_PAIEMENT', printMenu.id, 'بطاقة دفع')} className="block w-full text-right px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors">
                        <i className="bi bi-card-heading ml-2"></i> بطاقة الدفع
                    </button>
                    <button onClick={() => handlePrintNavigate('PRINT_CERTIFICAT', printMenu.id, 'شهادة دفع')} className="block w-full text-right px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors">
                        <i className="bi bi-patch-check ml-2"></i> شهادة الدفع
                    </button>
                    <button onClick={() => handlePrintNavigate('PRINT_MANDAT', printMenu.id, 'حوالة دفع')} className="block w-full text-right px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors">
                        <i className="bi bi-file-text ml-2"></i> حوالة الدفع
                    </button>
                    <button onClick={() => handlePrintNavigate('PRINT_DECLARATION', printMenu.id, 'إعلان دفع')} className="block w-full text-right px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors">
                        <i className="bi bi-megaphone ml-2"></i> إعلان بالدفع
                    </button>
                    <button onClick={() => handlePrintNavigate('PRINT_MANDAT_TABLE', printMenu.id, 'جدول حوالة')} className="block w-full text-right px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors">
                        <i className="bi bi-table ml-2"></i> جدول الحوالة
                    </button>
                </div>
            )}

            <Modal isOpen={modalState.type === 'CP'} onClose={() => setModalState({ type: null })} title={modalState.data ? "تعديل اعتمادات الدفع" : "إضافة اعتمادات الدفع"}>
                <AddCpForm 
                    key={modalState.timestamp ? `cp-${modalState.timestamp}` : 'add-cp'}
                    onClose={() => setModalState({ type: null })} 
                    onSave={(data) => handleSave('T_CP', data, 'ID_CP')} 
                    operationId={operationId} 
                    initialData={modalState.data} 
                    selectedYear={selectedPaymentYear}
                />
            </Modal>
            <Modal isOpen={modalState.type === 'RUBRIQUE_OP'} onClose={() => setModalState({ type: null })} title={modalState.data ? "تعديل هيكل الكلفة" : "إضافة هيكل الكلفة"}>
                <AddRubriqueOpForm 
                    key={modalState.timestamp ? `rub-${modalState.timestamp}` : 'add-rub'}
                    onClose={() => setModalState({ type: null })} 
                    onSave={(data) => handleSave('T_RUBRIQUE_OP', data, 'ID_RUBRIQUE_OP')} 
                    operationId={operationId} 
                    rubriques={availableRubriques} 
                    initialData={modalState.data} 
                />
            </Modal>
            <Modal isOpen={modalState.type === 'SCATEGORIE_OP'} onClose={() => setModalState({ type: null })} title={modalState.data ? "تعديل صنف فرعي" : "إضافة صنف فرعي"}>
                <AddScategorieOpForm 
                    key={modalState.timestamp ? `scat-${modalState.timestamp}` : 'add-scat'}
                    onClose={() => setModalState({ type: null })} 
                    onSave={(data) => handleSave('T_SCATEGORIE_OP', data, 'ID_SCATEGORIE_OP')} 
                    operationId={operationId} 
                    scategories={availableScategories} 
                    initialData={modalState.data} 
                />
            </Modal>
            <Modal isOpen={modalState.type === 'LOT'} onClose={() => setModalState({ type: null })} title={modalState.data ? "تعديل حصة" : "إضافة حصة"}>
                <AddLotForm 
                    key={modalState.timestamp ? `lot-${modalState.timestamp}` : 'add-lot'}
                    onClose={() => setModalState({ type: null })} 
                    onSave={(data) => handleSave('T_LOT_OPERATION', data, 'ID_LOT')} 
                    operationId={operationId} 
                    initialData={modalState.data} 
                />
            </Modal>
            <Modal isOpen={modalState.type === 'ENGAGEMENT'} onClose={() => setModalState({ type: null })} title={modalState.data ? "تعديل التزام" : "إضافة التزام"} maxWidth="2xl">
                <AddEngagementForm 
                    key={modalState.timestamp ? `eng-${modalState.timestamp}` : 'add-eng'}
                    onClose={() => setModalState({ type: null })} 
                    onSave={(data) => handleSave('T_ENGAGEMENT', data, 'ID_ENGAGEMENT')} 
                    operationId={operationId} 
                    pieces={operationPieces} 
                    rubriqueOps={rubriquesOp} 
                    initialData={modalState.data}
                    allEngagementsForOp={engagements}
                    selectedYear={selectedPaymentYear}
                    defaultPieceId={modalState.extraData?.defaultPieceId}
                />
            </Modal>
            <Modal isOpen={modalState.type === 'PAIEMENT'} onClose={() => setModalState({ type: null })} title={modalState.data ? "تعديل دفع" : "إضافة دفع"} maxWidth="2xl">
                <AddPaiementForm 
                    key={modalState.timestamp ? `pai-${modalState.timestamp}` : 'add-pai'}
                    onClose={() => setModalState({ type: null })} 
                    onSave={(data) => handleSave('T_PAIEMENT', data, 'ID_PAIEMENT')} 
                    operationId={operationId} 
                    engagements={engagements} 
                    pieces={operationPieces} 
                    cpItems={db.T_CP}
                    initialData={modalState.data} 
                    allPaiementsForOp={paiements}
                    selectedYear={selectedPaymentYear}
                    defaultPieceId={modalState.extraData?.defaultPieceId}
                />
            </Modal>
            <Modal isOpen={modalState.type === 'BORDEREAU'} onClose={() => setModalState({ type: null })} title={modalState.data ? "تعديل جدول إرسال" : "إضافة جدول إرسال"}>
                <AddBordereauForm 
                    key={modalState.timestamp ? `bor-${modalState.timestamp}` : 'add-bor'}
                    operationId={operationId}
                    onClose={() => setModalState({ type: null })}
                    editItem={modalState.data}
                />
            </Modal>
            <ConfirmActionModal
                isOpen={!!pendingDelete}
                title="تأكيد الحذف"
                message={pendingDelete?.message || 'هل أنت متأكد من الحذف؟'}
                onCancel={() => setPendingDelete(null)}
                onConfirm={confirmPendingDelete}
            />
        </PageWrapper>
    );
};

export default OperationDetailsPage;