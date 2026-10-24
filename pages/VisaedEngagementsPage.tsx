import React, { useState, useMemo, useEffect } from 'react';
import { Page, User } from '../types';
import { useData } from '../context/DataContext';
import PageWrapper from '../components/PageWrapper';
import { exportToFormattedExcel } from '../utils/exportToCsv';
import { formatCurrency } from '../utils/currencyUtils';
import CustomDropdown from '../components/CustomDropdown';

interface VisaedEngagementsPageProps {
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

const normalizeDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '';
    if (dateStr.includes('-')) {
        const [y, m, d] = dateStr.split('-');
        return `${d}/${m}/${y}`;
    }
    return dateStr;
};

const VisaedEngagementsPage: React.FC<VisaedEngagementsPageProps> = ({ navigate, onGoBack, currentUser }) => {
    const { db, loading } = useData();
    const [selectedYear, setSelectedYear] = useState(sessionStorage.getItem('goft3_selectedYear') || new Date().getFullYear().toString());
    const [selectedAction, setSelectedAction] = useState(sessionStorage.getItem('goft3_fs_action') || '');

    const years = useMemo(() => [...new Set(db.T_CP.map(cp => cp.ANNEE))].sort((a, b) => parseInt(b) - parseInt(a)), [db.T_CP]);

    useEffect(() => {
        sessionStorage.setItem('goft3_selectedYear', selectedYear);
        sessionStorage.setItem('goft3_fs_action', selectedAction);
        sessionStorage.setItem('goft3_selectedActivity', selectedAction);
    }, [selectedYear, selectedAction]);

    const activities = useMemo(() => {
        let ops = db.T_OPERATION;
        if (currentUser.ROLE !== 'admin' && currentUser.ALLOWED_OPERATIONS) {
            try {
                const allowedOps = JSON.parse(currentUser.ALLOWED_OPERATIONS) as number[];
                if (allowedOps.length > 0) {
                    ops = ops.filter(op => allowedOps.includes(op.ID_OPERATION));
                }
            } catch (e) {
                console.error("Error parsing allowed operations", e);
            }
        }
        const actionCodesInUse = [...new Set(ops.map(op => op.N_OPERATION.split('.')[5]).filter(Boolean))];
        const actionCodeToNameMap = new Map(db.T_DIRECTION.map(d => [d.ACTION, d.INT_ACTION]));
        const inUseActivities = actionCodesInUse.map((code: string) => {
            const name = actionCodeToNameMap.get(code) || `(${code})`;
            return { value: code, label: `${code} - ${name}` };
        });
        inUseActivities.sort((a, b) => a.value.localeCompare(b.value));
        return inUseActivities;
    }, [db.T_OPERATION, db.T_DIRECTION, currentUser]);

    const { data: reportData, totals: reportTotals } = useMemo(() => {
        if (loading) return { data: [], totals: null };

        const openOperations = db.T_OPERATION.filter(op => {
            if (op.status !== 'جارية') return false;

            // Check authorization
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
                return opActionCode === selectedAction;
            }
            return true;
        });

        const data = openOperations.map(op => {
            // Calculate final AE for this operation
            const rubriquesOp = db.T_RUBRIQUE_OP.filter(ro => ro.ID_OPERATION === op.ID_OPERATION);
            let finalAE = 0;
            if (rubriquesOp.length > 0) {
                finalAE = rubriquesOp.reduce((sum, ro) => sum + (ro.MONTANT_FINALE ?? ro.MONTANT_INITIALE), 0);
            } else {
                const scategoriesOp = db.T_SCATEGORIE_OP.filter(so => so.ID_OPERATION === op.ID_OPERATION);
                finalAE = scategoriesOp.reduce((sum, so) => sum + (so.MONTANT_FINALE ?? so.MONTANT_INITIALE), 0);
            }

            // Find visaed engagements for the selected year
            const engsForYear = db.T_ENGAGEMENT.filter(e =>
                e.ID_OPERATION === op.ID_OPERATION &&
                e.ANNEE === selectedYear &&
                e.N_VISA_CB &&
                e.DATE_VISA_CB
            );

            const monthsData = Array(12).fill(0);

            engsForYear.forEach(eng => {
                const normDate = normalizeDate(eng.DATE_VISA_CB);
                const dateParts = normDate.split('/');
                if (dateParts.length === 3) {
                    const month = parseInt(dateParts[1], 10);
                    if (month >= 1 && month <= 12) {
                        let amount = 0;
                        if (eng.NATURE_ENG === 'سحب' || eng.NATURE_ENG === 'إنخفاض التقييم') {
                            amount = -eng.MONTANT_ENG;
                        } else if (eng.NATURE_ENG === 'التزام' || eng.NATURE_ENG === 'ملحق' || eng.NATURE_ENG === 'فاتورة' || eng.NATURE_ENG === 'إعادة التقييم') {
                            amount = eng.MONTANT_ENG;
                        }
                        monthsData[month - 1] += amount;
                    }
                }
            });

            const q1 = monthsData[0] + monthsData[1] + monthsData[2];
            const q2 = monthsData[3] + monthsData[4] + monthsData[5];
            const q3 = monthsData[6] + monthsData[7] + monthsData[8];
            const q4 = monthsData[9] + monthsData[10] + monthsData[11];

            return {
                ...op,
                finalAE,
                monthsData,
                q1, q2, q3, q4
            };
        }).filter(item => item.finalAE > 0 || item.q1 > 0 || item.q2 > 0 || item.q3 > 0 || item.q4 > 0);

        const totals = data.reduce((acc, row) => {
            acc.finalAE += row.finalAE;
            for (let i = 0; i < 12; i++) {
                acc.monthsData[i] += row.monthsData[i];
            }
            acc.q1 += row.q1;
            acc.q2 += row.q2;
            acc.q3 += row.q3;
            acc.q4 += row.q4;
            return acc;
        }, { finalAE: 0, monthsData: Array(12).fill(0), q1: 0, q2: 0, q3: 0, q4: 0 });

        return { data, totals };
    }, [db, loading, selectedYear, selectedAction]);

    const handleExport = () => {
        if (reportData.length === 0) {
            alert('لا توجد بيانات للتصدير.');
            return;
        }

        const activityName = activities.find(a => a.value === selectedAction)?.label || 'الكل';
        const titleText = `جدول الإلتزامات المؤشرة من طرف المراقب الميزانياتي لسنة المالية ${selectedYear}`;
        const activityText = `النشاط : ${activityName}`;

        const styles = `<style> table, th, td { border: 1px solid black; border-collapse: collapse; text-align: center; padding: 5px; font-family: Arial, sans-serif; vertical-align: middle; } th { background-color: #f2f2f2; font-weight: bold; } .total { background-color: #e2efd9; font-weight: bold; } td { mso-number-format:"\\@"; } .currency { mso-number-format:"\\#\\,##0\\.00"; text-align: right; } .op-title { text-align: right; } </style>`;

        let tableHtml = `${styles}
            <table>
                <thead>
                    <tr><th colspan="18" style="font-size:16px; border:none; padding:10px;">الجمهورية الجزائرية الديمقراطية الشعبية</th></tr>
                    <tr><th colspan="18" style="font-size:14px; border:none; padding:5px; text-align: right;">وزارة الأشغال العمومية و المنشآت القاعدية</th></tr>
                    <tr><th colspan="18" style="font-size:14px; border:none; padding:5px; text-align: right;">مديرية الأشغال العمومية</th></tr>
                    <tr><th colspan="18" style="font-size:14px; border:none; padding:5px; text-align: right;">لولاية غليزان</th></tr>
                    <tr><th colspan="18" style="font-size:16px; border:none; padding:15px; font-weight:bold;">${titleText}</th></tr>
                    <tr><th colspan="18" style="font-size:14px; border:none; padding:5px; text-align: right;">${activityText}</th></tr>
                    <tr>
                        <th rowspan="2">رقم و عنوان العملية</th>
                        <th rowspan="2">رخصة الإلتزام النهائية</th>
                        <th colspan="4">مبلغ الإلتزام للثلاثي الأول</th>
                        <th colspan="4">مبلغ الإلتزام للثلاثي الثاني</th>
                        <th colspan="4">مبلغ الإلتزام للثلاثي الثالث</th>
                        <th colspan="4">مبلغ الإلتزام للثلاثي الرابع</th>
                    </tr>
                    <tr>
                        <th>جانفي</th><th>فيفري</th><th>مارس</th><th>المجموع الثلاثي الأول</th>
                        <th>أفريل</th><th>ماي</th><th>جوان</th><th>المجموع الثلاثي الثاني</th>
                        <th>جويلية</th><th>أوت</th><th>سبتمبر</th><th>المجموع الثلاثي الثالث</th>
                        <th>أكتوبر</th><th>نوفمبر</th><th>ديسمبر</th><th>المجموع الثلاثي الرابع</th>
                    </tr>
                </thead>
                <tbody>`;

        reportData.forEach(row => {
            tableHtml += `<tr>
                <td class="op-title">${row.N_OPERATION}<br/>${row.INT_OPERATION}</td>
                <td class="currency">${formatCurrencyForExcel(row.finalAE)}</td>
                
                <td class="currency">${formatCurrencyForExcel(row.monthsData[0])}</td>
                <td class="currency">${formatCurrencyForExcel(row.monthsData[1])}</td>
                <td class="currency">${formatCurrencyForExcel(row.monthsData[2])}</td>
                <td class="currency" style="font-weight:bold">${formatCurrencyForExcel(row.q1)}</td>
                
                <td class="currency">${formatCurrencyForExcel(row.monthsData[3])}</td>
                <td class="currency">${formatCurrencyForExcel(row.monthsData[4])}</td>
                <td class="currency">${formatCurrencyForExcel(row.monthsData[5])}</td>
                <td class="currency" style="font-weight:bold">${formatCurrencyForExcel(row.q2)}</td>
                
                <td class="currency">${formatCurrencyForExcel(row.monthsData[6])}</td>
                <td class="currency">${formatCurrencyForExcel(row.monthsData[7])}</td>
                <td class="currency">${formatCurrencyForExcel(row.monthsData[8])}</td>
                <td class="currency" style="font-weight:bold">${formatCurrencyForExcel(row.q3)}</td>
                
                <td class="currency">${formatCurrencyForExcel(row.monthsData[9])}</td>
                <td class="currency">${formatCurrencyForExcel(row.monthsData[10])}</td>
                <td class="currency">${formatCurrencyForExcel(row.monthsData[11])}</td>
                <td class="currency" style="font-weight:bold">${formatCurrencyForExcel(row.q4)}</td>
            </tr>`;
        });

        if (reportTotals) {
            tableHtml += `<tr class="total">
                <td>المجموع</td>
                <td class="currency">${formatCurrencyForExcel(reportTotals.finalAE)}</td>
                
                <td class="currency">${formatCurrencyForExcel(reportTotals.monthsData[0])}</td>
                <td class="currency">${formatCurrencyForExcel(reportTotals.monthsData[1])}</td>
                <td class="currency">${formatCurrencyForExcel(reportTotals.monthsData[2])}</td>
                <td class="currency">${formatCurrencyForExcel(reportTotals.q1)}</td>
                
                <td class="currency">${formatCurrencyForExcel(reportTotals.monthsData[3])}</td>
                <td class="currency">${formatCurrencyForExcel(reportTotals.monthsData[4])}</td>
                <td class="currency">${formatCurrencyForExcel(reportTotals.monthsData[5])}</td>
                <td class="currency">${formatCurrencyForExcel(reportTotals.q2)}</td>
                
                <td class="currency">${formatCurrencyForExcel(reportTotals.monthsData[6])}</td>
                <td class="currency">${formatCurrencyForExcel(reportTotals.monthsData[7])}</td>
                <td class="currency">${formatCurrencyForExcel(reportTotals.monthsData[8])}</td>
                <td class="currency">${formatCurrencyForExcel(reportTotals.q3)}</td>
                
                <td class="currency">${formatCurrencyForExcel(reportTotals.monthsData[9])}</td>
                <td class="currency">${formatCurrencyForExcel(reportTotals.monthsData[10])}</td>
                <td class="currency">${formatCurrencyForExcel(reportTotals.monthsData[11])}</td>
                <td class="currency">${formatCurrencyForExcel(reportTotals.q4)}</td>
            </tr>`;
        }

        tableHtml += `</tbody></table>`;
        exportToFormattedExcel(tableHtml, `visaed_engagements_${selectedYear}.xls`);
    };

    if (loading) return <div className="p-8 text-center text-gray-600">جار تحميل البيانات...</div>;

    return (
        <PageWrapper
            title="جدول الإلتزامات المؤشرة من طرف المراقب الميزانياتي"
            navigate={navigate}
            onGoBack={onGoBack}
            backPage='FINANCIAL_STATUS'
            currentUser={currentUser}
        >
            <div className="bg-blue-100 p-4 rounded-lg shadow-md mb-6 border border-blue-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">السنة المالية</label>
                        <CustomDropdown
                            options={years.map(y => ({ value: y, label: y }))}
                            value={selectedYear}
                            onChange={setSelectedYear}
                            placeholder="اختر السنة"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">تصفية حسب النشاط</label>
                        <CustomDropdown
                            options={[{ value: '', label: 'كل النشاطات' }, ...activities]}
                            value={selectedAction}
                            onChange={setSelectedAction}
                            placeholder="اختر النشاط"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleExport} disabled={reportData.length === 0} className="bg-teal-500 text-white px-4 py-2 rounded-lg shadow hover:bg-teal-600 transition-colors w-full disabled:bg-gray-400">
                            <i className="bi bi-file-earmark-excel mr-2"></i> تصدير إلى Excel
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow-md max-h-[calc(100vh-320px)] overflow-auto custom-scrollbar">
                <table className="w-full text-center text-xs border-collapse border border-gray-300 min-w-[1200px] relative">
                    <thead className="bg-gray-100 text-gray-700 sticky top-0 z-20 shadow-sm">
                        <tr>
                            <th colSpan={18} className="p-2 border border-gray-300 text-lg font-bold bg-white text-gray-800">
                                جدول الإلتزامات المؤشرة من طرف المراقب الميزانياتي لسنة المالية {selectedYear}
                            </th>
                        </tr>
                        <tr>
                            <th rowSpan={2} className="p-2 border border-gray-300 w-64 bg-gray-200">رقم و عنوان العملية</th>
                            <th rowSpan={2} className="p-2 border border-gray-300 w-32 bg-gray-200">رخصة الإلتزام النهائية</th>
                            <th colSpan={4} className="p-2 border border-gray-300 bg-blue-50">مبلغ الإلتزام للثلاثي الأول</th>
                            <th colSpan={4} className="p-2 border border-gray-300 bg-green-50">مبلغ الإلتزام للثلاثي الثاني</th>
                            <th colSpan={4} className="p-2 border border-gray-300 bg-yellow-50">مبلغ الإلتزام للثلاثي الثالث</th>
                            <th colSpan={4} className="p-2 border border-gray-300 bg-purple-50">مبلغ الإلتزام للثلاثي الرابع</th>
                        </tr>
                        <tr>
                            {/* Q1 */}
                            <th className="p-1 border border-gray-300 bg-blue-50 font-medium">جانفي</th>
                            <th className="p-1 border border-gray-300 bg-blue-50 font-medium">فيفري</th>
                            <th className="p-1 border border-gray-300 bg-blue-50 font-medium">مارس</th>
                            <th className="p-1 border border-gray-300 bg-blue-100 font-bold">المجموع</th>

                            {/* Q2 */}
                            <th className="p-1 border border-gray-300 bg-green-50 font-medium">أفريل</th>
                            <th className="p-1 border border-gray-300 bg-green-50 font-medium">ماي</th>
                            <th className="p-1 border border-gray-300 bg-green-50 font-medium">جوان</th>
                            <th className="p-1 border border-gray-300 bg-green-100 font-bold">المجموع</th>

                            {/* Q3 */}
                            <th className="p-1 border border-gray-300 bg-yellow-50 font-medium">جويلية</th>
                            <th className="p-1 border border-gray-300 bg-yellow-50 font-medium">أوت</th>
                            <th className="p-1 border border-gray-300 bg-yellow-50 font-medium">سبتمبر</th>
                            <th className="p-1 border border-gray-300 bg-yellow-100 font-bold">المجموع</th>

                            {/* Q4 */}
                            <th className="p-1 border border-gray-300 bg-purple-50 font-medium">أكتوبر</th>
                            <th className="p-1 border border-gray-300 bg-purple-50 font-medium">نوفمبر</th>
                            <th className="p-1 border border-gray-300 bg-purple-50 font-medium">ديسمبر</th>
                            <th className="p-1 border border-gray-300 bg-purple-100 font-bold">المجموع</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reportData.map(row => (
                            <tr key={row.ID_OPERATION} className="hover:bg-gray-50 text-gray-800">
                                <td className="p-2 border border-gray-300 text-center">
                                    <div className="font-bold text-gray-900">{row.N_OPERATION}</div>
                                    <div className="text-[10px] text-gray-600 line-clamp-2" title={row.INT_OPERATION}>{row.INT_OPERATION}</div>
                                </td>
                                <td className="p-2 border border-gray-300 font-semibold text-right">{formatCurrency(row.finalAE)}</td>

                                {/* Q1 */}
                                <td className="p-2 border border-gray-300 text-right">{row.monthsData[0] !== 0 ? formatCurrency(row.monthsData[0]) : ''}</td>
                                <td className="p-2 border border-gray-300 text-right">{row.monthsData[1] !== 0 ? formatCurrency(row.monthsData[1]) : ''}</td>
                                <td className="p-2 border border-gray-300 text-right">{row.monthsData[2] !== 0 ? formatCurrency(row.monthsData[2]) : ''}</td>
                                <td className="p-2 border border-gray-300 bg-blue-50 font-bold text-right">{row.q1 !== 0 ? formatCurrency(row.q1) : ''}</td>

                                {/* Q2 */}
                                <td className="p-2 border border-gray-300 text-right">{row.monthsData[3] !== 0 ? formatCurrency(row.monthsData[3]) : ''}</td>
                                <td className="p-2 border border-gray-300 text-right">{row.monthsData[4] !== 0 ? formatCurrency(row.monthsData[4]) : ''}</td>
                                <td className="p-2 border border-gray-300 text-right">{row.monthsData[5] !== 0 ? formatCurrency(row.monthsData[5]) : ''}</td>
                                <td className="p-2 border border-gray-300 bg-green-50 font-bold text-right">{row.q2 !== 0 ? formatCurrency(row.q2) : ''}</td>

                                {/* Q3 */}
                                <td className="p-2 border border-gray-300 text-right">{row.monthsData[6] !== 0 ? formatCurrency(row.monthsData[6]) : ''}</td>
                                <td className="p-2 border border-gray-300 text-right">{row.monthsData[7] !== 0 ? formatCurrency(row.monthsData[7]) : ''}</td>
                                <td className="p-2 border border-gray-300 text-right">{row.monthsData[8] !== 0 ? formatCurrency(row.monthsData[8]) : ''}</td>
                                <td className="p-2 border border-gray-300 bg-yellow-50 font-bold text-right">{row.q3 !== 0 ? formatCurrency(row.q3) : ''}</td>

                                {/* Q4 */}
                                <td className="p-2 border border-gray-300 text-right">{row.monthsData[9] !== 0 ? formatCurrency(row.monthsData[9]) : ''}</td>
                                <td className="p-2 border border-gray-300 text-right">{row.monthsData[10] !== 0 ? formatCurrency(row.monthsData[10]) : ''}</td>
                                <td className="p-2 border border-gray-300 text-right">{row.monthsData[11] !== 0 ? formatCurrency(row.monthsData[11]) : ''}</td>
                                <td className="p-2 border border-gray-300 bg-purple-50 font-bold text-right">{row.q4 !== 0 ? formatCurrency(row.q4) : ''}</td>
                            </tr>
                        ))}
                        {reportData.length === 0 && (
                            <tr>
                                <td colSpan={18} className="p-8 text-center text-gray-500">لا توجد بيانات لهذه السنة والنشاط.</td>
                            </tr>
                        )}
                    </tbody>
                    {reportTotals && (
                        <tfoot className="bg-gray-200 font-bold text-gray-900 sticky bottom-0 z-20 shadow-[0_-2px_10px_rgba(0,0,0,0.1)]">
                            <tr>
                                <td className="p-2 border border-gray-300 text-center bg-gray-200">المجموع</td>
                                <td className="p-2 border border-gray-300 text-right bg-gray-200">{formatCurrency(reportTotals.finalAE)}</td>

                                <td className="p-2 border border-gray-300 text-right bg-gray-200">{formatCurrency(reportTotals.monthsData[0])}</td>
                                <td className="p-2 border border-gray-300 text-right bg-gray-200">{formatCurrency(reportTotals.monthsData[1])}</td>
                                <td className="p-2 border border-gray-300 text-right bg-gray-200">{formatCurrency(reportTotals.monthsData[2])}</td>
                                <td className="p-2 border border-gray-300 bg-blue-100 text-right">{formatCurrency(reportTotals.q1)}</td>

                                <td className="p-2 border border-gray-300 text-right bg-gray-200">{formatCurrency(reportTotals.monthsData[3])}</td>
                                <td className="p-2 border border-gray-300 text-right bg-gray-200">{formatCurrency(reportTotals.monthsData[4])}</td>
                                <td className="p-2 border border-gray-300 text-right bg-gray-200">{formatCurrency(reportTotals.monthsData[5])}</td>
                                <td className="p-2 border border-gray-300 bg-green-100 text-right">{formatCurrency(reportTotals.q2)}</td>

                                <td className="p-2 border border-gray-300 text-right bg-gray-200">{formatCurrency(reportTotals.monthsData[6])}</td>
                                <td className="p-2 border border-gray-300 text-right bg-gray-200">{formatCurrency(reportTotals.monthsData[7])}</td>
                                <td className="p-2 border border-gray-300 text-right bg-gray-200">{formatCurrency(reportTotals.monthsData[8])}</td>
                                <td className="p-2 border border-gray-300 bg-yellow-100 text-right">{formatCurrency(reportTotals.q3)}</td>

                                <td className="p-2 border border-gray-300 text-right bg-gray-200">{formatCurrency(reportTotals.monthsData[9])}</td>
                                <td className="p-2 border border-gray-300 text-right bg-gray-200">{formatCurrency(reportTotals.monthsData[10])}</td>
                                <td className="p-2 border border-gray-300 text-right bg-gray-200">{formatCurrency(reportTotals.monthsData[11])}</td>
                                <td className="p-2 border border-gray-300 bg-purple-100 text-right">{formatCurrency(reportTotals.q4)}</td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
        </PageWrapper>
    );
};

export default VisaedEngagementsPage;
