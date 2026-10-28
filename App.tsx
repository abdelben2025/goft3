
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import OperationsPage from './pages/OperationsPage';
import OperationDetailsPage from './pages/OperationDetailsPage';
import DocumentsPage from './pages/DocumentsPage';
import DocumentDetailsPage from './pages/DocumentDetailsPage';
import BeneficiairesPage from './pages/BeneficiairesPage';
import FinancialStatusPage from './pages/FinancialStatusPage';
import FinancialStatusByStructurePage from './pages/FinancialStatusByStructurePage';
import ProjectTrackingPage from './pages/ProjectTrackingPage';
import SettingsPage from './pages/SettingsPage';
import ProgrammePage from './pages/ProgrammePage';
import CategoriePage from './pages/CategoriePage';
import DirectionPage from './pages/DirectionPage';
import RubriquePage from './pages/RubriquePage';
import UsersPage from './pages/UsersPage';
import PrintEngagementPage from './pages/PrintEngagementPage';
import PrintPaiementPage from './pages/PrintPaiementPage';
import PrintCertificatPage from './pages/PrintCertificatPage';
import PrintMandatPage from './pages/PrintMandatPage';
import PrintDeclarationPage from './pages/PrintDeclarationPage';
import PrintMandatTablePage from './pages/PrintMandatTablePage';
import PrintFinancialStatusByStructurePage from './pages/PrintFinancialStatusByStructurePage';
import PrintFinancialStatusByStructureCommitmentPage from './pages/PrintFinancialStatusByStructureCommitmentPage';
import PrintOperationsTablePage from './pages/PrintOperationsTablePage';
import PrintFinancialStatusPage from './pages/PrintFinancialStatusPage';
import PrintProjectTrackingPage from './pages/PrintProjectTrackingPage';
import PaymentClaimsPage from './pages/PaymentClaimsPage';
import PrintPaymentClaimsPage from './pages/PrintPaymentClaimsPage';
import AeInsufficiencyPage from './pages/AeInsufficiencyPage';
import UnregisteredDocumentsPage from './pages/UnregisteredDocumentsPage';
import LotsReportPage from './pages/LotsReportPage';
import PrintAeInsufficiencyPage from './pages/PrintAeInsufficiencyPage';
import PrintBordereauPage from './pages/PrintBordereauPage';
import CustomReportPage from './pages/CustomReportPage';
import VisaedEngagementsPage from './pages/VisaedEngagementsPage';
import Appendix01Page from './pages/Appendix01Page';
import MonthlyCommitmentsPage from './pages/MonthlyCommitmentsPage';
import MonthlyPaymentsPage from './pages/MonthlyPaymentsPage';
import PrintMonthlyCommitmentsPage from './pages/PrintMonthlyCommitmentsPage';
import PrintMonthlyPaymentsPage from './pages/PrintMonthlyPaymentsPage';
import SplashScreen from './components/SplashScreen';
import EventTicker from './components/EventTicker';
import IdleLockScreen from './components/IdleLockScreen';
import Modal from './components/Modal';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DataProvider, useData, RefreshStatus } from './context/DataContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { LanguageProvider } from './context/LanguageContext';
import GlobalSearch from './components/GlobalSearch';
import { Page, User, APP_VERSION } from './types';
import { checkForUpdates, performUpdate, UpdateInfo } from './utils/updateService';
import { hashPassword, isDefaultPasswordHash } from './utils/authUtils';
import { errorMessage } from './utils/errorMessage';
import { isTauri } from './services/tauriService';
import { invoke } from '@tauri-apps/api/core';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Auto-lock the session after 10 minutes of inactivity (financial-data safety)
const IDLE_TIMEOUT_MS = 10 * 60 * 1000;

const AuthenticatedApp: React.FC<{
    currentPage: Page;
    navigate: (page: Page, id?: number, tab?: string) => void;
    onLogout: () => void;
    onGoBack?: () => void;
    onUpdateUser: (user: User) => void;
    canGoBack?: boolean;
    currentUser: User;
    selectedOperationId: number | null;
    selectedEngagementId: number | null;
    selectedPaiementId: number | null;
    selectedTab?: string;
}> = ({ currentPage, navigate, onLogout, onGoBack, onUpdateUser, currentUser, selectedOperationId, selectedEngagementId, selectedPaiementId, selectedTab }) => {
    const { isInitialLoad, isOnline, joinPresence, leavePresence, updateItem, refreshData } = useData();
    const { showToast } = useToast();
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
    const [updateBusy, setUpdateBusy] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [mustChangePassword, setMustChangePassword] = useState(() =>
        isDefaultPasswordHash(currentUser.PASSWORD)
    );
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');
    const [isSavingPassword, setIsSavingPassword] = useState(false);

    const handleChangeDefaultPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPasswordError('');

        if (newPassword.length < 8) {
            setPasswordError('كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordError('كلمتا المرور غير متطابقتين.');
            return;
        }
        if (newPassword === 'admin123' || newPassword === 'admin') {
            setPasswordError('لا يمكن استخدام كلمة المرور الافتراضية الضعيفة.');
            return;
        }

        setIsSavingPassword(true);
        try {
            const hashed = await hashPassword(newPassword);
            const updated: User = { ...currentUser, PASSWORD: hashed };
            await updateItem('T_USER', currentUser.ID_USER, updated);
            onUpdateUser(updated);
            sessionStorage.setItem('goft3_user', JSON.stringify(updated));
            setMustChangePassword(false);
            setNewPassword('');
            setConfirmPassword('');
        } catch (err) {
            console.error('Failed to change default password:', err);
            setPasswordError(`تعذر حفظ كلمة المرور الجديدة — السبب: ${errorMessage(err)}`);
        } finally {
            setIsSavingPassword(false);
        }
    };

    // Logout while ONLINE: refresh the local SQLite from Supabase first,
    // notify the user with a toast, then log out.
    const handleLogoutWithSync = useCallback(async () => {
        if (isOnline) {
            showToast('جاري تحديث قاعدة البيانات المحلية قبل الخروج...', 'loading');
            let status: RefreshStatus | undefined;
            try {
                status = await refreshData();
            } catch (err) {
                console.warn('Logout local DB refresh failed:', err);
            }
            if (status?.ok && status.mirrored) {
                showToast('تم تحديث قاعدة البيانات المحلية قبل الخروج', 'success');
            } else {
                showToast('تعذر تحديث قاعدة البيانات المحلية قبل الخروج — سيتم الخروج مع البيانات المحلية الحالية', 'error');
            }
        }
        onLogout();
    }, [isOnline, refreshData, onLogout, showToast]);

    // While logged in: disable the native close (X) button so the user must
    // use the logout button (Alt+F4 / taskbar close is also blocked).
    // NOTE: done through a native Rust command because core window APIs are
    // blocked by Tauri capabilities when called from JS.
    //
    // FIX: Use a ref for showToast so we don't re-register the listener on every
    // render (which caused memory leaks and the close button getting stuck).
    const showToastRef = useRef(showToast);
    useEffect(() => { showToastRef.current = showToast; }, [showToast]);

    useEffect(() => {
        if (!isTauri()) return;
        let unlistenFn: (() => void) | undefined;
        let isMounted = true;

        const setup = async () => {
            try {
                await invoke('set_window_close_enabled', { enabled: false });
            } catch (err) {
                console.warn('Could not disable the window close button:', err);
            }
            if (!isMounted) {
                // Unmounted while awaiting the invoke — restore immediately
                invoke('set_window_close_enabled', { enabled: true }).catch(() => {});
                return;
            }
            try {
                const { getCurrentWindow } = await import('@tauri-apps/api/window');
                const ul = await getCurrentWindow().onCloseRequested((event) => {
                    event.preventDefault();
                    showToastRef.current('لإغلاق التطبيق، يرجى تسجيل الخروج أولًا باستخدام زر الخروج.', 'info');
                });
                if (!isMounted) {
                    // Unmounted while awaiting the listener — clean up immediately
                    ul();
                    invoke('set_window_close_enabled', { enabled: true }).catch(() => {});
                } else {
                    unlistenFn = ul;
                }
            } catch (err) {
                console.warn('Could not listen to the window close event:', err);
            }
        };

        setup();

        return () => {
            isMounted = false;
            // Unregister close listener first, then re-enable the native close button
            unlistenFn?.();
            invoke('set_window_close_enabled', { enabled: true }).catch(() => { /* ignore */ });
        };
    }, []); // Empty deps — only runs on mount/unmount of the authenticated session

    // ── Idle auto-lock: lock the session after 10 minutes of inactivity ──
    const [isLocked, setIsLocked] = useState(false);
    const lastActivityRef = useRef(Date.now());

    useEffect(() => {
        const markActivity = () => {
            lastActivityRef.current = Date.now();
        };
        const events: (keyof WindowEventMap)[] = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart', 'scroll'];
        events.forEach(ev => window.addEventListener(ev, markActivity, { passive: true }));
        const timer = window.setInterval(() => {
            if (!isLocked && Date.now() - lastActivityRef.current >= IDLE_TIMEOUT_MS) {
                setIsLocked(true);
            }
        }, 15000);
        return () => {
            events.forEach(ev => window.removeEventListener(ev, markActivity));
            window.clearInterval(timer);
        };
    }, [isLocked]);

    useEffect(() => {
        joinPresence(currentUser);

        // After login: ensure cloud data is loaded and mirrored into local SQLite
        refreshData().catch(err => {
            console.warn('Post-login refreshData skipped:', err);
        });

        // Auto check for updates on mount
        const runUpdateCheck = async () => {
            const result = await checkForUpdates();
            if (result?.hasUpdate) {
                setUpdateInfo(result);
            }
        };
        runUpdateCheck();

        // Keyboard shortcuts
        const handleKeyDown = (e: KeyboardEvent) => {
            const ctrl = e.ctrlKey || e.metaKey;
            const key = e.key.toLowerCase();

            if (ctrl && key === 'k') {
                e.preventDefault();
                setIsSearchOpen(prev => !prev);
                return;
            }
            if (e.altKey && key === 's') {
                e.preventDefault();
                setIsSearchOpen(prev => !prev);
                return;
            }

            if (ctrl && key === 'o') { e.preventDefault(); navigate('OPERATIONS'); return; }
            if (ctrl && key === 'd') { e.preventDefault(); navigate('DOCUMENTS'); return; }
            if (ctrl && key === 'b') { e.preventDefault(); navigate('BENEFICIARIES'); return; }
            if (ctrl && key === 's') { e.preventDefault(); navigate('SETTINGS'); return; }
            if (ctrl && key === 'h') { e.preventDefault(); navigate('HOME'); return; }
            if (ctrl && key === 'f') { e.preventDefault(); navigate('FINANCIAL_STATUS'); return; }
            if (ctrl && key === 'p') { e.preventDefault(); navigate('PROGRAMME'); return; }
            if (e.altKey && key === 'c') { e.preventDefault(); navigate('CATEGORIE'); return; }
            if (e.altKey && key === 'arrowleft') { e.preventDefault(); onGoBack?.(); return; }
        };
        window.addEventListener('keydown', handleKeyDown);

        const handleOpenSearch = () => setIsSearchOpen(true);
        window.addEventListener('open-global-search', handleOpenSearch);

        return () => {
            leavePresence();
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('open-global-search', handleOpenSearch);
        };
    }, [currentUser, joinPresence, leavePresence, refreshData, navigate, onGoBack]);

    const renderPage = useMemo(() => {
        const isAdmin = currentUser.ROLE === 'admin';
        const isViewer = currentUser.ROLE === 'viewer';

        const adminOnlyPages: Page[] = ['SETTINGS', 'USERS', 'PROGRAMME', 'CATEGORIE', 'DIRECTION', 'RUBRIQUE'];

        const viewerAllowedPages: Page[] = [
            'HOME',
            'OPERATIONS',
            'OPERATION_DETAILS',
            'DOCUMENTS',
            'DOCUMENT_DETAILS',
            'BENEFICIARIES',
            'FINANCIAL_STATUS',
            'FINANCIAL_STATUS_BY_STRUCTURE',
            'PROJECT_TRACKING',
            'PAYMENT_CLAIMS',
            'AE_INSUFFICIENCY',
            'UNREGISTERED_DOCUMENTS',
            'LOTS_REPORT',
            'PRINT_ENGAGEMENT', 'PRINT_PAIEMENT', 'PRINT_CERTIFICAT',
            'PRINT_MANDAT', 'PRINT_DECLARATION', 'PRINT_MANDAT_TABLE',
            'PRINT_FINANCIAL_STATUS_BY_STRUCTURE', 'PRINT_FINANCIAL_STATUS_BY_STRUCTURE_COMMITMENT', 'PRINT_OPERATIONS_TABLE',
            'PRINT_FINANCIAL_STATUS', 'PRINT_PROJECT_TRACKING',
            'PRINT_PAYMENT_CLAIMS',
            'PRINT_AE_INSUFFICIENCY',
            'PRINT_BORDEREAU',
            'CUSTOM_REPORT',
            'VISAED_ENGAGEMENTS',
            'APPENDIX_01',
            'MONTHLY_COMMITMENTS_REPORT',
            'MONTHLY_PAYMENTS_REPORT',
            'PRINT_MONTHLY_COMMITMENTS',
            'PRINT_MONTHLY_PAYMENTS'
        ];

        // Custom restrictions based on ALLOWED_PAGES
        if (!isAdmin && currentUser.ALLOWED_PAGES) {
            try {
                const allowedPages = JSON.parse(currentUser.ALLOWED_PAGES) as Page[];
                // Always allow HOME and LOGIN
                const essentialPages: Page[] = ['HOME', 'LOGIN'];
                if (allowedPages.length > 0 && !allowedPages.includes(currentPage) && !essentialPages.includes(currentPage)) {
                    // Check if it's a sub-page or print page that might be allowed implicitly?
                    // For now, if not in list, redirect to HOME
                    if (!currentPage.startsWith('PRINT_') && currentPage !== 'OPERATION_DETAILS') {
                         return <HomePage navigate={navigate} currentUser={currentUser} />;
                    }
                }
            } catch (e) {
                console.error("Error parsing allowed pages", e);
            }
        }

        if (isViewer && !viewerAllowedPages.includes(currentPage)) {
            return <HomePage navigate={navigate} currentUser={currentUser} />;
        }

        if (adminOnlyPages.includes(currentPage) && !isAdmin) {
            return <HomePage navigate={navigate} currentUser={currentUser} />;
        }

        switch (currentPage) {
            case 'HOME':
                return <HomePage navigate={navigate} currentUser={currentUser} />;
            case 'OPERATIONS':
                return <OperationsPage navigate={navigate} currentUser={currentUser} onGoBack={onGoBack} onUpdateUser={onUpdateUser} />;
            case 'OPERATION_DETAILS':
                // Record-level safety check for OPERATION_DETAILS
                if (!isAdmin && currentUser.ALLOWED_OPERATIONS && selectedOperationId) {
                    try {
                        const allowedOps = JSON.parse(currentUser.ALLOWED_OPERATIONS) as any[];
                        if (allowedOps.length > 0 && !allowedOps.map(Number).includes(Number(selectedOperationId))) {
                             return <HomePage navigate={navigate} currentUser={currentUser} />;
                        }
                    } catch (e) {
                         console.error("Error parsing allowed operations in App.tsx", e);
                    }
                }
                return <OperationDetailsPage navigate={navigate} operationId={selectedOperationId!} initialTab={selectedTab} currentUser={currentUser} onGoBack={onGoBack} />;
            case 'DOCUMENTS':
                return <DocumentsPage navigate={navigate} initialOperationId={selectedOperationId} initialPieceId={selectedTab} currentUser={currentUser} onGoBack={onGoBack} />;
            case 'DOCUMENT_DETAILS':
                return <DocumentDetailsPage navigate={navigate} pieceId={selectedOperationId} currentUser={currentUser} onGoBack={onGoBack} />;
            case 'BENEFICIARIES':
                return <BeneficiairesPage navigate={navigate} currentUser={currentUser} onGoBack={onGoBack} initialBeneficiaryId={selectedOperationId} />;
            case 'FINANCIAL_STATUS':
                return <FinancialStatusPage navigate={navigate} currentUser={currentUser} onGoBack={onGoBack} />;
            case 'FINANCIAL_STATUS_BY_STRUCTURE':
                return <FinancialStatusByStructurePage 
                    navigate={navigate} 
                    currentUser={currentUser} 
                    onGoBack={onGoBack} 
                    initialOperationId={selectedOperationId}
                    initialRubricId={selectedTab}
                />;
            case 'PROJECT_TRACKING':
                return <ProjectTrackingPage navigate={navigate} currentUser={currentUser} onGoBack={onGoBack} />;
            case 'PAYMENT_CLAIMS':
                return <PaymentClaimsPage navigate={navigate} currentUser={currentUser} onGoBack={onGoBack} />;
            case 'AE_INSUFFICIENCY':
                return <AeInsufficiencyPage navigate={navigate} currentUser={currentUser} onGoBack={onGoBack} />;
            case 'UNREGISTERED_DOCUMENTS':
                return <UnregisteredDocumentsPage navigate={navigate} currentUser={currentUser} onGoBack={onGoBack} />;
            case 'LOTS_REPORT':
                return <LotsReportPage navigate={navigate} currentUser={currentUser} onGoBack={onGoBack} />;
            case 'CUSTOM_REPORT':
                return <CustomReportPage navigate={navigate} currentUser={currentUser} onGoBack={onGoBack} />;
            case 'VISAED_ENGAGEMENTS':
                return <VisaedEngagementsPage navigate={navigate} currentUser={currentUser} onGoBack={onGoBack} />;
            case 'APPENDIX_01':
                return <Appendix01Page navigate={navigate} currentUser={currentUser} onGoBack={onGoBack} />;
            case 'MONTHLY_COMMITMENTS_REPORT':
                return <MonthlyCommitmentsPage navigate={navigate} currentUser={currentUser} onGoBack={onGoBack} />;
            case 'MONTHLY_PAYMENTS_REPORT':
                return <MonthlyPaymentsPage navigate={navigate} currentUser={currentUser} onGoBack={onGoBack} />;
            case 'SETTINGS':
                return <SettingsPage navigate={navigate} currentUser={currentUser} onGoBack={onGoBack} />;
            case 'USERS':
                return <UsersPage navigate={navigate} currentUser={currentUser} onGoBack={onGoBack} />;
            case 'PROGRAMME':
                return <ProgrammePage navigate={navigate} currentUser={currentUser} onGoBack={onGoBack} />;
            case 'CATEGORIE':
                return <CategoriePage navigate={navigate} currentUser={currentUser} onGoBack={onGoBack} />;
            case 'DIRECTION':
                return <DirectionPage navigate={navigate} currentUser={currentUser} onGoBack={onGoBack} />;
            case 'RUBRIQUE':
                return <RubriquePage navigate={navigate} currentUser={currentUser} onGoBack={onGoBack} />;
            case 'PRINT_ENGAGEMENT':
                return <PrintEngagementPage navigate={navigate} engagementId={selectedEngagementId!} />;
            case 'PRINT_PAIEMENT':
                return <PrintPaiementPage navigate={navigate} paiementId={selectedPaiementId!} />;
            case 'PRINT_CERTIFICAT':
                return <PrintCertificatPage navigate={navigate} paiementId={selectedPaiementId!} />;
            case 'PRINT_MANDAT':
                return <PrintMandatPage navigate={navigate} paiementId={selectedPaiementId!} />;
            case 'PRINT_DECLARATION':
                return <PrintDeclarationPage navigate={navigate} paiementId={selectedPaiementId!} />;
            case 'PRINT_MANDAT_TABLE':
                return <PrintMandatTablePage navigate={navigate} paiementId={selectedPaiementId!} />;
            case 'PRINT_FINANCIAL_STATUS_BY_STRUCTURE':
                return <PrintFinancialStatusByStructurePage navigate={navigate} operationId={selectedOperationId!} />;
            case 'PRINT_FINANCIAL_STATUS_BY_STRUCTURE_COMMITMENT':
                return <PrintFinancialStatusByStructureCommitmentPage navigate={navigate} operationId={selectedOperationId!} />;
            case 'PRINT_OPERATIONS_TABLE':
                return <PrintOperationsTablePage navigate={navigate} />;
            case 'PRINT_FINANCIAL_STATUS':
                return <PrintFinancialStatusPage navigate={navigate} />;
            case 'PRINT_PROJECT_TRACKING':
                return <PrintProjectTrackingPage navigate={navigate} operationId={selectedOperationId!} />;
            case 'PRINT_PAYMENT_CLAIMS':
                return <PrintPaymentClaimsPage navigate={navigate} operationId={selectedOperationId!} />;
            case 'PRINT_AE_INSUFFICIENCY':
                return <PrintAeInsufficiencyPage navigate={navigate} operationId={selectedOperationId!} />;
            case 'PRINT_BORDEREAU':
                return <PrintBordereauPage navigate={navigate} operationId={selectedOperationId!} />;
            case 'PRINT_MONTHLY_COMMITMENTS':
                return <PrintMonthlyCommitmentsPage navigate={navigate} />;
            case 'PRINT_MONTHLY_PAYMENTS':
                return <PrintMonthlyPaymentsPage navigate={navigate} />;
            default:
                return <HomePage navigate={navigate} currentUser={currentUser} />;
        }
    }, [currentUser, currentPage, navigate, onLogout, handleLogoutWithSync, selectedEngagementId, selectedOperationId, selectedPaiementId, selectedTab, onGoBack, onUpdateUser]);

    if (isInitialLoad) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                    <p className="mt-4 text-xl font-semibold text-gray-700">جار تحميل البيانات...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="pb-12 min-h-screen">
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentPage}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                >
                    {renderPage}
                </motion.div>
            </AnimatePresence>
            <EventTicker onLogout={handleLogoutWithSync} />
            <GlobalSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} navigate={navigate} />

            {/* Idle auto-lock overlay */}
            {isLocked && (
                <IdleLockScreen
                    user={currentUser}
                    onUnlock={() => {
                        lastActivityRef.current = Date.now();
                        setIsLocked(false);
                    }}
                />
            )}

            {/* Force change of default admin password */}
            {mustChangePassword && (
                <Modal isOpen={mustChangePassword} onClose={() => {}} title="تغيير كلمة المرور الإجباري" closeOnOverlay={false} hideCloseButton>
                    <form onSubmit={handleChangeDefaultPassword} className="p-2 space-y-4 text-right">
                        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 text-sm text-amber-800">
                            أنت تستخدم الحساب الافتراضي. يُرجى تعيين كلمة مرور قوية قبل متابعة العمل لضمان أمان البيانات المالية.
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">كلمة المرور الجديدة</label>
                            <input
                                type="password"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                minLength={8}
                                required
                                autoFocus
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">تأكيد كلمة المرور</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                minLength={8}
                                required
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        {passwordError && (
                            <p className="text-sm text-red-600 font-semibold">{passwordError}</p>
                        )}
                        <button
                            type="submit"
                            disabled={isSavingPassword}
                            className="w-full px-4 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors"
                        >
                            {isSavingPassword ? 'جارٍ الحفظ...' : 'حفظ وكلمة المرور والمتابعة'}
                        </button>
                    </form>
                </Modal>
            )}

            {/* New Update Found Modal */}
            {updateInfo && (
                <Modal isOpen={!!updateInfo} onClose={() => setUpdateInfo(null)} title="تحديث جديد متوفر" maxWidth="md">
                    <div className="p-2 text-center">
                        <div className="mb-3">
                            <i className="bi bi-cloud-arrow-down-fill text-5xl text-blue-600"></i>
                        </div>
                        <h2 className="text-lg font-bold text-gray-800 mb-1">يتوفر إصدار جديد!</h2>
                        <p className="text-sm text-gray-600 mb-4">
                            الإصدار الحالي: <span className="font-mono font-bold">{APP_VERSION}</span> <br />
                            الإصدار الجديد: <span className="font-mono font-bold text-green-600">{updateInfo.latestVersion}</span>
                        </p>
                        <p className="text-xs text-gray-500 mb-4">
                            سيتم تنزيل التحديث وتطبيقه تلقائيًا مع التحقق من توقيعه، ثم إعادة تشغيل التطبيق.
                        </p>
                        <div className="flex justify-center gap-3">
                            <button
                                onClick={() => setUpdateInfo(null)}
                                className="px-4 py-1.5 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors text-sm"
                            >
                                لاحقاً
                            </button>
                            <button
                                onClick={async () => {
                                    setUpdateBusy(true);
                                    showToast('جارٍ تنزيل التحديث وتطبيقه...', 'loading');
                                    try {
                                        await performUpdate();
                                    } catch (updErr) {
                                        showToast(`تعذر التحديث — السبب: ${errorMessage(updErr)}`, 'error');
                                        setUpdateBusy(false);
                                    }
                                }}
                                disabled={updateBusy}
                                className="px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold text-sm disabled:opacity-50"
                            >
                                {updateBusy ? 'جارٍ التنزيل...' : 'نعم، حدث الآن'}
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};


const App: React.FC = () => {
    const [showSplash, setShowSplash] = useState(true);
    const [currentUser, setCurrentUser] = useState<User | null>(() => {
        // Clear any old localstorage user to enforce session-only auth
        localStorage.removeItem('goft3_user');
        
        const storedUser = sessionStorage.getItem('goft3_user');
        if (storedUser) {
            try {
                return JSON.parse(storedUser);
            } catch (e) {
                sessionStorage.removeItem('goft3_user');
                return null;
            }
        }
        return null;
    });

    const [currentPage, setCurrentPage] = useState<Page>(() => {
        if (!sessionStorage.getItem('goft3_user')) {
            return 'LOGIN';
        }
        const page = localStorage.getItem('goft3_page') as Page;
        const printPages: Page[] = [
            'PRINT_ENGAGEMENT', 'PRINT_PAIEMENT', 'PRINT_CERTIFICAT',
            'PRINT_MANDAT', 'PRINT_DECLARATION', 'PRINT_MANDAT_TABLE',
            'PRINT_FINANCIAL_STATUS_BY_STRUCTURE', 'PRINT_FINANCIAL_STATUS_BY_STRUCTURE_COMMITMENT', 'PRINT_OPERATIONS_TABLE',
            'PRINT_FINANCIAL_STATUS', 'PRINT_PROJECT_TRACKING', 'PRINT_PAYMENT_CLAIMS',
            'PRINT_AE_INSUFFICIENCY', 'PRINT_BORDEREAU', 'PRINT_MONTHLY_COMMITMENTS', 'PRINT_MONTHLY_PAYMENTS'
        ];
        if (printPages.includes(page)) {
            return 'HOME';
        }
        return page || 'HOME';
    });

    const [selectedOperationId, setSelectedOperationId] = useState<number | null>(() => {
        const stored = localStorage.getItem('goft3_operation_id');
        return stored ? parseInt(stored, 10) : null;
    });
    const [selectedEngagementId, setSelectedEngagementId] = useState<number | null>(() => {
        const stored = localStorage.getItem('goft3_engagement_id');
        return stored ? parseInt(stored, 10) : null;
    });
    const [selectedPaiementId, setSelectedPaiementId] = useState<number | null>(() => {
        const stored = localStorage.getItem('goft3_paiement_id');
        return stored ? parseInt(stored, 10) : null;
    });
    const [selectedTab, setSelectedTab] = useState<string | undefined>(() => {
        return localStorage.getItem('goft3_tab') || undefined;
    });

    const [navigationHistory, setNavigationHistory] = useState<{page: Page, id: number | null, tab?: string, engagementId?: number | null, paiementId?: number | null}[]>([]);

    // Splash Screen Effect
    useEffect(() => {
        const timer = setTimeout(() => {
            setShowSplash(false);
        }, 2500); // Show splash screen for 2.5 seconds

        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        const printPages: Page[] = [
            'PRINT_ENGAGEMENT', 'PRINT_PAIEMENT', 'PRINT_CERTIFICAT',
            'PRINT_MANDAT', 'PRINT_DECLARATION', 'PRINT_MANDAT_TABLE',
            'PRINT_FINANCIAL_STATUS_BY_STRUCTURE', 'PRINT_FINANCIAL_STATUS_BY_STRUCTURE_COMMITMENT', 'PRINT_OPERATIONS_TABLE',
            'PRINT_FINANCIAL_STATUS', 'PRINT_PROJECT_TRACKING', 'PRINT_PAYMENT_CLAIMS',
            'PRINT_AE_INSUFFICIENCY', 'PRINT_BORDEREAU', 'PRINT_MONTHLY_COMMITMENTS', 'PRINT_MONTHLY_PAYMENTS'
        ];
        if (currentUser && !printPages.includes(currentPage)) {
            localStorage.setItem('goft3_page', currentPage);
        }
        
        // Persist IDs
        if (selectedOperationId !== null) localStorage.setItem('goft3_operation_id', selectedOperationId.toString());
        else localStorage.removeItem('goft3_operation_id');
        
        if (selectedEngagementId !== null) localStorage.setItem('goft3_engagement_id', selectedEngagementId.toString());
        else localStorage.removeItem('goft3_engagement_id');
        
        if (selectedPaiementId !== null) localStorage.setItem('goft3_paiement_id', selectedPaiementId.toString());
        else localStorage.removeItem('goft3_paiement_id');
        
        if (selectedTab) localStorage.setItem('goft3_tab', selectedTab);
        else localStorage.removeItem('goft3_tab');
        
    }, [currentPage, currentUser, selectedOperationId, selectedEngagementId, selectedPaiementId, selectedTab]);


    const handleLogin = useCallback((user: User) => {
        setCurrentUser(user);
        sessionStorage.setItem('goft3_user', JSON.stringify(user));
        
        // Restore previous page if exists, otherwise default to HOME
        const savedPage = localStorage.getItem('goft3_page') as Page;
        setCurrentPage(savedPage || 'HOME');
    }, []);

    const handleUpdateUser = useCallback((user: User) => {
        setCurrentUser(user);
        sessionStorage.setItem('goft3_user', JSON.stringify(user));
    }, []);

    const handleLogout = useCallback(() => {
        setCurrentUser(null);
        sessionStorage.removeItem('goft3_user');
        localStorage.removeItem('goft3_page');
        localStorage.removeItem('goft3_operation_id');
        localStorage.removeItem('goft3_engagement_id');
        localStorage.removeItem('goft3_paiement_id');
        localStorage.removeItem('goft3_tab');
        setCurrentPage('LOGIN');
    }, []);

    const navigate = useCallback((page: Page, id?: number, tab?: string) => {
        setNavigationHistory(prev => {
            // Avoid duplicates at the top of the stack
            if (prev.length > 0 && prev[prev.length - 1].page === currentPage && prev[prev.length - 1].id === selectedOperationId) {
                return prev;
            }
            return [...prev, { page: currentPage, id: selectedOperationId, tab: selectedTab, engagementId: selectedEngagementId, paiementId: selectedPaiementId }];
        });

        setCurrentPage(page);
        setSelectedTab(tab);

        const opId = (id !== undefined && id !== null && !isNaN(id)) ? id : null;

        if (page === 'OPERATION_DETAILS' || page === 'DOCUMENTS' || page === 'DOCUMENT_DETAILS' || page === 'BENEFICIARIES' || page === 'FINANCIAL_STATUS_BY_STRUCTURE' || page === 'PRINT_FINANCIAL_STATUS_BY_STRUCTURE' || page === 'PRINT_FINANCIAL_STATUS_BY_STRUCTURE_COMMITMENT' || page === 'PRINT_PROJECT_TRACKING' || page === 'PRINT_PAYMENT_CLAIMS' || page === 'PRINT_AE_INSUFFICIENCY' || page === 'PRINT_BORDEREAU' || page === 'CUSTOM_REPORT') {
            setSelectedOperationId(opId);
        } else if (page === 'PRINT_ENGAGEMENT') {
            setSelectedEngagementId(opId);
        } else if (page === 'PRINT_PAIEMENT' || page === 'PRINT_CERTIFICAT' || page === 'PRINT_MANDAT' || page === 'PRINT_DECLARATION' || page === 'PRINT_MANDAT_TABLE') {
            setSelectedPaiementId(opId);
        }
    }, [currentPage, selectedOperationId, selectedTab, selectedEngagementId, selectedPaiementId]);

    const goBack = useCallback(() => {
        if (navigationHistory.length === 0) {
            setCurrentPage('HOME');
            return;
        }

        const newHistory = [...navigationHistory];
        const lastPage = newHistory.pop();
        
        if (lastPage) {
            setNavigationHistory(newHistory);
            setCurrentPage(lastPage.page);
            setSelectedOperationId(lastPage.id);
            setSelectedEngagementId(lastPage.engagementId ?? null);
            setSelectedPaiementId(lastPage.paiementId ?? null);
            setSelectedTab(lastPage.tab);
        }
    }, [navigationHistory]);

    if (showSplash) {
        return <SplashScreen />;
    }

    return (
        <QueryClientProvider client={queryClient}>
            <LanguageProvider>
                <DataProvider>
                    <ToastProvider>
                        <div className="bg-gray-100 min-h-screen text-gray-800 transition-colors duration-300 overflow-x-hidden">
                        <AnimatePresence mode="wait">
                            {!currentUser ? (
                                <motion.div
                                    key="login"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className="w-full"
                                >
                                    <LoginPage onLogin={handleLogin} />
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="app"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className="w-full"
                                >
                                    <AuthenticatedApp
                                        currentPage={currentPage}
                                        navigate={navigate}
                                        onLogout={handleLogout}
                                        onGoBack={goBack}
                                        onUpdateUser={handleUpdateUser}
                                        canGoBack={navigationHistory.length > 0}
                                        currentUser={currentUser}
                                        selectedOperationId={selectedOperationId}
                                        selectedEngagementId={selectedEngagementId}
                                        selectedPaiementId={selectedPaiementId}
                                        selectedTab={selectedTab}
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </ToastProvider>
            </DataProvider>
        </LanguageProvider>
        </QueryClientProvider>
    );
};

export default App;
