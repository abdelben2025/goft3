
import React, { useState, useEffect, useRef } from 'react';
import { LotOperation } from '../../types';
import { formatCurrency, parseCurrency, formatAmountInput, formatCurrencyForInput } from '../../utils/currencyUtils';

interface AddLotFormProps {
    onClose: () => void;
    onSave: (lot: Omit<LotOperation, 'ID_LOT'> | LotOperation) => void;
    operationId: number;
    initialData?: LotOperation;
}

const AddLotForm: React.FC<AddLotFormProps> = ({ onClose, onSave, operationId, initialData }) => {
    const [nLot, setNLot] = useState('');
    const [intituleLot, setIntituleLot] = useState('');
    const [montantInitialeStr, setMontantInitialeStr] = useState('0');
    const [montantFinaleStr, setMontantFinaleStr] = useState('0');
    const [attribuer, setAttribuer] = useState(false);

    const isDirty = useRef(false);
    const isEditLoaded = useRef(false);
    const markDirty = () => { isDirty.current = true; };

    useEffect(() => {
        if (initialData && !isEditLoaded.current) {
            setNLot(initialData.N_LOT);
            setIntituleLot(initialData.INTITULE_LOT);
            setMontantInitialeStr(formatCurrency(initialData.MONTANT_INITIALE_LOT));
            setMontantFinaleStr(formatCurrency(initialData.MONTANT_FINALE_LOT));
            setAttribuer(initialData.ATTRIBUER);
            isEditLoaded.current = true;
            isDirty.current = true;
        } else if (!initialData && !isDirty.current) {
            setNLot('');
            setIntituleLot('');
            setMontantInitialeStr('0');
            setMontantFinaleStr('0');
            setAttribuer(false);
        }
    }, [initialData]);

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        setIsSubmitting(true);
        onSave({
            ...(initialData || {}),
            ID_OPERATION: operationId,
            N_LOT: nLot,
            INTITULE_LOT: intituleLot,
            MONTANT_INITIALE_LOT: parseCurrency(montantInitialeStr),
            MONTANT_FINALE_LOT: parseCurrency(montantFinaleStr),
            ATTRIBUER: attribuer,
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
                <label htmlFor="nLot" className="block text-sm font-medium text-gray-700 text-right">رقم الحصة</label>
                <input id="nLot" type="text" value={nLot} onChange={e => { setNLot(e.target.value.toUpperCase()); markDirty(); }} required className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-[20px] uppercase" />
            </div>
            <div>
                <label htmlFor="intituleLot" className="block text-sm font-medium text-gray-700 text-right">عنوان الحصة</label>
                <textarea 
                    id="intituleLot" 
                    value={intituleLot} 
                    onChange={e => { setIntituleLot(e.target.value.toUpperCase()); markDirty(); }} 
                    required 
                    rows={3}
                    spellCheck={true}
                    className="w-full px-3 py-2 mt-1 text-sm font-bold text-gray-700 bg-gray-100 border border-gray-300 rounded-[12px] focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase resize-y min-h-[60px]" 
                />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label htmlFor="montantInitiale" className="block text-sm font-medium text-gray-700 text-right">المبلغ الأولي</label>
                    <input
                        id="montantInitiale"
                        type="text"
                        inputMode="decimal"
                        value={montantInitialeStr}
                        onChange={(e) => { setMontantInitialeStr(formatAmountInput(e.target.value)); markDirty(); }}
                        onFocus={(e) => {
                            const num = parseCurrency(e.target.value);
                            setMontantInitialeStr(isNaN(num) ? '' : formatCurrencyForInput(num));
                        }}
                        onBlur={(e) => {
                            const num = parseCurrency(e.target.value);
                            setMontantInitialeStr(isNaN(num) ? '0' : formatCurrency(num));
                        }}
                        required
                        className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-[20px]"
                    />
                </div>
                <div>
                    <label htmlFor="montantFinale" className="block text-sm font-medium text-gray-700 text-right">المبلغ النهائي</label>
                    <input
                        id="montantFinale"
                        type="text"
                        inputMode="decimal"
                        value={montantFinaleStr}
                        onChange={(e) => { setMontantFinaleStr(formatAmountInput(e.target.value)); markDirty(); }}
                        onFocus={(e) => {
                            const num = parseCurrency(e.target.value);
                            setMontantFinaleStr(isNaN(num) ? '' : formatCurrencyForInput(num));
                        }}
                        onBlur={(e) => {
                            const num = parseCurrency(e.target.value);
                            setMontantFinaleStr(isNaN(num) ? '0' : formatCurrency(num));
                        }}
                        required
                        className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-[20px]"
                    />
                </div>
            </div>
            <div className="flex items-center">
                <input
                    id="attribuer"
                    type="checkbox"
                    checked={attribuer}
                    onChange={(e) => { setAttribuer(e.target.checked); markDirty(); }}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded[20px] focus:ring-blue-500"
                />
                <label htmlFor="attribuer" className="mr-2 block text-sm text-gray-900">
                    تم الإسناد
                </label>
            </div>
            </div>
        </form>
    );
};

export default AddLotForm;
