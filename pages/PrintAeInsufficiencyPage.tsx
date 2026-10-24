import React, { useMemo, useState } from 'react';
import { Page } from '../types';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';

interface PrintAeInsufficiencyPageProps {
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

const PrintAeInsufficiencyPage: React.FC<PrintAeInsufficiencyPageProps> = ({ navigate, operationId }) => {
    const { db, loading } = useData();
    const { t } = useLanguage();

    const [firstPageRows, setFirstPageRows] = useState(28);
    const [otherPageRows, setOtherPageRows] = useState(32);

    const printData = useMemo(() => {
        if (loading) return null;

        const direction = db.T_DIRECTION[0];
        
        const committedPieceIds = new Set(db.T_ENGAGEMENT.map(e => e.ID_PIECE));
        const commitmentTypes = ['صفقة', 'اتفاقية', 'ملحق', 'فاتورة'];

        const uncommittedPieces = db.T_PIECE.filter(p => 
            commitmentTypes.includes(p.NAT_PIECE) && 
            !committedPieceIds.has(p.ID_PIECE)
        );

        const filteredPieces = operationId 
            ? uncommittedPieces.filter(p => p.ID_OPERATION === operationId)
            : uncommittedPieces;

        const insufficientPieces = filteredPieces.filter(piece => {
            if (!piece.ID_RUBRIQUE) return false;

            const rubOp = db.T_RUBRIQUE_OP.find(ro => 
                ro.ID_OPERATION === piece.ID_OPERATION && 
                ro.ID_RUBRIQUE === piece.ID_RUBRIQUE
            );

            if (!rubOp) return true;

            const totalAllocatedAE = rubOp.MONTANT_FINALE ?? rubOp.MONTANT_INITIALE;

            const consumedAE = db.T_ENGAGEMENT
                .filter(eng => {
                    if (eng.ID_OPERATION !== piece.ID_OPERATION) return false;
                    const linkedPiece = db.T_PIECE.find(p => p.ID_PIECE === eng.ID_PIECE);
                    return linkedPiece && linkedPiece.ID_RUBRIQUE === piece.ID_RUBRIQUE;
                })
                .reduce((sum, eng) => {
                    if (eng.NATURE_ENG === 'سحب' || eng.NATURE_ENG === 'إنخفاض التقييم') {
                        return sum - eng.MONTANT_ENG;
                    }
                    if (eng.NATURE_ENG === 'التزام' || eng.NATURE_ENG === 'ملحق' || eng.NATURE_ENG === 'فاتورة' || eng.NATURE_ENG === 'إعادة التقييم') {
                        return sum + eng.MONTANT_ENG;
                    }
                    return sum;
                }, 0);

            const remainingAE = totalAllocatedAE - consumedAE;

            return piece.MONTANT_PIECE > remainingAE;
        });

        // Build rows then sort by operation (code then title), so each
        // operation's documents are grouped together.
        const rawRows = insufficientPieces.map(piece => {
            const operation = db.T_OPERATION.find(op => op.ID_OPERATION === piece.ID_OPERATION);
            const rubrique = db.T_RUBRIQUE.find(r => r.ID_RUBRIQUE === piece.ID_RUBRIQUE);
            return {
                opCode: operation ? String(operation.N_OPERATION || '') : 'zzz',
                operationName: operation ? operation.INT_OPERATION : '---',
                rubriqueName: rubrique ? rubrique.RUBRIQUE : '---',
                documentName: `${piece.PIECE}`,
                amount: piece.MONTANT_PIECE
            };
        });

        rawRows.sort((a, b) => {
            const codeCmp = a.opCode.localeCompare(b.opCode, undefined, { numeric: true });
            if (codeCmp !== 0) return codeCmp;
            const titleCmp = a.operationName.localeCompare(b.operationName, 'ar');
            if (titleCmp !== 0) return titleCmp;
            return a.rubriqueName.localeCompare(b.rubriqueName, 'ar');
        });

        const rows = rawRows.map((row, index) => ({
            serial: index + 1,
            operationName: row.operationName,
            rubriqueName: row.rubriqueName,
            documentName: row.documentName,
            amount: row.amount
        }));

        const totalAmount = rows.reduce((sum, item) => sum + item.amount, 0);
        const currentDate = new Date().toLocaleDateString('ar-DZ');

        // Split rows across pages. Use actual sliced length so we never
        // create empty trailing pages when few records remain.
        const pagesList = [];
        let currentIndex = 0;
        let pageNum = 1;

        if (rows.length === 0) {
            pagesList.push({
                rows: [],
                pageNumber: 1,
                isFirstPage: true,
                isLastPage: true,
                pageSubtotal: 0
            });
        } else {
            while (currentIndex < rows.length) {
                const isFirst = pageNum === 1;
                const limit = isFirst ? firstPageRows : otherPageRows;
                const pageRows = rows.slice(currentIndex, currentIndex + limit);
                if (pageRows.length === 0) break;

                currentIndex += pageRows.length;
                pagesList.push({
                    rows: pageRows,
                    pageNumber: pageNum,
                    isFirstPage: isFirst,
                    isLastPage: currentIndex >= rows.length,
                    pageSubtotal: pageRows.reduce((sum, item) => sum + item.amount, 0)
                });
                pageNum++;
            }
        }

        return { direction, totalAmount, currentDate, pages: pagesList, rowCount: rows.length };
    }, [db, loading, operationId, firstPageRows, otherPageRows]);

    if (loading) return <div className="p-8 text-center">{t('loading')}</div>;
    if (!printData) return <div className="p-8 text-center">{t('no_data')}</div>;

    const { direction, totalAmount, currentDate, pages } = printData;

    return (
        <div className="bg-white p-4 min-h-screen">
            <style>{`
                @media print {
                    @page { size: A4 portrait; margin: 0.4cm; }
                    .no-print { display: none !important; }
                    body { margin: 0 !important; padding: 0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    html, body { height: auto !important; overflow: visible !important; }
                    .print-area {
                        margin: 0 !important;
                        padding: 0 !important;
                        box-shadow: none !important;
                        border: none !important;
                        font-size: 9pt;
                        width: 100% !important;
                        max-width: 100% !important;
                        overflow: visible !important;
                    }
                    .print-page {
                        box-shadow: none !important;
                        border: none !important;
                        padding: 0.15cm 0.2cm !important;
                        margin: 0 !important;
                        height: auto !important;
                        min-height: 0 !important;
                        overflow: visible !important;
                        page-break-after: always;
                        break-after: page;
                        page-break-inside: auto;
                        break-inside: auto;
                    }
                    .print-page:last-child {
                        page-break-after: avoid !important;
                        break-after: avoid !important;
                    }
                    .print-page table { page-break-inside: auto; break-inside: auto; }
                    .print-page tr { page-break-inside: avoid; break-inside: avoid; }
                    .print-page thead { display: table-header-group; }
                }
                .print-area { font-family: 'Amiri', serif; }
                .print-area table, .print-area th, .print-area td { border-color: black !important; }
                .print-area th, .print-area td { padding: 0.2rem 0.35rem !important; line-height: 1.25; font-size: 11px; }
            `}</style>
            
            <div className="no-print mb-4 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-white p-4 rounded shadow border border-gray-100 font-sans">
                <div className="flex flex-col gap-1">
                    <h2 className="text-lg font-bold text-gray-800">{t('btn.print')} - {t('print.title.ae_insufficiency')}</h2>
                    <p className="text-xs text-gray-500">يمكنك تعديل أسطر الجدول لضبط الطباعة على الصفحات بشكل مثالي:</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-4 bg-gray-50 p-2 rounded-lg border border-gray-200">
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold text-gray-700">الصفحة الأولى:</label>
                        <input 
                            type="number" 
                            min="1" 
                            max="60" 
                            value={firstPageRows} 
                            onChange={(e) => setFirstPageRows(Math.max(1, parseInt(e.target.value) || 28))}
                            className="w-16 p-1 border border-gray-300 rounded text-center text-sm font-bold bg-white"
                        />
                    </div>
                    <div className="flex items-center gap-2 border-r pr-4 border-gray-300">
                        <label className="text-xs font-semibold text-gray-700">الصفحات الأخرى:</label>
                        <input 
                            type="number" 
                            min="1" 
                            max="60" 
                            value={otherPageRows} 
                            onChange={(e) => setOtherPageRows(Math.max(1, parseInt(e.target.value) || 32))}
                            className="w-16 p-1 border border-gray-300 rounded text-center text-sm font-bold bg-white"
                        />
                    </div>
                </div>

                <div className="flex gap-2 self-stretch md:self-auto justify-end">
                    <button onClick={() => navigate('AE_INSUFFICIENCY')} className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 text-sm font-semibold transition-colors">→ {t('btn.back')}</button>
                    <button onClick={() => window.print()} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-semibold transition-colors"><i className="bi bi-printer mr-2"></i> {t('btn.print')}</button>
                </div>
            </div>

            <div className="print-area bg-white mx-auto max-w-4xl">
                {pages.map((page) => (
                    <div 
                        key={page.pageNumber} 
                        className={`print-page bg-white ${pages.length === 1 ? 'p-2' : 'p-4'} border border-gray-200 print:border-none mb-2 last:mb-0`}
                    >
                        {/* Headers */}
                        {page.isFirstPage ? (
                            <header className="text-center mb-4">
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
                                <h1 className="text-2xl font-bold underline mt-8">{t('print.title.ae_insufficiency')}</h1>
                            </header>
                        ) : (
                            <header className="flex justify-between items-center border-b pb-2 mb-4 text-xs text-gray-500 font-sans" dir="rtl">
                                <span>{t('print.title.ae_insufficiency')}</span>
                                <span className="ltr:font-sans">{t('print.label.date')} {currentDate}</span>
                                <span>صفحة {page.pageNumber} من {pages.length}</span>
                            </header>
                        )}

                        <table className="w-full border-collapse border border-black text-center mt-2">
                            <thead className="bg-gray-100 font-bold">
                                <tr>
                                    <th className="border border-black p-1 w-[10%] text-[11px]">{t('col.serial')}</th>
                                    {!operationId && <th className="border border-black p-1 w-[25%] text-[11px]">{t('col.operation')}</th>}
                                    <th className="border border-black p-1 w-[20%] text-[11px]">{t('col.structure')}</th>
                                    <th className="border border-black p-1 w-[25%] text-[11px]">{t('col.documents_type')}</th>
                                    <th className="border border-black p-1 w-[20%] text-[11px]">{t('col.amount')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {page.rows.map((row) => (
                                    <tr key={row.serial}>
                                        <td className="border border-black p-1 text-[11px]">{row.serial}</td>
                                        {!operationId && <td className="border border-black p-1 text-right text-[11px]">{row.operationName}</td>}
                                        <td className="border border-black p-1 text-right text-[11px]">{row.rubriqueName}</td>
                                        <td className="border border-black p-1 text-right text-[11px]">{row.documentName}</td>
                                        <td className="border border-black p-1 font-bold text-[11px]">{formatCurrency(row.amount)}</td>
                                    </tr>
                                ))}
                                {page.rows.length === 0 && (
                                    <tr>
                                        <td colSpan={!operationId ? 5 : 4} className="border border-black p-4 text-center text-gray-500 italic">
                                            {t('no_data')}
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            <tfoot className="bg-gray-200 font-bold">
                                {pages.length === 1 ? (
                                    /* Single page: show only grand total */
                                    <tr>
                                        <td colSpan={!operationId ? 4 : 3} className="border border-black p-2 text-center text-base">
                                            {t('lbl.total') || 'المجموع'}
                                        </td>
                                        <td className="border border-black p-2 text-base">
                                            {formatCurrency(totalAmount)}
                                        </td>
                                    </tr>
                                ) : !page.isLastPage ? (
                                    /* Multi-page, non-last page: show only page subtotal */
                                    <tr>
                                        <td colSpan={!operationId ? 4 : 3} className="border border-black p-2 text-center text-sm text-gray-800">
                                            المجموع الفرعي للصفحة
                                        </td>
                                        <td className="border border-black p-2 text-sm text-gray-800">
                                            {formatCurrency(page.pageSubtotal)}
                                        </td>
                                    </tr>
                                ) : (
                                    /* Multi-page, last page: show both page subtotal and grand total */
                                    <>
                                        <tr className="bg-gray-100 text-gray-700">
                                            <td colSpan={!operationId ? 4 : 3} className="border border-black p-2 text-center text-sm">
                                                المجموع الفرعي للصفحة
                                            </td>
                                            <td className="border border-black p-2 text-sm font-medium">
                                                {formatCurrency(page.pageSubtotal)}
                                            </td>
                                        </tr>
                                        <tr className="bg-gray-300 text-black border-t-2 border-black">
                                            <td colSpan={!operationId ? 4 : 3} className="border border-black p-2 text-center text-base">
                                                {t('lbl.total_general') || 'المجموع العام'}
                                            </td>
                                            <td className="border border-black p-2 text-base">
                                                {formatCurrency(totalAmount)}
                                            </td>
                                        </tr>
                                    </>
                                )}
                            </tfoot>
                        </table>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PrintAeInsufficiencyPage;
