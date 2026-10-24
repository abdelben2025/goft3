
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Operation, Categorie, Scategorie, Rubrique } from '../../types';
import { formatCurrency, parseCurrency, formatAmountInput, formatCurrencyForInput } from '../../utils/currencyUtils';
import { Plus, Trash2 } from 'lucide-react';

interface AddOperationFormProps {
    onClose: () => void;
    onSave: (data: { 
        operationData: Omit<Operation, 'ID_OPERATION'> | Operation; 
        scategorieOpData?: { idScat: number; montant: number }[];
        rubriqueOps?: { idRubrique: number; montant: number }[];
    }) => void;
    categories: Categorie[];
    scategories: Scategorie[];
    rubriques: Rubrique[];
    initialData?: Operation;
}

const AddOperationForm: React.FC<AddOperationFormProps> = ({ onClose, onSave, categories, scategories, rubriques, initialData }) => {
    const [nOperation, setNOperation] = useState('');
    const [nOperationAncien, setNOperationAncien] = useState('');
    const [intOperation, setIntOperation] = useState('');
    const [idCategorie, setIdCategorie] = useState<number | ''>('');
    const [idScatOperation, setIdScatOperation] = useState<number | ''>('');
    const [status, setStatus] = useState<'جارية' | 'مغلقة'>('جارية');
    const [typeOp, setTypeOp] = useState<string>('');

    const [customTypes, setCustomTypes] = useState<string[]>(() => {
        const stored = localStorage.getItem('goft3_operation_types');
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                return ['LOLF', 'PSC', 'PSD'];
            }
        }
        return ['LOLF', 'PSC', 'PSD'];
    });

    const [isTypeEditable, setIsTypeEditable] = useState(false);
    const [tempTypeInput, setTempTypeInput] = useState('');
    const [showTypeConfirmPopup, setShowTypeConfirmPopup] = useState(false);

    const [structureRows, setStructureRows] = useState<{ idRubrique: number | '', montant: string }[]>([]);

    // Validation state
    const [errors, setErrors] = useState<{ [key: string]: string }>({});

    // Protection refs
    const isDirty = useRef(false);
    const isEditLoaded = useRef(false);

    const markDirty = () => { isDirty.current = true; };

    const validateField = (name: string, value: any) => {
        let error = '';
        switch (name) {
            case 'nOperation':
                if (!value) error = 'رقم العملية مطلوب';
                else if (value.length < 25) error = 'رقم العملية غير مكتمل (يجب أن يكون 25 رمزا)';
                break;
            case 'intOperation':
                if (!value || value.trim().length === 0) error = 'عنوان العملية مطلوب';
                break;
            case 'idCategorie':
                if (!value) error = 'الصنف مطلوب';
                break;
            case 'idScatOperation':
                if (!value) error = 'الصنف الفرعي مطلوب';
                break;
        }
        setErrors(prev => ({ ...prev, [name]: error }));
        return !error;
    };

    const availableScategories = useMemo(() => {
        const filtered = scategories.filter(sc => sc.ID_CATEGORIE === idCategorie);
        const unallocatedKeywords = ['غير موزع', 'غير موزعة', 'مبالغ غير موزعة', 'مبلغ العملية غير الموزع'];
        return [...filtered].sort((a, b) => {
            const aIsUnallocated = unallocatedKeywords.some(key => a.INT_SCATEGORIE.includes(key));
            const bIsUnallocated = unallocatedKeywords.some(key => b.INT_SCATEGORIE.includes(key));
            
            if (aIsUnallocated && !bIsUnallocated) return 1;
            if (!aIsUnallocated && bIsUnallocated) return -1;
            
            return a.INT_SCATEGORIE.localeCompare(b.INT_SCATEGORIE, 'ar');
        });
    }, [scategories, idCategorie]);

    useEffect(() => {
        if (initialData && !isEditLoaded.current) {
            setNOperation(initialData.N_OPERATION);
            setNOperationAncien(initialData.N_OPERATION_ANCIEN || '');
            setIntOperation(initialData.INT_OPERATION);
            setIdCategorie(initialData.ID_CATEGORIE);
            setIdScatOperation(initialData.ID_SCATEGORIE || '');
            setStatus(initialData.status);
            setTypeOp(initialData.TYPE_OP || '');
            isEditLoaded.current = true;
            isDirty.current = true;
        } else if (!initialData && !isDirty.current) {
            // New entry default
            if (!idCategorie && categories.length > 0) {
                setIdCategorie(categories[0]?.ID_CATEGORIE);
            }
        }
    }, [initialData, categories, idCategorie]);

    // Auto-select Scategorie when category changes or initial load (only if clean)
    useEffect(() => {
        if (!initialData && availableScategories.length > 0 && !isDirty.current) {
            setIdScatOperation(availableScategories[0].ID_SCATEGORIE);
        } else if (!initialData && !isDirty.current) {
            setIdScatOperation('');
        }
    }, [initialData, availableScategories]);

    const handleNOperationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        markDirty();
        const rawValue = e.target.value.toUpperCase();
        const cleanValue = rawValue.replace(/[^0-9N]/g, '');

        let processed = cleanValue;

        // Ensure it starts with N
        if (processed.length > 0 && !processed.startsWith('N')) {
            if (/[0-9]/.test(processed[0])) {
                processed = 'N' + processed;
            }
        }
        // Ensure only one N at start
        if (processed.length > 1) {
            processed = 'N' + processed.substring(1).replace(/N/g, '');
        }

        // Mask Segments: 1 (N), 1, 3, 3, 2, 4, 3, 3, 2, 3
        // Total clean characters = 25 (1 letter + 24 digits)
        if (processed.length > 25) {
            processed = processed.substring(0, 25);
        }

        let formatted = '';
        let idx = 0;

        if (processed.length > 0) {
            formatted += processed[0]; // N
            idx++;
        }

        const segments = [1, 3, 3, 2, 4, 3, 3, 2, 3];

        for (let i = 0; i < segments.length; i++) {
            if (idx < processed.length) {
                formatted += '.';
                const len = segments[i];
                const chunk = processed.substr(idx, len);
                formatted += chunk;
                idx += chunk.length;
            } else {
                break;
            }
        }

        setNOperation(formatted);
        validateField('nOperation', formatted);
    };

    // Structure table handlers
    const addStructureRow = () => {
        markDirty();
        setStructureRows([...structureRows, { idRubrique: '', montant: '0' }]);
    };

    const removeStructureRow = (index: number) => {
        markDirty();
        setStructureRows(structureRows.filter((_, i) => i !== index));
    };

    const handleStructureChange = (index: number, field: 'idRubrique' | 'montant', value: any) => {
        markDirty();
        const newRows = [...structureRows];
        if (field === 'montant') {
            newRows[index][field] = formatAmountInput(value);
        } else {
            newRows[index][field] = value;
        }
        setStructureRows(newRows);
    };

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        const v1 = validateField('nOperation', nOperation);
        const v2 = validateField('intOperation', intOperation);
        const v3 = validateField('idCategorie', idCategorie);
        const v4 = validateField('idScatOperation', idScatOperation);
        
        if (!v1 || !v2 || !v3 || !v4) {
            return;
        }

        setIsSubmitting(true);

        // Calculate sum for sub-category op
        let totalMontantScat = 0;
        let totalMontantUnallocated = 0;
        const validRubriqueOps: { idRubrique: number; montant: number }[] = [];

        // Find unallocated sub-category if it exists
        const unallocatedKeywords = ['غير موزع', 'غير موزعة', 'مبالغ غير موزعة', 'مبلغ العملية غير الموزع'];
        const unallocatedScat = scategories.find(s => 
            unallocatedKeywords.some(key => s.INT_SCATEGORIE.includes(key))
        );

        structureRows.forEach(row => {
            if (row.idRubrique && row.montant) {
                const montantNum = parseCurrency(row.montant);
                if (montantNum > 0) {
                    validRubriqueOps.push({
                        idRubrique: Number(row.idRubrique),
                        montant: montantNum
                    });

                    // Check if rubrique is "unallocated"
                    const rub = rubriques.find(r => r.ID_RUBRIQUE === Number(row.idRubrique));
                    const isUnallocatedRub = rub && unallocatedKeywords.some(key => rub.RUBRIQUE.includes(key));
                    
                    if (isUnallocatedRub) {
                        totalMontantUnallocated += montantNum;
                    } else {
                        totalMontantScat += montantNum;
                    }
                }
            }
        });

        let operationData: Operation | Omit<Operation, 'ID_OPERATION'>;

        if (initialData) {
            operationData = {
                ...initialData,
                N_OPERATION: nOperation,
                N_OPERATION_ANCIEN: nOperationAncien || null,
                INT_OPERATION: intOperation,
                ID_CATEGORIE: Number(idCategorie),
                ID_SCATEGORIE: idScatOperation ? Number(idScatOperation) : null,
                status: status,
                TYPE_OP: typeOp || null,
            };
        } else {
            operationData = {
                N_OPERATION: nOperation,
                N_OPERATION_ANCIEN: nOperationAncien || null,
                INT_OPERATION: intOperation,
                ID_CATEGORIE: Number(idCategorie),
                ID_SCATEGORIE: idScatOperation ? Number(idScatOperation) : null,
                status: status,
                TYPE_OP: typeOp || null,
                CREATED_BY: null,
            };
        }

        const scatOps: { idScat: number; montant: number }[] = [];
        if (!initialData) {
            const mainId = idScatOperation ? Number(idScatOperation) : null;
            const unallocId = unallocatedScat?.ID_SCATEGORIE;

            if (mainId !== null) {
                if (unallocId && mainId === unallocId) {
                    // If they are the same, sum the amounts into one entry
                    scatOps.push({ idScat: mainId, montant: totalMontantScat + totalMontantUnallocated });
                } else {
                    // Add main category
                    scatOps.push({ idScat: mainId, montant: totalMontantScat });
                    // Add unallocated if different and has amount
                    if (unallocId && totalMontantUnallocated > 0) {
                        scatOps.push({ idScat: unallocId, montant: totalMontantUnallocated });
                    }
                }
            } else if (unallocId && totalMontantUnallocated > 0) {
                scatOps.push({ idScat: unallocId, montant: totalMontantUnallocated });
            }
        }

        onSave({
            operationData,
            scategorieOpData: scatOps,
            rubriqueOps: validRubriqueOps
        });
    };

    if (categories.length === 0 && !initialData) {
        return (
            <div className="p-4 bg-yellow-100 text-yellow-800 rounded-[20px] text-center">
                <p className="font-bold">لا يمكن إضافة عملية.</p>
                <p>يجب عليك أولاً إضافة صنف واحد على الأقل من صفحة <span className="font-semibold">الإعدادات ← إدارة الأصناف</span>.</p>
                <div className="flex justify-end mt-1">
                    <button type="button" onClick={onClose} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-[20px] hover:bg-gray-300 transition-colors">إغلاق</button>
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col max-h-[80vh] overflow-hidden">
            <div className="sticky top-0 bg-white z-10 pb-2 border-b border-gray-200 flex justify-end gap-3 pt-1 mb-1 shrink-0">
                <button type="button" onClick={onClose} className="px-4 py-1.5 bg-gray-200 text-gray-800 rounded-[20px] hover:bg-gray-300 transition-colors text-xs">إلغاء</button>
                <button type="submit" disabled={isSubmitting} className="px-4 py-1.5 bg-blue-600 text-white rounded-[20px] hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed text-xs font-bold">
                    {isSubmitting ? 'جاري الحفظ...' : (initialData ? 'حفظ التغييرات' : 'إضافة')}
                </button>
            </div>

            <div className="space-y-4 overflow-y-auto px-1 pb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">
                    <div>
                        <label htmlFor="nOperation" className="block text-[8px] font-bold text-gray-500 text-center uppercase">رقم العملية</label>
                        <input
                            id="nOperation"
                            type="text"
                            value={nOperation}
                            onChange={handleNOperationChange}
                            onBlur={() => validateField('nOperation', nOperation)}
                            required
                            maxLength={35}
                            placeholder="N.1.024.0...001"
                            className={`w-full px-3 py-1.5 mt-1 text-[10px] font-bold text-gray-700 bg-gray-50 border ${errors.nOperation ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300'} rounded-[20px] focus:outline-none focus:ring-2 ${errors.nOperation ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`}
                        />
                        {errors.nOperation && <p className="text-red-500 text-[8px] mt-1 text-center font-medium">{errors.nOperation}</p>}
                    </div>
                    <div>
                        <label htmlFor="nOperationAncien" className="block text-[8px] font-bold text-gray-500 text-center uppercase">رقم العملية القديم</label>
                        <input
                            id="nOperationAncien"
                            type="text"
                            value={nOperationAncien}
                            onChange={(e) => { setNOperationAncien(e.target.value.toUpperCase()); markDirty(); }}
                            className="w-full px-3 py-1.5 mt-1 text-[11px] font-bold text-gray-700 bg-gray-50 border border-gray-300 rounded-[20px] focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                        />
                    </div>
                </div>

                <div>
                    <label htmlFor="intOperation" className="block text-[9px] font-bold text-gray-500 text-center text-[9px] uppercase">عنوان العملية</label>
                    <textarea
                        id="intOperation"
                        value={intOperation}
                        onChange={(e) => { 
                            const upperVal = e.target.value.toUpperCase();
                            setIntOperation(upperVal); 
                            validateField('intOperation', upperVal);
                            markDirty(); 
                        }}
                        onBlur={() => validateField('intOperation', intOperation)}
                        required
                        rows={2}
                        className={`w-full px-3 py-1.5 mt-1 text-[9px] font-bold uppercase bg-gray-50 border ${errors.intOperation ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300'} rounded-[20px] focus:outline-none focus:ring-2 ${errors.intOperation ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`}
                    />
                    {errors.intOperation && <p className="text-red-500 text-[9px] mt-1 text-center font-medium">{errors.intOperation}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                        <label htmlFor="idCategorie" className="block text-[8px] font-bold text-gray-500 text-center uppercase">الصنف</label>
                        <select
                            id="idCategorie"
                            value={idCategorie}
                            onChange={(e) => { 
                                const val = Number(e.target.value);
                                setIdCategorie(val); 
                                validateField('idCategorie', val);
                                markDirty(); 
                            }}
                            onBlur={() => validateField('idCategorie', idCategorie)}
                            required
                            className={`w-full px-2 py-1.5 mt-1 text-[10px] text-gray-700 bg-gray-50 border ${errors.idCategorie ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300'} rounded-[20px] focus:outline-none focus:ring-2 ${errors.idCategorie ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`}
                        >
                            {categories.map(cat => (
                                <option key={cat.ID_CATEGORIE} value={cat.ID_CATEGORIE}>
                                    {cat.INT_CATEGORIE}
                                </option>
                            ))}
                        </select>
                        {errors.idCategorie && <p className="text-red-500 text-[9px] mt-1 text-center font-medium">{errors.idCategorie}</p>}
                    </div>
                    <div>
                        <label htmlFor="idScatOperation" className="block text-[8px] font-bold text-gray-500 text-center uppercase">الصنف الفرعي</label>
                        <select
                            id="idScatOperation"
                            value={idScatOperation}
                            onChange={(e) => { 
                                const val = e.target.value ? Number(e.target.value) : '';
                                setIdScatOperation(val); 
                                validateField('idScatOperation', val);
                                markDirty(); 
                            }}
                            onBlur={() => validateField('idScatOperation', idScatOperation)}
                            required
                            className={`w-full px-2 py-1.5 mt-1 text-[10px] text-gray-700 bg-gray-50 border ${errors.idScatOperation ? 'border-red-500 ring-1 ring-red-500' : 'border-gray-300'} rounded-[20px] focus:outline-none focus:ring-2 ${errors.idScatOperation ? 'focus:ring-red-500' : 'focus:ring-blue-500'}`}
                        >
                            <option value="">-- اختر صنف فرعي --</option>
                            {availableScategories.map(scat => (
                                <option key={scat.ID_SCATEGORIE} value={scat.ID_SCATEGORIE}>
                                    {scat.INT_SCATEGORIE}
                                </option>
                            ))}
                        </select>
                        {errors.idScatOperation && <p className="text-red-500 text-[9px] mt-1 text-center font-medium">{errors.idScatOperation}</p>}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="col-span-1 md:col-span-2">
                        <label htmlFor="typeOp" className="block text-[8px] font-bold text-gray-500 text-center uppercase">نوع العملية</label>
                        <div className="flex gap-1 items-center mt-1 relative">
                            {!isTypeEditable ? (
                                <>
                                    <select
                                        id="typeOp"
                                        value={typeOp}
                                        onChange={(e) => {
                                            setTypeOp(e.target.value);
                                            markDirty();
                                        }}
                                        className="flex-1 px-2 py-1.5 text-[10px] text-gray-700 bg-gray-50 border border-gray-300 rounded-[20px] focus:outline-none focus:ring-2 focus:ring-blue-500 h-8"
                                    >
                                        <option value="">-- اختر نوع العملية --</option>
                                        {customTypes.map(t => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </select>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setTempTypeInput(typeOp);
                                            setIsTypeEditable(true);
                                            markDirty();
                                        }}
                                        className="p-1.5 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-full transition-colors shadow-sm cursor-pointer"
                                        title="إضافة نوع مخصص"
                                    >
                                        <Plus size={14} />
                                    </button>
                                </>
                            ) : (
                                <div className="flex-1 flex flex-col gap-1 w-full">
                                    <div className="flex gap-1 items-center w-full">
                                        <input
                                            type="text"
                                            value={tempTypeInput}
                                            onChange={(e) => {
                                                setTempTypeInput(e.target.value);
                                                setTypeOp(e.target.value);
                                                markDirty();
                                            }}
                                            placeholder="اكتب نوع العملية هنا..."
                                            className="flex-1 px-3 py-1 text-[10px] text-gray-700 bg-white border border-blue-400 rounded-[20px] focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold h-8"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (tempTypeInput.trim()) {
                                                    setShowTypeConfirmPopup(true);
                                                } else {
                                                    setIsTypeEditable(false);
                                                }
                                            }}
                                            className="px-3 py-1 bg-green-600 text-white rounded-[20px] text-[9px] font-bold hover:bg-green-700 transition cursor-pointer h-8"
                                        >
                                            حفظ
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsTypeEditable(false);
                                                setShowTypeConfirmPopup(false);
                                            }}
                                            className="px-3 py-1 bg-gray-300 text-gray-700 rounded-[20px] text-[9px] font-bold hover:bg-gray-400 transition cursor-pointer h-8"
                                        >
                                            إلغاء
                                        </button>
                                    </div>
                                    
                                    {showTypeConfirmPopup && (
                                        <div className="absolute top-9 right-0 left-0 bg-white border border-blue-200 p-2.5 rounded-[15px] shadow-lg z-50 text-center animate-slide-up">
                                            <p className="text-[10px] font-bold text-gray-700 mb-2">هل تريد حفظ "{tempTypeInput}" كخيار دائم في القائمة؟</p>
                                            <div className="flex justify-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newVal = tempTypeInput.trim();
                                                        if (newVal && !customTypes.includes(newVal)) {
                                                            const updated = [...customTypes, newVal];
                                                            setCustomTypes(updated);
                                                            localStorage.setItem('goft3_operation_types', JSON.stringify(updated));
                                                        }
                                                        setTypeOp(newVal);
                                                        setIsTypeEditable(false);
                                                        setShowTypeConfirmPopup(false);
                                                    }}
                                                    className="px-3 py-1 bg-blue-600 text-white rounded-[15px] text-[9px] font-bold hover:bg-blue-700 cursor-pointer"
                                                >
                                                    نعم
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newVal = tempTypeInput.trim();
                                                        setTypeOp(newVal);
                                                        setIsTypeEditable(false);
                                                        setShowTypeConfirmPopup(false);
                                                    }}
                                                    className="px-3 py-1 bg-yellow-500 text-white rounded-[15px] text-[9px] font-bold hover:bg-yellow-600 cursor-pointer"
                                                >
                                                    لا، كقيمة مؤقتة
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setShowTypeConfirmPopup(false);
                                                    }}
                                                    className="px-3 py-1 bg-gray-200 text-gray-700 rounded-[15px] text-[9px] hover:bg-gray-300 cursor-pointer"
                                                >
                                                    إلغاء
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                    <div>
                        <label htmlFor="status" className="block text-[8px] font-bold text-gray-500 text-center uppercase">الحالة</label>
                        <select
                            id="status"
                            value={status}
                            onChange={(e) => { setStatus(e.target.value as 'جارية' | 'مغلقة'); markDirty(); }}
                            required
                            className="w-full px-2 py-1.5 mt-1 text-[10px] text-gray-700 bg-gray-50 border border-gray-300 rounded-[20px] focus:outline-none focus:ring-2 focus:ring-blue-500 h-8 text-center font-bold"
                        >
                            <option value="جارية">جارية</option>
                            <option value="مغلقة">مغلقة</option>
                        </select>
                    </div>
                </div>

                {!initialData && (
                    <div className="bg-blue-50/50 p-3 rounded-[20px] border border-blue-100 mt-2">
                        <div className="flex justify-between items-center mb-2">
                            <button 
                                type="button" 
                                onClick={addStructureRow}
                                className="flex items-center gap-1.5 px-3 py-1 bg-blue-600 text-white rounded-[20px] text-[10px] font-bold hover:bg-blue-700 transition-colors"
                            >
                                <Plus size={12} />
                                إضافة هيكلة
                            </button>
                            <h4 className="text-xs font-bold text-blue-800 uppercase tracking-tight">هيكلة العملية (المدونات)</h4>
                        </div>
                        
                        {structureRows.length > 0 ? (
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="border-b border-blue-200">
                                        <th className="p-2 text-right text-[8px] font-bold text-gray-600">المدونة</th>
                                        <th className="p-2 text-right text-[8px] font-bold text-gray-600 w-32">المبلغ</th>
                                        <th className="w-8"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {structureRows.map((row, index) => (
                                        <tr key={index} className="border-b border-blue-100 last:border-0">
                                            <td className="p-1">
                                                <select
                                                    value={row.idRubrique}
                                                    onChange={(e) => handleStructureChange(index, 'idRubrique', Number(e.target.value))}
                                                    className="w-full bg-white border border-gray-200 rounded-[20px] px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                                                    required
                                                >
                                                    <option value="">-- اختر مدونة --</option>
                                                    {rubriques.map(rub => (
                                                        <option key={rub.ID_RUBRIQUE} value={rub.ID_RUBRIQUE}>
                                                            {rub.RUBRIQUE}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="p-1">
                                                <input
                                                    type="text"
                                                    value={row.montant}
                                                    onChange={(e) => handleStructureChange(index, 'montant', e.target.value)}
                                                    onFocus={(e) => {
                                                        const num = parseCurrency(e.target.value);
                                                        handleStructureChange(index, 'montant', isNaN(num) ? '' : formatCurrencyForInput(num));
                                                    }}
                                                    onBlur={(e) => {
                                                        const num = parseCurrency(e.target.value);
                                                        handleStructureChange(index, 'montant', isNaN(num) ? '0' : formatCurrency(num));
                                                    }}
                                                    className="w-full bg-white border border-gray-200 rounded-[20px] px-2 py-1 text-xs font-mono focus:ring-1 focus:ring-blue-500 outline-none"
                                                    required
                                                />
                                            </td>
                                            <td className="p-1 text-center">
                                                <button 
                                                    type="button" 
                                                    onClick={() => removeStructureRow(index)}
                                                    className="text-red-400 hover:text-red-600 transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div className="text-center py-4 border-2 border-dashed border-blue-200 rounded-[20px] bg-white">
                                <p className="text-[8px] text-gray-400 font-medium">لم يتم إضافة أي هيكلة بعد</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </form>
    );

};

export default AddOperationForm;
