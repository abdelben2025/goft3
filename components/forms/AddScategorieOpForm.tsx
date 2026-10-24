import React, { useState, useEffect } from 'react';
import { Scategorie, ScategorieOp } from '../../types';
import { formatCurrency, parseCurrency, formatAmountInput, formatCurrencyForInput } from '../../utils/currencyUtils';

interface AddScategorieOpFormProps {
    onClose: () => void;
    onSave: (scategorieOp: Omit<ScategorieOp, 'ID_SCATEGORIE_OP'> | ScategorieOp) => void;
    operationId: number;
    scategories: Scategorie[];
    initialData?: ScategorieOp;
}

const AddScategorieOpForm: React.FC<AddScategorieOpFormProps> = ({ onClose, onSave, operationId, scategories, initialData }) => {
    const [idScategorie, setIdScategorie] = useState<number | ''>(scategories[0]?.ID_SCATEGORIE || '');
    const [montantInitialeStr, setMontantInitialeStr] = useState('0');
    const [montantFinaleStr, setMontantFinaleStr] = useState('0');

    useEffect(() => {
        if (initialData) {
            setIdScategorie(initialData.ID_SCATEGORIE);
            setMontantInitialeStr(formatCurrency(initialData.MONTANT_INITIALE));
            setMontantFinaleStr(formatCurrency(initialData.MONTANT_FINALE));
        }
    }, [initialData]);

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        if (!idScategorie) {
            alert("يرجى اختيار صنف فرعي.");
            return;
        }

        setIsSubmitting(true);
        onSave({
            ...(initialData || {}),
            ID_OPERATION: operationId,
            ID_SCATEGORIE: idScategorie,
            MONTANT_INITIALE: parseCurrency(montantInitialeStr),
            MONTANT_FINALE: parseCurrency(montantFinaleStr),
        });
    };

    if (scategories.length === 0 && !initialData) {
        return (
            <div className="p-4 bg-yellow-100 text-yellow-800 rounded-md text-right">
                <p className="font-bold">لا يمكن إضافة صنف فرعي للعملية.</p>
                <p>يجب عليك أولاً إضافة صنف فرعي واحد على الأقل من صفحة <span className="font-semibold">الإعدادات ← إدارة الأصناف</span>.</p>
                <div className="flex justify-end mt-4">
                    <button type="button" onClick={onClose} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors">إغلاق</button>
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col max-h-[85vh]">
            <div className="sticky top-0 bg-white z-10 pb-2 border-b border-gray-200 flex justify-end gap-3 pt-1 mb-2">
                <button type="button" onClick={onClose} className="px-5 py-1.5 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors text-sm">إلغاء</button>
                <button type="submit" disabled={isSubmitting} className="px-5 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed text-sm">
                    {isSubmitting ? 'جاري الحفظ...' : (initialData ? 'حفظ التغييرات' : 'إضافة')}
                </button>
            </div>
            <div className="space-y-3 overflow-y-auto p-1 text-right">
            <div>
                <label htmlFor="idScategorie" className="block text-sm font-medium text-gray-700 text-right">الصنف الفرعي</label>
                <select id="idScategorie" value={idScategorie} onChange={e => setIdScategorie(Number(e.target.value))} required className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-md">
                    <option value="">-- اختر صنف فرعي --</option>
                    {scategories.map(s => (
                        <option key={s.ID_SCATEGORIE} value={s.ID_SCATEGORIE}>
                            {s.C_SCATEGORIE} / {s.INT_SCATEGORIE}
                        </option>
                    ))}
                </select>
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
                        className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-md"
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
                        className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-md"
                    />
                </div>
            </div>
            </div>
        </form>
    );
};

export default AddScategorieOpForm;