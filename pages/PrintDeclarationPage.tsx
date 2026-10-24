
import React, { useMemo, useState } from 'react';
import { Page } from '../types';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';

interface PrintDeclarationPageProps {
    navigate: (page: Page, id?: number, tab?: string) => void;
    paiementId: number;
}

const formatCurrencyForDeclaration = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return '0,00';
    const options: Intl.NumberFormatOptions = {
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        useGrouping: true,
    };
    return new Intl.NumberFormat('ar-DZ', options).format(amount);
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


const PrintDeclarationPage: React.FC<PrintDeclarationPageProps> = ({ navigate, paiementId }) => {
    const { db, loading } = useData();
    const { t } = useLanguage();

    const printData = useMemo(() => {
        if (loading || !paiementId) return null;

        const paiement = db.T_PAIEMENT.find(p => p.ID_PAIEMENT === paiementId);
        if (!paiement) return null;

        const operation = db.T_OPERATION.find(op => op.ID_OPERATION === paiement.ID_OPERATION);
        if (!operation) return null;

        const piece = db.T_PIECE.find(p => p.ID_PIECE === paiement.ID_PIECE);
        if (!piece) return null;

        const beneficiary = db.T_BENEFICIAIRE.find(b => b.ID_BENEFICIAIRE === piece.ID_BENEFICIAIRE);
        if (!beneficiary) return null;
        
        const account = db.T_COMPTE_BANCAIRE.find(acc => acc.ID_COMPTE === piece.ID_COMPTE);

        const direction = db.T_DIRECTION[0];
        if (!direction) return null;
        
        const today = new Date();
        const formattedDate = `${String(today.getDate()).padStart(2, '0')} / ${String(today.getMonth() + 1).padStart(2, '0')} / ${today.getFullYear()}`;

        return {
            paiement,
            operation,
            beneficiary,
            account,
            direction,
            piece,
            currentDate: formattedDate
        };

    }, [db, loading, paiementId]);

    const printStyles = `
        @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap');
        body { font-family: 'Amiri', serif; direction: rtl; }
        .print-area { direction: rtl; font-family: 'Amiri', serif; color: black; padding: 20px; background: white; }
        .text-center { text-align: center; }
        .font-bold { font-weight: bold; }
        .text-lg { font-size: 1.125rem; }
        .text-3xl { font-size: 1.875rem; }
        .mb-4 { margin-bottom: 1rem; }
        .my-8 { margin-top: 2rem; margin-bottom: 2rem; }
        .my-2 { margin-top: 0.5rem; margin-bottom: 0.5rem; }
        .my-4 { margin-top: 1rem; margin-bottom: 1rem; }
        .mt-2 { margin-top: 0.5rem; }
        .mt-15 { margin-top: 3.75rem; }
        .flex { display: flex; }
        .justify-between { justify-content: space-between; }
        .justify-end { justify-content: flex-end; }
        .underline { text-decoration: underline; }
        .text-left { text-align: left; }
        .text-right { text-align: right; }
        .w-full { width: 100%; }
        .w-2\\/3 { width: 66.666667%; }
        .w-1\\/3 { width: 33.333333%; }
        table { width: 100%; }
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
    if (!printData) return <div className="p-8 text-center">{t('no_data')}</div>;

    const { paiement, operation, beneficiary, direction } = printData;
    const account = activeAccount;

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
                        top: 1;
                        width: 100%;
                    }
                    @page { margin: 0; size: A4 portrait; }
                    .no-print { display: none !important; }
                }
            `}</style>
            
            <div className="no-print mb-4 flex justify-between items-center bg-gray-100 p-3 rounded shadow">
                <h2 className="text-xl font-bold">{t('print.title.payment_declaration')}</h2>
                <div className="flex items-center gap-4">
                    {beneficiaryAccounts.length > 0 && (
                        <div className="flex items-center gap-2 bg-sky-50 px-3 py-1.5 rounded border border-sky-200">
                            <span className="text-sm font-semibold text-sky-800">الحساب البنكي للطباعة:</span>
                            <select 
                                className="text-xs border rounded p-1 bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
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
                        <button onClick={() => navigate('OPERATION_DETAILS', operation.ID_OPERATION, `PAIEMENTS:${paiement.ID_PAIEMENT}:blue`)} className="bg-gray-600 text-white px-4 py-2 rounded">رجوع</button>
                        <button onClick={handlePrintJS} className="bg-blue-700 text-white px-6 py-2 rounded font-bold hover:bg-blue-800 transition-colors"><i className="bi bi-printer mr-2"></i> طباعة </button>
                    </div>
                </div>
            </div>

            <div id="print-content" className="print-area bg-white mx-auto max-w-[210mm] text-black" dir="rtl">
                <header className="text-center font-bold text-lg mb-3">
                    <p>{t('print.header.republic')}</p>
                    <p className="ltr:text-left rtl:text-right">{direction.INT_PORTEFEUILLE}</p>
                    <p className="ltr:text-left rtl:text-right">{direction.DIRECTION}</p>
                </header>

                <h1 className="text-center font-bold text-3xl my-5">{t('print.title.payment_declaration')}</h1>
                
                <div className="flex justify-between font-bold mb-3">
                     <p>{t('print.label.date')}</p>
                     <p>{t('print.label.wilaya')}</p>
                </div>

                <p className="ltr:text-left rtl:text-right">عن طريق الخصم من حسابنا المفتوح في دفاتركم تحت رقم بيان التعريف المصرفي</p>
                <p className="ltr:text-left rtl:text-right font-bold my-2">{`008.48001.574444800195`}</p>

                <table className="w-full my-3">
                    <tbody>
                        <tr>
                            <td className="w-2/3 ltr:text-left rtl:text-right font-bold">{t('print.label.name')} : </td>
                        </tr>
                        <tr>
                            <td className="w-2/3 ltr:text-left rtl:text-right font-bold">{t('print.label.surname')} : </td>
                        </tr>
                        <tr>
                            <td className="w-2/3 ltr:text-left rtl:text-right font-bold"> {t('print.label.social_reason')} :  {direction.DIRECTION}</td>
                        </tr>
                        <tr>
                            <td className="ltr:text-left rtl:text-right font-bold">  عنوان الأمر : حي الانتصار غليزان</td>
                        </tr>
                        <tr>
                            <td><span className="ltr:text-left rtl:text-right font-bold"> {t('print.label.operation_title')} </span>{operation.INT_OPERATION}</td>
                        </tr>
                    </tbody>
                </table>
                
                <p className="font-bold ltr:text-left rtl:text-right my-4">{t('print.label.please_credit')}</p>

                <table className="w-full my-3">
                    <tbody>
                        <tr>
                            <td className="w-2/3 ltr:text-left rtl:text-right font-bold">{t('print.label.name')} : </td>
                        </tr>
                        <tr>
                            <td className="w-2/3 ltr:text-left rtl:text-right font-bold">{t('print.label.surname')} : </td>
                        </tr>
                        <tr>
                            <td><span className="w-2/3 ltr:text-left rtl:text-right font-bold"> {t('print.label.social_reason')} : </span>{beneficiary.BENEFICIAIRE}</td>
                        </tr>
                         <tr>
                            <td><span className="ltr:text-left rtl:text-right font-bold"> {t('print.label.contractor_address')} : </span>{beneficiary.ADRESSE}</td>
                         </tr>
                        <tr>
                            <td><span className="ltr:text-left rtl:text-right font-bold"> {t('print.label.bank_rib')} : </span>{account?.RIB} {account?.BANQUE}</td>
                         </tr>
                         <tr>
                            <td><span className="ltr:text-left rtl:text-right font-bold"> {t('col.tax_id')} : </span>{beneficiary.CODE_FISCALE}</td>
                         </tr>
                    </tbody>
                </table>

                <p><span className="font-bold">{t('print.label.payment_subject')} : </span> {paiement.OBJET_PAI}</p>
                <p className="font-bold mt-2">المبلغ بالدينار الجزائري : </p>
                
                 <table className="w-full my-3">
                    <tbody>
                        <tr>
                            <td><span className="w-1/3 ltr:text-left rtl:text-right font-bold"> {t('print.label.amount_in_letters')} : </span>{numberToArabicWords(paiement.MONTANT_PAI)}</td>
                        </tr>
                        <tr>
                            <td><span className="ltr:text-left rtl:text-right font-bold"> {t('print.label.amount_in_numbers')} : </span>{formatCurrencyForDeclaration(paiement.MONTANT_PAI)}</td>
                        </tr>
                    </tbody>
                </table>

                <footer className="mt-2 ml-6 flex justify-end">
                    <p className="font-bold text-lg">{t('print.label.accredited_signature')}</p>
                </footer>
            </div>
        </div>
    );
};

export default PrintDeclarationPage;
