import React, { useMemo } from 'react';
import { Page } from '../types';
import { useData } from '../context/DataContext';
import { formatCurrency, numberToArabicWords } from '../utils/currencyUtils';
import { useLanguage } from '../context/LanguageContext';

interface PrintRevenueTablePageProps {
    navigate: (page: Page, id?: number, tab?: string) => void;
    paiementId: number;
}

const PrintRevenueTablePage: React.FC<PrintRevenueTablePageProps> = ({ navigate, paiementId }) => {
    const { db, loading } = useData();
    const { t } = useLanguage();

    const printData = useMemo(() => {
        if (loading || !paiementId) return null;

        const paiement = db.T_PAIEMENT.find(p => p.ID_PAIEMENT === paiementId);
        if (!paiement) return null;

        const operation = db.T_OPERATION.find(op => op.ID_OPERATION === paiement.ID_OPERATION);
        if (!operation) return null;

        const piece = db.T_PIECE.find(p => p.ID_PIECE === paiement.ID_PIECE);
        const beneficiary = piece?.ID_BENEFICIAIRE ? db.T_BENEFICIAIRE.find(b => b.ID_BENEFICIAIRE === piece.ID_BENEFICIAIRE) : null;

        const opCodeParts = operation.N_OPERATION.split('.');
        const actionCode = opCodeParts.length > 5 ? opCodeParts[5] : '';
        const actionEntry = db.T_DIRECTION.find(d => d.ACTION === actionCode);
        const direction = actionEntry || db.T_DIRECTION[0];

        const programmeCode = opCodeParts.length > 3 ? opCodeParts[3] : '';
        const sprogrammeCode = opCodeParts.length > 4 ? opCodeParts[4] : '';
        const programme = db.T_PROGRAMME.find(p => p.PROGRAMME === programmeCode);
        const sprogramme = programme ? db.T_SPROGRAMME.find(sp => sp.ID_PROGRAMME === programme.ID_PROGRAMME && sp.SPROGRAMME === sprogrammeCode) : null;

        return {
            paiement,
            operation,
            piece,
            beneficiary,
            direction,
            programme,
            sprogramme
        };
    }, [db, loading, paiementId]);

    const printStyles = `
        body { font-family: 'Amiri', serif; direction: rtl; }
        .print-area { direction: rtl; font-family: 'Amiri', serif; color: black; padding: 15mm; background: white; font-size: 13px; line-height: 1.4; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 12px; }
        th, td { border: 1px solid black; padding: 5px; text-align: right; vertical-align: middle; }
        th { background-color: #f3f4f6; font-weight: bold; text-align: center; }
        .text-center { text-align: center; }
        .font-bold { font-weight: bold; }
        .border-none { border: none !important; }
    `;

    if (loading) return <div className="p-8 text-center">{t('loading')}</div>;
    if (!printData) return <div className="p-8 text-center text-red-500">{t('no_data')}</div>;

    const { paiement, operation, beneficiary, direction, programme, sprogramme } = printData;
    const amountToCollect = paiement.PENALITE_RETARD || paiement.MONTANT_PAI || 0;

    return (
        <div className="bg-white min-h-screen">
            <style>{printStyles}</style>
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    #print-content, #print-content * { visibility: visible; }
                    #print-content { position: absolute; left: 0; right: 0; top: 0; width: 100%; }
                    @page { margin: 10mm; size: A4 portrait; }
                    .no-print { display: none !important; }
                }
            `}</style>

            <div className="no-print mb-4 flex justify-between items-center bg-gray-100 p-3 rounded shadow max-w-[210mm] mx-auto">
                <h2 className="text-xl font-bold">{t('print.revenue_table_preview')}</h2>
                <div className="flex gap-2">
                    <button onClick={() => navigate('OPERATION_DETAILS', operation.ID_OPERATION, `PAIEMENTS:${paiement.ID_PAIEMENT}:blue`)} className="bg-gray-600 text-white px-4 py-2 rounded">{t('btn.back')}</button>
                    <button onClick={() => window.print()} className="bg-blue-700 text-white px-6 py-2 rounded font-bold hover:bg-blue-800 transition-colors"><i className="bi bi-printer mr-2"></i> {t('btn.print')} </button>
                </div>
            </div>

            <div id="print-content" className="print-area bg-white mx-auto max-w-[210mm] text-black">
                <div>
                    <span className="font-bold text-sm">{t('print.appendix_num', { num: '05' })}</span>
                </div>
                <div className="text-center">
                    <p className="font-bold text-base">{t('print.header.republic')}</p>
                    <p className="text-sm underline font-bold">REPUBLIQUE ALGERIENNE DEMOCRATIQUE ET POPULAIRE</p>
                </div>
                <div className="border border-black p-2 text-center text-xs w-[260px] mt-3">
                    <p className="font-bold">{direction?.DIRECTION}</p>
                    <p className="mt-1">{t('print.label.ordonnateur_code')} : {direction?.ORDONATEUR}</p>
                </div>

                <div className="text-center my-3">
                    <h2 className="text-xl font-bold">{t('print.revenue_table_title')}</h2>
                </div>

                <table className="mb-3">
                    <tbody>
                        <tr>
						   
                            <td className="w-1/2 p-1.5 border border-black">
                                <div className="flex justify-between"><span>{t('print.fiscal_year', { year: paiement.ANNEE })}</span></div>
                                <div className="flex justify-between"><span>{t('print.label.activity_portfolio')} : {direction?.PORTEFEUILLE || ''}</span></div>
                                <div className="flex justify-between"><span>{t('print.label.program')} : {programme?.PROGRAMME || ''}</span></div>
                                <div className="flex justify-between"><span>{t('col.sub_program')} :{sprogramme?.SPROGRAMME || ''}</span></div>
                                <div className="flex justify-between"><span>{t('print.label.activity')} :{direction?.ACTION || ''}</span></div>
                                <div className="flex justify-between"><span>{t('print.label.sub_activity')} :{direction?.SACTION || ''}</span></div>
                            </td>
							<div className="text-right mr-10">
								<p>{t('print.dispatch_table_num')}</p>
								<p>{t('print.account_number')}</p>
                            </div> 
                        </tr>
                    </tbody>
                </table>

                <table>
                    <thead>
                        <tr>
                            <th colSpan={2} className="w-1/4 ">{t('print.order_num_date_header')}</th>
                            <th rowSpan={2} className="w-1/3">{t('print.debtors_names')}</th>
                            <th rowSpan={2} className="w-1/5 ">{t('print.amount_to_collect')}</th>
                            <th rowSpan={2} className="w-1/5">{t('col.observation')}</th>
                        </tr>
                        <tr>
                            <th>{t('print.num_header')}</th>
                            <th className="w-1/5">{t('col.date')}</th>
							
							
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td className="text-center size-20"></td>
                            <td className="text-center"></td>
                            <td className="text-center font-medium">{beneficiary?.BENEFICIAIRE || ''}</td>
                            <td className="text-center font-bold">{formatCurrency(amountToCollect)}</td>
                            <td></td>
							
                        </tr>
						
						
                        <tr>
						    <td className=" border border-none"></td>
							<td className=" border border-none"></td>
                            <td className="font-bold text-left px-4">{t('print.total_revenue_orders')}</td>
                            <td className="text-center font-bold">{formatCurrency(amountToCollect)}</td>
                           
                        </tr>
                        <tr>
						    <td className=" border border-none"></td>
							<td className=" border border-none"></td>
                            <td className="font-bold text-left px-4">{t('print.previous_amount_total')}</td>
                            <td className="text-center"></td>
                            
                        </tr>
                        <tr>
						    <td className=" border border-none"></td>
							<td className=" border border-none"></td>
                            <td className="font-bold text-left px-4">{t('print.total_amount')}</td>
                            <td className="text-center font-black text-emerald-800">{formatCurrency(amountToCollect)}</td>
                            
                        </tr>
                    </tbody>
                </table>

                <div className="mt-3 space-y-2 text-xs">
                    <p className="font-bold">
                        {t('print.stops_at_amount', { amount: numberToArabicWords(amountToCollect) })}
                    </p>
                </div>

                <div className="text-left font-bold mt-4 ml-10">
                    <p>{t('print.relizane_in_long')}</p>
                    <p className="mt-4">{t('print.ordonnateur_sign')}</p>
                </div>
            </div>
        </div>
    );
};

export default PrintRevenueTablePage;
