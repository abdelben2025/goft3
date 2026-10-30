import React, { useMemo } from 'react';
import { Page } from '../types';
import { useData } from '../context/DataContext';

interface PrintRevenueNoticePageProps {
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

const PrintRevenueNoticePage: React.FC<PrintRevenueNoticePageProps> = ({ navigate, paiementId }) => {
    const { db, loading } = useData();

    const printData = useMemo(() => {
        if (loading || !paiementId) return null;

        const paiement = db.T_PAIEMENT.find(p => p.ID_PAIEMENT === paiementId);
        if (!paiement) return null;

        const operation = db.T_OPERATION.find(op => op.ID_OPERATION === paiement.ID_OPERATION);
        if (!operation) return null;

        const piece = db.T_PIECE.find(p => p.ID_PIECE === paiement.ID_PIECE);
        const beneficiary = piece?.ID_BENEFICIAIRE ? db.T_BENEFICIAIRE.find(b => b.ID_BENEFICIAIRE === piece.ID_BENEFICIAIRE) : null;
        const bankAccount = beneficiary ? db.T_COMPTE_BANCAIRE.find(acc => acc.ID_BENEFICIAIRE === beneficiary.ID_BENEFICIAIRE) : null;
        const direction = db.T_DIRECTION[0];

        return {
            paiement,
            operation,
            piece,
            beneficiary,
            bankAccount,
            direction
        };
    }, [db, loading, paiementId]);

    const printStyles = `
        body { font-family: 'Amiri', serif; direction: rtl; }
        .print-area { direction: rtl; font-family: 'Amiri', serif; color: black; padding: 15mm; background: white; font-size: 13px; line-height: 1.4; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 12px; }
        th, td { border: 1px solid black; padding: 5px; text-align: right; vertical-align: top; }
        th { background-color: #f3f4f6; font-weight: bold; text-align: center; }
        .text-center { text-align: center; }
        .font-bold { font-weight: bold; }
        .border-none { border: none !important; }
    `;

    if (loading) return <div className="p-8 text-center">جار تحميل البيانات...</div>;
    if (!printData) return <div className="p-8 text-center text-red-500">لم يتم العثور على البيانات.</div>;

    const { paiement, operation, beneficiary, bankAccount, direction } = printData;
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
                <h2 className="text-xl font-bold">طباعة إشعار إصدار أمر بالإيراد (ملحق 02)</h2>
                <div className="flex gap-2">
                    <button onClick={() => navigate('OPERATION_DETAILS', operation.ID_OPERATION, `PAIEMENTS:${paiement.ID_PAIEMENT}:blue`)} className="bg-gray-600 text-white px-4 py-2 rounded">رجوع</button>
                    <button onClick={() => window.print()} className="bg-blue-700 text-white px-6 py-2 rounded font-bold hover:bg-blue-800 transition-colors"><i className="bi bi-printer mr-2"></i> طباعة </button>
                </div>
            </div>

            <div id="print-content" className="print-area bg-white mx-auto max-w-[210mm] text-black">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <span className="font-bold text-sm">الملحق رقم: 02</span>
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
                    <h2 className="text-xl font-bold">إشعار إصدار أمر بالإيراد</h2>
                </div>

                <table className="border border-black mb-4">
                    <tbody>
                        <tr>
                            <td className="w-1/2 border-none"></td>
                            <td className="w-1/2 p-1.5 border border-black">
                                <div className="flex justify-between"><span>السنة المالية :</span><span className="font-bold">{paiement.ANNEE || '2026'}</span></div>
                                <div className="flex justify-between"><span>محفظة البرنامج :</span><span className="font-bold">024</span></div>
                                <div className="flex justify-between"><span>البرنامج :</span><span className="font-bold">090</span></div>
                                <div className="flex justify-between"><span>البرنامج الفرعي :</span><span className="font-bold">02</span></div>
                                <div className="flex justify-between"><span>النشاط :</span><span className="font-bold">2048</span></div>
                                <div className="flex justify-between"><span>النشاط الفرعي :</span><span className="font-bold">000</span></div>
                                <div className="flex justify-between"><span>العنوان :</span><span className="font-bold">{operation.INT_OPERATION}</span></div>
                                <div className="flex justify-between"><span>الصنف :</span><span className="font-bold">31000 تثبيتات عينية</span></div>
                                <div className="flex justify-between"><span>الصنف الفرعي :</span><span className="font-bold">31412 المنشآت القاعدية للطرقات</span></div>
                                <div className="flex justify-between"><span>حساب القيد :</span><span className="font-bold">201.007</span></div>
                                <div className="flex justify-between"><span>رقم الأمر :</span><span className="font-bold">{paiement.N_PAI}</span></div>
                            </td>
                        </tr>
                    </tbody>
                </table>

                <div className="mb-4 leading-loose text-justify">
                    <p>
                        يطلب من السيد <span className="font-bold">{beneficiary?.BENEFICIAIRE || '---'}</span> ان يدفع لصندوق امين الخزينة ولاية غليزان وهو مؤهل وفقا لأحكام المرسوم التنفيذي رقم 46.93 المؤرخ في 1993.02.06 لتحصيل إيرادات في حساب رقم <span className="font-bold">201.007</span> ............... السطر ( ) ، المعنون ..............................................................
                    </p>
                    <p className="font-bold mt-2">المبلغ المشار اليه للأسباب المذكورة ادناه :</p>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th className="w-2/5">المدين</th>
                            <th className="w-2/5">الأسباب</th>
                            <th className="w-1/5">أساس التصفاية</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>
                                <div className="space-y-1 text-xs">
                                    <p><span className="font-bold">الإسم واللقب:</span> {beneficiary?.BENEFICIAIRE || '---'}</p>
                                    <p><span className="font-bold">النشاط/ الإسم التجاري للمدين:</span> مؤسسة الأشغال العمومية و الري {beneficiary?.BENEFICIAIRE || '---'}</p>
                                    <p><span className="font-bold">عنوان المدين:</span> {beneficiary?.ADRESSE || '---'}</p>
                                    <p><span className="font-bold">الحساب الجاري:</span> {bankAccount ? `${bankAccount.RIB} ${bankAccount.BANQUE}` : '---'}</p>
                                    <p><span className="font-bold">السجل التجاري:</span> {beneficiary?.RC || '---'}</p>
                                    <p><span className="font-bold">رقم التعريف الجبائي:</span> {beneficiary?.CODE_FISCALE || '---'}</p>
                                </div>
                            </td>
                            <td className="text-center align-middle">
                                <p className="font-medium">{paiement.OBJET_PAI || 'لتحصيل مبلغ عقوبة التأخير'}</p>
                            </td>
                            <td className="text-center align-middle">
                                <p className="text-xs">مبلغ الحوالة الخام</p>
                                <p className="font-bold mt-1">= {formatCurrency(paiement.MONTANT_PAI)}</p>
                            </td>
                        </tr>
                        <tr>
                            <td colSpan={2} className="font-bold text-left px-4">المبلغ المراد تحصيله</td>
                            <td className="text-center font-black text-emerald-800 text-sm">{formatCurrency(amountToCollect)}</td>
                        </tr>
                    </tbody>
                </table>

                <div className="mt-4 space-y-3">
                    <p className="font-bold">
                        يوقف الأمر بالإيراد على المبلغ : <span className="font-normal">{numberToArabicWords(amountToCollect)}</span>
                    </p>
                    <div className="flex justify-between items-start mt-6">
                        <div>
                            <p className="text-xs text-gray-600">1/ 2 في حالة عملية استرداد لإعتمادات</p>
                        </div>
                        <div className="text-center font-bold">
                            <p>حرر في: غليزان بتاريخ: <span dir="ltr">{normalizeDate(paiement.DATE_PAI)}</span></p>
                            <p className="mt-8">الآمر بالصرف</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PrintRevenueNoticePage;
