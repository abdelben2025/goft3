
import React, { useMemo } from 'react';
import { Page } from '../types';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';

interface PrintMandatTablePageProps {
    navigate: (page: Page, id?: number, tab?: string) => void;
    paiementId: number;
}

const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return '0,00';
    return new Intl.NumberFormat('ar-DZ', { 
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
};

const PrintMandatTablePage: React.FC<PrintMandatTablePageProps> = ({ navigate, paiementId }) => {
    const { db, loading } = useData();
    const { t } = useLanguage();

    const printData = useMemo(() => {
        if (loading || !paiementId) return null;

        const paiement = db.T_PAIEMENT.find(p => p.ID_PAIEMENT === paiementId);
        if (!paiement) return null;

        const operation = db.T_OPERATION.find(op => op.ID_OPERATION === paiement.ID_OPERATION);
        if (!operation) return null;

        const engagement = db.T_ENGAGEMENT.find(e => e.ID_ENGAGEMENT === paiement.ID_ENG);
        if (!engagement) return null;
        
        const piece = db.T_PIECE.find(p => p.ID_PIECE === paiement.ID_PIECE);
        if (!piece) return null;

        const scategorie = db.T_SCATEGORIE.find(sc => sc.ID_SCATEGORIE === piece.ID_SCATEGORIE);
        if (!scategorie) return null;
        
        const categorie = db.T_CATEGORIE.find(c => c.ID_CATEGORIE === scategorie.ID_CATEGORIE);
        if (!categorie) return null;

        
        const opCodeParts = operation.N_OPERATION.split('.');
        const programmeCode = opCodeParts.length > 3 ? opCodeParts[3] : '';
        const sprogrammeCode = opCodeParts.length > 4 ? opCodeParts[4] : '';
        const actionCode = opCodeParts.length > 5 ? opCodeParts[5] : '';
        const actionEntry = db.T_DIRECTION.find(d => d.ACTION === actionCode);
        const actionName = actionEntry ? actionEntry.INT_ACTION : 'نشاط غير معروف';

        const direction = actionEntry || db.T_DIRECTION[0];
        if (!direction) return null;
        const programme = db.T_PROGRAMME.find(p => p.PROGRAMME === programmeCode);
        
        const tableRow = {
            numSequentiel: paiement.N_PAI,
            programmeFre: sprogrammeCode,
            imputation: {
                classe: `الصنف: ${categorie.C_CATEGORIE} تثبيتات عينية`,
                sousClasse: `الصنف الفرعي: ${scategorie.C_SCATEGORIE} ${scategorie.INT_SCATEGORIE}`,
            },
            numFicheEng: `${engagement.N_ENG}/${engagement.ANNEE}`,
            montantMandat: paiement.MONTANT_PAI,
            montantClasse: paiement.MONTANT_PAI,
            dateEmission: paiement.DATE_MANDAT ? paiement.DATE_MANDAT.split('-').reverse().join('/') : '',
        };

        return {
            paiement,
            operation,
            direction,
            programme,
            tableRow,
            actionCode,
            actionName
        };

    }, [db, loading, paiementId]);

    const printStyles = `
        @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap');
        body { font-family: 'Amiri', serif; direction: rtl; }
        .print-area { direction: rtl; font-family: 'Amiri', serif; color: black; padding: 20px; background: white; }
        .text-center { text-align: center; }
        .font-bold { font-weight: bold; }
        .text-sm { font-size: 0.875rem; }
        .text-xs { font-size: 0.75rem; }
        .text-lg { font-size: 1rem; }
        .mb-2 { margin-bottom: 0.5rem; }
        .my-4 { margin-top: 1rem; margin-bottom: 1rem; }
        .mt-2 { margin-top: 0.5rem; }
        .mt-5 { margin-top: 1.25rem; }
        .flex { display: flex; }
        .justify-between { justify-content: space-between; }
        .w-1\\/3 { width: 33.333333%; }
        .w-1\\/2 { width: 50%; }
        .w-full { width: 100%; }
        .space-y-1 > * + * { margin-top: 0.25rem; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid black; padding: 2px; }
        .text-right { text-align: right; }
        .bg-gray-100 { background-color: #f3f4f6; }
        .w-\\[5\\%\\] { width: 5%; }
        .align-middle { vertical-align: middle; }
        .h-20 { height: 5rem; }
    `;

    const handlePrintJS = () => {
        window.print();
    };

    if (loading) return <div className="p-8 text-center">{t('loading')}</div>;
    if (!printData) return <div className="p-8 text-center">{t('no_data')}</div>;
    
    const { paiement, operation, direction, programme, tableRow, actionCode, actionName } = printData;

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
                        top: 0;
                        width: 100%;
                    }
                    @page { margin: 0; size: A4 landscape; }
                    .no-print { display: none !important; }
                }
            `}</style>
            <div className="no-print mb-4 flex justify-between items-center bg-gray-100 p-3 rounded shadow">
                <h2 className="text-xl font-bold">{t('print.title.mandate_table')}</h2>
                <div className="flex gap-2">
                    <button onClick={() => navigate('OPERATION_DETAILS', operation.ID_OPERATION, `PAIEMENTS:${paiement.ID_PAIEMENT}:blue`)} className="bg-gray-600 text-white px-4 py-2 rounded">رجوع</button>
                    <button onClick={handlePrintJS} className="bg-blue-700 text-white px-6 py-2 rounded font-bold hover:bg-blue-800 transition-colors"><i className="bi bi-printer mr-2"></i> طباعة </button>
                </div>
            </div>

            <div id="print-content" className="print-area bg-white mx-auto max-w-[290mm] text-black" dir="rtl">
                <div className="text-center font-bold mb-2">
                    <p>{t('print.header.republic')}</p>
                    <p className="text-sm">République Algérienne Démocratique et Populaire</p>
                    <p className="text-lg mt-2">{t('print.title.mandate_table')}</p>
                </div>
                
                <div className="flex justify-between text-sm my-4">
                    <div className="w-1/3 space-y-1">
                        <p>{direction.INT_PORTEFEUILLE}</p>
                        <p>{direction.DIRECTION}</p>
                        <p><span className="font-bold">{t('print.label.ordonnateur_code')}:</span> {direction.ORDONATEUR}</p>
                        <p><span className="font-bold">{t('print.label.mandate_year')}:</span> {paiement.ANNEE}</p>
                        <p><span className="font-bold">{t('print.label.mandate_table_num')}:</span></p>
                        <p><span className="font-bold">{t('print.label.mandate_table_date')}:</span></p>
                        <p><span className="font-bold">{t('print.label.accountant_spec')}:</span> أمين الخزينة لولاية غليزان</p>
                    </div>
                     <div className="w-1/2">
                        <table className="w-full border-collapse border border-black text-xs">
                            <thead>
                                
                                <tr className="font-bold text-center">
                                    <td className="border border-black p-1">{t('print.label.classification_activity')}</td>
                                    <td className="border border-black p-1">{t('col.code')}</td>
                                    <td className="border border-black p-1">{t('print.label.designation')}</td>
                                </tr>
                            </thead>
                            <tbody className="ltr:text-left rtl:text-right">
                                <tr>
                                    <td className="border border-black p-1 font-bold">{t('print.label.activity_portfolio')}</td>
                                    <td className="border border-black p-1 text-center">{direction.PORTEFEUILLE}</td>
                                    <td className="border border-black p-1 text-center">{direction.INT_PORTEFEUILLE}</td>
                                </tr>
                                <tr>
                                    <td className="border border-black p-1 font-bold">{t('print.label.program')}</td>
                                    <td className="border border-black p-1 text-center">{programme?.PROGRAMME}</td>
                                    <td className="border border-black p-1 text-center">{programme?.INT_PROGRAMME}</td>
                                </tr>
                                <tr>
                                    <td className="border border-black p-1 font-bold">{t('print.label.activity')}</td>
                                    <td className="border border-black p-1 text-center">{actionCode}</td>
                                    <td className="border border-black p-1 text-center">{actionName}</td>
                                </tr>
                                <tr>
                                    <td className="border border-black p-1 font-bold">{t('print.label.sub_activity')}</td>
                                    <td className="border border-black p-1 text-center">{direction.SACTION}</td>
                                    <td className="border border-black p-1 text-center">{direction.INT_SACTION}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <table className="w-full border-collapse border border-black text-sm text-center">
                    <thead>
                        <tr className="font-bold">
                            <th rowSpan={2} className="w-[5%] border border-black p-1 align-middle">{t('col.mandat_seq')}</th>
                            <th rowSpan={2} className="w-[5%] border border-black p-1 align-middle">{t('col.sub_program')}</th>
                            <th colSpan={2} className="border border-black p-1">{t('col.budget_imputation')}</th>
                            <th rowSpan={2} className="border border-black p-1 align-middle">{t('print.label.card_num')}</th>
                            <th colSpan={2} className="border border-black p-1">{t('col.amount')}</th>
                            <th rowSpan={2} className="border border-black p-1 align-middle">{t('col.mandat_emission_date')}</th>
                        </tr>
                        <tr className="font-bold">
                            <th className="border border-black p-1">{t('col.categorie')}</th>
                            <th className="border border-black p-1">{t('col.sub_categorie')}</th>
                            <th className="border border-black p-1">الحوالة</th>
                            <th className="border border-black p-1">{t('col.categorie')}</th>
                        </tr>
                    </thead>
                    <tbody className="h-20">
                        <tr>
                            <td className="border border-black align-middle p-1">  </td>
                            <td className="border border-black align-middle p-1">{tableRow.programmeFre}</td>
                            <td className="border border-black align-middle p-1 text-center">{tableRow.imputation.classe}</td>
                            <td className="border border-black align-middle p-1 text-center">{tableRow.imputation.sousClasse}</td>
                            <td className="border border-black align-middle p-1">{tableRow.numFicheEng}</td>
                            <td className="border border-black align-middle p-1">{formatCurrency(tableRow.montantMandat)}</td>
                            <td className="border border-black align-middle p-1">{formatCurrency(tableRow.montantClasse)}</td>
                            <td className="border border-black align-middle p-1"></td>
                        </tr>
                        
                    </tbody>
                </table>
                
                <div className="flex justify-between mt-5 text-sm">
                    <p className="font-bold">{t('print.label.accountant_signature')}</p>
                    <p className="font-bold">{t('print.label.ordonnateur_frame')}</p>
                </div>
            </div>
        </div>
    );
};
export default PrintMandatTablePage;
