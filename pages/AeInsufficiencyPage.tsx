
import React, { useState, useMemo } from 'react';
import { Page, User } from '../types';
import { useData } from '../context/DataContext';
import PageWrapper from '../components/PageWrapper';
import { exportToFormattedExcel } from '../utils/exportToCsv';
import { formatCurrency } from '../utils/currencyUtils';
import CustomDropdown from '../components/CustomDropdown';

interface AeInsufficiencyPageProps {
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

const AeInsufficiencyPage: React.FC<AeInsufficiencyPageProps> = ({ navigate, onGoBack, currentUser }) => {
    const { db, loading } = useData();
    const [selectedOperationId, setSelectedOperationId] = useState<string>('');

    // Filter data: Pieces that are commitments (Contract/Convention/Addendum/Invoice) BUT NOT in T_ENGAGEMENT
    // AND where Piece Amount > Remaining AE for that Rubrique
    const insufficientData = useMemo(() => {
        if (loading) return [];

        const normalizeId = (val: any): number => {
            if (val === null || val === undefined) return -1;
            const n = Number(val);
            return isNaN(n) ? -1 : n;
        };

        const committedPieceIds = new Set(db.T_ENGAGEMENT.map(e => normalizeId(e.ID_PIECE)).filter(id => id !== -1));
        const commitmentTypes = ['صفقة', 'اتفاقية', 'ملحق', 'فاتورة'];

        // 1. Find Uncommitted Pieces
        const uncommittedPieces = db.T_PIECE.filter(p => {
            const pId = normalizeId(p.ID_PIECE);
            return commitmentTypes.includes(p.NAT_PIECE) && 
                   !committedPieceIds.has(pId);
        });

        // 2. Filter by Operation if selected
        let baseItems = uncommittedPieces;
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

        // Group engagements by Operation and Rubric once for efficiency
        const rubOpAEConsumedMap = new Map<string, number>();
        db.T_ENGAGEMENT.forEach(eng => {
            const piece = db.T_PIECE.find(p => normalizeId(p.ID_PIECE) === normalizeId(eng.ID_PIECE));
            if (!piece || !piece.ID_RUBRIQUE) return;
            
            const key = `${normalizeId(eng.ID_OPERATION)}-${normalizeId(piece.ID_RUBRIQUE)}`;
            let amount = eng.MONTANT_ENG || 0;
            if (eng.NATURE_ENG === 'سحب' || eng.NATURE_ENG === 'إنخفاض التقييم') {
                amount = -amount;
            }
            rubOpAEConsumedMap.set(key, (rubOpAEConsumedMap.get(key) || 0) + amount);
        });

        // 3. Apply Insufficiency Logic: Amount > Remaining AE
        const insufficientPieces = piecesFilteredByOp.filter(piece => {
            // Must have a rubric to calculate specific AE balance
            if (!piece.ID_RUBRIQUE) return false;

            const opIdNormalized = normalizeId(piece.ID_OPERATION);
            const rubIdNormalized = normalizeId(piece.ID_RUBRIQUE);

            const rubOp = db.T_RUBRIQUE_OP.find(ro => 
                normalizeId(ro.ID_OPERATION) === opIdNormalized && 
                normalizeId(ro.ID_RUBRIQUE) === rubIdNormalized
            );

            // If no rubric allocated, balance is 0, so any amount is insufficient
            if (!rubOp) return true;

            const totalAllocatedAE = rubOp.MONTANT_FINALE ?? rubOp.MONTANT_INITIALE ?? 0;
            const consumedAE = rubOpAEConsumedMap.get(`${opIdNormalized}-${rubIdNormalized}`) || 0;
            const remainingAE = totalAllocatedAE - consumedAE;

            // Only show if Piece Amount > Remaining Balance
            return piece.MONTANT_PIECE > remainingAE;
        });

        // Map to display format
        return insufficientPieces.map((piece, index) => {
            const operation = db.T_OPERATION.find(op => normalizeId(op.ID_OPERATION) === normalizeId(piece.ID_OPERATION));
            const rubrique = db.T_RUBRIQUE.find(r => normalizeId(r.ID_RUBRIQUE) === normalizeId(piece.ID_RUBRIQUE));
            
            return {
                id: piece.ID_PIECE,
                serial: index + 1,
                operationName: operation ? operation.INT_OPERATION : '---',
                rubriqueName: rubrique ? rubrique.RUBRIQUE : '---',
                documentType: piece.NAT_PIECE,
                documentName: piece.PIECE,
                amount: piece.MONTANT_PIECE
            };
        });

    }, [db, loading, selectedOperationId]);

    const totalAmount = useMemo(() => insufficientData.reduce((sum, item) => sum + item.amount, 0), [insufficientData]);

    const handleExport = () => {
        if (insufficientData.length === 0) {
            alert('لا توجد بيانات للتصدير.');
            return;
        }

        const headers = ['الرقم التسلسلي', 'العملية', 'الهيكلة', 'الوثيقة', 'المبلغ'];
        const styles = `<style> table, th, td { border: 1px solid black; border-collapse: collapse; text-align: right; padding: 5px; font-family: Arial, sans-serif; vertical-align: middle; } th { background-color: #DDEBF7; font-weight: bold; text-align: center; } .total { background-color: #A9D08E; font-weight: bold; } td { mso-number-format:"\\@"; } .currency { mso-number-format:"\\#\\,##0\\.00"; } </style>`;
        
        let tableHtml = `${styles}<table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>`;

        insufficientData.forEach(row => {
            tableHtml += `<tr>
                <td>${row.serial}</td>
                <td>${row.operationName}</td>
                <td>${row.rubriqueName}</td>
                <td>${row.documentName}</td>
                <td class="currency">${formatCurrencyForExcel(row.amount)}</td>
            </tr>`;
        });

        tableHtml += `</tbody><tfoot><tr class="total">
            <td colspan="4" style="text-align:center;">المجموع</td>
            <td class="currency">${formatCurrencyForExcel(totalAmount)}</td>
        </tr></tfoot></table>`;

        exportToFormattedExcel(tableHtml, 'ae_insufficiency.xls');
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

    if (loading) return <div>جار التحميل...</div>;

    return (
        <PageWrapper title="جدول نقص رخصة الالتزام حسب الهيكلة (Insuffisance d'AE sur rubrique)" navigate={navigate} onGoBack={onGoBack} backPage='FINANCIAL_STATUS' currentUser={currentUser}>
            <div className="bg-red-100 p-4 rounded-lg shadow-md mb-6 border border-red-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">تصفية حسب العملية</label>
                        <CustomDropdown
                            options={operationOptions}
                            value={selectedOperationId}
                            onChange={setSelectedOperationId}
                            placeholder="اختر العملية"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => navigate('PRINT_AE_INSUFFICIENCY', selectedOperationId ? parseInt(selectedOperationId) : 0)} className="bg-blue-500 text-white px-4 py-2 rounded-lg shadow hover:bg-blue-600 transition-colors w-full">
                            <i className="bi bi-printer mr-2"></i> طباعة
                        </button>
                        <button onClick={handleExport} disabled={insufficientData.length === 0} className="bg-teal-500 text-white px-4 py-2 rounded-lg shadow hover:bg-teal-600 transition-colors w-full disabled:bg-gray-400">
                            <i className="bi bi-file-earmark-excel mr-2"></i> تصدير
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow-md overflow-auto max-h-[calc(100vh-16rem)] custom-scrollbar">
                <table className="w-full text-right min-w-[900px] relative">
                    <thead className="bg-red-200 sticky top-0 z-20 shadow-sm">
                        <tr>
                            <th className="p-3 text-sm font-semibold text-gray-700 w-[10%] bg-red-200 sticky top-0 z-20">الرقم التسلسلي</th>
                            <th className="p-3 text-sm font-semibold text-gray-700 w-[30%] bg-red-200 sticky top-0 z-20">العملية</th>
                            <th className="p-3 text-sm font-semibold text-gray-700 w-[20%] bg-red-200 sticky top-0 z-20">الهيكلة</th>
                            <th className="p-3 text-sm font-semibold text-gray-700 w-[25%] bg-red-200 sticky top-0 z-20">الوثيقة (التي تفوق الرصيد)</th>
                            <th className="p-3 text-sm font-semibold text-gray-700 w-[15%] bg-red-200 sticky top-0 z-20">مبلغ الوثيقة</th>
                        </tr>
                    </thead>
                    <tbody>
                        {insufficientData.length > 0 ? insufficientData.map((row) => (
                            <tr key={row.id} className="border-b hover:bg-gray-50 text-sm">
                                <td className="p-3 text-center font-bold">{row.serial}</td>
                                <td className="p-3 text-gray-600">{row.operationName}</td>
                                <td className="p-3 text-gray-600 font-medium">{row.rubriqueName}</td>
                                <td className="p-3 font-semibold text-gray-800">{row.documentName}</td>
                                <td className="p-3 font-bold text-red-600">{formatCurrency(row.amount)}</td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={5} className="p-6 text-center text-gray-500">لا توجد وثائق تفوق رخصة الالتزام المتبقية.</td>
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

export default AeInsufficiencyPage;
