import React, { useState, useEffect } from 'react';
import { Rubrique } from '../../types';

interface AddRubriqueFormProps {
    onClose: () => void;
    onSave: (rubrique: Omit<Rubrique, 'ID_RUBRIQUE'> | Rubrique) => void;
    initialData?: Rubrique;
}

const AddRubriqueForm: React.FC<AddRubriqueFormProps> = ({ onClose, onSave, initialData }) => {
    const [rubriqueName, setRubriqueName] = useState('');

    useEffect(() => {
        if (initialData) {
            setRubriqueName(initialData.RUBRIQUE);
        }
    }, [initialData]);

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        if (!rubriqueName.trim()) {
            alert('يرجى إدخال اسم الهيكل');
            return;
        }

        setIsSubmitting(true);
        onSave({
            ...(initialData || {}),
            RUBRIQUE: rubriqueName,
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
                <label htmlFor="rubriqueName" className="block text-sm font-medium text-gray-700 text-right">اسم الهيكل</label>
                <input
                    id="rubriqueName"
                    type="text"
                    value={rubriqueName}
                    onChange={(e) => setRubriqueName(e.target.value)}
                    required
                    className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-[20px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
            </div>
        </form>
    );
};

export default AddRubriqueForm;