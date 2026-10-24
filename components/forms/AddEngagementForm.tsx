import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Engagement, Piece, RubriqueOp } from '../../types';
import { normalizeDate, compareDates, getCurrentDate } from '../../utils/dateUtils';
import { DateInputField } from '../DateInputField';
import { formatCurrency, parseCurrency, formatAmountInput, formatCurrencyForInput } from '../../utils/currencyUtils';

interface AddEngagementFormProps {
    onClose: () => void;
    onSave: (engagement: any) => void | Promise<void>;
    operationId: number;
    pieces: Piece[];
    rubriqueOps: RubriqueOp[];
    initialData?: Engagement;
    allEngagementsForOp: Engagement[];
    selectedYear: string;
    defaultPieceId?: number; // New Prop
}

const natureEngOptions = ["التسجيل", "تفريد", "تغطية مالية", "تغيير هيكلة الكلفة", "التزام", "سحب", "فسخ", "إعادة التقييم", "إنخفاض التقييم", "غلق", "إعادة الترتيب", "إلغاء", "أخرى"];

const AddEngagementForm: React.FC<AddEngagementFormProps> = ({ onClose, onSave, operationId, pieces, rubriqueOps, initialData, allEngagementsForOp, selectedYear, defaultPieceId }) => {
    const [nEng, setNEng] = useState('');
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

    const [idPiece, setIdPiece] = useState<number>(0);
    const [natureEng, setNatureEng] = useState(initialData ? initialData.NATURE_ENG : natureEngOptions[4]);
    const [objetEng, setObjetEng] = useState('');
    const [montantEngStr, setMontantEngStr] = useState('0');
    const [dateEng, setDateEng] = useState(() => {
        if (initialData) return normalizeDate(initialData.DATE_ENG);
        const currentYear = new Date().getFullYear();
        const fiscalYear = parseInt(annee, 10);
        if (!isNaN(fiscalYear) && fiscalYear < currentYear) {
            return `20/12/${fiscalYear}`;
        }
        return getCurrentDate();
    });
    const [nVisaCb, setNVisaCb] = useState('');
    const [dateVisaCb, setDateVisaCb] = useState('');

    // Track if user has modified the form manually
    const isDirty = useRef(false);
    // Track if initial data load (Edit mode) is done
    const isEditLoaded = useRef(false);

    const [financials, setFinancials] = useState({
        aeEng: 0,
        totalEngAnterieure: 0,
        soldeAnterieure: 0,
        soldeReliquat: 0
    });

    const markDirty = () => {
        isDirty.current = true;
    };

    const availablePieces = useMemo(() => {
        // Determine which pieces are effectively engaged (latest status is not a withdrawal)
        const activeEngagedSet = new Set<number>();
        const pieceEngagements = new Map<number, Engagement[]>();
        allEngagementsForOp.forEach(e => {
            const pid = Number(e.ID_PIECE);
            if (pid > 0) {
                if (!pieceEngagements.has(pid)) pieceEngagements.set(pid, []);
                pieceEngagements.get(pid)!.push(e);
            }
        });

        pieceEngagements.forEach((engs, pid) => {
            const last = [...engs].sort((a, b) => compareDates(a.DATE_ENG || '', b.DATE_ENG || '') || (Number(a.ID_ENGAGEMENT) - Number(b.ID_ENGAGEMENT))).pop();
            if (last && last.NATURE_ENG !== 'سحب') {
                activeEngagedSet.add(pid);
            }
        });

        // حساب الاستهلاك الفعلي لرخصة الالتزام لكل rubrique في هذه العملية
        const rubConsMap = new Map<number, number>();
        allEngagementsForOp.forEach(e => {
            const engPiece = pieces.find(p => Number(p.ID_PIECE) === Number(e.ID_PIECE));
            if (engPiece && engPiece.ID_RUBRIQUE) {
                const rid = Number(engPiece.ID_RUBRIQUE);
                let amount = e.MONTANT_ENG || 0;
                // Withdrawals are always treated via the amount calculation in previous turn (already might be negative)
                // But for rubConsMap, we follow the stored value logic.
                if (e.NATURE_ENG === 'سحب') {
                    // Force subtract absolute value or handle negative stored
                    amount = (e.MONTANT_ENG < 0 ? e.MONTANT_ENG : -e.MONTANT_ENG);
                }
                rubConsMap.set(rid, (rubConsMap.get(rid) || 0) + amount);
            }
        });

        const natureToPieceMap: { [key: string]: { types: string[] } } = {
            'التسجيل': { types: ['مقرر'] },
            'تفريد': { types: ['مقرر'] },
            'تغطية مالية': { types: ['مقرر'] },
            'تغطية المالية': { types: ['مقرر'] },
            'تغيير هيكلة الكلفة': { types: ['مقرر'] },
            'تغير هيكلة الكلفة': { types: ['مقرر'] },
            'إعادة الترتيب': { types: ['مقرر'] },
            'اعادة الترتيب': { types: ['مقرر'] },
            'التزام': { types: ['اتفاقية', 'صفقة', 'فاتورة', 'ملحق', 'قرار', 'سند الطلب', 'حكم قضائي'] },
            'سحب': { types: ['اتفاقية', 'صفقة', 'فاتورة', 'ملحق', 'قرار فسخ', 'قرار', 'سند الطلب', 'مقرر', 'حكم قضائي'] },
            'فسخ': { types: ['قرار فسخ'] },
            'إعادة التقييم': { types: ['مقرر'] },
            'اعادة التقييم': { types: ['مقرر'] },
            'إنخفاض التقييم': { types: ['مقرر'] },
            'انخفاض التقييم': { types: ['مقرر'] },
            'غلق': { types: ['مقرر'] },
            'إلغاء': { types: ['مقرر'] },
            'أخرى': { types: ['أخرى'] },
        };

        const filterConfig = natureToPieceMap[natureEng as keyof typeof natureToPieceMap];

        if (!filterConfig) {
            return [];
        }

        return pieces.filter(p => {
            const pid = Number(p.ID_PIECE);
            const isCurrentPieceForEdit = !!(initialData && pid === Number(initialData.ID_PIECE));
            const isDefaultPiece = !!(defaultPieceId && pid === Number(defaultPieceId));

            if (isCurrentPieceForEdit || isDefaultPiece) return true;

            if (Number(p.ID_OPERATION) !== Number(operationId)) return false;

            const typeMatch = filterConfig.types.includes(p.NAT_PIECE);
            if (!typeMatch && natureEng !== 'سحب') return false;

            if (p.NAT_PIECE === 'مقرر') {
                const subject = (p.PIECE || '').trim();
                if (natureEng === 'التسجيل') {
                    const isOtherMokarrar = subject.includes('تفريد') ||
                        subject.includes('تغطية') ||
                        subject.includes('هيكلة') ||
                        subject.includes('تقييم') ||
                        subject.includes('غلق') ||
                        subject.includes('ترتيب') ||
                        subject.includes('إلغاء') ||
                        subject.includes('الغاء');
                    if (isOtherMokarrar && !subject.includes('التسجيل')) return false;
                } else if (natureEng === 'تفريد') {
                    if (!subject.includes('تفريد')) return false;
                } else if (natureEng === 'تغطية مالية' || natureEng === 'تغطية المالية') {
                    if (!subject.includes('تغطية')) return false;
                } else if (natureEng === 'تغيير هيكلة الكلفة' || natureEng === 'تغير هيكلة الكلفة') {
                    if (!subject.includes('هيكلة') && !subject.includes('تغيير') && !subject.includes('تغير')) return false;
                } else if (natureEng === 'إعادة التقييم' || natureEng === 'اعادة التقييم') {
                    if (subject.includes('انخفاض') || subject.includes('إنخفاض')) return false;
                    if (!subject.includes('تقييم') && !subject.includes('إعادة') && !subject.includes('اعادة')) return false;
                } else if (natureEng === 'إنخفاض التقييم' || natureEng === 'انخفاض التقييم') {
                    if (!subject.includes('انخفاض') && !subject.includes('إنخفاض')) return false;
                } else if (natureEng === 'غلق') {
                    if (!subject.includes('غلق')) return false;
                } else if (natureEng === 'إعادة الترتيب' || natureEng === 'اعادة الترتيب') {
                    if (!subject.includes('ترتيب')) return false;
                } else if (natureEng === 'إلغاء') {
                    if (!subject.includes('إلغاء') && !subject.includes('الغاء') && !subject.includes('إلغى') && !subject.includes('الغى')) return false;
                }
            }

            // A piece is "effectively engaged" if its latest engagement status is not a withdrawal.
            // If it has no engagements record but SAI_ENG is true, it's also engaged.
            const hasEngagementRecord = pieceEngagements.has(pid);
            const isAlreadyEngaged = hasEngagementRecord ? activeEngagedSet.has(pid) : p.SAI_ENG === true;

            // التحقق من نقص رخصة الالتزام (AE Insufficiency)
            const commitmentTypes = ['صفقة', 'اتفاقية', 'ملحق', 'فاتورة', 'حكم قضائي'];
            if (commitmentTypes.includes(p.NAT_PIECE) && natureEng !== 'سحب' && p.ID_RUBRIQUE) {
                const rubOp = rubriqueOps.find(ro => Number(ro.ID_RUBRIQUE) === Number(p.ID_RUBRIQUE));
                if (rubOp) {
                    const totalAllocatedAE = rubOp.MONTANT_FINALE ?? rubOp.MONTANT_INITIALE ?? 0;
                    const consumed = rubConsMap.get(Number(p.ID_RUBRIQUE)) || 0;
                    
                    // إذا كنا في وضع التعديل، يجب طرح المبلغ الحالي من الاستهلاك لمعرفة المتبقي الحقيقي للوثيقة
                    let currentEngAmt = 0;
                    if (isCurrentPieceForEdit && initialData) {
                        currentEngAmt = initialData.MONTANT_ENG || 0;
                        if (initialData.NATURE_ENG === 'سحب' || initialData.NATURE_ENG === 'إنخفاض التقييم') {
                            currentEngAmt = -currentEngAmt;
                        }
                    }
                    
                    const effectiveConsumed = consumed - currentEngAmt;
                    const remainingAE = totalAllocatedAE - effectiveConsumed;
                    
                    // إذا كان مبلغ الوثيقة أكبر من الرصيد المتبقي، ولا نعدل حاليا هذه الوثيقة
                    if (p.MONTANT_PIECE > remainingAE && !isCurrentPieceForEdit && !isDefaultPiece) {
                        return false;
                    }
                }
            }

            // المنطق الصارم:
            // إذا كانت طبيعة الالتزام هي "التزام" أو أي طبيعة تسجيل أخرى:
            // يمنع ظهور الوثيقة إذا كان لها سجل سابق في جدول الالتزامات (خاصة الملحق)
            if (natureEng === 'سحب') {
                // في حالة السحب فقط، نحتاج لرؤية الوثائق الملتزم بها سابقاً للتمكن من السحب منها
                if (!(isAlreadyEngaged || isCurrentPieceForEdit || isDefaultPiece)) {
                    return false;
                }
            } else {
                // لجميع الحالات الأخرى (التزام، ملحق، الخ):
                // تظهر الوثيقة فقط إذا لم يسبق الالتزام بها
                if (isAlreadyEngaged && !isCurrentPieceForEdit && !isDefaultPiece) {
                    return false;
                }
            }

            return true;
        });

    }, [pieces, operationId, allEngagementsForOp, initialData, natureEng, defaultPieceId]);

    const getNatureFromPiece = useCallback((p: Piece): string => {
        if (p.NAT_PIECE === 'قرار فسخ') return 'فسخ';
        if (p.NAT_PIECE === 'مقرر') {
            const subject = (p.PIECE || '').trim();
            if (subject.includes('تفريد')) return 'تفريد';
            if (subject.includes('تغطية')) return 'تغطية مالية';
            if (subject.includes('هيكلة') || subject.includes('تغيير') || subject.includes('تغير')) return 'تغيير هيكلة الكلفة';
            if (subject.includes('انخفاض') || subject.includes('إنخفاض')) return 'إنخفاض التقييم';
            if (subject.includes('تقييم') || subject.includes('إعادة') || subject.includes('اعادة')) return 'إعادة التقييم';
            if (subject.includes('غلق')) return 'غلق';
            if (subject.includes('ترتيب')) return 'إعادة الترتيب';
            if (subject.includes('إلغاء') || subject.includes('الغاء')) return 'إلغاء';
            if (subject.includes('التسجيل')) return 'التسجيل';
            return 'التسجيل';
        }
        return 'التزام';
    }, []);

    // Logic to auto-fill description based on selected piece
    const updateFormFieldsForPiece = useCallback((pieceId: number, overriddenNature?: string) => {
        const selectedPiece = pieces.find(p => Number(p.ID_PIECE) === Number(pieceId));
        if (selectedPiece) {
            const autoNature = overriddenNature || getNatureFromPiece(selectedPiece);
            setNatureEng(autoNature);
            const currentNature = autoNature;
            let generatedObject = selectedPiece.PIECE;

            if (currentNature === 'سحب') {
                const prevEng = allEngagementsForOp.find(e => 
                    Number(e.ID_PIECE) === Number(pieceId) && 
                    ['التزام', 'ملحق', 'فاتورة', 'قرار فسخ'].includes(e.NATURE_ENG)
                );
                
                if (prevEng) {
                    const visaPart = prevEng.N_VISA_CB ? ` المؤشرة من طرف المراقب الميزانياتي تحت رقم: ${prevEng.N_VISA_CB} بتاريخ ${normalizeDate(prevEng.DATE_VISA_CB)}` : '';
                    generatedObject = `سحب بطاقة الالتزام رقم: ${prevEng.N_ENG} / ${prevEng.ANNEE} في: ${normalizeDate(prevEng.DATE_ENG)} الخاصة بـ ${selectedPiece.PIECE}${visaPart}`;
                } else {
                    generatedObject = `سحب ${selectedPiece.PIECE}`;
                }
                
                setObjetEng(generatedObject);
                setMontantEngStr(formatCurrency(selectedPiece.MONTANT_PIECE));
                return;
            }

            // handle parent references for addenda and work statements
            if ((selectedPiece.NAT_PIECE === 'ملحق' || selectedPiece.NAT_PIECE === 'قرار فسخ' || selectedPiece.NAT_PIECE === 'وضعية الأشغال') && selectedPiece.ID_PIECE_INIT) {
                const parentId = Number(selectedPiece.ID_PIECE_INIT);
                const parentPiece = pieces.find(p => Number(p.ID_PIECE) === parentId);

                if (parentPiece) {
                    const parentText = parentPiece.PIECE;
                    generatedObject +=` ل${parentText}`;

                    const parentEngagement = allEngagementsForOp.find(e => Number(e.ID_PIECE) === parentId);
                    if (parentEngagement && parentEngagement.N_VISA_CB) {
                        const nVisa = parentEngagement.N_VISA_CB;
                        const dateVisa = normalizeDate(parentEngagement.DATE_VISA_CB);
                        generatedObject += ` المؤشرة من طرف المراقب الميزانياتي تحت رقم: ${nVisa} بتاريخ: ${dateVisa}`;
                    } 
                }
            } 

            setObjetEng(generatedObject);
            setMontantEngStr(formatCurrency(selectedPiece.MONTANT_PIECE));
        } else {
            // Only reset if user hasn't typed anything
            if (!isDirty.current) {
                setObjetEng('');
                setMontantEngStr('0');
            }
        }
    }, [pieces, allEngagementsForOp, natureEng, getNatureFromPiece]);

    // Effect to reset selected piece if it's no longer valid for the new nature
    useEffect(() => {
        if (idPiece !== 0 && !initialData) {
            const isValid = availablePieces.some(p => Number(p.ID_PIECE) === Number(idPiece));
            if (!isValid) {
                setIdPiece(0);
                setObjetEng('');
                setMontantEngStr('0');
                isDirty.current = false; // Reset dirty since we forced a clear
            }
        }
    }, [natureEng, availablePieces, idPiece, initialData]);

    // Initialization Logic
    useEffect(() => {
        if (initialData && !isEditLoaded.current) {
            setNEng(initialData.N_ENG);
            setIdPiece(Number(initialData.ID_PIECE));
            setNatureEng(initialData.NATURE_ENG);
            setObjetEng(initialData.OBJET_ENG);
            setMontantEngStr(formatCurrency(initialData.MONTANT_ENG));
            setDateEng(normalizeDate(initialData.DATE_ENG));
            setNVisaCb(initialData.N_VISA_CB || '');
            setDateVisaCb(normalizeDate(initialData.DATE_VISA_CB));
            isEditLoaded.current = true;
            isDirty.current = true; // Treat edit mode as dirty to prevent auto-resets
        } else if (!initialData && defaultPieceId && !isDirty.current) {
            // New Entry with default piece
            setIdPiece(Number(defaultPieceId));
            // Try to update fields if pieces are loaded
            const pieceExists = pieces.find(p => Number(p.ID_PIECE) === Number(defaultPieceId));
            if (pieceExists) {
                updateFormFieldsForPiece(Number(defaultPieceId));
            }
        }
    }, [initialData, defaultPieceId, pieces, updateFormFieldsForPiece]);

    // Initialize Engagement Number only once or when year changes
    useEffect(() => {
        if (!initialData) {
            const lastEngThisYear = allEngagementsForOp
                .filter(e => e.ANNEE === annee)
                .map(e => parseInt(e.N_ENG, 10))
                .reduce((max, num) => Math.max(max, num), 0);
            setNEng((lastEngThisYear + 1).toString().padStart(2, '0'));
        }
    }, [annee, initialData, allEngagementsForOp]);

    // Financial Calculation Effect
    useEffect(() => {
        const montantEng = parseCurrency(montantEngStr);
        const sortedEngagements = [...allEngagementsForOp]
            .filter(e => Number(e.ID_ENGAGEMENT) !== Number(initialData?.ID_ENGAGEMENT))
            .sort((a, b) => compareDates(a.DATE_ENG || '', b.DATE_ENG || ''));

        const firstEng = sortedEngagements.find(e => e.NATURE_ENG === 'التسجيل');
        const aeEng = firstEng ? firstEng.MONTANT_ENG : (sortedEngagements[0]?.AE_ENG || 0);

        let totalEngAnterieure = 0;
        for (const eng of sortedEngagements) {
            // Treatment of amount: ensure withdrawal is always treated as negative subtraction (or positive reduction)
            // If already negative, just add it. If positive and it's a withdrawal, subtract it.
            if (eng.NATURE_ENG === 'سحب') {
                totalEngAnterieure += (eng.MONTANT_ENG < 0 ? eng.MONTANT_ENG : -eng.MONTANT_ENG);
            } else if (['التزام', 'ملحق', 'فاتورة', 'قرار فسخ'].includes(eng.NATURE_ENG)) {
                totalEngAnterieure += eng.MONTANT_ENG;
            }
        }

        const soldeAnterieure = aeEng - totalEngAnterieure;

        // Determination of current commitment effect on total (to calculate remaining balance)
        let currentAmountEffect = montantEng;
        // If nature is withdrawal, it reduces the total committed (increases balance)
        // If the value in input is already negative (expected now), adding it does the job.
        // We use absolute value logic to be safe.
        if (natureEng === 'سحب') {
            currentAmountEffect = -Math.abs(montantEng);
        } else if (['التزام', 'ملحق', 'فاتورة', 'قرار فسخ'].includes(natureEng)) {
            currentAmountEffect = Math.abs(montantEng);
        } else {
            currentAmountEffect = 0;
        }

        const soldeReliquat = soldeAnterieure - currentAmountEffect;

        setFinancials({
            aeEng,
            totalEngAnterieure,
            soldeAnterieure,
            soldeReliquat
        });

    }, [montantEngStr, natureEng, allEngagementsForOp, initialData]);


    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;
        let montantEng = parseCurrency(montantEngStr);
        if (natureEng === 'سحب' && montantEng > 0) {
            montantEng = -montantEng;
        }

        const selectedPiece = pieces.find(p => Number(p.ID_PIECE) === Number(idPiece));
        if (selectedPiece && selectedPiece.ID_RUBRIQUE) {
            const rubriqueOp = rubriqueOps.find(ro => Number(ro.ID_OPERATION) === Number(operationId) && Number(ro.ID_RUBRIQUE) === Number(selectedPiece.ID_RUBRIQUE));
            if (rubriqueOp) {
                const montantAutorise = (rubriqueOp.MONTANT_FINALE ?? rubriqueOp.MONTANT_INITIALE) || 0;

                // Improved validation logic: use actual commitment amounts instead of assuming Piece amount
                const totalCurrentlyEngagedInRubrique = allEngagementsForOp
                    .filter(e => {
                        if (Number(e.ID_ENGAGEMENT) === Number(initialData?.ID_ENGAGEMENT)) return false;
                        const p = pieces.find(p => Number(p.ID_PIECE) === Number(e.ID_PIECE));
                        return p && Number(p.ID_RUBRIQUE) === Number(selectedPiece.ID_RUBRIQUE);
                    })
                    .reduce((sum, e) => {
                        // Treat withdrawals correctly regardless of stored sign
                        const amt = (e.NATURE_ENG === 'سحب') ? (e.MONTANT_ENG < 0 ? e.MONTANT_ENG : -e.MONTANT_ENG) : e.MONTANT_ENG;
                        return sum + amt;
                    }, 0);

                const newTotalForRubrique = totalCurrentlyEngagedInRubrique + montantEng;

                if (newTotalForRubrique > (montantAutorise + 0.01)) { // Added small epsilon for float precision
                    alert(`لا يمكن إضافة هذا الالتزام لأنه يتجاوز رخصة الالتزام حسب الهيكلة.\n\n` +
                        `المبلغ المتاح: ${formatCurrency(montantAutorise - totalCurrentlyEngagedInRubrique)}\n` +
                        `المبلغ المطلوب التزامه: ${formatCurrency(montantEng)}`);
                    return;
                }
            }
        }


        setIsSubmitting(true);
        const { ...validInitialData } = (initialData || {}) as any;

        const payload = {
            ...validInitialData,
            ID_OPERATION: operationId,
            ID_PIECE: Number(idPiece),
            ID_BORDEREAU: initialData?.ID_BORDEREAU || null,
            N_ENG: nEng,
            ANNEE: annee,
            NATURE_ENG: natureEng,
            OBJET_ENG: objetEng,
            MONTANT_ENG: montantEng,
            DATE_ENG: dateEng, // Now strictly DD/MM/YYYY
            N_VISA_CB: nVisaCb || null,
            DATE_VISA_CB: dateVisaCb, // Now strictly DD/MM/YYYY
            AE_ENG: financials.aeEng,
            TOTAL_ENG_ANTERIEURE: financials.totalEngAnterieure,
            SOLDE_ANTERIEURE: financials.soldeAnterieure,
            SOLDE_RELIQUAT: financials.soldeReliquat,
        };

        Promise.resolve(onSave(payload)).finally(() => {
            setIsSubmitting(false);
        });
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col max-h-[85vh]">
            <div className="sticky top-0 bg-white z-10 pb-2 border-b border-gray-200 flex justify-end gap-3 pt-1 mb-2">
                <button type="button" onClick={onClose} className="px-5 py-1.5 bg-gray-200 text-gray-800 rounded-[20px] hover:bg-gray-300 transition-colors text-sm">إلغاء</button>
                <button type="submit" disabled={isSubmitting} className="px-5 py-1.5 bg-blue-600 text-white rounded-[20px] hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed text-sm">
                    {isSubmitting ? 'جاري الحفظ...' : (initialData ? 'حفظ التغييرات' : 'إضافة')}
                </button>
            </div>

            <div className="space-y-3 overflow-y-auto p-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 text-right">رقم الإلتزام</label>
                        <div className="flex items-center gap-1 mt-1">
                            <input type="text" value={nEng} readOnly className="w-16 h-9 px-1 py-1 text-sm text-center text-gray-700 bg-gray-200 border border-gray-300 rounded-[20px] font-bold" />
                            <span className="text-gray-400">/</span>
                            <select 
                                value={annee} 
                                onChange={e => { setAnnee(e.target.value); markDirty(); }}
                                className="flex-1 h-9 px-1 py-1 text-sm text-center text-gray-700 bg-gray-100 border border-gray-300 rounded-[20px] font-bold cursor-pointer"
                            >
                                {years.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="natureEng" className="block text-sm font-medium text-gray-700 text-right">طبيعة الإلتزام</label>
                        <select 
                            id="natureEng" 
                            value={natureEng} 
                            onChange={e => { 
                                const newNature = e.target.value;
                                setNatureEng(newNature); 
                                markDirty(); 
                                if (idPiece !== 0) {
                                    updateFormFieldsForPiece(idPiece, newNature);
                                }
                            }} 
                            required 
                            className="w-full h-9 px-1 py-1 mt-1 text-center text-gray-700 bg-gray-100 border border-gray-300 rounded-[20px]"
                        >
                            {natureEngOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                    </div>
                </div>
                <div>
                    <label htmlFor="idPiece" className="block text-sm font-medium text-gray-700 text-right">الوثيقة</label>
                    <select
                        id="idPiece"
                        value={idPiece}
                        onChange={e => {
                            const val = Number(e.target.value);
                            setIdPiece(val);
                            // Force update fields when user explicitly changes piece, even if dirty
                            updateFormFieldsForPiece(val);
                            markDirty();
                        }}
                        required
                        className="w-full h-9 px-1 py-1 mt-1 text-xs text-center text-gray-700 bg-gray-100 border border-gray-300 rounded-[20px]"
                    >
                        <option value="">{availablePieces.length > 0 ? '-- اختر وثيقة --' : 'لا توجد وثائق متاحة لهذا النوع'}</option>
                        {availablePieces.map(p => <option key={p.ID_PIECE} value={p.ID_PIECE}>{p.PIECE} ({p.NAT_PIECE})</option>)}
                    </select>
                </div>
                <div>
                    <label htmlFor="objetEng" className="block text-sm font-medium text-gray-700 text-center">موضوع الإلتزام</label>
                    <input id="objetEng" value={objetEng} onChange={e => { setObjetEng(e.target.value); markDirty(); }} required className="w-full h-9 px-1 py-1 mt-1 text-sx text-center text-gray-700 bg-gray-100 border border-gray-300 rounded-[20px]" />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label htmlFor="montantEng" className="block text-sm font-medium text-gray-700 text-center">المبلغ</label>
                        <input
                            id="montantEng"
                            type="text"
                            inputMode="decimal"
                            value={montantEngStr}
                            onChange={(e) => { setMontantEngStr(formatAmountInput(e.target.value)); markDirty(); }}
                            onFocus={(e) => {
                                const num = parseCurrency(e.target.value);
                                setMontantEngStr(isNaN(num) ? '' : formatCurrencyForInput(num));
                            }}
                            onBlur={(e) => {
                                const num = parseCurrency(e.target.value);
                                setMontantEngStr(isNaN(num) ? '0' : formatCurrency(num));
                            }}
                            required
                            className="w-full h-9 px-1 py-1 mt-1 text-center text-gray-700 bg-gray-100 border border-gray-300 rounded-[20px]"
                        />
                    </div>
                    <div>
                        <DateInputField
                            id="dateEng"
                            label="تاريخ البطاقة"
                            value={dateEng}
                            onChange={(val) => { setDateEng(val); markDirty(); }}
                            required
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                        <label htmlFor="nVisaCb" className="block text-sm font-medium text-gray-700 text-center">رقم تأشيرة المراقب الميزانياتي</label>
                        <input id="nVisaCb" type="text" value={nVisaCb} onChange={e => { setNVisaCb(e.target.value); markDirty(); }} className="w-full h-9 px-1 py-1 mt-1 text-center text-gray-700 bg-gray-100 border border-gray-300 rounded-[20px]" />
                    </div>
                    <div>
                        <DateInputField
                            id="dateVisaCb"
                            label="تاريخ التأشيرة"
                            value={dateVisaCb}
                            onChange={(val) => { setDateVisaCb(val); markDirty(); }}
                        />
                    </div>
                </div>
            </div>
        </form>
    );
};

export default AddEngagementForm;