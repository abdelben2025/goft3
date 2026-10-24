
import React, { useMemo } from 'react';
import { Page } from '../types';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';

interface PrintPaymentClaimsPageProps {
    navigate: (page: Page) => void;
    operationId?: number; // Optional filter
}

const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return '0,00';
    return new Intl.NumberFormat('ar-DZ', {
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
};

const PrintPaymentClaimsPage: React.FC<PrintPaymentClaimsPageProps> = ({ navigate, operationId }) => {
    const { db, loading } = useData();
    const { t } = useLanguage();

    const printData = useMemo(() => {
        if (loading) return null;

        const direction = db.T_DIRECTION[0];
        
        const paidPieceIds = new Set(db.T_PAIEMENT.map(p => p.ID_PIECE));
        const payableTypes = ['فاتورة', 'وضعية الأشغال', 'وضعية التسبيق الجزافي', 'وضعية التسبيق على التموين'];

        const unpaidPieces = db.T_PIECE.filter(p => 
            payableTypes.includes(p.NAT_PIECE) && 
            !paidPieceIds.has(p.ID_PIECE)
        );

        const filteredPieces = operationId 
            ? unpaidPieces.filter(p => p.ID_OPERATION === operationId)
            : unpaidPieces;

        // Sort the pieces by operation code (N_OPERATION) or alphabetically by description (INT_OPERATION)
        const sortedPieces = [...filteredPieces].sort((a, b) => {
            const opA = db.T_OPERATION.find(op => op.ID_OPERATION === a.ID_OPERATION);
            const opB = db.T_OPERATION.find(op => op.ID_OPERATION === b.ID_OPERATION);
            const valA = opA ? (opA.N_OPERATION || opA.INT_OPERATION || '') : '';
            const valB = opB ? (opB.N_OPERATION || opB.INT_OPERATION || '') : '';
            return valA.localeCompare(valB, 'ar', { numeric: true });
        });

        const rows = sortedPieces.map((piece, index) => {
            const operation = db.T_OPERATION.find(op => op.ID_OPERATION === piece.ID_OPERATION);
			const beneficiary = db.T_BENEFICIAIRE.find(b => b.ID_BENEFICIAIRE === piece.ID_BENEFICIAIRE);
            return {
                serial: index + 1,
                operationName: operation ? (operation.N_OPERATION ? `${operation.N_OPERATION} - ${operation.INT_OPERATION}` : operation.INT_OPERATION) : '---',
                documentName: `${piece.PIECE}`,
				beneficiaryName: beneficiary ? beneficiary.BENEFICIAIRE : '---',
                amount: piece.MONTANT_PIECE
            };
        });

        const totalAmount = rows.reduce((sum, item) => sum + item.amount, 0);
        const currentDate = new Date().toLocaleDateString('ar-DZ');

        return { direction, rows, totalAmount, currentDate };
    }, [db, loading, operationId]);

    const ROWS_PER_PAGE_FIRST = 12;
    const ROWS_PER_PAGE_OTHER = 16;

    const pages = useMemo(() => {
        if (!printData?.rows || printData.rows.length === 0) return [];
        const chunks = [];
        let index = 0;
        
        // Page 1
        const page1Slice = printData.rows.slice(0, ROWS_PER_PAGE_FIRST);
        if (page1Slice.length > 0) {
            chunks.push(page1Slice);
            index += ROWS_PER_PAGE_FIRST;
        }
        
        // Other pages
        while (index < printData.rows.length) {
            chunks.push(printData.rows.slice(index, index + ROWS_PER_PAGE_OTHER));
            index += ROWS_PER_PAGE_OTHER;
        }
        
        return chunks;
    }, [printData?.rows]);

    const pageSubtotals = useMemo(() => {
        return pages.map(pageRows => {
            return pageRows.reduce((sum, item) => sum + item.amount, 0);
        });
    }, [pages]);

    if (loading) return <div className="p-8 text-center">{t('loading')}</div>;
    if (!printData) return <div className="p-8 text-center">{t('no_data')}</div>;

    const { direction, totalAmount, currentDate } = printData;

    return (
        <div className="bg-white p-4 min-h-screen">
            <style>{`
                @media print {
                    @page { size: A4 portrait; margin: 1.2cm; }
                    .no-print { display: none !important; }
                    body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; background-color: white; }
                    .print-page {
                        margin: 0 !important;
                        padding: 0 !important;
                        box-shadow: none !important;
                        border: none !important;
                        page-break-after: always;
                        break-after: page;
                        background: white !important;
                    }
                    .print-page:last-child {
                        page-break-after: avoid;
                        break-after: avoid;
                    }
                }
                .print-page { font-family: 'Amiri', serif; background-color: white; }
                .print-page table, .print-page th, .print-page td { border-color: black !important; }
            `}</style>
            
            <div className="no-print mb-4 flex justify-between items-center bg-white p-2 rounded shadow max-w-4xl mx-auto">
                <h2 className="text-xl font-bold">{t('btn.print')}</h2>
                <div className="flex gap-2">
                    <button onClick={() => navigate('PAYMENT_CLAIMS')} className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600">→ {t('btn.back')}</button>
                    <button onClick={() => window.print()} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"><i className="bi bi-printer mr-2"></i> {t('btn.print')}</button>
                </div>
            </div>

            {pages.map((pageRows, pageIndex) => {
                const subtotal = pageSubtotals[pageIndex];
                const isFirstPage = pageIndex === 0;
                const isLastPage = pageIndex === pages.length - 1;

                return (
                    <div 
                        key={pageIndex} 
                        className="print-page bg-white p-6 mx-auto max-w-4xl shadow-lg border border-gray-300 mb-8 print:mb-0 print:border-none print:shadow-none"
                    >
                        {isFirstPage ? (
                            <header className="text-center mb-6">
                                <p className="font-bold text-lg">{t('print.header.republic')}</p>
                                <div className="flex justify-between items-end mt-4">
                                    <div className="text-right">
                                        <p className="font-bold">{direction?.INT_PORTEFEUILLE}</p>
                                        <p className="font-bold">{direction?.DIRECTION}</p>
                                    </div>
                                    <div className="text-left">
                                        <p>{t('print.label.date')} {currentDate}</p>
                                    </div>
                                </div>
                                <h1 className="text-2xl font-bold underline mt-8">{t('print.title.payment_claims')}</h1>
                            </header>
                        ) : (
                            <header className="flex justify-between items-center border-b pb-2 mb-6 text-sm">
                                <span className="font-bold">{t('print.title.payment_claims')}</span>
                                <span className="text-xs text-gray-500 font-bold">صفحة {pageIndex + 1} من {pages.length}</span>
                            </header>
                        )}

                        <table className="w-full border-collapse border border-black text-center mt-6">
                            <thead className="bg-gray-100 font-bold">
                                <tr>
                                    <th className="border border-black p-2 w-[10%]">{t('col.serial')}</th>
                                    {!operationId && <th className="border border-black p-2 w-[30%]">{t('col.operation')}</th>}
                                    <th className="border border-black p-2 w-[40%]">{t('col.documents_type')}</th>
                                    <th className="border border-black p-2 w-[30%]">{t('col.beneficiary')}</th>
                                    <th className="border border-black p-2 w-[20%]">{t('col.amount')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pageRows.map((row) => (
                                    <tr key={row.serial}>
                                        <td className="border border-black p-2">{row.serial}</td>
                                        {!operationId && <td className="border border-black p-2 text-right text-sm">{row.operationName}</td>}
                                        <td className="border border-black p-2 text-right">{row.documentName}</td>
                                        <td className="border border-black p-2 text-right">{row.beneficiaryName}</td>
                                        <td className="border border-black p-2 font-bold">{formatCurrency(row.amount)}</td>
                                    </tr>
                                ))}
                                
                                {/* Subtotal Row for each page */}
                                <tr className="bg-gray-100 font-bold">
                                    <td colSpan={!operationId ? 4 : 3} className="border border-black p-2 text-right">
                                        {pages.length === 1 ? t('lbl.total_general') : `المجموع الفرعي للصفحة (${pageIndex + 1})`}
                                    </td>
                                    <td className="border border-black p-2 font-bold">{formatCurrency(subtotal)}</td>
                                </tr>

                                {/* Grand Total Row (Meticulously shown ONLY on the very last page if multiple pages exist) */}
                                {isLastPage && pages.length > 1 && (
                                    <tr className="bg-gray-200 font-black text-[12pt] border-t-2 border-black">
                                        <td colSpan={!operationId ? 4 : 3} className="border border-black p-2 text-right font-black">{t('lbl.total_general')}</td>
                                        <td className="border border-black p-2 font-black">{formatCurrency(totalAmount)}</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                );
            })}
        </div>
    );
};

export default PrintPaymentClaimsPage;
