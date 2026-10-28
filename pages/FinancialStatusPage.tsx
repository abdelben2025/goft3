
import React, { useState, useMemo, useEffect } from 'react';
import { Page, User } from '../types';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { normalizeDate } from '../utils/dateUtils';
import PageWrapper from '../components/PageWrapper';
import { exportToFormattedExcel } from '../utils/exportToCsv';
import { formatCurrency } from '../utils/currencyUtils';
import CustomDropdown from '../components/CustomDropdown';

interface FinancialStatusPageProps {
    navigate: (page: Page, operationId?: number, tab?: string) => void;
    onGoBack?: () => void;
    currentUser: User;
}

const formatCurrencyForExcel = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return '0,00';
    return new Intl.NumberFormat('ar-DZ', {
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
};

const FinancialStatusPage: React.FC<FinancialStatusPageProps> = ({ navigate, onGoBack, currentUser }) => {
    const { db, loading } = useData();
    const { t } = useLanguage();
    const [selectedYear, setSelectedYear] = useState(sessionStorage.getItem('goft3_selectedYear') || new Date().getFullYear().toString());
    const [selectedMonth, setSelectedMonth] = useState(sessionStorage.getItem('goft3_fs_month') || (new Date().getMonth() + 1).toString());
    const [selectedAction, setSelectedAction] = useState(sessionStorage.getItem('goft3_fs_action') || '');
    const [selectedTypeOp, setSelectedTypeOp] = useState<string>(() => sessionStorage.getItem('goft3_fs_type') || 'all');

    const uniqueTypeOps = useMemo(() => {
        const types = new Set<string>();
        db.T_OPERATION.forEach(op => {
            if (op.TYPE_OP) types.add(op.TYPE_OP);
        });
        const stored = localStorage.getItem('goft3_operation_types');
        if (stored) {
            try {
                const parsed = JSON.parse(stored) as string[];
                parsed.forEach(t => types.add(t));
            } catch {
                // ignore
            }
        }
        return Array.from(types).sort();
    }, [db.T_OPERATION]);

    const years = useMemo(() => [...new Set(db.T_CP.map(cp => cp.ANNEE))].sort((a, b) => parseInt(b) - parseInt(a)), [db.T_CP]);

    useEffect(() => {
        sessionStorage.setItem('goft3_selectedYear', selectedYear);
        sessionStorage.setItem('goft3_fs_month', selectedMonth);
        sessionStorage.setItem('goft3_fs_action', selectedAction);
        sessionStorage.setItem('goft3_fs_type', selectedTypeOp);
        // Sync activity for Operations Table print page
        sessionStorage.setItem('goft3_selectedActivity', selectedAction);

        // Save filters for print page
        sessionStorage.setItem('goft3_fs_filters', JSON.stringify({
            year: selectedYear,
            month: selectedMonth,
            action: selectedAction,
            type: selectedTypeOp
        }));

    }, [selectedYear, selectedMonth, selectedAction, selectedTypeOp]);

    const activities = useMemo(() => {
        const actionCodesInUse = [...new Set(db.T_OPERATION.map(op => op.N_OPERATION.split('.')[5]).filter(Boolean))];
        const actionCodeToNameMap = new Map(db.T_DIRECTION.map(d => [d.ACTION, d.INT_ACTION]));
        const inUseActivities = actionCodesInUse.map((code: string) => {
            const name = actionCodeToNameMap.get(code) || `(${code})`;
            return { value: code, label: `${code} - ${name}` };
        });
        inUseActivities.sort((a, b) => a.value.localeCompare(b.value));
        return inUseActivities;
    }, [db.T_OPERATION, db.T_DIRECTION]);

    const { data: financialStatusData, totals: financialStatusTotals } = useMemo(() => {
        if (loading) return { data: [], totals: null };

        const openOperations = db.T_OPERATION.filter(op => {
            if (op.status !== 'جارية') return false;

            // Authorization: Filter by specifically assigned operations
            if (currentUser.ROLE !== 'admin' && currentUser.ALLOWED_OPERATIONS) {
                try {
                    const allowedOps = JSON.parse(currentUser.ALLOWED_OPERATIONS) as number[];
                    if (allowedOps.length > 0 && !allowedOps.includes(op.ID_OPERATION)) {
                        return false;
                    }
                } catch (e) {
                    console.error("Error parsing allowed operations", e);
                }
            }

            if (selectedAction) {
                const opActionCode = op.N_OPERATION.split('.')[5];
                if (opActionCode !== selectedAction) return false;
            }
            if (selectedTypeOp !== 'all' && op.TYPE_OP !== selectedTypeOp) {
                return false;
            }
            return true;
        });

        const data = openOperations.map(op => {
            const cpFinale = db.T_CP
                .filter(cp => cp.ID_OPERATION === op.ID_OPERATION && cp.ANNEE === selectedYear)
                .reduce((sum, cp) => sum + cp.MONTANT_FINALE_CP, 0);

            const paiementsCurrentYearList = db.T_PAIEMENT
                .filter(p => p.ID_OPERATION === op.ID_OPERATION && p.ANNEE === selectedYear);

            const selectedMonthInt = parseInt(selectedMonth, 10);

            let paiementsCurrentMonth = 0;
            let paiementsFuture = 0;
            let totalPaiementsYear = 0;

            paiementsCurrentYearList.forEach(p => {
                totalPaiementsYear += p.MONTANT_PAI;

                const normDate = normalizeDate(p.DATE_PAI);
                const dateParts = normDate.split('/');

                let paymentMonth = 0;
                if (dateParts.length === 3) {
                    paymentMonth = parseInt(dateParts[1], 10);
                }

                if (paymentMonth === selectedMonthInt) {
                    paiementsCurrentMonth += p.MONTANT_PAI;
                } else if (paymentMonth > selectedMonthInt) {
                    paiementsFuture += p.MONTANT_PAI;
                }
            });

            const totalPaiementsForPeriod = totalPaiementsYear - paiementsFuture;
            const paiementsPrevious = totalPaiementsForPeriod - paiementsCurrentMonth;

            const remainingBalance = cpFinale - totalPaiementsForPeriod;

            return {
                ...op,
                cpFinale,
                paiementsPrevious,
                paiementsCurrentMonth,
                totalPaiementsCurrentYear: totalPaiementsForPeriod,
                remainingBalance
            };
        }).filter(item => item.cpFinale > 0 || item.totalPaiementsCurrentYear > 0);

        const totals = data.reduce((acc, row) => {
            acc.cpFinale += row.cpFinale;
            acc.paiementsPrevious += row.paiementsPrevious;
            acc.paiementsCurrentMonth += row.paiementsCurrentMonth;
            acc.totalPaiementsCurrentYear += row.totalPaiementsCurrentYear;
            acc.remainingBalance += row.remainingBalance;
            return acc;
        }, { cpFinale: 0, paiementsPrevious: 0, paiementsCurrentMonth: 0, totalPaiementsCurrentYear: 0, remainingBalance: 0 });

        return { data, totals };
    }, [db, loading, selectedYear, selectedMonth, selectedAction, selectedTypeOp]);

    const handleExport = () => {
        if (financialStatusData.length === 0) {
            alert('لا توجد بيانات للتصدير.');
            return;
        }

        const headers = [
            t('col.operation_info'), t('col.cp_year', { year: selectedYear }),
            t('col.previous_payment'), t('col.monthly_payment'),
            t('col.total_payments'), t('col.balance')
        ];

        const styles = `<style> table, th, td { border: 1px solid black; border-collapse: collapse; text-align: right; padding: 5px; font-family: Arial, sans-serif; vertical-align: middle; } th { background-color: #DDEBF7; font-weight: bold; text-align: center; } .total { background-color: #A9D08E; font-weight: bold; } td { mso-number-format:"\\@"; } .currency { mso-number-format:"\\#\\,##0\\.00"; } </style>`;

        let tableHtml = `${styles}<table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>`;

        financialStatusData.forEach(row => {
            tableHtml += `<tr>
                <td>${row.N_OPERATION}<br/>${row.INT_OPERATION}</td>
                <td class="currency">${formatCurrencyForExcel(row.cpFinale)}</td>
                <td class="currency">${formatCurrencyForExcel(row.paiementsPrevious)}</td>
                <td class="currency">${formatCurrencyForExcel(row.paiementsCurrentMonth)}</td>
                <td class="currency">${formatCurrencyForExcel(row.totalPaiementsCurrentYear)}</td>
                <td class="currency">${formatCurrencyForExcel(row.remainingBalance)}</td>
            </tr>`;
        });

        if (financialStatusTotals) {
            tableHtml += `</tbody><tfoot class="total"><tr>
                <td>${t('lbl.total')}</td>
                <td class="currency">${formatCurrencyForExcel(financialStatusTotals.cpFinale)}</td>
                <td class="currency">${formatCurrencyForExcel(financialStatusTotals.paiementsPrevious)}</td>
                <td class="currency">${formatCurrencyForExcel(financialStatusTotals.paiementsCurrentMonth)}</td>
                <td class="currency">${formatCurrencyForExcel(financialStatusTotals.totalPaiementsCurrentYear)}</td>
                <td class="currency">${formatCurrencyForExcel(financialStatusTotals.remainingBalance)}</td>
            </tr></tfoot></table>`;
        } else {
            tableHtml += `</tbody></table>`;
        }

        exportToFormattedExcel(tableHtml, `financial_status_${selectedYear}_${selectedMonth}.xls`);
    };

    if (loading) return <div>{t('loading')}</div>;

    const monthOptions = Array.from({ length: 12 }, (_, i) => ({ value: (i + 1).toString(), label: t(`month.${i + 1}`) }));

    return (
        <PageWrapper
            title={t('print.title.financial_status', { month: t(`month.${parseInt(selectedMonth)}`), year: selectedYear })}
            navigate={navigate}
            onGoBack={onGoBack}
            backPage='HOME'
            currentUser={currentUser}
            actions={
                <div className="flex flex-wrap gap-2">
                    <button onClick={() => navigate('FINANCIAL_STATUS_BY_STRUCTURE')} className="bg-indigo-500 text-white px-2 py-0.5 rounded-[20px] hover:bg-indigo-600 transition-colors text-xs">
                        <i className="bi bi-diagram-3 mr-1"></i> {t('btn.structure_status')}
                    </button>
                    <button onClick={() => navigate('PROJECT_TRACKING')} className="bg-purple-500 text-white px-2 py-0.5 rounded-[20px] hover:bg-purple-600 transition-colors text-xs">
                        <i className="bi bi-list-check mr-1"></i> {t('btn.project_tracking')}
                    </button>
                    <button onClick={() => navigate('PAYMENT_CLAIMS')} className="bg-orange-500 text-white px-2 py-0.5 rounded-[20px] hover:bg-orange-600 transition-colors text-xs">
                        <i className="bi bi-cash-stack mr-1"></i> {t('btn.payment_claims')}
                    </button>
                    <button onClick={() => navigate('AE_INSUFFICIENCY')} className="bg-red-500 text-white px-2 py-0.5 rounded-[20px] hover:bg-red-600 transition-colors text-xs">
                        <i className="bi bi-exclamation-triangle mr-1"></i> {t('btn.ae_insufficiency')}
                    </button>
                    <button onClick={() => navigate('UNREGISTERED_DOCUMENTS')} className="bg-amber-500 text-white px-2 py-0.5 rounded-[20px] hover:bg-amber-600 transition-colors text-xs">
                        <i className="bi bi-file-earmark-lock2 mr-1"></i> الوثائق غير المسجلة
                    </button>
                    <button onClick={() => navigate('VISAED_ENGAGEMENTS')} className="bg-teal-500 text-white px-2 py-0.5 rounded-[20px] hover:bg-teal-600 transition-colors text-xs">
                        <i className="bi bi-table mr-1"></i> جدول الإلتزامات المؤشرة
                    </button>
                    <button onClick={() => navigate('MONTHLY_COMMITMENTS_REPORT')} className="bg-blue-600 text-white px-2 py-0.5 rounded-[20px] hover:bg-blue-700 transition-colors text-xs">
                        <i className="bi bi-calendar-check mr-1"></i> الالتزامات حسب الشهر
                    </button>
                    <button onClick={() => navigate('MONTHLY_PAYMENTS_REPORT')} className="bg-emerald-600 text-white px-2 py-0.5 rounded-[20px] hover:bg-emerald-700 transition-colors text-xs">
                        <i className="bi bi-calendar-event mr-1"></i> الدفوعات حسب الشهر
                    </button>
                    <button onClick={() => navigate('LOTS_REPORT')} className="bg-cyan-600 text-white px-2 py-0.5 rounded-[20px] hover:bg-cyan-700 transition-colors text-xs">
                        <i className="bi bi-grid-3x3 mr-1"></i> جدول حصص العمليات
                    </button>
                    <button onClick={() => navigate('APPENDIX_01')} className="bg-blue-700 text-white px-2 py-0.5 rounded-[20px] hover:bg-blue-800 transition-colors text-xs">
                        <i className="bi bi-file-earmark-spreadsheet mr-1"></i> ملحق رقم 01
                    </button>
                </div>
            }
        >
            <div className="bg-blue-200 p-3 rounded-lg shadow-md mb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 items-end">
                    <div>
                       <label className="block text-xs font-medium text-gray-700 mb-1">{t('filter.year')}</label> 
                        <CustomDropdown
                            options={years.map(y => ({ value: y, label: y }))}
                            value={selectedYear}
                            onChange={setSelectedYear}
                            
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">{t('filter.month')}</label>
                        <CustomDropdown
                            options={monthOptions}
                            value={selectedMonth}
                            onChange={setSelectedMonth}
                            
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">{t('filter.activity')}</label>
                        <CustomDropdown
                            options={[{ value: '', label: t('filter.all_activities') }, ...activities]}
                            value={selectedAction}
                            onChange={setSelectedAction}
                            placeholder={t('filter.select_activity')}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">نوع العملية</label>
                        <CustomDropdown
                            options={[
                                { value: 'all', label: 'كل الأنواع' },
                                ...uniqueTypeOps.map(t => ({ value: t, label: t }))
                            ]}
                            value={selectedTypeOp}
                            onChange={setSelectedTypeOp}
                            placeholder="اختر نوع العملية"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => navigate('PRINT_FINANCIAL_STATUS')} className="bg-blue-500 text-white px-2 py-0.5 rounded-[20px] shadow hover:bg-blue-600 transition-colors w-full h-8 text-xs">
                            <i className="bi bi-printer mr-2"></i> {t('btn.print')}
                        </button>
                        <button onClick={handleExport} disabled={financialStatusData.length === 0} className="bg-teal-500 text-white px-2 py-0.5 rounded-[20px] shadow hover:bg-teal-600 transition-colors w-full disabled:bg-gray-400 h-8 text-xs">
                            <i className="bi bi-file-earmark-excel mr-2"></i> {t('btn.export')}
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white p-3 rounded-lg shadow-md overflow-auto max-h-[calc(100vh-16rem)] custom-scrollbar">
                <table className="w-full text-right min-w-[1000px] relative">
                    <thead className="bg-blue-200 text-black sticky top-0 z-20 shadow-sm">
                        <tr>
                            <th className="p-1 text-xs font-semibold uppercase tracking-wider w-1/3 bg-blue-200 sticky top-0 z-20">{t('col.operation_info')}</th>
                            <th className="p-1 text-xs font-semibold uppercase tracking-wider bg-blue-200 sticky top-0 z-20">{t('col.cp_year', { year: selectedYear })}</th>
                            <th className="p-1 text-xs font-semibold uppercase tracking-wider bg-blue-200 sticky top-0 z-20">{t('col.previous_payment')}</th>
                            <th className="p-1 text-xs font-semibold uppercase tracking-wider bg-blue-200 sticky top-0 z-20">{t('col.monthly_payment')}</th>
                            <th className="p-1 text-xs font-semibold uppercase tracking-wider bg-blue-200 sticky top-0 z-20">{t('col.total_payments')}</th>
                            <th className="p-1 text-xs font-semibold uppercase tracking-wider bg-blue-200 sticky top-0 z-20">{t('col.balance')}</th>
                            <th className="p-1 text-xs font-semibold uppercase tracking-wider bg-blue-200 sticky top-0 z-20">{t('col.details')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {financialStatusData.map(row => (
                            <tr key={row.ID_OPERATION} className="border-b hover:bg-blue-100 text-xs">
                                <td className="p-1 font-semibold text-gray-800">{row.N_OPERATION}<br /><span className="text-[10px] font-normal text-gray-600">{row.INT_OPERATION}</span></td>
                                <td className="p-1 text-gray-700">{formatCurrency(row.cpFinale)}</td>
                                <td className="p-1 text-gray-700">{formatCurrency(row.paiementsPrevious)}</td>
                                <td className="p-1 text-gray-700 font-bold">{formatCurrency(row.paiementsCurrentMonth)}</td>
                                <td className="p-1 text-gray-700">{formatCurrency(row.totalPaiementsCurrentYear)}</td>
                                <td className={`p-1 font-bold ${row.remainingBalance < 0 ? 'text-red-600' : 'text-green-600'}`}>{formatCurrency(row.remainingBalance)}</td>
                                <td className="p-1 text-center">
                                    <button onClick={() => navigate('OPERATION_DETAILS', row.ID_OPERATION, 'PAIEMENTS')} className="text-blue-500 hover:text-blue-700">
                                        <i className="bi bi-eye-fill"></i>
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    {financialStatusTotals && (
                        <tfoot className="bg-gray-300 font-bold text-gray-800 text-xs sticky bottom-0 z-20 shadow-[0_-2px_10px_rgba(0,0,0,0.1)]">
                            <tr>
                                <td className="p-1 text-center bg-gray-300">{t('lbl.total')}</td>
                                <td className="p-1 bg-gray-300">{formatCurrency(financialStatusTotals.cpFinale)}</td>
                                <td className="p-1 bg-gray-300">{formatCurrency(financialStatusTotals.paiementsPrevious)}</td>
                                <td className="p-1 bg-gray-300">{formatCurrency(financialStatusTotals.paiementsCurrentMonth)}</td>
                                <td className="p-1 bg-gray-300">{formatCurrency(financialStatusTotals.totalPaiementsCurrentYear)}</td>
                                <td className="p-1 bg-gray-300">{formatCurrency(financialStatusTotals.remainingBalance)}</td>
                                <td className="bg-gray-300"></td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </PageWrapper>
    );
};

export default FinancialStatusPage;
