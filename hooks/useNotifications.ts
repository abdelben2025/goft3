
import { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { Notification, User } from '../types';
import { getEffectiveDurationDays, parseDate, isFinancialDuration, calculateElapsedDays } from '../utils/dateUtils';
import { formatCurrency } from '../utils/currencyUtils';

export const useNotifications = (currentUser?: User): Notification[] => {
    const { db, loading } = useData();

    // Normalize IDs to handle potential string/number mismatches (e.g. from Supabase or legacy data)
    const normalizeId = (val: any): number => {
        if (val === null || val === undefined) return -1;
        const n = Number(val);
        return isNaN(n) ? -1 : n;
    };

    return useMemo(() => {
        if (loading) {
            return [];
        }

        let pieces = db.T_PIECE;
        let engagements = db.T_ENGAGEMENT;
        let paiements = db.T_PAIEMENT;
        let odsData = db.T_ODS;
        
        // Filter by authorization if not admin
        if (currentUser && currentUser.ROLE !== 'admin' && currentUser.ALLOWED_OPERATIONS) {
            try {
                const allowedOps = JSON.parse(currentUser.ALLOWED_OPERATIONS) as number[];
                if (allowedOps.length > 0) {
                    pieces = pieces.filter(p => allowedOps.includes(p.ID_OPERATION));
                    engagements = engagements.filter(e => allowedOps.includes(e.ID_OPERATION));
                    paiements = paiements.filter(p => allowedOps.includes(p.ID_OPERATION));
                    odsData = odsData.filter(o => {
                        const piece = db.T_PIECE.find(p => p.ID_PIECE === o.ID_PIECE);
                        return piece && allowedOps.includes(piece.ID_OPERATION);
                    });
                }
            } catch (e) {
                console.error("Error parsing allowed operations in useNotifications", e);
            }
        }

        const deadlineNotifications: Notification[] = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const piecesWithDeadline = pieces.filter(p => p.DELAI_EX_JOURS && parseInt(p.DELAI_EX_JOURS, 10) > 0);

        for (const piece of piecesWithDeadline) {
            try {
                const allPieceOds = odsData
                    .filter(ods => ods.ID_PIECE === piece.ID_PIECE)
                    .map(ods => ({ ...ods, parsedDate: parseDate(ods.DATE_ODS) }))
                    .filter(ods => ods.parsedDate !== null)
                    .sort((a, b) => a.parsedDate!.getTime() - b.parsedDate!.getTime());

                const lotPieces = db.T_LOT_PIECE.filter(lp => lp.ID_PIECE === piece.ID_PIECE);
                
                const checkDeadline = (durationStr: string, odsList: typeof allPieceOds, titleSuffix: string, idSuffix: string) => {
                    const totalDurationAllowed = getEffectiveDurationDays(durationStr);
                    const useFinancialRule = isFinancialDuration(durationStr);

                    if (totalDurationAllowed <= 0 || odsList.length === 0 || odsList[0].NATURE_ODS !== 'انطلاق' || odsList.some(ods => ods.NATURE_ODS === 'ختام')) {
                        return;
                    }

                    let consumedWorkDays = 0;
                    let lastActiveStartDate: Date | null = null;
                    let isCurrentlyPaused = true;

                    for (const ods of odsList) {
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

                    let totalPauseDays = 0;
                    let pauseStartDate: Date | null = null;
                    let lastOdsType = '';
                    for (const ods of odsList) {
                        if (ods.NATURE_ODS === 'ايقاف' && lastOdsType !== 'ايقاف') {
                            pauseStartDate = ods.parsedDate!;
                        } else if ((ods.NATURE_ODS === 'استئناف') && pauseStartDate) {
                            totalPauseDays += Math.round((ods.parsedDate!.getTime() - pauseStartDate.getTime()) / (1000 * 3600 * 24));
                            pauseStartDate = null;
                        }
                        lastOdsType = ods.NATURE_ODS;
                    }
                    const deadline = new Date(odsList[0].parsedDate!.getTime());
                    deadline.setDate(deadline.getDate() + totalDurationAllowed + totalPauseDays);
                    deadline.setHours(0, 0, 0, 0);

                    const beneficiary = db.T_BENEFICIAIRE.find(b => b.ID_BENEFICIAIRE === piece.ID_BENEFICIAIRE);
                    
                    let displayTitle = `"${piece.PIECE}"`;
                    if (titleSuffix) displayTitle += ` (${titleSuffix})`;
                    if (beneficiary) displayTitle += ` - المستفيد: ${beneficiary.BENEFICIAIRE}`;

                    if (workDaysRemaining < 0) {
                        const suffix = isCurrentlyPaused ? ' (متوقف حالياً)' : '';
                        deadlineNotifications.push({
                            id: `piece-${piece.ID_PIECE}-${idSuffix}-overdue`,
                            type: 'overdue',
                            message: `${displayTitle} متأخرة بـ ${-workDaysRemaining} يوم عمل.${suffix}`,
                            pieceId: piece.ID_PIECE,
                            operationId: piece.ID_OPERATION,
                            deadline: deadline,
                            days: workDaysRemaining,
                        });
                    } else if (workDaysRemaining <= 30) {
                        const suffix = isCurrentlyPaused ? ' (متوقف حالياً)' : '';
                        const message = `${displayTitle} تستحق في غضون ${workDaysRemaining} يوم عمل.${suffix}`;
                        
                        deadlineNotifications.push({
                            id: `piece-${piece.ID_PIECE}-${idSuffix}-upcoming`,
                            type: 'upcoming',
                            message: message,
                            pieceId: piece.ID_PIECE,
                            operationId: piece.ID_OPERATION,
                            deadline: deadline,
                            days: workDaysRemaining,
                        });
                    }
                };

                const globalOds = allPieceOds.filter(o => !o.ID_LOT);
                if (globalOds.length > 0 && piece.DELAI_EX_JOURS) {
                    checkDeadline(piece.DELAI_EX_JOURS, globalOds, 'عام', 'global');
                }

                for (const lp of lotPieces) {
                    const durationStr = lp.DELAI_EX_JOURS || piece.DELAI_EX_JOURS;
                    if (!durationStr) continue;

                    const lotOds = allPieceOds.filter(o => o.ID_LOT === lp.ID_LOT);
                    
                    if (lotOds.length > 0) {
                        const lot = db.T_LOT_OPERATION.find(l => l.ID_LOT === lp.ID_LOT);
                        const lotTitle = lot ? `حصة ${lot.N_LOT}` : 'حصة غير معروفة';
                        checkDeadline(durationStr, lotOds, lotTitle, `lot-${lp.ID_LOT}`);
                    }
                }

            } catch (e) {
                console.error("Error processing notifications for piece:", piece.ID_PIECE, e);
            }
        }
        
        // 2. Unapproved Engagements (Missing Visa)
        const unapprovedEngagements: Notification[] = [];
        engagements.forEach(eng => {
            if (!eng.N_VISA_CB || !eng.DATE_VISA_CB) {
                const operation = db.T_OPERATION.find(op => op.ID_OPERATION === eng.ID_OPERATION);
                unapprovedEngagements.push({
                    id: `eng-unapproved-${eng.ID_ENGAGEMENT}`,
                    type: 'unapproved_engagement',
                    message: `${eng.NATURE_ENG} رقم ${eng.N_ENG}/${eng.ANNEE} للعملية "${operation?.INT_OPERATION}"`,
                    operationId: eng.ID_OPERATION,
                    engagementId: eng.ID_ENGAGEMENT
                });
            }
        });

        // 3. Unaccepted Payments (Missing Admission Date)
        const unacceptedPayments: Notification[] = [];
        paiements.forEach(pai => {
            if (!pai.DATE_ADMIS) {
                const piece = pieces.find(p => p.ID_PIECE === pai.ID_PIECE);
                const documentName = piece ? piece.PIECE : 'وثيقة غير معروفة';
                
                let beneficiaryName = 'مستفيد غير معروف';
                if (piece && piece.ID_BENEFICIAIRE) {
                    const ben = db.T_BENEFICIAIRE.find(b => b.ID_BENEFICIAIRE === piece.ID_BENEFICIAIRE);
                    if (ben) beneficiaryName = ben.BENEFICIAIRE;
                }

                unacceptedPayments.push({
                    id: `pai-unaccepted-${pai.ID_PAIEMENT}`,
                    type: 'unaccepted_payment',
                    message: `${documentName} - المستفيد: ${beneficiaryName}`,
                    operationId: pai.ID_OPERATION,
                    paiementId: pai.ID_PAIEMENT
                });
            }
        });

        // 4. Core Logic for Documents: Financial Sufficiency and Registration Status
        const currentYear = new Date().getFullYear().toString();
        
        // Maps to keep track of ALREADY REGISTERED consumption
        const opYearCPConsumed = new Map<string, number>();
        const paidPieceIds = new Set<number>();
        paiements.forEach(p => {
            const key = `${p.ID_OPERATION}-${p.ANNEE}`;
            opYearCPConsumed.set(key, (opYearCPConsumed.get(key) || 0) + (p.MONTANT_PAI || 0));
            const pId = normalizeId(p.ID_PIECE);
            if (pId !== -1) paidPieceIds.add(pId);
        });

        const rubOpAEConsumed = new Map<string, number>();
        const committedPieceIds = new Set<number>();
        engagements.forEach(eng => {
            const piece = pieces.find(p => normalizeId(p.ID_PIECE) === normalizeId(eng.ID_PIECE));
            const pId = normalizeId(eng.ID_PIECE);
            if (pId !== -1) committedPieceIds.add(pId);

            if (!piece || !piece.ID_RUBRIQUE) return;
            
            const key = `${normalizeId(eng.ID_OPERATION)}-${normalizeId(piece.ID_RUBRIQUE)}`;
            let amount = eng.MONTANT_ENG || 0;
            if (eng.NATURE_ENG === 'سحب' || eng.NATURE_ENG === 'إنخفاض التقييم') {
                amount = -amount;
            }
            rubOpAEConsumed.set(key, (rubOpAEConsumed.get(key) || 0) + amount);
        });

        const payableTypes = ['فاتورة', 'وضعية الأشغال', 'وضعية التسبيق الجزافي', 'وضعية التسبيق على التموين', 'قرار'];
        const commitmentTypes = ['صفقة', 'اتفاقية', 'ملحق', 'فاتورة', 'مقرر', 'قرار'];

        const piecesNotifications: Notification[] = [];
        
        pieces.forEach(piece => {
            const pieceId = normalizeId(piece.ID_PIECE);
            if (pieceId === -1) return;

            const isCommitment = commitmentTypes.includes(piece.NAT_PIECE);
            const isPayable = payableTypes.includes(piece.NAT_PIECE);
            
            const isUncommitted = isCommitment && !committedPieceIds.has(pieceId);
            const isUnpaid = isPayable && !paidPieceIds.has(pieceId);
            
            if (!isUncommitted && !isUnpaid) return;

            const beneficiary = piece.ID_BENEFICIAIRE ? db.T_BENEFICIAIRE.find(b => b.ID_BENEFICIAIRE === piece.ID_BENEFICIAIRE) : null;
            const pieceAmountFormatted = formatCurrency(piece.MONTANT_PIECE);
            const beneficiaryName = beneficiary ? beneficiary.BENEFICIAIRE : '---';

            let hasFinancialAlert = false;

            // Check AE Insufficiency (Commitment side) - ONLY if not yet committed
            if (isUncommitted && piece.ID_RUBRIQUE) {
                const opIdNormalized = normalizeId(piece.ID_OPERATION);
                const rubIdNormalized = normalizeId(piece.ID_RUBRIQUE);
                const rubOp = db.T_RUBRIQUE_OP.find(ro => normalizeId(ro.ID_OPERATION) === opIdNormalized && normalizeId(ro.ID_RUBRIQUE) === rubIdNormalized);
                const totalAllocatedAE = rubOp ? (rubOp.MONTANT_FINALE ?? rubOp.MONTANT_INITIALE ?? 0) : 0;
                const consumedAE = rubOpAEConsumed.get(`${opIdNormalized}-${rubIdNormalized}`) || 0;

                // Match page logic precisely (direct comparison)
                if (piece.MONTANT_PIECE > (totalAllocatedAE - consumedAE)) {
                    piecesNotifications.push({
                        id: `ae-insufficiency-${pieceId}`,
                        type: 'ae_structure_insufficiency',
                        message: `${piece.PIECE}  مبلغ: ${pieceAmountFormatted}  المستفيد: ${beneficiaryName}`,
                        pieceId: pieceId,
                        operationId: piece.ID_OPERATION
                    });
                    hasFinancialAlert = true;
                }
            }

            // Check CP Insufficiency (Payment side) - ONLY if not yet paid
            if (isUnpaid) {
                const opIdNormalized = normalizeId(piece.ID_OPERATION);
                const cp = db.T_CP.find(c => normalizeId(c.ID_OPERATION) === opIdNormalized && c.ANNEE === currentYear);
                const totalCP = cp ? (cp.MONTANT_FINALE_CP || 0) : 0;
                const consumedCP = opYearCPConsumed.get(`${opIdNormalized}-${currentYear}`) || 0;
                const remainingCP = totalCP - consumedCP;

                // Match page logic precisely (direct comparison)
                if (piece.MONTANT_PIECE > remainingCP) {
                    piecesNotifications.push({
                        id: `cp-insufficiency-${pieceId}`,
                        type: 'payment_claim_alert',
                        message: `${piece.PIECE}  مبلغ: ${pieceAmountFormatted}  المستفيد: ${beneficiaryName}`,
                        pieceId: pieceId,
                        operationId: piece.ID_OPERATION
                    });
                    hasFinancialAlert = true;
                }
            }

            // Standard unregistered alert if no budget issue AND it's NOT SAI_ENG/SAI_PAI (optional clarification)
            if (!hasFinancialAlert) {
                const needsStandardAlert = (isCommitment && !piece.SAI_ENG) || (isPayable && !piece.SAI_PAI);
                if (needsStandardAlert) {
                    piecesNotifications.push({
                        id: `unregistered-${pieceId}`,
                        type: 'unregistered_document',
                        message: `${piece.PIECE}  مبلغ: ${pieceAmountFormatted}  المستفيد: ${beneficiaryName}`,
                        pieceId: pieceId,
                        operationId: piece.ID_OPERATION
                    });
                }
            }
        });

        // Combine everything
        const allNotifications = [
            ...deadlineNotifications, 
            ...unapprovedEngagements, 
            ...unacceptedPayments,
            ...piecesNotifications
        ];

        // 5. ODS Alerts (Service Orders)
        pieces.forEach(p => {
            if (p.DATE_OD_PIECE && p.DELAI_EX_JOURS) {
                const odDate = parseDate(p.DATE_OD_PIECE);
                if (!odDate) return;
                
                const duration = getEffectiveDurationDays(p.DELAI_EX_JOURS);
                const deadline = new Date(odDate.getTime());
                deadline.setDate(deadline.getDate() + duration);
                
                const diffDays = Math.floor((deadline.getTime() - today.getTime()) / (1000 * 3600 * 24));
                
                if (diffDays < 0) {
                    allNotifications.push({
                        id: `od-overdue-${p.ID_PIECE}`,
                        type: 'overdue_service_order',
                        message: `تجاوز تاريخ التنفيذ: ${p.PIECE} (أمر الخدمة رقم ${p.N_OD_PIECE || '---'})`,
                        pieceId: p.ID_PIECE,
                        operationId: p.ID_OPERATION,
                        days: Math.abs(diffDays)
                    });
                } else if (diffDays <= 15) {
                    allNotifications.push({
                        id: `od-approaching-${p.ID_PIECE}`,
                        type: 'approaching_service_order',
                        message: `اقتراب تاريخ التنفيذ: ${p.PIECE} (بقي ${diffDays} يوم)`,
                        pieceId: p.ID_PIECE,
                        operationId: p.ID_OPERATION,
                        days: diffDays
                    });
                }
            }
        });

        // 6. Bordereaux alerts
        const allPiecesWithBordereaux = pieces.filter(p => p.BORDEREAU_PIECE === 'OUI');
        allPiecesWithBordereaux.forEach(p => {
            const hasBordereau = db.T_BORDEREAU.some(b => b.ID_PIECE === p.ID_PIECE);
            if (!hasBordereau) {
                allNotifications.push({
                    id: `bordereau-missing-${p.ID_PIECE}`,
                    type: 'missing_bordereau',
                    message: `الوثيقة "${p.PIECE}" تتطلب جدول إرسال ولم يتم إنشاؤه بعد.`,
                    pieceId: p.ID_PIECE,
                    operationId: p.ID_OPERATION
                });
            }
        });

        return allNotifications.sort((a, b) => {
            const priority = (type: string) => {
                switch(type) {
                    case 'ae_structure_insufficiency':
                    case 'payment_claim_alert':
                    case 'financial_alert': return 0;
                    case 'overdue': 
                    case 'overdue_service_order': return 1;
                    case 'unapproved_engagement': 
                    case 'unaccepted_payment': return 2;
                    case 'unregistered_document': return 3;
                    case 'upcoming': 
                    case 'approaching_service_order': return 4;
                    default: return 5;
                }
            };
            return priority(a.type) - priority(b.type);
        });
    }, [db, loading, currentUser]);
};
