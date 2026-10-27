import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Piece, Operation, Beneficiaire, Rubrique, RubriqueOp, Scategorie, ScategorieOp, CompteBancaire, Ods, Engagement, LotOperation, LotPiece, Cp, Paiement } from '../../types';
import { normalizeDate, parseDate, getEffectiveDurationDays, isFinancialDuration, calculateElapsedDays } from '../../utils/dateUtils';
import { DateInputField } from '../DateInputField';
import { formatCurrency, parseCurrency, formatAmountInput, formatCurrencyForInput } from '../../utils/currencyUtils';
import CustomDropdown from '../CustomDropdown';


interface AddDocumentFormProps {
    onClose: () => void;
    onSave: (document: any) => void | Promise<void>;
    operations: Operation[];
    beneficiaires: Beneficiaire[];
    comptesBancaires: CompteBancaire[];
    pieces: Piece[];
    engagements: Engagement[];
    paiements: Paiement[];
    cps: Cp[];
    rubriques: Rubrique[];
    rubriqueOps: RubriqueOp[];
    scategories: Scategorie[];
    scategorieOps: ScategorieOp[];
    initialData?: Piece;
    lots: LotOperation[];
    lotPieces: LotPiece[];
    ods?: Ods[]; // Pass ODS for deadline validation
    selectedOperationId?: number | null;
}

const pieceTypes = ["مقرر", "اتفاقية", "صفقة", "ملحق", "قرار فسخ", "وضعية الأشغال", "فاتورة", "وضعية التسبيق الجزافي", "وضعية التسبيق على التموين", "قرار", "حكم قضائي", "رفع اليد عن الضمان", "أخرى"];

const AddDocumentForm: React.FC<AddDocumentFormProps> = ({ onClose, onSave, operations, beneficiaires, comptesBancaires, pieces, engagements, paiements, cps, rubriques, rubriqueOps, scategories, scategorieOps, initialData, lots, lotPieces, ods = [], selectedOperationId }) => {
    // Basic fields state
    const [natPiece, setNatPiece] = useState(pieceTypes[0]);
    const [idOperation, setIdOperation] = useState<number | ''>('');
    const [piece, setPiece] = useState('');
    const [idBeneficiaire, setIdBeneficiaire] = useState<number | null>(null);
    const [idCompte, setIdCompte] = useState<number | null>(null);
    const [montantPieceStr, setMontantPieceStr] = useState('0');
    const [idRubrique, setIdRubrique] = useState<number | null>(null);
    const [idScat, setIdScat] = useState<number | null>(null);
    const [saiEng, setSaiEng] = useState(false);
    const [saiPai, setSaiPai] = useState(false);

    // Conditional fields state
    const [delaiExVal, setDelaiExVal] = useState<string>('');
    const [delaiExUnit, setDelaiExUnit] = useState<'days' | 'months'>('days');

    const [idPieceInit, setIdPieceInit] = useState<number | null>(null);
    const [nVisaCm, setNVisaCm] = useState<string>('');
    const [dateVisaCm, setDateVisaCm] = useState<string>('');
    const [caution, setCaution] = useState<string>('5%');
    const [cautionType, setCautionType] = useState<string>('BANK');
    const [isFieldsLocked, setIsFieldsLocked] = useState(false);
    const [pieceValidationMessage, setPieceValidationMessage] = useState<string | null>(null);
    const [pieceValidationType, setPieceValidationType] = useState<'error' | 'warning'>('error');

    // Protection Refs
    const isDirty = useRef(false);
    const isEditLoaded = useRef(false);

    const markDirty = () => { isDirty.current = true; };

    const getNextWorkStatementNumber = useCallback((parentId: number | null) => {
        if (!parentId) return '01';
        const previous = pieces.filter((p: any) => 
            p.ID_PIECE_INIT === parentId && 
            p.NAT_PIECE === 'وضعية الأشغال' &&
            p.ID_PIECE !== initialData?.ID_PIECE
        );
        let maxNum = 0;
        previous.forEach(p => {
            const match = p.PIECE.match(/رقم:?\s*(\d+)/);
            if (match) {
                const val = parseInt(match[1], 10);
                if (val > maxNum) maxNum = val;
            }
        });
        const nextNum = maxNum > 0 ? maxNum + 1 : previous.length + 1;
        return String(nextNum).padStart(2, '0');
    }, [pieces, initialData]);

    const getSubjectDefault = useCallback((nature: string, parentId: number | null) => {
        switch (nature) {
            case 'مقرر':
                return 'مقرر التسجيل رقم: ';
            case 'قرار فسخ':
                return 'قرار الفسخ رقم: ';
            case 'اتفاقية':
                return 'اتفاقية رقم: ';
            case 'صفقة':
                return 'صفقة رقم: ';
            case 'فاتورة':
                return 'فاتورة رقم: ';
            case 'وضعية الأشغال':
                if (parentId) {
                    const nextNumStr = getNextWorkStatementNumber(parentId);
                    return `وضعية الأشغال رقم: ${nextNumStr} في: `;
                }
                return 'وضعية الأشغال رقم: ';
            case 'ملحق':
                if (parentId) {
                    const previous = pieces.filter((p: any) => 
                        p.ID_PIECE_INIT === parentId && 
                        p.NAT_PIECE === 'ملحق' &&
                        p.ID_PIECE !== initialData?.ID_PIECE
                    );
                    const numStr = String(previous.length + 1).padStart(2, '0');
                    return `ملحق رقم: ${numStr}`;
                }
                return 'ملحق رقم: ';
            case 'وضعية التسبيق الجزافي':
                return 'وضعية التسبيق الجزافي في: ';
            case 'وضعية التسبيق على التموين':
                return 'وضعية التسبيق على التموين في: ';
            default:
                return '';
        }
    }, [getNextWorkStatementNumber, pieces, initialData]);

    const updatePieceSubject = useCallback((nature: string, parentId: number | null) => {
        if (!parentId || initialData) return;
        const parentPiece = pieces.find(p => p.ID_PIECE === parentId);
        if (!parentPiece) return;

        // Use our direct specific mappings for statement/payment/amendment types to comply with user rules
        if (nature === 'ملحق' || nature === 'وضعية الأشغال' || nature === 'وضعية التسبيق الجزافي' || nature === 'وضعية التسبيق على التموين') {
            const specificSubject = getSubjectDefault(nature, parentId);
            if (specificSubject) {
                setPiece(specificSubject);
                return;
            }
        }

        let subject = nature;
        
        // Find sequence number for specific types
        if (nature === 'وضعية الأشغال') {
            const nextNumStr = getNextWorkStatementNumber(parentId);
            setPiece(`وضعية الأشغال رقم: ${nextNumStr} في: `);
            return;
        }

        let generatedObject = `${subject} المتعلقة بـ ${parentPiece.PIECE}`;

        // Try to get visa info from engagements or piece itself
        const parentEngagement = engagements.find(e => Number(e.ID_PIECE) === parentId);
        if (parentEngagement && parentEngagement.N_VISA_CB) {
            const nVisa = parentEngagement.N_VISA_CB;
            const dateVisa = normalizeDate(parentEngagement.DATE_VISA_CB);
            generatedObject += ` (تأشيرة م.م رقم: ${nVisa} بتاريخ: ${dateVisa})`;
        } else if (parentPiece.N_VISA_CM) {
            const nVisa = parentPiece.N_VISA_CM;
            const dateVisa = normalizeDate(parentPiece.DATE_VISA_CM);
            generatedObject += ` (تأشيرة ل.ص رقم: ${nVisa} بتاريخ: ${dateVisa})`;
        }

        setPiece(generatedObject);
    }, [pieces, initialData, engagements, getNextWorkStatementNumber, getSubjectDefault]);

    const availableAccounts = useMemo(() => {
        if (!idBeneficiaire) return [];
        return comptesBancaires.filter(acc => acc.ID_BENEFICIAIRE === idBeneficiaire);
    }, [idBeneficiaire, comptesBancaires]);

    const calculateTerminationAmount = useCallback((parentId: number | null) => {
        if (!parentId) return 0;
        const parentPiece = pieces.find(p => p.ID_PIECE === parentId);
        if (!parentPiece) return 0;

        const linkedPieces = pieces.filter(p => p.ID_PIECE === parentId || p.ID_PIECE_INIT === parentId);
        const linkedPieceIds = linkedPieces.map(p => p.ID_PIECE);

        // 1. Calculate New Contract Amount (المبلغ الجديد للصفقة)
        const relatedEngs = engagements.filter(e => linkedPieceIds.includes(Number(e.ID_PIECE)));
        let newContractAmount = 0;
        if (relatedEngs.length > 0) {
            newContractAmount = relatedEngs.reduce((sum, e) => {
                let amt = e.MONTANT_ENG;
                if (['إلغاء', 'إنخفاض التقييم'].includes(e.NATURE_ENG)) amt = -amt;
                return sum + amt;
            }, 0);
        } else {
            const baseAmt = parentPiece.MONTANT_PIECE;
            const amendmentsAmt = pieces
                .filter(p => p.ID_PIECE_INIT === parentId && p.NAT_PIECE === 'ملحق' && p.ID_PIECE !== initialData?.ID_PIECE)
                .reduce((sum, p) => sum + p.MONTANT_PIECE, 0);
            newContractAmount = baseAmt + amendmentsAmt;
        }

        // 2. Calculate Total Paid (الدفع)
        const relatedPaiements = paiements.filter(p => linkedPieceIds.includes(Number(p.ID_PIECE)));
        const totalPaidFromPaiements = relatedPaiements.reduce((sum, p) => sum + p.MONTANT_PAI, 0);
        const workSituationsAmt = pieces
            .filter(p => p.ID_PIECE_INIT === parentId && ['وضعية الأشغال', 'فاتورة', 'وضعية التسبيق الجزافي', 'وضعية التسبيق على التموين'].includes(p.NAT_PIECE) && p.ID_PIECE !== initialData?.ID_PIECE)
            .reduce((sum, p) => sum + p.MONTANT_PIECE, 0);

        const totalPaid = totalPaidFromPaiements > 0 ? totalPaidFromPaiements : workSituationsAmt;

        const diff = newContractAmount - totalPaid;
        const result = -Math.abs(diff);
        return result;
    }, [pieces, engagements, paiements, initialData]);

    const isAmendmentWithVisa = useMemo(() => {
        if (natPiece !== 'ملحق' || !idPieceInit) return false;
        
        const basePiece = pieces.find(p => p.ID_PIECE === idPieceInit);
        if (basePiece && basePiece.NAT_PIECE === 'اتفاقية') return false;
        if (basePiece && basePiece.NAT_PIECE === 'صفقة') return true;
        
        // 1. Final Quantity Adjustment (ملحق ضبط الكميات النهائية)
        if (piece.includes('ضبط الكميات النهائية')) return true;
        
        // 2. > 10% of contract amount
        if (basePiece && basePiece.MONTANT_PIECE > 0) {
            const currentAmount = parseCurrency(montantPieceStr);
            // Threshold 10% (plus a small epsilon for float precision)
            if (Math.abs(currentAmount) > (basePiece.MONTANT_PIECE * 0.1) + 0.01) {
                return true;
            }
        }
        return false;
    }, [natPiece, piece, idPieceInit, pieces, montantPieceStr]);

    const natPieceRequiresRubrique = useMemo(() => ["صفقة", "اتفاقية", "فاتورة", "ملحق", "قرار فسخ", "قرار", "وضعية الأشغال", "وضعية التسبيق الجزافي", "وضعية التسبيق على التموين"].includes(natPiece), [natPiece]);

    const availableScategoriesForOperation = useMemo(() => {
        if (!idOperation) return [];
        const scategorieOpIds = new Set(scategorieOps.filter(sco => sco.ID_OPERATION === idOperation).map(sco => sco.ID_SCATEGORIE));
        
        // Also ensure the operation's own primary subcategory is included in available choices
        const op = operations.find(o => o.ID_OPERATION === idOperation);
        if (op && op.ID_SCATEGORIE) {
            scategorieOpIds.add(op.ID_SCATEGORIE);
        }
        
        const filtered = scategories.filter(sc => scategorieOpIds.has(sc.ID_SCATEGORIE));
        const unallocatedKeywords = ['غير موزع', 'غير موزعة', 'مبالغ غير موزعة', 'مبلغ العملية غير الموزع'];
        return [...filtered].sort((a, b) => {
            const aIsUnallocated = unallocatedKeywords.some(key => a.INT_SCATEGORIE.includes(key));
            const bIsUnallocated = unallocatedKeywords.some(key => b.INT_SCATEGORIE.includes(key));
            
            if (aIsUnallocated && !bIsUnallocated) return 1;
            if (!aIsUnallocated && bIsUnallocated) return -1;
            
            return a.INT_SCATEGORIE.localeCompare(b.INT_SCATEGORIE, 'ar');
        });
    }, [idOperation, scategories, scategorieOps, operations]);

    const relatedPieces = useMemo(() => {
        return pieces.filter(p =>
            p.ID_OPERATION === idOperation &&
            (p.NAT_PIECE === 'صفقة' || p.NAT_PIECE === 'اتفاقية') &&
            p.ID_PIECE !== initialData?.ID_PIECE
        );
    }, [pieces, idOperation, initialData]);

    const availableRubriquesForOperation = useMemo(() => {
        const opRubriqueIds = new Set(rubriqueOps.filter(ro => ro.ID_OPERATION === idOperation).map(ro => ro.ID_RUBRIQUE));
        return rubriques.filter(r => opRubriqueIds.has(r.ID_RUBRIQUE));
    }, [idOperation, rubriques, rubriqueOps]);

    const beneficiaryOptions = useMemo(() => {
        return beneficiaires.map(b => ({
            value: b.ID_BENEFICIAIRE,
            label: b.BENEFICIAIRE
        }));
    }, [beneficiaires]);

    const parseWorkStatement = (text: string) => {
        const numMatch = text.match(/رقم:\s*(\d+)/);
        const dateMatch = text.match(/في:\s*(\d{2}\s*[/-]\s*\d{2}\s*[/-]\s*\d{4})/);
        const number = numMatch ? parseInt(numMatch[1], 10) : null;
        const dateStr = dateMatch ? dateMatch[1].replace(/\s/g, '').replace(/-/g, '/') : null;

        let date: Date | null = null;
        if (dateStr) {
            date = parseDate(dateStr);
        }
        return { number, date, dateStr };
    };

    // Initialization Logic
    useEffect(() => {
        if (initialData && !isEditLoaded.current) {
            setNatPiece(initialData.NAT_PIECE);
            setIdOperation(initialData.ID_OPERATION);
            setPiece(initialData.PIECE);
            setIdBeneficiaire(initialData.ID_BENEFICIAIRE);
            setIdCompte(initialData.ID_COMPTE);
            setMontantPieceStr(formatCurrency(initialData.MONTANT_PIECE));
            setIdRubrique(initialData.ID_RUBRIQUE);
            setIdScat(initialData.ID_SCATEGORIE);
            setSaiEng(!!initialData.SAI_ENG || engagements.some(e => Number(e.ID_PIECE) === initialData.ID_PIECE));
            setSaiPai(!!initialData.SAI_PAI || paiements.some(p => Number(p.ID_PIECE) === initialData.ID_PIECE));

            // Parse duration unit
            const dur = initialData.DELAI_EX_JOURS || '';
            if (isFinancialDuration(dur)) {
                setDelaiExVal(dur.substring(0, dur.length - 1));
                setDelaiExUnit('months');
            } else {
                setDelaiExVal(dur);
                setDelaiExUnit('days');
            }

            setIdPieceInit(initialData.ID_PIECE_INIT);
            setNVisaCm(initialData.N_VISA_CM || '');
            setDateVisaCm(normalizeDate(initialData.DATE_VISA_CM));
            setCaution(initialData.CAUTION || '');
            setCautionType(initialData.TYPE_CAUTION || 'BANK');

            isEditLoaded.current = true;
            isDirty.current = true; // Prevent auto-overwrite
        } else if (!initialData && !isDirty.current) {
            // New Entry Defaults
            if (selectedOperationId) {
                setIdOperation(selectedOperationId);
            } else if (!idOperation) {
                // Default to first operation only if nothing selected
                setIdOperation(operations[0]?.ID_OPERATION || '');
            }
            if (!piece) {
                setPiece(getSubjectDefault(natPiece, idPieceInit));
            }
        }
    }, [initialData, selectedOperationId, operations, idOperation, engagements, paiements, piece, natPiece, idPieceInit, getSubjectDefault]);

    // Auto-select and validate Scategorie when operation changes
    useEffect(() => {
        if (!initialData) {
            const isValid = idScat && availableScategoriesForOperation.some(sc => sc.ID_SCATEGORIE === idScat);
            if (!isValid && availableScategoriesForOperation.length > 0) {
                setIdScat(availableScategoriesForOperation[0].ID_SCATEGORIE);
            } else if (availableScategoriesForOperation.length === 0) {
                setIdScat(null);
            }
        }
    }, [availableScategoriesForOperation, initialData, idScat]);

    // Ensure rubrique matches the selected operation
    useEffect(() => {
        if (!initialData && idRubrique) {
            const isValid = availableRubriquesForOperation.some(r => r.ID_RUBRIQUE === idRubrique);
            if (!isValid) {
                setIdRubrique(null);
            }
        }
    }, [availableRubriquesForOperation, initialData, idRubrique]);

    // Auto-select Account (Only if clean state)
    useEffect(() => {
        if (idBeneficiaire) {
            if (!isFieldsLocked && !isDirty.current) {
                if (availableAccounts.length === 1) {
                    setIdCompte(availableAccounts[0].ID_COMPTE);
                }
            }
        } else {
            // If beneficiary is cleared/null, always clear account
            if (!isDirty.current) setIdCompte(null);
        }
    }, [idBeneficiaire, availableAccounts, initialData, isFieldsLocked]);

    // Parent Piece Lock Logic
    useEffect(() => {
        if (idPieceInit) {
            const relatedPiece = pieces.find(p => p.ID_PIECE === idPieceInit);
            if (relatedPiece) {
                setIdBeneficiaire(relatedPiece.ID_BENEFICIAIRE);
                setIdCompte(relatedPiece.ID_COMPTE);
                setIdScat(relatedPiece.ID_SCATEGORIE);
                setIdRubrique(relatedPiece.ID_RUBRIQUE);
                setIsFieldsLocked(true);
                
                if (!initialData) {
                    const defaultSub = getSubjectDefault(natPiece, idPieceInit);
                    if (defaultSub) {
                        setPiece(defaultSub);
                    } else {
                        updatePieceSubject(natPiece, idPieceInit);
                    }
                } else {
                    updatePieceSubject(natPiece, idPieceInit);
                }

                if (natPiece === 'قرار فسخ' && !initialData) {
                    const termAmount = calculateTerminationAmount(idPieceInit);
                    setMontantPieceStr(formatCurrency(termAmount));
                }
            }
        } else {
            setIsFieldsLocked(false);
        }
    }, [idPieceInit, pieces, natPiece, updatePieceSubject, initialData, getSubjectDefault, calculateTerminationAmount]);

    useEffect(() => {
        setPieceValidationMessage(null);
        setPieceValidationType('error');

        // Validation for Contract/Agreement Amount Thresholds
        const amount = parseCurrency(montantPieceStr);
        if (amount > 0) {
            if (natPiece === 'صفقة' && amount < 12000000) {
                setPieceValidationMessage('بالنسبة للصفقات، يجب أن يكون المبلغ مساوٍ أو يفوق 12,000,000 دج.');
                return;
            } else if (natPiece === 'اتفاقية' && amount >= 12000000) {
                setPieceValidationMessage('بالنسبة للاتفاقيات، يجب أن يكون المبلغ أقل من 12,000,000 دج.');
                return;
            }

            // Validation for CP balance: Only show for payment documents (وثائق الدفع فقط)
            const paymentPieceTypes = ['وضعية الأشغال', 'فاتورة', 'وضعية التسبيق الجزافي', 'وضعية التسبيق على التموين'];
            const isPaymentDoc = paymentPieceTypes.includes(natPiece) || saiPai;

            if (idOperation && isPaymentDoc) {
                // Sum all CP allocations for this operation
                const totalCP = cps
                    .filter(c => c.ID_OPERATION === Number(idOperation))
                    .reduce((sum, c) => sum + (c.MONTANT_FINALE_CP ?? c.MONTANT_INITIALE_CP), 0);
                
                // Sum all payments made for this operation (excluding current piece if editing)
                const consumedCP = paiements
                    .filter(p => p.ID_OPERATION === Number(idOperation) && (initialData ? p.ID_PIECE !== initialData.ID_PIECE : true))
                    .reduce((sum, p) => sum + p.MONTANT_PAI, 0);

                const remainingCP = Math.max(0, totalCP - consumedCP);
                
                if (amount > remainingCP + 0.01) {
                    setPieceValidationMessage(`تنبيه: المبلغ يتجاوز باقي إعتمادات الدفع (CP) الإجمالية لهذه العملية (${formatCurrency(remainingCP)} دج).`);
                    setPieceValidationType('warning');
                }
            }

            // New Validation: Safqa/Appendix vs Lot Final Amount
            if ((natPiece === 'ملحق' && idPieceInit) || (natPiece === 'صفقة' && initialData?.ID_PIECE)) {
                const targetContractId = natPiece === 'ملحق' ? idPieceInit : initialData?.ID_PIECE;
                const baseContract = pieces.find(p => Number(p.ID_PIECE) === Number(targetContractId));
                
                if (baseContract) {
                    // Find all lots associated with this contract
                    const associatedLotLinks = lotPieces.filter(lp => Number(lp.ID_PIECE) === Number(targetContractId));
                    const associatedLots = lots.filter(l => associatedLotLinks.some(link => Number(link.ID_LOT) === Number(l.ID_LOT)));

                    if (associatedLots.length > 0) {
                        let totalWithCurrent = 0;
                        if (natPiece === 'ملحق') {
                            const baseAmount = baseContract.MONTANT_PIECE;
                            const otherAmendmentsAmount = pieces
                                .filter(p => Number(p.ID_PIECE_INIT) === Number(idPieceInit) && p.NAT_PIECE === 'ملحق' && Number(p.ID_PIECE) !== Number(initialData?.ID_PIECE))
                                .reduce((sum, p) => sum + p.MONTANT_PIECE, 0);
                            totalWithCurrent = baseAmount + otherAmendmentsAmount + amount;
                        } else {
                            // Editing the contract itself
                            const amendmentsAmount = pieces
                                .filter(p => Number(p.ID_PIECE_INIT) === Number(initialData?.ID_PIECE) && p.NAT_PIECE === 'ملحق')
                                .reduce((sum, p) => sum + p.MONTANT_PIECE, 0);
                            totalWithCurrent = amount + amendmentsAmount;
                        }

                        const totalLotLimit = associatedLots.reduce((sum, l) => sum + (l.MONTANT_FINALE_LOT || l.MONTANT_INITIALE_LOT), 0);

                        if (totalWithCurrent > totalLotLimit + 0.01) {
                            setPieceValidationMessage('تنبيه: يجب اعادة هيكلة الكلفة للحصة (مبلغ الصفقة + الملاحق يتجاوز الغلاف المالي للحصة/الحصص المرتبطة).');
                            setPieceValidationType('warning');
                        }
                    }
                }
            }
        }

        if (natPiece === 'رفع اليد عن الضمان' && idPieceInit) {
            const closingOds = ods.find(o => o.ID_PIECE === idPieceInit && o.NATURE_ODS === 'ختام');
            if (closingOds) {
                const closingDate = parseDate(closingOds.DATE_ODS);
                if (closingDate) {
                    const today = new Date();
                    today.setHours(0,0,0,0);
                    
                    const releaseAllowedDate = new Date(closingDate);
                    releaseAllowedDate.setDate(releaseAllowedDate.getDate() + 1);
                    releaseAllowedDate.setFullYear(releaseAllowedDate.getFullYear() + 1);

                    if (today < releaseAllowedDate) {
                        setPieceValidationMessage(`لا يمكن رفع اليد عن الضمان: يجب مرور سنة و يوم واحد على الأقل من تاريخ الاستلام المؤقت (${normalizeDate(closingOds.DATE_ODS)}). التاريخ المسموح به هو: ${normalizeDate(releaseAllowedDate.toISOString().split('T')[0])}`);
                        setPieceValidationType('error');
                        return;
                    }
                }
            } else {
                setPieceValidationMessage('لا يمكن رفع اليد عن الضمان: لم يتم العثور على أمر ختام (محضر استلام مؤقت) للوثيقة الأصلية.');
                setPieceValidationType('error');
                return;
            }
        }

        if (natPiece === 'وضعية الأشغال' && idPieceInit) {
            // Check if amount + previous payments exceeds contract total
            const basePiece = pieces.find(p => p.ID_PIECE === idPieceInit);
            if (basePiece) {
                const amount = parseCurrency(montantPieceStr);
                const supplementaryAmount = pieces
                    .filter(p => p.ID_PIECE_INIT === idPieceInit && (p.NAT_PIECE === 'ملحق' || p.NAT_PIECE === 'قرار فسخ'))
                    .reduce((sum, p) => sum + p.MONTANT_PIECE, 0);
                const totalContractAmount = basePiece.MONTANT_PIECE + supplementaryAmount;

                const previousPaymentsAmount = pieces
                    .filter(p => 
                        p.ID_PIECE_INIT === idPieceInit && 
                        ['وضعية الأشغال', 'فاتورة', 'وضعية التسبيق الجزافي', 'وضعية التسبيق على التموين'].includes(p.NAT_PIECE) &&
                        p.ID_PIECE !== initialData?.ID_PIECE
                    )
                    .reduce((sum, p) => sum + p.MONTANT_PIECE, 0);
                
                const totalCumulative = previousPaymentsAmount + amount;

                if (totalCumulative > totalContractAmount + 0.01) {
                    setPieceValidationMessage(`تنبيه: مبلغ الوضعية + الدفوعات السابقة (${formatCurrency(totalCumulative)} دج) يفوق مبلغ الجديد للصفقة (${formatCurrency(totalContractAmount)} دج).`);
                    setPieceValidationType('warning');
                }
            }

            if (piece.trim()) {
                const current = parseWorkStatement(piece);

            // Check if beneficiary name starts with "GROUPEMENT"
            const beneficiary = beneficiaires.find(b => b.ID_BENEFICIAIRE === idBeneficiaire);
            const isGroupement = beneficiary?.BENEFICIAIRE.toUpperCase().trim().startsWith('GROUPEMENT');

            // 0. Global Safqa Sequence Validation
            const allSafqaStatements = pieces.filter(p =>
                p.ID_PIECE_INIT === idPieceInit &&
                p.NAT_PIECE === 'وضعية الأشغال' &&
                p.ID_PIECE !== initialData?.ID_PIECE
            )
            .map(p => ({ ...p, parsed: parseWorkStatement(p.PIECE) }))
            .filter(p => p.parsed.number !== null);

            if (current.number !== null) {
                if (allSafqaStatements.length > 0) {
                    const maxSafqaNumber = Math.max(...allSafqaStatements.map(p => p.parsed.number!));
                    if (current.number <= maxSafqaNumber) {
                        setPieceValidationMessage(`تنبيه: رقم الوضعية (${current.number}) يجب أن يكون أكبر من أكبر ترقيم سابق في هذه الصفقة (${maxSafqaNumber}).`);
                        setPieceValidationType('warning');
                    }
                } else if (current.number !== 1) {
                    setPieceValidationMessage('تنبيه: يجب أن يكون رقم الوضعية 01 لعدم وجود وضعيات سابقة لهذه الصفقة.');
                    setPieceValidationType('warning');
                }
            }

            // 1. Sequence Validation (Filtered by beneficiary)
            const previousStatements = pieces.filter(p =>
                p.ID_PIECE_INIT === idPieceInit &&
                p.NAT_PIECE === 'وضعية الأشغال' &&
                p.ID_PIECE !== initialData?.ID_PIECE &&
                p.ID_BENEFICIAIRE === idBeneficiaire
            )
                .map(p => ({ ...p, parsed: parseWorkStatement(p.PIECE) }))
                .filter(p => p.parsed.number !== null && p.parsed.date !== null)
                .sort((a, b) => b.parsed.number! - a.parsed.number!);

            if (previousStatements.length > 0 && !isGroupement) { // Bypass for Groupement
                const latestPrevious = previousStatements[0];
                if (current.number !== null) {
                    if (current.number !== latestPrevious.parsed.number! + 1) {
                        setPieceValidationMessage(`تنبيه: خطأ في التسلسل لهذا المستفيد. الرقم المتوقع هو ${latestPrevious.parsed.number! + 1}.`);
                        setPieceValidationType('warning');
                    }
                }
                if (current.date !== null && latestPrevious.parsed.date !== null) {
                    // تعديل المنطق: السماح بتطابق التاريخ
                    const isSameDateAllowed = (current.date.getTime() === latestPrevious.parsed.date.getTime());

                    if (current.date < latestPrevious.parsed.date) {
                        setPieceValidationMessage(`تنبيه: تاريخ الوضعية يجب أن يكون مساوٍ أو بعد تاريخ الوضعية السابقة (${latestPrevious.parsed.dateStr}).`);
                        setPieceValidationType('warning');
                    }

                    // منع الوضعيات في نفس الشهر إلا إذا كانت بنفس التاريخ (حالة ضبط الكميات الختامية)
                    // Exception logic: Allow same month if:
                    // 1. Same date
                    // 2. OR Has 'Final Quantities Adjustment' addendum (ملحق ضبط الكميات النهائية)
                    // 3. OR Has 'Temporary Acceptance' (محضر استلام مؤقت / ODS 'ختام')

                    const hasClosingDocs = pieces.some(p =>
                        p.ID_PIECE_INIT === idPieceInit &&
                        p.NAT_PIECE === 'ملحق' &&
                        p.PIECE.includes('ضبط الكميات')
                    ) || ods.some(o =>
                        o.ID_PIECE === idPieceInit &&
                        o.NATURE_ODS === 'ختام'
                    );

                    if (!isSameDateAllowed && !hasClosingDocs && current.date.getMonth() === latestPrevious.parsed.date.getMonth() && current.date.getFullYear() === latestPrevious.parsed.date.getFullYear()) {
                        setPieceValidationMessage('تنبيه: لا ينصح بإنشاء وضعيتي أشغال لنفس المستفيد في نفس الشهر (إلا في حالة الوضعية الختامية بنفس تاريخ الاستلام أو وجود ملحق ضبط الكميات النهائية/محضر استلام مؤقت).');
                        setPieceValidationType('warning');
                    }
                }
            }

            // 2. Date Logic Validation (Deadline & Pause Periods)
            if (current.date !== null) {
                const parentPiece = pieces.find(p => p.ID_PIECE === idPieceInit);
                const useFinancialRule = isFinancialDuration(parentPiece?.DELAI_EX_JOURS);

                const relevantOds = ods
                    .filter(o => o.ID_PIECE === idPieceInit)
                    .map(o => ({ ...o, parsedDate: parseDate(o.DATE_ODS) }))
                    .filter(o => o.parsedDate !== null)
                    .sort((a, b) => a.parsedDate!.getTime() - b.parsedDate!.getTime());

                if (relevantOds.length > 0 && parentPiece?.DELAI_EX_JOURS) {
                    const startOds = relevantOds.find(o => o.NATURE_ODS === 'انطلاق');

                    if (startOds) {
                        let consumedWorkDays = 0;
                        let lastActiveStartDate: Date | null = null;
                        let isCurrentlyPaused = true;
                        const currentDate = current.date;
                        currentDate.setHours(0, 0, 0, 0);

                        for (const o of relevantOds) {
                            const eventDate = o.parsedDate!;
                            if (o.NATURE_ODS === 'انطلاق' || o.NATURE_ODS === 'استئناف') {
                                if (isCurrentlyPaused) {
                                    lastActiveStartDate = eventDate;
                                    isCurrentlyPaused = false;
                                }
                            } else if (o.NATURE_ODS === 'ايقاف') {
                                if (!isCurrentlyPaused && lastActiveStartDate) {
                                    consumedWorkDays += calculateElapsedDays(lastActiveStartDate, eventDate, useFinancialRule);
                                    isCurrentlyPaused = true;
                                    lastActiveStartDate = null;
                                }
                            }
                        }

                        // Strict pause validation
                        let isPausedOnDocDate = false;
                        let pauseStart: Date | null = null;
                        for (const o of relevantOds) {
                            if (o.NATURE_ODS === 'ايقاف') pauseStart = o.parsedDate;
                            else if (o.NATURE_ODS === 'استئناف') {
                                if (pauseStart && currentDate >= pauseStart && currentDate < o.parsedDate!) {
                                    isPausedOnDocDate = true;
                                    break;
                                }
                                pauseStart = null;
                            }
                        }
                        if (!isPausedOnDocDate && pauseStart && currentDate >= pauseStart) {
                            isPausedOnDocDate = true;
                        }

                        // استثناء للمرحلة الختامية: إذا كان التاريخ يطابق تاريخ أمر الختام، نسمح به حتى لو كان يعتبر متوقفاً
                        const closingOds = relevantOds.find(o => o.NATURE_ODS === 'ختام');
                        const isHandoverDate = closingOds && currentDate.getTime() === closingOds.parsedDate!.getTime();

                        if (isPausedOnDocDate && !isHandoverDate) {
                            setPieceValidationMessage('تنبيه: تاريخ وضعية الأشغال داخل فترة توقف الأشغال.');
                            setPieceValidationType('warning');
                        }

                        // Deadline warning
                        const durationAllowed = getEffectiveDurationDays(parentPiece.DELAI_EX_JOURS);

                        // Total consumed up to doc date
                        let currentConsumed = 0;
                        let activeStart: Date | null = null;
                        let paused = true;
                        for (const o of relevantOds) {
                            const eventDate = o.parsedDate!;
                            if (eventDate > currentDate) break;

                            if (o.NATURE_ODS === 'انطلاق' || o.NATURE_ODS === 'استئناف') {
                                if (paused) {
                                    activeStart = eventDate;
                                    paused = false;
                                }
                            } else if (o.NATURE_ODS === 'ايقاف') {
                                if (!paused && activeStart) {
                                    currentConsumed += calculateElapsedDays(activeStart, eventDate, useFinancialRule);
                                    paused = true;
                                    activeStart = null;
                                }
                            }
                        }
                        if (!paused && activeStart) {
                            currentConsumed += calculateElapsedDays(activeStart, currentDate, useFinancialRule);
                        }

                        if (currentConsumed > durationAllowed) {
                            setPieceValidationMessage(`تنبيه: تاريخ وضعية الأشغال (${current.dateStr}) خارج مدة الإنجاز (مدة الاستهلاك: ${currentConsumed} يوم من أصل ${durationAllowed} يوم).`);
                            setPieceValidationType('warning');
                        }
                    }
                }
            }
        }
    }
}, [piece, natPiece, idPieceInit, idBeneficiaire, pieces, initialData, ods, beneficiaires, montantPieceStr, idOperation, idRubrique, rubriqueOps, engagements, cps, paiements, lots, lotPieces, saiPai]);

    const handleNatPieceChange = (newNatPiece: string) => {
        setNatPiece(newNatPiece);
        markDirty();

        // Auto-fill subject if linked piece exists or based on nature
        if (!initialData) {
            const defaultSub = getSubjectDefault(newNatPiece, idPieceInit);
            if (defaultSub) {
                setPiece(defaultSub);
            } else {
                setPiece(newNatPiece + ' ');
            }
        } else if (idPieceInit) {
            updatePieceSubject(newNatPiece, idPieceInit);
        }

        if (newNatPiece === 'قرار فسخ' && idPieceInit) {
            const termAmount = calculateTerminationAmount(idPieceInit);
            setMontantPieceStr(formatCurrency(termAmount));
        }

        // Always reset registration status when nature changes
        setSaiEng(false);
        setSaiPai(false);

        if (newNatPiece !== 'ملحق' && newNatPiece !== 'قرار فسخ' && newNatPiece !== 'وضعية الأشغال' && newNatPiece !== 'وضعية التسبيق الجزافي' && newNatPiece !== 'وضعية التسبيق على التموين' && newNatPiece !== 'رفع اليد عن الضمان') {
            setIdPieceInit(null);
        }
    };

    const handlePieceTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        let newPieceValue = e.target.value;
        setPiece(newPieceValue);
        markDirty();

        const trimmedValue = newPieceValue.trim();
        
        // Auto-correct variations of "وضعية الأشغال" or "وضعية اشغال"
        const workStatementRegex = /^(وضعية|وضعيه|وضيعة|وضiعه)\s*(الاشغال|الأشغال|اشغال|أشغال)$/i;
        if (workStatementRegex.test(trimmedValue)) {
            const nextNumStr = getNextWorkStatementNumber(idPieceInit);
            const correctedValue = `وضعية الأشغال رقم: ${nextNumStr} في: `;
            setPiece(correctedValue);
            setNatPiece('وضعية الأشغال');
            // Always reset registration status when nature is detected
            setSaiEng(false);
            setSaiPai(false);
            return;
        }

        let currentNat = natPiece;
        const sortedPieceTypes = [...pieceTypes].sort((a, b) => b.length - a.length);

        for (const type of sortedPieceTypes) {
            if (trimmedValue.startsWith(type)) {
                if (type !== natPiece) {
                    currentNat = type;
                    setNatPiece(type);
                    
                    // Always reset registration status when nature is detected
                    setSaiEng(false);
                    setSaiPai(false);

                    if (type !== 'ملحق' && type !== 'قرار فسخ' && type !== 'وضعية الأشغال' && type !== 'وضعية التسبيق الجزافي' && type !== 'وضعية التسبيق على التموين' && type !== 'رفع اليد عن الضمان') {
                        setIdPieceInit(null);
                    }
                }
                break;
            }
        }

        // Apply مقرر shortcuts auto-fill on user typing
        if (currentNat === 'مقرر') {
            const normValue = trimmedValue;
            if (normValue === 'مقرر تـغ' || normValue === 'مقرر تغ') {
                newPieceValue = 'مقرر تغيير هيكلة الكلفة رقم: ';
                setPiece(newPieceValue);
            } else if (normValue === 'مقرر التف' || normValue === 'مقرر تف') {
                newPieceValue = 'مقرر التفريد رقم: ';
                setPiece(newPieceValue);
            } else if (normValue === 'مقرر التـغ' || normValue === 'مقرر التغ') {
                newPieceValue = 'مقرر التغطية المالية رقم: ';
                setPiece(newPieceValue);
            } else if (normValue === 'مقرر اع' || normValue === 'مقرر إع') {
                newPieceValue = 'مقرر اعادة التقييم رقم: ';
                setPiece(newPieceValue);
            } else if (normValue === 'مقرر ان' || normValue === 'مقرر إن') {
                newPieceValue = 'مقرر انخفاض التقييم رقم: ';
                setPiece(newPieceValue);
            }
        }

        // Apply ملحق shortcuts auto-fill on user typing
        if (currentNat === 'ملحق') {
            const normValue = trimmedValue;
            if (normValue === 'ملحق ض') {
                newPieceValue = 'ملحق ضبط الكميات النهائية في: ';
                setPiece(newPieceValue);
            }
        }
    };


    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        if (pieceValidationMessage && pieceValidationType === 'error') {
            alert(pieceValidationMessage);
            return;
        }

        if (idPieceInit) {
            const parentPiece = pieces.find(p => p.ID_PIECE === idPieceInit);
            if (!parentPiece) {
                alert("الوثيقة الأصلية المحددة غير موجودة.");
                return;
            }
            if (parentPiece.ID_OPERATION !== Number(idOperation)) {
                alert("خطأ: الوثيقة الأصلية المحددة لا تنتمي لنفس العملية.");
                return;
            }
            if (parentPiece.ID_BENEFICIAIRE !== idBeneficiaire && natPiece !== 'مقرر') {
                alert("خطأ: مستفيد هذه الوثيقة يجب أن يطابق مستفيد الوثيقة الأصلية المحددة.");
                return;
            }
        }

        let isValidPrefix = piece.trim().startsWith(natPiece);
        if (natPiece === 'قرار فسخ') {
            isValidPrefix = piece.trim().startsWith('قرار فسخ') || piece.trim().startsWith('قرار الفسخ');
        }
        if (natPiece !== 'أخرى' && piece.trim() && !isValidPrefix) {
            alert(`يجب أن يبدأ موضوع الوثيقة بكلمة "${natPiece === 'قرار فسخ' ? 'قرار فسخ أو قرار الفسخ' : natPiece}"`);
            return;
        }

        if (!idOperation) {
            if (operations.length > 0) {
                alert("يرجى اختيار عملية.");
            } else {
                alert("لا توجد عمليات مسجلة. يرجى إضافة عملية أولاً قبل إضافة وثيقة.");
            }
            return;
        }

        const opExists = operations.some(op => Number(op.ID_OPERATION) === Number(idOperation));
        if (!opExists) {
            alert("خطأ في سلامة العلاقات: العملية المحددة غير موجودة في قاعدة البيانات.");
            return;
        }

        if (idBeneficiaire && natPiece !== 'مقرر') {
            const benExists = beneficiaires.some(b => Number(b.ID_BENEFICIAIRE) === Number(idBeneficiaire));
            if (!benExists) {
                alert("خطأ في سلامة العلاقات: المستفيد المحدد غير موجود في قاعدة البيانات.");
                return;
            }
        }

        if (idScat) {
            const scatExists = scategories.some(sc => Number(sc.ID_SCATEGORIE) === Number(idScat));
            if (!scatExists) {
                alert("خطأ في سلامة العلاقات: الصنف الفرعي المحدد غير موجود في قاعدة البيانات.");
                return;
            }
        }

        if (idRubrique) {
            const rubExists = rubriques.some(rub => Number(rub.ID_RUBRIQUE) === Number(idRubrique));
            if (!rubExists) {
                alert("خطأ في سلامة العلاقات: تفصيل الهيكلة المحدد غير موجود في قاعدة البيانات.");
                return;
            }
        }

        const normalizedPieceName = piece.trim();
        const restrictedTypes = ['صفقة', 'اتفاقية', 'فاتورة'];
        if (restrictedTypes.includes(natPiece)) {
            const duplicate = pieces.find(p =>
                p.NAT_PIECE === natPiece &&
                p.PIECE.trim().toLowerCase() === normalizedPieceName.toLowerCase() &&
                p.ID_PIECE !== initialData?.ID_PIECE
            );

            if (duplicate) {
                alert(`خطأ: توجد وثيقة من نوع "${natPiece}" بنفس الاسم أو الرقم (${normalizedPieceName}) مسجلة بالفعل بالجدول.`);
                return;
            }
        }

        const uniqueTypes = ['مقرر', 'قرار'];
        if (uniqueTypes.includes(natPiece)) {
            const duplicate = pieces.find(p =>
                p.ID_OPERATION === Number(idOperation) &&
                p.NAT_PIECE === natPiece &&
                p.PIECE.trim().toLowerCase() === normalizedPieceName.toLowerCase() &&
                p.ID_PIECE !== initialData?.ID_PIECE
            );

            if (duplicate) {
                alert(`خطأ: توجد وثيقة من نوع "${natPiece}" بنفس الاسم أو الرقم (${normalizedPieceName}) مسجلة بالفعل في هذه العملية.`);
                return;
            }
        }

        const montantPiece = parseCurrency(montantPieceStr);

        if (natPiece !== 'مقرر' && natPiece !== 'رفع اليد عن الضمان' && idBeneficiaire && availableAccounts.length > 0 && !idCompte) {
            alert("يرجى اختيار حساب بنكي للمستفيد.");
            return;
        }
        if (!idScat) {
            alert("يرجى تحديد الصنف الفرعي.");
            return;
        }

        if (natPieceRequiresRubrique) {
            if (!idRubrique) {
                alert("يرجى تحديد تفصيل الهيكلة لهذه الوثيقة.");
                return;
            }
        }

        const finalDelai = delaiExUnit === 'months' && delaiExVal ? `${delaiExVal}m` : (delaiExVal || null);

        setIsSubmitting(true);
        const {
            ID_PIECE,
            beneficiaryName,
            rubricName,
            hasEngagement,
            hasPaiement,
            isConcernedEng,
            isConcernedPai,
            isDuplicate,
            ...validInitialData
        } = (initialData || {}) as any;

        const payload = {
            ...validInitialData,
            ...(ID_PIECE ? { ID_PIECE } : {}),
            NAT_PIECE: natPiece,
            ID_OPERATION: Number(idOperation),
            PIECE: piece,
            ID_BENEFICIAIRE: natPiece === 'مقرر' ? null : idBeneficiaire,
            ID_COMPTE: natPiece === 'مقرر' ? null : idCompte,
            MONTANT_PIECE: montantPiece,
            ID_RUBRIQUE: idRubrique,
            DELAI_EX_JOURS: (natPiece === 'صفقة' || natPiece === 'اتفاقية') ? finalDelai : null,
            ID_PIECE_INIT: (natPiece === 'ملحق' || natPiece === 'قرار فسخ' || natPiece === 'وضعية الأشغال' || natPiece === 'وضعية التسبيق الجزافي' || natPiece === 'وضعية التسبيق على التموين' || natPiece === 'رفع اليد عن الضمان') ? idPieceInit : null,
            N_VISA_CM: (natPiece === 'صفقة' || isAmendmentWithVisa) ? (nVisaCm || null) : null,
            DATE_VISA_CM: (natPiece === 'صفقة' || isAmendmentWithVisa) ? (dateVisaCm || null) : null,
            CAUTION: (natPiece === 'صفقة' || natPiece === 'اتفاقية') ? (caution || null) : null,
            TYPE_CAUTION: (natPiece === 'صفقة' || natPiece === 'اتفاقية') ? (caution ? (cautionType || 'BANK') : null) : null,
            ID_SCATEGORIE: idScat,
            SAI_ENG: saiEng,
            SAI_PAI: saiPai
        };

        Promise.resolve(onSave(payload)).finally(() => {
            setIsSubmitting(false);
        });
    };

    const shouldShowAccountDropdown = useMemo(() => {
        if (natPiece === 'مقرر' || !idBeneficiaire || availableAccounts.length === 0) {
            return false;
        }
        return true;
    }, [natPiece, idBeneficiaire, availableAccounts]);

    const renderConditionalFields = () => {
        switch (natPiece) {
            case 'صفقة':
            case 'اتفاقية':
                return (
                    <div className="space-y-4 p-4 border border-gray-200 rounded-md bg-gray-50">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label htmlFor="delaiExVal" className="block text-xs font-medium text-gray-700 text-right">مدة الإنجاز</label>
                                <input id="delaiExVal" type="text" value={delaiExVal} onChange={e => { setDelaiExVal(e.target.value); markDirty(); }} className="w-full h-9 text-sm px-3 py-1 mt-1 text-gray-700 text-center bg-white border border-gray-300 rounded-[20px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                            </div>
                            <div>
                                <label htmlFor="delaiExUnit" className="block text-xs font-medium text-gray-700 text-right">الوحدة</label>
                                <select id="delaiExUnit" value={delaiExUnit} onChange={e => { setDelaiExUnit(e.target.value as any); markDirty(); }} className="w-full h-9 text-sm px-3 py-1 mt-1 text-gray-700 text-center bg-white border border-gray-300 rounded-[20px] focus:outline-none focus:ring-2 focus:ring-blue-500">
                                    <option value="days">أيام</option>
                                    <option value="months">شهر</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="caution" className="block text-xs font-medium text-gray-700 text-right">ضمان حسن التنفيذ (%)</label>
                                <select 
                                    id="caution" 
                                    value={caution} 
                                    onChange={e => { setCaution(e.target.value); markDirty(); }} 
                                    className="w-full h-9 px-3 py-1 mt-1 text-sm text-gray-700 text-center bg-white border border-gray-300 rounded-[20px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">-- بدون --</option>
                                    {[...Array(10)].map((_, i) => (
                                        <option key={i + 1} value={`${i + 1}%`}>{i + 1}%</option>
                                    ))}
                                </select>
                            </div>
                            {caution && (
                                <div>
                                    <label htmlFor="cautionType" className="block text-xs font-medium text-gray-700 text-right">نوع الضمان</label>
                                    <select
                                        id="cautionType"
                                        value={cautionType}
                                        onChange={e => { setCautionType(e.target.value); markDirty(); }}
                                        className="w-full h-9 px-3 py-1 mt-1 text-sm text-gray-700 text-center bg-white border border-gray-300 rounded-[20px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="BANK">كفالة بنكية</option>
                                        <option value="RETENTION">اقتطاع ضمان</option>
                                    </select>
                                </div>
                            )}
                        </div>
                        {natPiece === 'صفقة' && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="nVisaCm" className="block text-sm font-medium text-gray-700 text-center">رقم تأشيرة لجنة الصفقات</label>
                                    <input id="nVisaCm" type="text" value={nVisaCm} onChange={e => { setNVisaCm(e.target.value); markDirty(); }} className="w-full h-9 px-3 py-1 mt-1 text-center text-gray-700 bg-white border border-gray-300 rounded-[20px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <DateInputField
                                        id="dateVisaCm"
                                        label="تاريخ تأشيرة لجنة الصفقات"
                                        value={dateVisaCm}
                                        onChange={(val) => { setDateVisaCm(val); markDirty(); }}
                                        className="w-full h-9 px-3 py-1 mt-1 text-gray-700 text-center bg-white border border-gray-300 rounded-[20px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                );
            case 'ملحق':
                if (isAmendmentWithVisa) {
                    return (
                        <div className="space-y-4 p-4 border border-gray-200 rounded-md bg-gray-50">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label htmlFor="nVisaCm" className="block text-sm font-medium text-gray-700 text-center">رقم تأشيرة لجنة الصفقات</label>
                                    <input id="nVisaCm" type="text" value={nVisaCm} onChange={e => { setNVisaCm(e.target.value); markDirty(); }} className="w-full h-9 px-3 py-1 mt-1 text-center text-gray-700 bg-white border border-gray-300 rounded-[20px] focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                </div>
                                <div>
                                    <DateInputField
                                        id="dateVisaCm"
                                        label="تاريخ تأشيرة لجنة الصفقات"
                                        value={dateVisaCm}
                                        onChange={(val) => { setDateVisaCm(val); markDirty(); }}
                                        className="w-full h-9 px-3 py-1 mt-1 text-gray-700 text-center bg-white border border-gray-300 rounded-[20px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                        </div>
                    );
                }
                return null;
            default:
                return null;
        }
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col max-h-[85vh]">
            <div className="sticky top-0 bg-white z-10 pb-2 border-b border-gray-200 flex justify-end gap-3 pt-1 mb-2">
                <button type="button" onClick={onClose} className="px-5 py-1.5 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors text-sm">إلغاء</button>
                <button type="submit" disabled={isSubmitting} className="px-5 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed text-sm">
                    {isSubmitting ? 'جاري الحفظ...' : (initialData ? 'حفظ التغيرات' : 'إضافة')}
                </button>
            </div>

            <div className="space-y-3 overflow-y-auto p-1">
                {/* 1. العملية (Operation) */}
                <div>
                    <label htmlFor="operation" className="block text-sm font-medium text-gray-700 text-right">العملية</label>
                    <select 
                        id="operation" 
                        value={idOperation} 
                        onChange={e => { 
                            setIdOperation(Number(e.target.value)); 
                            setIdPieceInit(null); // Reset related document link on operation change to avoid errors
                            markDirty(); 
                        }} 
                        required 
                        className="w-full h-10 px-1 py-1 mt-1 text-center text-[11px] text-gray-700 bg-gray-100 border border-gray-300 rounded-[20px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="">-- اختر عملية --</option>
                        {operations.map(op => <option key={op.ID_OPERATION} value={op.ID_OPERATION}>{op.INT_OPERATION}</option>)}
                    </select>
                </div>

                {/* 2. طبيعة الوثيقة (Nature of document) */}
                <div>
                    <label htmlFor="natPiece" className="block text-sm font-medium text-gray-700 text-right">طبيعة الوثيقة</label>
                    <select id="natPiece" value={natPiece} onChange={e => handleNatPieceChange(e.target.value)} required className="w-full h-9 px-3 py-1 mt-1 text-center text-xs text-gray-700 bg-gray-100 border border-gray-300 rounded-[20px] focus:outline-none focus:ring-2 focus:ring-blue-500">
                        {pieceTypes.map(type => <option key={type} value={type}>{type}</option>)}
                    </select>
                </div>

                {/* 3. الوثيقة المرتبط بها (Linked Document) */}
                {(natPiece === 'ملحق' || natPiece === 'قرار فسخ' || natPiece === 'وضعية الأشغال' || natPiece === 'وضعية التسبيق الجزافي' || natPiece === 'وضعية التسبيق على التموين' || natPiece === 'رفع اليد عن الضمان') && (
                    <div className="p-2 border border-gray-200 rounded-md bg-gray-50">
                        <label htmlFor="idPieceInit" className="block text-sm font-medium text-gray-700 text-right">الوثيقة المرتبط بها</label>
                        <select id="idPieceInit" value={idPieceInit ?? ''} onChange={e => { 
                            const val = e.target.value ? Number(e.target.value) : null;
                            setIdPieceInit(val); 
                            markDirty(); 
                            if (natPiece === 'قرار فسخ' && val) {
                                const termAmount = calculateTerminationAmount(val);
                                setMontantPieceStr(formatCurrency(termAmount));
                            }
                        }} required className="w-full h-9 px-3 py-1 mt-1 text-xs text-center text-gray-700 bg-white border border-gray-300 rounded-[20px] focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="">-- اختر وثيقة --</option>
                            {relatedPieces.map(p => {
                                const ben = beneficiaires.find(b => b.ID_BENEFICIAIRE === p.ID_BENEFICIAIRE);
                                return (
                                    <option key={p.ID_PIECE} value={p.ID_PIECE}>
                                        {p.PIECE} {ben ? ` - (المستفيد: ${ben.BENEFICIAIRE})` : ''}
                                    </option>
                                );
                            })}
                        </select>
                    </div>
                )}

                {/* 4. موضوع الوثيقة (Subject of Document) */}
                <div>
                    {pieceValidationMessage && (
                        <div className={`p-2 mb-1 rounded-md text-[11px] text-right ${pieceValidationType === 'error' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`} role="alert">
                            <i className={`bi ${pieceValidationType === 'error' ? 'bi-exclamation-triangle-fill' : 'bi-exclamation-circle-fill'} ml-2`}></i>
                            {pieceValidationMessage}
                        </div>
                    )}
                    <label htmlFor="piece" className="block text-sm font-medium text-gray-700 text-right">موضوع الوثيقة</label>
                    <input 
                        id="piece" 
                        value={piece} 
                        onChange={(e) => handlePieceTextChange({ target: { value: e.target.value } } as any)} 
                        required 
                        spellCheck={true}
                        className="w-full h-9 px-3 py-1 mt-1 text-center text-xs text-gray-700 bg-gray-100 border border-gray-300 rounded-[20px] focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase disabled:bg-gray-200" 
                        style={{
                            borderColor: natPiece !== 'أخرى' && piece.trim() && !(natPiece === 'قرار فسخ' ? (piece.trim().startsWith('قرار فسخ') || piece.trim().startsWith('قرار الفسخ')) : piece.trim().startsWith(natPiece)) ? '#ef4444' : undefined,
                            backgroundColor: natPiece !== 'أخرى' && piece.trim() && !(natPiece === 'قرار فسخ' ? (piece.trim().startsWith('قرار فسخ') || piece.trim().startsWith('قرار الفسخ')) : piece.trim().startsWith(natPiece)) ? '#fef2f2' : undefined
                        }}
                    />
                    {natPiece !== 'أخرى' && piece.trim() && !(natPiece === 'قرار فسخ' ? (piece.trim().startsWith('قرار فسخ') || piece.trim().startsWith('قرار الفسخ')) : piece.trim().startsWith(natPiece)) && (
                        <p className="text-[10px] text-red-600 mt-1 text-right">يجب أن يبدأ الموضوع بكلمة "{natPiece === 'قرار فسخ' ? 'قرار فسخ أو قرار الفسخ' : natPiece}"</p>
                    )}
                </div>

                {/* 5. المبلغ (Amount) */}
                <div>
                    <label htmlFor="montant" className="block text-sm font-medium text-gray-700 text-right">المبلغ</label>
                    <input
                        id="montant"
                        type="text"
                        inputMode="decimal"
                        value={montantPieceStr}
                        onChange={(e) => { setMontantPieceStr(formatAmountInput(e.target.value)); markDirty(); }}
                        onFocus={(e) => {
                            const num = parseCurrency(e.target.value);
                            setMontantPieceStr(isNaN(num) ? '' : formatCurrencyForInput(num));
                        }}
                        onBlur={(e) => {
                            const num = parseCurrency(e.target.value);
                            setMontantPieceStr(isNaN(num) ? '0' : formatCurrency(num));
                        }}
                        required
                        className={`w-full h-9 px-3 py-1 mt-1 text-center text-sm font-bold text-gray-700 bg-gray-100 border border-gray-300 rounded-[20px] transition-all ${pieceValidationMessage && (['صفقة', 'اتفاقية', 'ملحق', 'فاتورة', 'قرار'].includes(natPiece)) && pieceValidationType === 'error' ? 'border-red-500 ring-2 ring-red-500/20' : ''}`}
                    />
                </div>

                {natPiece !== 'مقرر' && (
                    <div>
                        <label htmlFor="beneficiaire" className="block text-sm font-medium text-gray-700 text-center">المستفيد</label>
                        <CustomDropdown
                            options={beneficiaryOptions}
                            value={idBeneficiaire ?? ''}
                            onChange={(val) => { setIdBeneficiaire(val ? Number(val) : null); markDirty(); }}
                            
                            placeholder="-- اختر مستفيد --"
                            disabled={isFieldsLocked}
                            className="mt-1 text-center"
                        />
                    </div>
                )}

                {shouldShowAccountDropdown && (
                    <div className="p-2 border border-yellow-300 bg-yellow-50 rounded-md">
                        <label htmlFor="idCompte" className="block text-sm font-medium text-yellow-800 text-right uppercase text-center text-[10px]">الحساب البنكي</label>
                        <select
                            id="idCompte"
                            value={idCompte ?? ''}
                            onChange={e => { setIdCompte(e.target.value ? Number(e.target.value) : null); markDirty(); }}
                            required
                            className="w-full h-9 px-3 py-1 mt-1 text-center text-xs text-gray-700 bg-white border border-gray-300 rounded-[20px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                            disabled={isFieldsLocked && !!idPieceInit && !!pieces.find(p => p.ID_PIECE === idPieceInit)?.ID_COMPTE}
                        >
                            <option value="">-- يرجى اختيار حساب --</option>
                            {availableAccounts.map(acc => (
                                <option key={acc.ID_COMPTE} value={acc.ID_COMPTE}>
                                    {acc.BANQUE} - {acc.RIB}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label htmlFor="idScat" className="block text-sm font-medium text-gray-700 text-right">الصنف الفرعي</label>
                        <select
                            id="idScat"
                            value={idScat ?? ''}
                            onChange={e => { setIdScat(e.target.value ? Number(e.target.value) : null); markDirty(); }}
                            required
                            className="w-full h-9 px-3 py-1 mt-1 text-center text-xs text-gray-700 bg-gray-100 border border-gray-300 rounded-[20px] disabled:bg-gray-200"
                            disabled={isFieldsLocked}
                        >
                            <option value="">-- اختر صنف فرعي --</option>
                            {availableScategoriesForOperation.map(s => (
                                <option key={s.ID_SCATEGORIE} value={s.ID_SCATEGORIE}>
                                    {s.C_SCATEGORIE} / {s.INT_SCATEGORIE}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="idRubrique" className="block text-sm font-medium text-gray-700 text-right">تفصيل الهيكلة</label>
                        <select
                            id="idRubrique"
                            value={idRubrique ?? ''}
                            onChange={e => { setIdRubrique(e.target.value ? Number(e.target.value) : null); markDirty(); }}
                            className="w-full h-9 px-3 py-1 mt-1 text-center text-xs text-gray-700 bg-gray-100 border border-gray-300 rounded-[20px] disabled:bg-gray-200"
                            disabled={isFieldsLocked}
                        >
                            <option value="">-- اختر --</option>
                            {availableRubriquesForOperation.map(r => (
                                <option key={r.ID_RUBRIQUE} value={r.ID_RUBRIQUE}>
                                    {r.RUBRIQUE}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {renderConditionalFields()}

                <div className="grid grid-cols-2 gap-3 p-2 bg-blue-50 rounded-lg border border-blue-100">
                    <div className="flex items-center justify-end gap-2 opacity-80">
                        <label htmlFor="saiEng" className="text-xs font-medium text-gray-700">تم تسجيلها بجدول الالتزام (آلي)</label>
                        <input
                            id="saiEng"
                            type="checkbox"
                            checked={saiEng}
                            disabled
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-not-allowed"
                        />
                    </div>
                    <div className="flex items-center justify-end gap-2 opacity-80">
                        <label htmlFor="saiPai" className="text-xs font-medium text-gray-700">تم تسجيلها بجدول الدفع (آلي)</label>
                        <input
                            id="saiPai"
                            type="checkbox"
                            checked={saiPai}
                            disabled
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-not-allowed"
                        />
                    </div>
                </div>
            </div>
        </form>
    );
};

export default AddDocumentForm;