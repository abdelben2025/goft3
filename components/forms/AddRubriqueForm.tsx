import React, { useState, useEffect } from 'react';
import { Rubrique } from '../../types';
import { useLanguage } from '../../context/LanguageContext';

interface AddRubriqueFormProps {
    onClose: () => void;
    onSave: (rubrique: Omit<Rubrique, 'ID_RUBRIQUE'> | Rubrique) => void;
    initialData?: Rubrique;
}

const AddRubriqueForm: React.FC<AddRubriqueFormProps> = ({ onClose, onSave, initialData }) => {
    const { t } = useLanguage();
    const [rubriqueName, setRubriqueName] = useState('');
    const [rubriqueNameFr, setRubriqueNameFr] = useState('');

    useEffect(() => {
        if (initialData) {
            setRubriqueName(initialData.RUBRIQUE);
            setRubriqueNameFr(initialData.RUBRIQUE_FR || '');
        }
    }, [initialData]);

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        if (!rubriqueName.trim()) {
            alert(t('rub.name_required'));
            return;
        }

        setIsSubmitting(true);
        onSave({
            ...(initialData || {}),
            RUBRIQUE: rubriqueName,
            RUBRIQUE_FR: rubriqueNameFr || undefined,
        });
    };

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
                <label htmlFor="rubriqueName" className="block text-sm font-medium text-gray-700 text-right">{t('rub.name_label')}</label>
                <input
                    id="rubriqueName"
                    type="text"
                    value={rubriqueName}
                    onChange={(e) => setRubriqueName(e.target.value)}
                    required
                    className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-[20px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
            <div>
                <label htmlFor="rubriqueNameFr" className="block text-sm font-medium text-gray-700 text-right">{t('rub.name_fr_label')}</label>
                <input
                    id="rubriqueNameFr"
                    type="text"
                    value={rubriqueNameFr}
                    onChange={(e) => setRubriqueNameFr(e.target.value)}
                    className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-[20px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
            </div>
        </form>
    );
};

export default AddRubriqueForm;