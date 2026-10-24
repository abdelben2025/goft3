
import React, { useState, useEffect } from 'react';
import { User, Page } from '../../types';
import { useData } from '../../context/DataContext';
import { hashPassword } from '../../utils/authUtils';

interface AddUserFormProps {
    onClose: () => void;
    onSave: (user: Omit<User, 'ID_USER'> | User) => void;
    initialData?: User;
}

const PAGE_NAMES: { [key in Page]?: string } = {
    'HOME': 'الرئيسية',
    'OPERATIONS': 'العمليات',
    'DOCUMENTS': 'الوثائق',
    'BENEFICIARIES': 'المستفيدين',
    'FINANCIAL_STATUS': 'الوضعية المالية',
    'FINANCIAL_STATUS_BY_STRUCTURE': 'الوضعية المالية حسب الهيكل',
    'PROJECT_TRACKING': 'متابعة المشاريع',
    'PAYMENT_CLAIMS': 'مطالبات الدفع',
    'AE_INSUFFICIENCY': 'نقص اعتمادات الالتزام',
    'UNREGISTERED_DOCUMENTS': 'الوثائق غير المسجلة',
    'CUSTOM_REPORT': 'تقرير مخصص',
    'VISAED_ENGAGEMENTS': 'الالتزامات المؤشرة',
    'APPENDIX_01': 'الملحق 01',
    'SETTINGS': 'الإعدادات',
    'USERS': 'المستخدمين',
    'PROGRAMME': 'البرامج',
    'CATEGORIE': 'الأصناف',
    'DIRECTION': 'المديريات',
    'RUBRIQUE': 'هيكلة الكلفة',
};

const AddUserForm: React.FC<AddUserFormProps> = ({ onClose, onSave, initialData }) => {
    const { db } = useData();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<'admin' | 'user' | 'viewer'>('user');
    const [selectedPages, setSelectedPages] = useState<Page[]>([]);
    const [selectedOperations, setSelectedOperations] = useState<number[]>([]);

    useEffect(() => {
        if (initialData) {
            setUsername(initialData.USERNAME);
            setPassword(initialData.PASSWORD);
            setRole(initialData.ROLE);
            
            if (initialData.ALLOWED_PAGES) {
                try {
                    setSelectedPages(JSON.parse(initialData.ALLOWED_PAGES));
                } catch (e) {
                    setSelectedPages([]);
                }
            }
            
            if (initialData.ALLOWED_OPERATIONS) {
                try {
                    setSelectedOperations(JSON.parse(initialData.ALLOWED_OPERATIONS));
                } catch (e) {
                    setSelectedOperations([]);
                }
            }
        }
    }, [initialData]);

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isSubmitting) return;

        if (!username.trim() || !password.trim()) {
            alert('يرجى ملء جميع حقول.');
            return;
        }

        setIsSubmitting(true);
        try {
            let finalPassword = password;
            // Only hash if new user or password was changed manually
            if (!initialData || password !== initialData.PASSWORD) {
                finalPassword = await hashPassword(password);
            }

            onSave({
                ...(initialData || {}),
                USERNAME: username,
                PASSWORD: finalPassword,
                ROLE: role,
                ALLOWED_PAGES: role === 'admin' ? undefined : JSON.stringify(selectedPages),
                ALLOWED_OPERATIONS: role === 'admin' ? undefined : JSON.stringify(selectedOperations),
            });
        } catch (err) {
            console.error("Hashing error:", err);
            alert("خطأ في تشفير كلمة المرور");
            setIsSubmitting(false);
        }
    };

    const togglePage = (page: Page) => {
        setSelectedPages(prev => 
            prev.includes(page) ? prev.filter(p => p !== page) : [...prev, page]
        );
    };

    const toggleOperation = (id: number) => {
        setSelectedOperations(prev => 
            prev.includes(id) ? prev.filter(oid => oid !== id) : [...prev, id]
        );
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col max-h-[85vh]">
            <div className="sticky top-0 bg-white z-10 pb-2 border-b border-gray-200 flex justify-end gap-3 pt-1 mb-2">
                <button type="button" onClick={onClose} className="px-5 py-1.5 bg-gray-200 text-gray-800 rounded-[20px] hover:bg-gray-300 transition-colors text-sm">إلغاء</button>
                <button type="submit" disabled={isSubmitting} className="px-5 py-1.5 bg-blue-600 text-white rounded-[20px] hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed text-sm">
                    {isSubmitting ? 'جاري الحفظ...' : (initialData ? 'حفظ التغييرات' : 'إضافة')}
                </button>
            </div>
            <div className="space-y-4 overflow-y-auto p-1 text-right">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 text-right">اسم المستخدم</label>
                        <input type="text" value={username} onChange={e => setUsername(e.target.value)} required className="w-full px-3 py-2 mt-1 text-gray-700 bg-white border border-gray-300 rounded-[20px] focus:ring-blue-500 focus:border-blue-500 normal-case" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 text-right">كلمة المرور</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full px-3 py-2 mt-1 text-gray-700 bg-white border border-gray-300 rounded-[20px] focus:ring-blue-500 focus:border-blue-500 normal-case" />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 text-right">الدور</label>
                    <select value={role} onChange={e => setRole(e.target.value as 'admin' | 'user' | 'viewer')} required className="w-full px-3 py-2 mt-1 text-gray-700 bg-white border border-gray-300 rounded-[20px] focus:ring-blue-500 focus:border-blue-500">
                        <option value="user">مستخدم</option>
                        <option value="admin">مسؤول</option>
                        <option value="viewer">ملاحظ</option>
                    </select>
                </div>

                {role !== 'admin' && (
                    <>
                        <div className="border-t pt-4">
                            <h3 className="text-sm font-semibold text-gray-800 mb-2">تخصيص الوحدات (الصفحات المسموحة)</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {(Object.entries(PAGE_NAMES) as [Page, string][]).map(([page, name]) => (
                                    <label key={page} className="flex items-center gap-2 p-2 rounded-[20px] border cursor-pointer hover:bg-gray-50 transition-colors">
                                        <input 
                                            type="checkbox" 
                                            checked={selectedPages.includes(page)} 
                                            onChange={() => togglePage(page)}
                                            className="w-4 h-4 text-blue-600 rounded-[20px] focus:ring-blue-500"
                                        />
                                        <span className="text-xs text-gray-700">{name}</span>
                                    </label>
                                ))}
                            </div>
                            <p className="text-[10px] text-gray-500 mt-1">إذا لم يتم اختيار أي صفحة، فسيتم تطبيق الصلاحيات الافتراضية للدور.</p>
                        </div>

                        <div className="border-t pt-4">
                            <div className="flex justify-between items-center mb-2">
                                <h3 className="text-sm font-semibold text-gray-800">تخصيص العمليات المسموحة</h3>
                                {initialData && (
                                    <button 
                                        type="button" 
                                        onClick={() => {
                                            const ownedIds = db.T_OPERATION.filter(op => op.CREATED_BY === initialData.ID_USER).map(op => op.ID_OPERATION);
                                            setSelectedOperations(prev => Array.from(new Set([...prev, ...ownedIds])));
                                        }}
                                        className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded-[20px] hover:bg-blue-100 transition-colors font-bold border border-blue-200"
                                    >
                                        تحديد العمليات التي أضافها تلقائيا
                                    </button>
                                )}
                            </div>
                            <div className="max-h-60 overflow-y-auto border rounded-[20px]">
                                {db.T_OPERATION.length === 0 ? (
                                    <p className="p-3 text-xs text-gray-500 text-center">لا توجد عمليات مسجلة</p>
                                ) : (
                                    <table className="w-full text-right border-collapse">
                                        <thead className="bg-gray-100 text-[10px] font-bold text-gray-600 uppercase tracking-wider sticky top-0">
                                            <tr>
                                                <th className="px-2 py-2 border-b">إختيار</th>
                                                <th className="px-2 py-2 border-b">رقم العملية</th>
                                                <th className="px-2 py-2 border-b">صاحب العملية</th>
                                                <th className="px-2 py-2 border-b">تعيين العملية</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {db.T_OPERATION.map(op => {
                                                const creator = db.T_USER.find(u => u.ID_USER === op.CREATED_BY);
                                                return (
                                                    <tr key={op.ID_OPERATION} className="hover:bg-blue-50/30 transition-colors">
                                                        <td className="px-2 py-2 text-center">
                                                            <input 
                                                                type="checkbox" 
                                                                checked={selectedOperations.includes(op.ID_OPERATION)} 
                                                                onChange={() => toggleOperation(op.ID_OPERATION)}
                                                                className="w-4 h-4 text-blue-600 rounded-[20px] focus:ring-blue-500"
                                                            />
                                                        </td>
                                                        <td className="px-2 py-2 text-[11px] font-mono font-bold text-blue-700 whitespace-nowrap">
                                                            {op.N_OPERATION}
                                                        </td>
                                                        <td className="px-2 py-2">
                                                            {creator ? (
                                                                <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-[20px] font-bold">
                                                                    {creator.USERNAME}
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] text-gray-400">---</span>
                                                            )}
                                                        </td>
                                                        <td className="px-2 py-2 text-[10px] text-gray-600 leading-tight">
                                                            {op.INT_OPERATION}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                            <p className="text-[10px] text-gray-500 mt-1">إذا لم يتم اختيار أي عملية، فسيتمكن المستخدم من رؤية جميع العمليات (حسب دوره).</p>
                        </div>
                    </>
                )}
            </div>
        </form>
    );
};

export default AddUserForm;
