/** Normalize Arabic text for flexible fuzzy matching (remove diacritics, unify variants). */
export const normalizeArabic = (text: string): string => {
    if (!text) return '';
    return text
        .trim()
        .replace(/[\u064B-\u0652]/g, '') // remove diacritics
        .replace(/[أإآٱ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/\s+/g, ' ');
};

/** Detect "unallocated" (غير موزع) phrasing in a label. */
export const isUnallocatedText = (text: string): boolean => {
    const normalizedText = normalizeArabic(text);
    const normalizedKeywords = [
        'غير موزع',
        'غير موزعة',
        'مبالغ غير موزعة',
        'مبلغ العملية غير الموزع',
        'غير الموزع',
        'مبلغ غير موزع'
    ].map(normalizeArabic);
    return normalizedKeywords.some(keyword => normalizedText.includes(keyword));
};
