import React, { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { formatCurrency } from '../utils/currencyUtils';
import { formatDate, parseDate } from '../utils/dateUtils';
import Modal from './Modal';
import { CompteBancaire, Engagement, LotPiece, Paiement, Piece } from '../types';

const fmtDate = (dateStr?: string | null): string => {
    if (!dateStr) return 'â€”';
    const d = parseDate(dateStr);
    return d ? formatDate(d) : dateStr;
};

interface BeneficiaryDetailsModalProps {
    isOpen: boolean;
    beneficiaryId: number | null;
    onClose: () => void;
}

const CONTRACT_TYPES = ['ØµÙÙ‚Ø©', 'Ø§ØªÙØ§Ù‚ÙŠØ©'];

const getPieceTypeLabel = (nature?: string | null): string => {
    const map: Record<string, string> = {
        'ØµÙÙ‚Ø©': 'Ø§Ù„ØµÙÙ‚Ø©',
        'Ø§ØªÙØ§Ù‚ÙŠØ©': 'Ø§Ù„Ø§ØªÙØ§Ù‚ÙŠØ©',
        'Ù…Ù„Ø­Ù‚': 'Ù…Ù„Ø­Ù‚',
        'Ù‚Ø±Ø§Ø± ÙØ³Ø®': 'Ù…Ù‚Ø±Ø± Ø§Ù„ÙØ³Ø®',
        'ÙˆØ¶Ø¹ÙŠØ© Ø§Ù„Ø£Ø´ØºØ§Ù„': 'ÙˆØ¶Ø¹ÙŠØ© Ø§Ù„Ø£Ø´ØºØ§Ù„',
        'ÙˆØ¶Ø¹ÙŠØ© Ø§Ù„ØªØ³Ø¨ÙŠÙ‚ Ø§Ù„Ø¬Ø²Ø§ÙÙŠ': 'ÙˆØ¶Ø¹ÙŠØ© Ø§Ù„ØªØ³Ø¨ÙŠÙ‚ Ø§Ù„Ø¬Ø²Ø§ÙÙŠ',
        'ÙˆØ¶Ø¹ÙŠØ© Ø§Ù„ØªØ³Ø¨ÙŠÙ‚ Ø¹Ù„Ù‰ Ø§Ù„ØªÙ…ÙˆÙŠÙ†': 'ÙˆØ¶Ø¹ÙŠØ© Ø§Ù„ØªØ³Ø¨ÙŠÙ‚ Ø¹Ù„Ù‰ Ø§Ù„ØªÙ…ÙˆÙŠÙ†',
        'ÙØ§ØªÙˆØ±Ø©': 'ÙØ§ØªÙˆØ±Ø©',
        'Ø­ÙƒÙ… Ù‚Ø¶Ø§Ø¦ÙŠ': 'Ø­ÙƒÙ… Ù‚Ø¶Ø§Ø¦ÙŠ',
        'Ø±ÙØ¹ Ø§Ù„ÙŠØ¯ Ø¹Ù† Ø§Ù„Ø¶Ù…Ø§Ù†': 'Ø±ÙØ¹ Ø§Ù„ÙŠØ¯ Ø¹Ù† Ø§Ù„Ø¶Ù…Ø§Ù†',
    };
    return nature ? (map[nature] || nature) : 'ÙˆØ«ÙŠÙ‚Ø©';
};

const BeneficiaryDetailsModal: React.FC<BeneficiaryDetailsModalProps> = ({ isOpen, beneficiaryId, onClose }) => {
    const { db } = useData();

    const ben = beneficiaryId ? db.T_BENEFICIAIRE.find(b => b.ID_BENEFICIAIRE === beneficiaryId) : null;

    // All pieces belonging to this beneficiary
    const benPieces = useMemo(() => {
        if (!beneficiaryId) return [];
        return db.T_PIECE.filter(p => Number(p.ID_BENEFICIAIRE) === beneficiaryId);
    }, [beneficiaryId, db.T_PIECE]);

    const accounts = useMemo(() => {
        if (!beneficiaryId) return [];
        return db.T_COMPTE_BANCAIRE.filter((a: CompteBancaire) => Number(a.ID_BENEFICIAIRE) === beneficiaryId);
    }, [beneficiaryId, db.T_COMPTE_BANCAIRE]);

    // Contracts
    const contracts = benPieces.filter((p: Piece) => CONTRACT_TYPES.includes(p.NAT_PIECE));

    const childPiecesFor = (contractId: number) => benPieces.filter((c: Piece) => Number(c.ID_PIECE_INIT) === contractId);

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

    if (!isOpen || !ben) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="ÙƒÙ„ Ù…Ø¹Ù„ÙˆÙ…Ø§Øª Ø§Ù„Ù…Ø³ØªÙÙŠØ¯" maxWidth="5xl">
            <div dir="rtl" className="space-y-5 text-right">

                {/* â”€â”€ 1. Ù…Ø¹Ù„ÙˆÙ…Ø§Øª Ø´Ø®ØµÙŠØ© â”€â”€ */}
                <section className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <h3 className="text-sm font-black text-blue-800 mb-3 flex items-center gap-2">
                        <i className="bi bi-person-vcard"></i> Ø§Ù„Ù…Ø¹Ù„ÙˆÙ…Ø§Øª Ø§Ù„Ø´Ø®ØµÙŠØ©
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        <div><span className="text-gray-500 font-bold">Ø§Ù„Ø§Ø³Ù…:</span> {ben.BENEFICIAIRE}</div>
                        <div><span className="text-gray-500 font-bold">Ø§Ù„Ø¹Ù†ÙˆØ§Ù†:</span> {ben.ADRESSE || 'â€”'}</div>
                        <div><span className="text-gray-500 font-bold">Ø±Ù‚Ù… Ø§Ù„Ø³Ø¬Ù„ Ø§Ù„ØªØ¬Ø§Ø±ÙŠ (RC):</span> {ben.RC || 'â€”'}</div>
                        <div><span className="text-gray-500 font-bold">Ø±Ù‚Ù… Ø§Ù„ØªØ¹Ø±ÙŠÙ Ø§Ù„Ø¬Ø¨Ø§Ø¦ÙŠ:</span> {ben.CODE_FISCALE || 'â€”'}</div>
                    </div>

                    {accounts.length > 0 && (
                        <div className="mt-3">
                            <div className="text-xs font-black text-blue-700 mb-1.5 flex items-center gap-1.5">
                                <i className="bi bi-bank"></i> Ø§Ù„Ø­Ø³Ø§Ø¨Ø§Øª Ø§Ù„Ø¨Ù†ÙƒÙŠØ©
                            </div>
                            <div className="space-y-2">
                                {accounts.map(acc => (
                                    <div key={acc.ID_COMPTE} className="bg-white rounded-lg border border-blue-200 px-3 py-2 text-sm grid grid-cols-1 md:grid-cols-2 gap-1">
                                        <div><span className="text-gray-500 font-bold">Ø§Ù„Ø¨Ù†Ùƒ:</span> {acc.BANQUE || 'â€”'}</div>
                                        <div><span className="text-gray-500 font-bold">Ø±Ù‚Ù… Ø§Ù„Ø­Ø³Ø§Ø¨ (RIB):</span> <span className="font-mono" dir="ltr">{acc.RIB}</span></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </section>

                {/* â”€â”€ 2. Ø§Ù„Ø¹Ù‚ÙˆØ¯ â”€â”€ */}
                {contracts.length === 0 ? (
                    <section className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center text-gray-500 text-sm">
                        Ù„Ø§ ØªÙˆØ¬Ø¯ Ø¹Ù‚ÙˆØ¯ Ù…Ø±ØªØ¨Ø·Ø© Ø¨Ù‡Ø°Ø§ Ø§Ù„Ù…Ø³ØªÙÙŠØ¯.
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

                        return (
                            <section key={contractId} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                                {/* Ø±Ø£Ø³ Ø§Ù„Ø¹Ù‚Ø¯ */}
                                <div className="bg-gray-800 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 text-sm font-black">
                                        <i className="bi bi-briefcase-fill"></i>
                                        Ø¹Ù‚Ø¯ {ci + 1}: {contract.PIECE}
                                        <span className="text-[10px] bg-blue-500 rounded-full px-2 py-0.5">{getPieceTypeLabel(contract.NAT_PIECE)}</span>
                                    </div>
                                    <div className="text-xs text-gray-300">Ø§Ù„Ù…Ø¨Ù„Øº: <span className="text-emerald-300 font-bold">{formatCurrency(contract.MONTANT_PIECE)}</span></div>
                                </div>

                                <div className="p-4 space-y-4 text-sm">
                                    {/* Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø¹Ù‚Ø¯ Ø§Ù„Ø£Ø³Ø§Ø³ÙŠØ© */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                        <div><span className="text-gray-500 font-bold">Ù…Ø¯Ø© Ø§Ù„Ø¥Ù†Ø¬Ø§Ø²:</span><div className="font-bold">{contract.DELAI_EX_JOURS || 'â€”'}</div></div>
                                        {contract.CAUTION ? (
                                            <div><span className="text-gray-500 font-bold">ÙƒÙØ§Ù„Ø© Ø§Ù„Ø¶Ù…Ø§Ù†:</span><div className="font-bold text-amber-700">{contract.CAUTION}</div></div>
                                        ) : null}
                                        {contract.N_VISA_CM && (
                                            <div><span className="text-gray-500 font-bold">Ø±Ù‚Ù… Ø§Ù„ØªØ£Ø´ÙŠØ±Ø© (CM):</span><div className="font-mono" dir="ltr">{contract.N_VISA_CM}</div></div>
                                        )}
                                        {contract.DATE_VISA_CM && (
                                            <div><span className="text-gray-500 font-bold">ØªØ§Ø±ÙŠØ® Ø§Ù„ØªØ£Ø´ÙŠØ±Ø©:</span><div className="font-bold">{fmtDate(contract.DATE_VISA_CM)}</div></div>
                                        )}
                                        {contract.N_OD_PIECE && (
                                            <div><span className="text-gray-500 font-bold">Ø±Ù‚Ù… Ø£Ù…Ø± Ø§Ù„Ø®Ø¯Ù…Ø©:</span><div className="font-mono" dir="ltr">{contract.N_OD_PIECE}</div></div>
                                        )}
                                        {contract.DATE_OD_PIECE && (
                                            <div><span className="text-gray-500 font-bold">ØªØ§Ø±ÙŠØ® Ø£Ù…Ø± Ø§Ù„Ø®Ø¯Ù…Ø©:</span><div className="font-bold">{fmtDate(contract.DATE_OD_PIECE)}</div></div>
                                        )}
                                    </div>

                                    {/* Ø§Ù„Ø­ØµØµ */}
                                    {lots.length > 0 && (
                                        <div>
                                            <div className="text-xs font-black text-gray-600 mb-1.5 flex items-center gap-1.5"><i className="bi bi-layers"></i> Ø§Ù„Ø­ØµØµ</div>
                                            <div className="flex flex-wrap gap-2">
                                                {lots.map(l => (
                                                    <span key={l.ID_LOT} className="bg-amber-50 border border-amber-200 rounded-full px-3 py-1 text-xs">
                                                        Ø­ØµØ© {l.N_LOT} â€” {l.INTITULE_LOT}
                                                        <span className="text-gray-500"> ({formatCurrency(l.MONTANT_INITIALE_LOT)})</span>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Ù…Ù„Ø§Ø­Ù‚ / Ù…Ù‚Ø±Ø±Ø§Øª ÙØ³Ø® / ÙˆØ¶Ø¹ÙŠØ§Øª */}
                                    {children.length > 0 && (
                                        <div>
                                            <div className="text-xs font-black text-gray-600 mb-1.5 flex items-center gap-1.5"><i className="bi bi-files"></i> Ø§Ù„ÙˆØ«Ø§Ø¦Ù‚ Ø§Ù„Ù…Ø±ØªØ¨Ø·Ø© Ø¨Ø§Ù„Ø¹Ù‚Ø¯</div>
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
                                                                <span className="text-xs text-gray-500">Ø§Ù„Ù…Ø¨Ù„Øº: {formatCurrency(c.MONTANT_PIECE)}</span>
                                                            </div>
                                                            {(c.N_VISA_CM || c.DATE_VISA_CM) && (
                                                                <div className="mt-1 text-xs text-gray-600">
                                                                    {c.N_VISA_CM && <span>Ø±Ù‚Ù… Ø§Ù„ØªØ£Ø´ÙŠØ±Ø©: <span className="font-mono" dir="ltr">{c.N_VISA_CM}</span> Â· </span>}
                                                                    {c.DATE_VISA_CM && <span>Ø§Ù„ØªØ§Ø±ÙŠØ®: {fmtDate(c.DATE_VISA_CM)}</span>}
                                                                </div>
                                                            )}
                                                            {cEngs.map(e => (
                                                                <div key={e.ID_ENGAGEMENT} className="mt-1 text-xs bg-indigo-50 rounded px-2 py-1">
                                                                    Ø§Ù„ØªØ²Ø§Ù… â€” {e.N_ENG} | Ø§Ù„Ù…Ø¨Ù„Øº: {formatCurrency(e.MONTANT_ENG)}
                                                                    {e.N_VISA_CB && <span> | ØªØ£Ø´ÙŠØ±Ø© CB: <span className="font-mono" dir="ltr">{e.N_VISA_CB}</span></span>}
                                                                    {e.DATE_VISA_CB && <span> | {fmtDate(e.DATE_VISA_CB)}</span>}
                                                                </div>
                                                            ))}
                                                            {cPais.map(p => (
                                                                <div key={p.ID_PAIEMENT} className="mt-1 text-xs bg-emerald-50 rounded px-2 py-1">
                                                                    Ø¯ÙØ¹ â€” {p.N_PAI} | Ø§Ù„Ù…Ø¨Ù„Øº: {formatCurrency(p.MONTANT_PAI)}
                                                                    {p.N_MANDAT && <span> | Ø­ÙˆØ§Ù„Ø©: <span className="font-mono" dir="ltr">{p.N_MANDAT}</span></span>}
                                                                    {p.DATE_MANDAT && <span> | {fmtDate(p.DATE_MANDAT)}</span>}
                                                                    {p.DATE_ADMIS && <span> | Ù‚Ø¨ÙˆÙ„: {fmtDate(p.DATE_ADMIS)}</span>}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Ø§Ù„ØªØ²Ø§Ù…Ø§Øª Ø§Ù„Ø¹Ù‚Ø¯ */}
                                    {engs.length > 0 && (
                                        <div>
                                            <div className="text-xs font-black text-gray-600 mb-1.5 flex items-center gap-1.5"><i className="bi bi-pen"></i> Ø§Ù„Ø§Ù„ØªØ²Ø§Ù…Ø§Øª</div>
                                            <div className="space-y-1.5">
                                                {engs.map(e => (
                                                    <div key={e.ID_ENGAGEMENT} className="bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                                                        <div className="text-xs">
                                                            <span className="font-black">{e.N_ENG}</span> â€” {e.OBJET_ENG || ''}
                                                            <span className="text-gray-500"> ({e.ANNEE})</span>
                                                        </div>
                                                        <div className="text-xs">
                                                            <span className="text-gray-500">Ø§Ù„Ù…Ø¨Ù„Øº:</span> <span className="font-bold">{formatCurrency(e.MONTANT_ENG)}</span>
                                                            {e.N_VISA_CB && <span className="mr-2 text-gray-500">ØªØ£Ø´ÙŠØ±Ø© CB:</span>}
                                                            {e.N_VISA_CB && <span className="font-mono" dir="ltr">{e.N_VISA_CB}</span>}
                                                            {e.DATE_VISA_CB && <span className="text-gray-500"> ({fmtDate(e.DATE_VISA_CB)})</span>}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Ø§Ù„Ø¯ÙØ¹Ø§Øª / Ø§Ù„Ø­ÙˆØ§Ù„Ø§Øª */}
                                    {pais.length > 0 && (
                                        <div>
                                            <div className="text-xs font-black text-gray-600 mb-1.5 flex items-center gap-1.5"><i className="bi bi-cash-coin"></i> Ø§Ù„Ø¯ÙØ¹Ø§Øª ÙˆØ§Ù„Ø­ÙˆØ§Ù„Ø§Øª</div>
                                            <div className="space-y-1.5">
                                                {pais.map(p => (
                                                    <div key={p.ID_PAIEMENT} className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 flex flex-wrap items-center justify-between gap-2">
                                                        <div className="text-xs">
                                                            <span className="font-black">{p.N_PAI}</span> â€” {p.OBJET_PAI || ''}
                                                            <span className="text-gray-500"> ({p.ANNEE})</span>
                                                        </div>
                                                        <div className="text-xs grid grid-cols-2 gap-x-4 gap-y-0.5">
                                                            <div><span className="text-gray-500">Ø§Ù„Ù…Ø¨Ù„Øº:</span> <span className="font-bold">{formatCurrency(p.MONTANT_PAI)}</span></div>
                                                            <div><span className="text-gray-500">Ø­ÙˆØ§Ù„Ø©:</span> <span className="font-mono" dir="ltr">{p.N_MANDAT || 'â€”'}</span></div>
                                                            <div><span className="text-gray-500">ØªØ§Ø±ÙŠØ® Ø§Ù„Ø­ÙˆØ§Ù„Ø©:</span> {p.DATE_MANDAT ? fmtDate(p.DATE_MANDAT) : 'â€”'}</div>
                                                            <div><span className="text-gray-500">ØªØ§Ø±ÙŠØ® Ù‚Ø¨ÙˆÙ„ Ø§Ù„Ø¯ÙØ¹:</span> {p.DATE_ADMIS ? fmtDate(p.DATE_ADMIS) : 'â€”'}</div>
                                                            {p.PENALITE_RETARD ? (
                                                                <div><span className="text-gray-500">Ø¹Ù‚ÙˆØ¨Ø© Ø§Ù„ØªØ£Ø®Ø±:</span> <span className="font-bold text-rose-600">{formatCurrency(p.PENALITE_RETARD)}</span></div>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø¹Ù‚ÙˆØ¨Ø§Øª Ø§Ù„ØªØ£Ø®Ø± */}
                                    {penaltyTotal > 0 && (
                                        <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-sm flex items-center justify-between">
                                            <span className="font-black text-rose-700 flex items-center gap-1.5"><i className="bi bi-exclamation-triangle"></i> Ø¥Ø¬Ù…Ø§Ù„ÙŠ Ø¹Ù‚ÙˆØ¨Ø© Ø§Ù„ØªØ£Ø®Ø±</span>
                                            <span className="font-black text-rose-700">{formatCurrency(penaltyTotal)}</span>
                                        </div>
                                    )}
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

