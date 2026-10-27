import React from 'react';
import { Piece, Database } from '../types';
import { formatCurrency } from '../utils/currencyUtils';
import { normalizeDate } from '../utils/dateUtils';

interface DocumentInfoBoxProps {
    piece: Piece;
    details: any;
    odsCalcs: any;
    db: Database;
}

/**
 * The "selected document info" card previously rendered on the left side of the
 * documents table. Extracted so both DocumentsPage and DocumentDetailsPage share it.
 */
const DocumentInfoBox: React.FC<DocumentInfoBoxProps> = ({ piece, details, odsCalcs, db }) => {
    if (piece.NAT_PIECE === 'أخرى') return null;

    const basePieceId = details?.basePiece?.ID_PIECE || piece.ID_PIECE;

    return (
        <div className="bg-white rounded-lg shadow-md border-r-4 border-sky-400 overflow-hidden">
            <div className="bg-gray-50 px-3 py-2 border-b flex items-center justify-between">
                <h3 className="text-xs font-bold text-blue-800 flex items-center gap-2">
                    <i className="bi bi-info-circle-fill"></i>
                    {piece.NAT_PIECE === 'قرار فسخ' && details?.basePiece ? details.basePiece.PIECE : piece.PIECE}
                </h3>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${details?.isAmendment ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                    {details?.isAmendment ? details.amendmentLabel : piece.NAT_PIECE}
                </span>
            </div>

            <div className="p-3 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(['ملحق', 'قرار فسخ', 'وضعية الأشغال', 'وضعية التسبيق الجزافي', 'وضعية التسبيق على التموين', 'فاتورة', 'حكم قضائي'].includes(piece.NAT_PIECE)) && details?.basePiece && (
                        <div className="col-span-1 md:col-span-2 bg-blue-50 p-2 rounded border border-blue-100">
                            <p className="text-[9px] text-gray-500 font-bold mb-1">الوثيقة الأصلية (الصفقة/الاتفاقية):</p>
                            <p className="text-[10px] font-bold text-blue-900 leading-tight">
                                {details.basePiece.PIECE}
                            </p>
                        </div>
                    )}

                    {['صفقة', 'اتفاقية'].includes(piece.NAT_PIECE) && (
                        <>
                            <div className="col-span-1 md:col-span-2 grid grid-cols-2 gap-2 border-b pb-2">
                                <div className="space-y-1">
                                    <p className="text-[9px] text-gray-500 font-bold">رقم التعريف الجبائي (NIF):</p>
                                    <p className="text-[10px] font-semibold text-gray-800 text-right" dir="ltr">
                                        {details?.beneficiaire?.CODE_FISCALE || '---'}
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[9px] text-gray-500 font-bold">رقم السجل التجاري (NRC):</p>
                                    <p className="text-[10px] font-semibold text-gray-800 text-right" dir="ltr">
                                        {details?.beneficiaire?.RC || '---'}
                                    </p>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[9px] text-gray-500 font-bold">عنوان المستفيد:</p>
                                <p className="text-[10px] font-semibold text-gray-800 leading-tight">
                                    {details?.beneficiaire?.ADRESSE || '---'}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[9px] text-gray-500 font-bold">الحساب البنكي (RIB):</p>
                                <div className="flex flex-wrap gap-x-2 items-center">
                                    <p className="text-[10px] font-bold text-gray-800 font-mono">
                                        {details?.compte?.RIB || '---'}
                                    </p>
                                    {details?.compte?.BANQUE && (
                                        <span className="text-[8px] bg-blue-50 text-blue-700 px-1 py-0.2 rounded border border-blue-100 font-bold">
                                            {details.compte.BANQUE}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {(piece.NAT_PIECE === 'صفقة' || (piece.NAT_PIECE === 'ملحق' && (piece.N_VISA_CM || piece.DATE_VISA_CM))) && (
                        <div className="space-y-1 border-t pt-2">
                            <p className="text-[9px] text-gray-500 font-bold mb-1">تأشيرة لجنة الصفقات:</p>
                            <div className="bg-pink-50 p-1 rounded border border-pink-200">
                                <p className="text-[10px] font-bold text-gray-700">
                                    رقم: {piece.N_VISA_CM || '---'}
                                </p>
                                <p className="text-[9px] text-gray-500 font-semibold">
                                    بتاريخ: {piece.DATE_VISA_CM ? normalizeDate(piece.DATE_VISA_CM) : '---'}
                                </p>
                            </div>
                        </div>
                    )}

                    {(['صفقة', 'اتفاقية', 'ملحق', 'مقرر', 'قرار فسخ', 'فاتورة','حكم قضائي'].includes(piece.NAT_PIECE)) && (
                        <div className="space-y-1 border-t pt-2">
                            <p className="text-[9px] text-gray-500 font-bold mb-1">تأشيرة المراقب المالي:</p>
                            {details?.engagement ? (
                                <div className="bg-blue-50 p-1 rounded border border-blue-200">
                                    <p className="text-[10px] font-bold text-blue-700">
                                        رقم: {details.engagement.N_VISA_CB || '---'} في: {normalizeDate(details.engagement.DATE_VISA_CB)}
                                    </p>
                                    <p className="text-[9px] text-blue-600 font-semibold">
                                        بطاقة: {details.engagement.N_ENG}/{details.engagement.ANNEE}
                                    </p>
                                </div>
                            ) : (
                                <p className="text-[10px] font-semibold text-red-500 italic">غير ملتزم بها بعد</p>
                            )}
                        </div>
                    )}

                    {['فاتورة', 'وضعية الأشغال', 'وضعية التسبيق الجزافي', 'وضعية التسبيق على التموين','حكم قضائي'].includes(piece.NAT_PIECE) && (
                        <div className="space-y-1 border-t pt-2">
                            <p className="text-[9px] text-gray-500 font-bold mb-1">رقم و تاريخ الحوالة (تاريخ القبول):</p>
                            <div className="bg-green-50 p-1 rounded border border-green-100">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="text-[10px] font-bold text-green-700">
                                            {details?.paiement?.N_MANDAT ? `رقم: ${details.paiement.N_MANDAT}` : 'بدون رقم'}
                                        </p>
                                        <p className="text-[9px] text-green-600 font-semibold">
                                            {details?.paiement?.DATE_MANDAT ? `بتاريخ: ${normalizeDate(details.paiement.DATE_MANDAT)}` : ''}
                                        </p>
                                    </div>
                                    <div className="bg-white/50 px-1 py-0.5 rounded border border-green-200">
                                        <p className="text-[8px] text-gray-500 font-bold leading-none mb-0.5">تاريخ القبول</p>
                                        <p className="text-[10px] font-bold text-green-800 leading-none">
                                            {details?.paiement?.DATE_ADMIS ? normalizeDate(details.paiement.DATE_ADMIS) : '---'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                            {details && details.delayPenalty !== 0 && (
                                <div className="mt-1 bg-red-50 p-1.5 rounded border border-red-100 flex justify-between items-center">
                                    <p className="text-[9px] text-red-500 font-bold">عقوبة التأخير:</p>
                                    <p className="text-[10px] font-black text-red-700 text-left" dir="ltr">
                                        {formatCurrency(details.delayPenalty)}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {(['صفقة', 'اتفاقية', 'قرار فسخ', 'ملحق', 'وضعية الأشغال', 'فاتورة', 'وضعية التسبيق الجزافي', 'وضعية التسبيق على التموين','حكم قضائي'].includes(piece.NAT_PIECE)) && details && (
                    <div className="border-t pt-2 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                            {details.terminationAmount !== 0 && (
                                <div className="bg-red-50 p-1.5 rounded border border-red-100">
                                    <p className="text-[9px] text-red-500 font-bold">مبلغ الفسخ: {formatCurrency(details.terminationAmount)}</p>
                                </div>
                            )}
                            <div className="bg-blue-50 p-1.5 rounded border border-blue-100 flex justify-between items-center">
                                <p className="text-[9px] text-blue-500 font-bold">المبلغ الجديد: {formatCurrency(details.newTotalAmount)}</p>
                                {details.amendmentsCount > 0 && (
                                    <span className="text-[8px] bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded-full font-bold">
                                        {details.amendmentsCount} ملحق
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="bg-orange-50 p-2 rounded border border-orange-100 flex justify-between items-center">
                            <div>
                                <p className="text-[9px] text-orange-600 font-bold">إجمالي الدفع: {formatCurrency(details.totalPaid)}</p>
                                {details.unregisteredPaymentsAmount > 0 && (
                                    <p className="text-[8px] text-red-600 font-bold mt-0.5">
                                        دفع غير مسجل: {formatCurrency(details.unregisteredPaymentsAmount)}
                                    </p>
                                )}
                            </div>
                            <div className="text-right space-y-1">
                                {details.workSituationsCount > 0 && details.totalPaid > 0 && (
                                    <span className="text-[9px] bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded-full font-bold block text-center">
                                        {details.workSituationsCount} وضعية
                                    </span>
                                )}
                                {details.unregisteredRelatedCount > 0 && (
                                    <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-bold block text-center" title="عدد الوثائق غير المسجلة">
                                        {details.unregisteredRelatedCount} غ. مسجلة
                                    </span>
                                )}
                                {details.delayPenalty !== 0 && (
                                    <div className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded border border-red-200">
                                        <p className="text-[8px] font-bold leading-none mb-0.5">إجمالي العقوبات</p>
                                        <p className="text-[9px] font-black leading-none text-left" dir="ltr">
                                            {formatCurrency(details.delayPenalty)}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-1">
                            <div className="flex justify-between items-center">
                                <p className="text-[9px] text-gray-500 font-bold">نسبة التقدم المالي:</p>
                                <span className="text-[10px] font-bold text-gray-700">
                                    {Math.min(100, details.progressPercent).toFixed(1)}%
                                </span>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                                <div
                                    className={`h-full ${details.progressPercent >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                                    style={{ width: `${Math.min(100, details.progressPercent)}%` }}
                                ></div>
                            </div>
                        </div>

                        <div className="flex justify-between items-center border-t pt-1">
                            <p className="text-[9px] text-gray-500 font-bold">المبلغ المتبقي:</p>
                            <p className={`text-[10px] font-black ${details.remainingAmount < 0 ? 'text-red-600' : 'text-gray-700'}`} dir="ltr">
                                {formatCurrency(details.remainingAmount)}
                            </p>
                        </div>

                        {odsCalcs?.warrantyEndDate && (
                            <div className="border-t border-dashed pt-2 mt-1">
                                <div className="bg-purple-50 p-2 rounded border border-purple-200">
                                    <div className="flex justify-between items-center mb-1">
                                        <p className="text-[9px] text-purple-700 font-bold">تاريخ انتهاء الضمان:</p>
                                        <span className="text-[10px] font-black text-purple-900">
                                            {normalizeDate(odsCalcs.warrantyEndDate.toISOString().split('T')[0])}
                                        </span>
                                    </div>
                                    {(piece.CAUTION || db.T_PIECE.some(p => p.ID_PIECE_INIT === basePieceId && (p.PIECE.includes('ضمان') || p.PIECE.toLowerCase().includes('caution')))) && (
                                        odsCalcs.isWarrantyExpired ? (
                                            <div className="flex items-center gap-1 text-[9px] text-green-700 font-black mt-1 bg-green-100/50 px-1 rounded">
                                                <i className="bi bi-shield-check"></i>
                                                يمكن رفع اليد الضمان {piece.CAUTION ? `(${piece.CAUTION})` : ''}
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1 text-[9px] text-red-600 font-black mt-1 bg-red-100/50 px-1 rounded border border-red-200">
                                                <i className="bi bi-exclamation-triangle"></i>
                                                لا يمكن رفع اليد الضمان
                                            </div>
                                        )
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DocumentInfoBox;
