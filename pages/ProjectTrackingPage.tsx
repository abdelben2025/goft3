
import React, { useState, useMemo } from 'react';
import { Page, LotOperation, User } from '../types';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { parseDate, normalizeDate, getEffectiveDurationDays, isFinancialDuration, calculateElapsedDays } from '../utils/dateUtils';
import PageWrapper from '../components/PageWrapper';
import CustomDropdown from '../components/CustomDropdown';
import { exportToFormattedExcel } from '../utils/exportToCsv';
import { formatCurrency } from '../utils/currencyUtils';

interface ProjectTrackingPageProps {
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

// Helper to safely convert any value to a float
const safeFloat = (val: any): number => {
    if (typeof val === 'number') return val;
    if (val === null || val === undefined) return 0;
    const str = String(val).replace(/,/g, '.').replace(/[^0-9.-]/g, '');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
};

// Helper to safely get ID as a number
const safeId = (val: any): number => {
    if (!val) return 0;
    const num = parseInt(String(val).trim(), 10);
    return isNaN(num) ? 0 : num;
};

/**
 * Calculates deadline state following the financial unit rule.
 * If duration unit is 'months', consumed days are calculated using the 30/360 financial rule.
 * Otherwise, actual calendar days are used.
 */
const calculateDeadlineState = (durationStr: string | null | undefined, odsList: any[]) => {
    const totalDurationAllowed = getEffectiveDurationDays(durationStr);
    const useFinancialRule = isFinancialDuration(durationStr);

    if (totalDurationAllowed <= 0) {
        return { text: "بدون مدة محددة", isRunning: false, remaining: 0 };
    }

    const sortedOds = odsList
        .map(ods => ({ ...ods, parsedDate: parseDate(ods.DATE_ODS) }))
        .filter(ods => ods.parsedDate !== null)
        .sort((a, b) => a.parsedDate!.getTime() - b.parsedDate!.getTime());

    const hasStartOds = sortedOds.some(ods => ods.NATURE_ODS === 'انطلاق');
    if (!hasStartOds) {
        return { text: "لم تنطلق", isRunning: false, remaining: totalDurationAllowed };
    }
    
    if (sortedOds.some(ods => ods.NATURE_ODS === 'ختام')) {
        return { text: "منتهية", isRunning: false, remaining: 0 };
    }

    let consumedWorkDays = 0;
    let lastActiveStartDate: Date | null = null;
    let isCurrentlyPaused = true;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const ods of sortedOds) {
        const eventDate = ods.parsedDate!;
        if (ods.NATURE_ODS === 'انطلاق' || ods.NATURE_ODS === 'استئناف') {
            if (isCurrentlyPaused) {
                lastActiveStartDate = eventDate;
                isCurrentlyPaused = false;
            }
        } else if (ods.NATURE_ODS === 'ايقاف') {
            if (!isCurrentlyPaused && lastActiveStartDate) {
                consumedWorkDays += calculateElapsedDays(lastActiveStartDate, eventDate, useFinancialRule);
                isCurrentlyPaused = true;
                lastActiveStartDate = null;
            }
        }
    }

    if (!isCurrentlyPaused && lastActiveStartDate) {
        consumedWorkDays += calculateElapsedDays(lastActiveStartDate, today, useFinancialRule);
    }

    const workDaysRemaining = totalDurationAllowed - consumedWorkDays;

    // Projected Deadline Date Calculation
    let totalPauseDays = 0;
    let pauseStartDate: Date | null = null;
    let lastOdsType = '';
    
    const firstStartOds = sortedOds.find(o => o.NATURE_ODS === 'انطلاق');
    if (!firstStartOds) return { text: "خطأ", isRunning: false };

    for (const ods of sortedOds) {
        if (ods.NATURE_ODS === 'ايقاف' && lastOdsType !== 'ايقاف') {
            pauseStartDate = ods.parsedDate!;
        } else if ((ods.NATURE_ODS === 'استئناف') && pauseStartDate) {
            // Pause days are always real calendar days added to the deadline
            totalPauseDays += Math.round((ods.parsedDate!.getTime() - pauseStartDate.getTime()) / (1000 * 3600 * 24));
            pauseStartDate = null;
        }
        lastOdsType = ods.NATURE_ODS;
    }

    const projectedDeadline = new Date(firstStartOds.parsedDate!.getTime());
    // Adding duration days + all accumulated pause days
    projectedDeadline.setDate(projectedDeadline.getDate() + totalDurationAllowed + totalPauseDays);
    
    const d = String(projectedDeadline.getDate()).padStart(2, '0');
    const m = String(projectedDeadline.getMonth() + 1).padStart(2, '0');
    const y = projectedDeadline.getFullYear();
    const dateStr = `${d}/${m}/${y}`;

    if (isCurrentlyPaused) {
        return { text: `متوقفة (باقي ${workDaysRemaining} يوم)`, isRunning: false, remaining: workDaysRemaining };
    } else {
        if (workDaysRemaining < 0) {
            return { text: `تجاوز (${Math.abs(workDaysRemaining)} يوم) - ${dateStr}`, isRunning: true, remaining: workDaysRemaining };
        }
        return { text: `${dateStr} (باقي ${workDaysRemaining} يوم)`, isRunning: true, remaining: workDaysRemaining };
    }
};


const ProjectTrackingPage: React.FC<ProjectTrackingPageProps> = ({ navigate, onGoBack, currentUser }) => {
    const { db, loading } = useData();
    const { t } = useLanguage();
    const [selectedOpId, setSelectedOpId] = useState<string>('');
    const [filterProjectId, setFilterProjectId] = useState<string>('');
    const [filterBeneficiaryId, setFilterBeneficiaryId] = useState<string>(''); 
    const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

    const getBeneficiaireName = useMemo(() => (id: number | null) => {
        if (!id) return '---';
        return db.T_BENEFICIAIRE.find(b => safeId(b.ID_BENEFICIAIRE) === safeId(id))?.BENEFICIAIRE || 'غير معروف';
    }, [db.T_BENEFICIAIRE]);

    const availableProjects = useMemo(() => {
        if (!selectedOpId) return [];
        let projects = db.T_PIECE.filter(p => 
            safeId(p.ID_OPERATION) === safeId(selectedOpId) && 
            ['صفقة', 'اتفاقية'].includes(p.NAT_PIECE)
        ).sort((a, b) => safeId(a.ID_PIECE) - safeId(b.ID_PIECE));
        if (filterBeneficiaryId) {
            projects = projects.filter(p => safeId(p.ID_BENEFICIAIRE) === safeId(filterBeneficiaryId));
        }
        return projects;
    }, [selectedOpId, db.T_PIECE, filterBeneficiaryId]);

    const availableBeneficiaries = useMemo(() => {
        if (!selectedOpId) return [];
        const projects = db.T_PIECE.filter(p => 
            safeId(p.ID_OPERATION) === safeId(selectedOpId) && 
            ['صفقة', 'اتفاقية'].includes(p.NAT_PIECE)
        );
        const beneficiaryIds = new Set(projects.map(p => safeId(p.ID_BENEFICIAIRE)).filter(id => id > 0));
        return db.T_BENEFICIAIRE.filter(b => beneficiaryIds.has(safeId(b.ID_BENEFICIAIRE))).sort((a, b) => safeId(a.ID_BENEFICIAIRE) - safeId(b.ID_BENEFICIAIRE));
    }, [selectedOpId, db.T_PIECE, db.T_BENEFICIAIRE]);

    const projectTrackingData = useMemo(() => {
        if (!selectedOpId) return [];
        
        let projects = db.T_PIECE.filter(p => 
            safeId(p.ID_OPERATION) === safeId(selectedOpId) && 
            ['صفقة', 'اتفاقية'].includes(p.NAT_PIECE)
        );

        if (filterProjectId) {
            projects = projects.filter(p => safeId(p.ID_PIECE) === safeId(filterProjectId));
        }

        if (filterBeneficiaryId) {
            projects = projects.filter(p => safeId(p.ID_BENEFICIAIRE) === safeId(filterBeneficiaryId));
        }
    
        projects.sort((a, b) => safeId(a.ID_PIECE) - safeId(b.ID_PIECE));

        return projects.map(projectPiece => {
            const projectId = safeId(projectPiece.ID_PIECE);

            const lotPieces = db.T_LOT_PIECE.filter(lp => safeId(lp.ID_PIECE) === projectId);
            
            const lots = lotPieces.map(lp => {
                const lotOp = db.T_LOT_OPERATION.find(lot => safeId(lot.ID_LOT) === safeId(lp.ID_LOT));
                if (!lotOp) return null;
                return {
                    ...lotOp,
                    duration: lp.DELAI_EX_JOURS || projectPiece.DELAI_EX_JOURS
                };
            }).filter((lot): lot is (LotOperation & { duration: string | null }) => lot !== null)
              .sort((a, b) => safeId(a.ID_LOT) - safeId(b.ID_LOT));

            const lotsCommitment = lots.reduce((sum, lot) => sum + safeFloat(lot.MONTANT_FINALE_LOT), 0);

            const amendments = db.T_PIECE.filter(p => p.NAT_PIECE === 'ملحق' && safeId(p.ID_PIECE_INIT) === projectId);
            const terminations = db.T_PIECE.filter(p => p.NAT_PIECE === 'قرار فسخ' && safeId(p.ID_PIECE_INIT) === projectId);
            
            const baseAmount = safeFloat(projectPiece.MONTANT_PIECE);
            const amendmentsSum = amendments.reduce((sum, p) => sum + safeFloat(p.MONTANT_PIECE), 0);
            const terminationsSum = terminations.reduce((sum, p) => sum + safeFloat(p.MONTANT_PIECE), 0);
            
            const finalCommittedAmount = baseAmount + amendmentsSum + terminationsSum;

            const contractIdNum = projectId;
            const level1Ids = db.T_PIECE.filter(p => safeId(p.ID_PIECE_INIT) === contractIdNum).map(p => safeId(p.ID_PIECE));
            const level2Ids = db.T_PIECE.filter(p => {
                    const parentId = safeId(p.ID_PIECE_INIT);
                    return parentId > 0 && level1Ids.includes(parentId);
                }).map(p => safeId(p.ID_PIECE));
            const allRelatedPieceIds = new Set([contractIdNum, ...level1Ids, ...level2Ids]);
            const paymentAmount = db.T_PAIEMENT
                .filter(p => allRelatedPieceIds.has(safeId(p.ID_PIECE)))
                .reduce((sum, p) => sum + safeFloat(p.MONTANT_PAI), 0);
            
            const remainingAmount = finalCommittedAmount - paymentAmount;
            const completionPercentage = finalCommittedAmount > 0 ? (paymentAmount / finalCommittedAmount) * 100 : 0;

            const allOds = db.T_ODS.filter(ods => safeId(ods.ID_PIECE) === projectId);
            
            // New Data Points
            const startOds = allOds.find(o => o.NATURE_ODS === 'انطلاق');
            const workStartDate = startOds ? normalizeDate(startOds.DATE_ODS) : '---';
            
            const handoverOds = allOds.find(o => o.NATURE_ODS === 'ختام');
            const handoverDate = handoverOds ? normalizeDate(handoverOds.DATE_ODS) : '---';

            const engagement = db.T_ENGAGEMENT.find(e => e.ID_PIECE === projectId);
            const visaInfo = engagement && engagement.N_VISA_CB 
                ? `${engagement.N_VISA_CB} في ${normalizeDate(engagement.DATE_VISA_CB)}` 
                : '---';

            const cfVisaInfo = projectPiece.N_VISA_CM
                ? `${projectPiece.N_VISA_CM} في ${normalizeDate(projectPiece.DATE_VISA_CM)}`
                : '---';

            let deadlineText = '';
            
            if (terminations.length > 0) {
                deadlineText = "تم فسخ العقد";
            } else if (lots.length > 0) {
                const deadlines = lots.map(lot => {
                    const lotOds = allOds.filter(o => !o.ID_LOT || o.ID_LOT === lot.ID_LOT);
                    const state = calculateDeadlineState(lot.duration, lotOds);
                    return `حصة ${lot.N_LOT}: ${state.text}`;
                });
                deadlineText = deadlines.join('\n');
            } else {
                const state = calculateDeadlineState(projectPiece.DELAI_EX_JOURS, allOds);
                deadlineText = state.text;
            }

            let displayDuration = '---';
            if (projectPiece.DELAI_EX_JOURS) {
                const dur = projectPiece.DELAI_EX_JOURS.toLowerCase();
                if (isFinancialDuration(dur)) {
                   const num = parseInt(dur, 10);
                   displayDuration = `${num} شهر`;
                } else {
                   displayDuration = `${dur} يوم`;
                }
            }

            return {
                id: projectPiece.ID_PIECE,
                projectPiece,
                lots,
                beneficiary: getBeneficiaireName(projectPiece.ID_BENEFICIAIRE),
                lotsCommitment,
                finalCommittedAmount,
                paymentAmount,
                remainingAmount,
                completionPercentage,
                deadline: deadlineText,
                duration: displayDuration,
                workStartDate,
                handoverDate,
                visaInfo,
                cfVisaInfo
            };
        });
    }, [db, selectedOpId, getBeneficiaireName, filterProjectId, filterBeneficiaryId]);

    const projectTrackingTotals = useMemo(() => {
        return projectTrackingData.reduce((acc, curr) => ({
            lotsCommitment: acc.lotsCommitment + curr.lotsCommitment,
            finalCommittedAmount: acc.finalCommittedAmount + curr.finalCommittedAmount,
            paymentAmount: acc.paymentAmount + curr.paymentAmount,
            remainingAmount: acc.remainingAmount + curr.remainingAmount,
        }), { lotsCommitment: 0, finalCommittedAmount: 0, paymentAmount: 0, remainingAmount: 0 });
    }, [projectTrackingData]);

    const projectOds = useMemo(() => {
        if (!selectedProjectId) return [];
        return db.T_ODS
            .filter(ods => safeId(ods.ID_PIECE) === safeId(selectedProjectId))
            .sort((a, b) => {
                const dateA = parseDate(a.DATE_ODS)?.getTime() || 0;
                const dateB = parseDate(b.DATE_ODS)?.getTime() || 0;
                return dateA - dateB;
            });
    }, [selectedProjectId, db.T_ODS]);

    const projectAmendments = useMemo(() => {
        if (!selectedProjectId) return [];
        return db.T_PIECE.filter(p => 
            p.NAT_PIECE === 'ملحق' && 
            safeId(p.ID_PIECE_INIT) === safeId(selectedProjectId)
        ).sort((a, b) => safeId(a.ID_PIECE) - safeId(b.ID_PIECE));
    }, [selectedProjectId, db.T_PIECE]);
    
    const projectWorkStatements = useMemo(() => {
        if (!selectedProjectId) return [];
        const childPieces = db.T_PIECE.filter(p => safeId(p.ID_PIECE_INIT) === safeId(selectedProjectId));
        return childPieces
            .filter(p => ['وضعية الأشغال', 'وضعية التسبيق الجزافي', 'وضعية التسبيق على التموين'].includes(p.NAT_PIECE))
            .sort((a,b) => a.PIECE.localeCompare(b.PIECE))
            .map(piece => {
                const payment = db.T_PAIEMENT.find(pai => pai.ID_PIECE === piece.ID_PIECE);
                return {
                    ...piece,
                    dateAdmis: payment?.DATE_ADMIS
                };
            });
    }, [selectedProjectId, db.T_PIECE, db.T_PAIEMENT]);

    const handleExportProjectTracking = () => {
        if (!projectTrackingData || projectTrackingData.length === 0) {
            alert('لا توجد بيانات لتصديرها.');
            return;
        }
        
        const headers = [
            t('col.project'), t('col.beneficiary'), t('col.duration'), t('col.work_start_date'), t('col.cf_visa'), t('col.budget_visa'), t('col.lot_final_commitment'), t('col.final_commitment'),
            t('col.payment_amount'), t('col.remaining_progress'), 'نسبة الإنجاز (%)', t('col.completion_date'), t('col.handover_date')
        ];
        
        const styles = `
            <style>
                table, th, td { border: 1px solid black; border-collapse: collapse; text-align: right; padding: 5px; font-family: Arial, sans-serif; vertical-align: top; }
                th { background-color: #DDEBF7; font-weight: bold; text-align: center; }
                .total { background-color: #A9D08E; font-weight: bold; }
                td { mso-number-format:"\\#\\,##0\\.00"; }
                .percent { mso-number-format:"0\\.00%"; }
                .text { mso-number-format:"\\@"; white-space: pre-wrap; }
            </style>
        `;
        
        let tableHtml = `${styles}<table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>`;
    
        projectTrackingData.forEach(project => {
            const lotsHtml = project.lots.map(l => `- حصة ${l.N_LOT}: ${l.INTITULE_LOT}`).join('\n');
            const projectName = project.projectPiece.PIECE + (lotsHtml ? '\n' + lotsHtml : '');
            
            tableHtml += `<tr>
                <td class="text">${projectName}</td>
                <td class="text">${project.beneficiary}</td>
                <td class="text">${project.duration}</td>
                <td class="text">${project.workStartDate}</td>
                <td class="text">${project.cfVisaInfo}</td>
                <td class="text">${project.visaInfo}</td>
                <td>${formatCurrencyForExcel(project.lotsCommitment)}</td>
                <td>${formatCurrencyForExcel(project.finalCommittedAmount)}</td>
                <td>${formatCurrencyForExcel(project.paymentAmount)}</td>
                <td>${formatCurrencyForExcel(project.remainingAmount)}</td>
                <td>${project.completionPercentage.toFixed(2)}%</td>
                <td class="text">${project.deadline}</td>
                <td class="text">${project.handoverDate}</td>
            </tr>`;
        });
    
        tableHtml += `</tbody><tfoot><tr class="total">
            <td colspan="6">${t('lbl.total')}</td>
            <td>${formatCurrencyForExcel(projectTrackingTotals.lotsCommitment)}</td>
            <td>${formatCurrencyForExcel(projectTrackingTotals.finalCommittedAmount)}</td>
            <td>${formatCurrencyForExcel(projectTrackingTotals.paymentAmount)}</td>
            <td>${formatCurrencyForExcel(projectTrackingTotals.remainingAmount)}</td>
            <td colspan="3"></td>
        </tr></tfoot></table>`;
        
        exportToFormattedExcel(tableHtml, `project_tracking_op_${selectedOpId}.xls`);
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
        return ops.slice().sort((a, b) => a.ID_OPERATION - b.ID_OPERATION).map(op => ({ value: op.ID_OPERATION, label: op.INT_OPERATION }));
    }, [db.T_OPERATION, currentUser]);

    const beneficiaryOptions = useMemo(() => availableBeneficiaries.map(b => ({ value: b.ID_BENEFICIAIRE, label: b.BENEFICIAIRE })), [availableBeneficiaries]);
    const projectOptions = useMemo(() => availableProjects.map(p => ({ value: p.ID_PIECE, label: p.PIECE })), [availableProjects]);

    if (loading) return <div>{t('loading')}</div>;

    return (
        <PageWrapper title={t('page.project_tracking')} navigate={navigate} onGoBack={onGoBack} backPage="FINANCIAL_STATUS" currentUser={currentUser}>
             <div className="bg-blue-150 p-3 rounded-lg shadow-md mb-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">{t('filter.operation')}</label>
                        <CustomDropdown
                            options={operationOptions}
                            value={selectedOpId}
                            onChange={(val) => { setSelectedOpId(val); setFilterProjectId(''); setFilterBeneficiaryId(''); setSelectedProjectId(null); }}
                            placeholder={t('filter.select_operation')}
                            className="mt-1"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">{t('filter.beneficiary')}</label>
                        <CustomDropdown
                            options={beneficiaryOptions}
                            value={filterBeneficiaryId}
                            onChange={(val) => { setFilterBeneficiaryId(val); setFilterProjectId(''); setSelectedProjectId(null); }}
                            placeholder={t('filter.all_beneficiaries')}
                            disabled={!selectedOpId}
                            className="mt-1"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">{t('filter.project')}</label>
                        <CustomDropdown
                            options={projectOptions}
                            value={filterProjectId}
                            onChange={(val) => { setFilterProjectId(val); setSelectedProjectId(null); }}
                            placeholder={t('filter.all_projects')}
                            disabled={!selectedOpId}
                            className="mt-1"
                        />
                    </div>
                    <div className="flex items-end gap-2">
                        <button onClick={() => navigate('PRINT_PROJECT_TRACKING', parseInt(selectedOpId))} disabled={!selectedOpId} className="bg-blue-500 text-white px-2 py-0.5 rounded hover:bg-blue-600 transition-colors w-full disabled:bg-gray-400 disabled:cursor-not-allowed h-8 text-xs">
                            <i className="bi bi-printer mr-2"></i> {t('btn.print')}
                        </button>
                        <button onClick={handleExportProjectTracking} disabled={!selectedOpId || projectTrackingData.length === 0} className="bg-teal-500 text-white px-2 py-0.5 rounded hover:bg-teal-600 transition-colors w-full disabled:bg-gray-400 disabled:cursor-not-allowed h-8 text-xs">
                            <i className="bi bi-file-earmark-excel mr-2"></i> {t('btn.export_excel')} 
                        </button>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <div className="bg-white p-3 rounded-lg shadow-md overflow-auto max-h-[50vh] custom-scrollbar">
                    <h3 className="text-base font-bold mb-3">{t('lbl.projects_table')}</h3>
                     {projectTrackingData.length > 0 ? (
                        <table className="w-full text-right min-w-[1400px] relative">
                            <thead className="bg-blue-100 text-gray-700 sticky top-0 z-20 shadow-sm">
                                <tr>
                                    <th className="p-1 text-xs font-semibold bg-blue-100 z-20 sticky top-0 text-gray-700 uppercase">{t('col.project')}</th>
                                    <th className="p-1 text-xs font-semibold bg-blue-100 z-20 sticky top-0 text-gray-700 uppercase">{t('col.beneficiary')}</th>
                                    <th className="p-1 text-xs font-semibold bg-blue-100 z-20 sticky top-0 text-gray-700 uppercase">{t('col.duration')}</th>
                                    <th className="p-1 text-xs font-semibold bg-blue-100 z-20 sticky top-0 text-gray-700 uppercase">{t('col.work_start_date')}</th>
                                    <th className="p-1 text-xs font-semibold bg-blue-100 z-20 sticky top-0 text-gray-700 uppercase">{t('col.cf_visa')}</th>
                                    <th className="p-1 text-xs font-semibold bg-blue-100 z-20 sticky top-0 text-gray-700 uppercase">{t('col.budget_visa')}</th>
                                    <th className="p-1 text-xs font-semibold bg-blue-100 z-20 sticky top-0 text-gray-700 uppercase">{t('col.lot_final_commitment')}</th>
                                    <th className="p-1 text-xs font-semibold bg-blue-100 z-20 sticky top-0 text-gray-700 uppercase">{t('col.final_commitment')}</th>
                                    <th className="p-1 text-xs font-semibold bg-blue-100 z-20 sticky top-0 text-gray-700 uppercase">{t('col.payment_amount')}</th>
                                    <th className="p-1 text-xs font-semibold bg-blue-100 z-20 sticky top-0 text-gray-700 uppercase">{t('col.remaining_progress')}</th>
                                    <th className="p-1 text-xs font-semibold bg-blue-100 z-20 sticky top-0 text-gray-700 uppercase">{t('col.completion_date')}</th>
                                    <th className="p-1 text-xs font-semibold bg-blue-100 z-20 sticky top-0 text-gray-700 uppercase">{t('col.handover_date')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {projectTrackingData.map(project => (
                                    <tr key={project.id} className={`border-b text-xs hover:bg-blue-100 cursor-pointer transition-colors ${selectedProjectId === project.id ? 'bg-blue-200 ring-2 ring-offset-2 ring-offset-slate-50 dark:ring-offset-slate-500' : ''}`} onClick={() => setSelectedProjectId(project.id)}>
                                        <td className="p-1 text-gray-800 font-medium align-top">
                                            <span>{project.projectPiece.PIECE}</span>
                                            {project.lots.length > 0 && (
                                                <div className="text-[9px] text-gray-500 font-normal pt-1 pr-2">
                                                    {project.lots.map(l => (
                                                        <div key={l.ID_LOT}>- حصة {l.N_LOT}: {l.INTITULE_LOT}</div>
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-1 text-gray-700 align-top">{project.beneficiary}</td>
                                        <td className="p-1 text-gray-700 align-top text-center">{project.duration}</td>
                                        <td className="p-1 text-gray-700 align-top text-center">{project.workStartDate}</td>
                                        <td className="p-1 text-gray-600 align-top text-center text-[10px]">{project.cfVisaInfo}</td>
                                        <td className="p-1 text-gray-600 align-top text-center text-[10px]">{project.visaInfo}</td>
                                        <td className="p-1 text-gray-700 align-top">{formatCurrency(project.lotsCommitment)}</td>
                                        <td className="p-1 text-gray-700 font-bold align-top">{formatCurrency(project.finalCommittedAmount)}</td>
                                        <td className="p-1 text-gray-700 align-top">{formatCurrency(project.paymentAmount)}</td>
                                        <td className="p-1 font-semibold align-top">
                                            <span className="text-blue-600 block">{formatCurrency(project.remainingAmount)}</span>
                                            <span className="text-green-600 block">({project.completionPercentage.toFixed(2)}%)</span>
                                        </td>
                                        <td className={`p-1 align-top whitespace-pre-wrap ${project.deadline.includes('فسخ') || project.deadline.includes('تجاوز') ? 'text-red-600 font-bold' : 'text-gray-700'}`}>{project.deadline}</td>
                                        <td className="p-1 text-gray-700 align-top text-center">{project.handoverDate}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-gray-200 font-bold text-xs text-gray-800 sticky bottom-0 z-20 shadow-[0_-2px_10px_rgba(0,0,0,0.1)]">
                                <tr>
                                    <td className="p-1 text-center bg-gray-200" colSpan={6}>{t('lbl.total')}</td>
                                    <td className="p-1 bg-gray-200">{formatCurrency(projectTrackingTotals.lotsCommitment)}</td>
                                    <td className="p-1 bg-gray-200">{formatCurrency(projectTrackingTotals.finalCommittedAmount)}</td>
                                    <td className="p-1 bg-gray-200">{formatCurrency(projectTrackingTotals.paymentAmount)}</td>
                                    <td className="p-1 bg-gray-200">{formatCurrency(projectTrackingTotals.remainingAmount)}</td>
                                    <td colSpan={2} className="bg-gray-200"></td>
                                </tr>
                            </tfoot>
                        </table>
                    ) : (
                        <p className="text-center p-4 text-xs text-gray-500">{t('lbl.no_projects')}</p>
                    )}
                </div>

                <div className="bg-white p-3 rounded-lg shadow-md overflow-auto max-h-64 custom-scrollbar">
                    <h3 className="text-base font-bold mb-3">{t('lbl.ods_table')}</h3>
                    {selectedProjectId ? (
                        projectOds.length > 0 ? (
                        <table className="w-full text-right min-w-[300px] relative">
                            <thead className="bg-blue-100 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="p-1 text-xs font-semibold bg-blue-100 text-gray-700 uppercase sticky top-0 z-10">رقم و تاريخ الأمر</th>
                                    <th className="p-1 text-xs font-semibold bg-blue-100 text-gray-700 uppercase sticky top-0 z-10">{t('col.nature')}</th>
                                    <th className="p-1 text-xs font-semibold bg-blue-100 text-gray-700 uppercase sticky top-0 z-10">{t('col.scope')}</th>
                                    <th className="p-1 text-xs font-semibold bg-blue-100 text-gray-700 uppercase sticky top-0 z-10">{t('col.date')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {projectOds.map(ods => {
                                    const lot = ods.ID_LOT ? db.T_LOT_OPERATION.find(l => l.ID_LOT === ods.ID_LOT) : null;
                                    return (
                                        <tr key={ods.ID_ODS} className="border-b text-xs">
                                            <td className="p-1 text-gray-800">{ods.OBJET_ODS}</td>
                                            <td className="p-1 text-gray-700">{ods.NATURE_ODS}</td>
                                            <td className="p-1 text-gray-700">{lot ? `حصة ${lot.N_LOT}` : 'عام'}</td>
                                            <td className="p-1 text-gray-700">{normalizeDate(ods.DATE_ODS)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        ) : (
                            <p className="text-center p-2 text-xs text-gray-500">{t('lbl.no_data')}</p>
                        )
                    ) : (
                        <p className="text-center p-2 text-xs text-gray-500">الرجاء تحديد مشروع من جدول المشاريع أعلاه.</p>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-white p-3 rounded-lg shadow-md overflow-auto max-h-64 custom-scrollbar">
                        <h3 className="text-base font-bold mb-3">{t('lbl.amendments_table')}</h3>
                        {selectedProjectId ? (
                            projectAmendments.length > 0 ? (
                            <table className="w-full text-right min-w-[300px] relative">
                                <thead className="bg-blue-100 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="p-1 text-xs font-semibold bg-blue-100 text-gray-700 uppercase sticky top-0 z-10">موضوع الملحق</th>
                                        <th className="p-1 text-xs font-semibold bg-blue-100 text-gray-700 uppercase sticky top-0 z-10">{t('col.amount')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {projectAmendments.map(piece => (
                                        <tr key={piece.ID_PIECE} className="border-b text-xs">
                                            <td className="p-1 text-gray-800">{piece.PIECE}</td>
                                            <td className="p-1 text-gray-700">{formatCurrency(safeFloat(piece.MONTANT_PIECE))}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-gray-200 font-bold text-xs text-gray-800 sticky bottom-0 z-10 shadow-[0_-2px_10px_rgba(0,0,0,0.1)]">
                                    <tr>
                                        <td className="p-1 text-center bg-gray-200">{t('lbl.total')}</td>
                                        <td className="p-1 bg-gray-200">{formatCurrency(projectAmendments.reduce((sum, p) => sum + safeFloat(p.MONTANT_PIECE), 0))}</td>
                                    </tr>
                                </tfoot>
                            </table>
                            ) : (
                                <p className="text-center p-2 text-xs text-gray-500">{t('lbl.no_data')}</p>
                            )
                        ) : (
                            <p className="text-center p-2 text-xs text-gray-500">الرجاء تحديد مشروع لعرض الملاحق.</p>
                        )}
                    </div>

                    <div className="bg-white p-3 rounded-lg shadow-md overflow-auto max-h-64 custom-scrollbar">
                        <h3 className="text-base font-bold mb-3">{t('lbl.work_statements_table')}</h3>
                        {selectedProjectId ? (
                            projectWorkStatements.length > 0 ? (
                            <table className="w-full text-right min-w-[300px] relative">
                                <thead className="bg-blue-100 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="p-1 text-xs font-semibold bg-blue-100 text-gray-700 uppercase sticky top-0 z-10">وثيقة وضعية الأشغال</th>
                                        <th className="p-1 text-xs font-semibold bg-blue-100 text-gray-700 uppercase sticky top-0 z-10">مبلغ الوضعية</th>
                                        <th className="p-1 text-xs font-semibold bg-blue-100 text-gray-700 uppercase sticky top-0 z-10">{t('col.payment_date_accepted')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {projectWorkStatements.map(item => (
                                        <tr key={item.ID_PIECE} className="border-b text-xs">
                                            <td className="p-1 text-gray-800">{item.PIECE}</td>
                                            <td className="p-1 text-gray-700">{formatCurrency(safeFloat(item.MONTANT_PIECE))}</td>
                                            <td className="p-1 text-gray-700">{normalizeDate(item.dateAdmis)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-gray-200 font-bold text-xs text-gray-800 sticky bottom-0 z-10 shadow-[0_-2px_10px_rgba(0,0,0,0.1)]">
                                    <tr>
                                        <td className="p-1 text-center bg-gray-200">{t('lbl.total')}</td>
                                        <td className="p-1 bg-gray-200">{formatCurrency(projectWorkStatements.reduce((sum, p) => sum + safeFloat(p.MONTANT_PIECE), 0))}</td>
                                        <td className="bg-gray-200"></td>
                                    </tr>
                                </tfoot>
                            </table>
                            ) : (
                                <p className="text-center p-2 text-xs text-gray-500">{t('lbl.no_data')}</p>
                            )
                        ) : (
                            <p className="text-center p-2 text-xs text-gray-500">الرجاء تحديد مشروع لعرض وضعيات الأشغال.</p>
                        )}
                    </div>
                </div>
            </div>
        </PageWrapper>
    );
};

export default ProjectTrackingPage;
