import React, { useState, useMemo } from 'react';
import { HistoryEntry, NavigateFunction, Page, DocumentType } from '../types';
import { HistoryIcon, TrashIcon, ChevronRightIcon, ErrorIcon, DownloadIcon, SearchIcon, ArrowUpIcon, ArrowDownIcon, DocumentTextIcon, CheckCircleIcon, ExpandIcon, LinkIcon } from './Icons';
import ResultsDisplay from './ResultsDisplay';
import * as XLSX from 'xlsx';
import { EXCEL_EXPORT_ORDER } from '../constants';
import CustomSelect from './CustomSelect';

interface HistoryItemProps {
    entry: HistoryEntry;
    onDelete: (id: string) => void;
    navigate: NavigateFunction;
    isSelectionMode: boolean;
    isSelected: boolean;
    onSelect: (id: string) => void;
    onOpenInFullscreen: (context: 'analysis' | 'history', id: string) => void;
    onUpdateEntry: (entry: HistoryEntry) => Promise<void>;
}

const HistoryItem: React.FC<HistoryItemProps> = ({ entry, onDelete, navigate, isSelectionMode, isSelected, onSelect, onOpenInFullscreen, onUpdateEntry }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
    
    const handleNewAnalysis = () => {
        navigate(Page.ANALYSIS);
    };
    
    const handleItemClick = () => {
        if (isSelectionMode) {
            onSelect(entry.id);
        } else if (!isConfirmingDelete) {
            setIsExpanded(!isExpanded);
        }
    };

    const handleToggleVerified = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (entry.status === 'SUCCESS') {
            onUpdateEntry({ ...entry, verified: !entry.verified });
        }
    };

    const itemContainerClasses = `
       modern-card rounded-xl transition-all duration-300
        ${isSelectionMode 
            ? `cursor-pointer ${isSelected ? 'border-accent bg-[var(--color-accent)]/20' : 'hover:border-accent/30'}`
            : `${isExpanded ? 'bg-[var(--color-background)]' : ''}`
        }
    `;
    
    const title = entry.declaration?.fileName || entry.freight?.fileName || 'Boş Kayıt';
    const subtitle = entry.declaration && entry.freight 
        ? `${entry.declaration.fileName} / ${entry.freight.fileName}`
        : 'Tek belge';
    const isSingleDocument = !entry.declaration || !entry.freight;

    // Determine the correct context for the fullscreen view. Unverified pairs go to the 'analysis' (verification) view.
    const isUnverifiedPair = entry.pairingVerified === false && entry.declaration && entry.freight;
    const contextForFullscreen = isUnverifiedPair ? 'analysis' : 'history';

    return (
        <div className={itemContainerClasses}>
            <div 
                className={`flex items-center p-4 ${isSelectionMode || (!isConfirmingDelete && !isSelectionMode) ? 'cursor-pointer' : ''}`}
                onClick={handleItemClick}
            >
                {isSelectionMode && (
                    <div className="mr-4 flex items-center">
                         <input
                            type="checkbox"
                            checked={isSelected}
                            readOnly
                            className="h-5 w-5 rounded border-border bg-background text-accent focus:ring-0 focus:ring-offset-0 cursor-pointer"
                         />
                    </div>
                )}
                <div 
                    className={`flex-shrink-0 mr-4 ${entry.status === 'SUCCESS' ? 'cursor-pointer' : ''}`}
                    onClick={handleToggleVerified}
                    title={entry.status === 'SUCCESS' ? (entry.verified ? 'Onayı kaldır' : 'Onayla') : ''}
                >
                    {entry.status === 'SUCCESS' ? 
                        <CheckCircleIcon className={`w-6 h-6 transition-colors ${entry.verified ? 'text-[var(--color-success)]' : 'text-text-muted hover:text-[var(--color-success)]/50'}`} /> :
                        <ErrorIcon className="w-6 h-6 text-[var(--color-danger)]" />
                    }
                </div>
                <div className="flex-grow flex flex-col overflow-hidden pr-2">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold text-text-primary truncate" title={subtitle}>{title}</span>
                        {isSingleDocument && (
                            <span title="Bu belge eşleştirilmeyi bekliyor">
                                <LinkIcon className="w-4 h-4 text-text-muted flex-shrink-0" />
                            </span>
                        )}
                    </div>
                    <span className="text-xs text-text-muted">
                        {new Date(entry.analyzedAt).toLocaleString('tr-TR')}
                    </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    {!isSelectionMode ? (
                        isConfirmingDelete ? (
                             <div className="flex items-center gap-2 animate-fade-in">
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDelete(entry.id); }}
                                    className="px-4 py-1 text-sm font-semibold rounded-md bg-danger text-white hover:bg-red-700 transition-colors"
                                    aria-label="Silme işlemini onayla"
                                >
                                    Sil
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setIsConfirmingDelete(false); }}
                                    className="px-4 py-1 text-sm font-semibold rounded-md bg-border text-text-primary hover:bg-text-muted"
                                    aria-label="Silme işlemini iptal et"
                                >
                                    İptal
                                </button>
                            </div>
                        ) : (
                            <>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); onOpenInFullscreen(contextForFullscreen, entry.id); }}
                                    className="p-2 rounded-full text-text-muted hover:bg-accent/20 hover:text-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    aria-label={isSingleDocument ? "Eşlenmemiş belgeler düzenlenemez" : "Düzenleme modunda aç"}
                                    disabled={isSingleDocument}
                                    title={isSingleDocument ? "Eşlenmemiş belgeler manuel eşleştirme sayfasından düzenlenir" : "Düzenleme modunda aç"}
                                >
                                    <ExpandIcon className="w-5 h-5"/>
                                </button>
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setIsConfirmingDelete(true); }} 
                                    className="p-2 rounded-full text-text-muted hover:bg-red-500/20 hover:text-danger transition-colors" 
                                    aria-label="Kaydı Sil"
                                >
                                    <TrashIcon className="w-5 h-5" />
                                </button>
                                <ChevronRightIcon className={`w-5 h-5 text-text-muted transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} />
                            </>
                        )
                    ) : (
                        <ChevronRightIcon className={`w-5 h-5 text-text-muted`} />
                    )}
                </div>
            </div>
            {isExpanded && !isSelectionMode && !isConfirmingDelete && (
                <div className="border-t border-border p-4 animate-fade-in">
                    {entry.status === 'SUCCESS' && entry.data ? (
                        <ResultsDisplay 
                            entry={entry}
                            actionButton={
                                <button
                                    onClick={handleNewAnalysis}
                                    className="btn btn-primary w-full sm:w-auto"
                                >
                                    Yeni Belge Yükle
                                </button>
                            }
                        />
                    ) : (
                        <div className="p-4 bg-[var(--color-danger)]/10 text-[var(--color-danger)] rounded-lg flex items-start gap-3">
                            <ErrorIcon className="w-6 h-6 flex-shrink-0 mt-1" />
                            <div>
                                <h4 className="font-bold">Giriş Hatası</h4>
                                <p className="text-sm mt-1">{entry.error || 'Bu kayıtla ilgili bir sorun oluştu.'}</p>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

interface HistoryPageProps {
  history: HistoryEntry[];
  onDelete: (id: string) => void;
  onDeleteMultiple: (ids: string[]) => void;
  onClear: () => void;
  navigate: NavigateFunction;
  onOpenInFullscreen: (context: 'analysis' | 'history', selectedId: string) => void;
  onUpdateEntry: (entry: HistoryEntry) => Promise<void>;
}

type SortKey = 'analyzedAt' | 'fileName' | 'verified';
type SortDirection = 'asc' | 'desc';
interface SortConfig {
    key: SortKey;
    direction: SortDirection;
}

const HistoryPage: React.FC<HistoryPageProps> = ({ history, onDelete, onDeleteMultiple, onClear, navigate, onOpenInFullscreen, onUpdateEntry }) => {
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [confirmAction, setConfirmAction] = useState<null | 'delete-selected' | 'clear-all'>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'analyzedAt', direction: 'desc' });
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [showVerifiedOnly, setShowVerifiedOnly] = useState(false);

    const sortedAndFilteredHistory = useMemo(() => {
        const filtered = history.filter(entry => {
            const searchLower = searchTerm.toLowerCase();
            const searchMatch = !searchTerm ||
                (entry.declaration?.fileName || '').toLowerCase().includes(searchLower) ||
                (entry.freight?.fileName || '').toLowerCase().includes(searchLower);

            const startDate = dateRange.start ? new Date(dateRange.start) : null;
            const endDate = dateRange.end ? new Date(dateRange.end) : null;
            const itemDate = new Date(entry.analyzedAt);

            let dateMatch = true;
            if (startDate) dateMatch = itemDate >= startDate;
            if (endDate) dateMatch = dateMatch && itemDate <= endDate;
            
            const verifiedMatch = !showVerifiedOnly || entry.verified === true;

            return searchMatch && dateMatch && verifiedMatch;
        });

        return filtered.sort((a, b) => {
            let comparison = 0;
            switch (sortConfig.key) {
                case 'fileName':
                    const nameA = a.declaration?.fileName || a.freight?.fileName || '';
                    const nameB = b.declaration?.fileName || b.freight?.fileName || '';
                    comparison = nameA.localeCompare(nameB);
                    return sortConfig.direction === 'asc' ? comparison : -comparison;
                case 'verified':
                    comparison = (b.verified ? 1 : 0) - (a.verified ? 1 : 0); // true (verified) first
                    return sortConfig.direction === 'asc' ? -comparison : comparison;
                case 'analyzedAt':
                default:
                    comparison = new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime();
                    return sortConfig.direction === 'asc' ? -comparison : comparison;
            }
        });

    }, [history, searchTerm, sortConfig, dateRange, showVerifiedOnly]);

    const sortOptions = [
        { value: 'analyzedAt', label: 'Tarih' },
        { value: 'fileName', label: 'Dosya Adı' },
        { value: 'verified', label: 'Onay Durumu' },
    ];

    const handleSortKeyChange = (newKey: string) => {
        const key = newKey as SortKey;
        const newDirection = key === 'fileName' ? 'asc' : 'desc';
        setSortConfig({ key, direction: newDirection });
    };

    const toggleSortDirection = () => {
        setSortConfig(prev => ({
            ...prev,
            direction: prev.direction === 'asc' ? 'desc' : 'asc'
        }));
    };
    
    const handleExportToExcel = (entriesToExport: HistoryEntry[]) => {
        if (entriesToExport.length === 0) return;

        const orderedKeys = EXCEL_EXPORT_ORDER;
        
        const worksheetData = entriesToExport
            .filter(entry => entry.data)
            .map(entry => {
                 const rowData: { [key: string]: any } = { 
                     'Beyanname Dosya Adı': entry.declaration?.fileName || '',
                     'Navlun Dosya Adı': entry.freight?.fileName || '',
                 };
                 orderedKeys.slice(2).forEach(key => {
                    rowData[key] = entry.data?.[key] || '';
                 });
                 return rowData;
            });
        
        if (worksheetData.length === 0) {
            alert("Dışa aktarılacak veri bulunmuyor.");
            return;
        }
        
        const worksheet = XLSX.utils.json_to_sheet(worksheetData, { header: orderedKeys });
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Geçmiş Verileri");
        
        const cols = orderedKeys.map(key => {
            const headerWidth = key.length;
            const maxWidth = Math.max(...worksheetData.map(row => String(row[key] || '').length), headerWidth);
            return { wch: Math.max(maxWidth, 10) + 2 };
        });
        worksheet["!cols"] = cols;

        const fileName = `Toplu_Veri_Raporu_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(workbook, fileName);
    };

    const handleInitiateClearAll = () => {
        if (history.length > 0) {
            setConfirmAction('clear-all');
        }
    }
    
    const handleConfirmClearAll = () => {
        onClear();
        setConfirmAction(null);
    }

    const toggleSelectionMode = () => {
        setIsSelectionMode(prev => !prev);
        setSelectedIds([]);
    }

    const handleSelect = (id: string) => {
        setSelectedIds(prev => 
            prev.includes(id) 
            ? prev.filter(currentId => currentId !== id)
            : [...prev, id]
        );
    }

    const handleSelectAll = () => {
        if(selectedIds.length === sortedAndFilteredHistory.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(sortedAndFilteredHistory.map(h => h.id));
        }
    }

    const handleInitiateDeleteSelected = () => {
        if(selectedIds.length > 0) {
            setConfirmAction('delete-selected');
        }
    }
    
    const handleConfirmDeleteSelected = () => {
        if(selectedIds.length === 0) return;
        onDeleteMultiple(selectedIds);
        setIsSelectionMode(false);
        setSelectedIds([]);
        setConfirmAction(null);
    }

    const getConfirmModalContent = () => {
        if (!confirmAction) return null;
        if (confirmAction === 'clear-all') {
            return {
                title: 'Tüm Geçmişi Sil',
                message: 'Tüm veri giriş geçmişini kalıcı olarak silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.',
                onConfirm: handleConfirmClearAll
            };
        }
        if (confirmAction === 'delete-selected') {
            return {
                title: 'Seçilenleri Sil',
                message: `${selectedIds.length} adet kaydı kalıcı olarak silmek istediğinizden emin misiniz?`,
                onConfirm: handleConfirmDeleteSelected
            };
        }
        return null;
    }

    const modalContent = getConfirmModalContent();

  return (
    <div className="w-full relative pb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
            <h1 className="text-3xl font-bold text-text-primary mb-4 sm:mb-0">Veri Geçmişi</h1>
            {history.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                    {isSelectionMode ? (
                        <>
                            <button
                                onClick={() => handleExportToExcel(history.filter(entry => selectedIds.includes(entry.id)))}
                                disabled={selectedIds.length === 0}
                                className="btn btn-secondary"
                            >
                                <DownloadIcon className="w-5 h-5" />
                                Seçilenleri Excele Aktar ({selectedIds.length})
                            </button>
                            <button
                                onClick={handleInitiateDeleteSelected}
                                disabled={selectedIds.length === 0}
                                className="btn btn-danger"
                            >
                                <TrashIcon className="w-5 h-5" />
                                Seçilenleri Sil ({selectedIds.length})
                            </button>
                             <button
                                onClick={toggleSelectionMode}
                                className="btn btn-secondary"
                            >
                                İptal
                            </button>
                        </>
                    ) : (
                         <>
                             <button
                                onClick={() => handleExportToExcel(sortedAndFilteredHistory)}
                                disabled={sortedAndFilteredHistory.length === 0}
                                className="btn btn-secondary"
                            >
                                <DownloadIcon className="w-5 h-5" />
                                Filtrelenenleri Aktar
                            </button>
                             <button
                                onClick={toggleSelectionMode}
                                className="btn btn-secondary"
                            >
                                Seç
                            </button>
                             <button
                                onClick={handleInitiateClearAll}
                                className="btn btn-danger"
                            >
                                <TrashIcon className="w-5 h-5" />
                                Tümünü Temizle
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>

        {history.length > 0 && (
            <div className="modern-card rounded-xl p-4 mb-6 animate-fade-in relative z-40 overflow-visible">
                <div className="space-y-4">
                     <div className="relative w-full">
                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                            <SearchIcon className="w-5 h-5 text-text-muted" />
                        </span>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Dosya adına göre ara..."
                            className="w-full pl-10 pr-4 py-2 bg-[var(--color-background)] border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent transition-colors"
                            aria-label="Arama kutusu"
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                            <label className="text-sm font-medium text-text-secondary block mb-1">Tarih Aralığı</label>
                            <div className="flex flex-col sm:flex-row items-center gap-2">
                                <input type="datetime-local" value={dateRange.start} onChange={e => setDateRange(p => ({...p, start: e.target.value}))} className="w-full px-2 py-1.5 bg-[var(--color-background)] border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent transition-colors text-sm" aria-label="Başlangıç Tarihi"/>
                                <input type="datetime-local" value={dateRange.end} onChange={e => setDateRange(p => ({...p, end: e.target.value}))} className="w-full px-2 py-1.5 bg-[var(--color-background)] border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent transition-colors text-sm" aria-label="Bitiş Tarihi" />
                            </div>
                        </div>
                        <div>
                           <label className="text-sm font-medium text-text-secondary block mb-1">Sırala</label>
                            <div className="flex items-center gap-2">
                                <div className="w-full flex-grow history-page-select">
                                    <CustomSelect
                                        options={sortOptions}
                                        value={sortConfig.key}
                                        onChange={handleSortKeyChange}
                                        ariaLabel="Sıralama ölçütü"
                                    />
                                </div>
                                <button
                                    onClick={toggleSortDirection}
                                    className="p-2 bg-[var(--color-background)] border border-border rounded-lg text-text-primary hover:bg-[var(--color-background-light)] transition-colors"
                                    aria-label="Sıralama yönünü değiştir"
                                >
                                    {sortConfig.direction === 'asc' ? <ArrowUpIcon className="w-5 h-5" /> : <ArrowDownIcon className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>
                        <div className="flex flex-col justify-end h-full">
                             <label htmlFor="verified-filter" className="flex items-center cursor-pointer w-full py-2">
                                <input
                                    id="verified-filter"
                                    type="checkbox"
                                    checked={showVerifiedOnly}
                                    onChange={(e) => setShowVerifiedOnly(e.target.checked)}
                                    className="h-5 w-5 rounded border-border bg-background text-accent focus:ring-accent"
                                />
                                <span className="ml-2 text-sm font-medium text-text-primary">Sadece Onaylananlar</span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        )}
        
        {history.length === 0 ? (
            <div className="text-center py-16 px-6 modern-card rounded-2xl">
                <HistoryIcon className="w-16 h-16 mx-auto text-text-muted mb-4" />
                <h2 className="text-xl font-semibold text-text-secondary">Geçmiş bulunmuyor.</h2>
                <p className="text-text-muted mt-2">Henüz bir veri girişi yapmadınız. Başlamak için 'Veri Girişi' sayfasına gidin.</p>
                 <button
                    onClick={() => navigate(Page.ANALYSIS)}
                    className="mt-6 btn btn-primary"
                >
                    Veri Giriş Sayfasına Git
                </button>
            </div>
        ) : sortedAndFilteredHistory.length === 0 ? (
            <div className="text-center py-16 px-6 modern-card rounded-2xl">
                <SearchIcon className="w-16 h-16 mx-auto text-text-muted mb-4" />
                <h2 className="text-xl font-semibold text-text-secondary">Sonuç Bulunamadı</h2>
                <p className="text-text-muted mt-2">Arama kriterlerinize uygun geçmiş kaydı bulunamadı.</p>
            </div>
        ) : (
            <div className="space-y-4">
                 {isSelectionMode && (
                    <div className="modern-card rounded-xl p-3 flex items-center gap-3 cursor-pointer animate-fade-in" onClick={handleSelectAll}>
                         <input
                            type="checkbox"
                            checked={sortedAndFilteredHistory.length > 0 && selectedIds.length === sortedAndFilteredHistory.length}
                            readOnly
                            className="h-5 w-5 rounded border-border bg-background text-accent focus:ring-0 focus:ring-offset-0 cursor-pointer"
                         />
                        <label className="font-semibold text-text-primary cursor-pointer">Tümünü Seç/Bırak</label>
                    </div>
                )}
                {sortedAndFilteredHistory.map(entry => (
                    <HistoryItem 
                        key={entry.id} 
                        entry={entry} 
                        onDelete={onDelete} 
                        navigate={navigate} 
                        isSelectionMode={isSelectionMode}
                        isSelected={selectedIds.includes(entry.id)}
                        onSelect={handleSelect}
                        onOpenInFullscreen={onOpenInFullscreen}
                        onUpdateEntry={onUpdateEntry}
                    />
                ))}
            </div>
        )}
        
        {modalContent && (
             <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4">
                <div className="modern-card rounded-2xl p-8 max-w-md w-full text-center" onMouseDown={e => e.stopPropagation()}>
                    <ErrorIcon className="w-16 h-16 mx-auto text-danger mb-4" />
                    <h2 className="text-2xl font-bold text-text-primary mb-2">{modalContent.title}</h2>
                    <p className="text-text-secondary mb-8">{modalContent.message}</p>
                    <div className="flex justify-center gap-4">
                        <button onClick={() => setConfirmAction(null)} className="btn btn-secondary w-full">İptal</button>
                        <button onClick={modalContent.onConfirm} className="btn btn-danger w-full">Evet, Sil</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default HistoryPage;