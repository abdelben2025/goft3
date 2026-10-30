import React, { useMemo } from 'react';
import { Page } from '../types';
import { useData } from '../context/DataContext';

interface PrintRevenueTablePageProps {
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

const normalizeDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '';
    if (dateStr.includes('/')) return dateStr;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
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
                        <p className="mt-1">رمز الآمر بالصرف: 214.048.01</p>
                    </div>
                </div>

                <div className="text-center my-4">
                    <h2 className="text-xl font-bold">جدول إرسال أوامر الإيرادات</h2>
                </div>

                <table className="border border-black mb-4">
                    <tbody>
                        <tr>
                            <td className="w-1/2 border-none">
                                <div className="space-y-1 text-xs">
                                    <div className="flex items-center gap-2"><span className="font-bold">رقم جدول الإرسال :</span> <span>{paiement.N_PAI}</span></div>
                                    <div className="flex items-center gap-2"><span className="font-bold">رقم الحساب :</span> <span className="font-bold">201.007</span></div>
                                </div>
                            </td>
                            <td className="w-1/2 p-1.5 border border-black">
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
                            <td className="text-center font-bold">0,00</td>
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
                    <div className="flex justify-end items-start mt-6">
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
