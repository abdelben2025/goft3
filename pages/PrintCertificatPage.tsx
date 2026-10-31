
import React, { useMemo } from 'react';
import { Page } from '../types';
import { useData } from '../context/DataContext';
import { normalizeDate } from '../utils/dateUtils';
import { useLanguage } from '../context/LanguageContext';
import { formatCurrency, numberToArabicWords } from '../utils/currencyUtils';

interface PrintCertificatPageProps {
    navigate: (page: Page, id?: number, tab?: string) => void;
    paiementId: number;
}

const PrintCertificatPage: React.FC<PrintCertificatPageProps> = ({ navigate, paiementId }) => {
    const { db, loading } = useData();
    const { t } = useLanguage();

    const printData = useMemo(() => {
        if (loading || !paiementId) return null;

        const paiement = db.T_PAIEMENT.find(p => p.ID_PAIEMENT === paiementId);
        if (!paiement) return null;

        const engagement = db.T_ENGAGEMENT.find(e => e.ID_ENGAGEMENT === paiement.ID_ENG);
        if (!engagement) return null;

        const operation = db.T_OPERATION.find(op => op.ID_OPERATION === paiement.ID_OPERATION);
        if (!operation) return null;
        
        const contractPiece = db.T_PIECE.find(p => p.ID_PIECE === engagement.ID_PIECE);
        if (!contractPiece) return null;
        
        const beneficiary = contractPiece.ID_BENEFICIAIRE ? db.T_BENEFICIAIRE.find(b => b.ID_BENEFICIAIRE === contractPiece.ID_BENEFICIAIRE) : null;
        if (!beneficiary) return null;
        
        const opCodeParts = operation.N_OPERATION.split('.');
        const actionCode = opCodeParts.length > 5 ? opCodeParts[5] : '';
        const actionEntry = db.T_DIRECTION.find(d => d.ACTION === actionCode);
        
        
        const direction = actionEntry || db.T_DIRECTION[0];
        if (!direction) return null;
                
        const programmeCode = opCodeParts.length > 3 ? opCodeParts[3] : '';
        const sprogrammeCode = opCodeParts.length > 4 ? opCodeParts[4] : '';

        const programme = db.T_PROGRAMME.find(p => p.PROGRAMME === programmeCode);
        
        const sprogramme = programme ? db.T_SPROGRAMME.find(sp => sp.ID_PROGRAMME === programme.ID_PROGRAMME && sp.SPROGRAMME === sprogrammeCode) : null;

        const amendments = db.T_PIECE.filter(p => p.ID_PIECE_INIT === contractPiece.ID_PIECE && p.NAT_PIECE === 'ملحق');
        const contractAmount = contractPiece.MONTANT_PIECE + amendments.reduce((sum, p) => sum + p.MONTANT_PIECE, 0);

        const allPaymentsForEngagement = db.T_PAIEMENT.filter(p => p.ID_ENG === engagement.ID_ENGAGEMENT);
        
        const previousPayments = allPaymentsForEngagement
            .filter(p => (new Date(normalizeDate(p.DATE_PAI).split('/').reverse().join('-')) < new Date(normalizeDate(paiement.DATE_PAI).split('/').reverse().join('-'))));

        const previousPaymentsTotal = previousPayments.reduce((sum, p) => sum + p.MONTANT_PAI, 0);

        const totalPaymentsIncludingCurrent = previousPaymentsTotal + paiement.MONTANT_PAI;

        const totalAvances = (paiement.AVANCE_FORFAITAIRE ?? 0) + (paiement.AVANCE_APPROVISIONNEMENT ?? 0);
        const totalDeductions = (paiement.RETENUE_GARANTIE ?? 0) + (paiement.AUTRE_DEDUCTION ?? 0);
        const totalRepayments = (paiement.REMBOURSEMENT_AVANCE_FORFAITAIRE ?? 0) + (paiement.REMBOURSEMENT_AVANCE_APPROVISIONNEMENT ?? 0);
        const montantRestant = ((paiement.MONTANT_TRAVAUX_REALISES ?? 0) + totalAvances) - (totalDeductions + totalRepayments);
        
        const lotPieces = db.T_LOT_PIECE.filter(lp => lp.ID_PIECE === contractPiece.ID_PIECE);
        const lots = lotPieces.map(lp => db.T_LOT_OPERATION.find(l => l.ID_LOT === lp.ID_LOT)).filter((lot): lot is NonNullable<typeof lot> => !!lot);

        return {
            paiement,
            engagement,
            operation,
            contractPiece,
            beneficiary,
            direction,
            programme,
            sprogramme,
            contractAmount,
            previousPayments,
            previousPaymentsTotal,
            totalPaymentsIncludingCurrent,
            montantRestant,
            lots,
        };

    }, [db, loading, paiementId]);

    const printStyles = `
        body { font-family: 'Amiri', serif; direction: rtl; }
        .print-area { direction: rtl; font-family: 'Amiri', serif; color: black; padding: 20px; background: white; }
        .flex { display: flex; }
        .justify-between { justify-content: space-between; }
        .justify-start { justify-content: flex-start; }
        .justify-end { justify-content: flex-end; }
        .items-start { align-items: flex-start; }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-left { text-align: left; }
        .font-bold { font-weight: bold; }
        .underline { text-decoration: underline; }
        .mb-4 { margin-bottom: 1rem; }
        .my-6 { margin-top: 0.5rem; margin-bottom: 0.5rem; }
        .w-full { width: 100%; }
        .grid { display: grid; }
        .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .gap-x-8 { column-gap: 2rem; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 10px; }
        th, td { border: 1px solid black; padding: 4px; text-align: center; }
        .dotted-line { border-bottom: 1px dotted black; }
        .flex-grow { flex-grow: 1; }
        .mx-2 { margin-left: 0.5rem; margin-right: 0.5rem; }
        .mt-1 { margin-top: 0.25rem; }
        .mt-2 { margin-top: 0.5rem; }
        .text-sm { font-size: 0.675rem; }
        .text-base { font-size: 1rem; }
        .text-lg { font-size: 1.125rem; }
        .text-2xl { font-size: 1.5rem; }
    `;

    const handlePrintJS = () => {
        window.print();
    };

    if (loading) return <div className="p-8 text-center">{t('loading')}</div>;
    if (!printData) return <div className="p-8 text-center text-red-500">{t('no_data')}</div>;

    const { paiement, operation, contractPiece, beneficiary, direction, programme, sprogramme, contractAmount, previousPayments, previousPaymentsTotal, totalPaymentsIncludingCurrent, montantRestant, lots } = printData;

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
                        top: 0;
                        width: 100%;
                    }
                    @page { margin: 0; size: A4 portrait; }
                    .no-print { display: none !important; }
                }
            `}</style>

            <div className="no-print mb-4 flex justify-between items-center bg-gray-100 p-3 rounded shadow">
                <h2 className="text-xl font-bold">{t('print.title.payment_certificate')}</h2>
                 <div className="flex gap-2">
                    <button onClick={() => navigate('OPERATION_DETAILS', operation.ID_OPERATION, `PAIEMENTS:${paiement.ID_PAIEMENT}:blue`)} className="bg-gray-600 text-white px-4 py-2 rounded">{t('btn.back')}</button>
                    <button onClick={handlePrintJS} className="bg-blue-700 text-white px-6 py-2 rounded font-bold hover:bg-blue-800 transition-colors"><i className="bi bi-printer mr-2"></i> {t('btn.print')} </button>
                </div>
            </div>

            <div id="print-content" className="print-area bg-white mx-auto max-w-[210mm] text-black" dir="rtl">
                <header className="flex justify-between items-start mb-4">
                    <div className="ltr:text-left rtl:text-right">
                        <p className="font-bold">{direction.INT_PORTEFEUILLE}</p>
                        <p>{direction.DIRECTION}</p>
                    </div>
                    <div className="text-center">
                        <p className="font-bold text-lg">{t('print.header.republic')}</p>
                        <p className="font-bold">{t('print.label.mandate_year')} : {paiement.ANNEE}</p>
                    </div>
                     <div className="w-1/4"></div>
                </header>

                <h1 className="text-center font-bold text-2xl my-5">{t('print.title.payment_certificate')}</h1>
                <h1 className="text-center text-[12px] my-5 ">{t('print.label.operation_title')} : {operation.INT_OPERATION}</h1>
                <div className="space-y-2 ">
                    <div className="grid grid-cols-2 gap-x-8">
					     <p><span className="font-bold">{t('col.ordonnateur')} :</span> {direction.ORDONATEUR}</p>
						 <p><span className="font-bold">{t('print.label.activity_portfolio')} :</span> {direction.PORTEFEUILLE}</p>
						 <p><span className="font-bold">{t('print.label.program')} :</span> {programme?.PROGRAMME || ''}</p>
						 <p><span className="font-bold">{t('col.sub_program')} :</span> {sprogramme?.SPROGRAMME || ''}</p>
						 
                        <p><span className="font-bold text-[14px]">{t('col.beneficiary')} :</span><span className="font-bold text-[12px]">{beneficiary.BENEFICIAIRE}</span></p>
                        <p><span className="font-bold text-[14px]">{t('print.label.contractor_address')} :</span><span className="font-bold text-[13px]">{beneficiary.ADRESSE}</span></p>
                        <p><span className="font-bold"></span> {contractPiece.PIECE}</p>
                        <p><span className="font-bold">{t('print.label.contract_amount')} =</span> {formatCurrency(contractAmount)}</p>
                        
                    </div>
                    <p><span className="font-bold">{t('print.label.payment_subject')} :</span> {paiement.OBJET_PAI}</p>
                    {lots && lots.length > 0 && lots.map((l) => (
                        <p key={l.ID_LOT}>
                            {/^\d+$/.test(l.N_LOT.trim()) ? (
                                <><span className="text-[12px]">{t('print.label.lot_num')} {l.N_LOT}</span><span className="text-[12px]">{l.INTITULE_LOT}</span></>
                            ) : (
                                <span className="text-[12px]">{l.INTITULE_LOT}</span>
                            )}
                        </p>
                    ))}
                    <p><span className="font-bold mb-4">{t('print.label.total_payment')} =</span> {formatCurrency(paiement.MONTANT_PAI)}</p>
                    
                </div>
                                                
                <div className="flex justify-between items-start mt-0">
                    <div className="w-[45%]">
                        <table className="w-full border-collapse text-sm mt-5">
                            <thead>
							      <tr><td colSpan={3} className="border border-black p-1 font-bold text-center mt-4">{t('print.certificat.by_funds')}</td></tr>
							     <tr>
								    <th className="border border-black p-1 text-center font-bold">{t('col.year')}</th>
                                    <th className="border border-black p-1 text-center font-bold">{t('col.fund_type')}</th>
                                    <th className="border border-black p-1 text-center font-bold">{t('col.cert_amount')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {previousPayments.map(p => (
                                    <tr key={p.ID_PAIEMENT}>
                                        <td className="w-10%]  text-center">{p.ANNEE}</td>
                                        <td className="w-[20%]  text-center">{t('print.label.treasury')}</td>
                                        <td className="w-[15%]  text-center">{formatCurrency(p.MONTANT_PAI)}</td>
                                    </tr>
                                ))}
                                {Array.from({ length: Math.max(0, 5 - previousPayments.length) }).map((_, i) => (
                                    <tr key={`dummy-${i}`}><td className="p-1 border-0 border-r border-l border-black">&nbsp;</td><td className="p-1 border-0 border-r border-l border-black"></td><td className="p-1 border-0 border-r border-l border-black"></td></tr>
                                ))}
                            </tbody>
                            <tfoot className="font-bold">
                                <tr>
                                    <td colSpan={2} className="border border-black p-1 ltr:text-left rtl:text-right">{t('lbl.total')} ..........................</td>
                                    <td className="border border-black p-1 text-center">{formatCurrency(previousPaymentsTotal)}</td>
								</tr>
                                 <tr>								
									<td colSpan={2} className="border border-black p-1 ltr:text-left rtl:text-right">{t('print.certificat.current_cert_amount')}</td>
                                    <td className="border border-black p-1 text-center">{formatCurrency(paiement.MONTANT_PAI)}</td>
                                </tr>
								<tr>
                                        <td colSpan={2} className="border border-black p-1 ltr:text-left rtl:text-right">{t('print.certificat.contractor_previously_got')}</td>
                                        <td className="p-1 border border-black text-center">{formatCurrency(previousPaymentsTotal)}</td>
                               </tr>
                               <tr>
                                        <td colSpan={2} className="border border-black p-1 ltr:text-left rtl:text-right w-full">{t('print.certificat.expenses_due')}</td>
                                        <td className="p-1 border border-black text-center">{formatCurrency(totalPaymentsIncludingCurrent)}</td>
                              </tr>
							
                          </tfoot>
                        </table>
                    </div>
                    <div className="w-[50%] space-y-1 ltr:text-left rtl:text-right text-sm mt-5">
                        <div className="flex justify-between"><p>{t('print.label.works_done')} .</p> <span className="dotted-line flex-grow mx-2"></span> <p>{formatCurrency(paiement.MONTANT_TRAVAUX_REALISES)}</p></div>
                        <p>{t('print.label.works_undone')} .<span className="dotted-line flex-grow mx-2"></span></p>
                        <div className="flex justify-between"><p>{t('print.label.advance_flat')} .</p> <span className="dotted-line flex-grow mx-2"></span> <p>{formatCurrency(paiement.AVANCE_FORFAITAIRE)}</p></div>
                        <div className="flex justify-between"><p>{t('print.label.advance_supply')} .</p> <span className="dotted-line flex-grow mx-2"></span> <p>{formatCurrency(paiement.AVANCE_APPROVISIONNEMENT)}</p></div>
                        <p className="font-bold mt-2">{t('col.deductions')}</p>
                        <div className="flex justify-between pr-4"><p>{t('print.label.deduction_guarantee')} .</p> <span className="dotted-line flex-grow mx-2"></span> <p>{formatCurrency(paiement.RETENUE_GARANTIE)}</p></div>
                        <div className="flex justify-between pr-4"><p>{t('print.label.deduction_excess')} .</p> <span className="dotted-line flex-grow mx-2"></span> <p>{formatCurrency(paiement.AUTRE_DEDUCTION)}</p></div>
                        <div className="flex justify-between pr-4"><p>{t('print.label.penalty_delay')}.</p> <span className="dotted-line flex-grow mx-2"></span> <p>{formatCurrency(paiement.PENALITE_RETARD)}</p></div>
                         <p className="font-bold mt-2">{t('print.certificat.repay_advances')}</p>
                        <div className="flex justify-between pr-4"><p>{t('print.label.repay_flat')} .</p> <span className="dotted-line flex-grow mx-2"></span> <p>{formatCurrency(paiement.REMBOURSEMENT_AVANCE_FORFAITAIRE)}</p></div>
                        <div className="flex justify-between pr-4"><p>{t('print.label.repay_supply')} .</p> <span className="dotted-line flex-grow mx-2"></span> <p>{formatCurrency(paiement.REMBOURSEMENT_AVANCE_APPROVISIONNEMENT)}</p></div>
                        <div className="flex justify-between pt-2"><p>{t('print.label.remaining_from')} .</p> <span className="dotted-line flex-grow mx-2"></span> <p>{formatCurrency(montantRestant)}</p></div>
                        <div className="flex justify-between"><p>{t('print.label.total_previous_payments')} .</p> <span className="dotted-line flex-grow mx-2"></span> <p>{formatCurrency(previousPaymentsTotal)}</p></div>
                        <div className="flex justify-between"><p>{t('print.label.remaining_to_pay')} .</p> <span className="dotted-line flex-grow mx-2"></span> <p>{formatCurrency(paiement.MONTANT_PAI)}</p></div>
                    </div>
                </div>
                
                <div className="mt-1 p-1 ltr:text-left rtl:text-right">
                    <p>{t('print.label.certificate_stopped_at')}</p>
                    <p className="font-bold">{numberToArabicWords(paiement.MONTANT_PAI)}</p>
                </div>

                <footer className="mt-1 flex justify-end">
                     <div className=" mx-4 text-center">
                        <p>{t('print.relizane_in')}</p>
                        <p className="font-bold mt-1 font-size: 12pt">{t('print.footer.director')}</p>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default PrintCertificatPage;
