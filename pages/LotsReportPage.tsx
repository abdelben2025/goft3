
import React, { useMemo } from 'react';
import PageWrapper from '../components/PageWrapper';
import { useData } from '../context/DataContext';
import { Page, User } from '../types';
import { formatCurrency } from '../utils/currencyUtils';
import { exportToFormattedExcel } from '../utils/exportToCsv';

interface LotsReportPageProps {
    navigate: (page: Page, id?: number, tab?: string) => void;
    currentUser: User;
    onGoBack?: () => void;
}

const LotsReportPage: React.FC<LotsReportPageProps> = ({ navigate, currentUser, onGoBack }) => {
    const { db, loading } = useData();
    const [searchTerm, setSearchTerm] = React.useState('');

    const lotsData = useMemo(() => {
        if (loading) return [];

        // Filter operations user is allowed to see
        let allowedOps = db.T_OPERATION;
        if (currentUser.ROLE !== 'admin' && currentUser.ALLOWED_OPERATIONS) {
            try {
                const allowedIds = JSON.parse(currentUser.ALLOWED_OPERATIONS) as number[];
                if (allowedIds.length > 0) {
                    allowedOps = allowedOps.filter(op => allowedIds.includes(op.ID_OPERATION));
                }
            } catch (e) {
                console.error("Error parsing allowed operations", e);
            }
        }

        const allowedOpIds = new Set(allowedOps.map(op => op.ID_OPERATION));

        const data = db.T_LOT_OPERATION
            .filter(lot => allowedOpIds.has(lot.ID_OPERATION))
            .map(lot => {
                const operation = db.T_OPERATION.find(op => op.ID_OPERATION === lot.ID_OPERATION);
                
                // Find beneficiary name
                // First find any piece associated with this lot
                const lotPiece = db.T_LOT_PIECE.find(lp => lp.ID_LOT === lot.ID_LOT);
                let beneficiaryName = '---';
                if (lotPiece) {
                    const piece = db.T_PIECE.find(p => p.ID_PIECE === lotPiece.ID_PIECE);
                    if (piece && piece.ID_BENEFICIAIRE) {
                        const ben = db.T_BENEFICIAIRE.find(b => b.ID_BENEFICIAIRE === piece.ID_BENEFICIAIRE);
                        if (ben) {
                            beneficiaryName = ben.BENEFICIAIRE;
                        }
                    }
                }

                return {
                    ...lot,
                    operationName: operation ? `${operation.N_OPERATION} - ${operation.INT_OPERATION}` : '---',
                    beneficiaryName
                };
            });

        // Search filter
        if (!searchTerm) return data;
        
        const term = searchTerm.toLowerCase();
        return data.filter(lot => 
            lot.N_LOT?.toString().toLowerCase().includes(term) || 
            lot.INTITULE_LOT?.toLowerCase().includes(term)
        );
    }, [db, loading, currentUser, searchTerm]);

    const handlePrint = () => {
        window.print();
    };

    const handleExportExcel = () => {
        const tableHtml = `
            <table border="1">
                <thead>
                    <tr style="background-color: #f3f4f6;">
                        <th>الرقم</th>
                        <th>رقم وعينة الحصة</th>
                        <th>المبلغ النهائي</th>
                        <th>المستفيد</th>
                        <th>رقم وعنوان العملية</th>
                    </tr>
                </thead>
                <tbody>
                    ${lotsData.map((lot, index) => `
                        <tr>
                            <td>${index + 1}</td>
                            <td>${lot.N_LOT} - ${lot.INTITULE_LOT}</td>
                            <td>${lot.MONTANT_FINALE_LOT.toFixed(2)}</td>
                            <td>${lot.beneficiaryName}</td>
                            <td>${lot.operationName}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        exportToFormattedExcel(tableHtml, 'تقرير_الحصص');
    };

    return (
        <PageWrapper
            title="جدول الحصص لكل العمليات"
            navigate={navigate}
            onGoBack={onGoBack}
            className="bg-white"
        >
            <div className="p-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 no-print gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">قائمة الحصص المفصلة</h2>
                        <div className="relative mt-3 w-full md:w-80">
                            <i className="bi bi-search absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                            <input
                                type="text"
                                placeholder="بحث برقم أو عنوان الحصة..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pr-10 pl-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-sm normal-case"
                            />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleExportExcel}
                            className="bg-emerald-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-emerald-700 transition-colors"
                        >
                            <i className="bi bi-file-earmark-excel"></i>
                            تصدير Excel
                        </button>
                        <button
                            onClick={handlePrint}
                            className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700 transition-colors"
                        >
                            <i className="bi bi-printer"></i>
                            طباعة
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto border rounded-xl">
                    <table className="w-full text-right border-collapse">
                        <thead className="bg-gray-50 text-gray-600 border-b">
                            <tr>
                                <th className="p-3 text-sm font-bold w-16">#</th>
                                <th className="p-3 text-sm font-bold">رقم وعينة الحصة</th>
                                <th className="p-3 text-sm font-bold">المبلغ النهائي</th>
                                <th className="p-3 text-sm font-bold">المستفيد</th>
                                <th className="p-3 text-sm font-bold">رقم وعنوان العملية</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {lotsData.map((lot, index) => (
                                <tr key={lot.ID_LOT} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-3 text-sm text-gray-500 font-mono">{index + 1}</td>
                                    <td className="p-3 text-sm text-gray-800 font-bold">
                                        <div className="text-blue-600 text-[10px] mb-0.5">الحصة رقم {lot.N_LOT}</div>
                                        {lot.INTITULE_LOT}
                                    </td>
                                    <td className="p-3 text-sm text-gray-800 font-bold font-mono">
                                        {formatCurrency(lot.MONTANT_FINALE_LOT)}
                                    </td>
                                    <td className="p-3 text-sm text-gray-700">
                                        {lot.beneficiaryName}
                                    </td>
                                    <td className="p-3 text-sm text-gray-600">
                                        {lot.operationName}
                                    </td>
                                </tr>
                            ))}
                            {lotsData.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-gray-500 italic">
                                        لا توجد حصص مسجلة حالياً
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                
                <div className="mt-8 pt-8 border-t hidden print:block">
                    <div className="flex justify-between text-sm text-gray-500">
                        <span>تم الاستخراج بتاريخ: {new Date().toLocaleDateString('ar-DZ')}</span>
                        <span>صفحة 1 من 1</span>
                    </div>
                </div>
            </div>
        </PageWrapper>
    );
};

export default LotsReportPage;
