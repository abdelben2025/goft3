
import React, { useMemo } from 'react';
import { Page } from '../types';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { pickLocalLabel } from '../utils/dataLabels';

interface PrintPaiementPageProps {
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

const PrintPaiementPage: React.FC<PrintPaiementPageProps> = ({ navigate, paiementId }) => {
    const { db, loading } = useData();
    const { t, language } = useLanguage();

    const printData = useMemo(() => {
        if (loading || !paiementId) return null;

        const paiement = db.T_PAIEMENT.find(p => p.ID_PAIEMENT === paiementId);
        if (!paiement) return null;

        const operation = db.T_OPERATION.find(op => op.ID_OPERATION === paiement.ID_OPERATION);
        if (!operation) return null;
        
        const engagement = db.T_ENGAGEMENT.find(e => e.ID_ENGAGEMENT === paiement.ID_ENG);
        if (!engagement) return null;
        
        let pieceForEngagement = db.T_PIECE.find(p => p.ID_PIECE === engagement.ID_PIECE);
        if (!pieceForEngagement) return null;

        let rootContractPiece = pieceForEngagement;
        while (rootContractPiece.ID_PIECE_INIT) {
            const parent = db.T_PIECE.find(p => p.ID_PIECE === rootContractPiece.ID_PIECE_INIT);
            if (!parent) break;
            rootContractPiece = parent;
        }

        const contractInitialEngagement = db.T_ENGAGEMENT.find(e => e.ID_PIECE === rootContractPiece.ID_PIECE);
        if (!contractInitialEngagement) return null;


        const piece = db.T_PIECE.find(p => p.ID_PIECE === paiement.ID_PIECE);
        if (!piece) return null;
        
        const beneficiary = db.T_BENEFICIAIRE.find(b => b.ID_BENEFICIAIRE === piece.ID_BENEFICIAIRE);
        if (!beneficiary) return null;
        
        const direction = db.T_DIRECTION[0];
        if (!direction) return null;

        const scategorie = db.T_SCATEGORIE.find(sc => sc.ID_SCATEGORIE === piece.ID_SCATEGORIE);
        const categorie = scategorie ? db.T_CATEGORIE.find(c => c.ID_CATEGORIE === scategorie.ID_CATEGORIE) : null;
        
        const parentPieceId = piece.ID_PIECE_INIT || piece.ID_PIECE;
        const lotPieces = db.T_LOT_PIECE.filter(lp => lp.ID_PIECE === parentPieceId);
        const lots = lotPieces.map(lp => db.T_LOT_OPERATION.find(l => l.ID_LOT === lp.ID_LOT)).filter((l): l is NonNullable<typeof l> => !!l);

        const allOperationPayments = db.T_PAIEMENT
            .filter(p => p.ID_OPERATION === paiement.ID_OPERATION)
            .sort((a, b) => {
                const yearA = parseInt(a.ANNEE, 10) || 0;
                const yearB = parseInt(b.ANNEE, 10) || 0;
                if (yearA !== yearB) {
                    return yearA - yearB;
                }
                const numA = parseInt(a.N_PAI, 10) || 0;
                const numB = parseInt(b.N_PAI, 10) || 0;
                return numA - numB;
            });

        let paiementsAnterieurs = 0;
        for (const p of allOperationPayments) {
            if (p.ID_PAIEMENT === paiementId) {
                break;
            }
            paiementsAnterieurs += p.MONTANT_PAI;
        }

        const totalPaiement = paiementsAnterieurs + paiement.MONTANT_PAI;
        
        return {
            paiement,
            operation,
            contractInitialEngagement,
            beneficiary,
            direction,
            scategorie,
            categorie,
            lots,
            paiementsAnterieurs,
            totalPaiement
        };
    }, [db, loading, paiementId]);

    const printStyles = `
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

    if (loading) return <div className="p-8 text-center">{t('loading')}</div>;
    if (!printData) return <div className="p-8 text-center text-red-500">{t('no_data')}</div>;

    const { paiement, operation, contractInitialEngagement, beneficiary, direction, scategorie, categorie, lots, paiementsAnterieurs, totalPaiement } = printData;

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
                    }
                    @page { margin: 0; size: A4 portrait; }
                    .no-print { display: none !important; }
                }
            `}</style>
            
            <div className="no-print mb-4 flex justify-between items-center bg-gray-100 p-3 rounded shadow">
                <h2 className="text-xl font-bold">{t('print.payment_card_preview')}</h2>
                <div className="flex gap-2">
                    <button onClick={() => navigate('OPERATION_DETAILS', operation.ID_OPERATION, `PAIEMENTS:${paiement.ID_PAIEMENT}:blue`)} className="bg-gray-600 text-white px-4 py-2 rounded">{t('btn.back')}</button>
                    <button onClick={handlePrintJS} className="bg-blue-700 text-white px-6 py-2 rounded font-bold hover:bg-blue-800 transition-colors"><i className="bi bi-printer mr-2"></i> {t('btn.print')} </button>
                </div>
            </div>

            <div id="print-content" className="print-area bg-white mx-auto max-w-[210mm] max-h-[297mm] text-black" dir="rtl">
                <header className="flex justify-center items-start mb-2">
                     <div className="text-center">
                      <p className="font-bold text-lg">{t('print.header.republic')}</p>
                     </div>
                </header>
                <div className="flex justify-center mb-2">
                      <p className="font-bold text-lg">{t('print.title.payment_card')}</p>
                </div>
                <div className="mb-2">
                    <div className="w-full flex justify-right">
                        <div className="w-1/2">
                            <table className="w-full text-center">
                                <tbody> 
                                    <tr><td className="border-none text-center font-bold text-lg">{t('print.label.budget_ops')}</td></tr>						 
                                    <tr><td className="border border-black p-1 text-center font-bold text-lg">{t('print.label.manager_id')}</td></tr>
                                    <tr><td className="border border-black p-1 text-center text-lg">{direction.DIRECTION}</td></tr> 
                                </tbody>
                            </table>
                        </div>
                    </div> 
				</div>
                <div className="mb-2">
                    <div className="flex gap-4">
                        <div className="w-1/2">
                            <table className="w-full border-collapse border border-black text-center">
                                 <tbody>
                                    <tr><td className="border border-black p-1 text-lg font-bold text-center">{t('print.label.initial_eng_num')}</td></tr>
                                    <tr><td className="border border-black p-2 text-lg text-center">{contractInitialEngagement.N_ENG}/{contractInitialEngagement.ANNEE}</td></tr>
                                </tbody>
                            </table>
                        </div>
                        <div className="w-1/2">
                            <table className="w-full border-collapse border border-black text-center">
                                 <tbody>
                                    <tr><td className="border border-black p-1 text-lg font-bold text-center">{t('print.label.card_num')}</td></tr>
                                    <tr><td className="border border-black p-2 text-lg text-center">{paiement.N_PAI}/{paiement.ANNEE}</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
                
                <div className="flex justify-center mb-2">
                    <table className="w-3/4 border-collapse border border-black text-center">
                        <tbody>
                            <tr><td className="border border-black p-1 text-lg font-bold text-center">{t('print.operation_number_cell')}</td></tr>
                            <tr><td className="border border-black p-2 text-lg font-bold text-center">{operation.N_OPERATION}</td></tr>
                        </tbody>
                    </table>
                </div>


                <div className="text-right space-y-2 text-base mb-1">
                    <p><span className="font-bold">{t('print.label.operation_title')}</span> {operation.INT_OPERATION}</p>
                    <p><span className="font-bold">{t('print.label.payment_subject')}</span> {paiement.OBJET_PAI}</p>
                    {lots.length > 0 && lots.map(lot => (
                        <p key={lot.ID_LOT}>
                            {/^\d+$/.test(lot.N_LOT.trim()) ? (
                                <><span className="text-sm">{t('print.label.lot_num')} {lot.N_LOT}</span> {lot.INTITULE_LOT}</>
                            ) : (
                                <span className="text-sm">{lot.INTITULE_LOT}</span>
                            )}
                        </p>
                    ))}
                </div>

                <div className="flex justify-between items-center mb-2">
                     <p><span className="font-bold text-sm">{t('col.beneficiary')}:</span> {beneficiary.BENEFICIAIRE}</p>
                     <span></span>
                </div>
                
                <h2 className="font-bold text-right text-lg mb-2">{t('print.label.payment_structure')}</h2>

                <table className="w-full border-collapse border border-black text-center mb-2 text-sm">
                    <thead className="font-bold">
                        <tr>
                            <th className="border border-black text-center p-2 w-3/5">{t('col.structure')}</th>
                            <th className="border border-black text-center p-2">{t('print.amount_dzd')}</th>
                            <th className="border border-black text-center p-2 w-1/5">{t('col.observation')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td className="border border-black p-2 text-right h-24 align-top text-lg">
                                {categorie && <p>{t('col.categorie')}: {categorie.C_CATEGORIE} {pickLocalLabel(categorie, 'INT_CATEGORIE', 'INT_CATEGORIE_FR', '', language)}</p>}
                                {scategorie && <p className="pr-4">{t('col.sub_categorie')}: {scategorie.C_SCATEGORIE} {pickLocalLabel(scategorie, 'INT_SCATEGORIE', 'INT_SCATEGORIE_FR', '', language)}</p>}
                            </td>
                            <td className="border border-black p-2 align-top font-bold text-lg">{formatCurrency(paiement.MONTANT_PAI)}</td>
                            <td className="border border-black p-2"></td>
                        </tr>
                        <tr className="font-bold">
                             <td className="border border-black p-2 text-center">{t('lbl.total')}</td>
                             <td className="border border-black p-2 text-lg">{formatCurrency(paiement.MONTANT_PAI)}</td>
                             <td className="border border-black p-2"></td>
                        </tr>
                    </tbody>
                </table>
                
                <table className="w-full border-collapse border border-black text-center text-sm">
                     <thead className="font-bold">
                        <tr>
                            <th className="border border-black text-center p-2">{t('print.previous_payment_dzd')}</th>
                            <th className="border border-black text-center p-2">{t('print.proposed_payment_dzd')}</th>
                            <th className="border border-black text-center p-2">{t('print.total_payment_dzd')}</th>
                            <th className="border border-black text-center p-2 w-1/5">{t('col.observation')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                             <td className="border border-black p-2 text-center text-lg">{formatCurrency(paiementsAnterieurs)}</td>
                             <td className="border border-black p-2 font-bold text-center text-lg">{formatCurrency(paiement.MONTANT_PAI)}</td>
                             <td className="border border-black p-2 text-center text-lg">{formatCurrency(totalPaiement)}</td>
                             <td className="border border-black p-2 text-center"></td>
                        </tr>
                    </tbody>
                </table>

                <footer className="mt-2 text-base">
                     <div className="flex justify-between items-start">
                        <div className="border border-black p-3 space-y-3 text-right w-1/2">
                            <p>{t('print.label.order_num')} ............ في: ........................</p>
                            <p>{t('print.label.accepted_at')} .................................</p>
                        </div>
                         <div className="text-center w-1/3">
                            <p>{t('print.relizane_in')}</p>
                            <p className="font-bold mt-2 text-lg">{t('print.footer.director')}</p>
                        </div>
                    </div>
                </footer>

            </div>
        </div>
    );
};

export default PrintPaiementPage;
