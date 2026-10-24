
import React, { useMemo } from 'react';
import { Page, LotOperation } from '../types';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { getEffectiveDurationDays, parseDate, normalizeDate } from '../utils/dateUtils';

const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return '0,00';
    return new Intl.NumberFormat('ar-DZ', {
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
};

// Helper to safely convert any value to a float
const safeFloat = (val: any): number => {
    if (typeof val === 'number') return val;
    if (val === null || val === undefined) return 0;
    const str = String(val).replace(/,/g, '.').replace(/[^0-9.-]/g, '');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
};

// Helper to safely get ID as a number
const safeId = (val: any): number => {
    if (!val) return 0;
    const num = parseInt(String(val).trim(), 10);
    return isNaN(num) ? 0 : num;
};

const PrintProjectTrackingPage: React.FC<{ navigate: (page: Page) => void, operationId: number }> = ({ navigate, operationId }) => {
    const { db, loading } = useData();
    const { t, dir } = useLanguage();
    
    const printData = useMemo(() => {
        if (loading || !operationId) return null;
        
        const operation = db.T_OPERATION.find(op => safeId(op.ID_OPERATION) === safeId(operationId));
        if (!operation) return null;

        const projects = db.T_PIECE.filter(p => 
            safeId(p.ID_OPERATION) === safeId(operationId) && 
            ['صفقة', 'اتفاقية'].includes(p.NAT_PIECE)
        );
        
        const projectRows = projects.map(projectPiece => {
            const projectId = safeId(projectPiece.ID_PIECE);

            const lotPieces = db.T_LOT_PIECE.filter(lp => safeId(lp.ID_PIECE) === projectId);
            const lots = lotPieces
                .map(lp => ({
                    lot: db.T_LOT_OPERATION.find(lot => safeId(lot.ID_LOT) === safeId(lp.ID_LOT)),
                    duration: lp.DELAI_EX_JOURS || projectPiece.DELAI_EX_JOURS
                }))
                .filter((item): item is { lot: LotOperation, duration: string | null } => item.lot !== undefined);
            
            const lotsCommitment = lots.reduce((sum, item) => sum + safeFloat(item.lot.MONTANT_FINALE_LOT), 0);

            const amendments = db.T_PIECE.filter(p => p.NAT_PIECE === 'ملحق' && safeId(p.ID_PIECE_INIT) === projectId);
            const terminations = db.T_PIECE.filter(p => p.NAT_PIECE === 'قرار فسخ' && safeId(p.ID_PIECE_INIT) === projectId);
            
            const baseAmount = safeFloat(projectPiece.MONTANT_PIECE);
            const amendmentsSum = amendments.reduce((sum, p) => sum + safeFloat(p.MONTANT_PIECE), 0);
            const terminationsSum = terminations.reduce((sum, p) => sum + safeFloat(p.MONTANT_PIECE), 0);
            
            const finalCommittedAmount = baseAmount + amendmentsSum - terminationsSum;

            // --- Payment Calculation Logic ---
            const contractIdNum = projectId;
            const level1Ids = db.T_PIECE.filter(p => safeId(p.ID_PIECE_INIT) === contractIdNum).map(p => safeId(p.ID_PIECE));
            const level2Ids = db.T_PIECE.filter(p => {
                    const parentId = safeId(p.ID_PIECE_INIT);
                    return parentId > 0 && level1Ids.includes(parentId);
                }).map(p => safeId(p.ID_PIECE));
            const allRelatedPieceIds = new Set([contractIdNum, ...level1Ids, ...level2Ids]);
            const paymentAmount = db.T_PAIEMENT
                .filter(p => allRelatedPieceIds.has(safeId(p.ID_PIECE)))
                .reduce((sum, p) => sum + safeFloat(p.MONTANT_PAI), 0);
            // ----------------------------------------

            const remainingAmount = finalCommittedAmount - paymentAmount;
            const completionPercentage = finalCommittedAmount > 0 ? (paymentAmount / finalCommittedAmount) * 100 : 0;

            const allAssociatedOds = db.T_ODS.filter(ods => safeId(ods.ID_PIECE) === projectId);
            
            // New Data Points
            const startOds = allAssociatedOds.find(o => o.NATURE_ODS === 'انطلاق');
            const workStartDate = startOds ? normalizeDate(startOds.DATE_ODS) : '---';
            
            const handoverOds = allAssociatedOds.find(o => o.NATURE_ODS === 'ختام');
            const handoverDate = handoverOds ? normalizeDate(handoverOds.DATE_ODS) : '---';

            const engagement = db.T_ENGAGEMENT.find(e => e.ID_PIECE === projectId);
            const visaInfo = engagement && engagement.N_VISA_CB 
                ? `${engagement.N_VISA_CB} في ${normalizeDate(engagement.DATE_VISA_CB)}` 
                : '---';

            const cfVisaInfo = projectPiece.N_VISA_CM
                ? `${projectPiece.N_VISA_CM} في ${normalizeDate(projectPiece.DATE_VISA_CM)}`
                : '---';

            let deadlineText = 'N/A';
            if (terminations.length > 0) {
                deadlineText = "تم فسخ العقد";
            } else if (lots.length > 0) {
                const deadlines = lots.map(item => {
                    const lotOds = allAssociatedOds.filter(o => !o.ID_LOT || o.ID_LOT === item.lot.ID_LOT);
                    const delay = getEffectiveDurationDays(item.duration);
                    if (delay <= 0) return `حصة ${item.lot.N_LOT}: بدون مدة`;
                    
                    const sortedOds = lotOds
                        .map(ods => ({ ...ods, parsedDate: parseDate(ods.DATE_ODS) }))
                        .filter(ods => ods.parsedDate !== null)
                        .sort((a, b) => a.parsedDate!.getTime() - b.parsedDate!.getTime());

                    if (sortedOds.length === 0 || sortedOds[0].NATURE_ODS !== 'انطلاق') return `حصة ${item.lot.N_LOT}: لم تنطلق`;
                    if (sortedOds.some(o => o.NATURE_ODS === 'ختام')) return `حصة ${item.lot.N_LOT}: منتهية`;
                    
                    return `حصة ${item.lot.N_LOT}: جارية`;
                });
                deadlineText = deadlines.join(', ');
            } else {
                const delay = getEffectiveDurationDays(projectPiece.DELAI_EX_JOURS);
                if (delay > 0) {
                    const sortedOds = allAssociatedOds
                        .map(ods => ({ ...ods, parsedDate: parseDate(ods.DATE_ODS) }))
                        .filter(ods => ods.parsedDate !== null)
                        .sort((a, b) => a.parsedDate!.getTime() - b.parsedDate!.getTime());
                    
                    const hasStartOds = sortedOds.some(ods => ods.NATURE_ODS === 'انطلاق');
                    if (!hasStartOds) {
                        deadlineText = "لم تنطلق";
                    } else if (sortedOds.some(ods => ods.NATURE_ODS === 'ختام')) {
                        deadlineText = "منتهية";
                    } else {
                        deadlineText = "جارية";
                    }
                }
            }

            return {
                id: projectPiece.ID_PIECE,
                projectPiece,
                lots: lots.map(i => i.lot),
                beneficiary: db.T_BENEFICIAIRE.find(b => safeId(b.ID_BENEFICIAIRE) === safeId(projectPiece.ID_BENEFICIAIRE))?.BENEFICIAIRE || '---',
                lotsCommitment,
                finalCommittedAmount,
                paymentAmount,
                remainingAmount,
                completionPercentage,
                deadline: deadlineText,
                workStartDate,
                handoverDate,
                visaInfo,
                cfVisaInfo
            };
        });

        const direction = db.T_DIRECTION[0];
        
        return { operation, projectRows, direction };

    }, [db, loading, operationId]);
    
    if (loading) return <div className="p-8 text-center">{t('loading')}</div>;
    if (!printData) return <div className="p-8 text-center">{t('no_data')}</div>;

    const { operation, projectRows, direction } = printData;

    return (
        <div className="bg-gray-200 p-4 min-h-screen" dir={dir}>
             <style>{`
                @media print {
                    @page { size: A4 landscape; margin: 1cm; }
                    .no-print { display: none !important; }
                    body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .print-area { margin: 0 !important; padding: 0 !important; box-shadow: none !important; border: none !important; font-size: 8pt; width: 100% !important; }
                    .print-area table { width: 100% !important; border-collapse: collapse; }
                    .print-area th, .print-area td { border: 1px solid black; padding: 2px 4px; word-wrap: break-word; }
                }
                .print-area { font-family: 'Amiri', serif; }
                .print-area, .print-area p, .print-area h1, .print-area div, .print-area th, .print-area td { color: black !important; }
            `}</style>
             <div className="no-print mb-4 flex justify-between items-center bg-white p-2 rounded shadow">
                <h2 className="text-xl font-bold">{t('btn.print')}</h2>
                <div className="flex gap-2">
                    <button onClick={() => navigate('PROJECT_TRACKING')} className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600">→ {t('btn.back')}</button>
                    <button onClick={() => window.print()} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"><i className="bi bi-printer mr-2"></i> {t('btn.print')}</button>
                </div>
            </div>
            <div className="print-area bg-white p-6 mx-auto max-w-full shadow-lg border border-gray-300">
                <header className="text-center mb-4">
                    <p className="font-bold">{t('print.header.republic')}</p>
                    <p className="font-bold ltr:text-left rtl:text-right">{direction?.INT_PORTEFEUILLE}</p>
                    <p className="font-bold ltr:text-left rtl:text-right">{direction?.DIRECTION}</p>
                    <h1 className="text-lg font-bold underline mt-4">{t('print.title.project_tracking', {operation: operation.INT_OPERATION})}</h1>
                </header>
                 <table className="w-full border-collapse border border-black text-black text-center text-[10px]">
                    <thead className="bg-gray-100 font-bold">
                        <tr>
                            <th className="border border-black p-1">{t('col.project')}</th>
                            <th className="border border-black p-1">{t('col.beneficiary')}</th>
                            <th className="border border-black p-1">{t('col.work_start_date')}</th>
                            <th className="border border-black p-1">{t('col.cf_visa')}</th>
                            <th className="border border-black p-1">{t('col.budget_visa')}</th>
                            <th className="border border-black p-1">{t('col.lot_final_commitment')}</th>
                            <th className="border border-black p-1">{t('col.final_commitment')}</th>
                            <th className="border border-black p-1">{t('col.payment_amount')}</th>
                            <th className="border border-black p-1">{t('col.remaining_progress')}</th>
                            <th className="border border-black p-1">{t('col.completion_date')}</th>
                            <th className="border border-black p-1">{t('col.handover_date')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {projectRows.map(project => (
                            <tr key={project.id}>
                                <td className="border border-black p-1 ltr:text-left rtl:text-right align-top">
                                    <span>{project.projectPiece.PIECE}</span>
                                    {project.lots.length > 0 && (
                                        <div className="text-[8px] text-gray-700 font-normal pt-1 pr-1">
                                            {project.lots.map(l => (
                                                <div key={l.ID_LOT}>- {t('print.label.lot_num')} {l.N_LOT}: {l.INTITULE_LOT}</div>
                                            ))}
                                        </div>
                                    )}
                                </td>
                                <td className="border border-black p-1 align-top">{project.beneficiary}</td>
                                <td className="border border-black p-1 align-top text-center">{project.workStartDate}</td>
                                <td className="border border-black p-1 align-top text-center text-[8px]">{project.cfVisaInfo}</td>
                                <td className="border border-black p-1 align-top text-center text-[8px]">{project.visaInfo}</td>
                                <td className="border border-black p-1 align-top">{formatCurrency(project.lotsCommitment)}</td>
                                <td className="border border-black p-1 align-top font-bold">{formatCurrency(project.finalCommittedAmount)}</td>
                                <td className="border border-black p-1 align-top">{formatCurrency(project.paymentAmount)}</td>
                                <td className="border border-black p-1 align-top">
                                    <span className="block">{formatCurrency(project.remainingAmount)}</span>
                                    <span className="block font-bold">({project.completionPercentage.toFixed(2)}%)</span>
                                </td>
                                <td className="border border-black p-1 align-top text-[9px]">{project.deadline}</td>
                                <td className="border border-black p-1 align-top text-center">{project.handoverDate}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PrintProjectTrackingPage;
