import { describe, it, expect } from 'vitest';
import { calculateOdsDeadline } from './odsCalculations';

const dd = (s: string) => {
    const [d, m, y] = s.split('/').map(Number);
    return new Date(y, m - 1, d);
};

const fmt = (d: Date) =>
    `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

// The canonical 10-month example (months mode):
//   08/07/2024 انطلاق → 09/08/2024 ايقاف (30)
//   12/09/2024 استئناف → 13/10/2024 ايقاف (30)
//   14/11/2024 استئناف → 14/07/2025 ختام (240)
//   total = 300, suspension = 64, expected end = 14/07/2025
const tenMonthTimeline = [
    { DATE_ODS: '08/07/2024', NATURE_ODS: 'انطلاق' },
    { DATE_ODS: '09/08/2024', NATURE_ODS: 'ايقاف' },
    { DATE_ODS: '12/09/2024', NATURE_ODS: 'استئناف' },
    { DATE_ODS: '13/10/2024', NATURE_ODS: 'ايقاف' },
    { DATE_ODS: '14/11/2024', NATURE_ODS: 'استئناف' },
];

describe('calculateOdsDeadline', () => {
    it('completed contract (ختام last) → consumed 300, suspension 64, remaining 0, end 14/07/2025', () => {
        const result = calculateOdsDeadline({
            durationStr: '10m',
            ods: [...tenMonthTimeline, { DATE_ODS: '14/07/2025', NATURE_ODS: 'ختام' }],
            today: dd('20/12/2025'),
        });

        expect(result.baseDuration).toBe(300);
        expect(result.isCompleted).toBe(true);
        expect(result.consumedDays).toBe(300);
        expect(result.totalSuspensionDays).toBe(64);
        expect(result.remainingDays).toBe(0);
        expect(fmt(result.expectedEndDate)).toBe('14/07/2025');
        // closure inclusive → warranty = closure + 1 year + 1 day
        expect(fmt(result.warrantyEndDate!)).toBe('15/07/2026');
    });

    it('running contract (استئناف last) → consumed = 60 + actual days to today', () => {
        // last resumption 14/11/2024 → today 20/12/2024 = 36 days (30/360)
        const result = calculateOdsDeadline({
            durationStr: '10m',
            ods: tenMonthTimeline,
            today: dd('20/12/2024'),
        });

        expect(result.isCompleted).toBe(false);
        expect(result.consumedDays).toBe(96); // 60 + 36
        expect(result.remainingDays).toBe(204); // 300 - 96
        expect(result.isSuspended).toBe(false);
    });

    it('suspended contract (ايقاف last) → consumed = closed active segments only (60)', () => {
        const result = calculateOdsDeadline({
            durationStr: '10m',
            ods: [
                { DATE_ODS: '08/07/2024', NATURE_ODS: 'انطلاق' },
                { DATE_ODS: '09/08/2024', NATURE_ODS: 'ايقاف' },
                { DATE_ODS: '12/09/2024', NATURE_ODS: 'استئناف' },
                { DATE_ODS: '13/10/2024', NATURE_ODS: 'ايقاف' },
            ],
            today: dd('20/12/2024'),
        });

        expect(result.isSuspended).toBe(true);
        expect(result.consumedDays).toBe(60);
        expect(result.currentSuspensionDays).toBeGreaterThan(0);
    });

    it('days mode: expected end = last resumption + remaining calendar days', () => {
        // days mode, no suspension: 08/07/2024 انطلاق → 300 days → 04/05/2025
        const result = calculateOdsDeadline({
            durationStr: '300',
            ods: [
                { DATE_ODS: '08/07/2024', NATURE_ODS: 'انطلاق' },
                { DATE_ODS: '04/05/2025', NATURE_ODS: 'ختام' },
            ],
            today: dd('20/12/2025'),
        });

        expect(result.baseDuration).toBe(300);
        expect(result.consumedDays).toBe(300);
        expect(fmt(result.expectedEndDate)).toBe('04/05/2025');
    });

    it('no commencement → startDate null, termination base returned', () => {
        const result = calculateOdsDeadline({
            durationStr: '10m',
            ods: [{ DATE_ODS: '14/07/2025', NATURE_ODS: 'ختام' }],
        });
        expect(result.startDate).toBeNull();
        expect(result.baseDuration).toBe(300);
    });

    it('overdue running contract → isLate true and delayDays computed', () => {
        const result = calculateOdsDeadline({
            durationStr: '10m',
            ods: tenMonthTimeline,
            today: dd('28/10/2026'),
        });
        expect(result.isLate).toBe(true);
        expect(result.delayDays).toBeGreaterThan(0);
        expect(result.consumedDays).toBeGreaterThan(300); // no cap
    });
});
