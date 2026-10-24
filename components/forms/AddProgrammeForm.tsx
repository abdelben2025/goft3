import React, { useState, useEffect } from 'react';
import { Programme } from '../../types';

interface AddProgrammeFormProps {
    onClose: () => void;
    onSave: (programme: Omit<Programme, 'ID_PROGRAMME'> | Programme) => void;
    initialData?: Programme;
}

const AddProgrammeForm: React.FC<AddProgrammeFormProps> = ({ onClose, onSave, initialData }) => {
    const [programmeCode, setProgrammeCode] = useState('');
    const [programmeName, setProgrammeName] = useState('');

    useEffect(() => {
        if (initialData) {
            setProgrammeCode(initialData.PROGRAMME);
            setProgrammeName(initialData.INT_PROGRAMME);
        } else {
            setProgrammeCode('');
            setProgrammeName('');
        }
    }, [initialData]);

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        setIsSubmitting(true);
        onSave({
            ...(initialData || {}),
            PROGRAMME: programmeCode,
            INT_PROGRAMME: programmeName,
        });
    };

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
                <label htmlFor="programmeCode" className="block text-sm font-medium text-gray-700 text-right">رمز البرنامج</label>
                <input
                    id="programmeCode"
                    type="text"
                    value={programmeCode}
                    onChange={(e) => setProgrammeCode(e.target.value)}
                    required
                    className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
            <div>
                <label htmlFor="programmeName" className="block text-sm font-medium text-gray-700 text-right">عنوان البرنامج</label>
                <input
                    id="programmeName"
                    type="text"
                    value={programmeName}
                    onChange={(e) => setProgrammeName(e.target.value)}
                    required
                    className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
            </div>
        </form>
    );
};

export default AddProgrammeForm;