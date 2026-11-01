
import React, { useState } from 'react';
import { Page, Rubrique, User } from '../types';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';
import { errorMessage } from '../utils/errorMessage';
import { pickLocalLabel } from '../utils/dataLabels';
import PageWrapper from '../components/PageWrapper';
import Modal from '../components/Modal';
import ConfirmActionModal from '../components/ConfirmActionModal';
import AddRubriqueForm from '../components/forms/AddRubriqueForm';

interface RubriquePageProps {
    navigate: (page: Page) => void;
    onGoBack?: () => void;
    currentUser: User;
}

const RubriquePage: React.FC<RubriquePageProps> = ({ navigate, onGoBack, currentUser }) => {
    const { db, loading, addItem, updateItem, deleteItem } = useData();
    const { showToast } = useToast();
    const { t, language } = useLanguage();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRubrique, setEditingRubrique] = useState<Rubrique | undefined>(undefined);
    const [selectedRubriqueId, setSelectedRubriqueId] = useState<number | null>(null);
    const [formKey, setFormKey] = useState(0);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

    const handleSaveRubrique = async (rubriqueData: Omit<Rubrique, 'ID_RUBRIQUE'> | Rubrique) => {
        showToast(t('rub.toast_saving'), 'loading');
        try {
            if ('ID_RUBRIQUE' in rubriqueData) {
                await updateItem('T_RUBRIQUE', rubriqueData.ID_RUBRIQUE, rubriqueData);
                showToast(t('rub.toast_edit_success'), 'success');
            } else {
                await addItem('T_RUBRIQUE', rubriqueData);
                showToast(t('rub.toast_add_success'), 'success');
            }
            setIsModalOpen(false);
            setEditingRubrique(undefined);
        } catch (error) {
            showToast(t('rub.toast_save_error', { reason: errorMessage(error) }), 'error');
        }
    };

    const handleDeleteRubrique = () => {
        if (selectedRubriqueId === null) return;
        setIsDeleteConfirmOpen(true);
    };

    const confirmDeleteRubrique = async () => {
        setIsDeleteConfirmOpen(false);
        if (selectedRubriqueId === null) return;
        showToast(t('rub.toast_deleting'), 'loading');
        try {
            await deleteItem('T_RUBRIQUE', selectedRubriqueId);
            setSelectedRubriqueId(null);
            showToast(t('rub.toast_delete_success'), 'success');
        } catch (error) {
            showToast(t('rub.toast_delete_error', { reason: errorMessage(error) }), 'error');
        }
    };

    const openAddModal = () => {
        if (loading) {
            alert(t('op.alert_wait_loading'));
            return;
        }
        setEditingRubrique(undefined);
        setFormKey(prev => prev + 1);
        setIsModalOpen(true);
    };

    const openEditModal = () => {
        if (loading) {
            alert(t('op.alert_wait_loading'));
            return;
        }
        if (selectedRubriqueId === null) return;
        const rubriqueToEdit = db.T_RUBRIQUE.find(r => r.ID_RUBRIQUE === selectedRubriqueId);
        if (rubriqueToEdit) {
            setEditingRubrique(rubriqueToEdit);
            setFormKey(prev => prev + 1);
            setIsModalOpen(true);
        }
    };

    if (loading) return <div>{t('loading')}</div>;

    return (
        <PageWrapper
            title={t('page.rubrique')}
            navigate={navigate}
            onGoBack={onGoBack}
            backPage="SETTINGS"
            currentUser={currentUser}
            actions={
                <div className="flex items-center gap-2">
                    <button onClick={openAddModal} className="bg-green-500 text-white px-4 py-2 rounded-lg shadow hover:bg-green-600 transition-colors">
                        <i className="bi bi-plus-circle mr-2"></i> {t('rub.add_structure')}
                    </button>
                    <button onClick={openEditModal} disabled={selectedRubriqueId === null} className="bg-yellow-500 text-white px-4 py-2 rounded-lg shadow hover:bg-yellow-600 transition-colors disabled:bg-gray-400">
                        <i className="bi bi-pencil-fill mr-2"></i> {t('btn.edit')}
                    </button>
                    <button onClick={handleDeleteRubrique} disabled={selectedRubriqueId === null} className="bg-red-500 text-white px-4 py-2 rounded-lg shadow hover:bg-red-600 transition-colors disabled:bg-gray-400">
                        <i className="bi bi-trash-fill mr-2"></i> {t('btn.delete')}
                    </button>
                </div>
            }
        >
            <div className="bg-white p-4 rounded-lg shadow-md overflow-auto max-h-[calc(100vh-16rem)]">
                <table className="w-full text-right">
                    <thead className="bg-blue-100">
                        <tr>
                            <th className="p-3 text-sm font-semibold text-gray-700 uppercase tracking-wider">{t('col.id')}</th>
                            <th className="p-3 text-sm font-semibold text-gray-700 uppercase tracking-wider">{t('col.title')}</th>
                            <th className="p-3 text-sm font-semibold text-gray-700 uppercase tracking-wider">{t('rub.name_fr_label')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {db.T_RUBRIQUE.slice().sort((a, b) => a.ID_RUBRIQUE - b.ID_RUBRIQUE).map(r => (
                            <tr key={r.ID_RUBRIQUE} onClick={() => setSelectedRubriqueId(r.ID_RUBRIQUE)} className={`border-b hover:bg-gray-50 cursor-pointer text-sm ${selectedRubriqueId === r.ID_RUBRIQUE ? 'bg-blue-50' : ''}`}>
                                <td className="p-3 text-gray-700">{r.ID_RUBRIQUE}</td>
                                <td className="p-3 font-semibold text-gray-800">{pickLocalLabel(r, 'RUBRIQUE', 'RUBRIQUE_FR', '', language)}</td>
                                <td className="p-3 text-gray-700">{r.RUBRIQUE_FR || ''}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
             <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingRubrique(undefined); }} title={editingRubrique ? t('rub.edit_title') : t('rub.add_title')}>
                <AddRubriqueForm key={formKey} onClose={() => { setIsModalOpen(false); setEditingRubrique(undefined); }} onSave={handleSaveRubrique} initialData={editingRubrique} />
            </Modal>
            <ConfirmActionModal
                isOpen={isDeleteConfirmOpen}
                title={t('rub.delete_confirm_title')}
                message={t('rub.delete_confirm_message')}
                onCancel={() => setIsDeleteConfirmOpen(false)}
                onConfirm={confirmDeleteRubrique}
            />
        </PageWrapper>
    );
};

export default RubriquePage;
