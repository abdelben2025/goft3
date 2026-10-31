
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
import { hashPassword } from '../utils/authUtils';
import { insertUserRow, insertCloudUser, setUserPassword, CLOUD_USER_MISSING } from '../services/authService';

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
    const { db, loading, addItem, updateItem, deleteItem, resetDatabase, importDatabase, saveConfig, resetConfig, isOnline, isDbConfigured, refreshData } = useData();
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
    const handleSaveUser = async (userData: Omit<User, 'ID_USER' | 'PASSWORD'> | User, plainPassword?: string) => {
        showToast(t('settings.saving'), 'loading');
        try {
            // Same split as UsersPage: cloud rows are written first and the
            // password set afterwards, while the local SQLite row carries its
            // own hash up front.
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
                showToast(t('settings.userUpdated'), 'success');
            } else {
                // Cloud rows must go straight to Supabase: addItem falls back to
                // the local SQLite on any error, returning a workstation-only
                // ID_USER the cloud never sees.
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
                showToast(t('settings.userAdded'), 'success');
            }
            setIsUserModalOpen(false);
            setEditingUser(undefined);
        } catch (error: any) {
            console.error("Error saving user:", error);
            let errorMessage = t('settings.saveError');
            if (error && typeof error === 'object') {
                if (error.code === '23505') errorMessage = t('settings.usernameExists');
                else if (error.code === '23514') errorMessage = t('settings.roleViewerRejected');
                else if (error.code === CLOUD_USER_MISSING || error.message === CLOUD_USER_MISSING) {
                    errorMessage = t('settings.cloudUserMissing');
                }
                else if (error.message) errorMessage += ' ' + t('settings.errorDetails', { message: error.message });
            }
            showToast(errorMessage, 'error');
        }
    };

    const handleDeleteUser = () => {
        if (selectedUserId === null) return;
        const userToDelete = db.T_USER.find(u => u.ID_USER === selectedUserId);
        const adminCount = db.T_USER.filter(u => u.ROLE === 'admin').length;
        if (userToDelete?.ROLE === 'admin' && adminCount <= 1) {
            alert(t('settings.cannotDeleteLastAdmin'));
            return;
        }
        setIsDeleteConfirmOpen(true);
    };

    const confirmDeleteUser = async () => {
        setIsDeleteConfirmOpen(false);
        if (selectedUserId === null) return;
        showToast(t('settings.deleting'), 'loading');
        try {
            await deleteItem('T_USER', selectedUserId);
            showToast(t('settings.userDeleted'), 'success');
            setSelectedUserId(null);
        } catch (error) {
            showToast(t('settings.deleteError', { reason: errorMessage(error) }), 'error');
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
            case 'admin': return t('role.admin');
            case 'viewer': return t('role.viewer');
            default: return t('role.user');
        }
    };

    // System Config Logic
    const handleCheckUpdate = async () => {
        setCheckingUpdate(true);
        try {
            const updateInfo = await checkForUpdates();
            if (!updateInfo) {
                showToast(t('settings.checkUpdateFailed'), 'error');
            } else if (updateInfo.notSupported) {
                showToast(t('settings.autoUpdateDesktopOnly', { version: updateInfo.latestVersion }), 'info');
            } else if (updateInfo.offline) {
                showToast(t('settings.noInternetCheckUpdate'), 'error');
            } else if (updateInfo.checkFailed) {
                if (updateInfo.noReleases) {
                    showToast(t('settings.noReleases'), 'info');
                } else {
                    showToast(t('settings.cannotReachServer'), 'error');
                }
            } else if (updateInfo.hasUpdate) {
                if (window.confirm(t('settings.newUpdateConfirm', { version: updateInfo.latestVersion }))) {
                    setDownloadProgress(0);
                    showToast(t('settings.downloadingUpdate'), 'loading');
                    try {
                        await performUpdate((pct) => setDownloadProgress(pct));
                    } catch (updErr) {
                        setDownloadProgress(null);
                        showToast(t('settings.updateError', { reason: errorMessage(updErr) }), 'error');
                    }
                }
            } else {
                showToast(t('settings.upToDate', { version: updateInfo.latestVersion }), 'success');
            }
        } catch (checkErr) {
            showToast(t('settings.checkFailedReason', { reason: errorMessage(checkErr) }), 'error');
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
            showToast(t('settings.dbImported'), 'success');
        } catch (impErr) {
            showToast(t('settings.importError', { reason: errorMessage(impErr) }), 'error');
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
                    title: t('settings.saveEncryptedBackupTitle'),
                });
                if (!path) return; // user cancelled
                setPass1('');
                setPass2('');
                setPassError('');
                setPassModal({ mode: 'export', path, data: dataStr });
            } catch (err: any) {
                console.error('Tauri export failed:', err);
                showToast(t('settings.exportError', { reason: errorMessage(err) }), 'error');
            }
            return;
        }

        // Web / Electron fallback (no native crypto available in the browser)
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = fileName;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1500);
        showToast(t('settings.dbExported'), 'success');
    };

    const handleImport = async (event?: React.ChangeEvent<HTMLInputElement>) => {
        if (isTauri()) {
            try {
                const { open } = await import('@tauri-apps/plugin-dialog');
                const selected = await open({
                    multiple: false,
                    filters: [{ name: 'نسخة احتياطية GOFT3', extensions: ['goft3bak', 'json'] }],
                    title: t('settings.importPickFileTitle'),
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
                    showToast(t('settings.wrongPassphrase'), 'error');
                    return;
                }
                showToast(t('settings.readImportError', { reason: msg }), 'error');
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
            showToast(t('settings.jsonParseError', { reason: errorMessage(parseErr) }), 'error');
        } finally {
            if (event?.target) event.target.value = '';
        }
    };

    const handlePassModalSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!passModal) return;
        setPassError('');
        if (pass1.trim().length < 6) {
            setPassError(t('settings.passMinLength'));
            return;
        }
        if (passModal.mode === 'export' && pass1 !== pass2) {
            setPassError(t('settings.passMismatch'));
            return;
        }
        setPassBusy(true);
        try {
            if (passModal.mode === 'export') {
                await tauriDb.saveBackup(passModal.data, passModal.path, pass1.trim());
                showToast(t('settings.encryptedSaved', { path: passModal.path }), 'success');
                setPassModal(null);
            } else {
                const content = await tauriDb.readBackup(passModal.path, pass1.trim());
                await applyImportedJson(JSON.parse(content));
                setPassModal(null);
            }
        } catch (err: any) {
            const msg = errorMessage(err);
            if (msg === 'WRONG_PASSPHRASE') {
                setPassError(t('settings.wrongPassphraseShort'));
            } else {
                setPassError(msg);
            }
        } finally {
            setPassBusy(false);
        }
    };

    const handleExportSqlite = async () => {
        if (!isTauri()) {
            showToast(t('settings.sqliteDesktopOnly'), 'error');
            return;
        }
        if (!supabase || !isOnline || !isDbConfigured) {
            showToast(t('settings.sqliteRequiresSupabase'), 'error');
            return;
        }

        try {
            showToast(t('settings.fetchingSupabase'), 'info');

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
                showToast(t('settings.supabaseEmpty'), 'error');
                return;
            }

            const { save } = await import('@tauri-apps/plugin-dialog');
            const date = new Date().toISOString().split('T')[0];
            const path = await save({
                defaultPath: `goft3_local_${date}.db`,
                filters: [{ name: 'SQLite Database', extensions: ['db', 'sqlite'] }],
                title: t('settings.exportSupabaseTitle'),
            });
            if (!path) return;

            const inserted = await tauriDb.exportSupabaseSqlite(path, payload);
            const perTable = EXPORT_TABLES
                .map((t, i) => `${t}: ${results[i].length}`)
                .filter((_, i) => results[i].length > 0)
                .join(' | ');

            showToast(
                t('settings.supabaseExportSuccess', { count: inserted, path, tables: perTable }),
                'success'
            );
        } catch (err: any) {
            console.error('Supabase → SQLite export failed:', err);
            showToast(t('settings.supabaseExportError', { message: err?.message || err }), 'error');
        }
    };

    const handleResetDatabase = async () => {
        if (!window.confirm(t('settings.resetDbConfirm'))) return;
        try {
            await resetDatabase();
            showToast(t('settings.dbReset'), 'success');
        } catch (resetErr) {
            showToast(t('settings.resetError', { reason: errorMessage(resetErr) }), 'error');
        }
    };

    const handleSaveConfig = (e: React.FormEvent) => {
        e.preventDefault();
        if (window.confirm(t('settings.saveConfigConfirm'))) {
            saveConfig(setupUrl, setupKey);
            setIsConfigOpen(false);
        }
    };

    const tabs: {id: SettingsTab, label: string, icon: string}[] = [
        { id: 'general', label: t('settings.tabGeneral'), icon: 'bi-gear-wide-connected' },
        { id: 'users', label: t('settings.tabUsers'), icon: 'bi-people-fill' },
        { id: 'tables', label: t('settings.tabTables'), icon: 'bi-table' }
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
                                        {t('settings.cloudSyncDesc')}
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
                                                <i className="bi bi-database-down text-emerald-600"></i> {t('settings.exportSqliteButton')}
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
                                    {t('settings.updateProgram')}
                                </h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg border border-gray-100">
                                        <div className="text-sm font-medium text-gray-500">{t('settings.currentVersionLabel')}</div>
                                        <div className="font-mono font-bold text-indigo-600 bg-white px-3 py-1 rounded shadow-sm border">{APP_VERSION}</div>
                                    </div>
                                    
                                    <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                                        <p className="text-xs text-indigo-700 leading-relaxed mb-4">
                                            {t('settings.updateAdvice')}
                                        </p>
                                        <button 
                                            onClick={handleCheckUpdate} 
                                            disabled={checkingUpdate}
                                            className="w-full bg-indigo-600 text-white px-4 py-3 rounded-lg shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center font-bold disabled:bg-indigo-400 disabled:cursor-not-allowed gap-2"
                                        >
                                            {checkingUpdate ? (
                                                <>
                                                    <i className="bi bi-arrow-repeat animate-spin"></i>
                                                    {t('settings.checking')}
                                                </>
                                            ) : (
                                                <>
                                                    <i className="bi bi-cloud-arrow-down-fill"></i>
                                                    {t('settings.checkForUpdate')}
                                                </>
                                            )}
                                        </button>
                                        {downloadProgress !== null && (
                                            <div className="mt-3">
                                                <div className="flex items-center justify-between mb-1 text-[11px] font-bold text-indigo-700">
                                                    <span>{t('settings.downloading')}</span>
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
                                    {t('settings.registeredUsers')}
                                </h3>
                                <div className="flex gap-2">
                                    <button onClick={openAddUserModal} className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 transition-colors font-medium">
                                        <i className="bi bi-plus-lg"></i> {t('btn.add')}
                                    </button>
                                    <button 
                                        onClick={openEditUserModal} 
                                        disabled={selectedUserId === null} 
                                        className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:shadow-none"
                                    >
                                        <i className="bi bi-pencil-square"></i> {t('btn.edit')}
                                    </button>
                                    <button 
                                        onClick={handleDeleteUser} 
                                        disabled={selectedUserId === null} 
                                        className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg shadow hover:bg-red-700 transition-colors disabled:bg-gray-300 disabled:shadow-none"
                                    >
                                        <i className="bi bi-trash3"></i> {t('btn.delete')}
                                    </button>
                                </div>
                            </div>

                            <div className="overflow-hidden border border-gray-200 rounded-lg">
                                <table className="w-full text-right border-collapse">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="p-4 text-sm font-bold text-gray-600">{t('col.username')}</th>
                                            <th className="p-4 text-sm font-bold text-gray-600">{t('col.role')}</th>
                                            <th className="p-4 text-sm font-bold text-gray-600 text-left">{t('col.id')}</th>
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
                                {t('settings.referenceData')}
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
            <Modal isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} title={t('settings.dbConfigTitle')}>
                <form onSubmit={handleSaveConfig} className="space-y-4" dir="ltr">
                    <div>
                        <label className="block text-gray-700 text-sm font-bold mb-2 text-left">{t('settings.projectUrlLabel')}</label>
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
                        <label className="block text-gray-700 text-sm font-bold mb-2 text-left">{t('settings.apiKeyLabel')}</label>
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
                        <button type="button" onClick={() => setIsConfigOpen(false)} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors">{t('btn.cancel')}</button>
                        <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">{t('settings.saveAndConnect')}</button>
                    </div>
                </form>
            </Modal>

            {isAdmin && (
                <Modal isOpen={isUserModalOpen} onClose={() => setIsUserModalOpen(false)} title={editingUser ? t('settings.editUserTitle') : t('settings.addUserTitle')}>
                    <AddUserForm key={formKey} onClose={() => setIsUserModalOpen(false)} onSave={handleSaveUser} initialData={editingUser} />
                </Modal>
            )}

            {passModal && (
                <Modal
                    isOpen={true}
                    onClose={() => setPassModal(null)}
                    title={passModal.mode === 'export' ? t('settings.encryptBackupTitle') : t('settings.decryptBackupTitle')}
                >
                    <form onSubmit={handlePassModalSubmit} className="space-y-3" dir="rtl">
                        <p className="text-xs text-gray-600 leading-relaxed">
                            {passModal.mode === 'export'
                                ? t('settings.passStrengthHint')
                                : t('settings.passEntryHint')}
                        </p>
                        <input
                            type="password"
                            value={pass1}
                            onChange={e => { setPass1(e.target.value); setPassError(''); }}
                            placeholder={t('settings.passPlaceholder')}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            autoFocus
                        />
                        {passModal.mode === 'export' && (
                            <input
                                type="password"
                                value={pass2}
                                onChange={e => { setPass2(e.target.value); setPassError(''); }}
                                placeholder={t('settings.confirmPassPlaceholder')}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        )}
                        {passError && <div className="text-xs text-red-600 font-bold">{passError}</div>}
                        <div className="flex gap-2 justify-end pt-1">
                            <button type="button" onClick={() => setPassModal(null)} className="px-4 py-2 text-sm bg-gray-200 rounded-md hover:bg-gray-300 transition-colors">{t('btn.cancel')}</button>
                            <button type="submit" disabled={passBusy} className="px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors">
                                {passBusy ? t('settings.processing') : (passModal.mode === 'export' ? t('settings.encryptSave') : t('settings.decryptImport'))}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            <ConfirmActionModal
                isOpen={isDeleteConfirmOpen}
                title={t('settings.confirmDeleteTitle')}
                message={t('settings.confirmDeleteMsg')}
                onCancel={() => setIsDeleteConfirmOpen(false)}
                onConfirm={confirmDeleteUser}
            />
        </PageWrapper>
    );
};

export default SettingsPage;
