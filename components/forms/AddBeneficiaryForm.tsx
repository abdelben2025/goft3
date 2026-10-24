
import React, { useState, useEffect, useRef } from 'react';
import { Beneficiaire, CompteBancaire } from '../../types';

interface AddBeneficiaryFormProps {
    onClose: () => void;
    onSave: (data: { beneficiaryData: Omit<Beneficiaire, 'ID_BENEFICIAIRE'> | Beneficiaire; accounts: Array<{ rib: string; banque: string }> }) => void;
    initialData?: { beneficiary: Beneficiaire; accounts: CompteBancaire[] };
}

const AddBeneficiaryForm: React.FC<AddBeneficiaryFormProps> = ({ onClose, onSave, initialData }) => {
    const [beneficiaire, setBeneficiaire] = useState('');
    const [adresse, setAdresse] = useState('');
    const [rc, setRc] = useState('');
    const [codeFiscale, setCodeFiscale] = useState('');
    const [accounts, setAccounts] = useState([{ rib: '', banque: '' }]);

    const isDirty = useRef(false);
    const isEditLoaded = useRef(false);
    const markDirty = () => { isDirty.current = true; };

    useEffect(() => {
        if (initialData && !isEditLoaded.current) {
            setBeneficiaire(initialData.beneficiary.BENEFICIAIRE);
            setAdresse(initialData.beneficiary.ADRESSE);
            setRc(initialData.beneficiary.RC || '');
            setCodeFiscale(initialData.beneficiary.CODE_FISCALE || '');
            if (initialData.accounts.length > 0) {
                setAccounts(initialData.accounts.map(acc => ({ rib: acc.RIB, banque: acc.BANQUE })));
            } else {
                setAccounts([{ rib: '', banque: '' }]);
            }
            isEditLoaded.current = true;
            isDirty.current = true;
        } else if (!initialData && !isDirty.current) {
            // New Entry Default - ensure clean state
            setBeneficiaire('');
            setAdresse('');
            setRc('');
            setCodeFiscale('');
            setAccounts([{ rib: '', banque: '' }]);
        }
    }, [initialData]);
    
    const handleAccountChange = (index: number, field: 'rib' | 'banque', value: string) => {
        markDirty();
        const newAccounts = [...accounts];
        const isSpecialAccount = ['الخزينة العمومية', 'حضيرة العتاد', 'حضير العتاد'].includes(beneficiaire.trim());
        
        if (field === 'rib') {
            const digitsOnly = value.replace(/\D/g, '').slice(0, 20);
            
            if (isSpecialAccount) {
                 // For Special account, no spacing format
                 newAccounts[index][field] = digitsOnly;
            } else {
                // Format for display as RIB
                const parts = [];
                if (digitsOnly.length > 0) parts.push(digitsOnly.slice(0, 3));
                if (digitsOnly.length > 3) parts.push(digitsOnly.slice(3, 8));
                if (digitsOnly.length > 8) parts.push(digitsOnly.slice(8, 18));
                if (digitsOnly.length > 18) parts.push(digitsOnly.slice(18, 20));
                newAccounts[index][field] = parts.join(' ');
            }
        } else {
            newAccounts[index][field] = value.toUpperCase();
        }
        
        setAccounts(newAccounts);
    };

    const addAccount = () => {
        markDirty();
        setAccounts([...accounts, { rib: '', banque: '' }]);
    };
    
    const removeAccount = (index: number) => {
        if (accounts.length <= 1) return; // Must have at least one account
        markDirty();
        const newAccounts = accounts.filter((_, i) => i !== index);
        setAccounts(newAccounts);
    };


    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        if (accounts.some(acc => !acc.rib.trim() || !acc.banque.trim())) {
            alert('يرجى ملء جميع حقول الحسابات البنكية (رقم الحساب والبنك).');
            return;
        }

        if (!['الخزينة العمومية', 'حضيرة العتاد', 'حضير العتاد'].includes(beneficiaire.trim()) && accounts.some(acc => acc.rib.replace(/\s/g, '').length !== 20)) {
            alert('رقم الحساب (RIB) يجب أن يتكون من 20 رقمًا.');
            return;
        }

        setIsSubmitting(true);
        const processedAccounts = accounts.map(acc => ({
            ...acc,
            rib: acc.rib.replace(/\s/g, '')
        }));

        const beneficiaryData = {
            ...(initialData?.beneficiary || {}),
            BENEFICIAIRE: beneficiaire,
            ADRESSE: adresse,
            RC: rc || null,
            CODE_FISCALE: codeFiscale || null,
        };
        
        onSave({
            beneficiaryData,
            accounts: processedAccounts,
        });
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col max-h-[85vh]">
            <div className="sticky top-0 bg-white z-10 pb-2 border-b border-gray-200 flex justify-end gap-3 pt-1 mb-2">
                <button type="button" onClick={onClose} className="px-5 py-1.5 bg-gray-200 text-gray-800 rounded-[20PX] hover:bg-gray-300 transition-colors text-sm">إلغاء</button>
                <button type="submit" disabled={isSubmitting} className="px-5 py-1.5 bg-blue-600 text-white rounded-[20PX] hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed text-sm">
                    {isSubmitting ? 'جاري الحفظ...' : (initialData ? 'حفظ التغييرات' : 'إضافة')}
                </button>
            </div>

            <div className="space-y-3 overflow-y-auto p-1">
            <div>
                <label htmlFor="beneficiaire" className="block text-sm font-medium text-gray-700 text-right">الإسم المستفيد</label>
                <input id="beneficiaire" type="text" value={beneficiaire} onChange={e => { setBeneficiaire(e.target.value.toUpperCase()); markDirty(); }} required className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase" />
            </div>
            <div>
                <label htmlFor="adresse" className="block text-sm font-medium text-gray-700 text-right">العنوان</label>
                <input id="adresse" type="text" value={adresse} onChange={e => { setAdresse(e.target.value.toUpperCase()); markDirty(); }} required className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase" />
            </div>
            
            <div className="space-y-3 p-4 border border-gray-200 rounded-md bg-gray-50">
                <div className="flex justify-between items-center">
                    <h4 className="text-md font-semibold text-gray-700">الحسابات البنكية</h4>
                    <button type="button" onClick={addAccount} className="px-3 py-1 bg-green-500 text-white rounded-full text-sm hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-400">
                        <i className="bi bi-plus"></i> إضافة حساب
                    </button>
                </div>
                {accounts.map((account, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-white rounded-md border">
                        <div className="flex-grow grid grid-cols-2 gap-3">
                             <div>
                                 <label htmlFor={`rib-${index}`} className="block text-xs font-bold text-gray-500 text-right uppercase tracking-tighter">
                                     {['الخزينة العمومية', 'حضيرة العتاد', 'حضير العتاد'].includes(beneficiaire.trim()) ? 'رقم الحساب الخاص (COMPTE SPECIAL)' : 'رقم الحساب (RIB)'}
                                 </label>
                                     <div className="relative">
                                    <input 
                                        id={`rib-${index}`} 
                                        type="text" 
                                        inputMode="numeric" 
                                        value={account.rib} 
                                        onChange={e => handleAccountChange(index, 'rib', e.target.value)} 
                                        required 
                                        maxLength={['الخزينة العمومية', 'حضيرة العتاد', 'حضير العتاد'].includes(beneficiaire.trim()) ? 20 : 23} 
                                        placeholder={['الخزينة العمومية', 'حضيرة العتاد', 'حضير العتاد'].includes(beneficiaire.trim()) ? "000000..." : "000 00000 0000000000 00"} 
                                        className={`w-full px-2 py-1.5 mt-1 text-sm font-mono bg-gray-50 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all tracking-wider ${['الخزينة العمومية', 'حضير العتاد', 'حضيرة العتاد'].includes(beneficiaire.trim()) ? 'text-right' : 'text-left'}`}
                                        dir={['الخزينة العمومية', 'حضيرة العتاد', 'حضير العتاد'].includes(beneficiaire.trim()) ? 'rtl' : 'ltr'}
                                    />
                                    <p className="text-[9px] text-blue-500 mt-0.5 text-right font-medium">
                                        {account.rib.replace(/\s/g, '').length} / {['الخزينة العمومية', 'حضيرة العتاد', 'حضير العتاد'].includes(beneficiaire.trim()) ? 'أقصى 20' : '20'} رقم
                                    </p>
                                 </div>
                            </div>
                            <div>
                                <label htmlFor={`banque-${index}`} className="block text-xs font-bold text-gray-500 text-right uppercase tracking-tighter">البنك / الوكالة</label>
                                <input 
                                    id={`banque-${index}`} 
                                    type="text" 
                                    value={account.banque} 
                                    onChange={e => handleAccountChange(index, 'banque', e.target.value.toUpperCase())} 
                                    required 
                                    placeholder="مثلا: BNA RELIZANE . أو بنك الوطني الجزائري غليزان"
                                    className="w-full px-2 py-1.5 mt-1 text-sm bg-gray-50 border border-gray-200 rounded-md focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all uppercase"
                                />
                            </div>
                        </div>
                        <button type="button" onClick={() => removeAccount(index)} disabled={accounts.length <= 1} className="mt-5 px-3 py-1 bg-red-500 text-white rounded-full text-sm hover:bg-red-600 disabled:bg-gray-300">
                            <i className="bi bi-trash"></i>
                        </button>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label htmlFor="rc" className="block text-sm font-medium text-gray-700 text-right">رقم السجل</label>
                    <input id="rc" type="text" value={rc} onChange={e => { setRc(e.target.value.toUpperCase()); markDirty(); }} className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-left font-mono uppercase" dir="ltr" />
                </div>
                <div>
                    <label htmlFor="codeFiscale" className="block text-sm font-medium text-gray-700 text-right">التعريف الجبائي</label>
                    <input id="codeFiscale" type="text" value={codeFiscale} onChange={e => { setCodeFiscale(e.target.value.toUpperCase()); markDirty(); }} required className="w-full px-3 py-2 mt-1 text-gray-700 bg-gray-100 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-left font-mono uppercase" dir="ltr" />
                </div>
            </div>
            </div>
        </form>
    );
};

export default AddBeneficiaryForm;
