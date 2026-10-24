
import React, { useState, useMemo } from 'react';
import { Page, User } from '../types';
import { useData } from '../context/DataContext';
import PageWrapper from '../components/PageWrapper';
import { exportToFormattedExcel } from '../utils/exportToCsv';
import { formatCurrency } from '../utils/currencyUtils';
import CustomDropdown from '../components/CustomDropdown';

interface PaymentClaimsPageProps {
    navigate: (page: Page, operationId?: number) => void;
    onGoBack?: () => void;
    currentUser: User;
}

const formatCurrencyForExcel = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return '0,00';
    return new Intl.NumberFormat('ar-DZ', {
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
};

const PaymentClaimsPage: React.FC<PaymentClaimsPageProps> = ({ navigate, onGoBack, currentUser }) => {
    const { db, loading } = useData();
    const [selectedOperationId, setSelectedOperationId] = useState<string>('');
    const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());

    // Filter data: Pieces that are payable BUT NOT in T_PAIEMENT
    // AND where Piece Amount > Remaining CP for that operation in the selected year
    const claimsData = useMemo(() => {
        if (loading) return [];

        const normalizeId = (val: any): number => {
            if (val === null || val === undefined) return -1;
            const n = Number(val);
            return isNaN(n) ? -1 : n;
        };

        const paidPieceIds = new Set(db.T_PAIEMENT.map(p => normalizeId(p.ID_PIECE)).filter(id => id !== -1));
        const payableTypes = ['فاتورة', 'وضعية الأشغال', 'وضعية التسبيق الجزافي', 'وضعية التسبيق على التموين'];

        // 1. Find Unpaid Pieces
        const unpaidPieces = db.T_PIECE.filter(p => {
            const pId = normalizeId(p.ID_PIECE);
            return payableTypes.includes(p.NAT_PIECE) && 
                   !paidPieceIds.has(pId);
        });

        // 2. Filter by Operation if selected
        let baseItems = unpaidPieces;
        if (currentUser.ROLE !== 'admin' && currentUser.ALLOWED_OPERATIONS) {
            try {
                const allowedOps = JSON.parse(currentUser.ALLOWED_OPERATIONS) as number[];
                if (allowedOps.length > 0) {
                    baseItems = baseItems.filter(p => allowedOps.includes(normalizeId(p.ID_OPERATION)));
                }
            } catch (e) {
                console.error("Error parsing allowed operations", e);
            }
        }

        const piecesFilteredByOp = selectedOperationId 
            ? baseItems.filter(p => normalizeId(p.ID_OPERATION) === parseInt(selectedOperationId))
            : baseItems;

        // Group payments by operation and year once
        const opYearCPConsumedMap = new Map<string, number>();
        db.T_PAIEMENT.forEach(p => {
            const key = `${normalizeId(p.ID_OPERATION)}-${p.ANNEE}`;
            opYearCPConsumedMap.set(key, (opYearCPConsumedMap.get(key) || 0) + (p.MONTANT_PAI || 0));
        });

        // 3. Apply Insufficiency Logic: Amount > Remaining CP (for selected year)
        const insufficientCpPieces = piecesFilteredByOp.filter(piece => {
            const opIdNormalized = normalizeId(piece.ID_OPERATION);

            // Find CP for this operation and the selected year
            const cp = db.T_CP.find(c => 
                normalizeId(c.ID_OPERATION) === opIdNormalized && 
                c.ANNEE === selectedYear
            );

            // If no CP allocated for this year, then balance is 0, so any amount is insufficient
            if (!cp) return piece.MONTANT_PIECE > 0;

            const totalCP = cp.MONTANT_FINALE_CP || 0;
            const consumedCP = opYearCPConsumedMap.get(`${opIdNormalized}-${selectedYear}`) || 0;
            const remainingCP = totalCP - consumedCP;

            // Check if document amount exceeds remaining payment credit
            return piece.MONTANT_PIECE > remainingCP;
        });

        // Map to display format
        return insufficientCpPieces.map((piece, index) => {
            const operation = db.T_OPERATION.find(op => normalizeId(op.ID_OPERATION) === normalizeId(piece.ID_OPERATION));
            const beneficiary = db.T_BENEFICIAIRE.find(b => normalizeId(b.ID_BENEFICIAIRE) === normalizeId(piece.ID_BENEFICIAIRE));
            
            return {
                id: piece.ID_PIECE,
                serial: index + 1,
                operationName: operation ? operation.INT_OPERATION : '---',
                documentType: piece.NAT_PIECE,
                documentName: piece.PIECE,
                beneficiaryName: beneficiary ? beneficiary.BENEFICIAIRE : '---',
                amount: piece.MONTANT_PIECE
            };
        });

    }, [db, loading, selectedOperationId, selectedYear]);

    const totalAmount = useMemo(() => claimsData.reduce((sum, item) => sum + item.amount, 0), [claimsData]);

    const handleExport = () => {
        if (claimsData.length === 0) {
            alert('لا توجد بيانات للتصدير.');
            return;
        }

        const headers = ['الرقم التسلسلي', 'العملية', 'الوثيقة', 'المستفيد', 'المبلغ'];
        const styles = `<style> table, th, td { border: 1px solid black; border-collapse: collapse; text-align: right; padding: 5px; font-family: Arial, sans-serif; vertical-align: middle; } th { background-color: #DDEBF7; font-weight: bold; text-align: center; } .total { background-color: #A9D08E; font-weight: bold; } td { mso-number-format:"\\@"; } .currency { mso-number-format:"\\#\\,##0\\.00"; } </style>`;
        
        let tableHtml = `${styles}<table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>`;

        claimsData.forEach(row => {
            tableHtml += `<tr>
                <td>${row.serial}</td>
                <td>${row.operationName}</td>
                <td>${row.documentName} (${row.documentType})</td>
                <td>${row.beneficiaryName}</td>
                <td class="currency">${formatCurrencyForExcel(row.amount)}</td>
            </tr>`;
        });

        tableHtml += `</tbody><tfoot><tr class="total">
            <td colspan="4" style="text-align:center;">المجموع</td>
            <td class="currency">${formatCurrencyForExcel(totalAmount)}</td>
        </tr></tfoot></table>`;

        exportToFormattedExcel(tableHtml, 'payment_claims_insufficiency.xls');
    };

    const operationOptions = useMemo(() => {
        let ops = db.T_OPERATION;
        if (currentUser.ROLE !== 'admin' && currentUser.ALLOWED_OPERATIONS) {
            try {
                const allowedOps = JSON.parse(currentUser.ALLOWED_OPERATIONS) as number[];
                if (allowedOps.length > 0) {
                    ops = ops.filter(op => allowedOps.includes(op.ID_OPERATION));
                }
            } catch (e) {
                console.error("Error parsing allowed operations", e);
            }
        }
        return [{ value: '', label: 'كل العمليات' }, ...ops.map(op => ({ value: String(op.ID_OPERATION), label: op.INT_OPERATION }))];
    }, [db.T_OPERATION, currentUser]);

    // Available years from CP table
    const yearOptions = useMemo(() => {
        const years = new Set(db.T_CP.map(cp => cp.ANNEE));
        // Ensure current year is in list
        years.add(new Date().getFullYear().toString());
        return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a)).map(y => ({ value: y, label: y }));
    }, [db.T_CP]);

    if (loading) return <div>جار التحميل...</div>;

    return (
        <PageWrapper title="جدول مستحقات الدفع التي تفوق باقي الاعتماد (Insuffisance CP)" navigate={navigate} onGoBack={onGoBack} backPage='FINANCIAL_STATUS' currentUser={currentUser}>
            <div className="bg-blue-200 p-4 rounded-lg shadow-md mb-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="md:col-span-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">السنة المالية</label>
                        <CustomDropdown
                            options={yearOptions}
                            value={selectedYear}
                            onChange={setSelectedYear}
                            placeholder="اختر السنة"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">تصفية حسب العملية</label>
                        <CustomDropdown
                            options={operationOptions}
                            value={selectedOperationId}
                            onChange={setSelectedOperationId}
                            placeholder="اختر العملية"
                        />
                    </div>
                    <div className="flex gap-2 md:col-span-1">
                        <button onClick={() => navigate('PRINT_PAYMENT_CLAIMS', selectedOperationId ? parseInt(selectedOperationId) : 0)} className="bg-blue-500 text-white text-ms px-2 py-2 rounded-[20px] shadow hover:bg-blue-600 transition-colors w-full h-10">
                            <i className="bi bi-printer mr-2"></i> طباعة
                        </button>
                        <button onClick={handleExport} disabled={claimsData.length === 0} className="bg-teal-500 text-white px-2 py-2 rounded-[20px] shadow hover:bg-teal-600 transition-colors w-full disabled:bg-gray-400 h-10">
                            <i className="bi bi-file-earmark-excel mr-2"></i> تصدير
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow-md overflow-auto max-h-[calc(100vh-16rem)] custom-scrollbar">
                <table className="w-full text-right min-w-[900px] relative">
                    <thead className="bg-blue-100 sticky top-0 z-20 shadow-sm">
                        <tr>
                            <th className="p-3 text-sm font-semibold text-gray-700 w-[5%] bg-blue-100 sticky top-0 z-20">الرقم التسلسلي</th>
                            <th className="p-3 text-sm font-semibold text-gray-700 w-[25%] bg-blue-100 sticky top-0 z-20">العملية</th>
                            <th className="p-3 text-sm font-semibold text-gray-700 w-[40%] bg-blue-100 sticky top-0 z-20">الوثيقة (التي تفوق الاعتماد المتبقي)</th>
                            <th className="p-3 text-sm font-semibold text-gray-700 w-[15%] bg-blue-100 sticky top-0 z-20">المستفيد</th>
                            <th className="p-3 text-sm font-semibold text-gray-700 w-[15%] bg-blue-100 sticky top-0 z-20">مبلغ الوثيقة</th>
                        </tr>
                    </thead>
                    <tbody>
                        {claimsData.length > 0 ? claimsData.map((row) => (
                            <tr key={row.id} className="border-b hover:bg-gray-50 text-sm">
                                <td className="p-3 text-center font-bold">{row.serial}</td>
                                <td className="p-3 text-gray-600">{row.operationName}</td>
                                <td className="p-3 font-semibold text-gray-800">
                                    {row.documentName}
                                    <span className="text-xs text-gray-500 block font-normal">{row.documentType}</span>
                                </td>
                                <td className="p-3 text-gray-700">{row.beneficiaryName}</td>
                                <td className="p-3 font-bold text-red-600">{formatCurrency(row.amount)}</td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={5} className="p-6 text-center text-gray-500">لا توجد وثائق تفوق اعتمادات الدفع المتبقية لسنة {selectedYear}.</td>
                            </tr>
                        )}
                    </tbody>
                    <tfoot className="bg-gray-300 font-bold text-gray-800 text-sm sticky bottom-0 z-20 shadow-[0_-2px_10px_rgba(0,0,0,0.1)]">
                        <tr>
                            <td colSpan={4} className="p-3 text-center text-lg bg-gray-300">المجموع</td>
                            <td className="p-3 text-lg bg-gray-300">{formatCurrency(totalAmount)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </PageWrapper>
    );
};

export default PaymentClaimsPage;
