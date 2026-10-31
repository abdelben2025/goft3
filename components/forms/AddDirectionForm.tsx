
import React, { useState, useEffect } from 'react';
import { Direction } from '../../types';
import { useLanguage } from '../../context/LanguageContext';

interface AddDirectionFormProps {
    onClose: () => void;
    onSave: (direction: Omit<Direction, 'ID_DIRECTION'> | Direction) => void;
    initialData?: Direction;
}

const AddDirectionForm: React.FC<AddDirectionFormProps> = ({ onClose, onSave, initialData }) => {
    const { t } = useLanguage();
    const [formData, setFormData] = useState({
        DIRECTION: '',
        PORTEFEUILLE: '',
        INT_PORTEFEUILLE: '',
        ORDONATEUR: '',
        ACTION: '',
        INT_ACTION: '',
        SACTION: '',
        INT_SACTION: '',
        DIRECTION_FR: '',
        INT_PORTEFEUILLE_FR: '',
        INT_ACTION_FR: '',
        INT_SACTION_FR: '',
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                DIRECTION: initialData.DIRECTION,
                PORTEFEUILLE: initialData.PORTEFEUILLE,
                INT_PORTEFEUILLE: initialData.INT_PORTEFEUILLE,
                ORDONATEUR: initialData.ORDONATEUR,
                ACTION: initialData.ACTION,
                INT_ACTION: initialData.INT_ACTION,
                SACTION: initialData.SACTION || '',
                INT_SACTION: initialData.INT_SACTION || '',
                DIRECTION_FR: initialData.DIRECTION_FR || '',
                INT_PORTEFEUILLE_FR: initialData.INT_PORTEFEUILLE_FR || '',
                INT_ACTION_FR: initialData.INT_ACTION_FR || '',
                INT_SACTION_FR: initialData.INT_SACTION_FR || '',
            });
        } else {
             setFormData({
                DIRECTION: '',
                PORTEFEUILLE: '',
                INT_PORTEFEUILLE: '',
                ORDONATEUR: '',
                ACTION: '',
                INT_ACTION: '',
                SACTION: '',
                INT_SACTION: '',
                DIRECTION_FR: '',
                INT_PORTEFEUILLE_FR: '',
                INT_ACTION_FR: '',
                INT_SACTION_FR: '',
            });
        }
    }, [initialData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        setIsSubmitting(true);
        onSave({
            ...(initialData || {}),
            ...formData,
            INT_SACTION: formData.INT_SACTION || null,
            INT_SACTION_FR: formData.INT_SACTION_FR || null,
        });
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
                <label className="block text-sm font-medium text-gray-700 text-right">{t('dir.direction')}</label>
                <input name="DIRECTION" value={formData.DIRECTION} onChange={handleChange} required className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-md" />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 text-right">{t('dir.direction_fr_label')}</label>
                <input name="DIRECTION_FR" value={formData.DIRECTION_FR} onChange={handleChange} className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-md" />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 text-right">{t('dir.portfolio_label')}</label>
                    <input name="PORTEFEUILLE" value={formData.PORTEFEUILLE} onChange={handleChange} required className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-md" />
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 text-right">{t('col.ordonnateur')}</label>
                    <input name="ORDONATEUR" value={formData.ORDONATEUR} onChange={handleChange} required className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-md" />
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 text-right">{t('dir.portfolio_title_label')}</label>
                <input name="INT_PORTEFEUILLE" value={formData.INT_PORTEFEUILLE} onChange={handleChange} required className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-md" />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 text-right">{t('dir.portfolio_title_fr_label')}</label>
                <input name="INT_PORTEFEUILLE_FR" value={formData.INT_PORTEFEUILLE_FR} onChange={handleChange} className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-md" />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 text-right">{t('dir.action_code')}</label>
                    <input name="ACTION" value={formData.ACTION} onChange={handleChange} required className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-md" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 text-right">{t('dir.subaction_code')}</label>
                    <input name="SACTION" value={formData.SACTION} onChange={handleChange} required className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-md" />
                </div>
            </div>
             <div>
                <label className="block text-sm font-medium text-gray-700 text-right">{t('dir.activity_title')}</label>
                <input name="INT_ACTION" value={formData.INT_ACTION} onChange={handleChange} required className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-md" />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 text-right">{t('dir.activity_title_fr_label')}</label>
                <input name="INT_ACTION_FR" value={formData.INT_ACTION_FR} onChange={handleChange} className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-md" />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 text-right">{t('dir.subactivity_title')}</label>
                <input name="INT_SACTION" value={formData.INT_SACTION} onChange={handleChange} className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-md" />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 text-right">{t('dir.subactivity_title_fr_label')}</label>
                <input name="INT_SACTION_FR" value={formData.INT_SACTION_FR} onChange={handleChange} className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-md" />
            </div>

            </div>
        </form>
    );
};

export default AddDirectionForm;
