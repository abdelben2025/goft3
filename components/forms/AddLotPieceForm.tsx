import React, { useState, useEffect, useMemo } from 'react';
import { LotPiece, LotOperation } from '../../types';
import { useLanguage } from '../../context/LanguageContext';

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
    const { t } = useLanguage();

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

    // Auto-select first available lot only if nothing is selected and in Add Mode.
    // The `selectedLotId === 0` guard means this never overrides a user's choice,
    // so including both reactive values is safe.
    useEffect(() => {
        if (!initialData && selectedLotId === 0 && availableLots.length > 0) {
            setSelectedLotId(availableLots[0].ID_LOT);
            setDelaiExVal('');
            setDelaiExUnit('days');
        }
    }, [initialData, availableLots, selectedLotId]);


    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        if (!selectedLotId) {
            alert(t('lotpieceform.selectLotAlert'));
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
                <button type="button" onClick={onClose} className="px-5 py-1.5 bg-gray-200 text-gray-800 rounded-[20px] hover:bg-gray-300 transition-colors text-sm">{t('btn.cancel')}</button>
                <button type="submit" disabled={isSubmitting || (availableLots.length === 0 && !initialData)} className="px-5 py-1.5 bg-blue-600 text-white rounded-[20px] hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm">
                    {isSubmitting ? t('lotpieceform.saving') : (initialData ? t('lotpieceform.saveChanges') : t('btn.add'))}
                </button>
            </div>
            <div className="space-y-3 overflow-y-auto p-1 text-right">
            <div>
                <label htmlFor="idLot" className="block text-sm font-medium text-gray-700 text-right">{t('doc.lot')}</label>
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
                    <p className="mt-2 text-gray-600">{t('lotpieceform.noAvailableLots')}</p>
                )}
            </div>
            
            <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                    <label htmlFor="delaiExVal" className="block text-sm font-medium text-gray-700 text-right">{t('lotpieceform.durationLabel')}</label>
                    <input 
                        id="delaiExVal" 
                        type="text" 
                        value={delaiExVal} 
                        onChange={e => setDelaiExVal(e.target.value)} 
                        placeholder={t('lotpieceform.durationPlaceholder')}
                        className="w-full h-9 px-3 py-2 mt-1 text-gray-700 bg-white border border-gray-300 rounded-[20px] focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    />
                </div>
                <div>
                    <label htmlFor="delaiExUnit" className="block text-sm font-medium text-gray-700 text-right">{t('docform.unit')}</label>
                    <select id="delaiExUnit" value={delaiExUnit} onChange={e => setDelaiExUnit(e.target.value as any)} className="w-full h-9 px-1 py-1 mt-1 text-sm text-gray-700 bg-white border border-gray-300 rounded-[20px] focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="days">{t('docform.days')}</option>
                        <option value="months">{t('lotpieceform.months')}</option>
                    </select>
                </div>
            </div>

            </div>
        </form>
    );
};

export default AddLotPieceForm;