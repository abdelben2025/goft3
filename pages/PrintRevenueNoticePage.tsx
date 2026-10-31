import React, { useMemo } from 'react';
import { Page } from '../types';
import { useData } from '../context/DataContext';
import { formatCurrency, numberToArabicWords } from '../utils/currencyUtils';
import { normalizeDate } from '../utils/dateUtils';
import { useLanguage } from '../context/LanguageContext';

interface PrintRevenueNoticePageProps {
    navigate: (page: Page, id?: number, tab?: string) => void;
    paiementId: number;
}

const PrintRevenueNoticePage: React.FC<PrintRevenueNoticePageProps> = ({ navigate, paiementId }) => {
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
        const bankAccount = beneficiary ? db.T_COMPTE_BANCAIRE.find(acc => acc.ID_BENEFICIAIRE === beneficiary.ID_BENEFICIAIRE) : null;

        const opCodeParts = operation.N_OPERATION.split('.');
        const actionCode = opCodeParts.length > 5 ? opCodeParts[5] : '';
        const actionEntry = db.T_DIRECTION.find(d => d.ACTION === actionCode);
        const direction = actionEntry || db.T_DIRECTION[0];

        const programmeCode = opCodeParts.length > 3 ? opCodeParts[3] : '';
        const sprogrammeCode = opCodeParts.length > 4 ? opCodeParts[4] : '';
        const programme = db.T_PROGRAMME.find(p => p.PROGRAMME === programmeCode);
        const sprogramme = programme ? db.T_SPROGRAMME.find(sp => sp.ID_PROGRAMME === programme.ID_PROGRAMME && sp.SPROGRAMME === sprogrammeCode) : null;

        const scategorie = piece ? db.T_SCATEGORIE.find(sc => sc.ID_SCATEGORIE === piece.ID_SCATEGORIE) : null;
        const categorie = scategorie ? db.T_CATEGORIE.find(c => c.ID_CATEGORIE === scategorie.ID_CATEGORIE) : null;

        return {
            paiement,
            operation,
            piece,
            beneficiary,
            bankAccount,
            direction,
            programme,
            sprogramme,
            categorie,
            scategorie
        };
    }, [db, loading, paiementId]);

    const printStyles = `
        body { font-family: 'Amiri', serif; direction: rtl; }
        .print-area { direction: rtl; font-family: 'Amiri', serif; color: black; padding: 15mm; background: white; font-size: 13px; line-height: 1.4; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 12px; }
        th, td { border: 1px solid black; padding: 4px 6px; text-align: right; vertical-align: top; }
        th { background-color: #f3f4f6; font-weight: bold; text-align: center; }
        .text-center { text-align: center; }
        .font-bold { font-weight: bold; }
        .border-none { border: none !important; }
    `;

    if (loading) return <div className="p-8 text-center">{t('loading')}</div>;
    if (!printData) return <div className="p-8 text-center text-red-500">{t('no_data')}</div>;

    const { paiement, operation, beneficiary, bankAccount, direction, programme, sprogramme, categorie, scategorie } = printData;
    const amountToCollect = paiement.PENALITE_RETARD || paiement.MONTANT_PAI || 0;

    const deductionReason =
        (paiement.PENALITE_RETARD && paiement.PENALITE_RETARD > 0)
            ? t('print.deduction_penalty_reason')
            : t('print.deduction_excess_reason');

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
                <h2 className="text-xl font-bold">{t('print.revenue_notice_preview')}</h2>
                <div className="flex gap-2">
                    <button onClick={() => navigate('OPERATION_DETAILS', operation.ID_OPERATION, `PAIEMENTS:${paiement.ID_PAIEMENT}:blue`)} className="bg-gray-600 text-white px-4 py-2 rounded">{t('btn.back')}</button>
                    <button onClick={() => window.print()} className="bg-blue-700 text-white px-6 py-2 rounded font-bold hover:bg-blue-800 transition-colors"><i className="bi bi-printer mr-2"></i> {t('btn.print')} </button>
                </div>
            </div>

            <div id="print-content" className="print-area bg-white mx-auto max-w-[210mm] text-black">
                
                    <div>
                        <span className="font-bold text-sm ">{t('print.appendix_num', { num: '02' })}</span>
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
                    <h2 className="text-xl font-bold">{t('print.revenue_notice_title')}</h2>
                </div>

                <table className="mb-3">
                    <tbody>
                        <tr>
                            
                            <td className="w-1 p-1.5 border border-black">
                                <div className="flex justify-between"><span>{t('print.fiscal_year', { year: paiement.ANNEE })}</span><div className="text-right ml-10"><span> {t('print.folio_account')}</span></div></div>
                                <div className="flex justify-between"><span>{t('print.label.activity_portfolio')} : {direction?.PORTEFEUILLE || ''}</span></div>
                                <div className="flex justify-between"><span>{t('print.label.program')} : {programme?.PROGRAMME || ''}</span></div>
                                <div className="flex justify-between"><span>{t('col.sub_program')} :{sprogramme?.SPROGRAMME || ''}</span></div>
                                <div className="flex justify-between"><span>{t('print.label.activity')} :{direction?.ACTION || ''}</span></div>
                                <div className="flex justify-between"><span>{t('print.label.sub_activity')} :{direction?.SACTION || ''}</span></div>
                                <div className="flex justify-between"><span>{t('print.label.title_3')}</span></div>
                                <div className="flex justify-between"><span>{t('col.categorie')} : {categorie?.C_CATEGORIE || ''} {categorie?.INT_CATEGORIE || ''}</span><span>{t('col.sub_categorie')} : {scategorie?.C_SCATEGORIE || ''} {scategorie?.INT_SCATEGORIE || ''}</span></div>
                                <div className="flex justify-between"><span>{t('print.label.order_num')} :</span></div>
                            </td>
                        </tr>
                    </tbody>
                </table>

                <div className="mb-3 leading-relaxed text-justify text-xs">
                    <p>
                        {t('print.revenue_paid_request', { name: beneficiary?.BENEFICIAIRE || '' })}
                    </p>
                    <p className="font-bold mt-1.5">{t('print.amount_referred_to')}</p>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th className="w-2/5">{t('print.debtor')}</th>
                            <th className="w-2/5">{t('print.reasons')}</th>
                            <th className="w-1/5">{t('print.clearance_basis')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>
                                <div className="space-y-1 text-xs">
                                    <p><span className="font-bold">{t('print.name_and_surname')}</span> <span className="uppercase">{beneficiary?.BENEFICIAIRE || ''}</span></p>
                                    <p><span className="font-bold">{t('print.debtor_activity')}</span> {beneficiary?.ACTIVITE || ''}</p>
                                    <p><span className="font-bold">{t('print.debtor_address')}</span> {beneficiary?.ADRESSE || ''}</p>
                                    <p><span className="font-bold">{t('print.current_account')}</span> {bankAccount ? `${bankAccount.RIB} ${bankAccount.BANQUE}` : ''}</p>
                                    <p><span className="font-bold">{t('print.commercial_register')}</span> {beneficiary?.RC || ''}</p>
                                    <p><span className="font-bold">{t('col.tax_id')}</span> {beneficiary?.CODE_FISCALE || ''}</p>
                                </div>
                            </td>
                            <td className="text-center align-middle">
                                <p className="font-medium">{deductionReason}</p>
                            </td>
                            <td className="text-center align-middle">
                                <p className="text-[11px]">{t('print.gross_mandat_amount')}</p>
                                <p className="font-bold mt-1">= {formatCurrency(paiement.MONTANT_PAI)}</p>
                            </td>
                        </tr>
                        <tr>
                            <td colSpan={2} className="font-bold text-left px-4">{t('print.amount_to_collect')}</td>
                            <td className="text-center font-black text-emerald-800 text-sm">{formatCurrency(amountToCollect)}</td>
                        </tr>
                    </tbody>
                </table>

                <div className="mt-3 space-y-2 text-xs">
                    <p className="font-bold">
                        {t('print.stops_at_amount', { amount: numberToArabicWords(amountToCollect) })}
                    </p>
                               
				</div>
				                       
                        <div className="text-left font-bold mt-4 ml-10">
                            <p>{t('print.drawn_at', { date: normalizeDate(paiement.DATE_PAI) })} <span dir="ltr">{normalizeDate(paiement.DATE_PAI)}</span></p>
                            <p className="mt-4">{t('print.ordonnateur_sign')}</p>
                        </div>
                
				<div>
                       <p className="text-[10px] text-right text-gray-600 mt-11">{t('print.note_1_of_2')}</p>
                </div>
            </div>
        </div>
    );
};

export default PrintRevenueNoticePage;
