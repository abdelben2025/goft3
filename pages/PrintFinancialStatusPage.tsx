
import React, { useMemo } from 'react';
import { Page } from '../types';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { normalizeDate } from '../utils/dateUtils';

const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return '0,00';
    return new Intl.NumberFormat('ar-DZ', {
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
};

const PrintFinancialStatusPage: React.FC<{ navigate: (page: Page) => void }> = ({ navigate }) => {
    const { db, loading } = useData();
    const { t } = useLanguage();
    
    const filters = useMemo(() => {
        try {
            const storedFilters = sessionStorage.getItem('goft3_fs_filters');
            if (storedFilters) {
                return JSON.parse(storedFilters);
            }
        } catch (e) {
            console.error("Could not parse filters from session storage", e);
        }
        return {
            year: new Date().getFullYear().toString(),
            month: (new Date().getMonth() + 1).toString(),
            action: ''
        };
    }, []);

    const { year, month, action } = filters;

    const printData = useMemo(() => {
        if (loading) return null;

        const openOperations = db.T_OPERATION.filter(op => {
            if (op.status !== 'جارية') return false;
            if (action) {
                const opActionCode = op.N_OPERATION.split('.')[5];
                return opActionCode === action;
            }
            return true;
        });

        const rows = openOperations.map(op => {
            const cpFinale = db.T_CP
                .filter(cp => cp.ID_OPERATION === op.ID_OPERATION && cp.ANNEE === year)
                .reduce((sum, cp) => sum + cp.MONTANT_FINALE_CP, 0);

            const paiementsCurrentYearList = db.T_PAIEMENT
                .filter(p => p.ID_OPERATION === op.ID_OPERATION && p.ANNEE === year);

            const selectedMonthInt = parseInt(month, 10);
            
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
        
        const totals = rows.reduce((acc, row) => {
            acc.cpFinale += row.cpFinale;
            acc.paiementsPrevious += row.paiementsPrevious;
            acc.paiementsCurrentMonth += row.paiementsCurrentMonth;
            acc.totalPaiementsCurrentYear += row.totalPaiementsCurrentYear;
            acc.remainingBalance += row.remainingBalance;
            return acc;
        }, { cpFinale: 0, paiementsPrevious: 0, paiementsCurrentMonth: 0, totalPaiementsCurrentYear: 0, remainingBalance: 0 });

        const direction = db.T_DIRECTION[0];

        return { rows, totals, direction };
    }, [db, loading, year, month, action]);
    
    if (loading) return <div className="p-8 text-center">{t('loading')}</div>;
    if (!printData) return <div className="p-8 text-center">{t('no_data')}</div>;

    const { rows, totals, direction } = printData;
    const monthName = t(`month.${parseInt(month)}`);

    // تقسيم الصفوف إلى صفحات (كل صفحة صفوف ثابتة) لحساب المجموع الفرعي لكل صفحة
    const ROWS_PER_PAGE = 12;
    const pages: { rows: typeof rows; subtotal: { cpFinale: number; paiementsPrevious: number; paiementsCurrentMonth: number; totalPaiementsCurrentYear: number; remainingBalance: number } }[] = [];
    for (let i = 0; i < rows.length; i += ROWS_PER_PAGE) {
        const chunk = rows.slice(i, i + ROWS_PER_PAGE);
        const subtotal = chunk.reduce((acc, row) => {
            acc.cpFinale += row.cpFinale;
            acc.paiementsPrevious += row.paiementsPrevious;
            acc.paiementsCurrentMonth += row.paiementsCurrentMonth;
            acc.totalPaiementsCurrentYear += row.totalPaiementsCurrentYear;
            acc.remainingBalance += row.remainingBalance;
            return acc;
        }, { cpFinale: 0, paiementsPrevious: 0, paiementsCurrentMonth: 0, totalPaiementsCurrentYear: 0, remainingBalance: 0 });
        pages.push({ rows: chunk, subtotal });
    }
    const totalPages = pages.length;

    return (
        <div className="bg-white p-4 min-h-screen">
            <style>{`
                @media print {
                    @page {
                        size: A4 landscape;
                        margin: 0.5cm;
                    }
                    .no-print { display: none !important; }
                    body {
                        margin: 0;
                        background: white;
                    }
                    .print-area {
                        margin: 0 !important;
                        padding: 0 !important;
                        box-shadow: none !important;
                        border: none !important;
                        font-size: 8.5pt !important;
                        width: 100% !important;
                    }
                    .print-area table {
                        page-break-inside: auto;
                        width: 100% !important;
                        border-collapse: collapse;
                    }
                    .print-area tr {
                        page-break-inside: avoid;
                        page-break-after: auto;
                    }
                    .print-area thead {
                        display: table-header-group;
                    }
                    .print-area th, .print-area td {
                        border: 1px solid black !important;
                        padding: 3px 4px !important;
                        word-wrap: break-word;
                        font-size: 8.5pt !important;
                    }
                }
                .print-area { font-family: 'Amiri', serif; }
                .print-area, .print-area p, .print-area h1, .print-area div, .print-area th, .print-area td { color: black !important; }
            `}</style>
            <div className="no-print mb-4 flex justify-between items-center bg-white p-2 rounded shadow">
                <h2 className="text-xl font-bold">{t('btn.print')}</h2>
                <div className="flex gap-2">
                    <button onClick={() => navigate('FINANCIAL_STATUS')} className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600">→ {t('btn.back')}</button>
                    <button onClick={() => window.print()} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"><i className="bi bi-printer mr-2"></i> {t('btn.print')}</button>
                </div>
            </div>
            <div className="print-area bg-white p-6 mx-auto max-w-6xl shadow-lg border border-gray-300">
                <header className="text-center mb-4">
                    <p className="font-bold">{t('print.header.republic')}</p>
                    <p className="font-bold text-right">{direction?.INT_PORTEFEUILLE}</p>
                    <p className="font-bold text-right">{direction?.DIRECTION}</p>
                    <h1 className="text-lg font-bold underline mt-4">{t('print.title.financial_status', { month: monthName, year })}</h1>
                </header>
                {pages.map((page, pageIdx) => (
                    <div
                        key={pageIdx}
                        className="mb-5"
                        style={{ pageBreakAfter: pageIdx === totalPages - 1 ? 'auto' : 'always', breakAfter: pageIdx === totalPages - 1 ? 'auto' : 'page' }}
                    >
                        <table className="w-full border-collapse border border-black text-center text-xs" style={{ pageBreakInside: 'avoid' }}>
                            <thead className="bg-gray-100 font-bold">
                                <tr>
                                    <th className="border border-black p-1 w-[30%]">{t('col.operation_info')}</th>
                                    <th className="border border-black p-1">{t('col.cp_year', {year})}</th>
                                    <th className="border border-black p-1">{t('col.previous_payment')}</th>
                                    <th className="border border-black p-1">{t('col.monthly_payment')}</th>
                                    <th className="border border-black p-1">{t('col.total_payments')}</th>
                                    <th className="border border-black p-1">{t('col.balance')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {page.rows.map(row => (
                                    <tr key={row.ID_OPERATION}>
                                        <td className="border border-black p-1 text-right">{row.N_OPERATION}<br/>{row.INT_OPERATION}</td>
                                        <td className="border border-black p-1">{formatCurrency(row.cpFinale)}</td>
                                        <td className="border border-black p-1">{formatCurrency(row.paiementsPrevious)}</td>
                                        <td className="border border-black p-1">{formatCurrency(row.paiementsCurrentMonth)}</td>
                                        <td className="border border-black p-1">{formatCurrency(row.totalPaiementsCurrentYear)}</td>
                                        <td className="border border-black p-1">{formatCurrency(row.remainingBalance)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-200 font-bold">
                                <tr>
                                    <td className="border border-black p-1 text-center">المجموع الفرعي</td>
                                    <td className="border border-black p-1">{formatCurrency(page.subtotal.cpFinale)}</td>
                                    <td className="border border-black p-1">{formatCurrency(page.subtotal.paiementsPrevious)}</td>
                                    <td className="border border-black p-1">{formatCurrency(page.subtotal.paiementsCurrentMonth)}</td>
                                    <td className="border border-black p-1">{formatCurrency(page.subtotal.totalPaiementsCurrentYear)}</td>
                                    <td className="border border-black p-1">{formatCurrency(page.subtotal.remainingBalance)}</td>
                                </tr>
                                {pageIdx === totalPages - 1 && (
                                    <tr className="bg-gray-300">
                                        <td className="border border-black p-1 text-center">{t('lbl.total')} (الإجمالي الكلي)</td>
                                        <td className="border border-black p-1">{formatCurrency(totals.cpFinale)}</td>
                                        <td className="border border-black p-1">{formatCurrency(totals.paiementsPrevious)}</td>
                                        <td className="border border-black p-1">{formatCurrency(totals.paiementsCurrentMonth)}</td>
                                        <td className="border border-black p-1">{formatCurrency(totals.totalPaiementsCurrentYear)}</td>
                                        <td className="border border-black p-1">{formatCurrency(totals.remainingBalance)}</td>
                                    </tr>
                                )}
                            </tfoot>
                        </table>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PrintFinancialStatusPage;
