import React, { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { formatCurrency } from '../utils/currencyUtils';
import { formatDate, parseDate } from '../utils/dateUtils';
import Modal from './Modal';
import { CompteBancaire, Engagement, LotPiece, Paiement, Piece } from '../types';

const fmtDate = (dateStr?: string | null): string => {
    if (!dateStr) return '—';
    const d = parseDate(dateStr);
    return d ? formatDate(d) : dateStr;
};

interface BeneficiaryDetailsModalProps {
    isOpen: boolean;
    beneficiaryId: number | null;
    onClose: () => void;
}

const CONTRACT_TYPES = ['صفقة', 'اتفاقية'];

const getPieceTypeLabel = (nature?: string | null): string => {
    const map: Record<string, string> = {
        'صفقة': 'الصفقة',
        'اتفاقية': 'الاتفاقية',
        'ملحق': 'ملحق',
        'قرار فسخ': 'مقرر الفسخ',
        'وضعية الأشغال': 'وضعية الأشغال',
        'وضعية التسبيق الجزافي': 'وضعية التسبيق الجزافي',
        'وضعية التسبيق على التموين': 'وضعية التسبيق على التموين',
        'فاتورة': 'فاتورة',
        'حكم قضائي': 'حكم قضائي',
        'رفع اليد عن الضمان': 'رفع اليد عن الضمان',
    };
    return nature ? (map[nature] || nature) : 'وثيقة';
};

const BeneficiaryDetailsModal: React.FC<BeneficiaryDetailsModalProps> = ({ isOpen, beneficiaryId, onClose }) => {
    const { db } = useData();

    const ben = beneficiaryId ? db.T_BENEFICIAIRE.find(b => b.ID_BENEFICIAIRE === beneficiaryId) : null;

    const benPieces = useMemo(() => {
        if (!beneficiaryId) return [];
        return db.T_PIECE.filter(p => Number(p.ID_BENEFICIAIRE) === beneficiaryId);
    }, [beneficiaryId, db.T_PIECE]);

    const accounts = useMemo(() => {
        if (!beneficiaryId) return [];
        return db.T_COMPTE_BANCAIRE.filter((a: CompteBancaire) => Number(a.ID_BENEFICIAIRE) === beneficiaryId);
    }, [beneficiaryId, db.T_COMPTE_BANCAIRE]);

    const contracts = benPieces.filter((p: Piece) => CONTRACT_TYPES.includes(p.NAT_PIECE));

    const childPiecesFor = (contractId: number) =>
        benPieces.filter((c: Piece) => Number(c.ID_PIECE_INIT) === contractId);

    const engagementsForPieces = (pieceIds: number[]) => {
        const set = new Set(pieceIds.map(String));
        return db.T_ENGAGEMENT.filter((e: Engagement) => set.has(String(e.ID_PIECE)));
    };

    const paymentsForPieces = (pieceIds: number[]) => {
        const set = new Set(pieceIds.map(String));
        return db.T_PAIEMENT.filter((p: Paiement) => set.has(String(p.ID_PIECE)));
    };

    const lotsForPiece = (pieceId: number) => {
        const lotPieces = db.T_LOT_PIECE.filter((lp: LotPiece) => Number(lp.ID_PIECE) === pieceId);
        return lotPieces
            .map((lp: LotPiece) => db.T_LOT_OPERATION.find(l => l.ID_LOT === lp.ID_LOT))
            .filter((l): l is NonNullable<typeof l> => !!l);
    };

    const [printMenuId, setPrintMenuId] = React.useState<number | 'all' | null>(null);

    const buildContractHtml = (contract: Piece): string => {
        const contractId = contract.ID_PIECE;
        const children = childPiecesFor(contractId);
        const allPieceIds = [contractId, ...children.map(c => c.ID_PIECE)];
        const engs = engagementsForPieces(allPieceIds);
        const pais = paymentsForPieces(allPieceIds);
        const lots = lotsForPiece(contractId);
        const totalEngs = engs.reduce((s, e) => s + (e.MONTANT_ENG || 0), 0);
        const totalPais = pais.reduce((s, p) => s + (p.MONTANT_PAI || 0), 0);
        const penaltyTotal = pais.reduce((s, p) => s + (p.PENALITE_RETARD || 0), 0);
        const advanceForfaitaire = pais.reduce((m, p) => Math.max(m, p.AVANCE_FORFAITAIRE || 0), 0);
        const advanceAppro = pais.reduce((m, p) => Math.max(m, p.AVANCE_APPROVISIONNEMENT || 0), 0);
        const advancesTotal = advanceForfaitaire + advanceAppro;
        const repaymentTotal = pais.reduce((s, p) => s + (p.REMBOURSEMENT_AVANCE_FORFAITAIRE || 0) + (p.REMBOURSEMENT_AVANCE_APPROVISIONNEMENT || 0), 0);
        const guaranteeRetention = pais.reduce((s, p) => s + (p.RETENUE_GARANTIE || 0), 0);
        const extraDeduction = pais.reduce((s, p) => s + (p.AUTRE_DEDUCTION || 0), 0);
        const contractEng = engs.find(e => Number(e.ID_PIECE) === contractId);
        const op = db.T_OPERATION.find(o => o.ID_OPERATION === Number(contract.ID_OPERATION));
        const contractOds = db.T_ODS.filter(o => Number(o.ID_PIECE) === contractId);
        const startWorksDate = contractOds.find(o => o.NATURE_ODS === 'انطلاق')?.DATE_ODS;
        const tempTakeoverDate = contractOds.find(o => o.NATURE_ODS === 'ختام')?.DATE_ODS;
        const addendumTotal = children.filter(c => c.NAT_PIECE === 'ملحق').reduce((s, c) => s + (c.MONTANT_PIECE || 0), 0);
        const terminationTotal = children.filter(c => c.NAT_PIECE === 'قرار فسخ').reduce((s, c) => s + (c.MONTANT_PIECE || 0), 0);
        const newContractAmount = (contract.MONTANT_PIECE || 0) + addendumTotal + terminationTotal;
        let guaranteePct = 0;
        const cautionMatch = (contract.CAUTION || '').match(/\d+(\.\d+)?/);
        if (cautionMatch) {
            const v = parseFloat(cautionMatch[0]);
            guaranteePct = v > 1 ? v : v * 100;
        }
        const guaranteeAmount = (newContractAmount * guaranteePct) / 100;

        const row = (label: string, value: string) => `<tr><td style="padding:2px 6px;border:1px solid #bbb;background:#f1f5f9;font-weight:bold;width:40%">${label}</td><td style="padding:2px 6px;border:1px solid #bbb">${value}</td></tr>`;

        let html = `<div style="page-break-inside:avoid;border:1px solid #ccc;border-radius:6px;margin-bottom:10px;overflow:hidden">`;
        html += `<div style="background:#1f2937;color:#fff;padding:5px 10px;font-weight:bold;font-size:12px">عقد: ${contract.PIECE} (${getPieceTypeLabel(contract.NAT_PIECE)}) — المبلغ: ${formatCurrency(contract.MONTANT_PIECE)}</div>`;
        html += `<table style="width:100%;border-collapse:collapse;font-size:12px">`;
        html += row('رقم العملية', op?.N_OPERATION || '—');
        html += row('عنوان العملية', op?.INT_OPERATION || '—');
        html += row('مدة الإنجاز', contract.DELAI_EX_JOURS || '—');
        html += row('كفالة الضمان', contract.CAUTION || '—');
        if (guaranteePct > 0) html += row('مبلغ الضمان', `${formatCurrency(guaranteeAmount)} (${guaranteePct.toFixed(0)}%)`);
        html += row('رقم التأشيرة (CM)', contract.N_VISA_CM || '—');
        html += row('تاريخ التأشيرة (CM)', contract.DATE_VISA_CM ? fmtDate(contract.DATE_VISA_CM) : '—');
        html += row('رقم التأشيرة (CB)', contractEng?.N_VISA_CB || '—');
        html += row('تاريخ التأشيرة (CB)', contractEng?.DATE_VISA_CB ? fmtDate(contractEng.DATE_VISA_CB) : '—');
        html += row('تاريخ انطلاق الأشغال', startWorksDate ? fmtDate(startWorksDate) : '—');
        html += row('تاريخ محضر الاستلام المؤقت', tempTakeoverDate ? fmtDate(tempTakeoverDate) : '—');
        if (lots.length > 0) {
            html += row('الحصص', lots.map(l => `حصة ${l.N_LOT} — ${l.INTITULE_LOT} (${formatCurrency(l.MONTANT_INITIALE_LOT)})`).join('<br/>'));
        }
        html += row('مجموع الالتزامات', formatCurrency(totalEngs));
        html += row('مجموع الدفعات', formatCurrency(totalPais));
        html += row('مجموع عقوبات التأخير', formatCurrency(penaltyTotal));
        html += row('مجموع التسبيقات', formatCurrency(advancesTotal));
        html += row('مجموع تسديد التسبيقات', formatCurrency(repaymentTotal));
        html += row('مجموع اقتطاع الضمان', formatCurrency(guaranteeRetention));
        html += row('مبلغ اقتطاع بالزيادة', formatCurrency(extraDeduction));
        html += `</table>`;

        if (children.length > 0) {
            html += `<div style="background:#e5e7eb;padding:4px 10px;font-weight:bold;font-size:12px">الوثائق المرتبطة بالعقد</div>`;
            html += `<table style="width:100%;border-collapse:collapse;font-size:11px">`;
            children.forEach(c => {
                const cEngs = engagementsForPieces([c.ID_PIECE]);
                const cPais = paymentsForPieces([c.ID_PIECE]);
                html += row(getPieceTypeLabel(c.NAT_PIECE), `${c.PIECE} — المبلغ: ${formatCurrency(c.MONTANT_PIECE)}`);
                cEngs.forEach(e => html += row('التزام', `${e.N_ENG} — ${formatCurrency(e.MONTANT_ENG)}${e.N_VISA_CB ? ' | CB: ' + e.N_VISA_CB : ''}`));
                cPais.forEach(p => html += row('دفع', `${p.N_PAI} — ${formatCurrency(p.MONTANT_PAI)}${p.N_MANDAT ? ' | حوالة: ' + p.N_MANDAT : ''}`));
            });
            html += `</table>`;
        }

        html += `</div>`;
        return html;
    };

    const handlePrint = (scope: number | 'all') => {
        if (!ben) return;
        const contractsToPrint = scope === 'all' ? contracts : contracts.filter(c => c.ID_PIECE === scope);
        const pRow = (label: string, value: string) => `<tr><td style="padding:4px 8px;border:1px solid #bbb;background:#f1f5f9;font-weight:bold;width:40%">${label}</td><td style="padding:4px 8px;border:1px solid #bbb">${value}</td></tr>`;
        const personalInfo = `
            <div style="border:1px solid #ccc;border-radius:6px;margin-bottom:10px;overflow:hidden">
                <div style="background:#1f2937;color:#fff;padding:5px 10px;font-weight:bold;font-size:12px">المعلومات الشخصية</div>
                <table style="width:100%;border-collapse:collapse;font-size:12px">
                    ${pRow('الاسم', ben.BENEFICIAIRE)}
                    ${pRow('العنوان', ben.ADRESSE || '—')}
                    ${pRow('رقم السجل التجاري (RC)', ben.RC || '—')}
                    ${pRow('رقم التعريف الجبائي', ben.CODE_FISCALE || '—')}
                    ${accounts.length > 0 ? pRow('الحسابات البنكية', accounts.map(a => `${a.BANQUE || ''} (${a.RIB})`).join('<br/>')) : ''}
                </table>
            </div>`;
        const body = `
            <html dir="rtl" lang="ar"><head><meta charset="utf-8">
            <title>تفاصيل المستفيد</title>
            <style>
                @page { size: A4; margin: 8mm; }
                html, body { margin: 0; padding: 0; }
                body { font-family: Tahoma, Arial, sans-serif; font-size: 12px; color: #111; }
                h2 { margin: 0 0 10px; font-size: 16px; }
            </style>
            </head><body>
            <h2 style="text-align:center">كل معلومات المستفيد</h2>
            ${personalInfo}
            ${contractsToPrint.map(buildContractHtml).join('')}
            </body></html>`;

        // استخدم iframe مخفيًا بدل window.open (الذي قد يُحجب داخل Tauri)
        const frame = document.createElement('iframe');
        frame.style.position = 'fixed';
        frame.style.right = '0';
        frame.style.bottom = '0';
        frame.style.width = '0';
        frame.style.height = '0';
        frame.style.border = '0';
        document.body.appendChild(frame);
        const win = frame.contentWindow;
        if (!win) return;
        win.document.open();
        win.document.write(body);
        win.document.close();
        win.focus();
        setTimeout(() => { try { win.print(); } catch (e) { console.warn('Print failed:', e); } }, 150);
        setTimeout(() => frame.remove(), 2000);
        setPrintMenuId(null);
    };

    if (!isOpen || !ben) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="كل معلومات المستفيد" maxWidth="5xl">
            <div dir="rtl" className="space-y-5 text-right">

                {/* ── 1. المعلومات الشخصية ── */}
                <section className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <h3 className="text-sm font-black text-blue-800 mb-3 flex items-center gap-2">
                        <i className="bi bi-person-vcard"></i> المعلومات الشخصية
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        <div><span className="text-gray-500 font-bold">الاسم:</span> <span className="font-bold">{ben.BENEFICIAIRE}</span></div>
                        <div><span className="text-gray-500 font-bold">العنوان:</span> {ben.ADRESSE || '—'}</div>
                        <div><span className="text-gray-500 font-bold">رقم السجل التجاري (RC):</span> {ben.RC || '—'}</div>
                        <div><span className="text-gray-500 font-bold">رقم التعريف الجبائي:</span> {ben.CODE_FISCALE || '—'}</div>
                    </div>

                    {accounts.length > 0 && (
                        <div className="mt-3">
                            <div className="text-xs font-black text-blue-700 mb-1.5 flex items-center gap-1.5">
                                <i className="bi bi-bank"></i> الحسابات البنكية
                            </div>
                            <div className="space-y-2">
                                {accounts.map(acc => (
                                    <div key={acc.ID_COMPTE} className="bg-white rounded-lg border border-blue-200 px-3 py-2 text-sm grid grid-cols-1 md:grid-cols-2 gap-1">
                                        <div><span className="text-gray-500 font-bold">البنك:</span> {acc.BANQUE || '—'}</div>
                                        <div><span className="text-gray-500 font-bold">رقم الحساب (RIB):</span> <span className="font-mono" dir="ltr">{acc.RIB}</span></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </section>

                {/* ── 2. العقود ── */}
                {contracts.length === 0 ? (
                    <section className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center text-gray-500 text-sm">
                        لا توجد عقود مرتبطة بهذا المستفيد.
                    </section>
                ) : (
                    contracts.map((contract: Piece, ci: number) => {
                        const contractId = contract.ID_PIECE;
                        const children = childPiecesFor(contractId);
                        const allPieceIds = [contractId, ...children.map(c => c.ID_PIECE)];
                        const engs = engagementsForPieces(allPieceIds);
                        const pais = paymentsForPieces(allPieceIds);
                        const lots = lotsForPiece(contractId);
                        const penaltyTotal = pais.reduce((s, p) => s + (p.PENALITE_RETARD || 0), 0);
                        const totalEngs = engs.reduce((s, e) => s + (e.MONTANT_ENG || 0), 0);
                        const totalPais = pais.reduce((s, p) => s + (p.MONTANT_PAI || 0), 0);
                        const contractEng = engs.find(e => Number(e.ID_PIECE) === contractId);
                        const op = db.T_OPERATION.find(o => o.ID_OPERATION === Number(contract.ID_OPERATION));

                        const contractOds = db.T_ODS.filter(o => Number(o.ID_PIECE) === contractId);
                        const startWorksDate = contractOds.find(o => o.NATURE_ODS === 'انطلاق')?.DATE_ODS;
                        const tempTakeoverDate = contractOds.find(o => o.NATURE_ODS === 'ختام')?.DATE_ODS;

                        // ملخص مالي
                        const advanceForfaitaire = pais.reduce((m, p) => Math.max(m, p.AVANCE_FORFAITAIRE || 0), 0);
                        const advanceAppro = pais.reduce((m, p) => Math.max(m, p.AVANCE_APPROVISIONNEMENT || 0), 0);
                        const advancesTotal = advanceForfaitaire + advanceAppro;
                        const repaymentTotal = pais.reduce((s, p) => s + (p.REMBOURSEMENT_AVANCE_FORFAITAIRE || 0) + (p.REMBOURSEMENT_AVANCE_APPROVISIONNEMENT || 0), 0);
                        const guaranteeRetention = pais.reduce((s, p) => s + (p.RETENUE_GARANTIE || 0), 0);
                        const extraDeduction = pais.reduce((s, p) => s + (p.AUTRE_DEDUCTION || 0), 0);

                        // المبلغ الجديد للعقد = مبلغ العقد + الملاحق + مقررات الفسخ
                        const addendumTotal = children
                            .filter(c => c.NAT_PIECE === 'ملحق')
                            .reduce((s, c) => s + (c.MONTANT_PIECE || 0), 0);
                        const terminationTotal = children
                            .filter(c => c.NAT_PIECE === 'قرار فسخ')
                            .reduce((s, c) => s + (c.MONTANT_PIECE || 0), 0);
                        const newContractAmount = (contract.MONTANT_PIECE || 0) + addendumTotal + terminationTotal;

                        // نسبة الضمان من كفالة الضمان (CAUTION)
                        let guaranteePct = 0;
                        const cautionMatch = (contract.CAUTION || '').match(/\d+(\.\d+)?/);
                        if (cautionMatch) {
                            const v = parseFloat(cautionMatch[0]);
                            guaranteePct = v > 1 ? v : v * 100;
                        }
                        const guaranteeAmount = (newContractAmount * guaranteePct) / 100;

                        return (
                            <section key={contractId} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                                <div className="bg-gray-800 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 text-sm font-black">
                                        <i className="bi bi-briefcase-fill"></i>
                                        عقد {ci + 1}: {contract.PIECE}
                                        <span className="text-[10px] bg-blue-500 rounded-full px-2 py-0.5">{getPieceTypeLabel(contract.NAT_PIECE)}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-xs text-gray-300">المبلغ: <span className="text-emerald-300 font-bold">{formatCurrency(contract.MONTANT_PIECE)}</span></div>
                                        <div className="relative">
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); setPrintMenuId(printMenuId === contractId ? null : contractId); }}
                                                title="طباعة"
                                                className="flex items-center gap-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-2.5 py-1 rounded-full transition-colors"
                                            >
                                                <i className="bi bi-printer"></i> طباعة
                                            </button>
                                            {printMenuId === contractId && (
                                                <div className="absolute left-0 top-full mt-1 z-20 bg-white rounded-lg shadow-xl border border-gray-200 py-1 w-52">
                                                    <button
                                                        type="button"
                                                        onClick={() => handlePrint('all')}
                                                        className="w-full text-right px-3 py-2 text-xs font-bold text-gray-700 hover:bg-blue-50 flex items-center gap-2"
                                                    >
                                                        <i className="bi bi-person-vcard text-blue-500"></i> طباعة كل معلومات المستفيد
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handlePrint(contractId)}
                                                        className="w-full text-right px-3 py-2 text-xs font-bold text-gray-700 hover:bg-blue-50 flex items-center gap-2"
                                                    >
                                                        <i className="bi bi-briefcase text-amber-500"></i> طباعة هذا العقد فقط
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 space-y-4 text-sm">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                        <div><span className="text-gray-500 font-bold">مدة الإنجاز:</span><div className="font-bold">{contract.DELAI_EX_JOURS || '—'}</div></div>
                                        {contract.CAUTION ? (
                                            <div><span className="text-gray-500 font-bold">كفالة الضمان:</span><div className="font-bold text-amber-700">{contract.CAUTION}</div></div>
                                        ) : null}
                                        {guaranteePct > 0 && (
                                            <div><span className="text-gray-500 font-bold">مبلغ الضمان ({guaranteePct.toFixed(0)}%):</span><div className="font-bold text-blue-700">{formatCurrency(guaranteeAmount)}</div></div>
                                        )}
                                        {contract.N_VISA_CM && (
                                            <div><span className="text-gray-500 font-bold">رقم التأشيرة (CM):</span><div className="font-mono" dir="ltr">{contract.N_VISA_CM}</div></div>
                                        )}
                                        {contract.DATE_VISA_CM && (
                                            <div><span className="text-gray-500 font-bold">تاريخ التأشيرة (CM):</span><div className="font-bold">{fmtDate(contract.DATE_VISA_CM)}</div></div>
                                        )}
                                        {contractEng?.N_VISA_CB && (
                                            <div><span className="text-gray-500 font-bold">رقم التأشيرة (CB):</span><div className="font-mono" dir="ltr">{contractEng.N_VISA_CB}</div></div>
                                        )}
                                        {contractEng?.DATE_VISA_CB && (
                                            <div><span className="text-gray-500 font-bold">تاريخ التأشيرة (CB):</span><div className="font-bold">{fmtDate(contractEng.DATE_VISA_CB)}</div></div>
                                        )}
                                        {startWorksDate && (
                                            <div><span className="text-gray-500 font-bold">تاريخ انطلاق الأشغال:</span><div className="font-bold">{fmtDate(startWorksDate)}</div></div>
                                        )}
                                        {tempTakeoverDate && (
                                            <div><span className="text-gray-500 font-bold">تاريخ محضر الاستلام المؤقت:</span><div className="font-bold">{fmtDate(tempTakeoverDate)}</div></div>
                                        )}
                                        {contract.N_OD_PIECE && (
                                            <div><span className="text-gray-500 font-bold">رقم أمر الخدمة:</span><div className="font-mono" dir="ltr">{contract.N_OD_PIECE}</div></div>
                                        )}
                                        {contract.DATE_OD_PIECE && (
                                            <div><span className="text-gray-500 font-bold">تاريخ أمر الخدمة:</span><div className="font-bold">{fmtDate(contract.DATE_OD_PIECE)}</div></div>
                                        )}
                                    </div>

                                    {op && (
                                        <div className="bg-sky-50 border border-sky-200 rounded-lg px-3 py-2">
                                            <div className="text-xs">
                                                <span className="text-gray-500 font-bold">رقم العملية:</span> <span className="font-mono font-bold" dir="ltr">{op.N_OPERATION}</span>
                                            </div>
                                            <div className="text-xs mt-0.5">
                                                <span className="text-gray-500 font-bold">عنوان العملية:</span> <span className="font-bold text-sky-800">{op.INT_OPERATION}</span>
                                            </div>
                                        </div>
                                    )}

                                    {lots.length > 0 && (
                                        <div>
                                            <div className="text-xs font-black text-gray-600 mb-1.5 flex items-center gap-1.5"><i className="bi bi-layers"></i> الحصص</div>
                                            <div className="flex flex-wrap gap-2">
                                                {lots.map(l => (
                                                    <span key={l.ID_LOT} className="bg-amber-50 border border-amber-200 rounded-full px-3 py-1 text-xs">
                                                        حصة {l.N_LOT} — {l.INTITULE_LOT}
                                                        <span className="text-gray-500"> ({formatCurrency(l.MONTANT_INITIALE_LOT)})</span>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {children.length > 0 && (
                                        <div>
                                            <div className="text-xs font-black text-gray-600 mb-1.5 flex items-center gap-1.5"><i className="bi bi-files"></i> الوثائق المرتبطة بالعقد</div>
                                            <div className="space-y-1.5">
                                                {children.map((c: Piece) => {
                                                    const cEngs = engagementsForPieces([c.ID_PIECE]);
                                                    const cPais = paymentsForPieces([c.ID_PIECE]);
                                                    return (
                                                        <div key={c.ID_PIECE} className="border border-gray-200 rounded-lg p-2.5">
                                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="bg-gray-100 rounded-full px-2 py-0.5 text-xs font-black">{getPieceTypeLabel(c.NAT_PIECE)}</span>
                                                                    <span className="text-xs font-bold">{c.PIECE}</span>
                                                                </div>
                                                                <span className="text-xs text-gray-500">المبلغ: {formatCurrency(c.MONTANT_PIECE)}</span>
                                                            </div>
                                                            {(c.N_VISA_CM || c.DATE_VISA_CM) && (
                                                                <div className="mt-1 text-xs text-gray-600">
                                                                    {c.N_VISA_CM && <span>رقم التأشيرة: <span className="font-mono" dir="ltr">{c.N_VISA_CM}</span> · </span>}
                                                                    {c.DATE_VISA_CM && <span>التاريخ: {fmtDate(c.DATE_VISA_CM)}</span>}
                                                                </div>
                                                            )}
                                                            {cEngs.map(e => (
                                                                <div key={e.ID_ENGAGEMENT} className="mt-1 text-xs bg-indigo-50 rounded px-2 py-1">
                                                                    التزام — {e.N_ENG} | المبلغ: {formatCurrency(e.MONTANT_ENG)}
                                                                    {e.N_VISA_CB && <span> | تأشيرة CB: <span className="font-mono" dir="ltr">{e.N_VISA_CB}</span></span>}
                                                                    {e.DATE_VISA_CB && <span> | {fmtDate(e.DATE_VISA_CB)}</span>}
                                                                </div>
                                                            ))}
                                                            {cPais.map(p => (
                                                                <div key={p.ID_PAIEMENT} className="mt-1 text-xs bg-emerald-50 rounded px-2 py-1">
                                                                    دفع — {p.N_PAI} | المبلغ: {formatCurrency(p.MONTANT_PAI)}
                                                                    {p.N_MANDAT && <span> | حوالة: <span className="font-mono" dir="ltr">{p.N_MANDAT}</span></span>}
                                                                    {p.DATE_MANDAT && <span> | {fmtDate(p.DATE_MANDAT)}</span>}
                                                                    {p.DATE_ADMIS && <span> | قبول: {fmtDate(p.DATE_ADMIS)}</span>}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* الملخص المالي للعقد */}
                                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                                        <div className="text-xs font-black text-gray-700 mb-2 flex items-center gap-1.5">
                                            <i className="bi bi-calculator"></i> الملخص المالي للعقد
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
                                            <div className="bg-white rounded-lg border border-indigo-200 px-3 py-2 flex items-center justify-between">
                                                <span className="text-gray-500 font-bold">مجموع الالتزامات</span>
                                                <span className="font-black text-indigo-700">{formatCurrency(totalEngs)}</span>
                                            </div>
                                            <div className="bg-white rounded-lg border border-emerald-200 px-3 py-2 flex items-center justify-between">
                                                <span className="text-gray-500 font-bold">مجموع الدفعات</span>
                                                <span className="font-black text-emerald-700">{formatCurrency(totalPais)}</span>
                                            </div>
                                            <div className="bg-white rounded-lg border border-rose-200 px-3 py-2 flex items-center justify-between">
                                                <span className="text-gray-500 font-bold">مجموع عقوبات التأخير</span>
                                                <span className="font-black text-rose-600">{formatCurrency(penaltyTotal)}</span>
                                            </div>
                                            <div className="bg-white rounded-lg border border-sky-200 px-3 py-2 flex items-center justify-between">
                                                <span className="text-gray-500 font-bold">مجموع التسبيقات</span>
                                                <span className="font-black text-sky-700">{formatCurrency(advancesTotal)}</span>
                                            </div>
                                            <div className="bg-white rounded-lg border border-teal-200 px-3 py-2 flex items-center justify-between">
                                                <span className="text-gray-500 font-bold">مجموع تسديد التسبيقات</span>
                                                <span className="font-black text-teal-700">{formatCurrency(repaymentTotal)}</span>
                                            </div>
                                            <div className="bg-white rounded-lg border border-amber-200 px-3 py-2 flex items-center justify-between">
                                                <span className="text-gray-500 font-bold">مجموع اقتطاع الضمان</span>
                                                <span className="font-black text-amber-700">{formatCurrency(guaranteeRetention)}</span>
                                            </div>
                                            <div className="bg-white rounded-lg border border-gray-300 px-3 py-2 flex items-center justify-between">
                                                <span className="text-gray-500 font-bold">مبلغ اقتطاع بالزيادة</span>
                                                <span className="font-black text-gray-700">{formatCurrency(extraDeduction)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        );
                    })
                )}
            </div>
        </Modal>
    );
};

export default BeneficiaryDetailsModal;
