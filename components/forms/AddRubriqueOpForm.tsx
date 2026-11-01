import React, { useState, useEffect } from 'react';
import { Rubrique, RubriqueOp } from '../../types';
import { formatCurrency, parseCurrency, formatAmountInput, formatCurrencyForInput } from '../../utils/currencyUtils';
import { useLanguage } from '../../context/LanguageContext';
import { pickLocalLabel } from '../../utils/dataLabels';

interface AddRubriqueOpFormProps {
    onClose: () => void;
    onSave: (rubriqueOp: Omit<RubriqueOp, 'ID_RUBRIQUE_OP'> | RubriqueOp) => void;
    operationId: number;
    rubriques: Rubrique[];
    initialData?: RubriqueOp;
}

const AddRubriqueOpForm: React.FC<AddRubriqueOpFormProps> = ({ onClose, onSave, operationId, rubriques, initialData }) => {
    const { t, language } = useLanguage();
    const [idRubrique, setIdRubrique] = useState<number | ''>(rubriques[0]?.ID_RUBRIQUE || '');
    const [montantInitialeStr, setMontantInitialeStr] = useState('0');
    const [montantFinaleStr, setMontantFinaleStr] = useState<string>('');

    useEffect(() => {
        if (initialData) {
            setIdRubrique(initialData.ID_RUBRIQUE);
            setMontantInitialeStr(formatCurrency(initialData.MONTANT_INITIALE));
            setMontantFinaleStr(initialData.MONTANT_FINALE !== null ? formatCurrency(initialData.MONTANT_FINALE) : '');
        }
    }, [initialData]);

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        if (!idRubrique) {
            alert(t('rub.select_required'));
            return;
        }

        const finalAmount = montantFinaleStr.trim() === '' ? null : parseCurrency(montantFinaleStr);

        setIsSubmitting(true);
        onSave({
            ...(initialData || {}),
            ID_OPERATION: operationId,
            ID_RUBRIQUE: idRubrique,
            MONTANT_INITIALE: parseCurrency(montantInitialeStr),
            MONTANT_FINALE: finalAmount,
        });
    };

    if (rubriques.length === 0 && !initialData) {
        return (
            <div className="p-4 bg-yellow-100 text-yellow-800 rounded-[20px] text-right">
                <p className="font-bold">{t('rub.no_rubriques_title')}</p>
                <p>{t('rub.no_rubriques_message')}</p>
                <div className="flex justify-end mt-4">
                    <button type="button" onClick={onClose} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-[20px] hover:bg-gray-300 transition-colors">{t('op.form_close')}</button>
                </div>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col max-h-[85vh]">
            <div className="sticky top-0 bg-white z-10 pb-2 border-b border-gray-200 flex justify-end gap-3 pt-1 mb-2">
                <button type="button" onClick={onClose} className="px-5 py-1.5 bg-gray-200 text-gray-800 rounded-[20px] hover:bg-gray-300 transition-colors text-sm">{t('btn.cancel')}</button>
                <button type="submit" disabled={isSubmitting} className="px-5 py-1.5 bg-blue-600 text-white rounded-[20px] hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed text-sm">
                    {isSubmitting ? t('op.form_saving') : (initialData ? t('op.form_save_changes') : t('btn.add'))}
                </button>
            </div>
            <div className="space-y-3 overflow-y-auto p-1 text-right">
            <div>
                <label htmlFor="idRubrique" className="block text-sm font-medium text-gray-700 text-right">{t('col.structure')}</label>
                <select id="idRubrique" value={idRubrique} onChange={e => setIdRubrique(Number(e.target.value))} required className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-[20px]">
                    <option value="">{t('rub.select_placeholder')}</option>
                    {rubriques.map(r => (
                        <option key={r.ID_RUBRIQUE} value={r.ID_RUBRIQUE}>
                            {pickLocalLabel(r, 'RUBRIQUE', 'RUBRIQUE_FR', '', language)}
                        </option>
                    ))}
                </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label htmlFor="montantInitiale" className="block text-sm font-medium text-gray-700 text-right">{t('doc.initial_amount')}</label>
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
                    <label htmlFor="montantFinale" className="block text-sm font-medium text-gray-700 text-right">{t('doc.final_amount')}</label>
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
                        className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-[20px]"
                    />
                </div>
            </div>
            </div>
        </form>
    );
};

export default AddRubriqueOpForm;