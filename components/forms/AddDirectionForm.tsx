
import React, { useState, useEffect } from 'react';
import { Direction } from '../../types';

interface AddDirectionFormProps {
    onClose: () => void;
    onSave: (direction: Omit<Direction, 'ID_DIRECTION'> | Direction) => void;
    initialData?: Direction;
}

const AddDirectionForm: React.FC<AddDirectionFormProps> = ({ onClose, onSave, initialData }) => {
    const [formData, setFormData] = useState({
        DIRECTION: '',
        PORTEFEUILLE: '',
        INT_PORTEFEUILLE: '',
        ORDONATEUR: '',
        ACTION: '',
        INT_ACTION: '',
        SACTION: '',
        INT_SACTION: '',
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
                <label className="block text-sm font-medium text-gray-700 text-right">المديرية</label>
                <input name="DIRECTION" value={formData.DIRECTION} onChange={handleChange} required className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-md" />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 text-right">الحافظة</label>
                    <input name="PORTEFEUILLE" value={formData.PORTEFEUILLE} onChange={handleChange} required className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-md" />
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 text-right">الآمر بالصرف</label>
                    <input name="ORDONATEUR" value={formData.ORDONATEUR} onChange={handleChange} required className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-md" />
                </div>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 text-right">عنوان الحافظة</label>
                <input name="INT_PORTEFEUILLE" value={formData.INT_PORTEFEUILLE} onChange={handleChange} required className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-md" />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 text-right">رمز النشاط</label>
                    <input name="ACTION" value={formData.ACTION} onChange={handleChange} required className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-md" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 text-right">رمز النشاط الفرعي</label>
                    <input name="SACTION" value={formData.SACTION} onChange={handleChange} required className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-md" />
                </div>
            </div>
             <div>
                <label className="block text-sm font-medium text-gray-700 text-right">عنوان النشاط</label>
                <input name="INT_ACTION" value={formData.INT_ACTION} onChange={handleChange} required className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-md" />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 text-right">عنوان النشاط الفرعي</label>
                <input name="INT_SACTION" value={formData.INT_SACTION} onChange={handleChange} className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-md" />
            </div>

            </div>
        </form>
    );
};

export default AddDirectionForm;
