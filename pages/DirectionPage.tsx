
import React, { useState } from 'react';
import { Page, Direction, User } from '../types';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';
import { errorMessage } from '../utils/errorMessage';
import PageWrapper from '../components/PageWrapper';
import Modal from '../components/Modal';
import ConfirmActionModal from '../components/ConfirmActionModal';
import AddDirectionForm from '../components/forms/AddDirectionForm';

interface DirectionPageProps {
    navigate: (page: Page) => void;
    onGoBack?: () => void;
    currentUser: User;
}

const DirectionPage: React.FC<DirectionPageProps> = ({ navigate, onGoBack, currentUser }) => {
    const { db, loading, addItem, updateItem, deleteItem } = useData();
    const { showToast } = useToast();
    const { t } = useLanguage();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDirection, setEditingDirection] = useState<Direction | undefined>(undefined);
    const [selectedDirectionId, setSelectedDirectionId] = useState<number | null>(null);
    const [formKey, setFormKey] = useState(0);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

    const handleSaveDirection = async (data: Omit<Direction, 'ID_DIRECTION'> | Direction) => {
        showToast(t('dir.toast_saving'), 'loading');
        try {
            if ('ID_DIRECTION' in data) {
                await updateItem('T_DIRECTION', data.ID_DIRECTION, data);
                showToast(t('dir.toast_edit_success'), 'success');
            } else {
                await addItem('T_DIRECTION', data);
                showToast(t('dir.toast_add_success'), 'success');
            }
            setIsModalOpen(false);
            setEditingDirection(undefined);
        } catch (error) {
            showToast(t('dir.toast_save_error', { reason: errorMessage(error) }), 'error');
        }
    };

    const handleDeleteDirection = () => {
        if (selectedDirectionId === null) return;
        setIsDeleteConfirmOpen(true);
    };

    const confirmDeleteDirection = async () => {
        setIsDeleteConfirmOpen(false);
        if (selectedDirectionId === null) return;
        showToast(t('dir.toast_deleting'), 'loading');
        try {
            await deleteItem('T_DIRECTION', selectedDirectionId);
            setSelectedDirectionId(null);
            showToast(t('dir.toast_delete_success'), 'success');
        } catch (error) {
            showToast(t('dir.toast_delete_error', { reason: errorMessage(error) }), 'error');
        }
    };
    
    const openAddModal = () => {
        if (loading) {
            alert(t('op.alert_wait_loading'));
            return;
        }
        setEditingDirection(undefined);
        setFormKey(prev => prev + 1);
        setIsModalOpen(true);
    };

    const openEditModal = () => {
        if (loading) {
            alert(t('op.alert_wait_loading'));
            return;
        }
        if (selectedDirectionId === null) return;
        const directionToEdit = db.T_DIRECTION.find(d => d.ID_DIRECTION === selectedDirectionId);
        if (directionToEdit) {
            setEditingDirection(directionToEdit);
            setFormKey(prev => prev + 1);
            setIsModalOpen(true);
        }
    };

    if (loading) return <div>{t('loading')}</div>;

    return (
        <PageWrapper
            title={t('page.direction')}
            navigate={navigate}
            onGoBack={onGoBack}
            backPage="SETTINGS"
            currentUser={currentUser}
            actions={
                <div className="flex items-center gap-2">
                    <button onClick={openAddModal} className="bg-green-500 text-white px-4 py-2 rounded-lg shadow hover:bg-green-600 transition-colors">
                        <i className="bi bi-plus-circle mr-2"></i> {t('dir.add_direction')}
                    </button>
                    <button onClick={openEditModal} disabled={selectedDirectionId === null} className="bg-yellow-500 text-white px-4 py-2 rounded-lg shadow hover:bg-yellow-600 transition-colors disabled:bg-gray-400">
                        <i className="bi bi-pencil-fill mr-2"></i> {t('btn.edit')}
                    </button>
                    <button onClick={handleDeleteDirection} disabled={selectedDirectionId === null} className="bg-red-500 text-white px-4 py-2 rounded-lg shadow hover:bg-red-600 transition-colors disabled:bg-gray-400">
                        <i className="bi bi-trash-fill mr-2"></i> {t('btn.delete')}
                    </button>
                </div>
            }
        >
            <div className="bg-white p-4 rounded-lg shadow-md overflow-auto max-h-[calc(100vh-16rem)]">
                <table className="w-full text-right min-w-[900px]">
                    <thead className="bg-blue-100">
                        <tr>
                            <th className="p-3 text-sm font-semibold text-gray-700">{t('dir.direction')}</th>
                            <th className="p-3 text-sm font-semibold text-gray-700">{t('col.portfolio')}</th>
                            <th className="p-3 text-sm font-semibold text-gray-700">{t('col.portfolio_title')}</th>
                            <th className="p-3 text-sm font-semibold text-gray-700">{t('col.ordonnateur')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {db.T_DIRECTION.slice().sort((a, b) => a.ID_DIRECTION - b.ID_DIRECTION).map((d: Direction) => (
                            <tr key={d.ID_DIRECTION} onClick={() => setSelectedDirectionId(d.ID_DIRECTION)} className={`border-b hover:bg-gray-50 cursor-pointer text-sm ${selectedDirectionId === d.ID_DIRECTION ? 'bg-blue-50' : ''}`}>
                                <td className="p-3 font-semibold text-gray-800">{d.DIRECTION}</td>
                                <td className="p-3 text-gray-700">{d.PORTEFEUILLE}</td>
                                <td className="p-3 text-gray-700">{d.INT_PORTEFEUILLE}</td>
                                <td className="p-3 text-gray-700">{d.ORDONATEUR}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingDirection ? t('dir.edit_title') : t('dir.add_title')}>
                <AddDirectionForm key={formKey} onClose={() => setIsModalOpen(false)} onSave={handleSaveDirection} initialData={editingDirection} />
            </Modal>
            <ConfirmActionModal
                isOpen={isDeleteConfirmOpen}
                title={t('dir.delete_confirm_title')}
                message={t('dir.delete_confirm_message')}
                onCancel={() => setIsDeleteConfirmOpen(false)}
                onConfirm={confirmDeleteDirection}
            />
        </PageWrapper>
    );
};

export default DirectionPage;
