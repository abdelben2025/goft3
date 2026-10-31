
import React, { useState } from 'react';
import { Page, User } from '../types';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { errorMessage } from '../utils/errorMessage';
import PageWrapper from '../components/PageWrapper';
import Modal from '../components/Modal';
import ConfirmActionModal from '../components/ConfirmActionModal';
import AddUserForm from '../components/forms/AddUserForm';
import { hashPassword } from '../utils/authUtils';
import { insertUserRow, insertCloudUser, setUserPassword, CLOUD_USER_MISSING } from '../services/authService';
import { useLanguage } from '../context/LanguageContext';

const UsersPage: React.FC<{ navigate: (page: Page) => void, onGoBack?: () => void, currentUser: User }> = ({ navigate, onGoBack, currentUser }) => {
    const { db, loading, addItem, updateItem, deleteItem, isDbConfigured, isOnline, refreshData } = useData();
    const { showToast } = useToast();
    const { t } = useLanguage();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | undefined>(undefined);
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
    const [formKey, setFormKey] = useState(0);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

    const handleSaveUser = async (userData: Omit<User, 'ID_USER' | 'PASSWORD'> | User, plainPassword?: string) => {
        showToast(t('users.saving'), 'loading');
        try {
            // Cloud: the row is written first (without a hash) and the password
            // set afterwards via setUserPassword, which derives the hash
            // client-side and writes it to T_USER.PASSWORD.
            // Local: the SQLite row needs its own hash before it is written.
            const cloud = isDbConfigured && isOnline;
            const payload: Record<string, any> = { ...userData };

            if (!cloud && plainPassword) {
                payload.PASSWORD = await hashPassword(plainPassword);
            }

            if ('ID_USER' in userData) {
                await updateItem('T_USER', userData.ID_USER, payload);
                if (cloud && plainPassword) {
                    await setUserPassword(userData, plainPassword);
                }
                showToast(t('users.userUpdated'), 'success');
            } else {
                // Cloud rows must be inserted through Supabase directly: addItem
                // falls back to the local SQLite on any error, which would hand
                // us a workstation-only ID_USER the cloud never sees.
                const saved = cloud
                    ? await insertCloudUser(payload)
                    : await insertUserRow(
                        (rowPayload) => addItem('T_USER', rowPayload as any),
                        payload
                    );
                if (cloud && plainPassword) {
                    await setUserPassword(saved, plainPassword);
                }
                if (cloud) {
                    refreshData({ silent: true }).catch(() => { /* list refreshes on next tick */ });
                }
                showToast(t('users.userAdded'), 'success');
            }
            setIsModalOpen(false);
            setEditingUser(undefined);
        } catch (error: any) {
            console.error("Error saving user:", error);
            // Provide a clearer error message to the user
            let errorMessage = t('users.saveError');
            if (error && typeof error === 'object') {
                if (error.code === '23505') { // Unique violation
                    errorMessage = t('users.usernameExists');
                } else if (error.code === '23514') { // Check constraint violation
                    errorMessage = t('users.roleViewerRejected');
                } else if (error.code === CLOUD_USER_MISSING || error.message === CLOUD_USER_MISSING) {
                    errorMessage = t('users.cloudUserMissing');
                } else if (error.message) {
                    errorMessage += ' ' + t('users.errorDetails', { message: error.message });
                }
            }
            showToast(errorMessage, 'error');
        }
    };

    // Step 1: ask for confirmation ONLY (no delete yet)
    const handleDeleteUser = () => {
        if (selectedUserId === null) return;

        const userToDelete = db.T_USER.find(u => u.ID_USER === selectedUserId);
        const adminCount = db.T_USER.filter(u => u.ROLE === 'admin').length;
        if (userToDelete?.ROLE === 'admin' && adminCount <= 1) {
            alert(t('users.cannotDeleteLastAdmin'));
            return;
        }
        setIsDeleteConfirmOpen(true);
    };

    // Step 2: perform delete only after user confirms
    const confirmDeleteUser = async () => {
        setIsDeleteConfirmOpen(false);
        if (selectedUserId === null) return;
        showToast(t('users.deleting'), 'loading');
        try {
            await deleteItem('T_USER', selectedUserId);
            showToast(t('users.userDeleted'), 'success');
            setSelectedUserId(null);
        } catch (error) {
            console.error("Error deleting user", error);
            showToast(t('users.deleteError', { reason: errorMessage(error) }), 'error');
        }
    };

    const openAddModal = () => {
        if (loading) {
            alert(t('users.waitRefresh'));
            return;
        }
        setEditingUser(undefined);
        setFormKey(prev => prev + 1);
        setIsModalOpen(true);
    };

    const openEditModal = () => {
        if (loading) {
            alert(t('users.waitRefresh'));
            return;
        }
        if (selectedUserId === null) return;
        const userToEdit = db.T_USER.find(u => u.ID_USER === selectedUserId);
        if (userToEdit) {
            setEditingUser(userToEdit);
            setFormKey(prev => prev + 1);
            setIsModalOpen(true);
        }
    };

    const getRoleName = (role: string) => {
        switch (role) {
            case 'admin': return t('role.admin');
            case 'viewer': return t('role.viewer');
            default: return t('role.user');
        }
    };

    return (
        <PageWrapper
            title={t('page.users')}
            navigate={navigate}
            onGoBack={onGoBack}
            backPage="SETTINGS"
            currentUser={currentUser}
            actions={
                <div className="flex items-center gap-2">
                    <button onClick={openAddModal} className="bg-green-500 text-white px-4 py-2 rounded-lg shadow hover:bg-green-600">
                        <i className="bi bi-plus-circle mr-2"></i> {t('users.addUser')}
                    </button>
                    <button onClick={openEditModal} disabled={selectedUserId === null} className="bg-yellow-500 text-white px-4 py-2 rounded-lg shadow hover:bg-yellow-600 disabled:bg-gray-400">
                        <i className="bi bi-pencil-fill mr-2"></i> {t('btn.edit')}
                    </button>
                    <button onClick={handleDeleteUser} disabled={selectedUserId === null} className="bg-red-500 text-white px-4 py-2 rounded-lg shadow hover:bg-red-600 disabled:bg-gray-400">
                        <i className="bi bi-trash-fill mr-2"></i> {t('btn.delete')}
                    </button>
                </div>
            }
        >
            <div className="bg-white p-4 rounded-lg shadow-md overflow-auto max-h-[calc(100vh-16rem)]">
                <table className="w-full text-right min-w-[600px]">
                    <thead className="bg-blue-100">
                        <tr>
                            <th className="p-3 text-sm font-semibold text-gray-700">{t('col.username')}</th>
                            <th className="p-3 text-sm font-semibold text-gray-700">{t('col.role')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {db.T_USER.slice().sort((a, b) => a.ID_USER - b.ID_USER).map(user => (
                            <tr key={user.ID_USER} onClick={() => setSelectedUserId(user.ID_USER)} className={`border-b hover:bg-gray-50 cursor-pointer text-sm ${selectedUserId === user.ID_USER ? 'bg-blue-50' : ''}`}>
                                <td className="p-3 font-semibold text-gray-800">{user.USERNAME}</td>
                                <td className="p-3 text-gray-700">{getRoleName(user.ROLE)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingUser ? t('users.editUserTitle') : t('users.addUserTitle')}>
                <AddUserForm key={formKey} onClose={() => setIsModalOpen(false)} onSave={handleSaveUser} initialData={editingUser} />
            </Modal>
            <ConfirmActionModal
                isOpen={isDeleteConfirmOpen}
                title={t('users.confirmDeleteTitle')}
                message={t('users.confirmDeleteMsg')}
                onCancel={() => setIsDeleteConfirmOpen(false)}
                onConfirm={confirmDeleteUser}
            />
        </PageWrapper>
    );
};

export default UsersPage;
