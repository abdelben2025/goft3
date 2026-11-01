import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Paiement, Engagement, Piece, Cp } from '../../types';
import { normalizeDate, getCurrentDate } from '../../utils/dateUtils';
import { DateInputField } from '../DateInputField';
import { formatCurrency, parseCurrency, formatAmountInput, formatCurrencyForInput } from '../../utils/currencyUtils';
import { useLanguage } from '../../context/LanguageContext';
import { labelNaturePiece } from '../../utils/dataLabels';

const parseWorkStatementNumber = (text?: string): number | null => {
    if (!text) return null;
    const numMatch = text.match(/رقم:\s*(\d+)/);
    return numMatch ? parseInt(numMatch[1], 10) : null;
};

interface AddPaiementFormProps {
    onClose: () => void;
    onSave: (paiement: any) => void | Promise<void>;
    operationId: number;
    engagements: Engagement[];
    pieces: Piece[];
    cpItems: Cp[];
    initialData?: Paiement;
    allPaiementsForOp: Paiement[];
    selectedYear: string;
    defaultPieceId?: number;
}

const AddPaiementForm: React.FC<AddPaiementFormProps> = ({ onClose, onSave, operationId, engagements, pieces, cpItems, initialData, allPaiementsForOp, selectedYear, defaultPieceId }) => {
    const { t } = useLanguage();
    // Basic info
    const [nPai, setNPai] = useState('');
    const [annee, setAnnee] = useState(() => initialData ? initialData.ANNEE : selectedYear);
    
    // Available years for selection
    const years = useMemo(() => {
        const currentYear = new Date().getFullYear();
        const startYear = 2020;
        const endYear = currentYear + 5;
        const out = [];
        for (let y = startYear; y <= endYear; y++) {
            out.push(y.toString());
        }
        return out;
    }, []);
    
    // Logic for default dates based on fiscal year vs system year
    const getDefaultDate = useCallback(() => {
        const currentYear = new Date().getFullYear();
        const fiscalYear = parseInt(annee, 10);
        if (!isNaN(fiscalYear) && fiscalYear < currentYear) {
            return `31/12/${annee}`;
        }
        return getCurrentDate();
    }, [annee]);

    const [idPiece, setIdPiece] = useState<number>(0);
    const [idEng, setIdEng] = useState<number>(0);
    const [objetPai, setObjetPai] = useState('');
    const [datePai, setDatePai] = useState(() => initialData ? normalizeDate(initialData.DATE_PAI) : getDefaultDate());

    // Detailed amounts (as strings for display)
    const [montantTravauxRealisesStr, setMontantTravauxRealisesStr] = useState('0');
    const [avanceForfaitaireStr, setAvanceForfaitaireStr] = useState('0');
    const [avanceApprovisionnementStr, setAvanceApprovisionnementStr] = useState('0');
    const [retenueGarantieStr, setRetenueGarantieStr] = useState('0');
    const [penaliteRetardStr, setPenaliteRetardStr] = useState('0');
    const [autreDeductionStr, setAutreDeductionStr] = useState('0');
    const [remboursementAvanceForfaitaireStr, setRemboursementAvanceForfaitaireStr] = useState('0');
    const [remboursementAvanceApprovisionnementStr, setRemboursementAvanceApprovisionnementStr] = useState('0');

    // Editable Calculated Fields
    const [previousPaymentsStr, setPreviousPaymentsStr] = useState('0');
    const [montantPaiStr, setMontantPaiStr] = useState('0');

    // Calculated net amount (number for logic)
    const [montantPai, setMontantPai] = useState(0);

    // Mandat info
    const [nManda, setNMandat] = useState<string | null>('');
    const [dateMandat, setDateMandat] = useState(() => initialData ? normalizeDate(initialData.DATE_MANDAT) : getDefaultDate());
    const [dateAdmis, setDateAdmis] = useState('');

    // Ref to track if user has interacted with form (to prevent auto-overwrite)
    const isDirty = useRef(false);
    const isEditLoaded = useRef(false);

    const markDirty = useCallback(() => { isDirty.current = true; }, []);

    // 1. منطق الفلترة المحدث لمنع ظهور الوثائق المدفوعة أو التي تفوق رصيد CP
    const availablePieces = useMemo(() => {
        // حساب رصيد CP المتبقي لهذه العملية ولهذه السنة
        const cp = cpItems.find(c => 
            Number(c.ID_OPERATION) === Number(operationId) && 
            c.ANNEE === selectedYear
        );

        const totalCP = cp?.MONTANT_FINALE_CP || 0;
        const consumedCP = allPaiementsForOp
            .filter(p => p.ANNEE === selectedYear)
            .reduce((sum, p) => sum + (p.MONTANT_PAI || 0), 0);
        
        const remainingCP = cp ? (totalCP - consumedCP) : 0;

        return pieces.filter(p => {
            const isForOperation = Number(p.ID_OPERATION) === Number(operationId);
            if (!isForOperation) return false;

            const isDefaultPiece = defaultPieceId && Number(p.ID_PIECE) === Number(defaultPieceId);
            const isCurrentPieceForEdit = initialData && Number(p.ID_PIECE) === Number(initialData.ID_PIECE);

            // If selected or default piece for editing/assignment, always allow it!
            if (isDefaultPiece || isCurrentPieceForEdit) return true;

            const isPayableType = ['وضعية الأشغال', 'فاتورة', 'حكم قضائي', 'وضعية التسبيق الجزافي', 'وضعية التسبيق على التموين'].includes(p.NAT_PIECE);
            if (!isPayableType) return false;

            // التأكد بشكل صارم من أن الوثيقة لم تدفع من قبل
            const isNotPaid = !allPaiementsForOp.some(pai => Number(pai.ID_PIECE) === Number(p.ID_PIECE));

            if (!isNotPaid) return false;

            // جديد: التحقق من "مستحقات الدفع" (إفراط CP)
            // إذا كان مبلغ الوثيقة يتجاوز الرصيد المتبقي، فلا تظهر في القائمة (باستثناء الوثيقة المختارة حالياً عند التعديل)
            if (!isCurrentPieceForEdit) {
                if (!cp && p.MONTANT_PIECE > 0) return false;
                if (p.MONTANT_PIECE > remainingCP) return false;
            }

            // العثور على الالتزام المرتبط
            let associatedEngagement;
            if (p.NAT_PIECE === 'فاتورة' || p.NAT_PIECE === 'حكم قضائي') {
                associatedEngagement = engagements.find(e => Number(e.ID_PIECE) === Number(p.ID_PIECE));
                if (!associatedEngagement && p.ID_PIECE_INIT) {
                    associatedEngagement = engagements.find(e => Number(e.ID_PIECE) === Number(p.ID_PIECE_INIT));
                }
            } else {
                // البحث في الشجرة للعثور على الالتزام المرتبط بالوثيقة الأم أو الأجداد
                associatedEngagement = engagements.find(e => Number(e.ID_PIECE) === Number(p.ID_PIECE));
                if (!associatedEngagement) {
                    let searchPiece = p;
                    let stries = 0;
                    while (searchPiece.ID_PIECE_INIT && stries < 10) {
                        associatedEngagement = engagements.find(e => Number(e.ID_PIECE) === Number(searchPiece.ID_PIECE_INIT));
                        if (associatedEngagement) break;
                        const parent = pieces.find(x => Number(x.ID_PIECE) === Number(searchPiece.ID_PIECE_INIT));
                        if (!parent) break;
                        searchPiece = parent;
                        stries++;
                    }
                }
            }

            if (!associatedEngagement) return false;

            // يجب أن يكون الالتزام مؤشراً (يحتوي على رقم تأشيرة)
            const hasVisa = !!(associatedEngagement.N_VISA_CB && associatedEngagement.N_VISA_CB.trim() !== '');

            return hasVisa;
        });
    }, [pieces, operationId, allPaiementsForOp, initialData, engagements, defaultPieceId, cpItems, selectedYear]);

    const isInvoicePayment = useMemo(() => {
        const piece = pieces.find(p => Number(p.ID_PIECE) === Number(idPiece));
        return piece?.NAT_PIECE === 'فاتورة' || piece?.NAT_PIECE === 'حكم قضائي';
    }, [idPiece, pieces]);

    // 2. دالة التعبئة التلقائية المحدثة
    const updateFieldsForPiece = useCallback((selectedPieceId: number) => {
        const selectedPiece = pieces.find(p => Number(p.ID_PIECE) === Number(selectedPieceId));
        if (selectedPiece) {
            setObjetPai(selectedPiece.PIECE);

            if (selectedPiece.NAT_PIECE === 'وضعية التسبيق الجزافي') {
                setMontantTravauxRealisesStr('0');
                setAvanceForfaitaireStr(formatCurrency(selectedPiece.MONTANT_PIECE));
                setAvanceApprovisionnementStr('0');
                // التسبيق الجزافي هو الدفع الأول => لا دفعات سابقة
                setPreviousPaymentsStr('0');
            } else if (selectedPiece.NAT_PIECE === 'وضعية التسبيق على التموين') {
                const contractId = selectedPiece.ID_PIECE_INIT;
                let prevSum = 0;
                if (contractId) {
                    prevSum = allPaiementsForOp
                        .filter(pay => {
                            const p = pieces.find(pc => Number(pc.ID_PIECE) === Number(pay.ID_PIECE));
                            return p && Number(p.ID_PIECE_INIT) === Number(contractId) &&
                                (p.NAT_PIECE === 'وضعية التسبيق الجزافي' || p.NAT_PIECE === 'وضعية التسبيق على التموين') &&
                                (!initialData || Number(pay.ID_PAIEMENT) !== Number(initialData.ID_PAIEMENT));
                        })
                        .reduce((sum, pay) => sum + pay.MONTANT_PAI, 0);
                }
                setMontantTravauxRealisesStr('0');
                setAvanceForfaitaireStr('0');
                setAvanceApprovisionnementStr(formatCurrency(selectedPiece.MONTANT_PIECE));
                setPreviousPaymentsStr(formatCurrency(prevSum));
            } else if (selectedPiece.NAT_PIECE === 'وضعية الأشغال') {
                // العثور على الالتزام الأب
                const relatedEngagement = engagements.find(e =>
                    (selectedPiece.ID_PIECE_INIT && Number(e.ID_PIECE) === Number(selectedPiece.ID_PIECE_INIT)) ||
                    (Number(e.ID_PIECE) === Number(selectedPiece.ID_PIECE))
                );
                const tempEngId = relatedEngagement?.ID_ENGAGEMENT || 0;
                const contractId = selectedPiece.ID_PIECE_INIT;

                // رقم الوضعية الحالية
                const currentSeq = parseWorkStatementNumber(selectedPiece.PIECE) ?? Infinity;

                // أ. حساب مجموع دفعات الأشغال السابقة (الوضعيات الأقدم فقط)
                const sumPreviousWorksOnly = allPaiementsForOp
                    .filter(p => Number(p.ID_ENG) === Number(tempEngId))
                    .reduce((sum, p) => {
                        const payPiece = pieces.find(i => Number(i.ID_PIECE) === Number(p.ID_PIECE));
                        if (payPiece?.NAT_PIECE !== 'وضعية الأشغال') return sum;
                        const seq = parseWorkStatementNumber(payPiece.PIECE) ?? 0;
                        return seq < currentSeq ? sum + p.MONTANT_PAI : sum;
                    }, 0);

                // مجموع التسبيقات المدفوعة لهذا العقد
                let sumAdvances = 0;
                if (contractId) {
                    sumAdvances = allPaiementsForOp
                        .filter(pay => {
                            const p = pieces.find(pc => Number(pc.ID_PIECE) === Number(pay.ID_PIECE));
                            return p && Number(p.ID_PIECE_INIT) === Number(contractId) &&
                                (p.NAT_PIECE === 'وضعية التسبيق الجزافي' || p.NAT_PIECE === 'وضعية التسبيق على التموين');
                        })
                        .reduce((sum, pay) => sum + pay.MONTANT_PAI, 0);
                }

                // مجموع الدفعات السابقة = التسبيقات + الوضعيات الأقدم
                setPreviousPaymentsStr(formatCurrency(sumAdvances + sumPreviousWorksOnly));
                setMontantTravauxRealisesStr(formatCurrency(sumPreviousWorksOnly + selectedPiece.MONTANT_PIECE));

                // ب. تعبئة التسبيقات آلياً إذا وجدت
                if (contractId) {
                    // جلب تسبيق جزافي مدفوع مسبقاً
                    const forfaitaireAmount = allPaiementsForOp
                        .filter(pay => {
                            const p = pieces.find(pc => Number(pc.ID_PIECE) === Number(pay.ID_PIECE));
                            return p && Number(p.ID_PIECE_INIT) === Number(contractId) && p.NAT_PIECE === 'وضعية التسبيق الجزافي';
                        })
                        .reduce((sum, pay) => sum + pay.MONTANT_PAI, 0);
                    setAvanceForfaitaireStr(formatCurrency(forfaitaireAmount));

                    // جلب تسبيق تموين مدفوع مسبقاً
                    const approAmount = allPaiementsForOp
                        .filter(pay => {
                            const p = pieces.find(pc => Number(pc.ID_PIECE) === Number(pay.ID_PIECE));
                            return p && Number(p.ID_PIECE_INIT) === Number(contractId) && p.NAT_PIECE === 'وضعية التسبيق على التموين';
                        })
                        .reduce((sum, pay) => sum + pay.MONTANT_PAI, 0);
                    setAvanceApprovisionnementStr(formatCurrency(approAmount));
                }
            } else {
                setMontantTravauxRealisesStr(formatCurrency(selectedPiece.MONTANT_PIECE));
                setAvanceForfaitaireStr('0');
                setAvanceApprovisionnementStr('0');
                setPreviousPaymentsStr('0');
            }
        }
    }, [pieces, engagements, allPaiementsForOp, initialData]);

    // مراقبة تغيير الوثيقة المختارة لتشغيل التعبئة التلقائية
    const handlePieceChange = useCallback((newPieceId: number) => {
        setIdPiece(Number(newPieceId));
        // العثور على الالتزام المرتبط
        const piece = pieces.find(p => Number(p.ID_PIECE) === Number(newPieceId));
        if (piece) {
            let relatedEng;
            if (piece.NAT_PIECE === 'فاتورة' || piece.NAT_PIECE === 'حكم قضائي') {
                relatedEng = engagements.find(e => Number(e.ID_PIECE) === Number(piece.ID_PIECE));
                if (!relatedEng && piece.ID_PIECE_INIT) {
                    relatedEng = engagements.find(e => Number(e.ID_PIECE) === Number(piece.ID_PIECE_INIT));
                }
            } else {
                relatedEng = engagements.find(e => Number(e.ID_PIECE) === Number(piece.ID_PIECE_INIT));
            }
            setIdEng(relatedEng?.ID_ENGAGEMENT || 0);
        }

        updateFieldsForPiece(Number(newPieceId));
        markDirty();
    }, [pieces, engagements, updateFieldsForPiece, markDirty]);

    // إعداد البيانات الأولية عند التعديل
    useEffect(() => {
        if (initialData && !isEditLoaded.current) {
            setNPai(initialData.N_PAI);
            setIdPiece(Number(initialData.ID_PIECE));
            setIdEng(Number(initialData.ID_ENG));
            setObjetPai(initialData.OBJET_PAI);
            setDatePai(normalizeDate(initialData.DATE_PAI));
            setNMandat(initialData.N_MANDAT);
            setDateMandat(normalizeDate(initialData.DATE_MANDAT));
            setDateAdmis(normalizeDate(initialData.DATE_ADMIS));
            setMontantTravauxRealisesStr(formatCurrency(initialData.MONTANT_TRAVAUX_REALISES || 0));
            setAvanceForfaitaireStr(formatCurrency(initialData.AVANCE_FORFAITAIRE || 0));
            setAvanceApprovisionnementStr(formatCurrency(initialData.AVANCE_APPROVISIONNEMENT || 0));
            setRetenueGarantieStr(formatCurrency(initialData.RETENUE_GARANTIE || 0));
            setPenaliteRetardStr(formatCurrency(initialData.PENALITE_RETARD || 0));
            setAutreDeductionStr(formatCurrency(initialData.AUTRE_DEDUCTION || 0));
            setRemboursementAvanceForfaitaireStr(formatCurrency(initialData.REMBOURSEMENT_AVANCE_FORFAITAIRE || 0));
            setRemboursementAvanceApprovisionnementStr(formatCurrency(initialData.REMBOURSEMENT_AVANCE_APPROVISIONNEMENT || 0));

            // حساب الدفعات السابقة في وضع التعديل
            const relatedPiece = pieces.find(pc => Number(pc.ID_PIECE) === Number(initialData.ID_PIECE));
            if (relatedPiece && (relatedPiece.NAT_PIECE === 'وضعية الأشغال' || relatedPiece.NAT_PIECE === 'وضعية التسبيق الجزافي' || relatedPiece.NAT_PIECE === 'وضعية التسبيق على التموين')) {
                const priorPayments = allPaiementsForOp.filter(p =>
                    Number(p.ID_ENG) === Number(initialData.ID_ENG) && Number(p.ID_PAIEMENT) !== Number(initialData.ID_PAIEMENT)
                );
                if (relatedPiece.NAT_PIECE === 'وضعية الأشغال') {
                    const currentSeq = parseWorkStatementNumber(relatedPiece.PIECE) ?? Infinity;
                    const prevSum = priorPayments.reduce((sum, p) => {
                        const payPiece = pieces.find(i => Number(i.ID_PIECE) === Number(p.ID_PIECE));
                        if (payPiece?.NAT_PIECE !== 'وضعية الأشغال') return sum;
                        const seq = parseWorkStatementNumber(payPiece.PIECE) ?? 0;
                        return seq < currentSeq ? sum + p.MONTANT_PAI : sum;
                    }, 0);
                    const contractId = relatedPiece.ID_PIECE_INIT;
                    let prevAdvances = 0;
                    if (contractId) {
                        prevAdvances = allPaiementsForOp
                            .filter(pay => {
                                const p = pieces.find(pc => Number(pc.ID_PIECE) === Number(pay.ID_PIECE));
                                return p && Number(p.ID_PIECE_INIT) === Number(contractId) &&
                                    (p.NAT_PIECE === 'وضعية التسبيق الجزافي' || p.NAT_PIECE === 'وضعية التسبيق على التموين');
                            })
                            .reduce((sum, pay) => sum + pay.MONTANT_PAI, 0);
                    }
                    setPreviousPaymentsStr(formatCurrency(prevAdvances + prevSum));
                } else if (relatedPiece.NAT_PIECE === 'وضعية التسبيق على التموين') {
                    const contractId = relatedPiece.ID_PIECE_INIT;
                    let prevSum = 0;
                    if (contractId) {
                        prevSum = allPaiementsForOp
                            .filter(pay => {
                                const p = pieces.find(pc => Number(pc.ID_PIECE) === Number(pay.ID_PIECE));
                                return p && Number(p.ID_PIECE_INIT) === Number(contractId) &&
                                    (p.NAT_PIECE === 'وضعية التسبيق الجزافي' || p.NAT_PIECE === 'وضعية التسبيق على التموين') &&
                                    Number(pay.ID_PAIEMENT) !== Number(initialData.ID_PAIEMENT);
                            })
                            .reduce((sum, pay) => sum + pay.MONTANT_PAI, 0);
                    }
                    setPreviousPaymentsStr(formatCurrency(prevSum));
                } else {
                    // التسبيق الجزافي هو الدفع الأول => لا دفعات سابقة
                    setPreviousPaymentsStr('0');
                }
            }

            isEditLoaded.current = true;
            isDirty.current = true;
        } else if (!initialData && defaultPieceId && !isDirty.current) {
            handlePieceChange(Number(defaultPieceId));
        }
    }, [initialData, defaultPieceId, pieces, allPaiementsForOp, handlePieceChange]);

    // حساب صافي الدفع: ثابت دائماً = مبلغ الوثيقة
    useEffect(() => {
        const selectedPiece = pieces.find(p => Number(p.ID_PIECE) === Number(idPiece));
        const net = selectedPiece?.MONTANT_PIECE || 0;
        setMontantPai(net);
		setMontantPaiStr(formatCurrency(net));
		
    }, [idPiece, pieces]);

    // تعبئة تلقائية لحقل اقتطاع الضمان عندما يكون نوع ضمان العقد RETENTION
    useEffect(() => {
        const selectedPiece = pieces.find(p => Number(p.ID_PIECE) === Number(idPiece));
        if (!selectedPiece) return;
        let contract: Piece | undefined = selectedPiece;
        const visited = new Set<number>();
        while (contract && contract.ID_PIECE_INIT && !visited.has(Number(contract.ID_PIECE))) {
            visited.add(Number(contract.ID_PIECE));
            contract = pieces.find(p => Number(p.ID_PIECE) === Number(contract!.ID_PIECE_INIT));
        }
        if (!contract || contract.TYPE_CAUTION !== 'RETENTION') return;
        const match = (contract.CAUTION || '').match(/\d+(\.\d+)?/);
        if (!match) return;
        const raw = parseFloat(match[0]);
        const pct = raw > 1 ? raw : raw * 100;
        const reimbCurrent = parseCurrency(remboursementAvanceForfaitaireStr) + parseCurrency(remboursementAvanceApprovisionnementStr);
        const retention = (montantPai + reimbCurrent) * pct / 100;
        setRetenueGarantieStr(formatCurrency(retention));
    }, [idPiece, pieces, montantPai, remboursementAvanceForfaitaireStr, remboursementAvanceApprovisionnementStr]);

    // حساب مبلغ الأشغال (تراكمي): وضعية حالية + تسديدات التسبيقات + اقتطاع الضمان + الوضعيات الأقدم
    useEffect(() => {
        const selectedPiece = pieces.find(p => Number(p.ID_PIECE) === Number(idPiece));
        if (!selectedPiece || selectedPiece.NAT_PIECE !== 'وضعية الأشغال') return;

        const relatedEngagement = engagements.find(e =>
            (selectedPiece.ID_PIECE_INIT && Number(e.ID_PIECE) === Number(selectedPiece.ID_PIECE_INIT)) ||
            (Number(e.ID_PIECE) === Number(selectedPiece.ID_PIECE))
        );
        const engId = relatedEngagement?.ID_ENGAGEMENT || 0;
        const currentSeq = parseWorkStatementNumber(selectedPiece.PIECE) ?? Infinity;

        const sumEarlier = allPaiementsForOp
            .filter(p => Number(p.ID_ENG) === Number(engId))
            .reduce((sum, p) => {
                const payPiece = pieces.find(i => Number(i.ID_PIECE) === Number(p.ID_PIECE));
                if (payPiece?.NAT_PIECE !== 'وضعية الأشغال') return sum;
                const seq = parseWorkStatementNumber(payPiece.PIECE) ?? 0;
                return seq < currentSeq ? sum + p.MONTANT_PAI : sum;
            }, 0);

        const reimbPrev = allPaiementsForOp
            .filter(p => Number(p.ID_ENG) === Number(engId) && (!initialData || Number(p.ID_PAIEMENT) !== Number(initialData.ID_PAIEMENT)))
            .reduce((sum, p) => {
                const payPiece = pieces.find(i => Number(i.ID_PIECE) === Number(p.ID_PIECE));
                if (payPiece?.NAT_PIECE !== 'وضعية الأشغال') return sum;
                const seq = parseWorkStatementNumber(payPiece.PIECE) ?? 0;
                if (seq >= currentSeq) return sum;
                return sum + (p.REMBOURSEMENT_AVANCE_FORFAITAIRE || 0) + (p.REMBOURSEMENT_AVANCE_APPROVISIONNEMENT || 0);
            }, 0);
        const reimbCurrent = parseCurrency(remboursementAvanceForfaitaireStr) + parseCurrency(remboursementAvanceApprovisionnementStr);
        const retention = parseCurrency(retenueGarantieStr);
        setMontantTravauxRealisesStr(formatCurrency(selectedPiece.MONTANT_PIECE + retention + reimbPrev + reimbCurrent + sumEarlier));
    }, [idPiece, pieces, engagements, allPaiementsForOp, remboursementAvanceForfaitaireStr, remboursementAvanceApprovisionnementStr, retenueGarantieStr, initialData]);

    // ترقيم الدفعات آلياً عند تغيير السنة
    useEffect(() => {
        if (!initialData) {
            const paiementsInYear = allPaiementsForOp.filter(p => p.ANNEE === annee);
            const maxNPai = Math.max(0, ...paiementsInYear.map(p => parseInt(p.N_PAI, 10) || 0));
            setNPai((maxNPai + 1).toString().padStart(2, '0'));
        }
    }, [annee, allPaiementsForOp, initialData]);

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        if (!idPiece || idPiece === 0) {
            alert(t('payform.selectDocAlert'));
            return;
        }

        setIsSubmitting(true);
        const { ...validInitialData } = (initialData || {}) as any;

        const payload = {
            ...validInitialData,
            ID_OPERATION: operationId,
            ID_ENG: Number(idEng),
            N_PAI: nPai,
            ANNEE: annee,
            DATE_PAI: datePai,
            OBJET_PAI: objetPai,
            ID_PIECE: Number(idPiece),
            TOTAL_PAI: 0,
            N_MANDAT: nManda,
            DATE_MANDAT: dateMandat,
            DATE_ADMIS: dateAdmis,
            MONTANT_PAI: montantPai,
            MONTANT_TRAVAUX_REALISES: parseCurrency(montantTravauxRealisesStr),
            AVANCE_FORFAITAIRE: parseCurrency(avanceForfaitaireStr),
            AVANCE_APPROVISIONNEMENT: parseCurrency(avanceApprovisionnementStr),
            RETENUE_GARANTIE: parseCurrency(retenueGarantieStr),
            PENALITE_RETARD: parseCurrency(penaliteRetardStr),
            AUTRE_DEDUCTION: parseCurrency(autreDeductionStr),
            REMBOURSEMENT_AVANCE_FORFAITAIRE: parseCurrency(remboursementAvanceForfaitaireStr),
            REMBOURSEMENT_AVANCE_APPROVISIONNEMENT: parseCurrency(remboursementAvanceApprovisionnementStr),
        };

        Promise.resolve(onSave(payload)).finally(() => {
            setIsSubmitting(false);
        });
    };

    const createAmountInput = (id: string, label: string, value: string, setter: (val: string) => void, readOnly?: boolean) => (
        <div>
            <label htmlFor={id} className="block text-sm font-medium text-gray-700 text-right">{label}</label>
            <input
                id={id}
                type="text"
                inputMode="decimal"
                value={value}
                readOnly={readOnly}
                onChange={(e) => { markDirty(); setter(formatAmountInput(e.target.value)); }}
                onFocus={(e) => { if (!readOnly) setter(formatCurrencyForInput(parseCurrency(e.target.value))); }}
                onBlur={(e) => { setter(formatCurrency(parseCurrency(e.target.value))); }}
                className={`w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-[20px] ${readOnly ? 'bg-gray-200' : 'bg-white'}`}
            />
        </div>
    );

    return (
        <form onSubmit={handleSubmit} className="flex flex-col max-h-[85vh]">
            <div className="sticky top-0 bg-white z-10 pb-2 border-b border-gray-200 flex justify-end gap-3 pt-1 mb-2">
                <button type="button" onClick={onClose} className="px-5 py-1.5 bg-gray-200 text-gray-800 rounded-[20px] hover:bg-gray-300 transition-colors text-sm">{t('btn.cancel')}</button>
                <button type="submit" disabled={isSubmitting} className="px-5 py-1.5 bg-blue-600 text-white rounded-[20px] hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed text-sm">
                    {isSubmitting ? t('payform.saving') : (initialData ? t('payform.saveChanges') : t('payform.addPayment'))}
                </button>
            </div>

            <div className="space-y-3 overflow-y-auto p-1">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                        <label htmlFor="idPiece" className="block text-sm font-medium text-gray-700 text-right">{t('payform.paymentDoc')}</label>
                        <select id="idPiece" value={idPiece} onChange={e => handlePieceChange(Number(e.target.value))} required className="w-full h-9 px-1 py-1 mt-1 text-center text-gray-700 bg-gray-100 border border-gray-300 rounded-[20px] text-xs">
                            <option value="0">{availablePieces.length > 0 ? t('payform.selectDoc') : t('payform.noDocs')}</option>
                            {availablePieces.map(p => (
                                <option key={p.ID_PIECE} value={p.ID_PIECE}>{p.PIECE} ({labelNaturePiece(p.NAT_PIECE, t)})</option>
                            ))}
                        </select>
                    </div>
                <div className="flex gap-2">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 text-center">{t('payform.numYear')}</label>
                        <div className="flex items-center gap-1 mt-1">
                            <input value={nPai} readOnly className="w-16 h-9 px-1 py-1 text-sm text-center text-gray-700 bg-gray-200 border border-gray-300 rounded-[20px] font-bold" />
                            <span className="text-gray-400">/</span>
                            <select 
                                value={annee} 
                                onChange={e => { setAnnee(e.target.value); markDirty(); }}
                                className="h-9 w-24 px-1 py-1 text-sm text-center text-gray-700 bg-gray-100 border border-gray-300 rounded-[20px] font-bold cursor-pointer"
                            >
                                {years.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 text-right">{t('payform.subject')}</label>
                    <input value={objetPai} onChange={e => { setObjetPai(e.target.value); markDirty(); }} required className="w-full h-9 px-3 py-2 mt-1 text-xs text-gray-700 bg-gray-100 border border-gray-300 rounded-[20px]" />
                </div>
                <div>
                    <DateInputField id="datePai" label={t('payform.cardDate')} value={datePai} onChange={(val) => { setDatePai(val); markDirty(); }} required />
                </div>
            </div>

            {idPiece > 0 && (
                <div className="space-y-3 pt-3 border-t border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {createAmountInput(
                            'tr', 
                            pieces.find(p => Number(p.ID_PIECE) === Number(idPiece))?.NAT_PIECE === 'حكم قضائي' ? t('payform.judgmentAmount') : (isInvoicePayment ? t('payform.invoiceAmount') : t('payform.worksAmount')), 
                            montantTravauxRealisesStr, 
                            setMontantTravauxRealisesStr
                        )}
                        {!isInvoicePayment && createAmountInput('pp', t('payform.prevPaymentsSum'), previousPaymentsStr, setPreviousPaymentsStr)}
                    </div>

                    {!isInvoicePayment && (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <fieldset className="border border-gray-300 p-2 rounded-[20px]">
                                    <legend className="px-1 text-xs font-bold text-blue-700">{t('payform.advancesLegend')}</legend>
                                    <div className="grid grid-cols-2 gap-2">
                                        {createAmountInput('af', t('payform.lumpSum'), avanceForfaitaireStr, setAvanceForfaitaireStr)}
                                        {createAmountInput('aa', t('payform.supply'), avanceApprovisionnementStr, setAvanceApprovisionnementStr)}
                                    </div>
                                </fieldset>

                                <fieldset className="border border-gray-300 p-2 rounded-[20px]">
                                    <legend className="px-1 text-xs font-bold text-green-700">{t('payform.repayAdvancesLegend')}</legend>
                                    <div className="grid grid-cols-2 gap-2">
                                        {createAmountInput('raf', t('payform.lumpSum'), remboursementAvanceForfaitaireStr, setRemboursementAvanceForfaitaireStr)}
                                        {createAmountInput('raa', t('payform.supply'), remboursementAvanceApprovisionnementStr, setRemboursementAvanceApprovisionnementStr)}
                                    </div>
                                </fieldset>
                            </div>

                            <fieldset className="border border-gray-300 p-2 rounded-[20px]">
                                <legend className="px-1 text-xs font-bold text-red-700">{t('payform.deductionsLegend')}</legend>
                                <div className="grid grid-cols-3 gap-3">
                                    {createAmountInput('rg', t('payform.guarantee'), retenueGarantieStr, setRetenueGarantieStr)}
                                    {createAmountInput('ad', t('payform.excess'), autreDeductionStr, setAutreDeductionStr)}
                                    {createAmountInput('pr', t('payform.delay'), penaliteRetardStr, setPenaliteRetardStr)}
                                </div>
                            </fieldset>
                        </>
                    )}

                    <div className="p-3 bg-blue-50 border-r-4 border-blue-600 rounded-[20px] flex items-center justify-between">
                        <label className="text-md font-bold text-blue-900">{t('payform.netPayment')}</label>
                        <input value={montantPaiStr} readOnly className="text-xl font-black text-right bg-transparent border-none text-blue-800 w-auto" />
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-t pt-3">
                <div>
                    <label className="block text-sm font-medium text-gray-700 text-right">{t('payform.mandatNo')}</label>
                    <input value={nManda ?? ''} onChange={e => { setNMandat(e.target.value); markDirty(); }} className="w-full h-9 px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-[20px]" />
                </div>
                <DateInputField id="dm" label={t('payform.mandatDate')} value={dateMandat} onChange={(val) => { setDateMandat(val); markDirty(); }} />
                <DateInputField id="da" label={t('payform.acceptanceDate')} value={dateAdmis} onChange={(val) => { setDateAdmis(val); markDirty(); }} />
            </div>

            </div>
        </form>
    );
};

export default AddPaiementForm;