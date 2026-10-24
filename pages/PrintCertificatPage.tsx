
import React, { useMemo } from 'react';
import { Page } from '../types';
import { useData } from '../context/DataContext';
import { normalizeDate } from '../utils/dateUtils';
import { useLanguage } from '../context/LanguageContext';

interface PrintCertificatPageProps {
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

const numberToArabicWords = (number: number | null | undefined): string => {
    if (number === null || number === undefined) return 'صفر دينار جزائري';

    const num = parseFloat(Number(number).toFixed(2));
    if (isNaN(num)) return 'مبلغ غير صالح';

    const integerPart = Math.floor(num);
    const decimalPart = Math.round((num - integerPart) * 100);

    const units = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
    const teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
    const tens = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
    const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

    const convertThreeDigits = (n: number): string => {
        if (n === 0) return '';
        let result = '';
        const h = Math.floor(n / 100);
        const t = Math.floor((n % 100) / 10);
        const u = n % 10;

        if (h > 0) {
            result += hundreds[h];
            if (t > 0 || u > 0) result += ' و';
        }

        if (t === 1 && u > 0) {
            result += teens[u];
        } else {
             if (u > 0) {
                result += units[u];
            }
            if (t > 0) {
                if (u > 0) result += ' و';
                result += tens[t];
            }
        }
        return result;
    };
    
    const convert = (n: number): string => {
        if (n === 0) return 'صفر';
        if (n < 0) return 'سالب ' + convert(Math.abs(n));

        let result = '';
        const billion = Math.floor(n / 1000000000);
        const million = Math.floor((n % 1000000000) / 1000000);
        const thousand = Math.floor((n % 1000000) / 1000);
        const rest = n % 1000;
        
        if (billion > 0) {
            if (billion === 1) result += 'مليار';
            else if (billion === 2) result += 'ملياران';
            else if (billion >= 3 && billion <= 10) result += convertThreeDigits(billion) + ' مليارات';
            else result += convertThreeDigits(billion) + ' مليار';
            if (million > 0 || thousand > 0 || rest > 0) result += ' و';
        }

        if (million > 0) {
            if (million === 1) result += 'مليون';
            else if (million === 2) result += 'مليونان';
            else if (million >= 3 && million <= 10) result += convertThreeDigits(million) + ' ملايين';
            else result += convertThreeDigits(million) + ' مليون';
            if (thousand > 0 || rest > 0) result += ' و';
        }
        
        if (thousand > 0) {
            if (thousand === 1) result += 'ألف';
            else if (thousand === 2) result += 'ألفان';
            else if (thousand >= 3 && thousand <= 10) result += convertThreeDigits(thousand) + ' آلاف';
            else result += convertThreeDigits(thousand) + ' ألف';
            if (rest > 0) result += ' و';
        }
        
        if (rest > 0) {
            result += convertThreeDigits(rest);
        }
        
        return result.trim();
    };

    let integerText = convert(integerPart);
    if (integerPart === 1) integerText = 'دينار جزائري واحد';
    else if (integerPart === 2) integerText = 'ديناران جزائريان';
    else integerText = `${integerText} دينار جزائري`;
            
    if (decimalPart > 0) {
        return `${integerText} و ${decimalPart} سنتيم`;
    }
    
    return integerText;
};


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
        @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap');
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
                    <button onClick={() => navigate('OPERATION_DETAILS', operation.ID_OPERATION, `PAIEMENTS:${paiement.ID_PAIEMENT}:blue`)} className="bg-gray-600 text-white px-4 py-2 rounded">رجوع</button>
                    <button onClick={handlePrintJS} className="bg-blue-700 text-white px-6 py-2 rounded font-bold hover:bg-blue-800 transition-colors"><i className="bi bi-printer mr-2"></i> طباعة </button>
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
                <h1 className="text-center text-base my-5 ">{t('print.label.operation_title')} : {operation.INT_OPERATION}</h1>
                <div className="space-y-2 text-base">
                    <div className="grid grid-cols-2 gap-x-8">
					     <p><span className="font-bold">{t('col.ordonnateur')} :</span> {direction.ORDONATEUR}</p>
						 <p><span className="font-bold">{t('print.label.activity_portfolio')} :</span> {direction.PORTEFEUILLE}</p>
						 <p><span className="font-bold">{t('print.label.program')} :</span> {programme?.PROGRAMME || ''}</p>
						 <p><span className="font-bold">{t('col.sub_program')} :</span> {sprogramme?.SPROGRAMME || ''}</p>
						 
                        <p><span className="font-bold text-sm">{t('col.beneficiary')} :</span> {beneficiary.BENEFICIAIRE}</p>
                        <p><span className="font-bold text-sm">{t('print.label.contractor_address')} :</span> {beneficiary.ADRESSE}</p>
                        <p><span className="font-bold"></span> {contractPiece.PIECE}</p>
                        <p><span className="font-bold">{t('print.label.contract_amount')} =</span> {formatCurrency(contractAmount)}</p>
                        
                    </div>
                    <p><span className="font-bold">{t('print.label.payment_subject')} :</span> {paiement.OBJET_PAI}</p>
                    {lots && lots.length > 0 && lots.map((l) => (
                        <p key={l.ID_LOT}>
                            {/^\d+$/.test(l.N_LOT.trim()) ? (
                                <><span className="text-sm">الحصة رقم: {l.N_LOT}</span> {l.INTITULE_LOT}</>
                            ) : (
                                <span className="text-sm">{l.INTITULE_LOT}</span>
                            )}
                        </p>
                    ))}
                    <p><span className="font-bold mb-4">{t('print.label.total_payment')} =</span> {formatCurrency(paiement.MONTANT_PAI)}</p>
                    
                </div>
                                                
                <div className="flex justify-between items-start mt-0">
                    <div className="w-[45%]">
                        <table className="w-full border-collapse border  border-black text-sm mt-5">
                            <thead>
							      <tr><td colSpan={3} className="border border-black p-1 font-bold text-center mt-4">شهادة صادرة عن الصناديق بجميع أنواعها للسنوات السابقة والحالية</td></tr>
							     <tr>
								    <th className="border border-black p-1 text-center font-bold">{t('col.year')}</th>
                                    <th className="border border-black p-1 text-center font-bold">{t('col.fund_type')}</th>
                                    <th className="border border-black p-1 text-center font-bold">{t('col.cert_amount')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {previousPayments.map(p => (
                                    <tr key={p.ID_PAIEMENT}>
                                        <td className="border  w-[10%]  text-center">{p.ANNEE}</td>
                                        <td className="border  w-[20%]  text-center">{t('print.label.treasury')}</td>
                                        <td className="border  w-[15%]  text-center">{formatCurrency(p.MONTANT_PAI)}</td>
                                    </tr>
                                ))}
                                {Array.from({ length: Math.max(0, 5 - previousPayments.length) }).map((_, i) => (
                                    <tr key={`dummy-${i}`}><td className="p-1 border-r border-l border-black">&nbsp;</td><td className="p-1 border-r border-l border-black"></td><td className="p-1 border-r border-l border-black"></td></tr>
                                ))}
                            </tbody>
                            <tfoot className="font-bold">
                                <tr>
                                    <td colSpan={2} className="border border-black p-1 ltr:text-left rtl:text-right">{t('lbl.total')} ..........................</td>
                                    <td className="border border-black p-1 text-center">{formatCurrency(previousPaymentsTotal)}</td>
								</tr>
                                 <tr>								
									<td colSpan={2} className="border border-black p-1 ltr:text-left rtl:text-right">مبلغ الشهادة الحالية</td>
                                    <td className="border border-black p-1 text-center">{formatCurrency(paiement.MONTANT_PAI)}</td>
                                </tr>
								<tr>
                                        <td colSpan={2} className="border border-black p-1 ltr:text-left rtl:text-right">المقاول تحصل سابقا على</td>
                                        <td className="p-1 border border-black text-center">{formatCurrency(previousPaymentsTotal)}</td>
                               </tr>
                               <tr>
                                        <td colSpan={2} className="border border-black p-1 ltr:text-left rtl:text-right w-full">مصاريف مستحقة الدفع تصل الى</td>
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
                         <p className="font-bold mt-2">تسديد التسبيقات</p>
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
                        <p>غليزان في: ..................</p>
                        <p className="font-bold mt-1 font-size: 12pt">{t('print.footer.director')}</p>
                    </div>
                </footer>
            </div>
        </div>
    );
};

export default PrintCertificatPage;
