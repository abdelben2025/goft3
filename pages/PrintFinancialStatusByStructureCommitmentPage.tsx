
import React, { useMemo } from 'react';
import { Page } from '../types';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';

interface PrintFinancialStatusByStructureCommitmentPageProps {
    navigate: (page: Page, id?: number, tab?: string) => void;
    operationId: number;
}

const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return '0,00';
    return new Intl.NumberFormat('ar-DZ', {
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
};

const PrintFinancialStatusByStructureCommitmentPage: React.FC<PrintFinancialStatusByStructureCommitmentPageProps> = ({ navigate, operationId }) => {
    const { db, loading } = useData();
    const { t } = useLanguage();

    const printData = useMemo(() => {
        if (loading) return { loading: true };
        if (!operationId) return { error: 'missing_id' };

        const operation = db.T_OPERATION.find(op => op.ID_OPERATION === operationId);
        if (!operation) return { error: 'operation_not_found' };

        const direction = db.T_DIRECTION[0];
        if (!direction) return { error: 'direction_not_found' };

        const operationRubriques = db.T_RUBRIQUE_OP.filter(ro => ro.ID_OPERATION === operationId);
        
        const rows = operationRubriques.map(ro => {
            const rubrique = db.T_RUBRIQUE.find(r => r.ID_RUBRIQUE === ro.ID_RUBRIQUE);
            
            const pieceIdsForRubrique = new Set(db.T_PIECE
                .filter(p => p.ID_OPERATION === operationId && p.ID_RUBRIQUE === ro.ID_RUBRIQUE)
                .map(p => p.ID_PIECE)
            );

            const commitmentAmount = db.T_ENGAGEMENT
                .filter(e => pieceIdsForRubrique.has(e.ID_PIECE) && (e.NATURE_ENG === 'التزام' || e.NATURE_ENG === 'ملحق' || e.NATURE_ENG === 'سحب'))
                .reduce((sum, e) => sum + e.MONTANT_ENG, 0);

            const finalAuth = ro.MONTANT_FINALE ?? ro.MONTANT_INITIALE;
            const remainingAuth = finalAuth - commitmentAmount;

            return {
                structure: rubrique?.RUBRIQUE || 'غير معروف',
                initialAuth: ro.MONTANT_INITIALE,
                finalAuth: finalAuth,
                commitment: commitmentAmount,
                remainingAuth: remainingAuth,
            };
        });
        
        const totals = rows.reduce((acc, row) => {
            acc.initialAuth = (acc.initialAuth || 0) + row.initialAuth;
            acc.finalAuth = (acc.finalAuth || 0) + row.finalAuth;
            acc.commitment = (acc.commitment || 0) + row.commitment;
            acc.remainingAuth = (acc.remainingAuth || 0) + row.remainingAuth;
            return acc;
        }, {} as any);
        
        const today = new Date();
        const formattedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        return {
            operation,
            direction,
            rows,
            totals,
            currentDate: formattedDate
        };
    }, [db, loading, operationId]);

    const printStyles = `
        @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap');
        body { font-family: 'Amiri', serif; direction: rtl; }
        .print-area { direction: rtl; font-family: 'Amiri', serif; color: black; padding: 20px; background: white; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 11px; }
        th, td { border: 1px solid black; padding: 4px; text-align: center; }
        th { background-color: #f3f4f6; font-weight: bold; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .font-bold { font-weight: bold; }
        .text-lg { font-size: 1rem; }
        .text-sm { font-size: 0.675rem; }
        .mb-4 { margin-bottom: 1rem; }
        .w-full { width: 100%; }
        .flex { display: flex; }
        .justify-between { justify-content: space-between; }
        .justify-center { justify-content: center; }
        .justify-end { justify-content: flex-end; }
        .w-1\\/2 { width: 50%; }
        .gap-4 { gap: 1rem; }
        .border-none { border-style: none; }
        .p-1 { padding: 0.25rem; }
        .p-2 { padding: 0.5rem; }
        .p-3 { padding: 0.75rem; }
        .h-24 { height: 6rem; }
        .align-top { vertical-align: top; }
        .w-3\\/5 { width: 60%; }
        .w-1\\/5 { width: 20%; }
        .mt-2 { margin-top: 0.5rem; }
        .mt-8 { margin-top: 2rem; }
        .space-y-2 > * + * { margin-top: 0.5rem; }
        .space-y-3 > * + * { margin-top: 0.75rem; }
    `;

    const handlePrintJS = () => {
        window.print();
    };

    if (loading || (printData && 'loading' in printData)) return <div className="p-8 text-center">{t('loading')}</div>;
    
    if (!printData || 'error' in printData) {
        let errorMsg = t('no_data');
        if (printData && 'error' in printData) {
            if (printData.error === 'missing_id') errorMsg = "يرجى اختيار العملية أولاً";
            if (printData.error === 'operation_not_found') errorMsg = "العملية المختارة غير موجودة";
            if (printData.error === 'direction_not_found') errorMsg = "يرجى ملء معلومات المديرية في الإعدادات أولاً";
        }
        return <div className="p-8 text-center text-red-500 font-bold">{errorMsg}</div>;
    }

    const { operation, direction, rows, totals, currentDate } = printData as any;

    return (
        <div className="bg-white min-h-screen">
            <style>{printStyles}</style>
            <style>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    #print-content, #print-content * {
                        visibility: visible;
                    }
                    #print-content {
                        position: absolute;
                        left: 0;
                        right: 0;
                        top: 0;
                        width: 100%;
                        page-break-inside: avoid;
                    }
                    @page { margin: 0.5cm; size: A4 portrait; }
                    .no-print { display: none !important; }
                }
            `}</style>
            <div className="no-print mb-4 flex justify-between items-center bg-gray-100 p-3 rounded shadow">
                <h2 className="text-xl font-bold">معاينة طباعة الوضعية المالية حسب الهيكلة (الالتزام)</h2>
                <div className="flex gap-2">
                    <button onClick={() => navigate('FINANCIAL_STATUS_BY_STRUCTURE')} className="bg-gray-600 text-white px-4 py-2 rounded">رجوع</button>
                    <button onClick={handlePrintJS} className="bg-blue-700 text-white px-6 py-2 rounded font-bold hover:bg-blue-800 transition-colors"><i className="bi bi-printer mr-2"></i> طباعة </button>
                </div>
            </div>

            <div id="print-content" className="print-area bg-white p-6 mx-auto max-w-[210mm] min-h-[297mm] ">
                <header className="text-right mb-6">
                    <p className="font-bold text-lg text-center">{t('print.header.republic')}</p>
                    <p>{direction.INT_PORTEFEUILLE}</p>
                    <p>{direction.DIRECTION}</p>
                </header>
                
                <div className="text-center font-bold mb-6">
                    <h1 className="text-xl underline"> الوضعية المالية الموقوفة في: {currentDate}</h1>
                </div>

                <div className="text-center space-y-2 text-base mb-6">
                    <p><span className="font-bold">{t('print.label.operation_num')}</span> {operation.N_OPERATION}</p>
                    <p><span className="font-bold">{t('print.label.operation_title')}</span> {operation.INT_OPERATION}</p>
                </div>

                <table className="w-full border: 0 text-center text-base">
                    <thead className="font-bold bg-gray-100">
                        <tr>
                            <th className="border border-black p-2 w-[35%]">هيكلة الكلفة</th>
                            <th className="border border-black p-2">رخصة الالتزام الأولي</th>
                            <th className="border border-black p-2">رخصة الالتزام النهائي</th>
                            <th className="border border-black p-2">الالتزام</th>
                            <th className="border border-black p-2">باقي رخصة الالتزام</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row: any, index: number) => (
                             <tr key={index}>
                                <td className="border border-black p-2 text-right w-[35%]">{row.structure}</td>
                                <td className="border border-black p-2">{formatCurrency(row.initialAuth)}</td>
                                <td className="border border-black p-2">{formatCurrency(row.finalAuth)}</td>
                                <td className="border border-black p-2">{formatCurrency(row.commitment)}</td>
                                <td className="border border-black p-2">{formatCurrency(row.remainingAuth)}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot className="font-bold bg-gray-100">
                        <tr>
                            <td className="border border-black p-2 text-center">{t('lbl.total')}</td>
                            <td className="border border-black p-2">{formatCurrency(totals.initialAuth)}</td>
                            <td className="border border-black p-2">{formatCurrency(totals.finalAuth)}</td>
                            <td className="border border-black p-2">{formatCurrency(totals.commitment)}</td>
                            <td className="border border-black p-2">{formatCurrency(totals.remainingAuth)}</td>
                        </tr>
						<tr>
						    <td className="border-r-0 border-l-0 border-b-0 bg-white"></td>
                            <td className="border-r-0 border-l-0 border-b-0 bg-white"></td>
                            <td className="border-r-0 border-l-0 border-b-0 bg-white"></td>
                            <td className="border-r-0 border-l-0 border-b-0 bg-white"></td>
						    <td className="border-r-0 border-l-0 border-b-0 text-cent bg-white">{t('print.footer.director')}</td>
						</tr>
					</tfoot>
                </table>
            </div>
        </div>
    );
};

export default PrintFinancialStatusByStructureCommitmentPage;
