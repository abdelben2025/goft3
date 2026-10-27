
import React, { useMemo } from 'react';
import { Page } from '../types';
import { useData } from '../context/DataContext';
import { normalizeDate } from '../utils/dateUtils';

interface PrintEngagementPageProps {
    navigate: (page: Page, id?: number, tab?: string) => void;
    engagementId: number;
}

const formatCurrency = (amount: number | null | undefined | string) => {
    if (amount === null || amount === undefined) return '0,00';
    if (typeof amount === 'string') return amount;
    return new Intl.NumberFormat('ar-DZ', {
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
};

const PrintEngagementPage: React.FC<PrintEngagementPageProps> = ({ navigate, engagementId }) => {
    const { db, loading } = useData();

    const printData = useMemo(() => {
        if (loading || !engagementId) return null;

        const engagement = db.T_ENGAGEMENT.find(e => e.ID_ENGAGEMENT === engagementId);
        if (!engagement) return null;

        const operation = db.T_OPERATION.find(op => op.ID_OPERATION === engagement.ID_OPERATION);
        if (!operation) return null;

        const piece = db.T_PIECE.find(p => p.ID_PIECE === engagement.ID_PIECE);
        if (!piece) return null;

        const opCodeParts = operation.N_OPERATION.split('.');
        const actionCode = opCodeParts.length > 5 ? opCodeParts[5] : '';
        const actionEntry = db.T_DIRECTION.find(d => d.ACTION === actionCode);
        
        
        const direction = actionEntry || db.T_DIRECTION[0];
        if (!direction) return null;       
                
        const categorie = db.T_CATEGORIE.find(c => c.ID_CATEGORIE === operation.ID_CATEGORIE);
        const scategorie = db.T_SCATEGORIE.find(sc => sc.ID_SCATEGORIE === piece.ID_SCATEGORIE);

        const scategorieOp = db.T_SCATEGORIE_OP.find(sco => 
            sco.ID_OPERATION === operation.ID_OPERATION && 
            sco.ID_SCATEGORIE === piece.ID_SCATEGORIE
        );
        
        let pieceIdForLots = piece.ID_PIECE;
        if (piece.NAT_PIECE === 'ملحق' && piece.ID_PIECE_INIT) {
            const addendumLots = db.T_LOT_PIECE.filter(lp => lp.ID_PIECE === piece.ID_PIECE);
            if (addendumLots.length === 0) {
                pieceIdForLots = piece.ID_PIECE_INIT;
            }
        }
        
        const lotPieces = db.T_LOT_PIECE.filter(lp => lp.ID_PIECE === pieceIdForLots);
        const lots = lotPieces.map(lp => db.T_LOT_OPERATION.find(l => l.ID_LOT === lp.ID_LOT)).filter((lot): lot is NonNullable<typeof lot> => !!lot);

        // تفصيل الهيكلة المرتبطة بهذه الوثيقة فقط (عبر ID_RUBRIQUE للوثيقة)
        const rubriquesForInvoice: { name: string; montant: number }[] = [];
        if (piece.ID_RUBRIQUE) {
            const rub = db.T_RUBRIQUE.find(r => r.ID_RUBRIQUE === piece.ID_RUBRIQUE);
            const ro = db.T_RUBRIQUE_OP.find(r => r.ID_OPERATION === operation.ID_OPERATION && r.ID_RUBRIQUE === piece.ID_RUBRIQUE);
            const montant = ro ? (ro.MONTANT_FINALE ?? ro.MONTANT_INITIALE) : undefined;
            if (rub) {
                rubriquesForInvoice.push({ name: rub.RUBRIQUE, montant: montant ?? 0 });
            }
        }
        // استثناء تفصيل "الإشهار" من الاستبدال (إن لم تكن له حصة مرتبطة)
        const hasInvoiceLot = lotPieces.length > 0;
        const filteredRubriquesForInvoice = rubriquesForInvoice.filter(r => !(r.name === 'الإشهار' && !hasInvoiceLot));

        const beneficiary = piece.ID_BENEFICIAIRE ? db.T_BENEFICIAIRE.find(b => b.ID_BENEFICIAIRE === piece.ID_BENEFICIAIRE) : null;

        const budgetAmount = db.T_SCATEGORIE_OP
            .filter(sco => sco.ID_OPERATION === operation.ID_OPERATION)
            .reduce((sum, sco) => sum + (sco.MONTANT_FINALE ?? sco.MONTANT_INITIALE), 0);

        const sortedEngagements = db.T_ENGAGEMENT
            .filter(e => e.ID_OPERATION === operation.ID_OPERATION)
            .sort((a, b) => {
                const yearA = parseInt(a.ANNEE, 10) || 0;
                const yearB = parseInt(b.ANNEE, 10) || 0;
                if (yearA !== yearB) return yearA - yearB;
                const numA = parseInt(a.N_ENG, 10) || 0;
                const numB = parseInt(b.N_ENG, 10) || 0;
                return numA - numB;
            });

        const currentIndex = sortedEngagements.findIndex(e => e.ID_ENGAGEMENT === engagementId);

        let previousCommitments = 0;
        if (currentIndex > 0) {
            for (let i = 0; i < currentIndex; i++) {
                const eng = sortedEngagements[i];
                if (eng.NATURE_ENG === 'التزام' || eng.NATURE_ENG === 'ملحق') previousCommitments += eng.MONTANT_ENG;
                else if (eng.NATURE_ENG === 'سحب') previousCommitments += eng.MONTANT_ENG;
            }
        }

        let displayedTotalEng = previousCommitments;
        let displayedSoldeAnt = budgetAmount - displayedTotalEng;
        let displayedMontantEng: number | string = engagement.MONTANT_ENG;
        let displayedReliquat = 0;

        const nature = engagement.NATURE_ENG;
        const isSahb = nature === 'سحب';
        const isDevaluation = nature === 'إنخفاض التقييم';
        const isStructureChange = nature === 'تغيير هيكلة الكلفة';
        const isCloture = nature === 'غلق';

        if (isStructureChange || isCloture) {
            displayedMontantEng = "للتذكيير";
            displayedReliquat = displayedSoldeAnt;
        } else {
            if (isSahb || isDevaluation) {
                displayedReliquat = displayedSoldeAnt - (displayedMontantEng as number);
            } else {
                displayedReliquat = displayedSoldeAnt - (displayedMontantEng as number);
            }
        }

        return {
            engagement, operation, direction, categorie, scategorie, scategorieOp,
            lots, beneficiary, budgetAmount, displayedTotalEng, displayedSoldeAnt,
            displayedMontantEng, displayedReliquat, rubriquesForInvoice: filteredRubriquesForInvoice
        };
    }, [db, loading, engagementId]);

    const printStyles = `
        @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap');
        body { 
            font-family: 'Amiri', serif; 
            direction: rtl; 
        }
        .print-area {
            direction: rtl;
            font-family: 'Amiri', serif;
            color: black;
            padding: 20px;
            background: white;
        }
        .header-text { text-align: center; font-weight: bold; font-size: 18px; margin-bottom: 20px; }
        .info-box { border: 1px solid black; padding: 8px; text-align: center; background-color: #f9fafb; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 13px; }
        th, td { border: 1px solid black; padding: 6px; text-align: center; }
        th { background-color: #f3f4f6; font-weight: bold; }
        .text-right { text-align: right; }
        .font-bold { font-weight: bold; }
        .underline { text-decoration: underline; }
        .mb-4 { margin-bottom: 1rem; }
        .mt-8 { margin-top: 2rem; }
        .flex { display: flex; }
        .justify-between { justify-content: space-between; }
        .items-center { align-items: center; }
        .w-full { width: 100%; }
        .grid { display: grid; }
        .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .gap-4 { gap: 1rem; }
        .h-40 { height: 11rem; }
        .bg-yellow-50 { background-color: #fefce8; }
    `;

    const handlePrintJS = () => {
        window.print();
    };

    if (loading) return <div className="p-8 text-center">جار تحميل البيانات...</div>;
    if (!printData) return <div className="p-8 text-center text-red-500">لم يتم العثور على البيانات.</div>;

    const { engagement, operation, direction, lots, beneficiary, budgetAmount, displayedTotalEng, displayedSoldeAnt, displayedMontantEng, displayedReliquat, rubriquesForInvoice = [] } = printData;

    const piece = db.T_PIECE.find(p => p.ID_PIECE === engagement.ID_PIECE);
    const isInvoice = piece?.NAT_PIECE === 'فاتورة';
    
    const opParts = operation.N_OPERATION.split('.');
    const opProg = opParts[3] || '';
    const opSProg = opParts[4] || '';
    const opAct = opParts[5] || '';
    const opSAct = opParts[6] || '';

    return (
        <div className="bg-white min-h-screen">
            {/* Inject styles for on-screen rendering */}
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
                    @page { margin: 0; size: A4; }
                    .no-print { display: none !important; }
                }
            `}</style>

            <div className="no-print mb-4 flex justify-between items-center bg-gray-100 p-3 rounded shadow">
                <h2 className="text-xl font-bold">معاينة طباعة بطاقة الالتزام</h2>
                <div className="flex gap-2">
                    <button onClick={() => navigate('OPERATION_DETAILS', operation.ID_OPERATION, `ENGAGEMENTS:${engagement.ID_ENGAGEMENT}:blue`)} className="bg-gray-600 text-white px-4 py-2 rounded">رجوع</button>
                    <button onClick={handlePrintJS} className="bg-blue-700 text-white px-6 py-2 rounded font-bold hover:bg-blue-800 transition-colors">
                        <i className="bi bi-printer mr-2"></i> طباعة 
                    </button>
                </div>
            </div>

            {/* This ID is crucial for jsPDF targeting */}
            <div id="print-content" className="print-area bg-white mx-auto max-w-[210mm] text-black text-lg" dir="rtl">
                
                {/* Header */}
                <div className="text-center font-bold text-lg mb-2">الجمهورية الجزائرية الديمقراطية الشعبية</div>
                
                <div className="flex justify-between items-start mb-1">
                    <div className="w-2/3 space-y-0.5 text-[9pt]">
                        <p className="font-bold">{direction.INT_PORTEFEUILLE}</p>
                        <p className="font-bold">{direction.DIRECTION}</p>
                        <p className="font-bold">رمز الآمر بالصرف: {direction.ORDONATEUR}</p>
                        <p className="font-bold">رقم بطاقة الالتزام: {engagement.N_ENG}/{engagement.ANNEE}</p>
                    </div>
                    <div className="w-1/3 text-left space-y-3 text-[9pt]">
                        <p className="font-bold">التاريخ: ......................</p>   
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-2 text-[9pt] mb-2 py-1">
                    <div>
                        <p><b>رمز محفظة البرنامج:</b> {direction.PORTEFEUILLE}</p>
                        <p><b>رمز البرنامج:</b> {opProg}</p>
                        <p><b>رمز البرنامج الفرعي:</b> {opSProg}</p>
                        <p><b>رمز النشاط:</b> {opAct}</p>
                        <p><b>رمز النشاط الفرعي(عند الاقتضاء):</b> {opSAct || '---'}</p>
                    </div>
                   
                </div>

                <div className="text-center mb-2 text-[9pt]">
                    <p><b>رقم العملية:</b> {operation.N_OPERATION}</p>
                    <p><b>عنوان العملية:</b> {operation.INT_OPERATION}</p>
                </div>

                <div className="mb-2">
                    <p className="font-bold text-[9pt] mb-1">العنوان 3: نفقات الاستثمار</p>
                    <table className="main-table w-full border-collapse border border-black text-center text-[10pt]">
                        <thead className="bg-gray-50 font-bold">
                            <tr>
                                <th className="border border-black w-[22%]">الصنف / الصنف الفرعي</th>
                                <th className="border border-black">رخص الالتزام المفتوحة/المعدلة</th>
                                <th className="border border-black">مجموع الالتزامات المكتتبة</th>
                                <th className="border border-black">الرصيد الأولي</th>
                                <th className="border border-black">الالتزام المقترح</th>
                                <th className="border border-black">الرصيد المتبقي</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="h-16">
                                <td className="border border-black align-top text-center p-1 leading-tight">
                                    <p className="mb-1"><b>الصنف:</b> {printData.categorie?.C_CATEGORIE} {printData.categorie?.INT_CATEGORIE}</p>
                                    <p><b>الصنف الفرعي:</b> {printData.scategorie?.C_SCATEGORIE} {printData.scategorie?.INT_SCATEGORIE}</p>
                                </td>
                                <td className="border border-black font-bold">{formatCurrency(budgetAmount)}</td>
                                <td className="border border-black">{formatCurrency(displayedTotalEng)}</td>
                                <td className="border border-black">{formatCurrency(displayedSoldeAnt)}</td>
                                <td className="border border-black font-bold">{formatCurrency(displayedMontantEng)}</td>
                                <td className="border border-black font-bold text-blue-800">{formatCurrency(displayedReliquat)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="space-y-1 text-[9pt] mb-4">
                    <p><b>موضوع الالتزام:</b> {engagement.OBJET_ENG}</p>
                    {isInvoice && lots.length === 0 && rubriquesForInvoice.length > 0 ? (
                        <div className="pr-4 text-[9pt] text-center">
                            {rubriquesForInvoice.map((r, i) => (
                                <p key={i}>- {r.name}</p>
                            ))}
                        </div>
                    ) : (
                        lots.length > 0 && (
                            <div className="pr-4 text-[9pt] text-center">
                                {lots.map(l => {
                                    const nLotStr = String(l.N_LOT || '').trim();
                                    const hasLetter = /[a-zA-Z\u0600-\u06FF]/.test(nLotStr);
                                    const hasNumber = /\d/.test(nLotStr);
                                    const showLotNumber = nLotStr && !(hasLetter && hasNumber);
                                    
                                    return (
                                        <p key={l.ID_LOT}>
                                            - {showLotNumber ? `الحصة ${l.N_LOT}: ` : ''}{l.INTITULE_LOT}
                                        </p>
                                    );
                                })}
                            </div>
                        )
                    )}
                    {beneficiary?.BENEFICIAIRE && beneficiary.BENEFICIAIRE !== '---' && (
                        <p><b>لفائدة:</b> {beneficiary.BENEFICIAIRE}</p>
                    )}
                    
                </div>

                <div className="grid grid-cols-2 gap-0 border border-black mt-4">
                    <div className="border-l border-black p-2 h-38 flex flex-col">
                        <p className="border-b border-black p-2 font-bold text-center mb-1 text-[10pt]">إطار مخصص للمراقب الميزانياتي</p>
                        <p className="text-[9pt]">رقم التأشيرة: {engagement.N_VISA_CB || '................'}</p>
                        <p className="text-[9pt] mt-1">تاريخ التأشيرة: {normalizeDate(engagement.DATE_VISA_CB) || '................'}</p>
                        <div className="mt-10 flex justify-between px-4 text-xs">
                            <span className="font-bold">ختم</span>
                            <span className="font-bold">إمضاء</span>
                        </div>
                    </div>
                    <div className="p-2 h-38 flex flex-col">
                        <p className="border-b border-black p-2 font-bold text-center mb-1 text-[10pt]">إطار مخصص للآمر بالصرف</p>
                        <div className="mt-auto flex justify-between px-4 text-xs">
                            <span className="font-bold">ختم</span>
                            <span className="font-bold">إمضاء</span>
                        </div>
                    </div>
                </div>
                
            </div>
        </div>
    );
};

export default PrintEngagementPage;
