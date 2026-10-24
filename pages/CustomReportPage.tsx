
import React, { useState, useMemo } from 'react';
import { Page, User } from '../types';
import { useData } from '../context/DataContext';
import PageWrapper from '../components/PageWrapper';
import { useLanguage } from '../context/LanguageContext';
import { exportToFormattedExcel } from '../utils/exportToCsv';
import { formatCurrency } from '../utils/currencyUtils';
import { normalizeDate } from '../utils/dateUtils';

interface CustomReportPageProps {
    navigate: (page: Page, operationId?: number) => void;
    onGoBack?: () => void;
    currentUser: User;
}

interface ReportColumn {
    key: string;
    labelKey: string;
    group: string;
    isCurrency?: boolean;
}

const AVAILABLE_COLUMNS: ReportColumn[] = [
    { key: 'N_OPERATION', labelKey: 'col.operation_info', group: 'report.group_operation' },
    { key: 'INT_OPERATION', labelKey: 'col.operation_title', group: 'report.group_operation' },
    { key: 'N_ENG', labelKey: 'col.eng_no', group: 'report.group_engagement' },
    { key: 'DATE_ENG', labelKey: 'col.date', group: 'report.group_engagement' },
    { key: 'OBJET_ENG', labelKey: 'col.engagement_subject', group: 'report.group_engagement' },
    { key: 'MONTANT_ENG', labelKey: 'col.amount', group: 'report.group_engagement', isCurrency: true },
    { key: 'N_PAI', labelKey: 'col.card_num', group: 'report.group_payment' },
    { key: 'DATE_PAI', labelKey: 'col.date', group: 'report.group_payment' },
    { key: 'OBJET_PAI', labelKey: 'col.payment_subject', group: 'report.group_payment' },
    { key: 'MONTANT_PAI', labelKey: 'col.amount', group: 'report.group_payment', isCurrency: true },
    { key: 'N_MANDAT', labelKey: 'col.mandat_no', group: 'report.group_payment' },
];

const CustomReportPage: React.FC<CustomReportPageProps> = ({ navigate, onGoBack, currentUser }) => {
    const { db, loading } = useData();
    const { t } = useLanguage();

    const [selectedColumns, setSelectedColumns] = useState<string[]>(['N_OPERATION', 'N_ENG', 'MONTANT_ENG', 'N_PAI', 'MONTANT_PAI']);
    const [isConfigOpen, setIsConfigOpen] = useState(true);

    const toggleColumn = (key: string) => {
        setSelectedColumns(prev => 
            prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]
        );
    };

    const reportData = useMemo(() => {
        if (loading) return [];

        const rows: any[] = [];

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

        ops.forEach(op => {
            const opData = {
                N_OPERATION: op.N_OPERATION,
                INT_OPERATION: op.INT_OPERATION
            };

            const engagements = db.T_ENGAGEMENT.filter(e => e.ID_OPERATION === op.ID_OPERATION);

            if (engagements.length === 0) {
                 rows.push({ ...opData, _type: 'op_only' });
            } else {
                engagements.forEach(eng => {
                    const engData = {
                        N_ENG: eng.N_ENG,
                        DATE_ENG: normalizeDate(eng.DATE_ENG),
                        OBJET_ENG: eng.OBJET_ENG,
                        MONTANT_ENG: eng.MONTANT_ENG
                    };

                    const paiements = db.T_PAIEMENT.filter(p => p.ID_ENG === eng.ID_ENGAGEMENT);

                    if (paiements.length === 0) {
                        rows.push({ ...opData, ...engData, _type: 'eng_only' });
                    } else {
                        paiements.forEach(pai => {
                            const paiData = {
                                N_PAI: pai.N_PAI,
                                DATE_PAI: normalizeDate(pai.DATE_PAI),
                                OBJET_PAI: pai.OBJET_PAI,
                                MONTANT_PAI: pai.MONTANT_PAI,
                                N_MANDAT: pai.N_MANDAT
                            };
                            rows.push({ ...opData, ...engData, ...paiData, _type: 'full' });
                        });
                    }
                });
            }
        });
        return rows;
    }, [db, loading]);

    const handleExport = () => {
        if (reportData.length === 0) {
            alert(t('no_data'));
            return;
        }

        const headers = selectedColumns.map(key => {
            const col = AVAILABLE_COLUMNS.find(c => c.key === key);
            return t(col?.labelKey || key);
        });

        const styles = `<style> table, th, td { border: 1px solid black; border-collapse: collapse; text-align: right; padding: 5px; font-family: Arial, sans-serif; vertical-align: middle; } th { background-color: #DDEBF7; font-weight: bold; text-align: center; } td { mso-number-format:"\\@"; } .currency { mso-number-format:"\\#\\,##0\\.00"; } </style>`;
        
        let tableHtml = `${styles}<table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>`;

        reportData.forEach(row => {
            tableHtml += `<tr>`;
            selectedColumns.forEach(key => {
                const colDef = AVAILABLE_COLUMNS.find(c => c.key === key);
                const val = row[key];
                const displayVal = colDef?.isCurrency ? formatCurrency(val) : (val || '');
                const className = colDef?.isCurrency ? 'currency' : '';
                tableHtml += `<td class="${className}">${displayVal}</td>`;
            });
            tableHtml += `</tr>`;
        });

        tableHtml += `</tbody></table>`;
        exportToFormattedExcel(tableHtml, 'custom_report.xls');
    };

    if (loading) return <div>{t('loading')}</div>;

    const groupedColumns = AVAILABLE_COLUMNS.reduce((acc, col) => {
        if (!acc[col.group]) acc[col.group] = [];
        acc[col.group].push(col);
        return acc;
    }, {} as Record<string, ReportColumn[]>);

    return (
        <PageWrapper title={t('page.custom_report')} navigate={navigate} onGoBack={onGoBack} backPage='FINANCIAL_STATUS' currentUser={currentUser}>
            
            {/* Configuration Panel */}
            <div className="bg-white p-4 rounded-lg shadow-md mb-4 border border-gray-200">
                <div className="flex justify-between items-center cursor-pointer" onClick={() => setIsConfigOpen(!isConfigOpen)}>
                    <h3 className="font-bold text-lg text-gray-800"><i className="bi bi-gear-fill mr-2"></i> {t('report.select_columns')}</h3>
                    <i className={`bi ${isConfigOpen ? 'bi-chevron-up' : 'bi-chevron-down'} text-gray-600`}></i>
                </div>
                
                {isConfigOpen && (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-6 animate-slide-up">
                        {Object.keys(groupedColumns).map(groupKey => (
                            <div key={groupKey} className="border p-3 rounded bg-gray-50">
                                <h4 className="font-bold text-sm text-gray-700 mb-2 border-b pb-1">{t(groupKey)}</h4>
                                <div className="space-y-2">
                                    {groupedColumns[groupKey].map(col => (
                                        <label key={col.key} className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-1 rounded">
                                            <input 
                                                type="checkbox" 
                                                checked={selectedColumns.includes(col.key)} 
                                                onChange={() => toggleColumn(col.key)}
                                                className="form-checkbox h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                                            />
                                            <span className="text-sm text-gray-700">{t(col.labelKey)}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                 <div className="flex justify-end mt-4 pt-2 border-t">
                    <button onClick={handleExport} className="bg-teal-600 text-white px-4 py-2 rounded shadow hover:bg-teal-700 transition-colors flex items-center">
                        <i className="bi bi-file-earmark-excel mr-2"></i> {t('btn.export_excel')}
                    </button>
                </div>
            </div>

            {/* Results Table */}
            <div className="bg-white p-4 rounded-lg shadow-md overflow-auto max-h-[calc(100vh-16rem)]">
                <table className="w-full text-right min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-100 sticky top-0">
                        <tr>
                            {selectedColumns.map(key => (
                                <th key={key} className="px-3 py-2 text-xs font-semibold text-gray-700 uppercase tracking-wider border-b">
                                    {t(AVAILABLE_COLUMNS.find(c => c.key === key)?.labelKey || key)}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {reportData.length > 0 ? (
                            reportData.map((row, idx) => (
                                <tr key={idx} className="hover:bg-gray-50 text-xs">
                                    {selectedColumns.map(key => {
                                        const colDef = AVAILABLE_COLUMNS.find(c => c.key === key);
                                        return (
                                            <td key={key} className={`px-3 py-2 whitespace-nowrap text-gray-700 ${colDef?.isCurrency ? 'font-mono font-semibold' : ''}`}>
                                                {colDef?.isCurrency ? formatCurrency(row[key]) : (row[key] || '-')}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={selectedColumns.length} className="text-center p-6 text-gray-500">
                                    {t('no_data')}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </PageWrapper>
    );
};

export default CustomReportPage;
