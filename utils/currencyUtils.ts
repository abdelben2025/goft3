export const formatCurrency = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined) return '0,00';
    let cleanAmount = amount;
    // Prevent -0 and float precision issues close to 0 from formatting as -0,00
    if (Math.abs(amount) < 0.005) {
        cleanAmount = 0;
    }
    return new Intl.NumberFormat('de-DE', {
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(cleanAmount);
};

// Used when user focuses input to edit (removes grouping dots for easier editing)
export const formatCurrencyForInput = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined) return '';
    let cleanAmount = amount;
    if (Math.abs(amount) < 0.005) {
        cleanAmount = 0;
    }
    return new Intl.NumberFormat('de-DE', {
        style: 'decimal',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
        useGrouping: false
    }).format(cleanAmount);
};

export const parseCurrency = (input: string | number | null | undefined): number => {
    if (!input) return 0;
    if (typeof input === 'number') return input;

    let cleaned = input.toString().trim();
    if (cleaned === '') return 0;

    const hasComma = cleaned.includes(',');
    if (hasComma) {
        // Comma is the decimal separator; dots are thousands separators
        cleaned = cleaned.replace(/\./g, '');
        cleaned = cleaned.replace(/,/g, '.');
    } else {
        const dotCount = (cleaned.match(/\./g) || []).length;
        if (dotCount > 1) {
            // Multiple dots => thousands separators, keep none
            cleaned = cleaned.replace(/\./g, '');
        }
        // A single dot is treated as the decimal separator (round-trip with
        // formatCurrencyForInput, which renders without grouping, e.g. "1234.56")
    }

    // Remove any other non-numeric characters except . and -
    cleaned = cleaned.replace(/[^0-9.-]/g, '');

    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
};

export const formatAmountInput = (value: string): string => {
    if (!value) return value;
    // Special handling for decimal insertion using the dot key on a numeric keypad.
    // Replace the last dot with a comma, if there's no comma present yet.
    if (!value.includes(',')) {
        const lastDotIndex = value.lastIndexOf('.');
        if (lastDotIndex !== -1) {
            return value.substring(0, lastDotIndex) + ',' + value.substring(lastDotIndex + 1);
        }
    }
    return value;
};

/**
 * Converts a numeric amount to Arabic words formatted in Algerian Dinars and Centimes.
 * Example: 1542300.50 => "مليون وخمسمائة واثنان وأربعون ألف وثلاثمائة دينار جزائري و 50 سنتيم"
 */
export const numberToArabicWords = (number: number | null | undefined): string => {
    if (number === null || number === undefined) return 'صفر دينار جزائري';

    const num = parseFloat(Number(number).toFixed(2));
    if (isNaN(num)) return 'مبلغ غير صالح';

    const integerPart = Math.floor(num);
    const decimalPart = Math.round((num - integerPart) * 100);

    const units = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
    const teens = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
    const tens = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
    const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];

    const convertThreeDigits = (n: number): string => {
        if (n === 0) return '';
        let result = '';
        const h = Math.floor(n / 100);
        const t = Math.floor((n % 100) / 10);
        const u = n % 10;

        if (h > 0) {
            result += hundreds[h];
            if (t > 0 || u > 0) result += ' و';
        }

        if (t === 1 && u > 0) {
            result += teens[u];
        } else {
            if (u > 0) {
                result += units[u];
            }
            if (t > 0) {
                if (u > 0) result += ' و';
                result += tens[t];
            }
        }
        return result;
    };

    const convert = (n: number): string => {
        if (n === 0) return 'صفر';
        if (n < 0) return 'سالب ' + convert(Math.abs(n));

        let result = '';
        const billion = Math.floor(n / 1000000000);
        const million = Math.floor((n % 1000000000) / 1000000);
        const thousand = Math.floor((n % 1000000) / 1000);
        const rest = n % 1000;

        if (billion > 0) {
            if (billion === 1) result += 'مليار';
            else if (billion === 2) result += 'ملياران';
            else if (billion >= 3 && billion <= 10) result += convertThreeDigits(billion) + ' مليارات';
            else result += convertThreeDigits(billion) + ' مليار';
            if (million > 0 || thousand > 0 || rest > 0) result += ' و';
        }

        if (million > 0) {
            if (million === 1) result += 'مليون';
            else if (million === 2) result += 'مليونان';
            else if (million >= 3 && million <= 10) result += convertThreeDigits(million) + ' ملايين';
            else result += convertThreeDigits(million) + ' مليون';
            if (thousand > 0 || rest > 0) result += ' و';
        }

        if (thousand > 0) {
            if (thousand === 1) result += 'ألف';
            else if (thousand === 2) result += 'ألفان';
            else if (thousand >= 3 && thousand <= 10) result += convertThreeDigits(thousand) + ' آلاف';
            else result += convertThreeDigits(thousand) + ' ألف';
            if (rest > 0) result += ' و';
        }

        if (rest > 0) {
            result += convertThreeDigits(rest);
        }

        return result.trim();
    };

    let integerText = convert(integerPart);
    if (integerPart === 1) integerText = 'دينار جزائري واحد';
    else if (integerPart === 2) integerText = 'ديناران جزائريان';
    else integerText = `${integerText} دينار جزائري`;

    if (decimalPart > 0) {
        return `${integerText} و ${decimalPart} سنتيم`;
    }

    return integerText;
};
