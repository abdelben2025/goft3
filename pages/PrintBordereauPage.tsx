
import React, { useMemo } from 'react';
import { Page } from '../types';
import { useData } from '../context/DataContext';
import ExcelJS from 'exceljs';

interface PrintBordereauPageProps {
    navigate: (page: Page, id?: number, tab?: string) => void;
    operationId: number; // This will now be the ID_BORDEREAU
}

const PrintBordereauPage: React.FC<PrintBordereauPageProps> = ({ navigate, operationId: passedId }) => {
    const { db, loading } = useData();

    const printData = useMemo(() => {
        if (loading || !passedId) return null;

        // Try to treat passedId as ID_BORDEREAU first
        const bordereau = db.T_BORDEREAU.find(b => b.ID_BORDEREAU === passedId);
        
        let operation;
        let engagements;

        if (bordereau) {
            // Find engagements linked to this bordereau
            engagements = db.T_ENGAGEMENT
                .filter(e => e.ID_BORDEREAU === passedId)
                .sort((a, b) => (parseInt(a.N_ENG, 10) || 0) - (parseInt(b.N_ENG, 10) || 0));
            
            // Deduce the operation from the first engagement
            if (engagements.length > 0) {
                const opId = engagements[0].ID_OPERATION;
                operation = db.T_OPERATION.find(op => op.ID_OPERATION === opId);
            }
        } else {
            // Fallback: maybe passedId is an ID_OPERATION (for direct printing)
            operation = db.T_OPERATION.find(op => op.ID_OPERATION === passedId);
            if (!operation) return null;
            
            // For direct operation printing, show all engagements not yet linked to a bordereau or just all of them
            engagements = db.T_ENGAGEMENT
                .filter(e => e.ID_OPERATION === passedId)
                .sort((a, b) => {
                    const yearA = parseInt(a.ANNEE, 10) || 0;
                    const yearB = parseInt(b.ANNEE, 10) || 0;
                    if (yearA !== yearB) return yearA - yearB;
                    return (parseInt(a.N_ENG, 10) || 0) - (parseInt(b.N_ENG, 10) || 0);
                });
        }

        if (!operation) return null;

        const direction = db.T_DIRECTION[0];
        const categorie = db.T_CATEGORIE.find(c => c.ID_CATEGORIE === operation.ID_CATEGORIE);

        return { bordereau, operation, engagements, direction, categorie };
    }, [db, loading, passedId]);

    const printStyles = `
        @import url('https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&display=swap');
        body { 
            font-family: 'Amiri', serif; 
            direction: rtl; 
        }
        .print-area {
            direction: rtl;
            font-family: 'Amiri', serif;
            color: black;
            padding: 40px;
            background: white;
        }
        .header-text { text-align: center; font-weight: bold; font-size: 20px; margin-bottom: 30px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px; }
        th, td { border: 1px solid black; padding: 8px; text-align: center; vertical-align: middle; }
        th { background-color: #f9fafb; font-weight: bold; }
        .text-right { text-align: right; }
        .font-bold { font-weight: bold; }
        .mb-4 { margin-bottom: 1rem; }
        .mt-8 { margin-top: 2rem; }
        .flex { display: flex; }
        .justify-between { justify-content: space-between; }
        .w-full { width: 100%; }
    `;

    const handlePrintJS = () => {
        window.print();
    };

    const handleExportXLS = async () => {
        if (!printData) return;
        const { bordereau, engagements } = printData;

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('جدول إرسال');
        worksheet.views = [{ rightToLeft: true }];

        const borderStyle: Partial<ExcelJS.Borders> = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };

        const centerAlign: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle', wrapText: true };
        const boldFont = { name: 'Amiri', bold: true, size: 11 };
        const normalFont = { name: 'Amiri', size: 10 };

        // 1. Republic Title
        const titleRow = worksheet.addRow(['الجمهورية الجزائرية الديمقراطية الشعبية']);
        worksheet.mergeCells(titleRow.number, 1, titleRow.number, 5);
        titleRow.getCell(1).font = { ...boldFont, size: 14 };
        titleRow.getCell(1).alignment = centerAlign;
        worksheet.addRow([]);

        // 2. Ministry Info
        const info = [
            'وزارة الأشغال العمومية',
            'و المنشآت القاعدية',
            'مديرية الأشغال العمومية',
            'لولاية غليزان',
            `رقم: ................... / م أ ع / ${bordereau?.ANNEE || new Date().getFullYear()}`
        ];
        info.forEach((text) => {
            const row = worksheet.addRow([text]);
            row.getCell(1).font = boldFont;
            row.getCell(1).alignment = { horizontal: 'right' };
        });

        // Date
        const dateRow = worksheet.addRow(['غليزان في: .........................']);
        worksheet.mergeCells(dateRow.number, 1, dateRow.number, 5);
        dateRow.getCell(1).font = boldFont;
        dateRow.getCell(1).alignment = { horizontal: 'left' };
        worksheet.addRow([]);

        // 3. To...
        const toRow = worksheet.addRow(['إلى السيد(ة): المراقب الميزانياتي لدى ولاية غليزان']);
        worksheet.mergeCells(toRow.number, 1, toRow.number, 5);
        toRow.getCell(1).font = { ...boldFont, size: 12 };
        toRow.getCell(1).alignment = centerAlign;
        worksheet.addRow([]);

        // 4. Main Title "Bordereau"
        const mainTitleRow = worksheet.addRow(['جدول إرسال']);
        worksheet.mergeCells(mainTitleRow.number, 1, mainTitleRow.number, 5);
        mainTitleRow.height = 40;
        mainTitleRow.getCell(1).font = { ...boldFont, size: 24 };
        mainTitleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
        mainTitleRow.getCell(1).alignment = centerAlign;
        mainTitleRow.getCell(1).border = { 
            top: { style: 'double', color: { argb: 'FF064E3B' } }, 
            bottom: { style: 'double', color: { argb: 'FF064E3B' } },
            left: { style: 'thin' },
            right: { style: 'thin' }
        };
        worksheet.addRow([]);

        const introRow = worksheet.addRow(['تجدون طي هذا الجدول بطاقات الالتزام و الوثائق المرفقة التالية:']);
        worksheet.mergeCells(introRow.number, 1, introRow.number, 5);
        introRow.getCell(1).font = boldFont;
        introRow.getCell(1).alignment = { horizontal: 'right' };
        worksheet.addRow([]);

        // 5. Table Header
        const headerRow = worksheet.addRow([
            'رقم بطاقة الالتزام',
            'الصنف',
            'موضوع الالتزام',
            'الوثائق الثبوتية المرفقة بكل بطاقة',
            'ملاحظة'
        ]);
        headerRow.eachCell(cell => {
            cell.font = boldFont;
            cell.border = borderStyle;
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
            cell.alignment = centerAlign;
        });

        // 6. Data Rows (grouped)
        sortedOpIds.forEach(opId => {
            const op = db.T_OPERATION.find(o => o.ID_OPERATION === opId);
            const opEngs = groupedEngagements[opId];
            
            const groupRow = worksheet.addRow([`رقم العملية: ${op?.N_OPERATION?.startsWith('N') ? op.N_OPERATION : `N ${op?.N_OPERATION || ''}`}`]);
            worksheet.mergeCells(groupRow.number, 1, groupRow.number, 5);
            groupRow.getCell(1).font = boldFont;
            groupRow.getCell(1).border = borderStyle;
            groupRow.getCell(1).alignment = centerAlign;

            opEngs.forEach(eng => {
                const piece = db.T_PIECE.find(p => p.ID_PIECE === eng.ID_PIECE);
                const scat = db.T_SCATEGORIE.find(s => s.ID_SCATEGORIE === piece?.ID_SCATEGORIE);
                const { docs, copies } = getDocDetails(eng);
                const subject = eng.BORD_OBJET || getSubject(piece);
                
                const row = worksheet.addRow([
                    `${eng.N_ENG}/${eng.ANNEE}`,
                    scat?.C_SCATEGORIE || '---',
                    subject,
                    docs.join('\n'),
                    copies.join('\n')
                ]);
                row.eachCell(cell => {
                    cell.font = normalFont;
                    cell.border = borderStyle;
                    cell.alignment = centerAlign;
                });
            });
        });

        // 7. Footer
        const totalRow = worksheet.addRow([
            'مجموع البطاقات',
            engagements.length.toString().padStart(2, '0'),
            '', '', ''
        ]);
        totalRow.getCell(1).font = boldFont;
        totalRow.getCell(1).border = borderStyle;
        totalRow.getCell(2).font = boldFont;
        totalRow.getCell(2).border = borderStyle;
        totalRow.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };

        worksheet.addRow([]);
        worksheet.addRow([]);
        const footerRow = worksheet.addRow(['الآمر بالصرف']);
        worksheet.mergeCells(footerRow.number, 1, footerRow.number, 5);
        footerRow.getCell(1).font = { ...boldFont, size: 12, underline: true };
        footerRow.getCell(1).alignment = { horizontal: 'right' };

        // Column widths
        worksheet.getColumn(1).width = 20;
        worksheet.getColumn(2).width = 10;
        worksheet.getColumn(3).width = 30;
        worksheet.getColumn(4).width = 55;
        worksheet.getColumn(5).width = 18;

        // Write and Save
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bordereau_${printData.bordereau?.N_BORDEREAU || printData.operation.N_OPERATION}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const getDocDetails = (eng: any) => {
        if (eng.BORD_DOCS || eng.BORD_COPIES) {
            return {
                docs: (eng.BORD_DOCS || '').split('\n'),
                copies: (eng.BORD_COPIES || '').split('\n')
            };
        }

        const piece = db.T_PIECE.find(p => p.ID_PIECE === eng.ID_PIECE);
        if (!piece) return { docs: [], copies: [] };

        const beneficiary = db.T_BENEFICIAIRE.find(b => b.ID_BENEFICIAIRE === piece.ID_BENEFICIAIRE);
        const docs: string[] = [];
        const copies: string[] = [];

        const nature = piece.NAT_PIECE || '';
        
        // Main piece line
        docs.push(`${piece.PIECE}`);
        
        if (nature.includes('مقرر')) {
            copies.push('01 نسخة');
        } else {
            copies.push('02 نسختين');
        }

        // Beneficiary line
        if (beneficiary && (nature.includes('صفقة') || nature.includes('اتفاقية') || nature.includes('فاتورة') || nature.includes('ملحق'))) {
            docs.push(`لفائدة: ${beneficiary.BENEFICIAIRE}`);
            docs.push(`المبلغ: ${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(eng.MONTANT_ENG)} دج`);
            copies.push(' '); // empty for this line
            copies.push(' '); // empty for this line
        }

        // Additional docs
        if (nature.includes('صفقة') || nature.includes('اتفاقية') || nature.includes('ملحق')) {
            docs.push('تقرير تقديمي');
            copies.push('01 نسخة');
        } else if (nature.includes('فاتورة') && (nature.includes('إشهار') || nature.includes('نشر'))) {
            docs.push('الجرائد و BOMOP');
            copies.push('01 نسخة');
        }

        return { docs, copies };
    };

    const getSubject = (piece: any) => {
        const nature = piece?.NAT_PIECE || '';
        if (nature.includes('مقرر')) return `التزام بـ ${nature}`;
        if (nature.includes('صفقة')) return 'التزام بصفقة';
        if (nature.includes('ملحق')) return 'التزام بملحق';
        if (nature.includes('فاتورة')) return 'التزام بفاتورة';
        if (nature.includes('اتفاقية')) return 'التزام باتفاقية';
        return 'التزام بـ ' + nature;
    };

    const groupedEngagements = useMemo(() => {
        if (!printData) return {};
        const groups: { [key: number]: any[] } = {};
        printData.engagements.forEach(eng => {
            if (!groups[eng.ID_OPERATION]) {
                groups[eng.ID_OPERATION] = [];
            }
            groups[eng.ID_OPERATION].push(eng);
        });
        return groups;
    }, [printData]);

    const sortedOpIds = useMemo(() => {
        return Object.keys(groupedEngagements).map(Number).sort((a, b) => a - b);
    }, [groupedEngagements]);

    if (loading) return <div className="p-8 text-center">جار تحميل البيانات...</div>;
    if (!printData) return <div className="p-8 text-center text-red-500">لم يتم العثور على البيانات.</div>;

    const { bordereau, operation, engagements } = printData;

    return (
        <div className="bg-white min-h-screen">
            <style>{printStyles}</style>
            <style>{`
                @media print {
                    body * { visibility: hidden; }
                    #print-content, #print-content * { visibility: visible; }
                    #print-content { position: absolute; top: 0; width: 100%; }
                    @page { margin: 0; size: A4; }
                    .no-print { display: none !important; }
                }
            `}</style>

            <div className="no-print mb-4 flex justify-between items-center bg-gray-100 p-3 rounded shadow">
                <h2 className="text-xl font-bold">معاينة طباعة جدول إرسال</h2>
                <div className="flex gap-2">
                    <button onClick={() => navigate('OPERATION_DETAILS', operation.ID_OPERATION, 'BORDEREAUX')} className="bg-gray-600 text-white px-4 py-2 rounded">رجوع</button>
                    <button onClick={handleExportXLS} className="bg-green-700 text-white px-4 py-2 rounded font-bold hover:bg-green-800 transition-colors">
                        <i className="bi bi-file-earmark-spreadsheet mr-2"></i> تصدير XLS
                    </button>
                    <button onClick={handlePrintJS} className="bg-blue-700 text-white px-6 py-2 rounded font-bold hover:bg-blue-800 transition-colors">
                        <i className="bi bi-printer mr-2"></i> طباعة 
                    </button>
                </div>
            </div>

            <div id="print-content" className="print-area bg-white mx-auto max-w-[210mm] text-black" dir="rtl">
                <div className="text-center font-bold text-xl mb-4">الجمهورية الجزائرية الديمقراطية الشعبية</div>
                
                <div className="flex justify-between mb-2">
                    <div className="text-right font-bold text-xs space-y-0.5" style={{ minWidth: '250px' }}>
                        <p>وزارة الأشغال العمومية</p>
                        <p>و المنشآت القاعدية</p>
                        <p>مديرية الأشغال العمومية</p>
                        <p>لولاية غليزان</p>
                        <p>رقم: ................... / م أ ع / {bordereau?.ANNEE || new Date().getFullYear()}</p>
                    </div>
                    <div className="text-left font-bold text-sm">
                        <p>غليزان في: .........................</p>
                    </div>
                </div>

                <div className="text-center mb-6">
                    <h1 className="text-xl font-bold mb-4">إلى السيد(ة): المراقب الميزانياتي لدى ولاية غليزان</h1>
                    <div className="bg-gray-200 border-2 border-green-800 p-2 inline-block min-w-[300px]">
                        <h2 className="text-3xl font-bold">جدول إرسال</h2>
                    </div>
                </div>

                <p className="mb-2 font-bold text-sm">تجدون طي هذا الجدول بطاقات الالتزام و الوثائق المرفقة التالية:</p>

                <table className="w-full border-collapse border border-black text-xs">
                    <thead>
                        <tr className="bg-white">
                            <th className="border border-black p-1 w-20">رقم بطاقة الالتزام</th>
                            <th className="border border-black p-1 w-12">الصنف</th>
                            <th className="border border-black p-1">موضوع الالتزام</th>
                            <th className="border border-black p-1 w-[45%]">الوثائق الثبوتية المرفقة بكل بطاقة</th>
                            <th className="border border-black p-1 w-20">ملاحظة</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedOpIds.map(opId => {
                            const op = db.T_OPERATION.find(o => o.ID_OPERATION === opId);
                            const opEngs = groupedEngagements[opId];
                            
                            return (
                                <React.Fragment key={opId}>
                                    <tr className="bg-white font-bold">
                                        <td colSpan={5} className="border border-black p-1 text-center">
                                            رقم العملية: {op?.N_OPERATION?.startsWith('N') ? op.N_OPERATION : `N ${op?.N_OPERATION || ''}`}
                                        </td>
                                    </tr>
                                    {opEngs.map((eng: any) => {
                                        const piece = db.T_PIECE.find(p => p.ID_PIECE === eng.ID_PIECE);
                                        const scat = db.T_SCATEGORIE.find(s => s.ID_SCATEGORIE === piece?.ID_SCATEGORIE);
                                        const { docs, copies } = getDocDetails(eng);
                                        const subject = eng.BORD_OBJET || getSubject(piece);
                                        
                                        return (
                                            <tr key={eng.ID_ENGAGEMENT}>
                                                <td className="border border-black text-center p-1">{eng.N_ENG}/{eng.ANNEE}</td>
                                                <td className="border border-black text-center p-1">{scat?.C_SCATEGORIE || '---'}</td>
                                                <td className="border border-black text-center p-1">{subject}</td>
                                                <td className="border border-black text-center p-1">
                                                    {docs.map((doc: string, idx: number) => (
                                                        <div key={idx} className="mb-0.5 last:mb-0">{doc}</div>
                                                    ))}
                                                </td>
                                                <td className="border border-black text-center p-1">
                                                    {copies.map((copy: string, idx: number) => (
                                                        <div key={idx} className="mb-0.5 last:mb-0 h-[1.2em]">{copy}</div>
                                                    ))}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                    <tfoot>
                        <tr className="font-bold">
                            <td colSpan={1} className="border-none">مجموع البطاقات</td>
                            <td className="border border-black bg-gray-50 text-center p-1">{engagements.length.toString().padStart(2, '0')}</td>
                        </tr>
                    </tfoot>
                </table>

                <div className="mt-4 flex justify-end">
                    <p className="font-bold underline text-lg ml-10">الآمر بالصرف</p>
                </div>
            </div>
        </div>
    );
};

export default PrintBordereauPage;
