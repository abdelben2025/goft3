import React, { useState, useMemo, useCallback } from 'react';
import { Page, User, Piece, Database } from '../types';
import { useData } from '../context/DataContext';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import PageWrapper from '../components/PageWrapper';
import Modal from '../components/Modal';
import DocumentInfoBox from '../components/DocumentInfoBox';
import AddLotPieceForm from '../components/forms/AddLotPieceForm';
import AddOdsForm from '../components/forms/AddOdsForm';
import { useDocumentDetails } from '../hooks/useDocumentDetails';
import { formatCurrency } from '../utils/currencyUtils';
import { formatDurationArabic, normalizeDate } from '../utils/dateUtils';
import { errorMessage } from '../utils/errorMessage';

interface DocumentDetailsPageProps {
    navigate: (page: Page, id?: number, tab?: string) => void;
    currentUser: User;
    onGoBack?: () => void;
    pieceId: number | null;
}

const DocumentDetailsPage: React.FC<DocumentDetailsPageProps> = ({ navigate, currentUser, onGoBack, pieceId }) => {
    const { db, loading, addItem, updateItem, deleteItem } = useData();
    const { t } = useLanguage();
    const { showToast } = useToast();

    const piece = useMemo<Piece | null>(() => {
        if (!pieceId) return null;
        return db.T_PIECE.find(p => Number(p.ID_PIECE) === Number(pieceId)) || null;
    }, [pieceId, db.T_PIECE]);

    const isViewer = currentUser.ROLE === 'viewer';

    const [modalState, setModalState] = useState<{
        type: 'LOT_PIECE' | 'ODS' | null;
        data?: any;
        timestamp?: number;
    }>({ type: null });

    const checkPermission = useCallback((operationId: number) => {
        if (isViewer) return false;
        const operation = db.T_OPERATION.find(op => Number(op.ID_OPERATION) === Number(operationId));
        if (!operation) return false;
        return operation.CREATED_BY === currentUser.ID_USER || currentUser.ROLE === 'admin';
    }, [isViewer, currentUser.ID_USER, currentUser.ROLE, db.T_OPERATION]);

    const allLotsForOperation = useMemo(() => {
        if (!piece) return [];
        return db.T_LOT_OPERATION.filter(lot => Number(lot.ID_OPERATION) === Number(piece.ID_OPERATION));
    }, [piece, db.T_LOT_OPERATION]);

    const alreadyAssociatedLotIds = useMemo(() => {
        return db.T_LOT_PIECE.map(lp => lp.ID_LOT);
    }, [db.T_LOT_PIECE]);

    const handleSaveTable = useCallback(async (table: keyof Database, data: any, idField: string) => {
        try {
            if (data[idField]) {
                await updateItem(table, data[idField], data);
                showToast(t('det.editSuccess'), 'success');
            } else {
                await addItem(table, data);
                showToast(t('det.addSuccess'), 'success');
            }
            setModalState({ type: null });
        } catch (error) {
            showToast(t('det.saveError', { reason: errorMessage(error) }), 'error');
        }
    }, [addItem, updateItem, showToast, t]);

    const handleSaveLotPiece = useCallback(async (data: any) => {
        if (!piece) return;
        if (!checkPermission(piece.ID_OPERATION)) {
            alert(t('det.noEditPermission'));
            return;
        }
        if (data.ID_LOT) {
            const existingLink = db.T_LOT_PIECE.find(lp => lp.ID_LOT === data.ID_LOT && lp.ID_LOT_PIECE !== data.ID_LOT_PIECE);
            if (existingLink) {
                alert(t('docsalert.lotAlreadyLinked'));
                return;
            }
        }
        try {
            await handleSaveTable('T_LOT_PIECE', data, 'ID_LOT_PIECE');
            if (data.ID_LOT) {
                const lot = db.T_LOT_OPERATION.find(l => l.ID_LOT === data.ID_LOT);
                if (lot) {
                    await updateItem('T_LOT_OPERATION', lot.ID_LOT, { ...lot, ATTRIBUER: true });
                }
            }
        } catch (error) {
            showToast(t('docsalert.linkLotError', { reason: errorMessage(error) }), 'error');
        }
    }, [piece, checkPermission, handleSaveTable, db.T_LOT_PIECE, db.T_LOT_OPERATION, updateItem, showToast, t]);

    const handleAddLot = useCallback(() => {
        if (!piece) return;
        if (loading) { alert(t('det.waitUpdate')); return; }
        if (!['صفقة', 'اتفاقية', 'فاتورة'].includes(piece.NAT_PIECE)) {
            alert(t('docsalert.lotsOnlyContract'));
            return;
        }
        if (checkPermission(piece.ID_OPERATION)) {
            setModalState({ type: 'LOT_PIECE', timestamp: Date.now() });
        } else {
            alert(t('docsalert.noAddPermission'));
        }
    }, [piece, loading, checkPermission, t]);

    const handleAddOds = useCallback(() => {
        if (!piece) return;
        if (loading) { alert(t('det.waitUpdate')); return; }
        if (!['صفقة', 'اتفاقية'].includes(piece.NAT_PIECE)) {
            alert(t('docsalert.odsOnlyContract'));
            return;
        }
        if (checkPermission(piece.ID_OPERATION)) {
            setModalState({ type: 'ODS', timestamp: Date.now() });
        } else {
            alert(t('docsalert.noAddPermission'));
        }
    }, [piece, loading, checkPermission, t]);

    const handleEditLot = useCallback((lp: any) => {
        if (!piece) return;
        if (!checkPermission(piece.ID_OPERATION)) { alert(t('docsalert.noEditPermission')); return; }
        setModalState({
            type: 'LOT_PIECE',
            data: {
                ID_LOT_PIECE: lp.ID_LOT_PIECE,
                ID_LOT: lp.ID_LOT,
                ID_PIECE: piece.ID_PIECE,
                DELAI_EX_JOURS: lp.DELAI_EX_JOURS
            },
            timestamp: Date.now()
        });
    }, [piece, checkPermission, t]);

    const handleDeleteLot = useCallback(async (lp: any) => {
        if (!piece) return;
        if (!checkPermission(piece.ID_OPERATION)) { alert(t('det.noDeletePermission')); return; }
        if (!window.confirm(t('docsalert.deleteLotConfirm'))) return;
        try {
            await deleteItem('T_LOT_PIECE', lp.ID_LOT_PIECE);
            const remainingLinks = db.T_LOT_PIECE.filter(l => l.ID_LOT === lp.ID_LOT && l.ID_LOT_PIECE !== lp.ID_LOT_PIECE);
            if (remainingLinks.length === 0) {
                const lot = db.T_LOT_OPERATION.find(l => l.ID_LOT === lp.ID_LOT);
                if (lot) {
                    await updateItem('T_LOT_OPERATION', lot.ID_LOT, { ...lot, ATTRIBUER: false });
                }
            }
            showToast(t('docsalert.lotDeletedSuccess'), 'success');
        } catch (error) {
            showToast(t('det.deleteError', { reason: errorMessage(error) }), 'error');
        }
    }, [piece, checkPermission, deleteItem, updateItem, db.T_LOT_PIECE, db.T_LOT_OPERATION, showToast, t]);

    const handleEditOds = useCallback((ods: any) => {
        if (!piece) return;
        if (!checkPermission(piece.ID_OPERATION)) { alert(t('docsalert.noEditPermission')); return; }
        setModalState({ type: 'ODS', data: ods, timestamp: Date.now() });
    }, [piece, checkPermission, t]);

    const handleDeleteOds = useCallback(async (ods: any) => {
        if (!piece) return;
        if (!checkPermission(piece.ID_OPERATION)) { alert(t('det.noDeletePermission')); return; }
        if (!window.confirm(t('docsalert.deleteOdsConfirm'))) return;
        try {
            await deleteItem('T_ODS', ods.ID_ODS);
            showToast(t('docsalert.odsDeletedSuccess'), 'success');
        } catch (error) {
            showToast(t('det.deleteError', { reason: errorMessage(error) }), 'error');
        }
    }, [piece, checkPermission, deleteItem, showToast, t]);

    const { associatedLotsData, associatedLotObjects, associatedOds, odsCalculations, selectedPieceDetails } = useDocumentDetails(piece, db);

    const linkedOperation = useMemo(() => {
        if (!piece) return null;
        return db.T_OPERATION.find(op => op.ID_OPERATION === piece.ID_OPERATION) || null;
    }, [piece, db.T_OPERATION]);

    if (loading) return <div className="p-8 text-center">{t('loading')}</div>;

    if (!piece) {
        return (
            <PageWrapper title={t('doc.details_title')} navigate={navigate} onGoBack={onGoBack} currentUser={currentUser}>
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <i className="bi bi-file-earmark-x-fill text-5xl text-gray-300 mb-3"></i>
                    <p className="text-gray-500 font-bold">{t('doc.document_not_found')}</p>
                    <button
                        onClick={() => navigate('DOCUMENTS')}
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors"
                    >
                        {t('doc.back_to_documents')}
                    </button>
                </div>
            </PageWrapper>
        );
    }

    const isContract = ['صفقة', 'اتفاقية'].includes(piece.NAT_PIECE);

    return (
        <PageWrapper
            title={t('doc.details_title')}
            navigate={navigate}
            onGoBack={onGoBack}
            currentUser={currentUser}
            breadcrumb={[{ label: t('menu.documents'), page: 'DOCUMENTS' }]}
        >
            {/* ── Document summary header ── */}
            <div className="bg-gradient-to-l from-sky-50 via-white to-indigo-50 border border-sky-100 rounded-xl p-3 mb-4 shadow-sm flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center flex-shrink-0 shadow-sm">
                        <i className="bi bi-file-earmark-text-fill text-xl"></i>
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-base font-extrabold text-gray-900 leading-tight truncate">{piece.PIECE}</h2>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold border border-blue-200">
                                {piece.NAT_PIECE}
                            </span>
                            {linkedOperation && (
                                <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-bold border border-gray-200">
                                    {linkedOperation.N_OPERATION} — {linkedOperation.INT_OPERATION}
                                </span>
                            )}
                            {piece.MONTANT_PIECE != null && (
                                <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold border border-green-200">
                                    {formatCurrency(piece.MONTANT_PIECE)}
                                </span>
                            )}
                            {piece.DELAI_EX_JOURS && (
                                <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold border border-amber-200">
                                    <i className="bi bi-clock-history ml-1"></i>
                                    {t('doc.completion_duration', { duration: formatDurationArabic(piece.DELAI_EX_JOURS) })}
                                </span>
                            )}
                            {piece.CAUTION != null && piece.CAUTION !== '' && (
                                <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold border border-purple-200">
                                    <i className="bi bi-shield-lock-fill ml-1"></i>
                                    {piece.TYPE_CAUTION === 'RETENTION' ? t('doc.caution_retention') : t('doc.caution_bank')}: {piece.CAUTION}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 lg:gap-3 flex-wrap">
                    <button
                        onClick={() => navigate('DOCUMENTS')}
                        className="bg-white text-gray-600 border border-gray-200 px-3 py-1.5 rounded-[20px] text-xs font-bold hover:bg-gray-50 transition-colors shadow-sm"
                    >
                        <i className="bi bi-arrow-left mr-1"></i> {t('menu.documents')}
                    </button>
                    <button
                        onClick={() => navigate('OPERATION_DETAILS', piece.ID_OPERATION)}
                        className="bg-blue-600 text-white px-3 py-1.5 rounded-[20px] text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm"
                    >
                        <i className="bi bi-kanban mr-1"></i> {t('col.operation')}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                {/* ── Info box (left) ── */}
                <div className="xl:col-span-1 space-y-4">
                    <DocumentInfoBox piece={piece} details={selectedPieceDetails} odsCalcs={odsCalculations} db={db} />
                </div>

                {/* ── Lots + ODS tables (right) ── */}
                <div className="xl:col-span-2 space-y-4">
                    {/* Associated lots table */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2 bg-indigo-50 border-b border-indigo-100">
                            <h3 className="text-xs font-extrabold text-indigo-800 flex items-center gap-2">
                                <i className="bi bi-paperclip"></i>
                                {t('lbl.linked_lots')}
                            </h3>
                            <div className="flex items-center gap-2">
                                <span className="bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded-full font-bold">
                                    {associatedLotsData.length}
                                </span>
                                {!isViewer && (
                                    <button
                                        onClick={handleAddLot}
                                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-0.5 rounded-[20px] text-[10px] font-bold transition-colors shadow-sm flex items-center gap-1"
                                        title={t('doc.add_lot')}
                                    >
                                        <i className="bi bi-plus-circle-fill"></i>
                                        <span>{t('doc.add_lot')}</span>
                                    </button>
                                )}
                            </div>
                        </div>
                        {associatedLotsData.length > 0 ? (
                            <div className="overflow-auto max-h-72">
                                <table className="w-full text-right text-xs">
                                    <thead className="bg-indigo-100/60 sticky top-0 z-10">
                                        <tr>
                                            <th className="p-2 text-[9px] font-bold text-indigo-700">{t('doc.lot_number')}</th>
                                            <th className="p-2 text-[9px] font-bold text-indigo-700">{t('doc.lot_label')}</th>
                                            <th className="p-2 text-[9px] font-bold text-indigo-700 text-center">{t('doc.duration_col')}</th>
                                            <th className="p-2 text-[9px] font-bold text-indigo-700 text-left">{t('doc.initial_amount')}</th>
                                            <th className="p-2 text-[9px] font-bold text-indigo-700 text-left">{t('doc.final_amount')}</th>
                                            <th className="p-2 text-[9px] font-bold text-indigo-700 text-center">{t('col.status')}</th>
                                            <th className="p-2 text-[9px] font-bold text-indigo-700 text-center">{t('doc.actions')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {associatedLotsData.map(lot => (
                                            <tr key={lot.ID_LOT_PIECE} className="hover:bg-indigo-50/50 transition-colors">
                                                <td className="p-2 font-bold text-gray-800">{lot.N_LOT}</td>
                                                <td className="p-2 text-gray-700">{lot.INTITULE_LOT}</td>
                                                <td className="p-2 text-center">
                                                    <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full font-bold">
                                                        {formatDurationArabic(lot.DELAI_EX_JOURS)}
                                                    </span>
                                                </td>
                                                <td className="p-2 text-left font-semibold text-gray-700">{formatCurrency(lot.MONTANT_INITIALE_LOT)}</td>
                                                <td className="p-2 text-left font-semibold text-gray-700">{formatCurrency(lot.MONTANT_FINALE_LOT)}</td>
                                                <td className="p-2 text-center">
                                                    {lot.ATTRIBUER ? (
                                                        <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">{t('doc.awarded')}</span>
                                                    ) : (
                                                        <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold">{t('doc.not_awarded')}</span>
                                                    )}
                                                </td>
                                                <td className="p-2 text-center">
                                                    {!isViewer && (
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <button
                                                                onClick={() => handleEditLot(lot)}
                                                                className="text-[10px] bg-blue-50 hover:bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 font-bold transition-colors flex items-center gap-1"
                                                                title={t('doc.edit_lot')}
                                                            >
                                                                <i className="bi bi-pencil-fill"></i>
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteLot(lot)}
                                                                className="text-[10px] bg-red-50 hover:bg-red-100 text-red-600 px-1.5 py-0.5 rounded border border-red-200 font-bold transition-colors flex items-center gap-1"
                                                                title={t('doc.delete_lot')}
                                                            >
                                                                <i className="bi bi-trash-fill"></i>
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                                <i className="bi bi-paperclip text-3xl text-gray-300 mb-2"></i>
                                <p className="text-gray-400 text-sm font-medium">{t('doc.no_linked_lots')}</p>
                            </div>
                        )}
                    </div>

                    {/* ODS table */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2 bg-sky-50 border-b border-sky-100">
                            <h3 className="text-xs font-extrabold text-sky-800 flex items-center gap-2">
                                <i className="bi bi-clipboard-check"></i>
                                {t('doc.ods_title')}
                            </h3>
                            <div className="flex items-center gap-2">
                                <span className="bg-sky-100 text-sky-700 text-[10px] px-2 py-0.5 rounded-full font-bold">
                                    {associatedOds.length}
                                </span>
                                {!isViewer && (
                                    <button
                                        onClick={handleAddOds}
                                        className="bg-sky-600 hover:bg-sky-700 text-white px-2.5 py-0.5 rounded-[20px] text-[10px] font-bold transition-colors shadow-sm flex items-center gap-1"
                                        title={t('doc.add_ods')}
                                    >
                                        <i className="bi bi-plus-circle-fill"></i>
                                        <span>{t('doc.add_ods')}</span>
                                    </button>
                                )}
                            </div>
                        </div>
                        {associatedOds.length > 0 ? (
                            <div className="overflow-auto max-h-80">
                                <table className="w-full text-right text-xs">
                                    <thead className="bg-sky-100/60 sticky top-0 z-10">
                                        <tr>
                                            <th className="p-2 text-[9px] font-bold text-sky-700">{t('col.nature')}</th>
                                            <th className="p-2 text-[9px] font-bold text-sky-700">{t('col.date')}</th>
                                            <th className="p-2 text-[9px] font-bold text-sky-700">{t('doc.subject')}</th>
                                            <th className="p-2 text-[9px] font-bold text-sky-700 text-center">{t('doc.lot')}</th>
                                            <th className="p-2 text-[9px] font-bold text-sky-700 text-center">{t('doc.actions')}</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {associatedOds.map(ods => {
                                            const lotName = ods.ID_LOT
                                                ? associatedLotsData.find(l => l.ID_LOT === ods.ID_LOT)?.N_LOT
                                                : null;
                                            return (
                                                <tr key={ods.ID_ODS} className="hover:bg-sky-50/50 transition-colors">
                                                    <td className="p-2">
                                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                                                            ods.NATURE_ODS === 'انطلاق' ? 'bg-green-100 text-green-700 border-green-200' :
                                                            ods.NATURE_ODS === 'ختام' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                                            ods.NATURE_ODS === 'ايقاف' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                                                            'bg-gray-100 text-gray-600 border-gray-200'
                                                        }`}>
                                                            {ods.NATURE_ODS}
                                                        </span>
                                                    </td>
                                                    <td className="p-2 text-gray-700" dir="ltr">{normalizeDate(ods.DATE_ODS)}</td>
                                                    <td className="p-2 text-gray-700">{ods.OBJET_ODS}</td>
                                                    <td className="p-2 text-center">
                                                        {lotName ? (
                                                            <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold border border-yellow-200">
                                                                {lotName}
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-400">—</span>
                                                        )}
                                                    </td>
                                                    <td className="p-2 text-center">
                                                        {!isViewer && (
                                                            <div className="flex items-center justify-center gap-1.5">
                                                                <button
                                                                    onClick={() => handleEditOds(ods)}
                                                                    className="text-[10px] bg-blue-50 hover:bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200 font-bold transition-colors flex items-center gap-1"
                                                                    title={t('doc.edit_ods')}
                                                                >
                                                                    <i className="bi bi-pencil-fill"></i>
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteOds(ods)}
                                                                    className="text-[10px] bg-red-50 hover:bg-red-100 text-red-600 px-1.5 py-0.5 rounded border border-red-200 font-bold transition-colors flex items-center gap-1"
                                                                    title={t('doc.delete_ods')}
                                                                >
                                                                    <i className="bi bi-trash-fill"></i>
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-8 text-center">
                                <i className="bi bi-clipboard-x text-3xl text-gray-300 mb-2"></i>
                                <p className="text-gray-400 text-sm font-medium">{t('doc.no_ods')}</p>
                            </div>
                        )}
                    </div>

                    {/* Contract deadline summary card */}
                    {isContract && odsCalculations?.startDate && (
                        <div className={`rounded-xl border p-3 shadow-sm ${odsCalculations.isLate ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'}`}>
                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
                                <div className="flex items-center gap-2">
                                    <i className={`bi ${odsCalculations.isLate ? 'bi-exclamation-octagon-fill text-red-500' : 'bi-calendar-check-fill text-blue-500'}`}></i>
                                    <span className="font-bold text-gray-600">{t('doc.expected_end_date')}</span>
                                    <span className={`font-black ${odsCalculations.isLate ? 'text-red-700' : 'text-blue-800'}`}>
                                        {normalizeDate(odsCalculations.expectedEndDate.toISOString().split('T')[0])}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-gray-600">{t('doc.consumed_days')}</span>
                                    <span className="font-black text-indigo-700">{t('doc.day_unit', { count: odsCalculations.consumedDays })}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-gray-600">
                                        {odsCalculations.isLate ? t('doc.delay_days') : t('doc.remaining_days')}
                                    </span>
                                    <span className={`font-black ${odsCalculations.isLate ? 'text-red-700' : 'text-blue-800'}`}>
                                        {t('doc.day_unit', { count: odsCalculations.isLate ? odsCalculations.delayDays : odsCalculations.remainingDays })}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <i className="bi bi-pause-circle-fill text-amber-500"></i>
                                    <span className="font-bold text-gray-600">{t('doc.suspension_days')}</span>
                                    <span className="font-black text-amber-700">{t('doc.day_unit', { count: odsCalculations.totalSuspensionDays })}</span>
                                </div>
                                {odsCalculations.isSuspended && (
                                    <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-300">
                                        <i className="bi bi-pause-circle-fill ml-1"></i>
                                        {t('doc.works_suspended', { days: odsCalculations.currentSuspensionDays })}
                                    </span>
                                )}
                                {odsCalculations.isCompleted && (
                                    <span className="bg-green-100 text-green-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-green-300">
                                        <i className="bi bi-check-circle-fill ml-1"></i>
                                        {t('doc.works_completed')}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <Modal isOpen={modalState.type === 'LOT_PIECE'} onClose={() => setModalState({ type: null })} title={t('doc.link_lot')}>
                {piece && (
                    <AddLotPieceForm
                        key={modalState.timestamp ? `lot-piece-${modalState.timestamp}` : 'add-lot-piece'}
                        onClose={() => setModalState({ type: null })}
                        onSave={handleSaveLotPiece}
                        pieceId={piece.ID_PIECE}
                        allLotsForOperation={allLotsForOperation}
                        alreadyAssociatedLotIds={alreadyAssociatedLotIds}
                        initialData={modalState.data}
                    />
                )}
            </Modal>
            <Modal isOpen={modalState.type === 'ODS'} onClose={() => setModalState({ type: null })} title={modalState.data ? t('doc.edit_ods') : t('doc.add_ods')}>
                {piece && (
                    <AddOdsForm
                        key={modalState.timestamp ? `ods-${modalState.timestamp}` : 'add-ods'}
                        onClose={() => setModalState({ type: null })}
                        onSave={(data) => handleSaveTable('T_ODS', data, 'ID_ODS')}
                        pieceId={piece.ID_PIECE}
                        initialData={modalState.data}
                        associatedOds={associatedOds}
                        associatedLots={associatedLotObjects}
                    />
                )}
            </Modal>
        </PageWrapper>
    );
};

export default DocumentDetailsPage;
