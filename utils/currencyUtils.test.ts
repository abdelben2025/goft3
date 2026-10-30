import { describe, it, expect } from 'vitest';
import { numberToArabicWords, formatCurrency, parseCurrency } from './currencyUtils';

describe('currencyUtils', () => {
    describe('numberToArabicWords', () => {
        it('handles null and undefined', () => {
            expect(numberToArabicWords(null)).toBe('صفر دينار جزائري');
            expect(numberToArabicWords(undefined)).toBe('صفر دينار جزائري');
        });

        it('handles zero', () => {
            expect(numberToArabicWords(0)).toBe('صفر دينار جزائري');
        });

        it('handles single dinar (واحد)', () => {
            expect(numberToArabicWords(1)).toBe('دينار جزائري واحد');
        });

        it('handles two dinars (اثنان)', () => {
            expect(numberToArabicWords(2)).toBe('ديناران جزائريان');
        });

        it('handles basic units and tens', () => {
            expect(numberToArabicWords(15)).toBe('خمسة عشر دينار جزائري');
            expect(numberToArabicWords(50)).toBe('خمسون دينار جزائري');
            expect(numberToArabicWords(75)).toBe('خمسة وسبعون دينار جزائري');
        });

        it('handles hundreds', () => {
            expect(numberToArabicWords(100)).toBe('مائة دينار جزائري');
            expect(numberToArabicWords(250)).toBe('مائتان وخمسون دينار جزائري');
            expect(numberToArabicWords(315)).toBe('ثلاثمائة وخمسة عشر دينار جزائري');
        });

        it('handles thousands, millions, and billions', () => {
            expect(numberToArabicWords(1000)).toBe('ألف دينار جزائري');
            expect(numberToArabicWords(2000)).toBe('ألفان دينار جزائري');
            expect(numberToArabicWords(5000)).toBe('خمسة آلاف دينار جزائري');
            expect(numberToArabicWords(1000000)).toBe('مليون دينار جزائري');
            expect(numberToArabicWords(2000000)).toBe('مليونان دينار جزائري');
            expect(numberToArabicWords(1000000000)).toBe('مليار دينار جزائري');
        });

        it('handles compound complex numbers with decimals (centimes)', () => {
            expect(numberToArabicWords(1542300.5)).toBe(
                'مليون وخمسمائة واثنان وأربعون ألف وثلاثمائة دينار جزائري و 50 سنتيم'
            );
        });

        it('handles negative numbers', () => {
            expect(numberToArabicWords(-500)).toBe('سالب خمسمائة دينار جزائري');
        });
    });

    describe('formatCurrency', () => {
        it('formats amounts correctly in de-DE style with 2 decimal places', () => {
            expect(formatCurrency(0)).toBe('0,00');
            expect(formatCurrency(1234.56)).toBe('1.234,56');
            expect(formatCurrency(null)).toBe('0,00');
        });
    });

    describe('parseCurrency', () => {
        it('parses formatted strings back to numbers', () => {
            expect(parseCurrency('1.234,56')).toBe(1234.56);
            expect(parseCurrency('1234.56')).toBe(1234.56);
            expect(parseCurrency('')).toBe(0);
        });
    });
});
