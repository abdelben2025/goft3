// Centralized localization for data-matching values.
// These DB values are stored in Arabic and used for matching; we keep the raw
// values for comparisons but localize their DISPLAY via these helpers.

type TFunc = (key: string, params?: { [key: string]: string | number }) => string;

const opStatusKeys: Record<string, string> = {
    'جارية': 'op.status_ongoing',
    'مغلقة': 'op.status_closed',
};

const natureEngKeys: Record<string, string> = {
    'التزام': 'nature.engagement',
    'سحب': 'nature.withdrawal',
};

const naturePieceKeys: Record<string, string> = {
    'صفقة': 'nature.market',
    'اتفاقية': 'nature.agreement',
    'ملحق': 'nature.amendment',
    'فاتورة': 'nature.invoice',
    'مقرر': 'nature.decision',
    'وضعية الأشغال': 'nature.work_statement',
};

const natureOdsKeys: Record<string, string> = {
    'انطلاق': 'natureods.start',
    'استئناف': 'natureods.resume',
    'ايقاف': 'natureods.stop',
    'ختام': 'natureods.closure',
};

const lotStatusKeys: Record<string, string> = {
    'مسندة': 'det.allocated',
    'غير مسندة': 'det.unallocated',
};

const paymentAcceptedKeys: Record<string, string> = {
    'مقبولة': 'mpay.accepted',
    'غير مقبولة': 'mpay.not_accepted',
};

const visaedKeys: Record<string, string> = {
    'مؤشرة': 'mcommit.visaed',
    'غير مؤشرة': 'mcommit.not_visaed',
};

const commonFallbackKeys: Record<string, string> = {
    'غير معروف': 'common.unknown',
    'بدون صنف': 'common.no_category',
    'غير موزع': 'common.unallocated',
    'مبالغ غير موزعة': 'common.unallocated_amounts',
};

const localize = (raw: string, keys: Record<string, string>, t: TFunc): string => {
    const k = keys[raw];
    return k ? t(k) : raw;
};

export const labelOperationStatus = (raw: string, t: TFunc): string => localize(raw, opStatusKeys, t);
export const labelNatureEng = (raw: string, t: TFunc): string => localize(raw, natureEngKeys, t);
export const labelNaturePiece = (raw: string, t: TFunc): string => localize(raw, naturePieceKeys, t);
export const labelNatureOds = (raw: string, t: TFunc): string => localize(raw, natureOdsKeys, t);
export const labelLotStatus = (raw: string, t: TFunc): string => localize(raw, lotStatusKeys, t);
export const labelPaymentAccepted = (raw: string, t: TFunc): string => localize(raw, paymentAcceptedKeys, t);
export const labelVisaed = (raw: string, t: TFunc): string => localize(raw, visaedKeys, t);
export const labelCommonFallback = (raw: string, t: TFunc): string => localize(raw, commonFallbackKeys, t);

export const pickLocalLabel = (
    obj: any,
    arField: string,
    frField: string,
    fallback: string,
    language: 'ar' | 'fr',
): string => {
    if (language === 'fr') return obj?.[frField] || obj?.[arField] || fallback;
    return obj?.[arField] || fallback;
};
