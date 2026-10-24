import React, { useState, useMemo, useEffect } from 'react';
import { Page, User } from '../types';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import PageWrapper from '../components/PageWrapper';
import { exportToFormattedExcel } from '../utils/exportToCsv';
import { formatCurrency } from '../utils/currencyUtils';
import CustomDropdown from '../components/CustomDropdown';

interface Appendix01PageProps {
    navigate: (page: Page, id?: number, tab?: string) => void;
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

const Appendix01Page: React.FC<Appendix01PageProps> = ({ navigate, onGoBack, currentUser }) => {
    const { db, loading } = useData();
    const { t } = useLanguage();

    const [selectedYear, setSelectedYear] = useState(sessionStorage.getItem('goft3_selectedYear') || new Date().getFullYear().toString());
    const [selectedAction, setSelectedAction] = useState(sessionStorage.getItem('goft3_fs_action') || '');
    const [selectedProgramme, setSelectedProgramme] = useState(sessionStorage.getItem('goft3_fs_programme') || '');

    useEffect(() => {
        sessionStorage.setItem('goft3_selectedYear', selectedYear);
        sessionStorage.setItem('goft3_fs_action', selectedAction);
        sessionStorage.setItem('goft3_fs_programme', selectedProgramme);
    }, [selectedYear, selectedAction, selectedProgramme]);

    const years = useMemo(() => {
        const uniqueYears = [...new Set(db.T_CP.map(cp => cp.ANNEE))].filter(Boolean);
        uniqueYears.push(new Date().getFullYear().toString());
        return [...new Set(uniqueYears)].sort((a, b) => parseInt(b) - parseInt(a));
    }, [db.T_CP]);

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
        const actionCodesInUse = [...new Set(ops.map(op => {
            const parts = op.N_OPERATION.split('.');
            return parts.length >= 6 ? parts[5] : '';
        }).filter(Boolean))];
        const actionCodeToNameMap = new Map(db.T_DIRECTION.map(d => [d.ACTION, d.INT_ACTION]));
        const inUseActivities = actionCodesInUse.map((code: string) => {
            const name = actionCodeToNameMap.get(code) || `(${code})`;
            return { value: code, label: `${code} - ${name}` };
        });
        inUseActivities.sort((a, b) => a.value.localeCompare(b.value));
        return inUseActivities;
    }, [db.T_OPERATION, db.T_DIRECTION, currentUser]);

    const programmes = useMemo(() => {
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
        const progCodesInUse = [...new Set(ops.map(op => {
            const parts = op.N_OPERATION.split('.');
            return parts.length >= 4 ? parts[3] : '';
        }).filter(Boolean))];
        const inUseProgrammes = progCodesInUse.map((code: string) => {
            const name = db.T_PROGRAMME.find((p: any) => p.PROGRAMME === code)?.INT_PROGRAMME || `(${code})`;
            return { value: code, label: `${code} - ${name}` };
        });
        inUseProgrammes.sort((a, b) => a.value.localeCompare(b.value));
        return inUseProgrammes;
    }, [db.T_OPERATION, db.T_PROGRAMME, currentUser]);

    const { operationsData, aggregatedData } = useMemo(() => {
        if (loading) return { operationsData: [], aggregatedData: null };

        // Filter operations by year, programme and activity
        const operations = db.T_OPERATION.filter(op => {
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

            const parts = op.N_OPERATION.split('.');
            if (selectedProgramme) {
                if (parts.length >= 4 && parts[3] !== selectedProgramme) {
                    return false;
                }
            }
            if (selectedAction) {
                if (parts.length >= 6 && parts[5] !== selectedAction) {
                    return false;
                }
            }
            return true;
        });

        const opData = operations.map(op => {
            const parts = op.N_OPERATION.split('.');
            const portCode = parts.length >= 3 ? parts[2] : '';
            const progCode = parts.length >= 4 ? parts[3] : '';
            const sprogCode = parts.length >= 5 ? parts[4] : '';
            const actCode = parts.length >= 6 ? parts[5] : '';

            // Engagements up to the selected year
            const engagements = db.T_ENGAGEMENT.filter(e =>
                e.ID_OPERATION === op.ID_OPERATION &&
                (e.NATURE_ENG === 'التزام' || e.NATURE_ENG === 'ملحق') &&
                parseInt(e.ANNEE) <= parseInt(selectedYear)
            );
            const engagedAE = engagements.reduce((sum, e) => sum + e.MONTANT_ENG, 0);

            // Only consider total AE if the operation has engagements in or before the selected year
            let totalAE = 0;
            if (engagements.length > 0) {
                const rubriquesOp = db.T_RUBRIQUE_OP.filter(r => r.ID_OPERATION === op.ID_OPERATION);
                totalAE = rubriquesOp.reduce((sum, r) => sum + (r.MONTANT_FINALE ?? r.MONTANT_INITIALE), 0);
            }

            const availableAE = totalAE - engagedAE;

            return {
                ...op,
                portCode,
                progCode,
                sprogCode,
                actCode,
                totalAE,
                engagedAE,
                availableAE
            };
        }).filter(op => op.totalAE > 0 || op.engagedAE > 0);

        // Aggr functions
        const groupBy = (codeSelector: (op: any) => string) => {
            const map = new Map<string, { totalAE: number, engagedAE: number, availableAE: number }>();
            opData.forEach(op => {
                const code = codeSelector(op);
                if (!map.has(code)) map.set(code, { totalAE: 0, engagedAE: 0, availableAE: 0 });
                const current = map.get(code)!;
                current.totalAE += op.totalAE;
                current.engagedAE += op.engagedAE;
                current.availableAE += op.availableAE;
            });
            return map;
        };

        const programsData = groupBy(op => op.progCode);
        const subProgramsData = groupBy(op => op.sprogCode);
        const actionsData = groupBy(op => op.actCode);

        // Assuming a single dominant program/portefeuille based on the selected action (or just taking the first one for the header)
        const dominantOp = opData[0] || {};

        return {
            operationsData: opData,
            aggregatedData: {
                programsData,
                subProgramsData,
                actionsData,
                portCode: dominantOp.portCode || '',
                progCode: dominantOp.progCode || selectedProgramme || '',
                actCode: dominantOp.actCode || selectedAction || ''
            }
        };

    }, [db, loading, selectedYear, selectedAction, selectedProgramme]);

    const handleExport = () => {
        if (!aggregatedData || operationsData.length === 0) {
            alert('لا توجد بيانات للتصدير.');
            return;
        }

        const styles = `<style> 
            table { border-collapse: collapse; direction: rtl; width: 100%; font-family: Arial, sans-serif; }
            th, td { border: 1px solid black; padding: 5px; text-align: center; vertical-align: middle; }
            .header-info { text-align: right; font-weight: bold; border: none; }
            .currency { mso-number-format:"\\#\\,##0\\.00"; }
            .text-left { text-align: left; }
            .text-right { text-align: right; }
            .bg-gray { background-color: #f0f0f0; }
        </style>`;

        let tableHtml = `${styles}<table>`;

        // Append Header Rows like the image
        tableHtml += `
            <tr><th colspan="5" style="border:none; text-align:center; font-size: 18px;">ملحق 01<br/>الوضعية المالية للنقل رخص الإلتزام</th></tr>
            <tr><td colspan="5" style="border:none;">&nbsp;</td></tr>
            <tr><td colspan="5" class="header-info">وزارة الأشغال العمومية و المنشآت القاعدية</td></tr>
            <tr><td colspan="5" class="header-info">محفظة برنامج: ${aggregatedData.portCode}</td></tr>
            <tr><td colspan="5" class="header-info">برنامج: ${aggregatedData.progCode}</td></tr>
            <tr><td colspan="5" class="header-info">النشاط: ${aggregatedData.actCode}</td></tr>
            <tr><td colspan="5" class="header-info">السنة المالية ${parseInt(selectedYear)} (ن-1)</td></tr>
            <tr><td colspan="5" class="header-info">نقل للسنة المالية ${parseInt(selectedYear) + 1} (ن)</td></tr>
            <tr><td colspan="5" class="header-info">وضعية ميزانياتية معدة و مرسلة من طرف مسؤول النشاط</td></tr>
            <tr><td colspan="5" style="border:none;">&nbsp;</td></tr>
        `;

        tableHtml += `
            <thead>
                <tr>
                    <th style="background-color: #f0f0f0;">رمز / رقم العملية</th>
                    <th style="background-color: #f0f0f0;">برنامج / برنامج فرعي / نشاط / عملية</th>
                    <th style="background-color: #f0f0f0;">رخصة التزام حالية</th>
                    <th style="background-color: #f0f0f0;">رخصة التزام ملتزم بها</th>
                    <th style="background-color: #f0f0f0;">رخصة التزام متوفرة</th>
                </tr>
            </thead>
            <tbody>
        `;

        const renderTotalRow = (label: string, code: string, ae: number, engaged: number, available: number) => {
            return `
                <tr>
                    <td class="font-bold">${code}</td>
                    <td class="text-right font-bold">${label}</td>
                    <td class="currency">${formatCurrencyForExcel(ae)}</td>
                    <td class="currency">${formatCurrencyForExcel(engaged)}</td>
                    <td class="currency">${formatCurrencyForExcel(available)}</td>
                </tr>
            `;
        };

        // Render Programs
        aggregatedData.programsData.forEach((totals, code) => {
            const progName = db.T_PROGRAMME.find((p: any) => p.PROGRAMME === code)?.INT_PROGRAMME || 'منشآت القاعدية للطرق و الطرق السيارة';
            tableHtml += renderTotalRow(`البرنامج: ${progName}`, code, totals.totalAE, totals.engagedAE, totals.availableAE);
        });

        // Render Sub-programs
        const sortedSubPrograms = Array.from(aggregatedData.subProgramsData.entries()).sort((a, b) => a[0].localeCompare(b[0]));
        sortedSubPrograms.forEach(([code, totals]) => {
            const sprogName = db.T_SPROGRAMME.find((p: any) => p.SPROGRAMME === code)?.INT_SPROGRAMME || `تطوير المنشآت القاعدية للطرق`;
            tableHtml += renderTotalRow(`البرنامج الفرعي: ${sprogName}`, code, totals.totalAE, totals.engagedAE, totals.availableAE);
        });

        // Render Activities
        aggregatedData.actionsData.forEach((totals, code) => {
            const actName = db.T_DIRECTION.find((d: any) => d.ACTION === code)?.INT_ACTION || 'تطوير و صيانة المنشآت القاعدية للطرق و الطرق السيارة';
            tableHtml += renderTotalRow(`النشاط: ${actName}`, code, totals.totalAE, totals.engagedAE, totals.availableAE);
        });

        // Render detailed Sub-programs
        sortedSubPrograms.forEach(([spCode, _]) => {
            const spName = db.T_SPROGRAMME.find((p: any) => p.SPROGRAMME === spCode)?.INT_SPROGRAMME || `تطوير المنشآت القاعدية للطرق`;

            // Sub-program Header
            tableHtml += `
                <tr class="bg-gray">
                    <td colspan="5" class="text-center font-bold" style="background-color: #f0f0f0;">البرنامج الفرعي ${spCode} : ${spName}</td>
                </tr>
            `;

            // Operations for this sub-program
            const opsForSP = operationsData.filter(op => op.sprogCode === spCode);
            opsForSP.forEach(op => {
                tableHtml += `
                    <tr>
                        <td class="text-left text-sm" dir="ltr">${op.N_OPERATION}</td>
                        <td class="text-right text-sm">${op.INT_OPERATION}</td>
                        <td class="currency">${formatCurrencyForExcel(op.totalAE)}</td>
                        <td class="currency">${formatCurrencyForExcel(op.engagedAE)}</td>
                        <td class="currency">${formatCurrencyForExcel(op.availableAE)}</td>
                    </tr>
                `;
            });
        });

        tableHtml += `
            </tbody>
            <tfoot>
                <tr><td colspan="5" style="border:none;">&nbsp;</td></tr>
                <tr>
                    <td colspan="2" style="border:none; text-align:left; font-weight:bold;">المراقبة الميزانياتي لدى مسؤول النشاط</td>
                    <td colspan="3" style="border:none; text-align:right; font-weight:bold;">مسؤول النشاط</td>
                </tr>
            </tfoot>
            </table>
        `;

        exportToFormattedExcel(tableHtml, `appendix_01_${selectedYear}.xls`);
    };

    const getProgName = (code: string) => db.T_PROGRAMME.find((p: any) => p.PROGRAMME === code)?.INT_PROGRAMME || 'منشآت القاعدية للطرق و الطرق السيارة';
    const getSprogName = (code: string) => db.T_SPROGRAMME.find((p: any) => p.SPROGRAMME === code)?.INT_SPROGRAMME || `البرنامج الفرعي ${code}`;
    const getActName = (code: string) => db.T_DIRECTION.find((d: any) => d.ACTION === code)?.INT_ACTION || 'تطوير و صيانة المنشآت القاعدية للطرق و الطرق السيارة';

    return (
        <PageWrapper
            title="ملحق 01: الوضعية المالية للنقل رخص الإلتزام"
            navigate={navigate}
            onGoBack={onGoBack}
            backPage='FINANCIAL_STATUS'
            currentUser={currentUser}
        >
            <div className="bg-blue-200 p-3 rounded-lg shadow-md mb-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">{t('filter.year')}</label>
                        <CustomDropdown
                            options={years.map(y => ({ value: y, label: y }))}
                            value={selectedYear}
                            onChange={setSelectedYear}
                            placeholder={t('filter.select_year')}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">البرنامج</label>
                        <CustomDropdown
                            options={[{ value: '', label: 'جميع البرامج' }, ...programmes]}
                            value={selectedProgramme}
                            onChange={setSelectedProgramme}
                            placeholder="اختر البرنامج"
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
                    <div className="flex gap-2">
                        <button onClick={handleExport} disabled={operationsData.length === 0} className="bg-teal-500 text-white px-2 py-0.5 rounded-lg shadow hover:bg-teal-600 transition-colors w-full disabled:bg-gray-400 h-8 text-xs">
                            <i className="bi bi-file-earmark-excel mr-2"></i> {t('btn.export')}
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow-md overflow-auto max-h-[calc(100vh-14rem)] custom-scrollbar">
                {aggregatedData && operationsData.length > 0 ? (
                    <div className="min-w-[1000px] text-right">
                        {/* Headers */}
                        <div className="mb-6">
                            <h2 className="text-center font-bold text-lg mb-4">ملحق 01 <br /> الوضعية المالية للنقل رخص الإلتزام</h2>
                            <div className="font-bold text-sm">
                                <p>وزارة الأشغال العمومية و المنشآت القاعدية</p>
                                <p>محفظة برنامج: <span className="font-normal">{aggregatedData.portCode}</span></p>
                                <p>برنامج: <span className="font-normal">{aggregatedData.progCode}</span></p>
                                <p>النشاط: <span className="font-normal">{aggregatedData.actCode}</span></p>
                                <p>السنة المالية {parseInt(selectedYear)} (ن-1)</p>
                                <p>نقل للسنة المالية {parseInt(selectedYear) + 1} (ن)</p>
                                <p>وضعية ميزانياتية معدة و مرسلة من طرف مسؤول النشاط</p>
                            </div>
                        </div>

                        {/* Table */}
                        <table className="w-full border-collapse border border-gray-400 text-sm relative">
                            <thead className="sticky top-0 z-20 shadow-sm bg-gray-100">
                                <tr className="bg-gray-100">
                                    <th className="border border-gray-400 p-2 text-center w-1/6 sticky top-0 bg-gray-100 z-20">رمز / رقم العملية</th>
                                    <th className="border border-gray-400 p-2 text-center w-2/6 sticky top-0 bg-gray-100 z-20">برنامج / برنامج فرعي / نشاط / عملية</th>
                                    <th className="border border-gray-400 p-2 text-center w-1/6 sticky top-0 bg-gray-100 z-20">رخصة التزام حالية</th>
                                    <th className="border border-gray-400 p-2 text-center w-1/6 sticky top-0 bg-gray-100 z-20">رخصة التزام ملتزم بها</th>
                                    <th className="border border-gray-400 p-2 text-center w-1/6 sticky top-0 bg-gray-100 z-20">رخصة التزام متوفرة</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* Programs */}
                                {Array.from(aggregatedData.programsData.entries()).map(([code, totals]) => (
                                    <tr key={`prog-${code}`}>
                                        <td className="border border-gray-400 p-2 font-bold text-center">{code}</td>
                                        <td className="border border-gray-400 p-2 font-bold bg-white text-right">البرنامج: {getProgName(code)}</td>
                                        <td className="border border-gray-400 p-2 font-bold text-center">{formatCurrency(totals.totalAE)}</td>
                                        <td className="border border-gray-400 p-2 font-bold text-center">{formatCurrency(totals.engagedAE)}</td>
                                        <td className="border border-gray-400 p-2 font-bold text-center">{formatCurrency(totals.availableAE)}</td>
                                    </tr>
                                ))}

                                {/* Sub-programs */}
                                {Array.from(aggregatedData.subProgramsData.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([code, totals]) => (
                                    <tr key={`sprog-${code}`}>
                                        <td className="border border-gray-400 p-2 font-bold text-center">{code}</td>
                                        <td className="border border-gray-400 p-2 font-bold bg-white text-right">البرنامج الفرعي: {getSprogName(code)}</td>
                                        <td className="border border-gray-400 p-2 font-bold text-center">{formatCurrency(totals.totalAE)}</td>
                                        <td className="border border-gray-400 p-2 font-bold text-center">{formatCurrency(totals.engagedAE)}</td>
                                        <td className="border border-gray-400 p-2 font-bold text-center">{formatCurrency(totals.availableAE)}</td>
                                    </tr>
                                ))}

                                {/* Activities */}
                                {Array.from(aggregatedData.actionsData.entries()).map(([code, totals]) => (
                                    <tr key={`act-${code}`}>
                                        <td className="border border-gray-400 p-2 font-bold text-center">{code}</td>
                                        <td className="border border-gray-400 p-2 font-bold bg-white text-right">النشاط: {getActName(code)}</td>
                                        <td className="border border-gray-400 p-2 font-bold text-center">{formatCurrency(totals.totalAE)}</td>
                                        <td className="border border-gray-400 p-2 font-bold text-center">{formatCurrency(totals.engagedAE)}</td>
                                        <td className="border border-gray-400 p-2 font-bold text-center">{formatCurrency(totals.availableAE)}</td>
                                    </tr>
                                ))}

                                {/* Details grouped by Sub-program */}
                                {Array.from(aggregatedData.subProgramsData.keys()).sort().map(spCode => (
                                    <React.Fragment key={`details-${spCode}`}>
                                        {/* Sub-program Header Row */}
                                        <tr className="bg-gray-100">
                                            <td className="border border-gray-400 p-2 font-bold text-center"></td>
                                            <td className="border border-gray-400 p-2 font-bold text-right pr-4">البرنامج الفرعي {spCode} : {getSprogName(spCode)}</td>
                                            <td className="border border-gray-400 p-2 font-bold text-center" colSpan={3}></td>
                                        </tr>
                                        {/* Operations */}
                                        {operationsData.filter(op => op.sprogCode === spCode).map(op => (
                                            <tr key={op.ID_OPERATION} className="hover:bg-blue-50">
                                                <td className="border border-gray-400 p-2 text-center text-xs" dir="ltr">{op.N_OPERATION}</td>
                                                <td className="border border-gray-400 p-2 text-xs uppercase text-right pl-4">{op.INT_OPERATION}</td>
                                                <td className="border border-gray-400 p-2 text-center">{formatCurrency(op.totalAE)}</td>
                                                <td className="border border-gray-400 p-2 text-center">{formatCurrency(op.engagedAE)}</td>
                                                <td className="border border-gray-400 p-2 text-center">{formatCurrency(op.availableAE)}</td>
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>

                        <div className="flex justify-between mt-8 font-bold px-8">
                            <div>المراقبة الميزانياتي لدى مسؤول النشاط</div>
                            <div>مسؤول النشاط</div>
                        </div>
                    </div>
                ) : (
                    <div className="text-center p-8 text-gray-500">
                        لا توجد بيانات متاحة
                    </div>
                )}
            </div>
        </PageWrapper>
    );
};

export default Appendix01Page;
