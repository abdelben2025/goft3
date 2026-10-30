import React, { useMemo } from 'react';
import { Page } from '../types';
import { useData } from '../context/DataContext';
import { formatCurrency, numberToArabicWords } from '../utils/currencyUtils';
import { normalizeDate } from '../utils/dateUtils';

interface PrintRevenueTablePageProps {
    navigate: (page: Page, id?: number, tab?: string) => void;
    paiementId: number;
}

const PrintRevenueTablePage: React.FC<PrintRevenueTablePageProps> = ({ navigate, paiementId }) => {
    const { db, loading } = useData();

    const printData = useMemo(() => {
        if (loading || !paiementId) return null;

        const paiement = db.T_PAIEMENT.find(p => p.ID_PAIEMENT === paiementId);
        if (!paiement) return null;

        const operation = db.T_OPERATION.find(op => op.ID_OPERATION === paiement.ID_OPERATION);
        if (!operation) return null;

        const piece = db.T_PIECE.find(p => p.ID_PIECE === paiement.ID_PIECE);
        const beneficiary = piece?.ID_BENEFICIAIRE ? db.T_BENEFICIAIRE.find(b => b.ID_BENEFICIAIRE === piece.ID_BENEFICIAIRE) : null;
        const direction = db.T_DIRECTION[0];

        return {
            paiement,
            operation,
            piece,
            beneficiary,
            direction
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

    if (loading) return <div className="p-8 text-center">جار تحميل البيانات...</div>;
    if (!printData) return <div className="p-8 text-center text-red-500">لم يتم العثور على البيانات.</div>;

    const { paiement, operation, beneficiary, direction } = printData;
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
                <h2 className="text-xl font-bold">طباعة جدول إرسال أوامر الإيرادات (ملحق 05)</h2>
                <div className="flex gap-2">
                    <button onClick={() => navigate('OPERATION_DETAILS', operation.ID_OPERATION, `PAIEMENTS:${paiement.ID_PAIEMENT}:blue`)} className="bg-gray-600 text-white px-4 py-2 rounded">رجوع</button>
                    <button onClick={() => window.print()} className="bg-blue-700 text-white px-6 py-2 rounded font-bold hover:bg-blue-800 transition-colors"><i className="bi bi-printer mr-2"></i> طباعة </button>
                </div>
            </div>

            <div id="print-content" className="print-area bg-white mx-auto max-w-[210mm] text-black">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <span className="font-bold text-sm">الملحق رقم: 05</span>
                    </div>
                    <div className="text-center">
                        <p className="font-bold text-base">الجمهورية الجزائرية الديمقراطية الشعبية</p>
                        <p className="text-sm underline font-bold">REPUBLIQUE ALGERIENNE DEMOCRATIQUE ET POPULAIRE</p>
                    </div>
                    <div className="border border-black p-2 text-center text-xs w-[260px]">
                        <p className="font-bold">{direction?.DIRECTION || 'الآمر بالصرف مديرية الأشغال العمومية ولاية غليزان'}</p>
                        <p className="mt-1">رمز الآمر بالصرف 214.048.01</p>
                    </div>
                </div>

                <div className="text-center my-4">
                    <h2 className="text-xl font-bold">جدول إرسال أوامر الإيرادات</h2>
                </div>

                <table className="border border-black mb-4">
                    <tbody>
                        <tr>
                            <td className="w-1/2 p-2 border border-black">
                                <div className="space-y-1 text-xs">
                                    <div className="flex items-center justify-between"><span className="font-bold">رقم جدول الإرسال :</span> <span>{paiement.N_PAI}</span></div>
                                    <div className="flex items-center justify-between"><span className="font-bold">رقم الحساب :</span> <span className="font-bold">201.007</span></div>
                                </div>
                            </td>
                            <td className="w-1/2 p-2 border border-black">
                                <div className="flex justify-between"><span>السنة المالية :</span><span className="font-bold">{paiement.ANNEE || '2026'}</span></div>
                                <div className="flex justify-between"><span>محفظة البرنامج :</span><span className="font-bold">024</span></div>
                                <div className="flex justify-between"><span>البرنامج :</span><span className="font-bold">090</span></div>
                                <div className="flex justify-between"><span>البرنامج الفرعي :</span><span className="font-bold">02</span></div>
                                <div className="flex justify-between"><span>النشاط :</span><span className="font-bold">2048</span></div>
                                <div className="flex justify-between"><span>النشاط الفرعي :</span><span className="font-bold">000</span></div>
                            </td>
                        </tr>
                    </tbody>
                </table>

                <table className="border border-black">
                    <thead>
                        <tr>
                            <th colSpan={2} className="w-1/4">رقم و تاريخ الأمر بالإيراد</th>
                            <th className="w-1/3">اسم المدينين</th>
                            <th className="w-1/5">المبلغ المراد تحصيله</th>
                            <th className="w-1/5">ملاحظات</th>
                        </tr>
                        <tr>
                            <th>الرقم</th>
                            <th>التاريخ</th>
                            <th></th>
                            <th></th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td className="text-center font-bold">{paiement.N_PAI}</td>
                            <td className="text-center" dir="ltr">{normalizeDate(paiement.DATE_PAI)}</td>
                            <td className="text-center font-medium">{beneficiary?.BENEFICIAIRE || 'دندن عبد الله'}</td>
                            <td className="text-center font-bold">{formatCurrency(amountToCollect)}</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td colSpan={3} className="font-bold text-left px-4">اجمالي أوامر الإيرادات</td>
                            <td className="text-center font-bold">{formatCurrency(amountToCollect)}</td>
                            <td></td>
                        </tr>
                        <tr>
                            <td colSpan={3} className="font-bold text-left px-4">مجموع المبلغ السابق</td>
                            <td className="text-center"></td>
                            <td></td>
                        </tr>
                        <tr>
                            <td colSpan={3} className="font-bold text-left px-4">المبلغ الإجمالي</td>
                            <td className="text-center font-black text-emerald-800">{formatCurrency(amountToCollect)}</td>
                            <td></td>
                        </tr>
                    </tbody>
                </table>

                <div className="mt-4 space-y-3">
                    <p className="font-bold">
                        يوقف الأمر بالإيراد على المبلغ : <span className="font-normal">{numberToArabicWords(amountToCollect)}</span>
                    </p>
                    <div className="flex justify-between items-start mt-6">
                        <div></div>
                        <div className="text-center font-bold">
                            <p>غليزان في: <span dir="ltr">{normalizeDate(paiement.DATE_PAI)}</span></p>
                            <p className="mt-8">الآمر بالصرف</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrintRevenueTablePage;
