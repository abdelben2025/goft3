
import React, { useState } from 'react';
import { Page, Programme, Sprogramme, User } from '../types';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { errorMessage } from '../utils/errorMessage';
import PageWrapper from '../components/PageWrapper';
import Modal from '../components/Modal';
import ConfirmActionModal from '../components/ConfirmActionModal';
import AddProgrammeForm from '../components/forms/AddProgrammeForm';
import AddSProgrammeForm from '../components/forms/AddSProgrammeForm';

interface ProgrammePageProps {
    navigate: (page: Page) => void;
    onGoBack?: () => void;
    currentUser: User;
}

const ProgrammePage: React.FC<ProgrammePageProps> = ({ navigate, onGoBack, currentUser }) => {
    const { db, loading, addItem, updateItem, deleteItem } = useData();
    const { showToast } = useToast();
    const [selectedProgrammeId, setSelectedProgrammeId] = useState<number | null>(db.T_PROGRAMME[0]?.ID_PROGRAMME || null);
    const [selectedSProgrammeId, setSelectedSProgrammeId] = useState<number | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; type: 'prog' | 'sprog' | null }>({ open: false, type: null });

    const [isProgrammeModalOpen, setIsProgrammeModalOpen] = useState(false);
    const [editingProgramme, setEditingProgramme] = useState<Programme | undefined>(undefined);
    const [isSProgrammeModalOpen, setIsSProgrammeModalOpen] = useState(false);
    const [editingSProgramme, setEditingSProgramme] = useState<Sprogramme | undefined>(undefined);
    const [progFormKey, setProgFormKey] = useState(0);
    const [sprogFormKey, setSprogFormKey] = useState(0);

    // Programme CRUD
    const handleSaveProgramme = async (data: Omit<Programme, 'ID_PROGRAMME'> | Programme) => {
        showToast('جاري حفظ البرنامج...', 'loading');
        try {
            if ('ID_PROGRAMME' in data) {
                await updateItem('T_PROGRAMME', data.ID_PROGRAMME, data);
                showToast('تم تعديل البرنامج بنجاح', 'success');
            } else {
                await addItem('T_PROGRAMME', data);
                showToast('تمت إضافة البرنامج بنجاح', 'success');
            }
            setIsProgrammeModalOpen(false);
            setEditingProgramme(undefined);
        } catch (error) {
            showToast(`حدث خطأ أثناء الحفظ — السبب: ${errorMessage(error)}`, 'error');
        }
    };

    const handleDeleteProgramme = () => {
        if (selectedProgrammeId === null) return;
        setDeleteConfirm({ open: true, type: 'prog' });
    };

    const confirmDeleteProgramme = async () => {
        setDeleteConfirm({ open: false, type: null });
        if (selectedProgrammeId === null) return;
        showToast('جاري الحذف...', 'loading');
        try {
            await deleteItem('T_PROGRAMME', selectedProgrammeId);
            const newProgrammes = db.T_PROGRAMME.filter(p => p.ID_PROGRAMME !== selectedProgrammeId);
            setSelectedProgrammeId(newProgrammes[0]?.ID_PROGRAMME || null);
            setSelectedSProgrammeId(null);
            showToast('تم حذف البرنامج بنجاح', 'success');
        } catch (error) {
            showToast(`حدث خطأ أثناء الحذف — السبب: ${errorMessage(error)}`, 'error');
        }
    };

    // SProgramme CRUD
    const handleSaveSProgramme = async (data: Omit<Sprogramme, 'ID_SPROGRAMME'> | Sprogramme) => {
        showToast('جاري حفظ البرنامج الفرعي...', 'loading');
        try {
            if ('ID_SPROGRAMME' in data) {
                await updateItem('T_SPROGRAMME', data.ID_SPROGRAMME, data);
                showToast('تم تعديل البرنامج الفرعي بنجاح', 'success');
            } else {
                await addItem('T_SPROGRAMME', data);
                showToast('تمت إضافة البرنامج الفرعي بنجاح', 'success');
            }
            setIsSProgrammeModalOpen(false);
            setEditingSProgramme(undefined);
        } catch (error) {
            showToast(`حدث خطأ أثناء الحفظ — السبب: ${errorMessage(error)}`, 'error');
        }
    };

    const handleDeleteSProgramme = () => {
        if (selectedSProgrammeId === null) return;
        setDeleteConfirm({ open: true, type: 'sprog' });
    };

    const confirmDeleteSProgramme = async () => {
        setDeleteConfirm({ open: false, type: null });
        if (selectedSProgrammeId === null) return;
        showToast('جاري الحذف...', 'loading');
        try {
            await deleteItem('T_SPROGRAMME', selectedSProgrammeId);
            setSelectedSProgrammeId(null);
            showToast('تم حذف البرنامج الفرعي بنجاح', 'success');
        } catch (error) {
            showToast(`حدث خطأ أثناء الحذف — السبب: ${errorMessage(error)}`, 'error');
        }
    };

    if (loading) return <div>جار التحميل...</div>;

    return (
        <PageWrapper
            title="إدارة البرامج"
            navigate={navigate}
            onGoBack={onGoBack}
            currentUser={currentUser}
        >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-4 rounded-lg shadow-md">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-gray-800">البرامج الرئيسية</h3>
                        <div className="flex items-center gap-2">
                            <button onClick={() => { if(loading) { alert("يجب الانتظار حتى يتم تحديث النافذة"); return; } setEditingProgramme(undefined); setProgFormKey(p => p + 1); setIsProgrammeModalOpen(true); }} className="bg-green-500 text-white px-3 py-1 rounded-md shadow hover:bg-green-600 text-sm"><i className="bi bi-plus-circle mr-1"></i> إضافة</button>
                            <button onClick={() => { if(loading) { alert("يجب الانتظار حتى يتم تحديث النافذة"); return; } const item = db.T_PROGRAMME.find(i=>i.ID_PROGRAMME === selectedProgrammeId); if(item) { setEditingProgramme(item); setProgFormKey(p => p + 1); setIsProgrammeModalOpen(true); } }} disabled={selectedProgrammeId === null} className="bg-yellow-500 text-white px-3 py-1 rounded-md shadow hover:bg-yellow-600 text-sm disabled:bg-gray-400"><i className="bi bi-pencil-fill mr-1"></i> تعديل</button>
                            <button onClick={handleDeleteProgramme} disabled={selectedProgrammeId === null} className="bg-red-500 text-white px-3 py-1 rounded-md shadow hover:bg-red-600 text-sm disabled:bg-gray-400"><i className="bi bi-trash-fill mr-1"></i> حذف</button>
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
                                {db.T_PROGRAMME.slice().sort((a, b) => a.ID_PROGRAMME - b.ID_PROGRAMME).map(prog => (
                                    <tr 
                                        key={prog.ID_PROGRAMME} 
                                        className={`border-b hover:bg-gray-50 cursor-pointer text-sm ${prog.ID_PROGRAMME === selectedProgrammeId ? 'bg-blue-50' : ''}`}
                                        onClick={() => { setSelectedProgrammeId(prog.ID_PROGRAMME); setSelectedSProgrammeId(null); }}
                                    >
                                        <td className="p-3 text-gray-800">{prog.PROGRAMME}</td>
                                        <td className="p-3 text-gray-700">{prog.INT_PROGRAMME}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                 <div className="bg-white p-4 rounded-lg shadow-md">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-gray-800">البرامج الفرعية</h3>
                        <div className="flex items-center gap-2">
                            <button onClick={() => { if(loading) { alert("يجب الانتظار حتى يتم تحديث النافذة"); return; } setEditingSProgramme(undefined); setSprogFormKey(p => p + 1); setIsSProgrammeModalOpen(true); }} disabled={selectedProgrammeId === null} className="bg-green-500 text-white px-3 py-1 rounded-md shadow hover:bg-green-600 text-sm disabled:bg-gray-400"><i className="bi bi-plus-circle mr-1"></i> إضافة</button>
                            <button onClick={() => { if(loading) { alert("يجب الانتظار حتى يتم تحديث النافذة"); return; } const item = db.T_SPROGRAMME.find(i=>i.ID_SPROGRAMME === selectedSProgrammeId); if(item) { setEditingSProgramme(item); setSprogFormKey(p => p + 1); setIsSProgrammeModalOpen(true); } }} disabled={selectedSProgrammeId === null} className="bg-yellow-500 text-white px-3 py-1 rounded-md shadow hover:bg-yellow-600 text-sm disabled:bg-gray-400"><i className="bi bi-pencil-fill mr-1"></i> تعديل</button>
                            <button onClick={handleDeleteSProgramme} disabled={selectedSProgrammeId === null} className="bg-red-500 text-white px-3 py-1 rounded-md shadow hover:bg-red-600 text-sm disabled:bg-gray-400"><i className="bi bi-trash-fill mr-1"></i> حذف</button>
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
                                {db.T_SPROGRAMME.filter(sprog => sprog.ID_PROGRAMME === selectedProgrammeId).sort((a, b) => a.ID_SPROGRAMME - b.ID_SPROGRAMME).map(sprog => (
                                    <tr key={sprog.ID_SPROGRAMME} onClick={() => setSelectedSProgrammeId(sprog.ID_SPROGRAMME)} className={`border-b hover:bg-gray-50 cursor-pointer text-sm ${sprog.ID_SPROGRAMME === selectedSProgrammeId ? 'bg-blue-50' : ''}`}>
                                        <td className="p-3 text-gray-800">{sprog.SPROGRAMME}</td>
                                        <td className="p-3 text-gray-700">{sprog.INT_SPROGRAMME}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <Modal isOpen={isProgrammeModalOpen} onClose={() => setIsProgrammeModalOpen(false)} title={editingProgramme ? "تعديل برنامج" : "إضافة برنامج جديد"}>
                <AddProgrammeForm key={progFormKey} onClose={() => setIsProgrammeModalOpen(false)} onSave={handleSaveProgramme} initialData={editingProgramme} />
            </Modal>
            <Modal isOpen={isSProgrammeModalOpen} onClose={() => setIsSProgrammeModalOpen(false)} title={editingSProgramme ? "تعديل برنامج فرعي" : "إضافة برنامج فرعي جديد"}>
                <AddSProgrammeForm key={sprogFormKey} onClose={() => setIsSProgrammeModalOpen(false)} onSave={handleSaveSProgramme} initialData={editingSProgramme} programmes={db.T_PROGRAMME} selectedProgrammeId={selectedProgrammeId} />
            </Modal>
            <ConfirmActionModal
                isOpen={deleteConfirm.open}
                title="تأكيد الحذف"
                message={
                    deleteConfirm.type === 'prog'
                        ? 'هل أنت متأكد أنك تريد حذف هذا البرنامج؟ سيتم حذف جميع البرامج الفرعية المرتبطة به.'
                        : 'هل أنت متأكد أنك تريد حذف هذا البرنامج الفرعي؟'
                }
                onCancel={() => setDeleteConfirm({ open: false, type: null })}
                onConfirm={() => {
                    if (deleteConfirm.type === 'prog') confirmDeleteProgramme();
                    else confirmDeleteSProgramme();
                }}
            />
        </PageWrapper>
    );
};

export default ProgrammePage;
