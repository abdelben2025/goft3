import React, { useMemo } from 'react';
import { Page, Engagement, Operation, Piece, Beneficiaire, Paiement } from '../types';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { formatCurrency } from '../utils/currencyUtils';
import { normalizeDate } from '../utils/dateUtils';

interface PrintMonthlyPaymentsPageProps {
    navigate: (page: Page) => void;
}

const PrintMonthlyPaymentsPage: React.FC<PrintMonthlyPaymentsPageProps> = ({ navigate }) => {
    const { db, loading } = useData();
    const { t, dir } = useLanguage();
    
    const selectedYear = sessionStorage.getItem('goft3_monthly_year') || new Date().getFullYear().toString();
    const selectedMonth = sessionStorage.getItem('goft3_monthly_month') || (new Date().getMonth() + 1).toString().padStart(2, '0');
    const statusFilter = sessionStorage.getItem('goft3_monthly_pay_status') as 'ALL' | 'ACCEPTED' | 'NOT_ACCEPTED' || 'ALL';
    const selectedAction = sessionStorage.getItem('goft3_monthly_action') || '';

    const months = [
        { value: 'ALL', label: 'كل الأشهر' },
        { value: '01', label: 'جانفي' },
        { value: '02', label: 'فيفري' },
        { value: '03', label: 'مارس' },
        { value: '04', label: 'أفريل' },
        { value: '05', label: 'ماي' },
        { value: '06', label: 'جوان' },
        { value: '07', label: 'جويلية' },
        { value: '08', label: 'أوت' },
        { value: '09', label: 'سبتمبر' },
        { value: '10', label: 'أكتوبر' },
        { value: '11', label: 'نوفمبر' },
        { value: '12', label: 'ديسمبر' },
    ];

    const parseYearMonth = (dateStr: string | null | undefined) => {
        if (!dateStr) return { year: '', month: '' };
        if (dateStr.includes('-')) {
            const parts = dateStr.split('-');
            if (parts[0].length === 4) {
                return { year: parts[0], month: parts[1] || '' };
            } else {
                return { year: parts[2] || '', month: parts[1] || '' };
            }
        } else if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts[2]?.length === 4) {
                return { year: parts[2], month: parts[1] || '' };
            } else if (parts[0].length === 4) {
                return { year: parts[0], month: parts[1] || '' };
            }
        }
        return { year: '', month: '' };
    };

    const filteredData = useMemo(() => {
        return db.T_PAIEMENT
            .filter((p: Paiement) => {
                const isAccepted = !!p.DATE_ADMIS;
                if (statusFilter === 'ACCEPTED' && !isAccepted) return false;
                if (statusFilter === 'NOT_ACCEPTED' && isAccepted) return false;

                if (selectedAction) {
                    const op = db.T_OPERATION.find((o: Operation) => o.ID_OPERATION === p.ID_OPERATION);
                    const opActionCode = op ? op.N_OPERATION.split('.')[5] : undefined;
                    if (opActionCode !== selectedAction) return false;
                }

                const { year, month } = parseYearMonth(p.DATE_PAI);
                return year === selectedYear && (selectedMonth === 'ALL' || month === selectedMonth);
            })
            .map((p: Paiement) => {
                const op = db.T_OPERATION.find((o: Operation) => o.ID_OPERATION === p.ID_OPERATION);
                const piece = db.T_PIECE.find((pi: Piece) => pi.ID_PIECE === p.ID_PIECE);
                const eng = db.T_ENGAGEMENT.find((e: Engagement) => e.ID_ENGAGEMENT === p.ID_ENG);
                const ben = piece?.ID_BENEFICIAIRE ? db.T_BENEFICIAIRE.find((b: Beneficiaire) => b.ID_BENEFICIAIRE === piece.ID_BENEFICIAIRE) : null;

                return {
                    ...p,
                    opName: op ? `${op.N_OPERATION} - ${op.INT_OPERATION}` : 'غير معروف',
                    pieceName: piece ? piece.PIECE : 'غير معروف',
                    engRef: eng ? `${eng.N_ENG} / ${eng.ANNEE}` : '---',
                    beneficiaryName: ben ? ben.BENEFICIAIRE : '---',
                    isAccepted: !!p.DATE_ADMIS
                };
            })
            .sort((a: any, b: any) => {
                return (a.DATE_PAI || '').localeCompare(b.DATE_PAI || '');
            });
    }, [db, selectedYear, selectedMonth, statusFilter, selectedAction]);

    const totalAmount = useMemo(() => {
        return filteredData.reduce((sum, item) => sum + item.MONTANT_PAI, 0);
    }, [filteredData]);

    const chunkData = (data: any[]) => {
        if (data.length === 0) return [];
        const pages = [];
        const firstPageSize = 7;
        const nextPageSize = 10;
        
        pages.push(data.slice(0, firstPageSize));
        
        let index = firstPageSize;
        while (index < data.length) {
            pages.push(data.slice(index, index + nextPageSize));
            index += nextPageSize;
        }
        return pages;
    };

    const dataPages = useMemo(() => chunkData(filteredData), [filteredData]);

    if (loading) return <div className="p-8 text-center">{t('loading')}</div>;

    const direction = db.T_DIRECTION[0];

    return (
        <div className="bg-gray-200 p-4 min-h-screen" dir={dir}>
            <style>{`
                @media print {
                    @page {
                        size: A4 landscape;
                        margin: 0.8cm;
                    }
                    .no-print { display: none !important; }
                    body {
                        margin: 0;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                        background-color: white !important;
                    }
                    .print-area {
                        margin: 0 !important;
                        padding: 0 !important;
                        box-shadow: none !important;
                        border: none !important;
                        width: 100% !important;
                    }
                    .print-page {
                        page-break-after: always;
                        page-break-inside: avoid;
                        margin: 0 !important;
                        padding: 0.5cm !important;
                        border: none !important;
                        box-shadow: none !important;
                        min-height: 100vh;
                        box-sizing: border-box;
                    }
                    .print-page:last-child {
                        page-break-after: avoid;
                    }
                }
                .print-area { font-family: 'Amiri', serif; }
                .print-area, .print-area p, .print-area h1, .print-area div, .print-area th, .print-area td { color: black !important; }
            `}</style>
            
            <div className="no-print mb-4 flex justify-between items-center bg-white p-2 rounded shadow">
                <h2 className="text-xl font-bold">معاينة الطباعة</h2>
                <div className="flex gap-2">
                    <button onClick={() => navigate('MONTHLY_PAYMENTS_REPORT')} className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors">→ رجوع</button>
                    <button onClick={() => window.print()} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"><i className="bi bi-printer mr-2"></i> طباعة</button>
                </div>
            </div>

            <div className="print-area space-y-6 mx-auto max-w-full">
                {dataPages.length === 0 ? (
                    <div className="print-page bg-white p-8 mx-auto max-w-full shadow-lg border border-gray-300 flex flex-col items-center justify-center min-h-[300px]">
                        <p className="text-gray-500 font-bold">لا توجد بيانات للطباعة</p>
                    </div>
                ) : (
                    dataPages.map((pageItems, pageIndex) => {
                        const pageSubtotal = pageItems.reduce((sum, item) => sum + item.MONTANT_PAI, 0);
                        
                        // Calculate continuous page-level row indices
                        let previousItemsCount = 0;
                        for (let p = 0; p < pageIndex; p++) {
                            previousItemsCount += dataPages[p].length;
                        }

                        return (
                            <div key={pageIndex} className="print-page bg-white p-8 mx-auto max-w-full shadow-lg border border-gray-300">
                                <header className="text-center mb-6">
                                    {pageIndex === 0 && (
                                        <>
                                            <p className="font-bold">{t('print.header.republic')}</p>
                                            <p className="font-bold text-right">{direction?.INT_PORTEFEUILLE}</p>
                                            <p className="font-bold text-right">{direction?.DIRECTION}</p>
                                        </>
                                    )}
                                    <div className="flex justify-between items-center border-b border-black pb-2 mt-4">
                                        <h1 className="text-xl font-bold underline">جدول الدفوعات حسب الشهر</h1>
                                        <span className="text-xs font-bold font-mono">الصفحة {pageIndex + 1} / {dataPages.length}</span>
                                    </div>
                                    <p className="text-md font-bold mt-2 font-mono">شهر: {months.find(m => m.value === selectedMonth)?.label} {selectedYear}</p>
                                    <p className="text-sm font-bold mt-1">الحالة: {statusFilter === 'ALL' ? 'كل الدفوعات' : statusFilter === 'ACCEPTED' ? 'الدفوعات المقبولة فقط' : 'الدفوعات غير المقبولة فقط'}</p>
                                </header>

                                <table className="w-full border-collapse border border-black text-right">
                                    <thead className="bg-gray-100 font-bold">
                                        <tr>
                                            <th className="border border-black p-2 text-center w-[40px]">#</th>
                                            <th className="border border-black p-2 w-[350px]">رقم وعنوان العملية</th>
                                            <th className="border border-black p-2 w-[180px]">رقم الحوالة</th>
                                            <th className="border border-black p-2">الوثيقة / الالتزام</th>
                                            <th className="border border-black p-2">المستفيذ</th>
                                            <th className="border border-black p-2 w-[150px] text-center">الحالة</th>
                                            <th className="border border-black p-2 text-left w-[150px]">المبلغ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pageItems.map((item, idx) => (
                                            <tr key={item.ID_PAIEMENT}>
                                                <td className="border border-black p-2 text-center">{previousItemsCount + idx + 1}</td>
                                                <td className="border border-black p-2 text-[9pt] leading-tight">{item.opName}</td>
                                                <td className="border border-black p-2">
                                                    <div className="font-bold">{item.N_PAI} / {item.ANNEE}</div>
                                                    <div className="text-[7pt] italic">في: {normalizeDate(item.DATE_PAI)}</div>
                                                    {item.N_MANDAT && <div className="text-[8pt] font-mono mt-1">حوالة: {item.N_MANDAT}</div>}
                                                </td>
                                                <td className="border border-black p-2 text-[9pt]">
                                                    <div>{item.pieceName}</div>
                                                    <div className="text-[7pt] text-gray-600 mt-1">التزام: {item.engRef}</div>
                                                </td>
                                                <td className="border border-black p-2 text-[9pt]">{item.beneficiaryName}</td>
                                                <td className="border border-black p-2 text-center text-[8pt]">
                                                    {item.isAccepted ? (
                                                        <span className="font-bold">مقبولة لدى AM ({normalizeDate(item.DATE_ADMIS)})</span>
                                                    ) : (
                                                        <span className="italic">في انتظار القبول</span>
                                                    )}
                                                </td>
                                                <td className="border border-black p-2 font-bold text-left">
                                                    {formatCurrency(item.MONTANT_PAI)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-gray-100 font-bold">
                                        <tr className="bg-gray-50">
                                            <td colSpan={6} className="border border-black p-2 text-left uppercase text-xs">المجموع الفرعي للصفحة</td>
                                            <td className="border border-black p-2 text-left text-xs">{formatCurrency(pageSubtotal)}</td>
                                        </tr>
                                        {pageIndex === dataPages.length - 1 && (
                                            <tr className="bg-gray-200">
                                                <td colSpan={6} className="border border-black p-2 text-left uppercase text-sm font-black">إجمالي الدفوعات في هذا الشهر (المجموع العام)</td>
                                                <td className="border border-black p-2 text-left text-sm font-black">{formatCurrency(totalAmount)}</td>
                                            </tr>
                                        )}
                                    </tfoot>
                                </table>

                                {pageIndex === dataPages.length - 1 && (
                                    <div className="mt-2">
                                        <div className="grid grid-cols-2 text-center font-bold">
                                            <div>
                                                <p className="mb-2 underline"></p>
                                            </div>
                                            <div>
                                                <p className="mb-2 underline">المــديـــــر</p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default PrintMonthlyPaymentsPage;
