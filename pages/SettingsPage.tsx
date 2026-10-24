
import React, { useState, useRef } from 'react';
import { Page, User, APP_VERSION } from '../types';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { errorMessage } from '../utils/errorMessage';
import { useLanguage } from '../context/LanguageContext';
import PageWrapper from '../components/PageWrapper';
import Modal from '../components/Modal';
import ConfirmActionModal from '../components/ConfirmActionModal';
import AddUserForm from '../components/forms/AddUserForm';
import { checkForUpdates, performUpdate } from '../utils/updateService';
import { motion, AnimatePresence } from 'framer-motion';
import { tauriDb, isTauri } from '../services/tauriService';
import { supabase } from '../services/supabaseClient';

const EXPORT_TABLES = [
    'T_USER', 'T_BENEFICIAIRE', 'T_CATEGORIE', 'T_DIRECTION', 'T_PROGRAMME',
    'T_RUBRIQUE', 'T_SCATEGORIE', 'T_SPROGRAMME', 'T_OPERATION', 'T_CP',
    'T_LOT_OPERATION', 'T_RUBRIQUE_OP', 'T_SCATEGORIE_OP', 'T_PIECE', 'T_ENGAGEMENT',
    'T_ODS', 'T_LOT_PIECE', 'T_PAIEMENT', 'T_COMPTE_BANCAIRE', 'T_BORDEREAU',
];

interface SettingsPageProps {
    navigate: (page: Page, operationId?: number) => void;
    onGoBack?: () => void;
    currentUser: User;
}

type SettingsTab = 'general' | 'users' | 'tables';

const SettingsPage: React.FC<SettingsPageProps> = ({ navigate, onGoBack, currentUser }) => {
    const { db, loading, addItem, updateItem, deleteItem, resetDatabase, importDatabase, saveConfig, resetConfig, isOnline, isDbConfigured } = useData();
    const { showToast } = useToast();
    const { t } = useLanguage();
    
    const [activeTab, setActiveTab ] = useState<SettingsTab>('general');
    
    // System Settings States
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [setupUrl, setSetupUrl] = useState('');
    const [setupKey, setSetupKey] = useState('');
    const [checkingUpdate, setCheckingUpdate] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

    // User Management States
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | undefined>(undefined);
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
    const [formKey, setFormKey] = useState(0);

    const isAdmin = currentUser.ROLE === 'admin';

    // User Actions
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
            setIsUserModalOpen(false);
            setEditingUser(undefined);
        } catch (error: any) {
            console.error("Error saving user:", error);
            let errorMessage = "حدث خطأ أثناء حفظ المستخدم.";
            if (error && typeof error === 'object') {
                if (error.code === '23505') errorMessage = "اسم المستخدم موجود بالفعل.";
                else if (error.code === '23514') errorMessage = "تنبيه: قاعدة البيانات ترفض إضافة دور 'ملاحظ'. يرجى تحديث SQL.";
                else if (error.message) errorMessage += ` التفاصيل: ${error.message}`;
            }
            showToast(errorMessage, 'error');
        }
    };

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

    const confirmDeleteUser = async () => {
        setIsDeleteConfirmOpen(false);
        if (selectedUserId === null) return;
        showToast('جاري الحذف...', 'loading');
        try {
            await deleteItem('T_USER', selectedUserId);
            showToast('تم حذف المستخدم بنجاح', 'success');
            setSelectedUserId(null);
        } catch (error) {
            showToast(`حدث خطأ أثناء حذف المستخدم — السبب: ${errorMessage(error)}`, 'error');
        }
    };

    const openAddUserModal = () => {
        if (loading) return;
        setEditingUser(undefined);
        setFormKey(prev => prev + 1);
        setIsUserModalOpen(true);
    };

    const openEditUserModal = () => {
        if (loading || selectedUserId === null) return;
        const userToEdit = db.T_USER.find(u => u.ID_USER === selectedUserId);
        if (userToEdit) {
            setEditingUser(userToEdit);
            setFormKey(prev => prev + 1);
            setIsUserModalOpen(true);
        }
    };

    const getRoleName = (role: string) => {
        switch (role) {
            case 'admin': return 'مسؤول';
            case 'viewer': return 'ملاحظ';
            default: return 'مستخدم';
        }
    };

    // System Config Logic
    const handleCheckUpdate = async () => {
        setCheckingUpdate(true);
        try {
            const updateInfo = await checkForUpdates();
            if (!updateInfo) {
                showToast('تعذر التحقق من التحديثات حاليًا.', 'error');
            } else if (updateInfo.notSupported) {
                showToast(`التحديث التلقائي متاح فقط في تطبيق سطح المكتب (Tauri). إصدارك الحالي: ${updateInfo.latestVersion}`, 'info');
            } else if (updateInfo.offline) {
                showToast('لا يوجد اتصال بالإنترنت للتحقق من التحديثات.', 'error');
            } else if (updateInfo.checkFailed) {
                if (updateInfo.noReleases) {
                    showToast('لا توجد إصدارات منشورة بعد. انشر إصدارًا لتفعيل التحديث التلقائي.', 'info');
                } else {
                    showToast('تعذر الوصول لخادم التحديثات. تحقق من الاتصال ثم أعد المحاولة.', 'error');
                }
            } else if (updateInfo.hasUpdate) {
                if (window.confirm(`يوجد إصدار جديد متاح (${updateInfo.latestVersion}). هل تريد تنزيله وتطبيقه الآن؟ سيتم إعادة تشغيل التطبيق.`)) {
                    setDownloadProgress(0);
                    showToast('جارٍ تنزيل التحديث وتطبيقه...', 'loading');
                    try {
                        await performUpdate((pct) => setDownloadProgress(pct));
                    } catch (updErr) {
                        setDownloadProgress(null);
                        showToast(`تعذر التحديث — السبب: ${errorMessage(updErr)}`, 'error');
                    }
                }
            } else {
                showToast(`أنت تستخدم أحدث إصدار حالياً (${updateInfo.latestVersion})`, 'success');
            }
        } catch (checkErr) {
            showToast(`فشل التحقق من التحديثات — السبب: ${errorMessage(checkErr)}`, 'error');
        } finally {
            setCheckingUpdate(false);
        }
    };

    // ── Encrypted backup (passphrase) ──
    const [passModal, setPassModal] = useState<null | { mode: 'export'; path: string; data: string } | { mode: 'import'; path: string }>(null);
    const [pass1, setPass1] = useState('');
    const [pass2, setPass2] = useState('');
    const [passError, setPassError] = useState('');
    const [passBusy, setPassBusy] = useState(false);

    const applyImportedJson = async (json: any) => {
        try {
            await importDatabase(json);
            showToast("تم استيراد قاعدة البيانات بنجاح", 'success');
        } catch (impErr) {
            showToast(`فشل استيراد قاعدة البيانات — السبب: ${errorMessage(impErr)}`, 'error');
        }
    };

    const handleExport = async () => {
        const dataStr = JSON.stringify(db, null, 2);
        const fileName = `goft3_backup_${new Date().toISOString().split('T')[0]}.goft3bak`;

        if (isTauri()) {
            try {
                const { save } = await import('@tauri-apps/plugin-dialog');
                const path = await save({
                    defaultPath: fileName,
                    filters: [{ name: 'نسخة احتياطية مشفّرة GOFT3', extensions: ['goft3bak', 'json'] }],
                    title: 'حفظ نسخة احتياطية مشفّرة من قاعدة البيانات',
                });
                if (!path) return; // user cancelled
                setPass1('');
                setPass2('');
                setPassError('');
                setPassModal({ mode: 'export', path, data: dataStr });
            } catch (err: any) {
                console.error('Tauri export failed:', err);
                showToast(`فشل تصدير قاعدة البيانات — السبب: ${errorMessage(err)}`, 'error');
            }
            return;
        }

        // Web / Electron fallback (no native crypto available in the browser)
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = fileName;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        showToast("تم تصدير قاعدة البيانات بنجاح", 'success');
    };

    const handleImport = async (event?: React.ChangeEvent<HTMLInputElement>) => {
        if (isTauri()) {
            try {
                const { open } = await import('@tauri-apps/plugin-dialog');
                const selected = await open({
                    multiple: false,
                    filters: [{ name: 'نسخة احتياطية GOFT3', extensions: ['goft3bak', 'json'] }],
                    title: 'اختيار ملف استيراد قاعدة البيانات',
                });
                const path = typeof selected === 'string' ? selected : selected?.[0];
                if (!path) return; // user cancelled
                try {
                    const content = await tauriDb.readBackup(path, '');
                    await applyImportedJson(JSON.parse(content));
                } catch (firstErr: any) {
                    const msg = typeof firstErr === 'string' ? firstErr : errorMessage(firstErr);
                    if (msg.includes('PASSPHRASE_REQUIRED')) {
                        // Legacy plain JSON would have succeeded — this file is encrypted
                        setPass1('');
                        setPass2('');
                        setPassError('');
                        setPassModal({ mode: 'import', path });
                        return;
                    }
                    throw firstErr;
                }
            } catch (err: any) {
                console.error('Tauri import failed:', err);
                const msg = errorMessage(err);
                if (msg === 'WRONG_PASSPHRASE') {
                    showToast('كلمة المرور غير صحيحة — لم يتم فتح النسخة الاحتياطية', 'error');
                    return;
                }
                showToast(`فشل قراءة ملف الاستيراد. تأكد من أنه ملف نسخة احتياطية صالح — السبب: ${msg}`, 'error');
            }
            return;
        }

        // Web fallback: plain JSON file
        const file = event?.target?.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            await applyImportedJson(JSON.parse(text));
        } catch (parseErr) {
            showToast(`فشل استيراد الملف. تأكد من أنه ملف JSON صالح — السبب: ${errorMessage(parseErr)}`, 'error');
        } finally {
            if (event?.target) event.target.value = '';
        }
    };

    const handlePassModalSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!passModal) return;
        setPassError('');
        if (pass1.trim().length < 6) {
            setPassError('كلمة السر يجب أن تكون 6 أحرف على الأقل');
            return;
        }
        if (passModal.mode === 'export' && pass1 !== pass2) {
            setPassError('كلمتا السر غير متطابقتين');
            return;
        }
        setPassBusy(true);
        try {
            if (passModal.mode === 'export') {
                await tauriDb.saveBackup(passModal.data, passModal.path, pass1.trim());
                showToast(`تم حفظ النسخة الاحتياطية المشفّرة في:\n${passModal.path}`, 'success');
                setPassModal(null);
            } else {
                const content = await tauriDb.readBackup(passModal.path, pass1.trim());
                await applyImportedJson(JSON.parse(content));
                setPassModal(null);
            }
        } catch (err: any) {
            const msg = errorMessage(err);
            if (msg === 'WRONG_PASSPHRASE') {
                setPassError('كلمة المرور غير صحيحة');
            } else {
                setPassError(msg);
            }
        } finally {
            setPassBusy(false);
        }
    };

    const handleExportSqlite = async () => {
        if (!isTauri()) {
            showToast('تصدير ملف SQLite متاح فقط في تطبيق سطح المكتب.', 'error');
            return;
        }
        if (!supabase || !isOnline || !isDbConfigured) {
            showToast('يتطلب التصدير اتصالاً مباشراً بقاعدة Supabase السحابية.', 'error');
            return;
        }

        try {
            showToast('جارٍ جلب كل السجلات من Supabase...', 'info');

            // Fetch ALL rows from Supabase (paged) for every table
            const fetchAllRows = async (table: string): Promise<any[]> => {
                const allData: any[] = [];
                let from = 0;
                const limit = 1000;
                for (;;) {
                    const { data, error } = await supabase!
                        .from(table)
                        .select('*')
                        .range(from, from + limit - 1);
                    if (error) throw new Error(`${table}: ${error.message}`);
                    if (!data || data.length === 0) break;
                    allData.push(...data);
                    if (data.length < limit) break;
                    from += limit;
                }
                return allData;
            };

            const results = await Promise.all(EXPORT_TABLES.map(fetchAllRows));
            const payload: Record<string, any[]> = {};
            EXPORT_TABLES.forEach((table, i) => {
                payload[table] = results[i];
            });

            const totalRows = results.reduce((sum, rows) => sum + rows.length, 0);
            if (totalRows === 0) {
                showToast('قاعدة Supabase فارغة — لا توجد سجلات للتصدير.', 'error');
                return;
            }

            const { save } = await import('@tauri-apps/plugin-dialog');
            const date = new Date().toISOString().split('T')[0];
            const path = await save({
                defaultPath: `goft3_local_${date}.db`,
                filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite'] }],
                title: 'تصدير قاعدة Supabase إلى SQLite',
            });
            if (!path) return;

            const inserted = await tauriDb.exportSupabaseSqlite(path, payload);
            const perTable = EXPORT_TABLES
                .map((t, i) => `${t}: ${results[i].length}`)
                .filter((_, i) => results[i].length > 0)
                .join(' | ');

            showToast(
                `تم تصدير ${inserted} سجل من Supabase إلى SQLite بنجاح.\nالملف: ${path}\n${perTable}`,
                'success'
            );
        } catch (err: any) {
            console.error('Supabase → SQLite export failed:', err);
            showToast(`فشل التصدير من Supabase: ${err?.message || err}`, 'error');
        }
    };

    const handleResetDatabase = async () => {
        if (!window.confirm('خطر! سيؤدي هذا لتفريغ كافة الجداول. هل أنت متأكد؟')) return;
        try {
            await resetDatabase();
            showToast("تم مسح قاعدة البيانات بنجاح", 'success');
        } catch (resetErr) {
            showToast(`حدث خطأ أثناء مسح قاعدة البيانات — السبب: ${errorMessage(resetErr)}`, 'error');
        }
    };

    const handleSaveConfig = (e: React.FormEvent) => {
        e.preventDefault();
        if (window.confirm('سيتم إعادة تحميل التطبيق لحفظ الإعدادات. هل أنت متأكد؟')) {
            saveConfig(setupUrl, setupKey);
            setIsConfigOpen(false);
        }
    };

    const tabs: {id: SettingsTab, label: string, icon: string}[] = [
        { id: 'general', label: 'الإعدادات العامة', icon: 'bi-gear-wide-connected' },
        { id: 'users', label: 'إدارة المستخدمين', icon: 'bi-people-fill' },
        { id: 'tables', label: 'الجداول الأساسية', icon: 'bi-table' }
    ];

    return (
        <PageWrapper title={t('page.settings')} navigate={navigate} onGoBack={onGoBack} currentUser={currentUser} breadcrumb={[]}>
            
            {/* Tab Navigation */}
            <div className="flex border-b border-gray-200 mb-6 overflow-x-auto no-scrollbar">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-6 py-3 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${
                            activeTab === tab.id 
                                ? 'border-blue-600 text-blue-600 bg-blue-50' 
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                        <i className={`bi ${tab.icon}`}></i>
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="min-h-[50vh]">
                <AnimatePresence mode="wait">
                    {activeTab === 'general' && (
                        <motion.div 
                            key="general" 
                            initial={{ opacity: 0, x: 20 }} 
                            animate={{ opacity: 1, x: 0 }} 
                            exit={{ opacity: 0, x: -20 }}
                            className="grid grid-cols-1 md:grid-cols-2 gap-6"
                        >
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                <h3 className="text-xl font-bold mb-4 text-blue-800 flex items-center gap-2">
                                    <i className="bi bi-cloud-check-fill"></i>
                                    {t('btn.cloud_management')}
                                </h3>
                                <div className="space-y-3">
                                    <p className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg border border-blue-100 mb-4">
                                        يعمل التطبيق حالياً بنظام المزامنة السحابية. يتم حفظ التغييرات فورياً وآلياً.
                                    </p>

                                    <div className="grid grid-cols-1 gap-2">
                                        <button onClick={() => setIsConfigOpen(true)} className="flex items-center gap-2 w-full bg-white border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
                                            <i className="bi bi-link-45deg text-blue-600"></i> {t('btn.db_settings')}
                                        </button>

                                        <button onClick={handleExport} className="flex items-center gap-2 w-full bg-white border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
                                            <i className="bi bi-cloud-download text-teal-600"></i> {t('btn.backup')}
                                        </button>
                                        
                                        <button onClick={() => isTauri() ? handleImport() : fileInputRef.current?.click()} className="flex items-center gap-2 w-full bg-white border border-gray-300 text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
                                            <i className="bi bi-cloud-upload text-amber-600"></i> {t('btn.restore')}
                                        </button>
                                        <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".json" />

                                        {isTauri() && (
                                            <button onClick={handleExportSqlite} className="flex items-center gap-2 w-full bg-emerald-50 text-emerald-800 border border-emerald-200 px-4 py-2.5 rounded-lg hover:bg-emerald-100 transition-colors text-sm font-bold">
                                                <i className="bi bi-database-down text-emerald-600"></i> تصدير كامل من Supabase إلى SQLite (goft3_local_YYYY-MM-DD.db)
                                            </button>
                                        )}

                                        <div className="pt-4 border-t mt-2">
                                            <button onClick={handleResetDatabase} className="flex items-center gap-2 w-full bg-red-50 text-red-700 border border-red-100 px-4 py-2.5 rounded-lg hover:bg-red-100 transition-colors text-sm font-bold">
                                                <i className="bi bi-trash3-fill"></i> {t('btn.reset_db')}
                                            </button>
                                            <button onClick={resetConfig} className="flex items-center gap-2 w-full mt-2 bg-gray-100 text-gray-700 px-4 py-2.5 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium">
                                                <i className="bi bi-door-open-fill"></i> {t('btn.disconnect')}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                                <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-indigo-800">
                                    <i className="bi bi-arrow-up-circle-fill"></i>
                                    تحديث البرنامج
                                </h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg border border-gray-100">
                                        <div className="text-sm font-medium text-gray-500">الإصدار الحالي للنظام:</div>
                                        <div className="font-mono font-bold text-indigo-600 bg-white px-3 py-1 rounded shadow-sm border">{APP_VERSION}</div>
                                    </div>
                                    
                                    <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                                        <p className="text-xs text-indigo-700 leading-relaxed mb-4">
                                            ننصح بالتحقق بشكل دوري من وجود تحديثات لضمان الحصول على أحدث الإصلاحات والمميزات.
                                        </p>
                                        <button 
                                            onClick={handleCheckUpdate} 
                                            disabled={checkingUpdate}
                                            className="w-full bg-indigo-600 text-white px-4 py-3 rounded-lg shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center font-bold disabled:bg-indigo-400 disabled:cursor-not-allowed gap-2"
                                        >
                                            {checkingUpdate ? (
                                                <>
                                                    <i className="bi bi-arrow-repeat animate-spin"></i>
                                                    جاري الفحص...
                                                </>
                                            ) : (
                                                <>
                                                    <i className="bi bi-cloud-arrow-down-fill"></i>
                                                    التحقق من وجود تحديث
                                                </>
                                            )}
                                        </button>
                                        {downloadProgress !== null && (
                                            <div className="mt-3">
                                                <div className="flex items-center justify-between mb-1 text-[11px] font-bold text-indigo-700">
                                                    <span>جارٍ التنزيل...</span>
                                                    <span>{downloadProgress}%</span>
                                                </div>
                                                <div className="h-2 w-full bg-indigo-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-indigo-600 transition-all duration-200"
                                                        style={{ width: `${Math.min(100, downloadProgress)}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'users' && isAdmin && (
                        <motion.div 
                            key="users" 
                            initial={{ opacity: 0, x: 20 }} 
                            animate={{ opacity: 1, x: 0 }} 
                            exit={{ opacity: 0, x: -20 }}
                            className="bg-white p-6 rounded-xl shadow-sm border border-gray-200"
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                    <i className="bi bi-people-fill text-blue-600"></i>
                                    قائمة المستخدمين المسجلين
                                </h3>
                                <div className="flex gap-2">
                                    <button onClick={openAddUserModal} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 transition-colors font-medium">
                                        <i className="bi bi-plus-lg"></i> إضافة
                                    </button>
                                    <button 
                                        onClick={openEditUserModal} 
                                        disabled={selectedUserId === null} 
                                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:shadow-none"
                                    >
                                        <i className="bi bi-pencil-square"></i> تعديل
                                    </button>
                                    <button 
                                        onClick={handleDeleteUser} 
                                        disabled={selectedUserId === null} 
                                        className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg shadow hover:bg-red-700 transition-colors disabled:bg-gray-300 disabled:shadow-none"
                                    >
                                        <i className="bi bi-trash3"></i> حذف
                                    </button>
                                </div>
                            </div>

                            <div className="overflow-hidden border border-gray-200 rounded-lg">
                                <table className="w-full text-right border-collapse">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="p-4 text-sm font-bold text-gray-600">اسم المستخدم</th>
                                            <th className="p-4 text-sm font-bold text-gray-600">الدور الصلاحيات</th>
                                            <th className="p-4 text-sm font-bold text-gray-600 text-left">المعرف</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {db.T_USER.slice().sort((a, b) => a.ID_USER - b.ID_USER).map(user => (
                                            <tr 
                                                key={user.ID_USER} 
                                                onClick={() => setSelectedUserId(user.ID_USER)} 
                                                className={`hover:bg-blue-50 cursor-pointer transition-colors ${selectedUserId === user.ID_USER ? 'bg-blue-50' : ''}`}
                                            >
                                                <td className="p-4 font-semibold text-gray-800">{user.USERNAME}</td>
                                                <td className="p-4">
                                                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                                                        user.ROLE === 'admin' ? 'bg-purple-100 text-purple-700 border-purple-200' :
                                                        user.ROLE === 'viewer' ? 'bg-gray-100 text-gray-700 border-gray-200' :
                                                        'bg-green-100 text-green-700 border-green-200'
                                                    }`}>
                                                        {getRoleName(user.ROLE)}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-gray-400 font-mono text-xs text-left">{user.ID_USER}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>
                    )}

                    {activeTab === 'tables' && (
                        <motion.div 
                            key="tables" 
                            initial={{ opacity: 0, x: 20 }} 
                            animate={{ opacity: 1, x: 0 }} 
                            exit={{ opacity: 0, x: -20 }}
                            className="bg-white p-6 rounded-xl shadow-sm border border-gray-200"
                        >
                            <h3 className="text-xl font-bold mb-6 text-gray-800 flex items-center gap-2">
                                <i className="bi bi-journal-bookmark-fill text-indigo-600"></i>
                                إدارة البيانات المرجعية
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                <button onClick={() => navigate('PROGRAMME')} className="group flex flex-col items-center gap-3 p-6 bg-gray-50 border border-gray-100 rounded-xl hover:bg-white hover:shadow-md hover:border-blue-200 transition-all text-sm font-bold text-gray-700">
                                    <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                        <i className="bi bi-folder-fill"></i>
                                    </div>
                                    <span>{t('btn.manage_programmes')}</span>
                                </button>

                                <button onClick={() => navigate('CATEGORIE')} className="group flex flex-col items-center gap-3 p-6 bg-gray-50 border border-gray-100 rounded-xl hover:bg-white hover:shadow-md hover:border-blue-200 transition-all text-sm font-bold text-gray-700">
                                    <div className="w-12 h-12 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center text-xl group-hover:bg-teal-600 group-hover:text-white transition-colors">
                                        <i className="bi bi-tags-fill"></i>
                                    </div>
                                    <span>{t('btn.manage_categories')}</span>
                                </button>

                                <button onClick={() => navigate('RUBRIQUE')} className="group flex flex-col items-center gap-3 p-6 bg-gray-50 border border-gray-100 rounded-xl hover:bg-white hover:shadow-md hover:border-blue-200 transition-all text-sm font-bold text-gray-700">
                                    <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xl group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                        <i className="bi bi-diagram-3-fill"></i>
                                    </div>
                                    <span>{t('btn.manage_rubriques')}</span>
                                </button>

                                <button onClick={() => navigate('DIRECTION')} className="group flex flex-col items-center gap-3 p-6 bg-gray-50 border border-gray-100 rounded-xl hover:bg-white hover:shadow-md hover:border-blue-200 transition-all text-sm font-bold text-gray-700">
                                    <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-xl group-hover:bg-amber-600 group-hover:text-white transition-colors">
                                        <i className="bi bi-geo-alt-fill"></i>
                                    </div>
                                    <span>{t('btn.manage_directions')}</span>
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Modals from original code + New User Modal */}
            <Modal isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} title="إعدادات قاعدة البيانات (Supabase)">
                <form onSubmit={handleSaveConfig} className="space-y-4" dir="ltr">
                    <div>
                        <label className="block text-gray-700 text-sm font-bold mb-2 text-left">رابط المشروع (Project URL)</label>
                        <input 
                            type="url" 
                            value={setupUrl} 
                            onChange={e => setSetupUrl(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-left"
                            placeholder="https://xyz.supabase.co"
                            required 
                        />
                    </div>
                    <div>
                        <label className="block text-gray-700 text-sm font-bold mb-2 text-left">مفتاح API (anon/public)</label>
                        <input 
                            type="password" 
                            value={setupKey} 
                            onChange={e => setSetupKey(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-left"
                            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                            required 
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-4" dir="rtl">
                        <button type="button" onClick={() => setIsConfigOpen(false)} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors">إلغاء</button>
                        <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">حفظ واتصال</button>
                    </div>
                </form>
            </Modal>

            {isAdmin && (
                <Modal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} title={editingUser ? 'تعديل مستخدم' : 'إضافة مستخدم جديد'}>
                    <AddUserForm key={formKey} onClose={() => setIsUserModalOpen(false)} onSave={handleSaveUser} initialData={editingUser} />
                </Modal>
            )}

            {passModal && (
                <Modal
                    isOpen={true}
                    onClose={() => setPassModal(null)}
                    title={passModal.mode === 'export' ? 'تشفير النسخة الاحتياطية' : 'فتح نسخة احتياطية مشفّرة'}
                >
                    <form onSubmit={handlePassModalSubmit} className="space-y-3" dir="rtl">
                        <p className="text-xs text-gray-600 leading-relaxed">
                            {passModal.mode === 'export'
                                ? 'اختر كلمة سر قوية (6 أحرف على الأقل). ستحتاجها لاستعادة هذه النسخة على أي جهاز — احتفظ بها في مكان آمن.'
                                : 'هذه النسخة الاحتياطية مشفّرة. أدخل كلمة سرها للاستيراد.'}
                        </p>
                        <input
                            type="password"
                            value={pass1}
                            onChange={e => { setPass1(e.target.value); setPassError(''); }}
                            placeholder="كلمة السر"
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                        />
                        {passModal.mode === 'export' && (
                            <input
                                type="password"
                                value={pass2}
                                onChange={e => { setPass2(e.target.value); setPassError(''); }}
                                placeholder="تأكيد كلمة السر"
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        )}
                        {passError && <div className="text-xs text-red-600 font-bold">{passError}</div>}
                        <div className="flex gap-2 justify-end pt-1">
                            <button type="button" onClick={() => setPassModal(null)} className="px-4 py-2 text-sm bg-gray-200 rounded-md hover:bg-gray-300 transition-colors">إلغاء</button>
                            <button type="submit" disabled={passBusy} className="px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors">
                                {passBusy ? 'جارٍ المعالجة...' : (passModal.mode === 'export' ? 'تشفير وحفظ' : 'فك التشفير والاستيراد')}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            <ConfirmActionModal
                isOpen={isDeleteConfirmOpen}
                title="تأكيد حذف المستخدم"
                message="هل أنت متأكد أنك تريد حذف هذا المستخدم؟"
                onCancel={() => setIsDeleteConfirmOpen(false)}
                onConfirm={confirmDeleteUser}
            />
        </PageWrapper>
    );
};

export default SettingsPage;
