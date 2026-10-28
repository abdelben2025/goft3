import { useMemo } from 'react';
import { Piece, Database } from '../types';
import { parseDate, compareDates, calculateElapsedDays, getEffectiveDurationDays, isFinancialDuration } from '../utils/dateUtils';

export interface UseDocumentDetailsResult {
    associatedLotPieces: any[];
    associatedLotsData: any[];
    associatedLotObjects: any[];
    associatedOds: any[];
    odsCalculations: any;
    selectedPieceDetails: any;
}

/**
 * Shared derived data for a selected document (piece). Reused by DocumentsPage
 * and the dedicated DocumentDetailsPage so both render identical information.
 */
export const useDocumentDetails = (piece: Piece | null, db: Database): UseDocumentDetailsResult => {
    const associatedLotPieces = useMemo(() => {
        if (!piece) return [];
        return db.T_LOT_PIECE.filter(lp => lp.ID_PIECE === piece.ID_PIECE);
    }, [piece, db.T_LOT_PIECE]);

    const associatedLotsData = useMemo(() => {
        return associatedLotPieces.map(lp => {
            const lotInfo = db.T_LOT_OPERATION.find(lot => lot.ID_LOT === lp.ID_LOT);
            if (!lotInfo) return null;
            return {
                ...lotInfo,
                ID_LOT_PIECE: lp.ID_LOT_PIECE,
                DELAI_EX_JOURS: lp.DELAI_EX_JOURS
            };
        }).filter((item): item is NonNullable<typeof item> => item !== null);
    }, [associatedLotPieces, db.T_LOT_OPERATION]);

    const associatedLotObjects = useMemo(() => {
        return associatedLotsData.map(l => ({
            ID_LOT: l.ID_LOT,
            N_LOT: l.N_LOT,
            INTITULE_LOT: l.INTITULE_LOT,
            ID_OPERATION: l.ID_OPERATION,
            MONTANT_INITIALE_LOT: l.MONTANT_INITIALE_LOT,
            MONTANT_FINALE_LOT: l.MONTANT_FINALE_LOT,
            ATTRIBUER: l.ATTRIBUER
        }));
    }, [associatedLotsData]);

    const associatedOds = useMemo(() => {
        if (!piece) return [];
        return db.T_ODS.filter(ods => ods.ID_PIECE === piece.ID_PIECE);
    }, [piece, db.T_ODS]);

    const odsCalculations = useMemo(() => {
        if (!piece || !['صفقة', 'اتفاقية'].includes(piece.NAT_PIECE)) return null;

        const useFinancialRule = isFinancialDuration(piece.DELAI_EX_JOURS);
        const baseDuration = getEffectiveDurationDays(piece.DELAI_EX_JOURS);

        const sortedOds = [...associatedOds].sort((a, b) => compareDates(a.DATE_ODS, b.DATE_ODS));
        const commencementOds = sortedOds.find(o => o.NATURE_ODS === 'انطلاق');

        const terminationDocs = db.T_PIECE.filter(p => p.ID_PIECE_INIT === piece.ID_PIECE && p.NAT_PIECE === 'قرار فسخ');
        const totalTerminatedAmount = terminationDocs.reduce((sum, p) => sum + (p.MONTANT_PIECE || 0), 0);
        const isTerminated = terminationDocs.length > 0;
        const isFullyTerminated = isTerminated && totalTerminatedAmount >= (piece.MONTANT_PIECE || 0);

        if (!commencementOds) return { baseDuration, startDate: null, isTerminated, isFullyTerminated, totalTerminatedAmount };

        const startDate = parseDate(commencementOds.DATE_ODS);
        if (!startDate) return { baseDuration, startDate: null, isTerminated, isFullyTerminated, totalTerminatedAmount };

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // ── Walk the ODS timeline ──
        // Consumed days = sum of ACTIVE periods (انطلاق/استئناف → ايقاف/ختام).
        // Suspension days = closed periods (ايقاف → استئناف); open suspension tracked separately.
        const closingOds = sortedOds.find(o => o.NATURE_ODS === 'ختام');
        const closureDate = closingOds ? parseDate(closingOds.DATE_ODS) : null;
        const isCompleted = !!closingOds;

        // Active-work elapsed days. In months-mode each segment counts the number of whole
        // months crossed × 30 (e.g. 08/07→09/08 = 1 month = 30; 14/11→14/07 = 8 months = 240),
        // matching the business rule where 10 أشهر = 300 يوم. In days-mode actual calendar days
        // are used.
        const segElapsed = (a: Date, b: Date) => {
            if (!useFinancialRule) return calculateElapsedDays(a, b, false);
            const monthDiff =
                (b.getFullYear() * 12 + (b.getMonth() + 1)) -
                (a.getFullYear() * 12 + (a.getMonth() + 1));
            return Math.max(0, monthDiff) * 30;
        };

        let closedConsumed = 0;
        let totalSuspensionDays = 0;
        let currentSuspensionDays = 0;
        let lastActiveStartDate: Date | null = null;
        let lastStopDate: Date | null = null;
        let isSuspended = false;
        let lastResumptionDate: Date | null = null;
        let consumedBeforeLastResumption = 0;

        for (const ods of sortedOds) {
            const odsDate = parseDate(ods.DATE_ODS);
            if (!odsDate) continue;
            const nat = ods.NATURE_ODS;

            if (nat === 'انطلاق' || nat === 'استئناف') {
                if (isSuspended && lastStopDate) {
                    totalSuspensionDays += calculateElapsedDays(lastStopDate, odsDate, useFinancialRule);
                    lastStopDate = null;
                }
                isSuspended = false;
                lastResumptionDate = odsDate;
                consumedBeforeLastResumption = closedConsumed;
                lastActiveStartDate = odsDate;
            } else if (nat === 'ايقاف') {
                if (lastActiveStartDate) {
                    closedConsumed += segElapsed(lastActiveStartDate, odsDate);
                    lastActiveStartDate = null;
                }
                lastStopDate = odsDate;
                isSuspended = true;
            } else if (nat === 'ختام') {
                if (lastActiveStartDate) {
                    closedConsumed += segElapsed(lastActiveStartDate, odsDate);
                    lastActiveStartDate = null;
                }
                isSuspended = false;
            }
        }

        const lastOrder = sortedOds.length > 0 ? sortedOds[sortedOds.length - 1].NATURE_ODS : null;

        // ── Consumed days depends on the last order ──
        let consumedDays: number;
        if (isCompleted && lastResumptionDate) {
            // Last order is ختام → consumed up to last resumption + actual days to closure
            consumedDays = consumedBeforeLastResumption + calculateElapsedDays(lastResumptionDate, closureDate!, useFinancialRule);
        } else if (!isCompleted && lastResumptionDate && lastOrder !== 'ايقاف') {
            // Last order is استئناف/انطلاق (running) → consumed up to last resumption + actual days to today
            consumedDays = consumedBeforeLastResumption + calculateElapsedDays(lastResumptionDate, today, useFinancialRule);
        } else {
            // Last order is ايقاف (suspended) → all closed active segments
            consumedDays = closedConsumed;
        }



        // Open suspension still running up to today
        if (isSuspended && lastStopDate) {
            currentSuspensionDays = calculateElapsedDays(lastStopDate, today, useFinancialRule);
        }

        // ── Expected end date (projection) ──
        // Formula: last resumption date + (total allowed duration − consumed days up to that resumption).
        // Example (10 أشهر): last resumption 14/11/2024, consumed up to it = 60,
        //   remaining = 300 − 60 = 240 → 14/11/2024 + 8 months = 14/07/2025.
        const durationStr = piece.DELAI_EX_JOURS;
        const monthCount = isFinancialDuration(durationStr) ? parseInt(String(durationStr), 10) : 0;
        const remainingAfterResumption = Math.max(0, baseDuration - consumedBeforeLastResumption);

        const expectedEndDate = lastResumptionDate ? new Date(lastResumptionDate) : new Date(startDate);
        if (monthCount > 0) {
            // Months mode: 1 month = 30 days — split remaining into whole months + remainder days
            const extraMonths = Math.floor(remainingAfterResumption / 30);
            const extraDays = remainingAfterResumption % 30;
            expectedEndDate.setMonth(expectedEndDate.getMonth() + extraMonths);
            expectedEndDate.setDate(expectedEndDate.getDate() + extraDays);
        } else {
            // Days mode: add exact calendar days
            expectedEndDate.setDate(expectedEndDate.getDate() + remainingAfterResumption);
        }

        // ── Remaining days = total allowed minus consumed ──
        const remainingDays = Math.max(0, baseDuration - consumedDays);

        const isLate = !isCompleted && today > expectedEndDate;
        let delayDays = 0;
        if (isLate) {
            delayDays = calculateElapsedDays(expectedEndDate, today, useFinancialRule);
        }

        const warrantyEndDate = closingOds ? new Date(parseDate(closingOds.DATE_ODS)!) : null;
        if (warrantyEndDate) {
            warrantyEndDate.setDate(warrantyEndDate.getDate() + 1);
            warrantyEndDate.setFullYear(warrantyEndDate.getFullYear() + 1);
        }

        const isWarrantyExpired = warrantyEndDate ? today >= warrantyEndDate : false;

        return {
            baseDuration,
            startDate,
            totalSuspensionDays,
            currentSuspensionDays,
            expectedEndDate,
            consumedDays,
            remainingDays,
            delayDays,
            isLate,
            isSuspended,
            isCompleted,
            isTerminated,
            isFullyTerminated,
            totalTerminatedAmount,
            warrantyEndDate,
            isWarrantyExpired
        };
    }, [piece, associatedOds, db.T_PIECE]);

    const selectedPieceDetails = useMemo(() => {
        if (!piece) return null;

        const isContract = ['صفقة', 'اتفاقية'].includes(piece.NAT_PIECE);
        const isAmendment = piece.NAT_PIECE === 'ملحق';
        const isTermination = piece.NAT_PIECE === 'قرار فسخ';
        const isWorkSituation = ['وضعية الأشغال', 'وضعية التسبيق الجزافي', 'وضعية التسبيق على التموين', 'فاتورة','حكم قضائي'].includes(piece.NAT_PIECE);

        let amendmentLabel = '';
        if (isAmendment) {
            if (piece.MONTANT_PIECE > 0) amendmentLabel = 'ملحق بالزيادة';
            else if (piece.MONTANT_PIECE < 0) amendmentLabel = 'ملحق بالنقصان';
            else amendmentLabel = 'ملحق بدون تأثير مالي';
        }

        const basePieceId = (isAmendment || isWorkSituation || isTermination) && piece.ID_PIECE_INIT
            ? piece.ID_PIECE_INIT
            : piece.ID_PIECE;

        const basePiece = db.T_PIECE.find(p => p.ID_PIECE === basePieceId);

        const engagement = db.T_ENGAGEMENT.find(e => e.ID_PIECE === piece.ID_PIECE);
        const paiement = db.T_PAIEMENT.find(p => p.ID_PIECE === piece.ID_PIECE);

        const linkedPieceIds = db.T_PIECE
            .filter(p => p.ID_PIECE === basePieceId || p.ID_PIECE_INIT === basePieceId)
            .map(p => p.ID_PIECE);

        const relatedEngagements = db.T_ENGAGEMENT.filter(e => linkedPieceIds.includes(e.ID_PIECE));
        const newTotalAmount = relatedEngagements.reduce((sum, e) => {
            let amt = e.MONTANT_ENG;
            if (['إلغاء', 'إنخفاض التقييم'].includes(e.NATURE_ENG)) amt = -amt;
            return sum + amt;
        }, 0);

        const relatedPayments = db.T_PAIEMENT.filter(p => linkedPieceIds.includes(p.ID_PIECE));
        const totalPaid = relatedPayments.reduce((sum, p) => sum + p.MONTANT_PAI, 0);

        const delayPenalty = relatedPayments.reduce((sum, p) => sum + (p.PENALITE_RETARD || 0), 0);

        const amendmentsCount = db.T_PIECE.filter(p => p.ID_PIECE_INIT === basePieceId && p.NAT_PIECE === 'ملحق').length;
        const workSituationsCount = db.T_PIECE.filter(p => p.ID_PIECE_INIT === basePieceId && ['وضعية الأشغال', 'وضعية التسبيق الجزافي', 'وضعية التسبيق على التموين', 'فاتورة', 'حكم قضائي'].includes(p.NAT_PIECE)).length;

        const unregisteredRelatedCount = db.T_PIECE.filter(p => {
            if (p.ID_PIECE_INIT !== basePieceId) return false;
            const isCommitmentType = ['صفقة', 'اتفاقية', 'ملحق', 'فاتورة', 'مقرر', 'قرار','حكم قضائي'].includes(p.NAT_PIECE);
            const isPaymentType = ['وضعية الأشغال', 'فاتورة', 'قرار', 'وضعية التسبيق الجزافي', 'وضعية التسبيق على التموين','حكم قضائي'].includes(p.NAT_PIECE);
            const isUncommitted = isCommitmentType && !p.SAI_ENG;
            let isUnpaid = false;
            if (isPaymentType) {
                if (p.NAT_PIECE === 'وضعية الأشغال') {
                    isUnpaid = !p.SAI_ENG && !p.SAI_PAI;
                } else {
                    isUnpaid = !p.SAI_PAI;
                }
            }
            return isUncommitted || isUnpaid;
        }).length;

        const terminationPiece = db.T_PIECE.find(p => p.ID_PIECE_INIT === basePieceId && p.NAT_PIECE === 'قرار فسخ');
        const terminationAmount = terminationPiece?.MONTANT_PIECE || 0;

        let remainingAmount = newTotalAmount - totalPaid;
        if (Math.abs(remainingAmount) < 0.005) {
            remainingAmount = 0;
        }

        const progressPercent = newTotalAmount > 0 ? (totalPaid / newTotalAmount) * 100 : 0;

        const unregisteredPaymentsAmount = db.T_PIECE
            .filter(p => p.ID_PIECE === basePieceId || p.ID_PIECE_INIT === basePieceId)
            .filter(p => {
                const isPaymentType = ['وضعية الأشغال', 'فاتورة', 'قرار', 'حكم قضائي', 'وضعية التسبيق الجزافي', 'وضعية التسبيق على التموين'].includes(p.NAT_PIECE);
                if (!isPaymentType) return false;
                if (p.NAT_PIECE === 'قرار' && p.PIECE?.includes('فسخ')) return false;
                if (p.NAT_PIECE.includes('فسخ')) return false;

                if (p.NAT_PIECE === 'فاتورة') {
                    return !p.SAI_PAI;
                } else if (p.NAT_PIECE === 'حكم قضائي') {
                    return !p.SAI_PAI;
                } else if (p.NAT_PIECE === 'وضعية الأشغال') {
                    return !p.SAI_ENG && !p.SAI_PAI;
                } else {
                    return !p.SAI_PAI;
                }
            })
            .reduce((sum, p) => sum + (p.MONTANT_PIECE || 0), 0);

        const beneficiaire = piece.ID_BENEFICIAIRE
            ? db.T_BENEFICIAIRE.find(b => b.ID_BENEFICIAIRE === piece.ID_BENEFICIAIRE)
            : null;

        const compte = piece.ID_COMPTE
            ? db.T_COMPTE_BANCAIRE.find(c => c.ID_COMPTE === piece.ID_COMPTE)
            : null;

        return {
            isContract,
            isAmendment,
            amendmentLabel,
            basePiece,
            engagement,
            paiement,
            beneficiaire,
            compte,
            amendmentsCount,
            terminationAmount,
            workSituationsCount,
            unregisteredRelatedCount,
            totalPaid,
            delayPenalty,
            newTotalAmount,
            remainingAmount,
            progressPercent,
            unregisteredPaymentsAmount
        };
    }, [piece, db]);

    return {
        associatedLotPieces,
        associatedLotsData,
        associatedLotObjects,
        associatedOds,
        odsCalculations,
        selectedPieceDetails
    };
};
