import React, { useState, useEffect } from 'react';
import { Cp } from '../../types';
import { formatCurrency, parseCurrency, formatAmountInput, formatCurrencyForInput } from '../../utils/currencyUtils';


interface AddCpFormProps {
    onClose: () => void;
    onSave: (cp: Omit<Cp, 'ID_CP'> | Cp) => void;
    operationId: number;
    initialData?: Cp;
    selectedYear: string;
}

const AddCpForm: React.FC<AddCpFormProps> = ({ onClose, onSave, operationId, initialData, selectedYear }) => {
    const [annee, setAnnee] = useState(() => initialData ? initialData.ANNEE : selectedYear);
    const [montantInitialeStr, setMontantInitialeStr] = useState('0');
    const [montantFinaleStr, setMontantFinaleStr] = useState('0');

    useEffect(() => {
        if (initialData) {
            setAnnee(initialData.ANNEE);
            setMontantInitialeStr(formatCurrency(initialData.MONTANT_INITIALE_CP));
            setMontantFinaleStr(formatCurrency(initialData.MONTANT_FINALE_CP));
        } else {
            setAnnee(selectedYear);
            setMontantInitialeStr('0');
            setMontantFinaleStr('0');
        }
    }, [initialData, selectedYear]);

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        setIsSubmitting(true);
        onSave({
            ...(initialData || {}),
            ID_OPERATION: operationId,
            ANNEE: annee,
            MONTANT_INITIALE_CP: parseCurrency(montantInitialeStr),
            MONTANT_FINALE_CP: parseCurrency(montantFinaleStr),
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
                <label htmlFor="annee" className="block text-sm font-medium text-gray-700 text-right">السنة</label>
                <input
                    id="annee"
                    type="text"
                    value={annee}
                    onChange={(e) => setAnnee(e.target.value)}
                    required
                    maxLength={4}
                    className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-[20px]"
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
                        onChange={(e) => setMontantInitialeStr(formatAmountInput(e.target.value))}
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
                        onChange={(e) => setMontantFinaleStr(formatAmountInput(e.target.value))}
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
            </div>
        </form>
    );
};

export default AddCpForm;