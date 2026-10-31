import React, { useState, useMemo } from 'react';
import { ArrowRight, Printer, Search, Calendar, CreditCard, Download } from 'lucide-react';
import { useData } from '../context/DataContext';
import { Page, User, Operation, Piece, Engagement, Beneficiaire, Paiement } from '../types';
import PageWrapper from '../components/PageWrapper';
import CustomDropdown from '../components/CustomDropdown';
import { formatCurrency } from '../utils/currencyUtils';
import { normalizeDate } from '../utils/dateUtils';
import ExcelJS from 'exceljs';
import { saveWorkbook } from '../utils/exportXlsx';
import { useLanguage } from '../context/LanguageContext';

interface MonthlyPaymentsPageProps {
    navigate: (page: Page) => void;
    currentUser: User;
    onGoBack?: () => void;
}

const MonthlyPaymentsPage: React.FC<MonthlyPaymentsPageProps> = ({ navigate, onGoBack }) => {
    const { db } = useData();
    const { t } = useLanguage();
    const paiements = db.T_PAIEMENT;
    const operations = db.T_OPERATION;
    const pieces = db.T_PIECE;
    const beneficiaries = db.T_BENEFICIAIRE;
    const engagements = db.T_ENGAGEMENT;

    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
    const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString().padStart(2, '0'));
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACCEPTED' | 'NOT_ACCEPTED'>('ALL');
    const [selectedAction, setSelectedAction] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');

    const parseYearMonth = (dateStr: string | null | undefined) => {
        if (!dateStr) return { year: '', month: '' };
        if (dateStr.includes('-')) {
            const parts = dateStr.split('-');
            if (parts[0].length === 4) {
                return { year: parts[0], month: parts[1] || '' };
            } else {
                return { year: parts[2] || '', month: parts[1] || '' };
            }
        } else if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts[2]?.length === 4) {
                return { year: parts[2], month: parts[1] || '' };
            } else if (parts[0].length === 4) {
                return { year: parts[0], month: parts[1] || '' };
            }
        }
        return { year: '', month: '' };
    };

    const months = [
        { value: 'ALL', label: t('mpay.all_months') },
        { value: '01', label: t('month.1') },
        { value: '02', label: t('month.2') },
        { value: '03', label: t('month.3') },
        { value: '04', label: t('month.4') },
        { value: '05', label: t('month.5') },
        { value: '06', label: t('month.6') },
        { value: '07', label: t('month.7') },
        { value: '08', label: t('month.8') },
        { value: '09', label: t('month.9') },
        { value: '10', label: t('month.10') },
        { value: '11', label: t('month.11') },
        { value: '12', label: t('month.12') },
    ];

    const years = useMemo(() => {
        const yrSet = new Set<string>();
        paiements.forEach((p: Paiement) => {
            const { year } = parseYearMonth(p.DATE_PAI);
            if (year && year.length === 4) {
                yrSet.add(year);
            }
        });
        const currentYear = new Date().getFullYear().toString();
        yrSet.add(currentYear);
        return Array.from(yrSet).sort((a, b) => b.localeCompare(a));
    }, [paiements]);

    // Activities list — same logic as FinancialStatusPage (ACTION / INT_ACTION)
    const activities = useMemo(() => {
        const actionCodesInUse = [...new Set(operations.map(op => op.N_OPERATION.split('.')[5]).filter(Boolean))];
        const actionCodeToNameMap = new Map(db.T_DIRECTION.map(d => [d.ACTION, d.INT_ACTION]));
        const inUseActivities = actionCodesInUse.map((code: string) => {
            const name = actionCodeToNameMap.get(code) || `(${code})`;
            return { value: code, label: `${code} - ${name}` };
        });
        inUseActivities.sort((a, b) => a.value.localeCompare(b.value));
        return inUseActivities;
    }, [operations, db.T_DIRECTION]);

    const filteredData = useMemo(() => {
        return paiements
            .filter((p: Paiement) => {
                const isAccepted = !!p.DATE_ADMIS;

                if (statusFilter === 'ACCEPTED' && !isAccepted) return false;
                if (statusFilter === 'NOT_ACCEPTED' && isAccepted) return false;

                // Filter by activity code extracted from N_OPERATION (same as financial status)
                if (selectedAction) {
                    const op = operations.find((o: Operation) => o.ID_OPERATION === p.ID_OPERATION);
                    const opActionCode = op ? op.N_OPERATION.split('.')[5] : undefined;
                    if (opActionCode !== selectedAction) return false;
                }

                const { year, month } = parseYearMonth(p.DATE_PAI);
                return year === selectedYear && (selectedMonth === 'ALL' || month === selectedMonth);
            })
            .map((p: Paiement) => {
                const op = operations.find((o: Operation) => o.ID_OPERATION === p.ID_OPERATION);
                const piece = pieces.find((pi: Piece) => pi.ID_PIECE === p.ID_PIECE);
                const eng = engagements.find((e: Engagement) => e.ID_ENGAGEMENT === p.ID_ENG);
                const ben = piece?.ID_BENEFICIAIRE ? beneficiaries.find((b: Beneficiaire) => b.ID_BENEFICIAIRE === piece.ID_BENEFICIAIRE) : null;

                return {
                    ...p,
                    opName: op ? `${op.N_OPERATION} - ${op.INT_OPERATION}` : t('mpay.unknown'),
                    pieceName: piece ? piece.PIECE : t('mpay.unknown'),
                    engRef: eng ? `${eng.N_ENG} / ${eng.ANNEE}` : '---',
                    beneficiaryName: ben ? ben.BENEFICIAIRE : '---',
                    isAccepted: !!p.DATE_ADMIS
                };
            })
            .filter((item: any) =>
                item.opName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.N_PAI.includes(searchTerm) ||
                item.N_MANDAT?.includes(searchTerm) ||
                item.beneficiaryName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.pieceName.toLowerCase().includes(searchTerm.toLowerCase())
            )
            .sort((a: any, b: any) => {
                return (a.DATE_PAI || '').localeCompare(b.DATE_PAI || '');
            });
    }, [paiements, operations, pieces, beneficiaries, engagements, selectedYear, selectedMonth, statusFilter, selectedAction, searchTerm, t]);

    const totalAmount = useMemo(() => {
        return filteredData.reduce((sum: number, item: any) => sum + item.MONTANT_PAI, 0);
    }, [filteredData]);

    const handlePrint = () => {
        if (filteredData.length === 0) return;
        sessionStorage.setItem('goft3_monthly_year', selectedYear);
        sessionStorage.setItem('goft3_monthly_month', selectedMonth);
        sessionStorage.setItem('goft3_monthly_pay_status', statusFilter);
        sessionStorage.setItem('goft3_monthly_action', selectedAction);
        navigate('PRINT_MONTHLY_PAYMENTS');
    };

    const handleExport = async () => {
        if (filteredData.length === 0) return;

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(t('mpay.sheet_name'));
        
        worksheet.views = [{ rightToLeft: true }];

        worksheet.columns = [
            { header: '#', key: 'index', width: 5 },
            { header: t('col.operation_info'), key: 'op', width: 40 },
            { header: t('mpay.card_no'), key: 'n_pai', width: 15 },
            { header: t('col.year'), key: 'annee', width: 10 },
            { header: t('mpay.payment_date'), key: 'date', width: 15 },
            { header: t('col.mandat_no'), key: 'n_mandat', width: 15 },
            { header: t('col.mandat_date'), key: 'date_mandat', width: 15 },
            { header: t('col.document'), key: 'piece', width: 25 },
            { header: t('col.commitment'), key: 'eng', width: 20 },
            { header: t('mpay.beneficiary'), key: 'ben', width: 30 },
            { header: t('col.status'), key: 'status', width: 15 },
            { header: t('col.amount'), key: 'amount', width: 20 },
        ];

        filteredData.forEach((item, index) => {
            worksheet.addRow({
                index: index + 1,
                op: item.opName,
                n_pai: item.N_PAI,
                annee: item.ANNEE,
                date: normalizeDate(item.DATE_PAI),
                n_mandat: item.N_MANDAT || '---',
                date_mandat: item.DATE_MANDAT ? normalizeDate(item.DATE_MANDAT) : '---',
                piece: item.pieceName,
                eng: item.engRef,
                ben: item.beneficiaryName,
                status: item.isAccepted ? `${t('mpay.accepted')} (${normalizeDate(item.DATE_ADMIS)})` : t('mpay.not_accepted'),
                amount: item.MONTANT_PAI
            });
        });

        // Styling
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).alignment = { horizontal: 'center' };
        worksheet.getColumn('amount').numFmt = '#,##0.00';

        await saveWorkbook(workbook, `${t('mpayxl.file_prefix')}${months.find(m => m.value === selectedMonth)?.label}_${selectedYear}.xlsx`);
    };

    return (
        <PageWrapper title={t('mpay.title')} navigate={navigate} onGoBack={onGoBack}>
            <div className="w-full px-4 py-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 no-print gap-4">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => onGoBack ? onGoBack() : navigate('FINANCIAL_STATUS')}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <ArrowRight className="w-6 h-6 text-gray-600" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-black text-gray-800">{t('mpay.title')}</h1>
                            <p className="text-sm text-gray-500 font-bold">{t('mpay.subtitle')}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button 
                            onClick={handleExport}
                            disabled={filteredData.length === 0}
                            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Download className="w-4 h-4" />
                            {t('mpay.export_excel')}
                        </button>
                        <button 
                            onClick={handlePrint}
                            disabled={filteredData.length === 0}
                            className="flex items-center gap-2 bg-white border border-gray-300 px-4 py-2 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Printer className="w-4 h-4" />
                            {t('mpay.print_table')}
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-3xl shadow-xl border border-gray-100 mb-6 no-print overflow-visible">
                    <div className="p-6 bg-gradient-to-r from-emerald-600 to-teal-700">
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-emerald-100 mb-1 mr-2">{t('mpay.fiscal_year')}</label>
                                <div className="relative">
                                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-300" />
                                    <select 
                                        value={selectedYear}
                                        onChange={(e) => setSelectedYear(e.target.value)}
                                        className="w-full bg-white/10 border border-white/20 rounded-xl py-2 px-10 text-white font-bold focus:outline-none focus:ring-2 focus:ring-white/30 appearance-none"
                                    >
                                        {years.map(y => <option key={y} value={y} className="text-gray-800">{y}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-emerald-100 mb-1 mr-2">{t('filter.month')}</label>
                                <div className="relative">
                                    <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-300" />
                                    <select 
                                        value={selectedMonth}
                                        onChange={(e) => setSelectedMonth(e.target.value)}
                                        className="w-full bg-white/10 border border-white/20 rounded-xl py-2 px-10 text-white font-bold focus:outline-none focus:ring-2 focus:ring-white/30 appearance-none"
                                    >
                                        {months.map(m => <option key={m.value} value={m.value} className="text-gray-800">{m.label}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-emerald-100 mb-1 mr-2">{t('mpay.status_label')}</label>
                                <div className="relative">
                                    <select 
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value as any)}
                                        className="w-full bg-white/10 border border-white/20 rounded-xl py-2 px-4 text-white font-bold focus:outline-none focus:ring-2 focus:ring-white/30 appearance-none text-right"
                                    >
                                        <option value="ALL" className="text-gray-800">{t('mpay.status_all')}</option>
                                        <option value="ACCEPTED" className="text-gray-800">{t('mpay.status_accepted_only')}</option>
                                        <option value="NOT_ACCEPTED" className="text-gray-800">{t('mpay.status_not_accepted_only')}</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-emerald-100 mb-1 mr-2">{t('filter.activity')}</label>
 								<div className="relative">
                                <CustomDropdown
                                    options={[{ value: '', label: t('mpay.all_activities') }, ...activities]}
                                    value={selectedAction}
                                    onChange={setSelectedAction}
                                    placeholder={t('filter.select_activity')}
                                    className="w-full"
                                />
								</div>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-[10px] font-bold text-emerald-100 mb-1 mr-2">{t('mpay.quick_search')}</label>
                                <div className="relative">
                                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-300" />
                                    <input 
                                        type="text"
                                        placeholder={t('mpay.search_placeholder')}
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full bg-white/10 border border-white/20 rounded-xl py-2 px-10 text-white font-bold placeholder:text-emerald-200/50 focus:outline-none focus:ring-2 focus:ring-white/30"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden print:hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-right border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-wider border-l border-gray-100">#</th>
                                    <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-wider border-l border-gray-100">{t('col.operation_info')}</th>
                                    <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-wider border-l border-gray-100">{t('mpay.card_year_header')}</th>
                                    <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-wider border-l border-gray-100">{t('mpay.mandate_header')}</th>
                                    <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-wider border-l border-gray-100">{t('col.document')}</th>
                                    <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-wider border-l border-gray-100">{t('mpay.beneficiary')}</th>
                                    <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-wider border-l border-gray-100">{t('col.status')}</th>
                                    <th className="px-4 py-4 text-[10px] font-black text-gray-500 uppercase tracking-wider border-l border-gray-100 text-left">{t('col.amount')}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredData.length > 0 ? (
                                    filteredData.map((item: any, index: number) => (
                                        <tr key={item.ID_PAIEMENT} className="hover:bg-emerald-50/30 transition-colors group">
                                            <td className="px-4 py-4 whitespace-nowrap text-[11px] font-bold text-gray-400 group-hover:text-emerald-500">{index + 1}</td>
                                            <td className="px-4 py-4 text-[11px] font-bold text-gray-800 leading-relaxed min-w-[200px]">
                                                {item.opName}
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span className={`text-[11px] font-black ${item.isAccepted ? 'text-emerald-700' : 'text-amber-700'}`}>{item.N_PAI} / {item.ANNEE}</span>
                                                    <span className="text-[9px] font-bold text-gray-400 italic">{t('mpay.on_date', {date: normalizeDate(item.DATE_PAI)})}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap">
                                                {item.N_MANDAT ? (
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-black text-gray-700">{t('mpay.mandate_no', {number: item.N_MANDAT})}</span>
                                                        <span className="text-[9px] font-bold text-gray-400 italic">{t('mpay.dated', {date: normalizeDate(item.DATE_MANDAT || '')})}</span>
                                                    </div>
                                                ) : <span className="text-[10px] text-gray-300 font-bold">---</span>}
                                            </td>
                                            <td className="px-4 py-4 text-[11px] font-bold text-gray-600">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="bg-gray-100 px-2 py-0.5 rounded-lg border border-gray-200 inline-block">{item.pieceName}</span>
                                                    <span className="text-[9px] text-blue-500 font-bold">{item.engRef}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-4 text-[11px] font-bold text-gray-700">
                                                {item.beneficiaryName}
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap">
                                                {item.isAccepted ? (
                                                    <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-1 rounded-full text-[10px] font-black">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                        {t('mpay.accepted_on', {date: normalizeDate(item.DATE_ADMIS)})}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-100 px-2 py-1 rounded-full text-[10px] font-black">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                                        {t('mpay.not_accepted_pending')}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 whitespace-nowrap text-xs font-black text-left text-emerald-900">
                                                {formatCurrency(item.MONTANT_PAI)}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-12 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="p-4 bg-gray-50 rounded-full">
                                                    <CreditCard className="w-8 h-8 text-gray-300" />
                                                </div>
                                                <p className="text-gray-400 font-bold">{t('mpay.empty_no_payments')}</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            {filteredData.length > 0 && (
                                <tfoot className="bg-emerald-900 text-white">
                                    <tr>
                                        <td colSpan={7} className="px-4 py-4 text-sm font-black text-right uppercase">{t('mpay.total_this_month')}</td>
                                        <td className="px-4 py-4 text-sm font-black text-left">{formatCurrency(totalAmount)}</td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
            </div>
        </PageWrapper>
    );
};

export default MonthlyPaymentsPage;
