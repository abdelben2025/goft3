
import React, { useState, useEffect } from 'react';
import { Categorie } from '../../types';
import { useLanguage } from '../../context/LanguageContext';

interface AddCategorieFormProps {
    onClose: () => void;
    onSave: (categorie: Omit<Categorie, 'ID_CATEGORIE'> | Categorie) => void;
    initialData?: Categorie;
}

const AddCategorieForm: React.FC<AddCategorieFormProps> = ({ onClose, onSave, initialData }) => {
    const { t } = useLanguage();
    const [categorieCode, setCategorieCode] = useState('');
    const [categorieName, setCategorieName] = useState('');

    useEffect(() => {
        if (initialData) {
            setCategorieCode(initialData.C_CATEGORIE);
            setCategorieName(initialData.INT_CATEGORIE);
        } else {
            setCategorieCode('');
            setCategorieName('');
        }
    }, [initialData]);

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;
        
        setIsSubmitting(true);
        const dataToSave: any = {
            C_CATEGORIE: categorieCode,
            INT_CATEGORIE: categorieName,
        };

        if (initialData && initialData.ID_CATEGORIE) {
            dataToSave.ID_CATEGORIE = initialData.ID_CATEGORIE;
        }

        onSave(dataToSave);
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col max-h-[85vh]">
            <div className="sticky top-0 bg-white z-10 pb-2 border-b border-gray-200 flex justify-end gap-3 pt-1 mb-2">
                <button type="button" onClick={onClose} className="px-5 py-1.5 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors text-sm">{t('btn.cancel')}</button>
                <button type="submit" disabled={isSubmitting} className="px-5 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed text-sm">
                    {isSubmitting ? t('op.form_saving') : (initialData ? t('op.form_save_changes') : t('btn.add'))}
                </button>
            </div>
            <div className="space-y-3 overflow-y-auto p-1 text-right">
            <div>
                <label htmlFor="categorieCode" className="block text-sm font-medium text-gray-700 text-right">{t('cat.code_label')}</label>
                <input
                    id="categorieCode"
                    type="text"
                    value={categorieCode}
                    onChange={(e) => setCategorieCode(e.target.value)}
                    required
                    className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
            <div>
                <label htmlFor="categorieName" className="block text-sm font-medium text-gray-700 text-right">{t('cat.title_label')}</label>
                <input
                    id="categorieName"
                    type="text"
                    value={categorieName}
                    onChange={(e) => setCategorieName(e.target.value)}
                    required
                    className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
            </div>
        </form>
    );
};

export default AddCategorieForm;
