export const normalizeDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '';
    
    const str = String(dateStr).trim();

    // Handle Excel serial number (numeric strings like "45234" or "45234.12")
    if (str.match(/^\d{5}(\.\d+)?$/)) {
        const serial = parseFloat(str);
        if (!isNaN(serial) && serial > 20000 && serial < 100000) {
             const date = new Date((serial - 25569) * 86400 * 1000 + 60000);
             const d = String(date.getDate()).padStart(2, '0');
             const m = String(date.getMonth() + 1).padStart(2, '0');
             const y = date.getFullYear();
             return `${d}/${m}/${y}`;
        }
    }

    // Convert YYYY-MM-DD to DD/MM/YYYY
    if (str.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [y, m, d] = str.split('-');
        return `${d}/${m}/${y}`;
    }
    
    // Convert DD-MM-YYYY to DD/MM/YYYY
    if (str.match(/^\d{1,2}-\d{1,2}-\d{4}$/)) {
        return str.replace(/-/g, '/');
    }

    // Ensure DD/MM/YYYY format (padding)
    const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashMatch) {
        const d = slashMatch[1].padStart(2, '0');
        const m = slashMatch[2].padStart(2, '0');
        const y = slashMatch[3];
        return `${d}/${m}/${y}`;
    }

    return str;
};

export const parseDate = (dateStr: string | null | undefined): Date | null => {
    if (!dateStr) return null;
    const normalized = normalizeDate(dateStr);
    const parts = normalized.split('/');
    if (parts.length !== 3) return null;
    const [day, month, year] = parts.map(Number);
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    return new Date(year, month - 1, day);
};

export const compareDates = (d1: string, d2: string): number => {
    const date1 = parseDate(d1);
    const date2 = parseDate(d2);
    if (!date1 && !date2) return 0;
    if (!date1) return -1;
    if (!date2) return 1;
    return date1.getTime() - date2.getTime();
};

export const getCurrentDate = (): string => {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
};

export const formatDate = (date: Date): string => {
    if (!date) return '';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
};

/**
 * Checks if a duration string indicates a financial month-based calculation.
 */
export const isFinancialDuration = (durationStr: string | null | undefined): boolean => {
    if (!durationStr) return false;
    const clean = String(durationStr).trim().toLowerCase();
    return clean.endsWith('m') || clean.includes('شهر') || clean.endsWith('ش');
};

/**
 * Calculates effective days based on financial rules for Investment Expenditures (T3):
 * - If duration is flagged as months: 1 month = 30 days.
 */
export const getEffectiveDurationDays = (durationStr: string | null | undefined): number => {
    if (!durationStr) return 0;
    const clean = String(durationStr).trim().toLowerCase();
    const num = parseInt(clean, 10);
    if (isNaN(num)) return 0;
    
    if (isFinancialDuration(durationStr)) {
        return num * 30; // Financial logic: 30 days per month
    }
    return num;
};

/**
 * Calculates elapsed days between two dates.
 * @param start Start date
 * @param end End date
 * @param useFinancialRule If true, use 30/360 financial rule. Otherwise use actual calendar days.
 */
export const calculateElapsedDays = (start: Date, end: Date, useFinancialRule: boolean): number => {
    if (end < start) return 0;

    if (!useFinancialRule) {
        // Standard calendar difference
        return Math.round((end.getTime() - start.getTime()) / (1000 * 3600 * 24));
    }

    // Financial rule (30/360): (Y2 - Y1) * 360 + (M2 - M1) * 30 + (D2 - D1)
    const y1 = start.getFullYear();
    const m1 = start.getMonth() + 1;
    const d1 = start.getDate();

    const y2 = end.getFullYear();
    const m2 = end.getMonth() + 1;
    const d2 = end.getDate();

    return (y2 - y1) * 360 + (m2 - m1) * 30 + (d2 - d1);
};

/**
 * Formats a duration string into a reader-friendly Arabic format (days vs months).
 */
export const formatDurationArabic = (durationStr: string | null | undefined): string => {
    if (!durationStr) return '';
    const clean = String(durationStr).trim().toLowerCase();
    const num = parseInt(clean, 10);
    if (isNaN(num)) return String(durationStr);

    if (isFinancialDuration(durationStr)) {
        if (num === 1) return 'شهر واحد';
        if (num === 2) return 'شهران';
        if (num >= 3 && num <= 10) return `${num} أشهر`;
        return `${num} شهر`;
    } else {
        if (num === 1) return 'يوم واحد';
        if (num === 2) return 'يومان';
        if (num >= 3 && num <= 10) return `${num} أيام`;
        return `${num} يوم`;
    }
};