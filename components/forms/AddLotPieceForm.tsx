import React, { useState, useEffect, useMemo } from 'react';
import { LotPiece, LotOperation } from '../../types';

interface AddLotPieceFormProps {
    onClose: () => void;
    onSave: (lotPiece: any) => void | Promise<void>;
    pieceId: number;
    allLotsForOperation: LotOperation[];
    alreadyAssociatedLotIds: number[];
    initialData?: LotPiece;
}

const AddLotPieceForm: React.FC<AddLotPieceFormProps> = ({ onClose, onSave, pieceId, allLotsForOperation, alreadyAssociatedLotIds, initialData }) => {
    
    const availableLots = useMemo(() => {
        if (initialData) {
            // When editing, the current lot should be available in the list
            return allLotsForOperation.filter(lot => !alreadyAssociatedLotIds.includes(lot.ID_LOT) || lot.ID_LOT === initialData.ID_LOT);
        }
        return allLotsForOperation.filter(lot => !alreadyAssociatedLotIds.includes(lot.ID_LOT));
    }, [allLotsForOperation, alreadyAssociatedLotIds, initialData]);

    const [selectedLotId, setSelectedLotId] = useState<number>(0);
    const [delaiExVal, setDelaiExVal] = useState<string>('');
    const [delaiExUnit, setDelaiExUnit] = useState<'days' | 'months'>('days');

    // Initialize fields based on initialData (Edit Mode)
    useEffect(() => {
        if (initialData) {
            setSelectedLotId(initialData.ID_LOT);
            const dur = initialData.DELAI_EX_JOURS || '';
            if (dur.toLowerCase().endsWith('m')) {
                setDelaiExVal(dur.substring(0, dur.length - 1));
                setDelaiExUnit('months');
            } else {
                setDelaiExVal(dur);
                setDelaiExUnit('days');
            }
        }
    }, [initialData]);

    // Auto-select first available lot only if nothing is selected and in Add Mode
    // We do NOT add availableLots to dependency array to avoid reset on refresh
    useEffect(() => {
        if (!initialData && selectedLotId === 0 && availableLots.length > 0) {
            setSelectedLotId(availableLots[0].ID_LOT);
            setDelaiExVal('');
            setDelaiExUnit('days');
        }
    }, [initialData]); // Only re-run if initialData prop changes reference (e.g. modal opens)


    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        if (!selectedLotId) {
            alert("يرجى اختيار حصة");
            return;
        }

        setIsSubmitting(true);
        const finalDelai = delaiExUnit === 'months' && delaiExVal ? `${delaiExVal}m` : (delaiExVal || null);

        const { ...validInitialData } = (initialData || {}) as any;
        const payload = {
            ...validInitialData,
            ID_LOT: selectedLotId,
            ID_PIECE: pieceId,
            DELAI_EX_JOURS: finalDelai,
        };

        Promise.resolve(onSave(payload)).finally(() => {
            setIsSubmitting(false);
        });
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col max-h-[85vh]">
            <div className="sticky top-0 bg-white z-10 pb-2 border-b border-gray-200 flex justify-end gap-3 pt-1 mb-2">
                <button type="button" onClick={onClose} className="px-5 py-1.5 bg-gray-200 text-gray-800 rounded-[20px] hover:bg-gray-300 transition-colors text-sm">إلغاء</button>
                <button type="submit" disabled={isSubmitting || (availableLots.length === 0 && !initialData)} className="px-5 py-1.5 bg-blue-600 text-white rounded-[20px] hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm">
                    {isSubmitting ? 'جاري الحفظ...' : (initialData ? 'حفظ التغييرات' : 'إضافة')}
                </button>
            </div>
            <div className="space-y-3 overflow-y-auto p-1 text-right">
            <div>
                <label htmlFor="idLot" className="block text-sm font-medium text-gray-700 text-right">الحصة</label>
                {availableLots.length > 0 ? (
                    <select
                        id="idLot"
                        value={selectedLotId}
                        onChange={(e) => setSelectedLotId(Number(e.target.value))}
                        required
                        className="w-full h-9 px-3 py-2 mt-1 text-[12px] text-gray-700 text-center bg-gray-100 border border-gray-300 rounded-[20px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        {availableLots.map(lot => (
                            <option key={lot.ID_LOT} value={lot.ID_LOT}>
                                {lot.N_LOT} - {lot.INTITULE_LOT}
                            </option>
                        ))}
                    </select>
                ) : (
                    <p className="mt-2 text-gray-600">لا توجد حصص متاحة للربط في هذه العملية.</p>
                )}
            </div>
            
            <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                    <label htmlFor="delaiExVal" className="block text-sm font-medium text-gray-700 text-right">مدة الإنجاز الخاصة بالحصة</label>
                    <input 
                        id="delaiExVal" 
                        type="text" 
                        value={delaiExVal} 
                        onChange={e => setDelaiExVal(e.target.value)} 
                        placeholder="اختياري (إذا كانت مختلفة عن الصفقة)"
                        className="w-full h-9 px-3 py-2 mt-1 text-gray-700 bg-white border border-gray-300 rounded-[20px] focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    />
                </div>
                <div>
                    <label htmlFor="delaiExUnit" className="block text-sm font-medium text-gray-700 text-right">الوحدة</label>
                    <select id="delaiExUnit" value={delaiExUnit} onChange={e => setDelaiExUnit(e.target.value as any)} className="w-full h-9 px-1 py-1 mt-1 text-sm text-gray-700 bg-white border border-gray-300 rounded-[20px] focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="days">أيام</option>
                        <option value="months">أشهر</option>
                    </select>
                </div>
            </div>

            </div>
        </form>
    );
};

export default AddLotPieceForm;