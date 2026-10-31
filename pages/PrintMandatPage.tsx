
import React, { useMemo, useState } from 'react';
import { Page } from '../types';
import { useData } from '../context/DataContext';
import { formatCurrency, numberToArabicWords } from '../utils/currencyUtils';
import { useLanguage } from '../context/LanguageContext';

interface PrintMandatPageProps {
    navigate: (page: Page, id?: number, tab?: string) => void;
    paiementId: number;
}

const PrintMandatPage: React.FC<PrintMandatPageProps> = ({ navigate, paiementId }) => {
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

        const paymentPiece = db.T_PIECE.find(p => p.ID_PIECE === paiement.ID_PIECE);
        if (!paymentPiece) return null;

        const beneficiary = paymentPiece.ID_BENEFICIAIRE ? db.T_BENEFICIAIRE.find(b => b.ID_BENEFICIAIRE === paymentPiece.ID_BENEFICIAIRE) : null;
        if (!beneficiary) return null;

        const account = db.T_COMPTE_BANCAIRE.find(acc => acc.ID_COMPTE === paymentPiece.ID_COMPTE);

        const opCodeParts = operation.N_OPERATION.split('.');
        const actionCode = opCodeParts.length > 5 ? opCodeParts[5] : '';
        const actionEntry = db.T_DIRECTION.find(d => d.ACTION === actionCode);
        const actionName = actionEntry ? actionEntry.INT_ACTION : 'نشاط غير معروف';
        
        const direction = actionEntry || db.T_DIRECTION[0];
        if (!direction) return null;

        const scategorie = db.T_SCATEGORIE.find(sc => sc.ID_SCATEGORIE === paymentPiece.ID_SCATEGORIE);
        const categorie = scategorie ? db.T_CATEGORIE.find(c => c.ID_CATEGORIE === scategorie.ID_CATEGORIE) : null;
        
        const programmeCode = opCodeParts[3];
        const sprogrammeCode = opCodeParts.length > 4 ? opCodeParts[4] : '';
        const programme = db.T_PROGRAMME.find(p => p.PROGRAMME === programmeCode);
        const sprogramme = programme ? db.T_SPROGRAMME.find(sp => sp.ID_PROGRAMME === programme.ID_PROGRAMME && sp.SPROGRAMME === sprogrammeCode) : null;

              
        
        const montantBrut = (paiement.MONTANT_PAI ?? 0) ;
        
        const totalDeductions =  (paiement.PENALITE_RETARD ?? 0);
        const montantNet =  (paiement.MONTANT_PAI ?? 0) - (paiement.PENALITE_RETARD ?? 0);
        return {
            paiement,
            operation,
            engagement,
            beneficiary,
            account,
            direction,
            scategorie,
            categorie,
            programme,
            sprogramme,
            montantBrut,
            totalDeductions,
			montantNet,
            actionCode,
            actionName
        };
    }, [db, loading, paiementId]);

    const printStyles = `
        body { font-family: 'Amiri', serif; direction: rtl; }
        .print-area { direction: rtl; font-family: 'Amiri', serif; color: black; padding: 10px; background: white; }
        .text-center { text-align: center; }
        .font-bold { font-weight: bold; }
        .text-sm { font-size: 0.80rem; }
        .text-xs { font-size: 0.70rem; }
        .text-lg { font-size: 0.98rem; }
        .my-2 { margin-top: 0.3rem; margin-bottom: 0.3rem; }
        .mb-1 { margin-bottom: 0.2rem; }
        .flex { display: flex; }
        .justify-between { justify-content: space-between; }
        .w-1\\/3 { width: 33.333333%; }
        .w-1\\/2 { width: 50%; }
        .w-2\\/4 { width: 50%; }
        .w-1\\/4 { width: 25%; }
        .text-right { text-align: right; }
        .space-y-1 > * + * { margin-top: 0.15rem; }
        .pt-2 { padding-top: 0.3rem; }
        .p-2 { padding: 0.3rem; }
        .border { border-width: 1px; }
        .border-black { border-color: black; }
        .inline-block { display: inline-block; }
        .bg-gray-100 { background-color: #f3f4f6; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid black; padding: 1px 2px; word-wrap: break-word; overflow-wrap: break-word; }
        .text-right { text-align: right; }
        .my-2 { margin-top: 0.3rem; margin-bottom: 0.3rem; }
        .w-\\[5\\%\\] { width: 5%; }
        .w-\\[3\\%\\] { width: 3%; }
        .w-\\[15\\%\\] { width: 15%; }
        .w-\\[10\\%\\] { width: 10%; }
        .w-\\[4\\%\\] { width: 4%; }
        .w-\\[12\\%\\] { width: 12%; }
        .w-\\[13\\%\\] { width: 13%; }
        .align-middle { vertical-align: middle; }
        .align-top { vertical-align: top; }
        .h-20 { height: 3.5rem; }
        .h-6 { height: 1.2rem; }
        .mt-16 { margin-top: 2.5rem; }
        .mt-8 { margin-top: 1.5rem; }
        .mt-5 { margin-top: 1rem; }
        .mt-1 { margin-top: 0.2rem; }
        .mt-6 { margin-top: 1rem; }
        .mb-2 { margin-bottom: 0.5rem; }
        .gap-4 { gap: 1rem; }
        .gap-2 { gap: 0.5rem; }
        .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
    `;

    const handlePrintJS = () => {
        window.print();
    };

    const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);

    const beneficiaryAccounts = useMemo(() => {
        if (!printData?.beneficiary) return [];
        return db.T_COMPTE_BANCAIRE.filter(acc => acc.ID_BENEFICIAIRE === printData.beneficiary.ID_BENEFICIAIRE);
    }, [db, printData?.beneficiary]);

    const activeAccount = useMemo(() => {
        if (!beneficiaryAccounts.length) return null;
        if (selectedAccountId) {
            const found = beneficiaryAccounts.find(acc => acc.ID_COMPTE === selectedAccountId);
            if (found) return found;
        }
        const savedAccount = printData?.account;
        if (savedAccount) {
            const hasSaved = beneficiaryAccounts.some(acc => acc.ID_COMPTE === savedAccount.ID_COMPTE);
            if (hasSaved) return savedAccount;
        }
        return beneficiaryAccounts[0];
    }, [beneficiaryAccounts, selectedAccountId, printData?.account]);

    if (loading) return <div className="p-8 text-center">{t('loading')}</div>;
    if (!printData) return <div className="p-8 text-center text-red-500">{t('print.mandat_no_data')}</div>;

    const { paiement, operation, engagement, beneficiary, direction, scategorie, categorie, programme, sprogramme, montantBrut, totalDeductions, montantNet, actionCode, actionName } = printData;
    const account = activeAccount;

    const objetText = paiement.OBJET_PAI || '';
    const isLongObjet = objetText.length > 60;

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
                    #print-content { page-break-inside: avoid; break-inside: avoid; }
                    .print-area td, .print-area th { page-break-inside: avoid; break-inside: avoid; }
                }
            `}</style>
            <div className="no-print mb-1 flex justify-between items-center bg-gray-100 p-3 rounded shadow">
                <h2 className="text-xl font-bold">{t('print.mandat_print_title')}</h2>
                <div className="flex items-center gap-4">
                    {beneficiaryAccounts.length > 0 && (
                        <div className="flex items-center gap-2 bg-sky-50 px-3 py-1.5 rounded border border-sky-200">
                            <span className="text-sm font-semibold text-sky-800">{t('print.declaration.bank_print')}</span>
                            <select 
                                className="text-xs border rounded p-1 bg-white"
                                value={activeAccount?.ID_COMPTE || ''}
                                onChange={(e) => setSelectedAccountId(Number(e.target.value))}
                            >
                                {beneficiaryAccounts.map(acc => (
                                    <option key={acc.ID_COMPTE} value={acc.ID_COMPTE}>
                                        {acc.BANQUE} - {acc.RIB}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                    <div className="flex gap-2">
                        <button onClick={() => navigate('OPERATION_DETAILS', operation.ID_OPERATION, `PAIEMENTS:${paiement.ID_PAIEMENT}:blue`)} className="bg-gray-600 text-white px-4 py-2 rounded">{t('btn.back')}</button>
                        <button onClick={handlePrintJS} className="bg-blue-700 text-white px-6 py-2 rounded font-bold hover:bg-blue-800 transition-colors"><i className="bi bi-printer mr-2"></i> {t('btn.print')} </button>
                    </div>
                </div>
            </div>

            <div id="print-content" className="print-area bg-white mx-auto max-w-[288mm] text-black" dir="rtl">
                <div className="text-center font-bold mt-1 mb-1">
                    <p>{t('print.header.republic')}</p>
                    <p className="text-sm">RÉPUBLIQUE ALGÉRIENNE DÉMOCRATIQUE ET POPULAIRE</p>
                </div>
                <div className="text-center font-bold my-2 font-bold">
                    <p>{t('print.title.payment_mandate')}</p>
                    <p className="font-bold">{t('print.mandat.title_ref')}</p>
                    <p className="font-bold">{t('print.mandat.expense_charged')}</p>
                </div>
                <div className="flex justify-between items-stretch text-sm gap-4 mb-1">
                    <div className="w-[66%] flex flex-col justify-between">
                        <div className="flex justify-between items-start gap-2">
                            <div className="w-1/2 text-right">
                                <div className="space-y-1">
                                    <p>{direction.INT_PORTEFEUILLE}</p>
                                    <p>{direction.DIRECTION}</p>
                                    <p><span className="font-bold">{t('print.label.ordonnateur_code')}:</span> {direction.ORDONATEUR}</p>
                                    <p><span className="font-bold">{t('print.label.mandate_year')}:</span> {paiement.ANNEE}</p>
                                    <p><span className="font-bold">{t('col.mandat_no')}: </span>{paiement.N_MANDAT}</p>
                                    <p><span className="font-bold">{t('col.mandat_date')}: </span></p>
                                    <p><span className="font-bold">{t('print.mandat.payment_method')}</span> {t('print.mandat.bank_transfer')} </p>
                                </div>
                            </div>
                            <div className="w-1/2 text-center pt-2">
                                <div className="p-2 border border-black inline-block">
                                    <p><span className="font-bold">{t('print.mandat.accountant_signing')}</span> {t('print.mandat.treasury_agent')}</p>
                                    <p><span className="font-bold">{t('print.mandat.treasury_rib')}</span> 95 5744448001 48001 008</p>
                                </div>
                            </div>
                        </div>
                        <div className={`mt-0 flex-grow ${isLongObjet ? 'text-[10px] leading-snug' : 'text-[12px]'}`}>
                            <p className="break-words"><span className="text-[12px] font-bold">{t('print.label.payment_subject')} </span><span className="text-[11px]">{objetText}</span></p>
                            <p><span className="text-[13px] font-bold text-center">{t('print.mandat.operation_label')}</span><span className="text-[13px] text-center">{operation.INT_OPERATION}</span></p>				
                            <p><span className="text-[13px] font-bold">{t('print.label.operation_num')} </span><span className="text-[12px]">{operation.N_OPERATION}
                               </span><span className="text-[12px]">{operation.N_OPERATION_ANCIEN  && (<span>&nbsp;<span className="font-bold">{t('print.label.operation_old_num')}: </span>{operation.N_OPERATION_ANCIEN}</span>)}</span></p>
                            <p className="mt-1 leading-none"><span className="font-bold">{t('print.mandat.intervention_provisions')} </span>(T4, T5 et T6)</p>
                        </div>
                    </div>
                    <div className="w-[34%]">
                        <table className="w-full border-collapse border border-black text-sm">
                            <thead>
                                <tr className="font-bold text-center">
                                    <td className="border border-black w-[30%]">{t('print.label.classification_activity')}</td>
                                    <td className="border border-black">{t('col.code')}</td>
                                    <td className="border border-black">{t('print.label.designation')}</td>
                                </tr>
                            </thead>
                            <tbody className="text-right">
                                <tr>
                                    <td className="border border-black p-1 font-bold">{t('print.mandat.portfolio_cell')}</td>
                                    <td className="border border-black text-center">{direction.PORTEFEUILLE}</td>
                                    <td className="border border-black">{direction.INT_PORTEFEUILLE}</td>
                                </tr>
                                <tr>
                                    <td className="border border-black p-1 font-bold">{t('print.label.program')}</td>
                                    <td className="border border-black text-center">{programme?.PROGRAMME}</td>
                                    <td className="border border-black">{programme?.INT_PROGRAMME}</td>
                                </tr>
                                <tr>
                                    <td className="border border-black p-1 font-bold">{t('print.label.activity')}</td>
                                    <td className="border border-black text-center">{actionCode}</td>
                                    <td className="border border-black">{actionName}</td>
                                </tr>
                                <tr>
                                    <td className="border border-black p-1 font-bold">{t('print.mandat.subactivity_cell')}</td>
                                    <td className="border border-black text-center">{direction.SACTION}</td>
                                    <td className="border border-black">{direction.INT_SACTION || ''}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <table className="w-full border-collapse border border-black text-sm mb-2 mt-0">
                    <thead>
                        <tr className="font-bold text-center">
                            <th rowSpan={2} className="w-[5%] border border-black p-1 align-middle">{t('col.eng_no')}</th>
                            <th rowSpan={2} className="w-[3%] border border-black p-1 align-middle">{t('col.sub_program')}</th>
                            <th rowSpan={2} className="w-[25%] border border-black p-1 align-middle">{t('col.budget_imputation')}</th>
                            <th rowSpan={2} className="w-[10%] border border-black p-1 align-middle">{t('col.gross_amount')}</th>
                            <th colSpan={2} className="border border-black p-1 vertical-align-middle">{t('col.deductions')}</th>
                            <th colSpan={3} className="border border-black p-1 vertical-align-middle">{t('col.beneficiary_assignment')}</th>
                            <th rowSpan={2} className="w-[10%] border border-black p-1 align-middle">{t('col.net_payment')}</th>
                            <th rowSpan={2} className="w-[3%] border border-black p-1 align-middle">{t('col.observation')}</th>
                        </tr>
                        <tr className="font-bold text-center">
                            <th className="border border-black p-1 w-[5%] vertical-align-middle">{t('col.account')}</th>
                            <th className="border border-black p-1 w-[5%] vertical-align-middle">{t('col.amount')}</th>
                            <th className="border border-black p-1 w-[12%] vertical-align-middle">{t('col.beneficiary')}</th>
                            <th className="border border-black p-1 w-[13%] vertical-align-middle">{t('col.beneficiary_account')}</th>
                            <th className="border border-black p-1 w-[20%] vertical-align-middle">{t('col.doc_reference')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td className="border border-black align-top p-1 text-center">{engagement.N_ENG}/{engagement.ANNEE}</td>
                            <td className="border border-black align-top p-1 text-center">{sprogramme?.SPROGRAMME}</td>
                            <td className="border border-black align-top p-1 text-center text-[12px]">
                                <p>{t('col.categorie')}: {categorie?.C_CATEGORIE} {categorie?.INT_CATEGORIE}</p>
                                <p>{t('col.sub_categorie')}: {scategorie?.C_SCATEGORIE} {scategorie?.INT_SCATEGORIE}</p>
                            </td>
                            <td className="border border-black align-top p-1 text-center text-[12px]">{formatCurrency(montantBrut)}</td>
                            <td className="border border-black align-top p-1 text-center"></td>
                            <td className="border border-black align-top p-1 text-center">{formatCurrency(totalDeductions > 0 ? totalDeductions : null)}</td>
                            <td className="border border-black align-top text-[12px] text-center">{beneficiary.BENEFICIAIRE}</td>
                            <td className="border border-black align-top text-[12px] text-center">{account?.RIB}<br />{account?.BANQUE}</td>
                            <td className={`border border-black align-top text-center ${isLongObjet ? 'text-[11px] break-words leading-snug' : 'text-[12px]'}`}>{objetText}</td>
                            <td className="border border-black align-top p-1 text-center font-bold text-[12px]">{formatCurrency(montantNet)}</td>
                            <td className="border border-black align-top p-1"></td>
                        </tr>
                    </tbody>
                </table>
                <div className="flex justify-between items-start text-sm">
                    <div className="w-2/4 p-1 space-y-1 text-right">
                        <p>{t('print.label.stopped_at_amount')} <span className="font-bold">{numberToArabicWords(paiement.MONTANT_PAI)}</span></p>
                        <div className="text-center mt-16">
                            <p className="mt-6">{t('print.label.settlement_date')} ..................................</p>
                            <p className="mt-2 font-bold">{t('print.mandat.ordonnateur_title')}</p>
                        </div>
                    </div>
                    <div className="w-1/4 p-1">
                        <table className="border: 0 w-full text-sm">
                            <thead className="font-bold ">
                                <tr><td colSpan={2} className="border border-black p-1 text-center">{t('print.label.accountant_frame')}</td></tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className="border border-black p-1 text-right w-1/2">{t('print.label.total_payment_amount')}</td>
                                    <td className="border border-black p-1 h-6 w-1/2"></td>
                                </tr>
                                <tr>
                                    <td className="border border-black p-1 text-right w-1/2">{t('print.label.rejection')}</td>
                                    <td className="border border-black p-1 h-6 w-1/2"></td>
                                </tr>
                                <tr>
                                    <td className="border border-black p-1 text-right w-1/2">{t('print.label.payable_expense')}</td>
                                    <td className="border border-black p-1 h-6 w-1/2"></td>
                                </tr>
                                <tr>
                                    <td className="border border-black p-1 text-right w-1/2">{t('print.label.accountant_deduction')}</td>
                                    <td className="border border-black p-1 h-6 w-1/2"></td>
                                </tr>
                                <tr>
                                    <td className="border border-black p-1 text-right w-1/2">{t('print.label.total_net_payment')}</td>
                                    <td className="border border-black p-1 h-6 w-1/2"></td>
                                </tr>
								<tr>
                                    <td className="border-r-0 border-l-0 border-b-0 text-right w-1/2">{t('print.label.accountant_signature')}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};
export default PrintMandatPage;
