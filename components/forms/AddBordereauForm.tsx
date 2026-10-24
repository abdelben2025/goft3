
import React, { useState, useEffect } from 'react';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { Bordereau, Engagement } from '../../types';

interface AddBordereauFormProps {
    operationId: number;
    onClose: () => void;
    editItem?: Bordereau;
}

const AddBordereauForm: React.FC<AddBordereauFormProps> = ({ operationId, onClose, editItem }) => {
    const { db, addItem, updateItem } = useData();
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);

    const [selectedOpId, setSelectedOpId] = useState(editItem ? -1 : operationId);

    const [formData, setFormData] = useState({
        N_BORDEREAU: editItem?.N_BORDEREAU || '',
        ANNEE: editItem?.ANNEE || new Date().getFullYear().toString(),
        DATE_BORDEREAU: editItem?.DATE_BORDEREAU || new Date().toISOString().split('T')[0],
        DESTINATAIRE: editItem?.DESTINATAIRE || 'المراقب الميزانياتي لدى ولاية غليزان'
    });

    const [selectedEngagements, setSelectedEngagements] = useState<number[]>([]);
    const [engDocumentation, setEngDocumentation] = useState<{ [key: number]: { subject: string; docs: string; copies: string } }>({});

    // Helper functions for initial generation
    const getInitialDetails = (eng: Engagement) => {
        const piece = db.T_PIECE.find(p => p.ID_PIECE === eng.ID_PIECE);
        const nature = piece?.NAT_PIECE || '';
        let subject = '';
        if (nature.includes('مقرر')) subject = `التزام بـ ${nature}`;
        else if (nature.includes('صفقة')) subject = 'التزام بصفقة';
        else if (nature.includes('ملحق')) subject = 'التزام بملحق';
        else if (nature.includes('فاتورة')) subject = 'التزام بفاتورة';
        else if (nature.includes('اتفاقية')) subject = 'التزام باتفاقية';
        else subject = 'التزام بـ ' + nature;

        if (!piece) return { subject, docs: '', copies: '' };

        const beneficiary = db.T_BENEFICIAIRE.find(b => b.ID_BENEFICIAIRE === piece.ID_BENEFICIAIRE);
        const docsArr: string[] = [];
        const copiesArr: string[] = [];

        docsArr.push(`${piece.PIECE}`);
        copiesArr.push(nature.includes('مقرر') ? '01 نسخة' : '02 نسختين');

        if (beneficiary && (nature.includes('صفقة') || nature.includes('اتفاقية') || nature.includes('فاتورة') || nature.includes('ملحق'))) {
            docsArr.push(`لفائدة: ${beneficiary.BENEFICIAIRE}`);
            docsArr.push(`المبلغ: ${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(eng.MONTANT_ENG)} دج`);
            copiesArr.push(' ');
            copiesArr.push(' ');
        }

        if (nature.includes('صفقة') || nature.includes('اتفاقية') || nature.includes('ملحق')) {
            docsArr.push('تقرير تقديمي');
            copiesArr.push('01 نسخة');
            docsArr.push('مذكرة تحليلية');
            copiesArr.push('01 نسخة');
        } else if (nature.includes('فاتورة') && (nature.includes('إشهار') || nature.includes('نشر'))) {
            docsArr.push('الجرائد و BOMOP');
            copiesArr.push('01 نسخة');
        }

        return { subject, docs: docsArr.join('\n'), copies: copiesArr.join('\n') };
    };

    useEffect(() => {
        if (editItem) {
            const linkedEngs = db.T_ENGAGEMENT
                .filter(eng => eng.ID_BORDEREAU === editItem.ID_BORDEREAU);
            
            if (linkedEngs.length > 0) {
                setSelectedOpId(linkedEngs[0].ID_OPERATION);
            }

            setSelectedEngagements(linkedEngs.map(eng => eng.ID_ENGAGEMENT));
            const documentation: any = {};
            linkedEngs.forEach(eng => {
                const init = getInitialDetails(eng);
                documentation[eng.ID_ENGAGEMENT] = {
                    subject: eng.BORD_OBJET || init.subject,
                    docs: eng.BORD_DOCS || init.docs,
                    copies: eng.BORD_COPIES || init.copies
                };
            });
            setEngDocumentation(documentation);
        }
    }, [editItem, db.T_ENGAGEMENT]);

    // Available engagements: those not linked to any bordereau AND not yet visaed by CB, OR those linked to THIS bordereau (if editing)
    const availableEngagements = db.T_ENGAGEMENT.filter(eng => 
        eng.ID_OPERATION === selectedOpId && 
        (!eng.N_VISA_CB) &&
        (!eng.ID_BORDEREAU || (editItem && eng.ID_BORDEREAU === editItem.ID_BORDEREAU))
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            let bordereauId: number;
            if (editItem) {
                await updateItem('T_BORDEREAU', editItem.ID_BORDEREAU, formData);
                bordereauId = editItem.ID_BORDEREAU;
                showToast('تم تحديث جدول الإرسال بنجاح', 'success');
            } else {
                const result = await addItem('T_BORDEREAU', formData);
                bordereauId = result.ID_BORDEREAU;
                showToast('تم إضافة جدول الإرسال بنجاح', 'success');
            }

            // Update engagements links and documentation
            // 1. Unlink current engagements that are NO LONGER in selection
            const currentlyLinkedEngs = db.T_ENGAGEMENT.filter(eng => eng.ID_BORDEREAU === bordereauId);
            for (const eng of currentlyLinkedEngs) {
                if (!selectedEngagements.includes(eng.ID_ENGAGEMENT)) {
                    await updateItem('T_ENGAGEMENT', eng.ID_ENGAGEMENT, { 
                        ...eng, 
                        ID_BORDEREAU: null,
                        BORD_OBJET: '',
                        BORD_DOCS: '',
                        BORD_COPIES: ''
                    });
                }
            }

            // 2. Link selected engagements and save their documentation edits
            for (const engId of selectedEngagements) {
                const eng = db.T_ENGAGEMENT.find(e => e.ID_ENGAGEMENT === engId);
                const doc = engDocumentation[engId];
                if (eng) {
                    await updateItem('T_ENGAGEMENT', engId, { 
                        ...eng, 
                        ID_BORDEREAU: bordereauId,
                        BORD_OBJET: doc?.subject || '',
                        BORD_DOCS: doc?.docs || '',
                        BORD_COPIES: doc?.copies || ''
                    });
                }
            }

            onClose();
        } catch (error) {
            console.error(error);
            showToast('حدث خطأ أثناء الحفظ', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectEngagement = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = parseInt(e.target.value);
        if (id && !selectedEngagements.includes(id)) {
            setSelectedEngagements([...selectedEngagements, id]);
            
            const eng = db.T_ENGAGEMENT.find(e => e.ID_ENGAGEMENT === id);
            if (eng) {
                const init = getInitialDetails(eng);
                setEngDocumentation(prev => ({
                    ...prev,
                    [id]: init
                }));
            }
        }
        e.target.value = "";
    };

    const removeEngagement = (id: number) => {
        setSelectedEngagements(selectedEngagements.filter(i => i !== id));
        setEngDocumentation(prev => {
            const next = { ...prev };
            delete next[id];
            return next;
        });
    };

    const handleEngEdit = (id: number, field: 'docs' | 'copies' | 'subject', value: string) => {
        setEngDocumentation(prev => ({
            ...prev,
            [id]: {
                ...prev[id],
                [field]: value
            }
        }));
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col max-h-[85vh]">
            <div className="sticky top-0 bg-white z-10 pb-2 border-b border-gray-200 flex justify-end gap-3 pt-1 mb-2">
                <button type="button" onClick={onClose} className="px-5 py-1.5 bg-gray-200 text-gray-800 rounded-[20px] hover:bg-gray-300 transition-colors text-sm">إلغاء</button>
                <button type="submit" disabled={loading} className="px-5 py-1.5 bg-blue-600 text-white rounded-[20px] hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed text-sm">
                    {loading ? 'جاري الحفظ...' : (editItem ? 'تحديث' : 'إضافة')}
                </button>
            </div>
            <div className="space-y-3 overflow-y-auto p-1 text-right">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">العملية</label>
                    <select
                        required
                        className="w-full h-9 px-1 py-1 text-xs text-center p-2 border rounded-[20px] focus:ring-2 focus:ring-blue-500 bg-gray-50"
                        value={selectedOpId === -1 ? '' : selectedOpId}
                        onChange={(e) => setSelectedOpId(parseInt(e.target.value))}
                    >
                        <option value="" disabled>-- إختر العملية --</option>
                        {db.T_OPERATION.map(op => (
                            <option key={op.ID_OPERATION} value={op.ID_OPERATION}>
                                {op.N_OPERATION}
                            </option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">رقم جدول الإرسال</label>
                    <input
                        type="text"
                        className="w-full h-9 p-2 text-center border rounded-[20px] focus:ring-2 focus:ring-blue-500"
                        value={formData.N_BORDEREAU}
                        onChange={e => setFormData({ ...formData, N_BORDEREAU: e.target.value })}
                        placeholder="اختياري"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">السنة</label>
                    <input
                        type="text"
                        required
                        className="w-full h-9 p-2 text-center border rounded-[20px] focus:ring-2 focus:ring-blue-500"
                        value={formData.ANNEE}
                        onChange={e => setFormData({ ...formData, ANNEE: e.target.value })}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">التاريخ</label>
                    <input
                        type="date"
                        className="w-full h-9 text-center p-2 border rounded-[20px] focus:ring-2 focus:ring-blue-500"
                        value={formData.DATE_BORDEREAU}
                        onChange={e => setFormData({ ...formData, DATE_BORDEREAU: e.target.value })}
                    />
                </div>
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">المرسل إليه</label>
                    <input
                        type="text"
                        required
                        className="w-full h-9 p-2 border rounded-[20px] focus:ring-2 focus:ring-blue-500"
                        value={formData.DESTINATAIRE}
                        onChange={e => setFormData({ ...formData, DESTINATAIRE: e.target.value })}
                    />
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اختر الالتزامات المرفقة</label>
                <select 
                    className="w-full h-9 p-2 px-1 py-1 text-xs text-center border rounded-[20px] focus:ring-2 focus:ring-blue-500"
                    onChange={handleSelectEngagement}
                    defaultValue=""
                >
                    <option value="" disabled>-- اضغط لإضافة التزام (الوثائق الغير ملتزم بها) --</option>
                    {availableEngagements.filter(eng => !selectedEngagements.includes(eng.ID_ENGAGEMENT)).map(eng => {
                        const pieceName = db.T_PIECE.find(p => p.ID_PIECE === eng.ID_PIECE)?.PIECE || '';
                        return (
                            <option key={eng.ID_ENGAGEMENT} value={eng.ID_ENGAGEMENT}>
                                بطاقة رقم {eng.N_ENG}/{eng.ANNEE} - {pieceName.substring(0, 50)}
                            </option>
                        )
                    })}
                </select>
            </div>

            <div className="overflow-x-auto mt-4 border rounded-[20px]">
                    <table className="w-full h-9 text-center border-collapse">
                        <thead className="text-xs">
                            <tr className="bg-blue-600 text-white">
                            <th className="border border-gray-300 p-2 w-24">رقم البطاقة</th>
                            <th className="border border-gray-300 p-2 w-24">الصنف</th>
                            <th className="border border-gray-300 p-2">موضوع الالتزام</th>
                            <th className="border border-gray-300 p-2 w-[40%]">الوثائق المرفقة</th>
                            <th className="border border-gray-300 p-2 w-32">ملاحظة</th>
                            <th className="border border-gray-300 p-2 w-10">/</th>
                        </tr>
                    </thead>
                    <tbody className="text-xs">
                        {selectedEngagements.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="p-4 text-center text-gray-500 italic">برجاء اختيار الالتزامات أعلاه</td>
                            </tr>
                        ) : selectedEngagements.map(engId => {
                            const eng = db.T_ENGAGEMENT.find(e => e.ID_ENGAGEMENT === engId);
                            if (!eng) return null;
                            const piece = db.T_PIECE.find(p => p.ID_PIECE === eng.ID_PIECE);
                            const scat = db.T_SCATEGORIE.find(s => s.ID_SCATEGORIE === piece?.ID_SCATEGORIE);
                            const doc = engDocumentation[engId] || { docs: '', copies: '' };
                            
                            return (
                                <tr key={engId} className="hover:bg-gray-50">
                                    <td className="border border-gray-300 p-2 text-center font-bold">{eng.N_ENG}/{eng.ANNEE}</td>
                                    <td className="border border-gray-300 p-2 text-center">{scat?.C_SCATEGORIE || '---'}</td>
                                    <td className="border border-gray-300 p-1">
                                        <textarea
                                            className="w-full p-1 text-xs border-none focus:ring-0 resize-none h-20"
                                            value={doc.subject}
                                            onChange={e => handleEngEdit(engId, 'subject', e.target.value)}
                                        />
                                    </td>
                                    <td className="border border-gray-300 p-1">
                                        <textarea
                                            className="w-full p-1 text-xs border-none focus:ring-0 resize-none h-20"
                                            value={doc.docs}
                                            onChange={e => handleEngEdit(engId, 'docs', e.target.value)}
                                        />
                                    </td>
                                    <td className="border border-gray-300 p-1">
                                        <textarea
                                            className="w-full p-1 text-xs border-none focus:ring-0 resize-none h-20"
                                            value={doc.copies}
                                            onChange={e => handleEngEdit(engId, 'copies', e.target.value)}
                                        />
                                    </td>
                                    <td className="border border-gray-300 p-2 text-center">
                                        <button 
                                            type="button" 
                                            onClick={() => removeEngagement(engId)}
                                            className="text-red-500 hover:text-red-700"
                                        >
                                            <i className="bi bi-trash"></i>
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            </div>
        </form>
    );
};

export default AddBordereauForm;
