
import React, { useState, useEffect } from 'react';
import { Scategorie, Categorie } from '../../types';

interface AddScategorieFormProps {
    onClose: () => void;
    onSave: (scategorie: Omit<Scategorie, 'ID_SCATEGORIE'> | Scategorie) => void;
    initialData?: Scategorie;
    categories: Categorie[];
    selectedCategorieId?: number | null;
}

const AddScategorieForm: React.FC<AddScategorieFormProps> = ({ onClose, onSave, initialData, categories, selectedCategorieId }) => {
    const [scategorieCode, setScategorieCode] = useState('');
    const [scategorieName, setScategorieName] = useState('');
    const [idCategorie, setIdCategorie] = useState<number | ''>(categories[0]?.ID_CATEGORIE || '');

    useEffect(() => {
        if (initialData) {
            setScategorieCode(initialData.C_SCATEGORIE);
            setScategorieName(initialData.INT_SCATEGORIE);
            setIdCategorie(initialData.ID_CATEGORIE);
        } else {
            setScategorieCode('');
            setScategorieName('');
            setIdCategorie(selectedCategorieId || categories[0]?.ID_CATEGORIE || '');
        }
    }, [initialData, categories, selectedCategorieId]);

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        if (!idCategorie) {
            alert('الرجاء تحديد صنف رئيسي.');
            return;
        }
        
        setIsSubmitting(true);
        const dataToSave: any = {
            C_SCATEGORIE: scategorieCode,
            INT_SCATEGORIE: scategorieName,
            ID_CATEGORIE: idCategorie,
        };

        if (initialData && initialData.ID_SCATEGORIE) {
            dataToSave.ID_SCATEGORIE = initialData.ID_SCATEGORIE;
        }

        onSave(dataToSave);
    };

    if (categories.length === 0) {
        return (
            <div className="p-4 bg-yellow-100 text-yellow-800 rounded-md text-right">
                <p className="font-bold">لا يمكن إضافة صنف فرعي.</p>
                <p>يجب عليك أولاً إضافة صنف رئيسي واحد على الأقل.</p>
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
                <label htmlFor="idCategorie" className="block text-sm font-medium text-gray-700 text-right">الصنف الرئيسي</label>
                <select
                    id="idCategorie"
                    value={idCategorie}
                    onChange={(e) => setIdCategorie(Number(e.target.value))}
                    required
                    className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                     <option value="">-- اختر صنف رئيسي --</option>
                    {categories.map(c => (
                        <option key={c.ID_CATEGORIE} value={c.ID_CATEGORIE}>
                            {c.INT_CATEGORIE}
                        </option>
                    ))}
                </select>
            </div>
            <div>
                <label htmlFor="scategorieCode" className="block text-sm font-medium text-gray-700 text-right">رمز الصنف الفرعي</label>
                <input
                    id="scategorieCode"
                    type="text"
                    value={scategorieCode}
                    onChange={(e) => setScategorieCode(e.target.value)}
                    required
                    className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
            <div>
                <label htmlFor="scategorieName" className="block text-sm font-medium text-gray-700 text-right">عنوان الصنف الفرعي</label>
                <input
                    id="scategorieName"
                    type="text"
                    value={scategorieName}
                    onChange={(e) => setScategorieName(e.target.value)}
                    required
                    className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
            </div>
        </form>
    );
};

export default AddScategorieForm;
