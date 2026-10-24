
import React, { useMemo } from 'react';
import { Page, User } from '../types';
import { useData } from '../context/DataContext';
import PageWrapper from '../components/PageWrapper';
import { formatCurrency } from '../utils/currencyUtils';

interface UnregisteredDocumentsPageProps {
    navigate: (page: Page, id?: number, tab?: string) => void;
    onGoBack?: () => void;
    currentUser: User;
}

const UnregisteredDocumentsPage: React.FC<UnregisteredDocumentsPageProps> = ({ navigate, onGoBack, currentUser }) => {
    const { db, loading } = useData();

    // Documents in T_PIECE not yet in T_ENGAGEMENT
    const unregisteredForCommitment = useMemo(() => {
        if (loading) return [];
        // (الصفقات، الاتفاقيات، الملاحق، الفواتير، المقررات، القرارات)
        const commitmentTypes = ['صفقة', 'اتفاقية', 'ملحق', 'فاتورة', 'مقرر', 'قرار'];
        
        let pieces = db.T_PIECE;
        if (currentUser.ROLE !== 'admin' && currentUser.ALLOWED_OPERATIONS) {
            try {
                const allowedOps = JSON.parse(currentUser.ALLOWED_OPERATIONS) as number[];
                if (allowedOps.length > 0) {
                    pieces = pieces.filter(p => allowedOps.includes(p.ID_OPERATION));
                }
            } catch (e) {
                console.error("Error parsing allowed operations", e);
            }
        }

        return pieces
            .filter(piece => {
                const isCorrectType = commitmentTypes.some(type => piece.NAT_PIECE === type);
                // الفلترة تكون : IF PIECE.SAI_ENG = FALSE
                const notInCommitments = !piece.SAI_ENG;
                return isCorrectType && notInCommitments;
            })
            .map(piece => {
                const op = db.T_OPERATION.find(o => o.ID_OPERATION === piece.ID_OPERATION);
                const beneficiaire = piece.ID_BENEFICIAIRE ? db.T_BENEFICIAIRE.find(b => b.ID_BENEFICIAIRE === piece.ID_BENEFICIAIRE) : null;
                
                // Cost Structure (هيكلة الكلفة) -> Use RUBRIQUE table
                const rubrique = piece.ID_RUBRIQUE ? db.T_RUBRIQUE.find(r => r.ID_RUBRIQUE === piece.ID_RUBRIQUE) : null;
                const structure = rubrique ? rubrique.RUBRIQUE : '---';

                // Document Formatting (الوثيقة)
                const docDesc = `${piece.PIECE || '---'}${piece.DATE_DEPOT_PIECE ? ` بتاريخ: ${piece.DATE_DEPOT_PIECE}` : ''}`;

                return {
                    id: piece.ID_PIECE,
                    opNumber: op ? op.N_OPERATION : '',
                    opTitle: op ? op.INT_OPERATION : '',
                    document: docDesc,
                    beneficiary: beneficiaire ? beneficiaire.BENEFICIAIRE : '---',
                    amount: piece.MONTANT_PIECE,
                    structure: structure,
                    operationId: piece.ID_OPERATION
                };
            });
    }, [db, loading, currentUser.ROLE, currentUser.ALLOWED_OPERATIONS]);

    // Documents in T_PIECE not yet in T_PAIEMENT
    const unregisteredForPayment = useMemo(() => {
        if (loading) return [];
        // (وضعية الأشغال، الفواتير، القرارات)
        const paymentTypes = ['وضعية الأشغال', 'فاتورة', 'قرار'];

        let pieces = db.T_PIECE;
        if (currentUser.ROLE !== 'admin' && currentUser.ALLOWED_OPERATIONS) {
            try {
                const allowedOps = JSON.parse(currentUser.ALLOWED_OPERATIONS) as number[];
                if (allowedOps.length > 0) {
                    pieces = pieces.filter(p => allowedOps.includes(p.ID_OPERATION));
                }
            } catch (e) {
                console.error("Error parsing allowed operations", e);
            }
        }

        return pieces
            .filter(piece => {
                // الفلترة حسب النوع
                const isCorrectType = paymentTypes.some(type => piece.NAT_PIECE === type);
                if (!isCorrectType) return false;

                // استثناء قرار الفسخ لأنه غير معني بالدفع
                if (piece.NAT_PIECE === 'قرار' && piece.PIECE?.includes('فسخ')) return false;
                if (piece.NAT_PIECE.includes('فسخ')) return false;

                // الفلترة حسب الحالة المنطقية
                if (piece.NAT_PIECE === 'فاتورة') {
                    // بالنسبة الى فاتورة: غير مسجلة في الدفع (SAI_PAI = FALSE)
                    return !piece.SAI_PAI;
                } else if (piece.NAT_PIECE === 'وضعية الأشغال') {
                    // بالنسبة الى وضعية الأشغال IF PIECE.SAI_ENG = FALSE AND PIECE.SAI_PAI= FALSE
                    return !piece.SAI_ENG && !piece.SAI_PAI;
                } else {
                    // للوثائق الأخرى مثل القرارات
                    return !piece.SAI_PAI;
                }
            })
            .map(piece => {
                const op = db.T_OPERATION.find(o => o.ID_OPERATION === piece.ID_OPERATION);
                const beneficiaire = piece.ID_BENEFICIAIRE ? db.T_BENEFICIAIRE.find(b => b.ID_BENEFICIAIRE === piece.ID_BENEFICIAIRE) : null;
                
                const rubrique = piece.ID_RUBRIQUE ? db.T_RUBRIQUE.find(r => r.ID_RUBRIQUE === piece.ID_RUBRIQUE) : null;
                const structure = rubrique ? rubrique.RUBRIQUE : '---';

                const docDesc = `${piece.PIECE || '---'}${piece.DATE_DEPOT_PIECE ? ` بتاريخ: ${piece.DATE_DEPOT_PIECE}` : ''}`;

                return {
                    id: piece.ID_PIECE,
                    opNumber: op ? op.N_OPERATION : '',
                    opTitle: op ? op.INT_OPERATION : '',
                    document: docDesc,
                    beneficiary: beneficiaire ? beneficiaire.BENEFICIAIRE : '---',
                    amount: piece.MONTANT_PIECE,
                    structure: structure,
                    operationId: piece.ID_OPERATION
                };
            });
    }, [db, loading, currentUser.ROLE, currentUser.ALLOWED_OPERATIONS]);

    if (loading) return <div className="p-8 text-center">جارٍ التحميل...</div>;

    return (
        <PageWrapper
            title="الوثائق غير المسجلة"
            navigate={navigate}
            onGoBack={onGoBack}
            backPage="FINANCIAL_STATUS"
            currentUser={currentUser}
        >
            <div className="space-y-12">
                {/* القسم الأول: وثائق خاصة بالالتزام */}
                <div className="bg-white rounded-xl shadow-sm border border-amber-200 overflow-hidden">
                    <div className="bg-amber-50 p-5 border-b border-amber-200 text-right">
                        <h2 className="text-xl font-bold text-amber-900 flex items-center">
                            <i className="bi bi-file-earmark-plus-fill ml-3 text-amber-600"></i>
                            أولاً: وثائق مسجلة لم تدرج في جدول الالتزامات
                        </h2>
                        <p className="text-sm text-amber-700 mt-2 font-medium opacity-80">تشمل: الصفقات، الاتفاقيات، الملاحق، الفواتير، المقررات، القرارات...</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-right border-collapse">
                            <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                                <tr>
                                    <th className="p-4 border-b font-bold w-12 text-center">الرقم</th>
                                    <th className="p-4 border-b font-bold w-1/4 text-center">رقم و عنوان العملية</th>
                                    <th className="p-4 border-b font-bold text-center">الوثيقة</th>
                                    <th className="p-4 border-b font-bold text-center">المستفيد</th>
                                    <th className="p-4 border-b font-bold text-center">المبلغ</th>
                                    <th className="p-4 border-b font-bold text-center">هيكلة الكلفة</th>
                                    <th className="p-4 border-b font-bold text-center">الإجراء</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {unregisteredForCommitment.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-12 text-center text-gray-400 italic bg-gray-50/50 text-lg">كل الوثائق مدرجة في جدول الالتزامات.</td>
                                    </tr>
                                ) : (
                                    unregisteredForCommitment.map((item, index) => (
                                        <tr key={item.id} className="hover:bg-amber-50/30 transition-colors">
                                            <td className="p-4 text-center font-bold text-gray-400">{index + 1}</td>
                                            <td className="p-4">
                                                <div className="text-xs font-bold text-blue-900 mb-1">{item.opNumber}</div>
                                                <div className="text-[10px] text-gray-600 leading-tight">{item.opTitle}</div>
                                            </td>
                                            <td className="p-4 text-sm font-semibold text-gray-800">{item.document}</td>
                                            <td className="p-4 text-sm text-gray-700">{item.beneficiary}</td>
                                            <td className="p-4 text-sm font-black text-amber-700 whitespace-nowrap">{formatCurrency(item.amount)}</td>
                                            <td className="p-4">
                                                <span className="px-2 py-1 bg-gray-100 text-gray-600 text-[10px] rounded-full font-medium">{item.structure}</span>
                                            </td>
                                            <td className="p-4 text-center">
                                                <div className="flex flex-col gap-2">
                                                    <button 
                                                        onClick={() => navigate('DOCUMENTS', item.operationId, String(item.id))}
                                                        className="bg-white border border-amber-300 text-amber-700 hover:bg-amber-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center"
                                                    >
                                                        <i className="bi bi-search ml-1"></i> فحص
                                                    </button>
                                                    <button 
                                                        onClick={() => navigate('OPERATION_DETAILS', item.operationId, `ENGAGEMENTS:0:blue:DIRECT_CREATE:${item.id}`)}
                                                        className="bg-amber-600 text-white hover:bg-amber-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center"
                                                    >
                                                        <i className="bi bi-plus-lg ml-1"></i> التزام جديد
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* القسم الثاني: وثائق خاصة بالدفع */}
                <div className="bg-white rounded-xl shadow-sm border border-indigo-200 overflow-hidden">
                    <div className="bg-indigo-50 p-5 border-b border-indigo-200 text-right">
                        <h2 className="text-xl font-bold text-indigo-900 flex items-center">
                            <i className="bi bi-wallet2 ml-3 text-indigo-600"></i>
                            ثانياً: وثائق مسجلة لم تدرج في جدول الدفعات
                        </h2>
                        <p className="text-sm text-indigo-700 mt-2 font-medium opacity-80">تشمل: وضعيات الأشغال، الفواتير، القرارات، الكشوفات...</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-right border-collapse">
                            <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                                <tr>
                                    <th className="p-4 border-b font-bold w-12 text-center">الرقم</th>
                                    <th className="p-4 border-b font-bold w-1/4 text-center">رقم و عنوان العملية</th>
                                    <th className="p-4 border-b font-bold text-center">الوثيقة</th>
                                    <th className="p-4 border-b font-bold text-center">المستفيد</th>
                                    <th className="p-4 border-b font-bold text-center">المبلغ</th>
                                    <th className="p-4 border-b font-bold text-center">هيكلة الكلفة</th>
                                    <th className="p-4 border-b font-bold text-center">الإجراء</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {unregisteredForPayment.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-12 text-center text-gray-400 italic bg-gray-50/50 text-lg">كل الوثائق مدرجة في جدول الدفعات.</td>
                                    </tr>
                                ) : (
                                    unregisteredForPayment.map((item, index) => (
                                        <tr key={item.id} className="hover:bg-indigo-50/30 transition-colors">
                                            <td className="p-4 text-center font-bold text-gray-400">{index + 1}</td>
                                            <td className="p-4">
                                                <div className="text-xs font-bold text-indigo-900 mb-1">{item.opNumber}</div>
                                                <div className="text-[10px] text-gray-600 leading-tight">{item.opTitle}</div>
                                            </td>
                                            <td className="p-4 text-sm font-semibold text-gray-800">{item.document}</td>
                                            <td className="p-4 text-sm text-gray-700">{item.beneficiary}</td>
                                            <td className="p-4 text-sm font-black text-indigo-700 whitespace-nowrap">{formatCurrency(item.amount)}</td>
                                            <td className="p-4">
                                                <span className="px-2 py-1 bg-gray-100 text-gray-600 text-[10px] rounded-full font-medium">{item.structure}</span>
                                            </td>
                                            <td className="p-4 text-center">
                                                <div className="flex flex-col gap-2">
                                                    <button 
                                                        onClick={() => navigate('DOCUMENTS', item.operationId, String(item.id))}
                                                        className="bg-white border border-indigo-300 text-indigo-700 hover:bg-indigo-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center"
                                                    >
                                                        <i className="bi bi-search ml-1"></i> فحص
                                                    </button>
                                                    <button 
                                                        onClick={() => navigate('OPERATION_DETAILS', item.operationId, `PAIEMENTS:0:blue:DIRECT_CREATE:${item.id}`)}
                                                        className="bg-indigo-600 text-white hover:bg-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center"
                                                    >
                                                        <i className="bi bi-plus-lg ml-1"></i> دفع جديد
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </PageWrapper>
    );
};

export default UnregisteredDocumentsPage;
