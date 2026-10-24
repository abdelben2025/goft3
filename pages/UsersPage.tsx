
import React, { useState } from 'react';
import { Page, User } from '../types';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { errorMessage } from '../utils/errorMessage';
import PageWrapper from '../components/PageWrapper';
import Modal from '../components/Modal';
import ConfirmActionModal from '../components/ConfirmActionModal';
import AddUserForm from '../components/forms/AddUserForm';

const UsersPage: React.FC<{ navigate: (page: Page) => void, onGoBack?: () => void, currentUser: User }> = ({ navigate, onGoBack, currentUser }) => {
    const { db, loading, addItem, updateItem, deleteItem } = useData();
    const { showToast } = useToast();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | undefined>(undefined);
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
    const [formKey, setFormKey] = useState(0);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

    const handleSaveUser = async (userData: Omit<User, 'ID_USER'> | User) => {
        showToast('جاري حفظ البيانات...', 'loading');
        try {
            if ('ID_USER' in userData) {
                await updateItem('T_USER', userData.ID_USER, userData);
                showToast('تم تعديل المستخدم بنجاح', 'success');
            } else {
                await addItem('T_USER', userData);
                showToast('تمت إضافة المستخدم بنجاح', 'success');
            }
            setIsModalOpen(false);
            setEditingUser(undefined);
        } catch (error: any) {
            console.error("Error saving user:", error);
            // Provide a clearer error message to the user
            let errorMessage = "حدث خطأ أثناء حفظ المستخدم.";
            if (error && typeof error === 'object') {
                if (error.code === '23505') { // Unique violation
                    errorMessage = "اسم المستخدم موجود بالفعل.";
                } else if (error.code === '23514') { // Check constraint violation
                    errorMessage = "تنبيه: قاعدة البيانات ترفض إضافة دور 'ملاحظ'.\nيرجى الذهاب إلى صفحة الإعدادات -> عرض كود SQL ونسخ الكود لتحديث قاعدة البيانات.";
                } else if (error.message) {
                    errorMessage += ` التفاصيل: ${error.message}`;
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
            alert('لا يمكن حذف آخر مسؤول في النظام.');
            return;
        }
        setIsDeleteConfirmOpen(true);
    };

    // Step 2: perform delete only after user confirms
    const confirmDeleteUser = async () => {
        setIsDeleteConfirmOpen(false);
        if (selectedUserId === null) return;
        showToast('جاري الحذف...', 'loading');
        try {
            await deleteItem('T_USER', selectedUserId);
            showToast('تم حذف المستخدم بنجاح', 'success');
            setSelectedUserId(null);
        } catch (error) {
            console.error("Error deleting user", error);
            showToast(`حدث خطأ أثناء حذف المستخدم — السبب: ${errorMessage(error)}`, 'error');
        }
    };

    const openAddModal = () => {
        if (loading) {
            alert("يجب الانتظار حتى يتم تحديث النافذة");
            return;
        }
        setEditingUser(undefined);
        setFormKey(prev => prev + 1);
        setIsModalOpen(true);
    };

    const openEditModal = () => {
        if (loading) {
            alert("يجب الانتظار حتى يتم تحديث النافذة");
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
            case 'admin': return 'مسؤول';
            case 'viewer': return 'ملاحظ';
            default: return 'مستخدم';
        }
    };

    return (
        <PageWrapper
            title="إدارة المستخدمين"
            navigate={navigate}
            onGoBack={onGoBack}
            backPage="SETTINGS"
            currentUser={currentUser}
            actions={
                <div className="flex items-center gap-2">
                    <button onClick={openAddModal} className="bg-green-500 text-white px-4 py-2 rounded-lg shadow hover:bg-green-600">
                        <i className="bi bi-plus-circle mr-2"></i> إضافة مستخدم
                    </button>
                    <button onClick={openEditModal} disabled={selectedUserId === null} className="bg-yellow-500 text-white px-4 py-2 rounded-lg shadow hover:bg-yellow-600 disabled:bg-gray-400">
                        <i className="bi bi-pencil-fill mr-2"></i> تعديل
                    </button>
                    <button onClick={handleDeleteUser} disabled={selectedUserId === null} className="bg-red-500 text-white px-4 py-2 rounded-lg shadow hover:bg-red-600 disabled:bg-gray-400">
                        <i className="bi bi-trash-fill mr-2"></i> حذف
                    </button>
                </div>
            }
        >
            <div className="bg-white p-4 rounded-lg shadow-md overflow-auto max-h-[calc(100vh-16rem)]">
                <table className="w-full text-right min-w-[600px]">
                    <thead className="bg-blue-100">
                        <tr>
                            <th className="p-3 text-sm font-semibold text-gray-700">اسم المستخدم</th>
                            <th className="p-3 text-sm font-semibold text-gray-700">الدور</th>
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
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingUser ? 'تعديل مستخدم' : 'إضافة مستخدم جديد'}>
                <AddUserForm key={formKey} onClose={() => setIsModalOpen(false)} onSave={handleSaveUser} initialData={editingUser} />
            </Modal>
            <ConfirmActionModal
                isOpen={isDeleteConfirmOpen}
                title="تأكيد حذف المستخدم"
                message="هل أنت متأكد أنك تريد حذف هذا المستخدم؟ لا يمكن التراجع عن هذا الإجراء."
                onCancel={() => setIsDeleteConfirmOpen(false)}
                onConfirm={confirmDeleteUser}
            />
        </PageWrapper>
    );
};

export default UsersPage;
