import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { DeclarationData, HistoryEntry } from '../types';
import {
    XIcon, PanelLeftIcon, SearchIcon, ArrowUpIcon, ArrowDownIcon, ChevronLeftIcon,
    ChevronRightIcon, SaveIcon, UndoIcon, RedoIcon, ErrorIcon, CheckCircleIcon,
    ZoomInIcon, ZoomOutIcon, BadgeCheckIcon, DownloadIcon,
    RotateCcwIcon, RotateCwIcon, XCircleIcon, TrashIcon, GripVerticalIcon, FileIcon
} from './Icons';
import * as XLSX from 'xlsx';
import { FIELD_LABELS, FREIGHT_FIELDS, EXCEL_EXPORT_ORDER } from '../constants';
import CustomSelect from './CustomSelect';
import { PREDEFINED_NAKLIYECI_LIST } from '../services/nakliyeciData';
import { ALICI_VKN_MAP } from '../services/aliciData';

const dateFields = new Set([
  'Fat. Tarihi',
  'BEYANNAME TESCİL TARİHİ',
  'Tahmini Çıkış Tarihi',
  'Varış Tarihi',
  'KAYIT TARİHİ'
]);

// --- Custom Hook for Undo/Redo State ---
const useUndoableState = <T,>(initialState: T): [T, (action: React.SetStateAction<T>, overwrite?: boolean) => void, () => void, () => void, boolean, boolean] => {
    const [state, setStateInternal] = useState({
        history: [initialState],
        currentIndex: 0,
    });

    const stateRef = useRef(state);
    stateRef.current = state;

    const setState = useCallback((action: React.SetStateAction<T>, overwrite = false) => {
        const currentStateValue = stateRef.current.history[stateRef.current.currentIndex];
        const newState = typeof action === 'function'
            ? (action as (prevState: T) => T)(currentStateValue)
            : action;

        if (!overwrite && JSON.stringify(newState) === JSON.stringify(currentStateValue)) {
            return;
        }

        setStateInternal(prevState => {
            const newHistory = prevState.history.slice(0, prevState.currentIndex + 1);
            if (overwrite) {
                return {
                    history: [newState],
                    currentIndex: 0
                };
            } else {
                newHistory.push(newState);
                return {
                    history: newHistory,
                    currentIndex: newHistory.length - 1,
                };
            }
        });
    }, []);

    const undo = useCallback(() => {
        setStateInternal(prevState => {
            if (prevState.currentIndex > 0) {
                return { ...prevState, currentIndex: prevState.currentIndex - 1 };
            }
            return prevState;
        });
    }, []);

    const redo = useCallback(() => {
         setStateInternal(prevState => {
            if (prevState.currentIndex < prevState.history.length - 1) {
                return { ...prevState, currentIndex: prevState.currentIndex + 1 };
            }
            return prevState;
        });
    }, []);
    
    const currentState = state.history[state.currentIndex];
    const canUndo = state.currentIndex > 0;
    const canRedo = state.currentIndex < state.history.length - 1;

    return [currentState, setState, undo, redo, canUndo, canRedo];
};


// --- Editable Field Sub-component ---
interface EditableFieldProps {
    label: string;
    value: string;
    onChange: (newValue: string) => void;
    onActivate: (label: string) => void;
    isActive: boolean;
    setRef: (element: HTMLDivElement | null) => void;
    isEven: boolean;
    readOnly?: boolean;
    datalistId?: string;
    datalistOptions?: string[];
}
const EditableField: React.FC<EditableFieldProps> = ({ label, value, onChange, onActivate, isActive, setRef, isEven, readOnly = false, datalistId, datalistOptions = [] }) => {
    const [isEditing, setIsEditing] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const displayLabel = FIELD_LABELS[label] || label;
    const isDateField = dateFields.has(label);

    useEffect(() => {
        if (isActive && !readOnly) {
            setIsEditing(true);
        }
    }, [isActive, readOnly]);

    useEffect(() => {
        if (isEditing) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [isEditing]);
    
    const handleActivate = () => {
        if (readOnly) return;
        setIsEditing(true);
        onActivate(label);
    };

    const handleBlur = () => {
        setIsEditing(false);
    };
    
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === 'Escape') {
            setIsEditing(false);
            inputRef.current?.blur();
        }
    }
    
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let newValue = e.target.value;
        if (label === 'ALICI VKN') {
            newValue = newValue.replace(/\D/g, '');
        } else if (isDateField) {
            const digits = newValue.replace(/\D/g, '').slice(0, 8);
            if (digits.length > 4) {
                newValue = `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
            } else if (digits.length > 2) {
                newValue = `${digits.slice(0, 2)}.${digits.slice(2)}`;
            } else {
                newValue = digits;
            }
        }
        onChange(newValue);
    };
    
    if (readOnly) {
        return (
            <div ref={setRef} className={`flex items-baseline gap-x-2 border-l-2 py-1 px-2 rounded-md border-transparent ${isEven ? 'bg-[var(--color-background)]' : 'bg-transparent'}`}>
                <p className="text-2xs text-text-muted font-medium whitespace-nowrap w-1/4 truncate" title={displayLabel}>{displayLabel}</p>
                <div className="flex-grow w-3/4">
                    <p className="text-2xs font-medium text-text-primary break-words p-0">{value || <span className="italic text-text-muted">N/A</span>}</p>
                </div>
            </div>
        );
    }

    return (
        <div ref={setRef} className={`flex items-baseline gap-x-2 border-l-2 py-1 px-2 transition-colors rounded-md ${isActive ? 'bg-accent/10 border-accent' : 'border-transparent'} ${isEven ? 'bg-[var(--color-background)]' : 'bg-transparent'}`} onDoubleClick={handleActivate}>
            <p className="text-2xs text-text-muted font-medium whitespace-nowrap w-1/4 truncate" title={displayLabel}>{displayLabel}</p>
            <div className="flex-grow w-3/4">
                {isEditing ? (
                    <>
                    <input
                        ref={inputRef}
                        type={isDateField || label === 'ALICI VKN' ? 'tel' : 'text'}
                        inputMode={isDateField || label === 'ALICI VKN' ? 'numeric' : 'text'}
                        value={value}
                        onChange={handleInputChange}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        className="w-full bg-transparent border-b border-accent text-2xs font-medium p-0 focus:outline-none"
                        list={datalistId}
                    />
                    {datalistId && datalistOptions.length > 0 && (
                        <datalist id={datalistId}>
                            {datalistOptions.map(opt => <option key={opt} value={opt} />)}
                        </datalist>
                    )}
                    </>
                ) : (
                    <p className="text-2xs font-medium text-text-primary break-words cursor-pointer hover:bg-accent/10 p-0 rounded-sm" onClick={handleActivate}>
                        {value || <span className="italic text-[var(--color-danger)] font-semibold">Boş</span>}
                    </p>
                )}
            </div>
        </div>
    );
};


// --- Main Fullscreen View Component ---
interface FullscreenAnalysisViewProps {
    items: HistoryEntry[];
    history: HistoryEntry[];
    selectedId: string;
    onClose: () => void;
    onUpdateEntry: (entry: HistoryEntry) => Promise<void>;
    onNavigateItem: (id: string) => void;
    context: 'analysis' | 'history';
    onRejectPairing: (entryId: string) => Promise<void>;
    onDeleteFromPair: (entryId: string, docTypeToDelete: 'declaration' | 'freight') => Promise<void>;
}

type SortKey = 'analyzedAt' | 'fileName' | 'verified';

const extractedFieldsOrder = [
  'ALICI VKN',
  'Alıcı',
  'BEYANNAME TESCİL TARİHİ',
  'Teslim şekli',
  'KONTEYNER NO',
  'SON AMBAR',
  'Brüt KG',
  'ÖZET BEYAN NO',
  'TAREKS-TARIM-TSE',
];

const FullscreenAnalysisView: React.FC<FullscreenAnalysisViewProps> = ({ items, history, selectedId, onClose, onUpdateEntry, onNavigateItem, context, onRejectPairing, onDeleteFromPair }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortConfig, setSortConfig] = useState<{key: SortKey, direction: 'asc' | 'desc'}>({ key: 'fileName', direction: 'asc' });
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [isVerifyingPairing, setIsVerifyingPairing] = useState(false);
    const [verificationState, setVerificationState] = useState<'idle' | 'confirmed' | 'removed'>('idle');
    const [saveState, setSaveState] = useState<'idle' | 'saved'>('idle');
    const [showVerifiedOnly, setShowVerifiedOnly] = useState(false);
    const [docTypeToDelete, setDocTypeToDelete] = useState<'declaration' | 'freight' | null>(null);
    
    const dataPanelRef = useRef<HTMLDivElement>(null);
    const [sidebarWidth, setSidebarWidth] = useState(320);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        const startX = e.clientX;
        const startWidth = dataPanelRef.current?.offsetWidth || sidebarWidth;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const dx = moveEvent.clientX - startX;
            const newWidth = startWidth + dx;
            const minWidth = 288;
            const containerWidth = dataPanelRef.current?.parentElement?.offsetWidth || window.innerWidth;
            const maxWidth = Math.min(800, containerWidth - 400);
            const constrainedWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
            setSidebarWidth(constrainedWidth);
        };

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [sidebarWidth]);

    const currentItem = useMemo(() => items.find(i => i.id === selectedId), [items, selectedId]);
    
    const [editedData, setEditedData, undo, redo, canUndo, canRedo] = useUndoableState<DeclarationData>(currentItem?.data || {});
    const [localVerified, setLocalVerified] = useState<boolean | undefined>(undefined);

    const [isDirty, setIsDirty] = useState(false);
    const [navigationIntent, setNavigationIntent] = useState<{ type: 'item' | 'close', id?: string } | null>(null);

    const declarationViewerRef = useRef<HTMLDivElement>(null);
    const freightViewerRef = useRef<HTMLDivElement>(null);
    const [declarationTransform, setDeclarationTransform] = useState({ scale: 1, x: 0, y: 0 });
    const [freightTransform, setFreightTransform] = useState({ scale: 1, x: 0, y: 0 });
    const [panningState, setPanningState] = useState<{ viewer: 'declaration' | 'freight', startX: number, startY: number } | null>(null);
    
    const [activeFieldLabel, setActiveFieldLabel] = useState<string | null>(null);

    const fieldRefs = useRef<Record<string, HTMLElement | null>>({});
    const allFieldKeys = useMemo(() => {
        const declarationFields = extractedFieldsOrder.filter(f => f !== 'TAREKS-TARIM-TSE');
        return [...declarationFields, 'TAREKS-TARIM-TSE', ...FREIGHT_FIELDS];
    }, []);
    
    useEffect(() => {
        setVerificationState('idle');
        setSaveState('idle');
    }, [selectedId]);

    useEffect(() => {
        if (verificationState !== 'idle') {
            const timer = setTimeout(() => setVerificationState('idle'), 700);
            return () => clearTimeout(timer);
        }
    }, [verificationState]);

    useEffect(() => {
        if (saveState === 'saved') {
            const timer = setTimeout(() => setSaveState('idle'), 700);
            return () => clearTimeout(timer);
        }
    }, [saveState]);

    useEffect(() => {
        if (activeFieldLabel) {
            const element = fieldRefs.current[activeFieldLabel];
            element?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [activeFieldLabel]);

    const handleExportToExcel = (entriesToExport: HistoryEntry[]) => {
        if (entriesToExport.length === 0) return;

        const orderedKeys = EXCEL_EXPORT_ORDER;
        
        const worksheetData = entriesToExport
            .filter(entry => entry.status === 'SUCCESS' && entry.data)
            .map(entry => {
                const dataToUse = entry.id === currentItem?.id ? editedData : entry.data;
                 const mappedData: { [key: string]: any } = {
                    'Beyanname Dosya Adı': entry.declaration?.fileName || '',
                    'Navlun Dosya Adı': entry.freight?.fileName || '',
                 };
                  orderedKeys.slice(2).forEach(key => {
                    mappedData[key] = dataToUse[key] || '';
                 });
                 return mappedData;
            });
        
        if (worksheetData.length === 0) {
            alert("Dışa aktarılacak başarılı analiz bulunmuyor.");
            return;
        }

        const worksheet = XLSX.utils.json_to_sheet(worksheetData, { header: orderedKeys });
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Filtrelenmiş Veriler");
        
        const cols = orderedKeys.map(key => {
            const headerWidth = key.length;
            const maxWidth = Math.max(...worksheetData.map(row => String(row[key] || '').length), headerWidth);
            return { wch: Math.max(maxWidth, 10) + 2 };
        });
        worksheet["!cols"] = cols;
        XLSX.writeFile(workbook, `Filtrelenmis_Rapor_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    useEffect(() => {
        if (!currentItem) {
            if (items.length > 0) {
                onNavigateItem(items[0].id);
            } else {
                onClose();
            }
        } else {
             setIsVerifyingPairing(currentItem.pairingVerified === false && !!currentItem.declaration && !!currentItem.freight);
             setEditedData(currentItem.data || {}, true);
             setLocalVerified(currentItem.verified);
             setActiveFieldLabel(null);
             setDeclarationTransform({ scale: 1, x: 0, y: 0 });
             setFreightTransform({ scale: 1, x: 0, y: 0 });
        }
    }, [currentItem, items, onNavigateItem, onClose, setEditedData]);

    useEffect(() => {
        if (!currentItem) return;
        const dataDirty = JSON.stringify(currentItem.data || {}) !== JSON.stringify(editedData);
        const verifiedDirty = currentItem.verified !== localVerified;
        
        setIsDirty(dataDirty || verifiedDirty);
    }, [editedData, localVerified, currentItem]);

    const filteredAndSortedItems = useMemo(() => {
        return items
            .filter(item => {
                const searchMatch = searchTerm 
                    ? (item.declaration?.fileName || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                      (item.freight?.fileName || '').toLowerCase().includes(searchTerm.toLowerCase())
                    : true;
                const startDate = dateRange.start ? new Date(dateRange.start) : null;
                const endDate = dateRange.end ? new Date(dateRange.end) : null;
                const itemDate = new Date(item.analyzedAt);

                let dateMatch = true;
                if (startDate) dateMatch = itemDate >= startDate;
                if (endDate) dateMatch = dateMatch && itemDate <= endDate;
                
                const verifiedMatch = !showVerifiedOnly || item.verified === true;

                return searchMatch && dateMatch && verifiedMatch;
            })
            .sort((a, b) => {
                let comparison = 0;
                switch (sortConfig.key) {
                    case 'fileName': {
                        const nameA = a.declaration?.fileName || a.freight?.fileName || '';
                        const nameB = b.declaration?.fileName || b.freight?.fileName || '';
                        comparison = nameA.localeCompare(nameB, 'tr', { numeric: true });
                        break;
                    }
                    case 'verified': {
                        comparison = (a.verified ? 1 : 0) - (b.verified ? 1 : 0);
                        break;
                    }
                    case 'analyzedAt': {
                        comparison = new Date(a.analyzedAt).getTime() - new Date(b.analyzedAt).getTime();
                        break;
                    }
                }
                return sortConfig.direction === 'desc' ? -comparison : comparison;
            });
    }, [items, searchTerm, sortConfig, dateRange, showVerifiedOnly]);
    
    const currentItemIndex = useMemo(() => filteredAndSortedItems.findIndex(i => i.id === currentItem?.id), [filteredAndSortedItems, currentItem]);

    const handleNavigation = useCallback((intent: { type: 'item' | 'close', id?: string }) => {
        if (isDirty) {
            setNavigationIntent(intent);
        } else if (intent.type === 'item' && intent.id) {
            onNavigateItem(intent.id);
        } else if (intent.type === 'close') {
            onClose();
        }
    }, [isDirty, onNavigateItem, onClose]);

    const handleSave = async () => {
        if (!currentItem || !isDirty) return;
        const updatedEntry = { 
            ...currentItem, 
            data: editedData,
            verified: localVerified,
        };
        await onUpdateEntry(updatedEntry);
        setSaveState('saved');
    };

    const confirmNavigation = async (save: boolean) => {
        if (save) await handleSave();
        if (navigationIntent?.type === 'item' && navigationIntent.id) onNavigateItem(navigationIntent.id);
        else if (navigationIntent?.type === 'close') onClose();
        setNavigationIntent(null);
    }
    
    const handleNavigateByIndex = useCallback((offset: number) => {
      const newIndex = currentItemIndex + offset;
      if (newIndex >= 0 && newIndex < filteredAndSortedItems.length) {
          handleNavigation({ type: 'item', id: filteredAndSortedItems[newIndex].id });
      }
    }, [currentItemIndex, filteredAndSortedItems, handleNavigation]);
    
    const handleFieldNavigation = useCallback((direction: 'next' | 'prev') => {
        if (isVerifyingPairing) return;
        if (!activeFieldLabel) {
            const newActiveLabel = direction === 'next' ? allFieldKeys[0] : allFieldKeys[allFieldKeys.length - 1];
            setActiveFieldLabel(newActiveLabel);
            return;
        }

        const currentIndex = allFieldKeys.indexOf(activeFieldLabel);
        if (currentIndex === -1) {
            setActiveFieldLabel(allFieldKeys[0]);
            return;
        }

        const offset = direction === 'next' ? 1 : -1;
        const nextIndex = (currentIndex + offset + allFieldKeys.length) % allFieldKeys.length;
        
        const nextKey = allFieldKeys[nextIndex];
        setActiveFieldLabel(nextKey);
    }, [activeFieldLabel, allFieldKeys, isVerifyingPairing]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (navigationIntent || docTypeToDelete) return;

            const isInputFocused = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement;

            if (!isInputFocused) {
                if (e.key === 'ArrowLeft') { e.preventDefault(); handleNavigateByIndex(-1); return; }
                if (e.key === 'ArrowRight') { e.preventDefault(); handleNavigateByIndex(1); return; }
            }

            if (isVerifyingPairing) {
                if (e.key === 'Escape' && !isInputFocused) { e.preventDefault(); handleNavigation({ type: 'close' }); }
                return;
            }

            if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave(); return; }
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); return; }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); redo(); return; }
            if (e.key === 'Escape' && !isInputFocused) { e.preventDefault(); handleNavigation({ type: 'close' }); return; }
            if (e.key === 'ArrowDown' || (e.key === 'Tab' && !e.shiftKey)) { e.preventDefault(); handleFieldNavigation('next'); return; }
            if (e.key === 'ArrowUp' || (e.key === 'Tab' && e.shiftKey)) { e.preventDefault(); handleFieldNavigation('prev'); return; }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleNavigateByIndex, navigationIntent, isVerifyingPairing, handleSave, undo, redo, handleNavigation, handleFieldNavigation, docTypeToDelete]);

    const handleConfirmPairing = async () => {
        if (!currentItem) return;
        const updatedEntry = { ...currentItem, pairingVerified: true };
        await onUpdateEntry(updatedEntry);
        setIsVerifyingPairing(false); // Transition to data entry mode
    };

    const handleVerificationToggle = () => {
        if (!currentItem) return;
        const isCurrentlyVerified = localVerified;
        setVerificationState(isCurrentlyVerified ? 'removed' : 'confirmed');
        setLocalVerified(!isCurrentlyVerified);
    };

    const handleRotate = async (viewer: 'declaration' | 'freight', direction: 'left' | 'right') => {
        if (!currentItem) return;
        const docToUpdate = viewer === 'declaration' ? currentItem.declaration : currentItem.freight;
        if (!docToUpdate) return;
        const angle = direction === 'left' ? -90 : 90;
        const currentRotation = docToUpdate.rotation || 0;
        const newRotation = (currentRotation + angle + 360) % 360;
        const updatedDoc = { ...docToUpdate, rotation: newRotation };
        const updatedEntry = {
            ...currentItem,
            declaration: viewer === 'declaration' ? updatedDoc : currentItem.declaration,
            freight: viewer === 'freight' ? updatedDoc : currentItem.freight,
        };
        await onUpdateEntry(updatedEntry);
    };

    const handleConfirmDelete = () => {
        if (docTypeToDelete && currentItem) {
            onDeleteFromPair(currentItem.id, docTypeToDelete);
            setDocTypeToDelete(null);
        }
    };
    
    const handleDeleteClick = (docType: 'declaration' | 'freight') => {
        if (!currentItem || !currentItem.declaration || !currentItem.freight) return;
        setDocTypeToDelete(docType);
    };

    const sonAmbarDatalistOptions = useMemo(() => {
        const predefined = ["HÜRSAN", "MARDAŞ", "KUMPORT", "MARPORT"];
        const fromHistory = history
            .map(item => item.data?.['SON AMBAR'])
            .filter((value): value is string => !!value && value.trim() !== '');
        
        return [...new Set([...predefined, ...fromHistory])].sort((a, b) => a.localeCompare(b, 'tr'));
    }, [history]);

    useEffect(() => {
        const vkn = editedData['ALICI VKN'];
        if (vkn && (vkn.length === 10 || vkn.length === 11)) {
            const staticMatch = ALICI_VKN_MAP[vkn];
            if (staticMatch) {
                setEditedData(prev => ({ ...prev, 'Alıcı': staticMatch }));
                return;
            }
            const latestMatch = [...history].reverse().find(item => 
                item.data?.['ALICI VKN'] === vkn && item.data?.['Alıcı']
            );
            if (latestMatch?.data?.['Alıcı']) {
                setEditedData(prev => ({ ...prev, 'Alıcı': latestMatch.data!['Alıcı']! }));
            }
        }
    }, [editedData['ALICI VKN'], history, setEditedData]);
    
    const nakliyeciOptions = useMemo(() => {
        const names = new Set<string>(PREDEFINED_NAKLIYECI_LIST);
        history.forEach(item => { if (item.data?.['Nakliyeci']) names.add(item.data['Nakliyeci']); });
        return Array.from(names).sort((a, b) => a.localeCompare(b, 'tr'));
    }, [history]);
    
    useEffect(() => {
        const parseDate = (dateStr?: string): Date | null => {
            if (!dateStr) return null;
            const parts = dateStr.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
            if (!parts) return null;
            return new Date(parseInt(parts[3]), parseInt(parts[2]) - 1, parseInt(parts[1]));
        };
        const cikis = parseDate(editedData['Tahmini Çıkış Tarihi']);
        const varis = parseDate(editedData['Varış Tarihi']);
        let transitTime = '';
        if (cikis && varis && varis >= cikis) {
            const diffTime = varis.getTime() - cikis.getTime();
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
            transitTime = `${diffDays} gün`;
        }
        setEditedData(prev => prev['TT'] !== transitTime ? { ...prev, 'TT': transitTime } : prev);
    }, [editedData['Tahmini Çıkış Tarihi'], editedData['Varış Tarihi'], setEditedData]);
    
    useEffect(() => {
        const navlunFaturaTutariStr = editedData['Navlun Fatura Tutarı'] || '0';
        const hacimStr = editedData['Hacim'] || '0';
        const navlunFaturaTutari = parseFloat(navlunFaturaTutariStr.replace(/\./g, '').replace(',', '.'));
        const hacim = parseFloat(hacimStr.replace(/\./g, '').replace(',', '.'));
        let wmLiman = '';
        if (!isNaN(navlunFaturaTutari) && !isNaN(hacim) && hacim > 0) {
            wmLiman = (navlunFaturaTutari / hacim).toFixed(2).replace('.', ',');
        }
        setEditedData(prev => prev['w/m navlun'] !== wmLiman ? { ...prev, 'w/m navlun': wmLiman } : prev);
    }, [editedData['Navlun Fatura Tutarı'], editedData['Hacim'], setEditedData]);

    const handlePanStart = (e: React.MouseEvent, viewer: 'declaration' | 'freight') => { e.preventDefault(); const transform = viewer === 'declaration' ? declarationTransform : freightTransform; setPanningState({ viewer, startX: e.clientX - transform.x, startY: e.clientY - transform.y }); };
    const handlePanMove = (e: React.MouseEvent) => { if (!panningState) return; e.preventDefault(); const newX = e.clientX - panningState.startX; const newY = e.clientY - panningState.startY; if (panningState.viewer === 'declaration') setDeclarationTransform(prev => ({ ...prev, x: newX, y: newY })); else setFreightTransform(prev => ({ ...prev, x: newX, y: newY })); };
    const handlePanEnd = () => setPanningState(null);
    
    const handleZoom = (viewer: 'declaration' | 'freight', direction: 'in' | 'out' | 'reset') => {
        const setTransform = viewer === 'declaration' ? setDeclarationTransform : setFreightTransform;
        const viewerRef = viewer === 'declaration' ? declarationViewerRef : freightViewerRef;
        if (direction === 'reset') { setTransform({ scale: 1, x: 0, y: 0 }); return; }
        const rect = viewerRef.current?.getBoundingClientRect();
        const centerX = rect ? rect.width / 2 : 0;
        const centerY = rect ? rect.height / 2 : 0;
        setTransform(prev => {
            const scaleAmount = direction === 'in' ? 0.2 : -0.2;
            const newScale = Math.max(0.1, prev.scale + scaleAmount);
            const ratio = newScale / prev.scale;
            const newX = centerX - ratio * (centerX - prev.x);
            const newY = centerY - ratio * (centerY - prev.y);
            return { scale: newScale, x: newX, y: newY };
        });
    };

    const handleWheelZoom = (e: React.WheelEvent<HTMLDivElement>, viewer: 'declaration' | 'freight') => {
        e.preventDefault();
        const setTransform = viewer === 'declaration' ? setDeclarationTransform : setFreightTransform;
        const rect = e.currentTarget.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        setTransform(prev => {
            const scaleAmount = -e.deltaY * 0.001;
            const newScale = Math.max(0.1, prev.scale + scaleAmount);
            const ratio = newScale / prev.scale;
            const newX = mouseX - ratio * (mouseX - prev.x);
            const newY = mouseY - ratio * (mouseY - prev.y);
            return { scale: newScale, x: newX, y: newY };
        });
    };
    
    if (!currentItem) {
        return ( <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center text-white"> <p>Yükleniyor...</p> </div> );
    }

    const tareksIndex = extractedFieldsOrder.filter(k => k !== 'TAREKS-TARIM-TSE').length;

    const sortOptions = [{ value: 'analyzedAt', label: 'Tarih' }, { value: 'fileName', label: 'Dosya Adı' }, { value: 'verified', label: 'Onay Durumu' }];
    const handleSortKeyChange = (newKey: string) => setSortConfig({ key: newKey as SortKey, direction: newKey === 'analyzedAt' ? 'desc' : 'asc' });
    const renderVerificationButtonContent = () => {
        let text, key, animationClass = 'animate-fade-in';
        switch (verificationState) {
            case 'confirmed': text = 'Onaylandı!'; key = 'confirmed'; animationClass = 'animate-pop-in-out'; break;
            case 'removed': text = 'Onay Kaldırıldı!'; key = 'removed'; animationClass = 'animate-pop-in-out'; break;
            default: text = localVerified ? 'Onayı Kaldır' : 'Onayla'; key = localVerified ? 'verified' : 'unverified'; break;
        }
        return <span key={key} className={`${animationClass} whitespace-nowrap`}>{text}</span>;
    };
    const renderSaveButtonContent = () => saveState === 'saved' ? <span key="saved" className="animate-pop-in-out whitespace-nowrap">Kaydedildi!</span> : <span key="save" className="whitespace-nowrap">Kaydet</span>;

    const declarationRotation = currentItem.declaration?.rotation || 0;
    const freightRotation = currentItem.freight?.rotation || 0;
    const docToRemove = docTypeToDelete && currentItem ? (docTypeToDelete === 'declaration' ? currentItem.declaration : currentItem.freight) : null;

    return (
        <div className="fixed inset-0 bg-[var(--color-background)] text-text-primary z-50 flex animate-fade-in">
            {/* --- Sidebar --- */}
            <aside className={`flex-shrink-0 bg-[var(--color-background-light)] border-r border-[var(--color-border)] flex flex-col transition-all duration-300 overflow-hidden ${isSidebarOpen ? 'w-80' : 'w-0'}`}>
                <div className={`relative z-30 flex-shrink-0 border-b border-[var(--color-border)] overflow-visible ${isSidebarOpen ? 'p-4' : 'p-0'}`}>
                    <h2 className="text-lg font-bold truncate">Belge Listesi ({filteredAndSortedItems.length})</h2>
                    <div className="relative mt-4">
                        <SearchIcon className="w-5 h-5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                        <input type="text" placeholder="Belgelerde ara..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-[var(--color-background)] border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent transition-colors"/>
                    </div>
                    <div className="flex gap-2 mt-2">
                        <input type="datetime-local" value={dateRange.start} onChange={e => setDateRange(p => ({...p, start: e.target.value}))} className="w-1/2 px-2 py-1.5 bg-[var(--color-background)] border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent transition-colors text-sm" />
                        <input type="datetime-local" value={dateRange.end} onChange={e => setDateRange(p => ({...p, end: e.target.value}))} className="w-1/2 px-2 py-1.5 bg-[var(--color-background)] border border-border rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent transition-colors text-sm" />
                    </div>
                     <div className="flex items-center gap-2 mt-2">
                        <label className="text-sm font-medium text-text-secondary flex-shrink-0">Sırala:</label>
                        <div className="w-full flex-grow fullscreen-page-select"><CustomSelect options={sortOptions} value={sortConfig.key} onChange={handleSortKeyChange} ariaLabel="Sıralama ölçütü" /></div>
                        <button onClick={() => setSortConfig(p => ({...p, direction: p.direction === 'asc' ? 'desc' : 'asc'}))} className="p-2 bg-[var(--color-background)] border border-border rounded-lg text-text-primary hover:bg-border transition-colors">
                            {sortConfig.direction === 'asc' ? <ArrowUpIcon className="w-4 h-4" /> : <ArrowDownIcon className="w-4 h-4" />}
                        </button>
                    </div>
                    <div className="mt-2">
                        <label htmlFor="fullscreen-verified-filter" className="flex items-center cursor-pointer p-1 w-full rounded-lg hover:bg-background transition-colors">
                            <input id="fullscreen-verified-filter" type="checkbox" checked={showVerifiedOnly} onChange={(e) => setShowVerifiedOnly(e.target.checked)} className="h-4 w-4 rounded border-border bg-background text-accent focus:ring-accent" />
                            <span className="ml-2 text-sm font-medium text-text-primary">Sadece Onaylananlar</span>
                        </label>
                    </div>
                    <button onClick={() => handleExportToExcel(filteredAndSortedItems)} disabled={filteredAndSortedItems.length === 0} className="btn btn-secondary w-full mt-4"> <DownloadIcon className="w-5 h-5" /> Filtrelenenleri Aktar </button>
                </div>
                <div className="flex-grow overflow-y-auto p-1">
                    {filteredAndSortedItems.map(item => (
                        <div key={item.id} onClick={() => handleNavigation({ type: 'item', id: item.id })} className={`p-2 my-1 rounded-lg cursor-pointer flex items-start gap-3 transition-all duration-200 ${item.id === currentItem.id ? 'ring-2 ring-accent shadow-[0_0_15px_var(--color-accent-glow)]' : 'hover:bg-accent/10'}`}>
                             <div className="flex-shrink-0" onClick={(e) => { e.stopPropagation(); if (item.status === 'SUCCESS') onUpdateEntry({ ...item, verified: !item.verified }); }} title={item.status === 'SUCCESS' ? (item.verified ? 'Onayı kaldır' : 'Onayla') : ''}>
                                {item.status === 'SUCCESS' ? <CheckCircleIcon className={`w-5 h-5 mt-0.5 transition-colors cursor-pointer ${item.verified ? 'text-[var(--color-success)]' : 'text-text-muted hover:text-success/50'}`} /> : <ErrorIcon className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />}
                            </div>
                             <div className="flex-grow overflow-hidden">
                                <p className={`font-semibold truncate ${item.id === currentItem.id ? 'text-accent' : 'text-text-primary'}`}>{item.declaration?.fileName || item.freight?.fileName}</p>
                                <p className="text-xs text-text-muted">{new Date(item.analyzedAt).toLocaleString('tr-TR')}</p>
                             </div>
                        </div>
                    ))}
                </div>
            </aside>

            {/* --- Main Content --- */}
            <main className="flex-1 flex flex-col relative">
                <header className="flex-shrink-0 h-16 bg-[var(--color-background-light)] border-b border-[var(--color-border)] flex items-center justify-between px-4">
                    <div className="flex items-center gap-2">
                        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 rounded-full hover:bg-[var(--color-background)]" title="Kenar Çubuğunu Gizle/Göster"><PanelLeftIcon className="w-5 h-5"/></button>
                        {!isVerifyingPairing && (
                           <>
                            <button onClick={handleSave} disabled={!isDirty || saveState === 'saved'} className={`btn ${isDirty ? 'btn-primary' : 'btn-secondary'} w-32`}>
                                <SaveIcon className="w-5 h-5"/>
                                {renderSaveButtonContent()}
                            </button>
                            <button onClick={undo} disabled={!canUndo} className="p-2 rounded-full hover:bg-[var(--color-background)] disabled:opacity-30" title="Geri Al (Ctrl+Z)"><UndoIcon className="w-5 h-5"/></button>
                            <button onClick={redo} disabled={!canRedo} className="p-2 rounded-full hover:bg-[var(--color-background)] disabled:opacity-30" title="İleri Al (Ctrl+Y)"><RedoIcon className="w-5 h-5"/></button>
                            {currentItem.status === 'SUCCESS' && (
                                <button onClick={handleVerificationToggle} className={`btn btn-secondary !py-1.5 !px-3 w-40 transition-all duration-300 ease-in-out ${verificationState === 'idle' && localVerified ? 'text-success border-success/50' : ''} ${verificationState === 'confirmed' ? 'bg-success/20 !text-success !border-success/50' : ''} ${verificationState === 'removed' ? 'bg-danger/20 !text-danger !border-danger/50' : ''}`} title={localVerified ? 'Onayı kaldır' : 'Onaylandı olarak işaretle'}>
                                    <BadgeCheckIcon className="w-5 h-5"/>
                                    {renderVerificationButtonContent()}
                                </button>
                            )}
                           </>
                        )}
                    </div>
                     <div className="flex-grow text-center font-semibold text-text-primary truncate px-4">{`${currentItem.declaration?.fileName || '...'} / ${currentItem.freight?.fileName || '...'}`}</div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => handleNavigation({ type: 'close' })} className="p-2 rounded-full hover:bg-[var(--color-background)]" title="Kapat (Esc)"><XIcon className="w-6 h-6"/></button>
                    </div>
                </header>
                
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden" onMouseMove={handlePanMove} onMouseUp={handlePanEnd} onMouseLeave={handlePanEnd}>
                    {/* Column 1: Data Entry / Verification */}
                    <div ref={dataPanelRef} style={!isMobile ? { width: `${sidebarWidth}px` } : {}} className="flex-shrink-0 w-full h-1/2 md:h-full flex flex-col px-2 bg-[var(--color-background-light)] border-b md:border-b-0 md:border-r border-[var(--color-border)]">
                         {isVerifyingPairing ? (
                             <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center animate-fade-in">
                                 <h2 className="text-3xl font-bold text-text-primary">Eşleşmeyi Onayla</h2>
                                 <p className="text-text-secondary my-4">Bu iki belgenin birbiriyle ilgili olduğunu onaylıyor musunuz?</p>
                                 <div className="flex flex-col gap-4 w-full max-w-sm mt-4">
                                     <button onClick={handleConfirmPairing} className="btn btn-primary text-lg !py-3 bg-[var(--color-success)] hover:bg-green-700">
                                         <CheckCircleIcon className="w-6 h-6 mr-2" /> Evet, Doğru
                                     </button>
                                     <button onClick={() => onRejectPairing(currentItem.id)} className="btn btn-danger text-lg !py-3">
                                         <XCircleIcon className="w-6 h-6 mr-2" /> Hayır, Yanlış
                                     </button>
                                 </div>
                                 <p className="text-xs text-text-muted mt-6">Sadece bir belge yanlışsa, belge önizlemesindeki çöp kutusu simgesini kullanarak onu kaldırabilirsiniz.</p>
                             </div>
                         ) : (
                            <div className="flex-1 overflow-y-auto min-h-0 pr-2">
                                <h4 className="text-base font-bold text-center text-text-primary border-b border-border pb-2 mb-2">Beyanname Bilgileri</h4>
                                <div className="space-y-0">
                                    {extractedFieldsOrder.filter(k => k !== 'TAREKS-TARIM-TSE').map((key, index) => (
                                        <EditableField key={key} label={key} value={editedData[key] || ''} onChange={(newValue) => setEditedData(prev => ({ ...prev, [key]: newValue }))} onActivate={setActiveFieldLabel} isActive={activeFieldLabel === key} setRef={(el) => { fieldRefs.current[key] = el; }} isEven={index % 2 === 0} datalistId={key === 'SON AMBAR' ? 'son-ambar-list' : undefined} datalistOptions={key === 'SON AMBAR' ? sonAmbarDatalistOptions : undefined} />
                                    ))}
                                    <div ref={(el) => { fieldRefs.current['TAREKS-TARIM-TSE'] = el; }} key="TAREKS-TARIM-TSE" className={`flex items-baseline gap-x-2 border-l-2 py-1 px-2 transition-colors rounded-md ${activeFieldLabel === 'TAREKS-TARIM-TSE' ? 'bg-accent/10 border-accent' : 'border-transparent'} ${tareksIndex % 2 === 0 ? 'bg-[var(--color-background)]' : 'bg-transparent'}`} onMouseDown={() => setActiveFieldLabel('TAREKS-TARIM-TSE')}>
                                        <p className="text-2xs text-text-muted font-medium whitespace-nowrap w-1/4 truncate">{FIELD_LABELS['TAREKS-TARIM-TSE']}</p>
                                        <div className="flex items-center gap-4 w-3/4">
                                            <label className="flex items-center cursor-pointer"><input type="radio" name="tareks-radio" value="VAR" checked={editedData['TAREKS-TARIM-TSE'] === 'VAR'} onChange={(e) => setEditedData(prev => ({ ...prev, 'TAREKS-TARIM-TSE': e.target.value }))} className="w-4 h-4 text-accent bg-background border-border focus:ring-accent"/><span className="ml-2 text-2xs font-medium text-text-primary">VAR</span></label>
                                            <label className="flex items-center cursor-pointer"><input type="radio" name="tareks-radio" value="YOK" checked={editedData['TAREKS-TARIM-TSE'] === 'YOK'} onChange={(e) => setEditedData(prev => ({ ...prev, 'TAREKS-TARIM-TSE': e.target.value }))} className="w-4 h-4 text-accent bg-background border-border focus:ring-accent"/><span className="ml-2 text-2xs font-medium text-text-primary">YOK</span></label>
                                        </div>
                                    </div>
                                </div>
                                <h4 className="text-base font-bold text-center text-text-primary border-b border-border pb-2 mt-4 mb-2">Navlun Faturası Bilgileri</h4>
                                <div className="space-y-0">
                                    {FREIGHT_FIELDS.map((key, index) => ( <EditableField key={key} label={key} value={editedData[key] || ''} onChange={(newValue) => setEditedData(prev => ({ ...prev, [key]: newValue }))} onActivate={setActiveFieldLabel} isActive={activeFieldLabel === key} setRef={(el) => { fieldRefs.current[key] = el; }} isEven={index % 2 === 0} readOnly={key === 'TT' || key === 'w/m navlun' || key === 'KAYIT TARİHİ'} datalistId={key === 'Nakliyeci' ? 'nakliyeci-list' : undefined} datalistOptions={key === 'Nakliyeci' ? nakliyeciOptions : undefined} /> ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div onMouseDown={!isMobile ? handleMouseDown : undefined} className="hidden md:flex items-center justify-center w-3 h-full cursor-col-resize group transition-colors bg-[var(--color-background)] hover:bg-accent/10 flex-shrink-0"><GripVerticalIcon className="w-6 h-6 text-border group-hover:text-accent transition-colors" /></div>

                    <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-w-0 h-1/2 md:h-full">
                        {/* Declaration Viewer */}
                        <div className="w-full h-1/2 md:w-1/2 md:h-full flex flex-col bg-[var(--color-background)] min-w-0 md:border-r border-b md:border-b-0 border-border p-2">
                            <div className="flex-shrink-0 flex items-center justify-between pb-2 px-2">
                                <p className="font-bold text-text-primary">Beyanname</p>
                                {currentItem.declaration && <div className="flex items-center gap-1 bg-background-light/80 backdrop-blur-sm p-1 rounded-lg border border-border">
                                    <button onClick={() => handleRotate('declaration', 'left')} className="p-1.5 rounded-md hover:bg-border transition-colors" title="Sola Döndür"><RotateCcwIcon className="w-5 h-5"/></button>
                                    <button onClick={() => handleRotate('declaration', 'right')} className="p-1.5 rounded-md hover:bg-border transition-colors" title="Sağa Döndür"><RotateCwIcon className="w-5 h-5"/></button>
                                    <button onClick={() => handleZoom('declaration', 'out')} className="p-1.5 rounded-md hover:bg-border transition-colors" title="Uzaklaş"><ZoomOutIcon className="w-5 h-5"/></button>
                                    <button onClick={() => handleZoom('declaration', 'reset')} className="px-2 py-1.5 rounded-md hover:bg-border text-xs font-bold" title="Sıfırla">1:1</button>
                                    <button onClick={() => handleZoom('declaration', 'in')} className="p-1.5 rounded-md hover:bg-border transition-colors" title="Yakınlaş"><ZoomInIcon className="w-5 h-5"/></button>
                                    {isVerifyingPairing && <button onClick={() => handleDeleteClick('declaration')} className="p-1.5 rounded-md text-text-muted hover:bg-danger/20 hover:text-danger transition-colors" title="Bu belgeyi sil"><TrashIcon className="w-5 h-5"/></button>}
                                </div>}
                            </div>
                            <div ref={declarationViewerRef} className="flex-1 bg-border/20 rounded-lg overflow-hidden relative" onWheel={(e) => currentItem.declaration && handleWheelZoom(e, 'declaration')}>
                                {currentItem.declaration?.fullResolutionDataUrl ? (
                                    <div onMouseDown={(e) => handlePanStart(e, 'declaration')} style={{ transform: `translate(${declarationTransform.x}px, ${declarationTransform.y}px) scale(${declarationTransform.scale})`, cursor: panningState ? 'grabbing' : 'grab', transformOrigin: 'top left' }} className="w-full h-full flex items-center justify-center">
                                        <img src={currentItem.declaration.fullResolutionDataUrl} alt={currentItem.declaration.fileName} className="max-w-full max-h-full" style={{ transform: `rotate(${declarationRotation}deg)` }} draggable="false" />
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-text-muted p-4">
                                        <FileIcon className="w-16 h-16" />
                                        <p className="mt-2 text-sm font-semibold text-center">Belge Yok</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Freight Viewer */}
                        <div className="w-full h-1/2 md:w-1/2 md:h-full flex flex-col bg-[var(--color-background)] min-w-0 p-2">
                            <div className="flex-shrink-0 flex items-center justify-between pb-2 px-2">
                                <p className="font-bold text-text-primary">Navlun Faturası</p>
                                {currentItem.freight && <div className="flex items-center gap-1 bg-background-light/80 backdrop-blur-sm p-1 rounded-lg border border-border">
                                    <button onClick={() => handleRotate('freight', 'left')} className="p-1.5 rounded-md hover:bg-border transition-colors" title="Sola Döndür"><RotateCcwIcon className="w-5 h-5"/></button>
                                    <button onClick={() => handleRotate('freight', 'right')} className="p-1.5 rounded-md hover:bg-border transition-colors" title="Sağa Döndür"><RotateCwIcon className="w-5 h-5"/></button>
                                    <button onClick={() => handleZoom('freight', 'out')} className="p-1.5 rounded-md hover:bg-border transition-colors" title="Uzaklaş"><ZoomOutIcon className="w-5 h-5"/></button>
                                    <button onClick={() => handleZoom('freight', 'reset')} className="px-2 py-1.5 rounded-md hover:bg-border text-xs font-bold" title="Sıfırla">1:1</button>
                                    <button onClick={() => handleZoom('freight', 'in')} className="p-1.5 rounded-md hover:bg-border transition-colors" title="Yakınlaş"><ZoomInIcon className="w-5 h-5"/></button>
                                    {isVerifyingPairing && <button onClick={() => handleDeleteClick('freight')} className="p-1.5 rounded-md text-text-muted hover:bg-danger/20 hover:text-danger transition-colors" title="Bu belgeyi sil"><TrashIcon className="w-5 h-5"/></button>}
                                </div>}
                            </div>
                             <div ref={freightViewerRef} className="flex-1 bg-border/20 rounded-lg overflow-hidden relative" onWheel={(e) => currentItem.freight && handleWheelZoom(e, 'freight')}>
                                {currentItem.freight?.fullResolutionDataUrl ? (
                                    <div onMouseDown={(e) => handlePanStart(e, 'freight')} style={{ transform: `translate(${freightTransform.x}px, ${freightTransform.y}px) scale(${freightTransform.scale})`, cursor: panningState ? 'grabbing' : 'grab', transformOrigin: 'top left' }} className="w-full h-full flex items-center justify-center">
                                        <img src={currentItem.freight.fullResolutionDataUrl} alt={currentItem.freight.fileName} className="max-w-full max-h-full" style={{ transform: `rotate(${freightRotation}deg)` }} draggable="false" />
                                    </div>
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-text-muted p-4">
                                        <FileIcon className="w-16 h-16" />
                                        <p className="mt-2 text-sm font-semibold text-center">Belge Yok</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <button onClick={() => handleNavigateByIndex(-1)} disabled={currentItemIndex <= 0} className="absolute left-1/4 top-1/2 -translate-y-1/2 z-30 p-2 bg-black/40 text-white rounded-full hover:bg-black/60 disabled:opacity-0 disabled:pointer-events-none transition-opacity"><ChevronLeftIcon className="w-6 h-6"/></button>
                <button onClick={() => handleNavigateByIndex(1)} disabled={currentItemIndex >= filteredAndSortedItems.length - 1} className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-2 bg-black/40 text-white rounded-full hover:bg-black/60 disabled:opacity-0 disabled:pointer-events-none transition-opacity"><ChevronRightIcon className="w-6 h-6"/></button>
            </main>

             {navigationIntent && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4" onClick={() => setNavigationIntent(null)}>
                    <div className="modern-card rounded-2xl p-8 max-w-md w-full text-center" onMouseDown={e => e.stopPropagation()}>
                        <ErrorIcon className="w-16 h-16 mx-auto text-[var(--color-warning)] mb-4" />
                        <h2 className="text-2xl font-bold text-text-primary mb-2">Kaydedilmemiş Değişiklikler</h2>
                        <p className="text-text-secondary mb-8">Yaptığınız değişiklikler kaydedilmedi. Ayrılarak bu değişiklikleri kaybetmek istediğinizden emin misiniz?</p>
                        <div className="flex flex-col sm:flex-row justify-center gap-4">
                            <button onClick={() => confirmNavigation(false)} className="btn btn-secondary w-full">Değişiklikleri Yoksay</button>
                            <button onClick={() => confirmNavigation(true)} className="btn btn-primary w-full">Kaydet ve Devam Et</button>
                        </div>
                    </div>
                </div>
            )}
            {docTypeToDelete && docToRemove && (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] animate-fade-in p-4" onClick={() => setDocTypeToDelete(null)}>
                    <div className="modern-card rounded-2xl p-8 max-w-md w-full text-center" onMouseDown={e => e.stopPropagation()}>
                        <ErrorIcon className="w-16 h-16 mx-auto text-[var(--color-danger)] mb-4" />
                        <h2 className="text-2xl font-bold text-text-primary mb-2">Belgeyi Sil</h2>
                        <p className="text-text-secondary mb-8">
                           <span className="font-bold break-all">"{docToRemove.fileName}"</span> belgesini bu eşleşmeden kalıcı olarak silmek istediğinizden emin misiniz? Kalan belge yeniden eşleştirilmek üzere tek kalacaktır.
                        </p>
                        <div className="flex justify-center gap-4">
                            <button onClick={() => setDocTypeToDelete(null)} className="btn btn-secondary w-full">İptal</button>
                            <button onClick={handleConfirmDelete} className="btn btn-danger w-full">Evet, Sil</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FullscreenAnalysisView;