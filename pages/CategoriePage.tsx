
import React, { useState } from 'react';
import { Page, Categorie, Scategorie, User } from '../types';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { errorMessage } from '../utils/errorMessage';
import PageWrapper from '../components/PageWrapper';
import Modal from '../components/Modal';
import ConfirmActionModal from '../components/ConfirmActionModal';
import AddCategorieForm from '../components/forms/AddCategorieForm';
import AddScategorieForm from '../components/forms/AddScategorieForm';

interface CategoriePageProps {
    navigate: (page: Page) => void;
    onGoBack?: () => void;
    currentUser: User;
}

const CategoriePage: React.FC<CategoriePageProps> = ({ navigate, onGoBack, currentUser }) => {
    const { db, loading, addItem, updateItem, deleteItem } = useData();
    const { showToast } = useToast();
    const [selectedCategorieId, setSelectedCategorieId] = useState<number | null>(db.T_CATEGORIE[0]?.ID_CATEGORIE || null);
    const [selectedScategorieId, setSelectedScategorieId] = useState<number | null>(null);

    const [isCategorieModalOpen, setIsCategorieModalOpen] = useState(false);
    const [editingCategorie, setEditingCategorie] = useState<Categorie | undefined>(undefined);
    const [isScategorieModalOpen, setIsScategorieModalOpen] = useState(false);
    const [editingScategorie, setEditingScategorie] = useState<Scategorie | undefined>(undefined);
    const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; type: 'cat' | 'scat' | null }>({ open: false, type: null });
    
    // Categorie CRUD
    const handleSaveCategorie = async (data: Omit<Categorie, 'ID_CATEGORIE'> | Categorie) => {
        showToast('جاري حفظ الصنف...', 'loading');
        try {
            if ('ID_CATEGORIE' in data) {
                await updateItem('T_CATEGORIE', data.ID_CATEGORIE, data);
                showToast('تم تعديل الصنف بنجاح', 'success');
            } else {
                await addItem('T_CATEGORIE', data);
                showToast('تمت إضافة الصنف بنجاح', 'success');
            }
            setIsCategorieModalOpen(false);
            setEditingCategorie(undefined);
        } catch (error) {
            showToast(`حدث خطأ أثناء الحفظ — السبب: ${errorMessage(error)}`, 'error');
        }
    };

    const handleDeleteCategorie = () => {
        if (selectedCategorieId === null) return;
        setDeleteConfirm({ open: true, type: 'cat' });
    };

    const confirmDeleteCategorie = async () => {
        setDeleteConfirm({ open: false, type: null });
        if (selectedCategorieId === null) return;
        showToast('جاري حذف الصنف...', 'loading');
        try {
            await deleteItem('T_CATEGORIE', selectedCategorieId);
            const newCategories = db.T_CATEGORIE.filter(c => c.ID_CATEGORIE !== selectedCategorieId);
            setSelectedCategorieId(newCategories[0]?.ID_CATEGORIE || null);
            setSelectedScategorieId(null);
            showToast('تم حذف الصنف بنجاح', 'success');
        } catch (error) {
            showToast(`حدث خطأ أثناء الحذف — السبب: ${errorMessage(error)}`, 'error');
        }
    };

    // Scategorie CRUD
    const handleSaveScategorie = async (data: Omit<Scategorie, 'ID_SCATEGORIE'> | Scategorie) => {
        showToast('جاري حفظ الصنف الفرعي...', 'loading');
        try {
            if ('ID_SCATEGORIE' in data) {
                await updateItem('T_SCATEGORIE', data.ID_SCATEGORIE, data);
                showToast('تم تعديل الصنف الفرعي بنجاح', 'success');
            } else {
                await addItem('T_SCATEGORIE', data);
                showToast('تمت إضافة الصنف الفرعي بنجاح', 'success');
            }
            setIsScategorieModalOpen(false);
            setEditingScategorie(undefined);
        } catch (error) {
            showToast(`حدث خطأ أثناء الحفظ — السبب: ${errorMessage(error)}`, 'error');
        }
    };

    const handleDeleteScategorie = () => {
        if (selectedScategorieId === null) return;
        setDeleteConfirm({ open: true, type: 'scat' });
    };

    const confirmDeleteScategorie = async () => {
        setDeleteConfirm({ open: false, type: null });
        if (selectedScategorieId === null) return;
        showToast('جاري حذف الصنف الفرعي...', 'loading');
        try {
            await deleteItem('T_SCATEGORIE', selectedScategorieId);
            setSelectedScategorieId(null);
            showToast('تم حذف الصنف الفرعي بنجاح', 'success');
        } catch (error) {
            showToast(`حدث خطأ أثناء الحذف — السبب: ${errorMessage(error)}`, 'error');
        }
    };

    if (loading) return <div>جار التحميل...</div>;

    return (
        <PageWrapper
            title="إدارة الأصناف"
            navigate={navigate}
            onGoBack={onGoBack}
            backPage="SETTINGS"
            currentUser={currentUser}
        >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-4 rounded-lg shadow-md">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-gray-800">الأصناف الرئيسية</h3>
                        <div className="flex items-center gap-2">
                            <button onClick={() => { if(loading) { alert("يجب الانتظار حتى يتم تحديث النافذة"); return; } setEditingCategorie(undefined); setIsCategorieModalOpen(true); }} className="bg-green-500 text-white px-3 py-1 rounded-md shadow hover:bg-green-600 text-sm"><i className="bi bi-plus-circle mr-1"></i> إضافة</button>
                            <button onClick={() => { if(loading) { alert("يجب الانتظار حتى يتم تحديث النافذة"); return; } const item = db.T_CATEGORIE.find(i=>i.ID_CATEGORIE === selectedCategorieId); if(item) { setEditingCategorie(item); setIsCategorieModalOpen(true); } }} disabled={selectedCategorieId === null} className="bg-yellow-500 text-white px-3 py-1 rounded-md shadow hover:bg-yellow-600 text-sm disabled:bg-gray-400"><i className="bi bi-pencil-fill mr-1"></i> تعديل</button>
                            <button onClick={handleDeleteCategorie} disabled={selectedCategorieId === null} className="bg-red-500 text-white px-3 py-1 rounded-md shadow hover:bg-red-600 text-sm disabled:bg-gray-400"><i className="bi bi-trash-fill mr-1"></i> حذف</button>
                        </div>
                    </div>
                    <div className="overflow-auto max-h-[calc(100vh-20rem)]">
                        <table className="w-full text-right">
                            <thead className="bg-blue-100 sticky top-0">
                                <tr>
                                    <th className="p-3 text-sm font-semibold text-gray-700">الرمز</th>
                                    <th className="p-3 text-sm font-semibold text-gray-700">العنوان</th>
                                </tr>
                            </thead>
                            <tbody>
                                {db.T_CATEGORIE.slice().sort((a, b) => a.ID_CATEGORIE - b.ID_CATEGORIE).map(cat => (
                                    <tr 
                                        key={cat.ID_CATEGORIE} 
                                        className={`border-b hover:bg-gray-50 cursor-pointer text-sm ${cat.ID_CATEGORIE === selectedCategorieId ? 'bg-blue-50' : ''}`}
                                        onClick={() => { setSelectedCategorieId(cat.ID_CATEGORIE); setSelectedScategorieId(null); }}
                                    >
                                        <td className="p-3 text-gray-800">{cat.C_CATEGORIE}</td>
                                        <td className="p-3 text-gray-700">{cat.INT_CATEGORIE}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-lg shadow-md">
                     <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-gray-800">الأصناف الفرعية</h3>
                         <div className="flex items-center gap-2">
                            <button onClick={() => { if(loading) { alert("يجب الانتظار حتى يتم تحديث النافذة"); return; } setEditingScategorie(undefined); setIsScategorieModalOpen(true); }} disabled={selectedCategorieId === null} className="bg-green-500 text-white px-3 py-1 rounded-md shadow hover:bg-green-600 text-sm disabled:bg-gray-400"><i className="bi bi-plus-circle mr-1"></i> إضافة</button>
                            <button onClick={() => { if(loading) { alert("يجب الانتظار حتى يتم تحديث النافذة"); return; } const item = db.T_SCATEGORIE.find(i=>i.ID_SCATEGORIE === selectedScategorieId); if(item) { setEditingScategorie(item); setIsScategorieModalOpen(true); } }} disabled={selectedScategorieId === null} className="bg-yellow-500 text-white px-3 py-1 rounded-md shadow hover:bg-yellow-600 text-sm disabled:bg-gray-400"><i className="bi bi-pencil-fill mr-1"></i> تعديل</button>
                            <button onClick={handleDeleteScategorie} disabled={selectedScategorieId === null} className="bg-red-500 text-white px-3 py-1 rounded-md shadow hover:bg-red-600 text-sm disabled:bg-gray-400"><i className="bi bi-trash-fill mr-1"></i> حذف</button>
                        </div>
                    </div>
                     <div className="overflow-auto max-h-[calc(100vh-20rem)]">
                        <table className="w-full text-right">
                             <thead className="bg-blue-100 sticky top-0">
                                <tr>
                                    <th className="p-3 text-sm font-semibold text-gray-700">الرمز</th>
                                    <th className="p-3 text-sm font-semibold text-gray-700">العنوان</th>
                                </tr>
                            </thead>
                            <tbody>
                                {db.T_SCATEGORIE.filter(scat => scat.ID_CATEGORIE === selectedCategorieId).sort((a, b) => a.ID_SCATEGORIE - b.ID_SCATEGORIE).map(scat => (
                                    <tr key={scat.ID_SCATEGORIE} onClick={() => setSelectedScategorieId(scat.ID_SCATEGORIE)} className={`border-b hover:bg-gray-50 cursor-pointer text-sm ${scat.ID_SCATEGORIE === selectedScategorieId ? 'bg-blue-100' : ''}`}>
                                        <td className="p-3 text-gray-800">{scat.C_SCATEGORIE}</td>
                                        <td className="p-3 text-gray-700">{scat.INT_SCATEGORIE}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <Modal isOpen={isCategorieModalOpen} onClose={() => setIsCategorieModalOpen(false)} title={editingCategorie ? "تعديل صنف" : "إضافة صنف جديد"}>
                <AddCategorieForm 
                    key={editingCategorie ? `edit-cat-${editingCategorie.ID_CATEGORIE}` : 'add-cat'}
                    onClose={() => setIsCategorieModalOpen(false)} 
                    onSave={handleSaveCategorie} 
                    initialData={editingCategorie} 
                />
            </Modal>
             <Modal isOpen={isScategorieModalOpen} onClose={() => setIsScategorieModalOpen(false)} title={editingScategorie ? "تعديل صنف فرعي" : "إضافة صنف فرعي جديد"}>
                <AddScategorieForm 
                    key={editingScategorie ? `edit-scat-${editingScategorie.ID_SCATEGORIE}` : 'add-scat'}
                    onClose={() => setIsScategorieModalOpen(false)} 
                    onSave={handleSaveScategorie} 
                    initialData={editingScategorie} 
                    categories={db.T_CATEGORIE} 
                    selectedCategorieId={selectedCategorieId} 
                />
            </Modal>
            <ConfirmActionModal
                isOpen={deleteConfirm.open}
                title="تأكيد الحذف"
                message={
                    deleteConfirm.type === 'cat'
                        ? 'هل أنت متأكد أنك تريد حذف هذا الصنف؟ سيتم حذف جميع الأصناف الفرعية المرتبطة به.'
                        : 'هل أنت متأكد أنك تريد حذف هذا الصنف الفرعي؟'
                }
                onCancel={() => setDeleteConfirm({ open: false, type: null })}
                onConfirm={() => {
                    if (deleteConfirm.type === 'cat') confirmDeleteCategorie();
                    else confirmDeleteScategorie();
                }}
            />
        </PageWrapper>
    );
};

export default CategoriePage;
