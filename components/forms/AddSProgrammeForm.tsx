import React, { useState, useEffect } from 'react';
import { Sprogramme, Programme } from '../../types';
import { useLanguage } from '../../context/LanguageContext';

interface AddSProgrammeFormProps {
    onClose: () => void;
    onSave: (sprogramme: Omit<Sprogramme, 'ID_SPROGRAMME'> | Sprogramme) => void;
    initialData?: Sprogramme;
    programmes: Programme[];
    selectedProgrammeId?: number | null;
}

const AddSProgrammeForm: React.FC<AddSProgrammeFormProps> = ({ onClose, onSave, initialData, programmes, selectedProgrammeId }) => {
    const { t } = useLanguage();
    const [sprogrammeCode, setSProgrammeCode] = useState('');
    const [sprogrammeName, setSProgrammeName] = useState('');
    const [idProgramme, setIdProgramme] = useState<number | ''>(programmes[0]?.ID_PROGRAMME || '');

    useEffect(() => {
        if (initialData) {
            setSProgrammeCode(initialData.SPROGRAMME);
            setSProgrammeName(initialData.INT_SPROGRAMME);
            setIdProgramme(initialData.ID_PROGRAMME);
        } else {
            setSProgrammeCode('');
            setSProgrammeName('');
            setIdProgramme(selectedProgrammeId || programmes[0]?.ID_PROGRAMME || '');
        }
    }, [initialData, programmes, selectedProgrammeId]);

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        if (!idProgramme) {
            alert(t('sprg.select_parent_required'));
            return;
        }

        setIsSubmitting(true);
        onSave({
            ...(initialData || {}),
            SPROGRAMME: sprogrammeCode,
            INT_SPROGRAMME: sprogrammeName,
            ID_PROGRAMME: idProgramme,
        });
    };

    if (programmes.length === 0) {
        return (
            <div className="p-4 bg-yellow-100 text-yellow-800 rounded-md text-right">
                <p className="font-bold">{t('sprg.no_programmes_title')}</p>
                <p>{t('sprg.no_programmes_message')}</p>
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
                <label htmlFor="idProgramme" className="block text-sm font-medium text-gray-700 text-right">{t('sprg.parent_label')}</label>
                <select
                    id="idProgramme"
                    value={idProgramme}
                    onChange={(e) => setIdProgramme(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-[20px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <option value="">{t('sprg.select_parent_placeholder')}</option>
                    {programmes.map(p => (
                        <option key={p.ID_PROGRAMME} value={p.ID_PROGRAMME}>
                            {p.INT_PROGRAMME}
                        </option>
                    ))}
                </select>
            </div>
            <div>
                <label htmlFor="sprogrammeCode" className="block text-sm font-medium text-gray-700 text-right">{t('sprg.code_label')}</label>
                <input
                    id="sprogrammeCode"
                    type="text"
                    value={sprogrammeCode}
                    onChange={(e) => setSProgrammeCode(e.target.value)}
                    required
                    className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-[20px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
            <div>
                <label htmlFor="sprogrammeName" className="block text-sm font-medium text-gray-700 text-right">{t('sprg.title_label')}</label>
                <input
                    id="sprogrammeName"
                    type="text"
                    value={sprogrammeName}
                    onChange={(e) => setSProgrammeName(e.target.value)}
                    required
                    className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-[20px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
            </div>
        </form>
    );
};

export default AddSProgrammeForm;