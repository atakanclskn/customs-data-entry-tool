import React from 'react';
import { DeclarationData, DocumentType, HistoryEntry } from '../types';
import { DownloadIcon, FileIcon } from './Icons';
import * as XLSX from 'xlsx';
import { DECLARATION_FIELDS, FREIGHT_FIELDS, FIELD_LABELS, EXCEL_EXPORT_ORDER } from '../constants';

interface ResultsDisplayProps {
  entry: HistoryEntry;
  actionButton?: React.ReactNode;
}

const isErrorValue = (value: string | undefined | null): boolean => {
    if (!value) return true;
    const lowerValue = value.toLowerCase().trim();
    return ['okunamadı', 'hata', 'n/a', ''].includes(lowerValue);
};

const DataField: React.FC<{ label: string, value: string | undefined }> = ({ label, value }) => (
    <div className="py-2">
        <p className="text-sm text-text-muted">{FIELD_LABELS[label] || label}</p>
        <p className={`font-semibold text-text-primary ${isErrorValue(value) ? 'italic text-text-muted' : ''}`}>
            {value || 'N/A'}
        </p>
    </div>
);

const DocumentPreview: React.FC<{ doc: HistoryEntry['declaration'] | HistoryEntry['freight'], title: string }> = ({ doc, title }) => {
    const canPreview = doc?.previewDataUrl && doc.previewDataUrl.startsWith('data:');
    const rotation = doc?.rotation || 0;
    return (
        <div className="w-full">
            <h5 className="text-center font-bold mb-2 text-text-secondary">{title}</h5>
            <div className="relative aspect-[3/4] rounded-lg border border-border bg-background overflow-hidden">
                {canPreview ? (
                    <img 
                        src={doc!.previewDataUrl!} 
                        alt={doc!.fileName} 
                        className="w-full h-full object-contain rounded-lg"
                        style={{ transform: `rotate(${rotation}deg)` }}
                    />
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-text-muted">
                        <FileIcon className="w-16 h-16" />
                        <p className="mt-2 text-sm font-semibold">{doc ? 'Önizleme Yok' : 'Belge Yok'}</p>
                    </div>
                )}
                {doc && (
                    <>
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent rounded-lg"></div>
                        <p className="absolute bottom-2 left-3 right-3 text-white font-semibold text-sm truncate">{doc.fileName}</p>
                    </>
                )}
            </div>
        </div>
    );
};

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ entry, actionButton }) => {
  const { data, declaration, freight } = entry;
  const fileName = declaration?.fileName || freight?.fileName || 'veri';
  
  const handleDownloadExcel = () => {
    if (!data) return;
    const orderedKeys = EXCEL_EXPORT_ORDER;
    
    const rowData: { [key: string]: any } = { 
        'Beyanname Dosya Adı': declaration?.fileName || '',
        'Navlun Dosya Adı': freight?.fileName || '',
    };
    orderedKeys.slice(2).forEach(key => {
        rowData[key] = data[key] || '';
    });

    const worksheetData = [rowData];
    const worksheet = XLSX.utils.json_to_sheet(worksheetData, { header: orderedKeys });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Veriler");
    
    const cols = orderedKeys.map(key => {
      const headerWidth = key.length;
      const valueWidth = String(rowData[key] || '').length;
      return { wch: Math.max(headerWidth, valueWidth, 10) + 2 };
    });
    worksheet["!cols"] = cols;

    const safeFileName = fileName.split('.')[0];
    XLSX.writeFile(workbook, `${safeFileName}_veri.xlsx`);
  };

  return (
    <div className="w-full flex flex-col lg:flex-row gap-6">
      {/* Left Column: Previews */}
      <div className="w-full lg:w-1/3 flex-shrink-0">
        <div className="grid grid-cols-2 gap-4">
          <DocumentPreview doc={declaration} title="Beyanname" />
          <DocumentPreview doc={freight} title="Navlun Faturası" />
        </div>
        <div className="flex flex-col gap-2 mt-4">
            {actionButton}
             <button
                onClick={handleDownloadExcel}
                className="btn btn-secondary w-full"
            >
                <DownloadIcon className="w-5 h-5" />
                Excel'e Aktar
            </button>
        </div>
      </div>

      {/* Right Column: Data */}
      <div className="w-full lg:w-2/3">
        {data && (
            <>
                <h4 className="text-lg font-semibold text-text-primary mb-3 border-b border-border pb-2">Beyanname Bilgileri</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                    {DECLARATION_FIELDS.map(key => <DataField key={key} label={key} value={data[key]} />)}
                </div>
                <h4 className="text-lg font-semibold text-text-primary my-3 border-b border-border pb-2 pt-4">Navlun Faturası Bilgileri</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                    {FREIGHT_FIELDS.map(key => <DataField key={key} label={key} value={data[key]} />)}
                </div>
            </>
        )}
      </div>
    </div>
  );
};

export default ResultsDisplay;