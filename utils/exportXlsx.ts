import ExcelJS from 'exceljs';
import { saveBlobToFile } from './saveFile';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/**
 * Serialize an ExcelJS workbook to an .xlsx Blob and save it using the shared
 * save mechanism (native Tauri dialog in the desktop app, Blob anchor in browser).
 */
export const saveWorkbook = async (workbook: ExcelJS.Workbook, filename: string): Promise<void> => {
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: XLSX_MIME });
    await saveBlobToFile(blob, filename);
};
