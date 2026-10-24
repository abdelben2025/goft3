// This utility now exports data to a formatted Excel file (.xls) by generating an HTML table.
// It includes styles and sets the worksheet to be Right-to-Left for proper Arabic rendering in Excel.

export const exportToFormattedExcel = (htmlContent: string, filename: string): void => {
    // BOM for UTF-8 Excel compatibility, especially for Arabic characters
    const bom = '\uFEFF';
    
    const template = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office"
              xmlns:x="urn:schemas-microsoft-com:office:excel"
              xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta charset="UTF-8">
            <!--[if gte mso 9]>
            <xml>
                <x:ExcelWorkbook>
                    <x:ExcelWorksheets>
                        <x:ExcelWorksheet>
                            <x:Name>Sheet1</x:Name>
                            <x:WorksheetOptions>
                                <x:DisplayGridlines/>
                                <x:RightToLeft/>
                            </x:WorksheetOptions>
                        </x:ExcelWorksheet>
                    </x:ExcelWorksheets>
                </x:ExcelWorkbook>
            </xml>
            <![endif]-->
        </head>
        <body>
            ${htmlContent}
        </body>
        </html>
    `;

    const blob = new Blob([bom, template], {
        type: 'application/vnd.ms-excel;charset=utf-8;'
    });

    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    // Ensure the filename has an .xls extension for Excel to open it directly.
    link.setAttribute('download', filename.endsWith('.xls') ? filename : `${filename}.xls`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};
