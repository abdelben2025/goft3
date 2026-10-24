import React, { useMemo } from 'react';
import { Page } from '../types';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';

interface PrintOperationsTablePageProps {
    navigate: (page: Page) => void;
}

const formatCurrency = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return '0,00';
    return new Intl.NumberFormat('ar-DZ', {
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
};

const PrintOperationsTablePage: React.FC<PrintOperationsTablePageProps> = ({ navigate }) => {
    const { db, loading } = useData();
    const { t } = useLanguage();
    
    const selectedYear = sessionStorage.getItem('goft3_selectedYear') || new Date().getFullYear().toString();
    const selectedActivity = sessionStorage.getItem('goft3_selectedActivity') || '';
    const searchQuery = sessionStorage.getItem('goft3_searchQuery') || '';
    const selectedStatus = sessionStorage.getItem('goft3_selectedStatus') || 'all';
    const selectedTypeOp = sessionStorage.getItem('goft3_selectedTypeOp') || 'all';

    const activities = useMemo(() => {
        const activityMap = new Map<string, string>();
        db.T_DIRECTION.forEach(d => {
            if (d.ACTION && d.INT_ACTION && !activityMap.has(d.ACTION)) {
                activityMap.set(d.ACTION, d.INT_ACTION);
            }
        });
        const operationActivityCodes = [...new Set(db.T_OPERATION.map(op => op.N_OPERATION.split('.')[5]).filter(Boolean))];
        return operationActivityCodes.map((code: string) => {
            return {
                code,
                name: activityMap.get(code) || `(${code})`
            };
        }).sort((a, b) => a.code.localeCompare(b.code));
    }, [db.T_DIRECTION, db.T_OPERATION]);

    const calculatedOperations = useMemo(() => {
        const operationStartYears = new Map<number, number>();
        [...db.T_ENGAGEMENT, ...db.T_CP].forEach(item => {
            const year = parseInt(item.ANNEE);
            if (!isNaN(year)) {
                const existingMinYear = operationStartYears.get(item.ID_OPERATION);
                if (!existingMinYear || year < existingMinYear) {
                    operationStartYears.set(item.ID_OPERATION, year);
                }
            }
        });

        return db.T_OPERATION.filter(op => {
            const startYear = operationStartYears.get(op.ID_OPERATION);
            return !startYear || startYear <= parseInt(selectedYear);
        }).map(op => {
            const aeFinale = db.T_RUBRIQUE_OP.filter(rop => rop.ID_OPERATION === op.ID_OPERATION).reduce((sum, item) => sum + (item.MONTANT_FINALE ?? item.MONTANT_INITIALE), 0);
            const totalEngagements = db.T_ENGAGEMENT.filter(eng => eng.ID_OPERATION === op.ID_OPERATION && (eng.NATURE_ENG === 'التزام' || eng.NATURE_ENG === 'سحب' || eng.NATURE_ENG === 'فسخ') && parseInt(eng.ANNEE) <= parseInt(selectedYear)).reduce((sum, item) => sum + item.MONTANT_ENG, 0);
            const totalEngagementsCurrentYear = db.T_ENGAGEMENT.filter(eng => eng.ID_OPERATION === op.ID_OPERATION && (eng.NATURE_ENG === 'التزام' || eng.NATURE_ENG === 'سحب' || eng.NATURE_ENG === 'فسخ') && eng.ANNEE === selectedYear).reduce((sum, item) => sum + item.MONTANT_ENG, 0);
            const remainingAE = aeFinale - totalEngagements;
            const totalPaiements = db.T_PAIEMENT.filter(pai => pai.ID_OPERATION === op.ID_OPERATION && parseInt(pai.ANNEE) <= parseInt(selectedYear)).reduce((sum, item) => sum + item.MONTANT_PAI, 0);
            const cpFinaleCurrentYear = db.T_CP.filter(cp => cp.ID_OPERATION === op.ID_OPERATION && cp.ANNEE === selectedYear).reduce((sum, item) => sum + item.MONTANT_FINALE_CP, 0);
            const paiementsCurrentYear = db.T_PAIEMENT.filter(pai => pai.ID_OPERATION === op.ID_OPERATION && pai.ANNEE === selectedYear).reduce((sum, item) => sum + item.MONTANT_PAI, 0);
            const remainingCP = cpFinaleCurrentYear - paiementsCurrentYear;
            
            const opStartYear = operationStartYears.get(op.ID_OPERATION) || 9999;

            const cat = db.T_CATEGORIE.find(c => c.ID_CATEGORIE === op.ID_CATEGORIE);
            const catCode = cat?.C_CATEGORIE || 'NO_CAT';
            const catInt = cat?.INT_CATEGORIE || 'بدون صنف';

            const scatId = op.ID_SCATEGORIE || db.T_SCATEGORIE_OP.find(sop => sop.ID_OPERATION === op.ID_OPERATION)?.ID_SCATEGORIE;
            const scat = scatId ? db.T_SCATEGORIE.find(sc => sc.ID_SCATEGORIE === scatId) : null;
            const scatCode = scat?.C_SCATEGORIE || 'NO_SCAT';
            const scatInt = scat?.INT_SCATEGORIE || 'غير موزع';

            return { ...op, aeFinale, totalEngagements, totalEngagementsCurrentYear, remainingAE, totalPaiements, cpFinaleCurrentYear, paiementsCurrentYear, remainingCP, opStartYear, catCode, catInt, scatCode, scatInt };
        }).sort((a, b) => {
            const partsA = a.N_OPERATION.split('.');
            const partsB = b.N_OPERATION.split('.');
            
            let cmp = a.catCode.localeCompare(b.catCode, undefined, { numeric: true });
            if (cmp !== 0) return cmp;

            cmp = a.scatCode.localeCompare(b.scatCode, undefined, { numeric: true });
            if (cmp !== 0) return cmp;

            const typeA = a.TYPE_OP || '';
            const typeB = b.TYPE_OP || '';
            if (typeA && !typeB) return -1;
            if (!typeA && typeB) return 1;
            cmp = typeA.localeCompare(typeB, 'ar', { numeric: true });
            if (cmp !== 0) return cmp;

            const actA = partsA[5] || '';
            const actB = partsB[5] || '';
            cmp = actA.localeCompare(actB, undefined, { numeric: true });
            if (cmp !== 0) return cmp;

            const prgA = partsA[3] || '';
            const prgB = partsB[3] || '';
            cmp = prgA.localeCompare(prgB, undefined, { numeric: true });
            if (cmp !== 0) return cmp;

            const sprgA = partsA[4] || '';
            const sprgB = partsB[4] || '';
            cmp = sprgA.localeCompare(sprgB, undefined, { numeric: true });
            if (cmp !== 0) return cmp;

            const yrA = partsA[8] || '';
            const yrB = partsB[8] || '';
            cmp = yrA.localeCompare(yrB, undefined, { numeric: true });
            if (cmp !== 0) return cmp;

            const numA = partsA[9] || '';
            const numB = partsB[9] || '';
            return numA.localeCompare(numB, undefined, { numeric: true });
        });
    }, [db, selectedYear]);

    const displayData = useMemo(() => {
        let filteredOps = calculatedOperations;

        if (selectedActivity) {
            filteredOps = filteredOps.filter(op => op.N_OPERATION.split('.')[5] === selectedActivity);
        }
        
        if (searchQuery) {
            const query = searchQuery.trim().toLowerCase();
            filteredOps = filteredOps.filter(op => 
                op.N_OPERATION.toLowerCase().includes(query) || 
                op.INT_OPERATION.toLowerCase().includes(query)
            );
        }
        
        if (selectedStatus !== 'all') {
            filteredOps = filteredOps.filter(op => op.status === selectedStatus);
        }
        
        if (selectedTypeOp !== 'all') {
            filteredOps = filteredOps.filter(op => op.TYPE_OP === selectedTypeOp);
        }

        if (!filteredOps.length) return { rows: [], grandTotal: null };

        const grouped = filteredOps.reduce((acc, op) => {
            const parts = op.N_OPERATION.split('.');
            const catCode = op.catCode || 'NO_CAT';
            const scatCode = op.scatCode || 'NO_SCAT';
            const prgCode = parts[3] || '---';
            const sprgCode = parts[4] || '---';

            if (!acc[catCode]) acc[catCode] = {};
            if (!acc[catCode][scatCode]) acc[catCode][scatCode] = {};
            if (!acc[catCode][scatCode][prgCode]) acc[catCode][scatCode][prgCode] = {};
            if (!acc[catCode][scatCode][prgCode][sprgCode]) acc[catCode][scatCode][prgCode][sprgCode] = [];
            
            acc[catCode][scatCode][prgCode][sprgCode].push(op);
            return acc;
        }, {} as Record<string, Record<string, Record<string, Record<string, typeof calculatedOperations>>>>);

        const tableRows: (any)[] = [];

        Object.keys(grouped).sort().forEach(catCode => {
            const scatsInCat = grouped[catCode];
            const catName = scatsInCat[Object.keys(scatsInCat)[0]][Object.keys(scatsInCat[Object.keys(scatsInCat)[0]])[0]][Object.keys(scatsInCat[Object.keys(scatsInCat)[0]][Object.keys(scatsInCat[Object.keys(scatsInCat)[0]])[0]])[0]][0].catInt || catCode;
            
            tableRows.push({ type: 'catHeader', id: `cat-${catCode}`, catCode, catName });

            Object.keys(scatsInCat).sort().forEach(scatCode => {
                const programsInScat = scatsInCat[scatCode];
                const scatName = scatCode === 'NO_SCAT' ? 'مبالغ غير موزعة' : (programsInScat[Object.keys(programsInScat)[0]][Object.keys(programsInScat[Object.keys(programsInScat)[0]])[0]][0].scatInt || scatCode);
                
                tableRows.push({ type: 'scatHeader', id: `scat-${catCode}-${scatCode}`, scatCode, scatName });

                Object.keys(programsInScat).sort().forEach(prgCode => {
                    const sprogramsInPrg = programsInScat[prgCode];

                    Object.keys(sprogramsInPrg).sort().forEach(sprgCode => {
                        const opsInSprg = sprogramsInPrg[sprgCode];
                        
                        tableRows.push(...opsInSprg);
                        
                        const sprgSubtotal = opsInSprg.reduce((acc, op) => {
                            acc.aeFinale += op.aeFinale;
                            acc.totalEngagements += op.totalEngagements;
                            acc.totalEngagementsCurrentYear += op.totalEngagementsCurrentYear;
                            acc.remainingAE += op.remainingAE;
                            acc.totalPaiements += op.totalPaiements;
                            acc.cpFinaleCurrentYear += op.cpFinaleCurrentYear;
                            acc.paiementsCurrentYear += op.paiementsCurrentYear;
                            acc.remainingCP += op.remainingCP;
                            return acc;
                        }, { aeFinale: 0, totalEngagements: 0, totalEngagementsCurrentYear: 0, remainingAE: 0, totalPaiements: 0, cpFinaleCurrentYear: 0, paiementsCurrentYear: 0, remainingCP: 0 });
                        
                        tableRows.push({ 
                            type: 'sprgSubtotal', 
                            id: `subtotal-sprg-${catCode}-${scatCode}-${prgCode}-${sprgCode}`, 
                            label: `مجموع البرنامج الفرعي: ${sprgCode}`, 
                            ...sprgSubtotal 
                        });
                    });
                });

                const scatOps = Object.values(programsInScat).flatMap(prg => Object.values(prg).flat());
                const scatSubtotal = scatOps.reduce((acc, op) => {
                    acc.aeFinale += op.aeFinale;
                    acc.totalEngagements += op.totalEngagements;
                    acc.totalEngagementsCurrentYear += op.totalEngagementsCurrentYear;
                    acc.remainingAE += op.remainingAE;
                    acc.totalPaiements += op.totalPaiements;
                    acc.cpFinaleCurrentYear += op.cpFinaleCurrentYear;
                    acc.paiementsCurrentYear += op.paiementsCurrentYear;
                    acc.remainingCP += op.remainingCP;
                    return acc;
                }, { aeFinale: 0, totalEngagements: 0, totalEngagementsCurrentYear: 0, remainingAE: 0, totalPaiements: 0, cpFinaleCurrentYear: 0, paiementsCurrentYear: 0, remainingCP: 0 });

                tableRows.push({ 
                    type: 'subtotal', 
                    id: `subtotal-scat-${catCode}-${scatCode}`, 
                    label: `مجموع ${scatName}`, 
                    ...scatSubtotal 
                });
            });
        });
        
        const grandTotal = filteredOps.reduce((acc, op) => {
             acc.aeFinale += op.aeFinale;
             acc.totalEngagements += op.totalEngagements;
             acc.totalEngagementsCurrentYear += op.totalEngagementsCurrentYear;
             acc.remainingAE += op.remainingAE;
             acc.totalPaiements += op.totalPaiements;
             acc.cpFinaleCurrentYear += op.cpFinaleCurrentYear;
             acc.paiementsCurrentYear += op.paiementsCurrentYear;
             acc.remainingCP += op.remainingCP;
             return acc;
        }, { aeFinale: 0, totalEngagements: 0, totalEngagementsCurrentYear: 0, remainingAE: 0, totalPaiements: 0, cpFinaleCurrentYear: 0, paiementsCurrentYear: 0, remainingCP: 0 });

        return { rows: tableRows, grandTotal };
    }, [calculatedOperations, selectedActivity, searchQuery, selectedStatus, selectedTypeOp]);

    if (loading) return <div className="p-8 text-center">{t('loading')}</div>;
    
    const direction = db.T_DIRECTION[0];

    return (
        <div className="bg-gray-200 p-4 min-h-screen">
            <style>{`
                @media print {
                    @page {
                        size: A4 landscape;
                        margin: 0.5cm;
                    }
                    .no-print { display: none !important; }
                    body {
                        margin: 0;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                        background: white;
                    }
                    .print-area {
                        margin: 0 !important;
                        padding: 0 !important;
                        box-shadow: none !important;
                        border: none !important;
                        font-size: 8.5pt !important;
                        width: 100% !important;
                    }
                    .print-area table {
                        page-break-inside: auto;
                        width: 100% !important;
                        border-collapse: collapse;
                    }
                    .print-area tr {
                        page-break-inside: avoid;
                        page-break-after: auto;
                    }
                    .print-area thead {
                        display: table-header-group;
                    }
                    .print-area th, .print-area td {
                        border: 1px solid black !important;
                        padding: 3px 4px !important;
                        word-wrap: break-word;
                        font-size: 8.5pt !important;
                    }
                }
                .print-area { font-family: 'Amiri', serif; }
                .print-area, .print-area p, .print-area h1, .print-area div, .print-area th, .print-area td { color: black !important; }
            `}</style>
            <div className="no-print mb-4 flex justify-between items-center bg-white p-2 rounded shadow">
                <h2 className="text-xl font-bold">{t('btn.print')}</h2>
                <div className="flex gap-2">
                    <button onClick={() => navigate('OPERATIONS')} className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors">→ {t('btn.back')}</button>
                    <button onClick={() => window.print()} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"><i className="bi bi-printer mr-2"></i> {t('btn.print')}</button>
                </div>
            </div>
            
            <div className="print-area bg-white p-6 mx-auto max-w-full shadow-lg border border-gray-300">
                <header className="text-center mb-4 relative">
                    <p className="font-bold text-sm mb-4">{t('print.header.republic')}</p>
                    <div className="flex justify-between text-xs font-bold mb-4">
                        <div className="text-right">
                            <p>{direction?.INT_PORTEFEUILLE}</p>
                            <p>{direction?.DIRECTION}</p>
                        </div>
                        <div className="text-left text-gray-600">
                            <p>السنة المالية: {selectedYear}</p>
                            {selectedStatus !== 'all' && <p>حالة العمليات: {selectedStatus}</p>}
                            {selectedTypeOp !== 'all' && <p>نوع العمليات: {selectedTypeOp}</p>}
                        </div>
                    </div>
                    <h1 className="text-lg font-bold underline mt-2">{t('print.title.operations_table', {year: selectedYear})}</h1>
                    <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-2 text-xs font-semibold text-gray-700">
                        {selectedActivity && <span>النشاط: {activities.find(a=>a.code === selectedActivity)?.name || selectedActivity}</span>}
                        {searchQuery && <span>عبارة البحث: "{searchQuery}"</span>}
                    </div>
                </header>

                <table className="w-full border-collapse border border-black text-center mt-4">
                    <thead className="bg-gray-100 font-bold text-[9pt]">
                        <tr>
                            <th className="border border-black p-1 w-[32%]">{t('col.operation_info')}</th>
                            <th className="border border-black p-1 w-[10%]">{t('col.ae')}</th>
                            <th className="border border-black p-1 w-[10%]">{t('col.total_engagements')}</th>
                            <th className="border border-black p-1 w-[10%]">{t('col.engagements_year', {year: selectedYear})}</th>
                            <th className="border border-black p-1 w-[9%]">{t('col.remaining_ae')}</th>
                            <th className="border border-black p-1 w-[10%]">{t('col.total_payments')}</th>
                            <th className="border border-black p-1 w-[10%]">{t('col.cp_year', {year: selectedYear})}</th>
                            <th className="border border-black p-1 w-[9%]">دفع السنة</th>
                            <th className="border border-black p-1 w-[10%]">باقي اعتماد الدفع</th>
                        </tr>
                    </thead>
                    <tbody className="text-[8.5pt]">
                        {displayData.rows && displayData.rows.length > 0 ? (
                            displayData.rows.map(item => {
                                if (item.type === 'catHeader') {
                                    return (
                                        <tr key={item.id} className="bg-gray-300 font-bold">
                                            <td colSpan={9} className="border border-black p-1 text-right">الصنف: {item.catName} ({item.catCode})</td>
                                        </tr>
                                    );
                                }
                                if (item.type === 'scatHeader') {
                                    return (
                                        <tr key={item.id} className="bg-gray-100 font-bold">
                                            <td colSpan={9} className="border border-black p-1 text-right">الصنف الفرعي: {item.scatName} {item.scatCode !== 'NO_SCAT' ? `(${item.scatCode})` : ''}</td>
                                        </tr>
                                    );
                                }
                                if (item.type === 'sprgSubtotal' || item.type === 'subtotal') {
                                    const isScat = item.type === 'subtotal';
                                    return (
                                        <tr key={item.id} className={`${isScat ? 'bg-gray-200 font-bold' : 'bg-gray-50 italic'} border border-black`}>
                                            <td className="border border-black p-1 text-right font-medium">{item.label}</td>
                                            <td className="border border-black p-1">{formatCurrency(item.aeFinale)}</td>
                                            <td className="border border-black p-1">{formatCurrency(item.totalEngagements)}</td>
                                            <td className="border border-black p-1 text-amber-800">{formatCurrency(item.totalEngagementsCurrentYear)}</td>
                                            <td className="border border-black p-1 font-bold text-rose-700">{formatCurrency(item.remainingAE)}</td>
                                            <td className="border border-black p-1">{formatCurrency(item.totalPaiements)}</td>
                                            <td className="border border-black p-1 text-indigo-800">{formatCurrency(item.cpFinaleCurrentYear)}</td>
                                            <td className="border border-black p-1 font-bold text-emerald-700">{formatCurrency(item.paiementsCurrentYear)}</td>
                                            <td className="border border-black p-1 font-bold text-rose-700">{formatCurrency(item.remainingCP)}</td>
                                        </tr>
                                    );
                                }

                                const op = item;
                                return (
                                    <tr key={op.ID_OPERATION}>
                                        <td className="border border-black p-1.5 text-right">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex flex-wrap gap-1 items-center justify-start">
                                                    <span className="font-mono text-[9px] font-bold text-blue-700 bg-blue-50 px-1 py-0.2 rounded border border-blue-100">
                                                        {op.N_OPERATION}
                                                    </span>
                                                    {op.TYPE_OP && (
                                                        <span className="text-[9px] font-bold text-sky-800 bg-sky-50 px-1 py-0.2 rounded border border-sky-100 uppercase tracking-wide">
                                                            {op.TYPE_OP}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-[10px] font-medium text-gray-800 leading-relaxed block mt-0.5">{op.INT_OPERATION}</span>
                                            </div>
                                        </td>
                                        <td className="border border-black p-1 font-semibold text-gray-700">{formatCurrency(op.aeFinale)}</td>
                                        <td className="border border-black p-1 font-semibold text-gray-700">{formatCurrency(op.totalEngagements)}</td>
                                        <td className="border border-black p-1 font-bold text-amber-800">{formatCurrency(op.totalEngagementsCurrentYear)}</td>
                                        <td className="border border-black p-1 font-bold text-rose-700">{formatCurrency(op.remainingAE)}</td>
                                        <td className="border border-black p-1 font-semibold text-gray-700">{formatCurrency(op.totalPaiements)}</td>
                                        <td className="border border-black p-1 font-bold text-indigo-800">{formatCurrency(op.cpFinaleCurrentYear)}</td>
                                        <td className="border border-black p-1 font-bold text-emerald-700">{formatCurrency(op.paiementsCurrentYear)}</td>
                                        <td className="border border-black p-1 font-bold text-rose-700">{formatCurrency(op.remainingCP)}</td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan={9} className="border border-black p-8 text-center text-gray-500 font-bold">{t('no_data')}</td>
                            </tr>
                        )}
                        {displayData.grandTotal && (
                            <tr className="bg-gray-300 font-bold text-[9pt] border-t-2 border-black">
                                <td className="border border-black p-1 text-right font-black">{t('lbl.total_general')}</td>
                                <td className="border border-black p-1 font-black">{formatCurrency(displayData.grandTotal.aeFinale)}</td>
                                <td className="border border-black p-1 font-black">{formatCurrency(displayData.grandTotal.totalEngagements)}</td>
                                <td className="border border-black p-1 text-amber-800 font-black">{formatCurrency(displayData.grandTotal.totalEngagementsCurrentYear)}</td>
                                <td className="border border-black p-1 font-bold text-rose-700">{formatCurrency(displayData.grandTotal.remainingAE)}</td>
                                <td className="border border-black p-1 font-black">{formatCurrency(displayData.grandTotal.totalPaiements)}</td>
                                <td className="border border-black p-1 text-indigo-800 font-black">{formatCurrency(displayData.grandTotal.cpFinaleCurrentYear)}</td>
                                <td className="border border-black p-1 font-bold text-emerald-700">{formatCurrency(displayData.grandTotal.paiementsCurrentYear)}</td>
                                <td className="border border-black p-1 font-bold text-rose-700">{formatCurrency(displayData.grandTotal.remainingCP)}</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PrintOperationsTablePage;
