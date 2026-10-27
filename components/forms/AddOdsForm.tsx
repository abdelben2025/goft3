import React, { useState, useEffect, useRef } from 'react';
import { Ods, LotOperation } from '../../types';
import { normalizeDate, compareDates, getCurrentDate } from '../../utils/dateUtils';
import { DateInputField } from '../DateInputField';

interface AddOdsFormProps {
    onClose: () => void;
    onSave: (ods: any) => void | Promise<void>;
    pieceId: number;
    initialData?: Ods;
    associatedOds: Ods[];
    associatedLots?: LotOperation[]; // Pass linked lots to select from
}

const natureOdsOptions = ["انطلاق", "ايقاف", "استئناف", "ختام"];

const AddOdsForm: React.FC<AddOdsFormProps> = ({ onClose, onSave, pieceId, initialData, associatedOds, associatedLots = [] }) => {
    const [objetOds, setObjetOds] = useState('');
    const [natureOds, setNatureOds] = useState(() => {
        if (initialData) return initialData.NATURE_ODS;
        return associatedOds.length === 0 ? 'انطلاق' : 'ايقاف';
    });
    const [dateOds, setDateOds] = useState('');
    const [selectedLotId, setSelectedLotId] = useState<number | ''>(''); // Empty means "Global" / "Piece"
    const [notification, setNotification] = useState<{ message: string; type: 'error' | 'info' } | null>(null);

    // Protection Refs
    const isDirty = useRef(false);
    const isEditLoaded = useRef(false);

    const markDirty = () => { isDirty.current = true; };

    useEffect(() => {
        if (initialData && !isEditLoaded.current) {
            setObjetOds(initialData.OBJET_ODS);
            setNatureOds(initialData.NATURE_ODS);
            setDateOds(normalizeDate(initialData.DATE_ODS));
            setSelectedLotId(initialData.ID_LOT || '');
            isEditLoaded.current = true;
            isDirty.current = true;
        } else if (!initialData && !isDirty.current) {
            setDateOds(getCurrentDate());
        }
    }, [initialData]);

    useEffect(() => {
        if (!dateOds || dateOds.length < 10) { // Simple check for completeness
            setNotification(null);
            return;
        }

        // Build the full timeline for the current scope, including this record (new or edited)
        const scopeOds = associatedOds.filter(o =>
            (selectedLotId === '' && !o.ID_LOT) || (o.ID_LOT === selectedLotId)
        );

        const pendingRecord = initialData
            ? { ...initialData, DATE_ODS: dateOds, NATURE_ODS: natureOds }
            : { ID_ODS: Number.MIN_SAFE_INTEGER, DATE_ODS: dateOds, NATURE_ODS: natureOds, ID_LOT: selectedLotId || null };

        const timeline = [
            ...scopeOds.filter(o => o.ID_ODS !== initialData?.ID_ODS),
            pendingRecord,
        ].sort((a, b) => compareDates(a.DATE_ODS, b.DATE_ODS));

        setNotification(null); // Reset on each change

        // Chronological order: a later order must not be placed before its predecessor
        for (let i = 1; i < timeline.length; i++) {
            if (compareDates(timeline[i].DATE_ODS, timeline[i - 1].DATE_ODS) < 0) {
                setNotification({ message: `التاريخ الجديد يجب أن لا يكون قبل التاريخ السابق لأمر الخدمة (${timeline[i - 1].DATE_ODS}).`, type: 'error' });
                return;
            }
        }

        // The first order must be a start (انطلاق)
        if (timeline[0] && timeline[0].NATURE_ODS !== 'انطلاق') {
            setNotification({ message: 'أول أمر خدمة لهذا النطاق يجب أن يكون "انطلاق".', type: 'error' });
            return;
        }

        // Nature transition rules between consecutive orders
        for (let i = 0; i < timeline.length - 1; i++) {
            const nat = timeline[i].NATURE_ODS;
            const nextNat = timeline[i + 1].NATURE_ODS;

            if (nat === 'ختام') {
                setNotification({ message: 'لا يمكن إضافة أمر خدمة جديد بعد الختام.', type: 'error' });
                return;
            }
            if ((nat === 'انطلاق' || nat === 'استئناف') && !['ايقاف', 'ختام'].includes(nextNat)) {
                setNotification({ message: 'بعد الإنطلاق أو الإستئناف، يجب أن يكون الأمر التالي "ايقاف" أو "ختام".', type: 'error' });
                return;
            }
            if (nat === 'ايقاف' && nextNat !== 'استئناف') {
                setNotification({ message: 'بعد الإيقاف، يجب أن يكون الأمر التالي "استئناف".', type: 'error' });
                return;
            }
        }

        // No more than one start (انطلاق) or closing (ختام) per scope
        const startsCount = timeline.filter(o => o.NATURE_ODS === 'انطلاق').length;
        if (startsCount > 1) {
            setNotification({ message: 'لا يمكن إضافة أكثر من أمر "انطلاق" لنفس النطاق.', type: 'error' });
            return;
        }
        const closuresCount = timeline.filter(o => o.NATURE_ODS === 'ختام').length;
        if (closuresCount > 1) {
            setNotification({ message: 'لا يمكن إضافة أكثر من أمر "ختام" لنفس النطاق.', type: 'error' });
            return;
        }
    }, [dateOds, natureOds, associatedOds, initialData, selectedLotId]);

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        if (notification?.type === 'error') {
            alert(`خطأ في الإدخال: ${notification.message}`);
            return;
        }

        // Check for duplicates in the current scope
        const currentScopeOds = associatedOds.filter(o => 
            (selectedLotId === '' && !o.ID_LOT) || (o.ID_LOT === selectedLotId)
        );

        // 1. منع تكرار نفس النوع بنفس التاريخ
        const isExactDuplicate = currentScopeOds.some(o => 
            o.NATURE_ODS === natureOds && 
            normalizeDate(o.DATE_ODS) === normalizeDate(dateOds) && 
            o.ID_ODS !== initialData?.ID_ODS
        );

        if (isExactDuplicate) {
            alert('يوجد أمر خدمة بنفس الطبيعة والتاريخ مسجل بالفعل لهذا النطاق.');
            return;
        }

        // 2. منع تكرار "انطلاق" أو "ختام"
        if (['انطلاق', 'ختام'].includes(natureOds)) {
            const hasExistingType = currentScopeOds.some(o => 
                o.NATURE_ODS === natureOds && 
                o.ID_ODS !== initialData?.ID_ODS
            );
            if (hasExistingType) {
                alert(`لا يمكن إضافة أكثر من أمر "${natureOds}" لنفس النطاق.`);
                return;
            }
        }

        setIsSubmitting(true);
        const { ...validInitialData } = (initialData || {}) as any;

        const payload = {
            ...validInitialData,
            OBJET_ODS: objetOds,
            NATURE_ODS: natureOds,
            DATE_ODS: dateOds,
            ID_PIECE: pieceId,
            ID_LOT: selectedLotId || null,
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
            <div className="space-y-3 overflow-y-auto p-1 text-right">
            <div>
                <label htmlFor="idLot" className="block text-sm font-medium text-gray-700 text-right">النطاق (حصة أو عام)</label>
                <select
                    id="idLot"
                    value={selectedLotId}
                    onChange={(e) => { setSelectedLotId(e.target.value ? Number(e.target.value) : ''); markDirty(); }}
                    className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-[20px]"
                >
                    <option value="">الصفقة ككل (عام)</option>
                    {associatedLots.map(lot => (
                        <option key={lot.ID_LOT} value={lot.ID_LOT}>
                            حصة {lot.N_LOT}: {lot.INTITULE_LOT}
                        </option>
                    ))}
                </select>
            </div>

            <div>
                <label htmlFor="objetOds" className="block text-sm font-medium text-gray-700 text-right">موضوع أمر الخدمة</label>
                <input
                    id="objetOds"
                    type="text"
                    value={objetOds}
                    onChange={(e) => { setObjetOds(e.target.value); markDirty(); }}
                    required
                    className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-[20px]"
                />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label htmlFor="natureOds" className="block text-sm font-medium text-gray-700 text-right">طبيعة الأمر</label>
                     <select
                        id="natureOds"
                        value={natureOds}
                        onChange={(e) => { 
                            const val = e.target.value;
                            setNatureOds(val); 
                            if (val === 'ختام') setObjetOds('محضر استلام مؤقت');
                            markDirty(); 
                        }}
                        required
                        className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-[20px]"
                    >
                        {natureOdsOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                </div>
                 <div>
                    <DateInputField
                        id="dateOds"
                        label="تاريخ الأمر"
                        value={dateOds}
                        onChange={(val) => { setDateOds(val); markDirty(); }}
                        required
                    />
                </div>
            </div>
            
            {notification && (
                <div className={`p-3 rounded-[20px] text-sm text-right ${
                    notification.type === 'error' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                }`} role="alert">
                     <i className={`bi ${
                        notification.type === 'error' ? 'bi-exclamation-triangle-fill' : 'bi-info-circle-fill'
                    } ml-2`}></i>
                    {notification.message}
                </div>
            )}

            </div>
        </form>
    );
};

export default AddOdsForm;