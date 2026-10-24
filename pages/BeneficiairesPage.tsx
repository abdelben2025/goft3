
import React, { useState, useMemo, useRef } from 'react';
import { Page, Beneficiaire, CompteBancaire, User } from '../types';
import { useData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { errorMessage } from '../utils/errorMessage';
import { useLanguage } from '../context/LanguageContext';
import PageWrapper from '../components/PageWrapper';
import Modal from '../components/Modal';
import ConfirmActionModal from '../components/ConfirmActionModal';
import AddBeneficiaryForm from '../components/forms/AddBeneficiaryForm';
import { exportToFormattedExcel } from '../utils/exportToCsv';
import CustomDropdown from '../components/CustomDropdown';
import ExcelJS from 'exceljs';

interface BeneficiairesPageProps {
    navigate: (page: Page, operationId?: number) => void;
    onGoBack?: () => void;
    currentUser: User;
    initialBeneficiaryId?: number | null;
}

const BeneficiairesPage: React.FC<BeneficiairesPageProps> = ({ navigate, onGoBack, currentUser, initialBeneficiaryId }) => {
    const { db, loading, addItem, updateItem, deleteItem, runInTransaction } = useData();
    const { showToast } = useToast();
    const { t } = useLanguage();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBeneficiary, setEditingBeneficiary] = useState<{ beneficiary: Beneficiaire, accounts: CompteBancaire[] } | undefined>(undefined);
    const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState<number | null>(null);
    const [highlightId, setHighlightId] = useState<number | null>(null);
    const [filterId, setFilterId] = useState<string>('');
    const [formKey, setFormKey] = useState(0); // Add key state to force remount
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

    const isViewer = currentUser.ROLE === 'viewer';

    React.useEffect(() => {
        if (initialBeneficiaryId) {
            setSelectedBeneficiaryId(initialBeneficiaryId);
            setHighlightId(initialBeneficiaryId);
            setFilterId(''); // Clear filter to ensure it's visible
            
            // Scroll to it
            setTimeout(() => {
                const element = document.getElementById(`beneficiary-row-${initialBeneficiaryId}`);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 300);

            // Remove highlight after some time
            const timer = setTimeout(() => {
                setHighlightId(null);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [initialBeneficiaryId]);

    const selectedBeneficiaryAccounts = useMemo(() => {
        if (!selectedBeneficiaryId) return [];
        return db.T_COMPTE_BANCAIRE.filter(acc => acc.ID_BENEFICIAIRE === selectedBeneficiaryId).sort((a, b) => a.ID_COMPTE - b.ID_COMPTE);
    }, [selectedBeneficiaryId, db.T_COMPTE_BANCAIRE]);

    const beneficiaryOptions = useMemo(() => {
        return db.T_BENEFICIAIRE.map(b => ({ value: b.ID_BENEFICIAIRE, label: b.BENEFICIAIRE }));
    }, [db.T_BENEFICIAIRE]);

    const filteredBeneficiaries = useMemo(() => {
        if (!filterId) return db.T_BENEFICIAIRE.slice().sort((a, b) => a.ID_BENEFICIAIRE - b.ID_BENEFICIAIRE);
        return db.T_BENEFICIAIRE.filter(b => b.ID_BENEFICIAIRE.toString() === filterId).sort((a, b) => a.ID_BENEFICIAIRE - b.ID_BENEFICIAIRE);
    }, [db.T_BENEFICIAIRE, filterId]);


    const handleSaveBeneficiary = async (data: { beneficiaryData: Omit<Beneficiaire, 'ID_BENEFICIAIRE'> | Beneficiaire; accounts: Array<{ rib: string; banque: string }> }) => {
        const { beneficiaryData, accounts } = data;
        
        showToast('جاري حفظ البيانات...', 'loading');

        try {
            await runInTransaction(async () => {
                if ('ID_BENEFICIAIRE' in beneficiaryData) {
                    // Update
                    const beneficiaryId = beneficiaryData.ID_BENEFICIAIRE;
                    await updateItem('T_BENEFICIAIRE', beneficiaryId, beneficiaryData);
                    
                    // Delete old accounts
                    const oldAccounts = db.T_COMPTE_BANCAIRE.filter(acc => acc.ID_BENEFICIAIRE === beneficiaryId);
                    for (const acc of oldAccounts) {
                        await deleteItem('T_COMPTE_BANCAIRE', acc.ID_COMPTE);
                    }
                    // Add new accounts
                    for (const acc of accounts) {
                        await addItem('T_COMPTE_BANCAIRE', { ID_BENEFICIAIRE: beneficiaryId, RIB: acc.rib, BANQUE: acc.banque });
                    }
                    showToast('تم تعديل المستفيد بنجاح', 'success');
                } else {
                    // Add new
                    const newBeneficiary = await addItem('T_BENEFICIAIRE', beneficiaryData);
                    const beneficiaryId = newBeneficiary.ID_BENEFICIAIRE;

                    for (const acc of accounts) {
                        await addItem('T_COMPTE_BANCAIRE', { ID_BENEFICIAIRE: beneficiaryId, RIB: acc.rib, BANQUE: acc.banque });
                    }
                    showToast('تمت إضافة المستفيد بنجاح', 'success');
                }
            });
            
            setIsModalOpen(false);
            setEditingBeneficiary(undefined);
        } catch (error) {
            showToast(`حدث خطأ أثناء الحفظ — السبب: ${errorMessage(error)}`, 'error');
        }
    };

    const handleDeleteBeneficiary = () => {
        if (selectedBeneficiaryId === null) return;
        setIsDeleteConfirmOpen(true);
    };

    const confirmDeleteBeneficiary = async () => {
        setIsDeleteConfirmOpen(false);
        if (selectedBeneficiaryId === null) return;
        showToast('جاري الحذف...', 'loading');
        try {
            await deleteItem('T_BENEFICIAIRE', selectedBeneficiaryId);
            showToast('تم حذف المستفيد بنجاح', 'success');
            setSelectedBeneficiaryId(null);
        } catch (error) {
            showToast(`حدث خطأ أثناء حذف المستفيد — السبب: ${errorMessage(error)}`, 'error');
        }
    };
    
    const openAddModal = () => {
        if (loading) {
            alert("يجب الانتظار حتى يتم تحديث النافذة");
            return;
        }
        setEditingBeneficiary(undefined);
        setFormKey(prev => prev + 1); // Increment key to force remount
        setIsModalOpen(true);
    };

    const openEditModal = () => {
        if (loading) {
            alert("يجب الانتظار حتى يتم تحديث النافذة");
            return;
        }
        if (selectedBeneficiaryId === null) return;
        const beneficiaryToEdit = db.T_BENEFICIAIRE.find(b => b.ID_BENEFICIAIRE === selectedBeneficiaryId);
        const accountsForBeneficiary = db.T_COMPTE_BANCAIRE.filter(acc => acc.ID_BENEFICIAIRE === selectedBeneficiaryId);
        if (beneficiaryToEdit) {
            setEditingBeneficiary({ beneficiary: beneficiaryToEdit, accounts: accountsForBeneficiary });
            setFormKey(prev => prev + 1); // Increment key to force remount
            setIsModalOpen(true);
        }
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleExport = () => {
        if (db.T_BENEFICIAIRE.length === 0) {
            alert('لا توجد بيانات للتصدير.');
            return;
        }
    
        const beneficiariesWithAccounts = filteredBeneficiaries.map(ben => ({
            ...ben,
            accounts: db.T_COMPTE_BANCAIRE.filter(acc => acc.ID_BENEFICIAIRE === ben.ID_BENEFICIAIRE)
        }));
    
        const maxAccounts = Math.max(0, ...beneficiariesWithAccounts.map(b => b.accounts.length));
    
        const headers = [t('col.beneficiary'), t('col.address'), t('col.rc'), t('col.tax_id')];
        for (let i = 1; i <= maxAccounts; i++) {
            headers.push(`رقم الحساب ${i}`, `البنك ${i}`);
        }
    
        const styles = `<style> table, th, td { border: 1px solid black; border-collapse: collapse; text-align: right; padding: 5px; font-family: Arial, sans-serif; vertical-align: middle; } th { background-color: #DDEBF7; font-weight: bold; text-align: center; } td { mso-number-format:"\\@"; } </style>`;
        let tableHtml = `${styles}<table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>`;
    
        beneficiariesWithAccounts.forEach(ben => {
            let rowHtml = `<tr>
                <td>${ben.BENEFICIAIRE}</td>
                <td>${ben.ADRESSE}</td>
                <td>${ben.RC || ''}</td>
                <td>${ben.CODE_FISCALE || ''}</td>`;
            
            for (let i = 0; i < maxAccounts; i++) {
                if (ben.accounts[i]) {
                    rowHtml += `<td>${ben.accounts[i].RIB}</td><td>${ben.accounts[i].BANQUE}</td>`;
                } else {
                    rowHtml += `<td></td><td></td>`;
                }
            }
            rowHtml += `</tr>`;
            tableHtml += rowHtml;
        });
    
        tableHtml += `</tbody></table>`;
        exportToFormattedExcel(tableHtml, 'beneficiaires.xls');
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                showToast('جاري استيراد البيانات...', 'loading');
                const buffer = e.target?.result as ArrayBuffer;
                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.load(buffer);
                
                const worksheet = workbook.getWorksheet(1);
                if (!worksheet) {
                    showToast("الملف فارغ أو بصيغة غير صحيحة", 'error');
                    return;
                }

                const json: any[] = [];
                const headers: string[] = [];
                
                worksheet.getRow(1).eachCell((cell, colNumber) => {
                    headers[colNumber] = String(cell.value || '');
                });

                worksheet.eachRow((row, rowNumber) => {
                    if (rowNumber === 1) return;
                    const rowData: any = {};
                    row.eachCell((cell, colNumber) => {
                        const header = headers[colNumber];
                        if (header) {
                            rowData[header] = cell.value;
                        }
                    });
                    json.push(rowData);
                });

                if (json.length === 0) {
                    showToast("الملف فارغ أو بصيغة غير صحيحة", 'error');
                    return;
                }

                let successCount = 0;
                let skippedCount = 0;
                let errorCount = 0;
                const errors: string[] = [];
                const skipped: string[] = [];

                // Run import in a single transaction to avoid UI freezes
                await runInTransaction(async () => {
                    for (const [index, row] of (json as any[]).entries()) {
                        try {
                            const beneficiaire = row['الإسم المستفيد']?.trim();
                            const adresse = row['العنوان']?.trim();

                            if (!beneficiaire || !adresse) {
                                errors.push(`السطر ${index + 2}: الحقول المطلوبة (الإسم المستفيد, العنوان) مفقودة.`);
                                errorCount++;
                                continue;
                            }

                            const existingBeneficiary = db.T_BENEFICIAIRE.find(b => b.BENEFICIAIRE.trim().toLowerCase() === beneficiaire.toLowerCase());
                            if (existingBeneficiary) {
                                skipped.push(`السطر ${index + 2}: المستفيد '${beneficiaire}' موجود بالفعل، تم تخطيه.`);
                                skippedCount++;
                                continue;
                            }

                            const beneficiaryData = {
                                BENEFICIAIRE: beneficiaire,
                                ADRESSE: adresse,
                                RC: row['رقم السجل'] || null,
                                CODE_FISCALE: row['التعريف الجبائي'] || null,
                            };

                            const accounts: { rib: string, banque: string }[] = [];
                            let hasAccount = false;
                            for (let i = 1; i <= 10; i++) { // Check for up to 10 accounts
                                const rib = row[`رقم الحساب ${i}`];
                                const banque = row[`البنك ${i}`];
                                if (rib && banque) {
                                    accounts.push({ rib: String(rib).trim(), banque: String(banque).trim() });
                                    hasAccount = true;
                                }
                            }

                            if (!hasAccount) {
                                errors.push(`السطر ${index + 2}: يجب توفير حساب بنكي واحد على الأقل للمستفيد '${beneficiaire}'.`);
                                errorCount++;
                                continue;
                            }

                            // Logic extracted from handleSaveBeneficiary but without extra transaction wrapper
                            const newBeneficiary = await addItem('T_BENEFICIAIRE', beneficiaryData);
                            const beneficiaryId = newBeneficiary.ID_BENEFICIAIRE;

                            for (const acc of accounts) {
                                await addItem('T_COMPTE_BANCAIRE', { ID_BENEFICIAIRE: beneficiaryId, RIB: acc.rib, BANQUE: acc.banque });
                            }
                            
                            successCount++;
                        } catch (innerError) {
                            console.error("Error processing row:", row, innerError);
                            errors.push(`السطر ${index + 2}: خطأ غير متوقع أثناء المعالجة.`);
                            errorCount++;
                        }
                    }
                });
                
                let summaryMessage = `اكتمل الاستيراد.\n\n- تمت إضافة ${successCount} مستفيدين جدد بنجاح.\n- تم تخطي ${skippedCount} مستفيدين لأنهم موجودون بالفعل.\n- فشلت معالجة ${errorCount} من السجلات.`;
                const details = [...skipped, ...errors];
                if (details.length > 0) {
                    summaryMessage += "\n\nالتفاصيل:\n" + details.slice(0, 10).join('\n');
                    if (details.length > 10) summaryMessage += `\n... و ${details.length - 10} ملاحظات أخرى.`
                }
                
                if (successCount > 0) showToast(`تم استيراد ${successCount} مستفيدين`, 'success');
                else if (errorCount > 0) showToast('فشل الاستيراد، راجع التفاصيل', 'error');

                alert(summaryMessage);

            } catch (error) {
                console.error('Failed to import data:', error);
                showToast(`فشل استيراد البيانات — السبب: ${errorMessage(error)}`, 'error');
            } finally {
                // Reset file input
                if (event.target) {
                    event.target.value = '';
                }
            }
        };
        reader.readAsArrayBuffer(file);
    };

    if (loading) return <div>{t('loading')}</div>;

    return (
        <PageWrapper
            title={t('page.beneficiaries')}
            navigate={navigate}
            onGoBack={onGoBack}
            backPage='HOME'
            currentUser={currentUser}
            actions={
                <div className="flex flex-wrap items-center gap-2">
                    <div className="w-full inset-ring-2 inset-ring-blue-500/50 sm:w-64 ml-0 sm:ml-4 mb-2 sm:mb-0">
                        <CustomDropdown
                            options={[{ value: '', label: t('filter.all_beneficiaries') }, ...beneficiaryOptions]}
                            value={filterId}
                            onChange={setFilterId}
                            placeholder={t('filter.beneficiary')}
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {!isViewer && (
                            <button onClick={handleImportClick} className="bg-purple-500 text-white px-2 py-1 sm:py-0.5 border border-green-100 rounded-[20px] hover:bg-purple-600 transition-colors text-xs whitespace-nowrap">
                                <i className="bi bi-file-earmark-excel mr-1"></i> {t('btn.import_excel')}
                            </button>
                        )}
                        <button onClick={handleExport} className="bg-teal-500 text-white px-2 py-1 sm:py-0.5 rounded-[20px] hover:bg-teal-600 transition-colors text-xs whitespace-nowrap">
                            <i className="bi bi-file-earmark-excel mr-1"></i> {t('btn.export_excel')}
                        </button>
                        {!isViewer && (
                            <>
                                <button onClick={openAddModal} className="bg-green-500 text-black px-2 py-1 sm:py-0.5 border border-green-100 rounded-[20px] hover:bg-green-600 transition-colors text-xs whitespace-nowrap">
                                    <i className="bi bi-plus-circle mr-1"></i> {t('btn.add')}
                                </button>
                                <button onClick={openEditModal} disabled={selectedBeneficiaryId === null} className="bg-yellow-500 text-white px-2 py-1 sm:py-0.5 rounded-[20px] hover:bg-yellow-600 transition-colors disabled:bg-gray-400 text-xs whitespace-nowrap">
                                    <i className="bi bi-pencil-fill mr-1"></i> {t('btn.edit')}
                                </button>
                                <button onClick={handleDeleteBeneficiary} disabled={selectedBeneficiaryId === null} className="bg-red-500 text-white px-2 py-1 sm:py-0.5 rounded-[20px] hover:bg-red-600 transition-colors disabled:bg-gray-400 text-xs whitespace-nowrap">
                                    <i className="bi bi-trash-fill mr-1"></i> {t('btn.delete')}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            }
        >
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".xlsx, .xls" />
            <div className="bg-white p-3 rounded-lg shadow-md overflow-auto max-h-[calc(100vh-16rem)] custom-scrollbar">
                <table className="w-full text-right min-w-[900px] relative">
                    <thead className="bg-blue-200 sticky top-0 z-20 shadow-sm">
                        <tr>
                            <th className="p-1 text-xs font-semibold text-gray-700 uppercase tracking-wider bg-blue-200 sticky top-0 z-20">{t('col.beneficiary')}</th>
                            <th className="p-1 text-xs font-semibold text-gray-700 uppercase tracking-wider bg-blue-200 sticky top-0 z-20">{t('col.address')}</th>
                            <th className="p-1 text-xs font-semibold text-gray-700 uppercase tracking-wider bg-blue-200 sticky top-0 z-20">{t('col.bank_accounts')}</th>
                            <th className="p-1 text-xs font-semibold text-gray-700 uppercase tracking-wider bg-blue-200 sticky top-0 z-20">{t('col.rc')}</th>
                            <th className="p-1 text-xs font-semibold text-gray-700 uppercase tracking-wider bg-blue-200 sticky top-0 z-20">{t('col.tax_id')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredBeneficiaries.map(b => (
                            <tr 
                                key={b.ID_BENEFICIAIRE} 
                                id={`beneficiary-row-${b.ID_BENEFICIAIRE}`}
                                onClick={() => setSelectedBeneficiaryId(b.ID_BENEFICIAIRE)} 
                                className={`border-b hover:bg-blue-100 cursor-pointer text-xs transition-all duration-500 
                                    ${selectedBeneficiaryId === b.ID_BENEFICIAIRE ? 'bg-blue-200' : ''}
                                    ${highlightId === b.ID_BENEFICIAIRE ? 'bg-green-100 ring-2 ring-green-500 animate-pulse font-bold' : ''}
                                `}
                            >
                                <td className={`p-2 font-semibold 
                                    ${highlightId === b.ID_BENEFICIAIRE ? 'text-green-900 font-bold' : 
                                      selectedBeneficiaryId === b.ID_BENEFICIAIRE ? 'text-gray-900 font-bold' : 'text-gray-800'}
                                `}>
                                    {b.BENEFICIAIRE}
                                </td>
                                <td className="p-2 text-gray-700">{b.ADRESSE}</td>
                                <td className="p-2 text-gray-700 text-center">{db.T_COMPTE_BANCAIRE.filter(acc => acc.ID_BENEFICIAIRE === b.ID_BENEFICIAIRE).length}</td>
                                <td className="p-2 text-gray-700">{b.RC || '---'}</td>
                                <td className="p-2 text-gray-700">{b.CODE_FISCALE || '---'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {selectedBeneficiaryId && (
                <div className="mt-4 bg-white p-3 rounded-lg shadow-md">
                    <h3 className="text-base font-bold text-gray-800 mb-2">
                        {t('col.bank_accounts')} {db.T_BENEFICIAIRE.find(b => b.ID_BENEFICIAIRE === selectedBeneficiaryId)?.BENEFICIAIRE}
                    </h3>
                     {selectedBeneficiaryAccounts.length > 0 ? (
                        <div className="overflow-auto max-h-64 custom-scrollbar">
                            <table className="w-full text-right relative">
                                <thead className="bg-gray-200 sticky top-0 z-10 shadow-sm">
                                    <tr>
                                        <th className="p-1 text-xs font-semibold text-gray-700 bg-gray-200 sticky top-0 z-10">رقم الحساب</th>
                                        <th className="p-1 text-xs font-semibold text-gray-700 bg-gray-200 sticky top-0 z-10">البنك</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedBeneficiaryAccounts.map(acc => (
                                        <tr key={acc.ID_COMPTE} className="border-b text-xs">
                                            <td className="p-1 text-gray-700">{acc.RIB}</td>
                                            <td className="p-1 text-gray-700">{acc.BANQUE}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-center text-gray-500 py-2 text-xs">{t('lbl.no_data')}</p>
                    )}
                </div>
            )}
             <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); setEditingBeneficiary(undefined); }} title={editingBeneficiary ? "تعديل مستفيد" : "إضافة مستفيد"}>
                <AddBeneficiaryForm key={formKey} onClose={() => { setIsModalOpen(false); setEditingBeneficiary(undefined); }} onSave={handleSaveBeneficiary} initialData={editingBeneficiary} />
            </Modal>
            <ConfirmActionModal
                isOpen={isDeleteConfirmOpen}
                title="تأكيد حذف المستفيد"
                message="هل أنت متأكد أنك تريد حذف هذا المستفيد؟ سيتم حذف جميع حساباته البنكية المرتبطة به."
                onCancel={() => setIsDeleteConfirmOpen(false)}
                onConfirm={confirmDeleteBeneficiary}
            />
        </PageWrapper>
    );
};

export default BeneficiairesPage;
