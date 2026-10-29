import {
    parseDate,
    compareDates,
    calculateElapsedDays,
    getEffectiveDurationDays,
    isFinancialDuration,
} from './dateUtils';

export interface OdsEntry {
    DATE_ODS: string;
    NATURE_ODS: string;
    ID_ODS?: number;
}

export interface OdsCalculationInput {
    /** e.g. "10m" / "10" / "10 أشهر" — the contract duration. */
    durationStr: string | null | undefined;
    /** The ordered (or unordered) ODS timeline for the document. */
    ods: OdsEntry[];
    /** "today" anchor, defaults to the real current date (normalized). */
    today?: Date;
}

export interface OdsCalculationResult {
    baseDuration: number;
    startDate: Date | null;
    totalSuspensionDays: number;
    currentSuspensionDays: number;
    expectedEndDate: Date;
    consumedDays: number;
    remainingDays: number;
    delayDays: number;
    isLate: boolean;
    isSuspended: boolean;
    isCompleted: boolean;
    closingDate: Date | null;
    warrantyEndDate: Date | null;
    isWarrantyExpired: boolean;
}

const segElapsedMonths = (a: Date, b: Date): number => {
    const monthDiff =
        (b.getFullYear() * 12 + (b.getMonth() + 1)) -
        (a.getFullYear() * 12 + (a.getMonth() + 1));
    return Math.max(0, monthDiff) * 30;
};

/**
 * Pure calculation of the ODS deadline state for a contract:
 *  - consumed days (active periods only, suspension excluded)
 *  - suspension days (closed + currently open)
 *  - remaining days
 *  - expected end date projection
 *  - late/delay/warranty indicators
 *
 * Business rules:
 *  - Months mode: 1 month = 30 days; active segments count whole months crossed × 30.
 *  - Days mode: actual calendar days.
 *  - Consumed depends on the last order:
 *      • ختام      → consumed up to last resumption + actual days from resumption to closure.
 *      • استئناف/انطلاق → consumed up to last resumption + actual days from resumption to today.
 *      • ايقاف     → sum of closed active segments only.
 *  - Expected end = last resumption + (allowed − consumed up to that resumption).
 */
export const calculateOdsDeadline = (input: OdsCalculationInput): OdsCalculationResult => {
    const useFinancialRule = isFinancialDuration(input.durationStr);
    const baseDuration = getEffectiveDurationDays(input.durationStr);

    const sortedOds = [...input.ods]
        .sort((a, b) => compareDates(a.DATE_ODS, b.DATE_ODS));

    const commencementOds = sortedOds.find(o => o.NATURE_ODS === 'انطلاق');
    const startDate = commencementOds ? parseDate(commencementOds.DATE_ODS) : null;

    const today = input.today ? new Date(input.today) : new Date();
    today.setHours(0, 0, 0, 0);

    const closingOds = sortedOds.find(o => o.NATURE_ODS === 'ختام');
    const closingDate = closingOds ? parseDate(closingOds.DATE_ODS) : null;
    const isCompleted = !!closingOds;

    const segElapsed = (a: Date, b: Date): number =>
        useFinancialRule ? segElapsedMonths(a, b) : calculateElapsedDays(a, b, false);

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

    let consumedDays: number;
    if (isCompleted && lastResumptionDate && closingDate) {
        consumedDays = consumedBeforeLastResumption + calculateElapsedDays(lastResumptionDate, closingDate, useFinancialRule);
    } else if (!isCompleted && lastResumptionDate && lastOrder !== 'ايقاف') {
        consumedDays = consumedBeforeLastResumption + calculateElapsedDays(lastResumptionDate, today, useFinancialRule);
    } else {
        consumedDays = closedConsumed;
    }

    if (isSuspended && lastStopDate) {
        currentSuspensionDays = calculateElapsedDays(lastStopDate, today, useFinancialRule);
    }

    // ── Expected end date (projection) ──
    const monthCount = isFinancialDuration(input.durationStr) ? parseInt(String(input.durationStr), 10) : 0;
    const remainingAfterResumption = Math.max(0, baseDuration - consumedBeforeLastResumption);

    const expectedEndDate = lastResumptionDate ? new Date(lastResumptionDate) : new Date(startDate ?? today);
    if (monthCount > 0) {
        const extraMonths = Math.floor(remainingAfterResumption / 30);
        const extraDays = remainingAfterResumption % 30;
        expectedEndDate.setMonth(expectedEndDate.getMonth() + extraMonths);
        expectedEndDate.setDate(expectedEndDate.getDate() + extraDays);
    } else {
        expectedEndDate.setDate(expectedEndDate.getDate() + remainingAfterResumption);
    }

    const remainingDays = Math.max(0, baseDuration - consumedDays);

    const isLate = !isCompleted && today > expectedEndDate;
    let delayDays = 0;
    if (isLate) {
        delayDays = calculateElapsedDays(expectedEndDate, today, useFinancialRule);
    }

    let warrantyEndDate: Date | null = null;
    if (closingDate) {
        warrantyEndDate = new Date(closingDate);
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
        closingDate,
        warrantyEndDate,
        isWarrantyExpired,
    };
};
