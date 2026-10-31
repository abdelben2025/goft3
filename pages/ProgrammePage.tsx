
import React, { useState } from 'react';
import { Page, Programme, Sprogramme, User } from '../types';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';
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
    const { t } = useLanguage();
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
        showToast(t('prog.toast_saving'), 'loading');
        try {
            if ('ID_PROGRAMME' in data) {
                await updateItem('T_PROGRAMME', data.ID_PROGRAMME, data);
                showToast(t('prog.toast_edit_success'), 'success');
            } else {
                await addItem('T_PROGRAMME', data);
                showToast(t('prog.toast_add_success'), 'success');
            }
            setIsProgrammeModalOpen(false);
            setEditingProgramme(undefined);
        } catch (error) {
            showToast(t('prog.toast_save_error', { reason: errorMessage(error) }), 'error');
        }
    };

    const handleDeleteProgramme = () => {
        if (selectedProgrammeId === null) return;
        setDeleteConfirm({ open: true, type: 'prog' });
    };

    const confirmDeleteProgramme = async () => {
        setDeleteConfirm({ open: false, type: null });
        if (selectedProgrammeId === null) return;
        showToast(t('prog.toast_deleting'), 'loading');
        try {
            await deleteItem('T_PROGRAMME', selectedProgrammeId);
            const newProgrammes = db.T_PROGRAMME.filter(p => p.ID_PROGRAMME !== selectedProgrammeId);
            setSelectedProgrammeId(newProgrammes[0]?.ID_PROGRAMME || null);
            setSelectedSProgrammeId(null);
            showToast(t('prog.toast_delete_success'), 'success');
        } catch (error) {
            showToast(t('prog.toast_delete_error', { reason: errorMessage(error) }), 'error');
        }
    };

    // SProgramme CRUD
    const handleSaveSProgramme = async (data: Omit<Sprogramme, 'ID_SPROGRAMME'> | Sprogramme) => {
        showToast(t('prog.toast_saving_sprogram'), 'loading');
        try {
            if ('ID_SPROGRAMME' in data) {
                await updateItem('T_SPROGRAMME', data.ID_SPROGRAMME, data);
                showToast(t('prog.toast_edit_sprogram_success'), 'success');
            } else {
                await addItem('T_SPROGRAMME', data);
                showToast(t('prog.toast_add_sprogram_success'), 'success');
            }
            setIsSProgrammeModalOpen(false);
            setEditingSProgramme(undefined);
        } catch (error) {
            showToast(t('prog.toast_save_error', { reason: errorMessage(error) }), 'error');
        }
    };

    const handleDeleteSProgramme = () => {
        if (selectedSProgrammeId === null) return;
        setDeleteConfirm({ open: true, type: 'sprog' });
    };

    const confirmDeleteSProgramme = async () => {
        setDeleteConfirm({ open: false, type: null });
        if (selectedSProgrammeId === null) return;
        showToast(t('prog.toast_deleting'), 'loading');
        try {
            await deleteItem('T_SPROGRAMME', selectedSProgrammeId);
            setSelectedSProgrammeId(null);
            showToast(t('prog.toast_delete_sprogram_success'), 'success');
        } catch (error) {
            showToast(t('prog.toast_delete_error', { reason: errorMessage(error) }), 'error');
        }
    };

    if (loading) return <div>{t('loading')}</div>;

    return (
        <PageWrapper
            title={t('page.programme')}
            navigate={navigate}
            onGoBack={onGoBack}
            currentUser={currentUser}
        >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-4 rounded-lg shadow-md">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-gray-800">{t('prog.main_programmes')}</h3>
                        <div className="flex items-center gap-2">
                            <button onClick={() => { if(loading) { alert(t('op.alert_wait_loading')); return; } setEditingProgramme(undefined); setProgFormKey(p => p + 1); setIsProgrammeModalOpen(true); }} className="bg-green-500 text-white px-3 py-1 rounded-md shadow hover:bg-green-600 text-sm"><i className="bi bi-plus-circle mr-1"></i> {t('btn.add')}</button>
                            <button onClick={() => { if(loading) { alert(t('op.alert_wait_loading')); return; } const item = db.T_PROGRAMME.find(i=>i.ID_PROGRAMME === selectedProgrammeId); if(item) { setEditingProgramme(item); setProgFormKey(p => p + 1); setIsProgrammeModalOpen(true); } }} disabled={selectedProgrammeId === null} className="bg-yellow-500 text-white px-3 py-1 rounded-md shadow hover:bg-yellow-600 text-sm disabled:bg-gray-400"><i className="bi bi-pencil-fill mr-1"></i> {t('btn.edit')}</button>
                            <button onClick={handleDeleteProgramme} disabled={selectedProgrammeId === null} className="bg-red-500 text-white px-3 py-1 rounded-md shadow hover:bg-red-600 text-sm disabled:bg-gray-400"><i className="bi bi-trash-fill mr-1"></i> {t('btn.delete')}</button>
                        </div>
                    </div>
                     <div className="overflow-auto max-h-[calc(100vh-20rem)]">
                        <table className="w-full text-right">
                             <thead className="bg-blue-100 sticky top-0">
                                <tr>
                                    <th className="p-3 text-sm font-semibold text-gray-700">{t('col.code')}</th>
                                    <th className="p-3 text-sm font-semibold text-gray-700">{t('col.title')}</th>
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
                        <h3 className="text-xl font-bold text-gray-800">{t('prog.sub_programmes')}</h3>
                        <div className="flex items-center gap-2">
                            <button onClick={() => { if(loading) { alert(t('op.alert_wait_loading')); return; } setEditingSProgramme(undefined); setSprogFormKey(p => p + 1); setIsSProgrammeModalOpen(true); }} disabled={selectedProgrammeId === null} className="bg-green-500 text-white px-3 py-1 rounded-md shadow hover:bg-green-600 text-sm disabled:bg-gray-400"><i className="bi bi-plus-circle mr-1"></i> {t('btn.add')}</button>
                            <button onClick={() => { if(loading) { alert(t('op.alert_wait_loading')); return; } const item = db.T_SPROGRAMME.find(i=>i.ID_SPROGRAMME === selectedSProgrammeId); if(item) { setEditingSProgramme(item); setSprogFormKey(p => p + 1); setIsSProgrammeModalOpen(true); } }} disabled={selectedSProgrammeId === null} className="bg-yellow-500 text-white px-3 py-1 rounded-md shadow hover:bg-yellow-600 text-sm disabled:bg-gray-400"><i className="bi bi-pencil-fill mr-1"></i> {t('btn.edit')}</button>
                            <button onClick={handleDeleteSProgramme} disabled={selectedSProgrammeId === null} className="bg-red-500 text-white px-3 py-1 rounded-md shadow hover:bg-red-600 text-sm disabled:bg-gray-400"><i className="bi bi-trash-fill mr-1"></i> {t('btn.delete')}</button>
                        </div>
                    </div>
                     <div className="overflow-auto max-h-[calc(100vh-20rem)]">
                        <table className="w-full text-right">
                             <thead className="bg-blue-100 sticky top-0">
                                <tr>
                                    <th className="p-3 text-sm font-semibold text-gray-700">{t('col.code')}</th>
                                    <th className="p-3 text-sm font-semibold text-gray-700">{t('col.title')}</th>
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

            <Modal isOpen={isProgrammeModalOpen} onClose={() => setIsProgrammeModalOpen(false)} title={editingProgramme ? t('prog.edit_title') : t('prog.add_title')}>
                <AddProgrammeForm key={progFormKey} onClose={() => setIsProgrammeModalOpen(false)} onSave={handleSaveProgramme} initialData={editingProgramme} />
            </Modal>
            <Modal isOpen={isSProgrammeModalOpen} onClose={() => setIsSProgrammeModalOpen(false)} title={editingSProgramme ? t('prog.edit_sprogram_title') : t('prog.add_sprogram_title')}>
                <AddSProgrammeForm key={sprogFormKey} onClose={() => setIsSProgrammeModalOpen(false)} onSave={handleSaveSProgramme} initialData={editingSProgramme} programmes={db.T_PROGRAMME} selectedProgrammeId={selectedProgrammeId} />
            </Modal>
            <ConfirmActionModal
                isOpen={deleteConfirm.open}
                title={t('det.confirmDeleteTitle')}
                message={
                    deleteConfirm.type === 'prog'
                        ? t('prog.delete_confirm_message')
                        : t('prog.delete_sprogram_confirm_message')
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
