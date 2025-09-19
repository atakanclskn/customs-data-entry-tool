
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { HistoryEntry, DocumentInfo, NavigateFunction } from '../types';
import { LinkIcon, FileIcon, PencilIcon, GripVerticalIcon, XIcon, SparklesIcon, RotateCcwIcon, RotateCwIcon, ZoomOutIcon, ZoomInIcon } from './Icons';

interface PairingPageProps {
    history: HistoryEntry[];
    onCreatePair: (id1: string, id2: string) => Promise<void>;
    onUpdateEntry: (entry: HistoryEntry) => Promise<void>;
    navigate: NavigateFunction;
    onAutoPairRemaining: (entries: HistoryEntry[]) => Promise<void>;
}

// A single card in the sortable list
const SortableItem: React.FC<{
    entry: HistoryEntry;
    isEditing: boolean;
    tempName: string;
    setTempName: (name: string) => void;
    onStartEdit: (entry: HistoryEntry) => void;
    onConfirmEdit: () => void;
    onCancelEdit: () => void;
    onDragStart: (e: React.DragEvent, entry: HistoryEntry) => void;
    onDragOver: (e: React.DragEvent, entry: HistoryEntry) => void;
    onDrop: (e: React.DragEvent, entry: HistoryEntry) => void;
    isDragged: boolean;
    isDropTarget: boolean;
}> = ({ entry, isEditing, tempName, setTempName, onStartEdit, onConfirmEdit, onCancelEdit, onDragStart, onDragOver, onDrop, isDragged, isDropTarget }) => {
    const doc = entry.declaration || entry.freight;
    const nameInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditing) {
            nameInputRef.current?.focus();
            nameInputRef.current?.select();
        }
    }, [isEditing]);
    
    if (!doc) return null;

    const { width, height, rotation } = doc;
    const isRotated = rotation === 90 || rotation === 270;
    let aspectRatio = '1 / 1.41'; // A4-like fallback

    if (width && height && width > 0 && height > 0) {
        aspectRatio = isRotated ? `${height} / ${width}` : `${width} / ${height}`;
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') onConfirmEdit();
        if (e.key === 'Escape') onCancelEdit();
    };

    return (
        <div
            draggable={!isEditing}
            onDragStart={!isEditing ? (e) => onDragStart(e, entry) : undefined}
            onDragOver={(e) => onDragOver(e, entry)}
            onDrop={(e) => onDrop(e, entry)}
            className={`modern-card rounded-lg flex flex-col transition-all duration-200 select-none ${isDragged ? 'opacity-30' : ''} ${isDropTarget ? 'ring-2 ring-accent shadow-lg' : ''}`}
        >
            <div className="p-2 bg-black/20 flex-grow">
                 <div style={{ aspectRatio }} className="w-full relative">
                     <img 
                        src={doc.previewDataUrl || ''} 
                        alt={doc.fileName} 
                        className="absolute top-0 left-0 w-full h-full object-contain rounded-md" 
                        style={{ transform: `rotate(${rotation || 0}deg)` }}
                    />
                </div>
            </div>
            <div className="flex items-center p-2 border-t border-border bg-background-light">
                <button draggable onDragStart={(e) => onDragStart(e, entry)} className="p-1 text-text-muted cursor-grab active:cursor-grabbing">
                    <GripVerticalIcon className="w-5 h-5" />
                </button>
                <div className="flex-grow overflow-hidden mx-2">
                    {isEditing ? (
                        <input
                            ref={nameInputRef}
                            type="text"
                            value={tempName}
                            onChange={e => setTempName(e.target.value)}
                            onBlur={onConfirmEdit}
                            onKeyDown={handleKeyDown}
                            className="w-full bg-background border border-accent text-xs font-medium p-1 rounded-md focus:outline-none"
                        />
                    ) : (
                        <p className="font-semibold text-xs text-text-primary w-full truncate" title={doc.fileName}>{doc.fileName}</p>
                    )}
                </div>
                <button onClick={() => onStartEdit(entry)} className="p-2 rounded-full text-text-muted hover:bg-border hover:text-accent transition-colors flex-shrink-0" aria-label="Dosya adını düzenle">
                    <PencilIcon className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

// Drop zone for pairing, now with interactive controls
const InteractiveViewer: React.FC<{
    title: string;
    entry: HistoryEntry | null;
    onDrop: (e: React.DragEvent) => void;
    onClear: () => void;
    isDropTarget: boolean;
    setDropTarget: (isTarget: boolean) => void;
    transform: { scale: number; x: number; y: number; };
    onZoom: (direction: 'in' | 'out' | 'reset') => void;
    onRotate: (direction: 'left' | 'right') => void;
    onPanStart: (e: React.MouseEvent) => void;
    onWheelZoom: (e: React.WheelEvent<HTMLDivElement>) => void;
    viewerRef: React.RefObject<HTMLDivElement>;
    panningState: boolean;
}> = ({ title, entry, onDrop, onClear, isDropTarget, setDropTarget, transform, onZoom, onRotate, onPanStart, onWheelZoom, viewerRef, panningState }) => {
    const doc = entry?.declaration || entry?.freight;

    return (
        <div
            onDrop={onDrop}
            onDragOver={(e) => { e.preventDefault(); setDropTarget(true); }}
            onDragLeave={() => setDropTarget(false)}
            className={`w-full h-full flex flex-col p-3 rounded-lg border-2 transition-all duration-300 ${isDropTarget ? 'border-accent shadow-[0_0_20px_var(--color-accent-glow)] bg-accent/10 border-dashed' : 'border-border bg-background'}`}
        >
            <div className="flex-shrink-0 flex items-center justify-between pb-2 px-1 z-10">
                <p className="font-bold text-text-primary">{title}</p>
                {doc && (
                    <div className="flex items-center gap-1">
                        <div className="flex items-center gap-1 bg-background-light/80 backdrop-blur-sm p-1 rounded-lg border border-border">
                            <button onClick={() => onRotate('left')} className="p-1.5 rounded-md hover:bg-border transition-colors" title="Sola Döndür (90°)">
                                <RotateCcwIcon className="w-5 h-5"/>
                            </button>
                            <button onClick={() => onRotate('right')} className="p-1.5 rounded-md hover:bg-border transition-colors" title="Sağa Döndür (90°)">
                                <RotateCwIcon className="w-5 h-5"/>
                            </button>
                            <button onClick={() => onZoom('out')} className="p-1.5 rounded-md hover:bg-border transition-colors" title="Uzaklaş"><ZoomOutIcon className="w-5 h-5"/></button>
                            <button onClick={() => onZoom('reset')} className="px-2 py-1.5 rounded-md hover:bg-border text-xs font-bold" title="Sıfırla">1:1</button>
                            <button onClick={() => onZoom('in')} className="p-1.5 rounded-md hover:bg-border transition-colors" title="Yakınlaş"><ZoomInIcon className="w-5 h-5"/></button>
                        </div>
                        <button onClick={onClear} className="p-1.5 rounded-full hover:bg-danger/20 text-text-muted hover:text-danger transition-colors" title="Belgeyi kaldır">
                            <XIcon className="w-5 h-5" />
                        </button>
                    </div>
                )}
            </div>
            <div ref={viewerRef} className="flex-1 bg-border/20 rounded-lg overflow-hidden relative text-center text-text-muted flex items-center justify-center" onWheel={onWheelZoom}>
                {doc?.fullResolutionDataUrl ? (
                     <div onMouseDown={onPanStart} style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`, cursor: panningState ? 'grabbing' : 'grab', transformOrigin: 'top left' }} className="w-full h-full flex items-center justify-center">
                        <img
                            src={doc.fullResolutionDataUrl}
                            alt={doc.fileName}
                            className="max-w-full max-h-full"
                            style={{ transform: `rotate(${doc.rotation || 0}deg)` }}
                            draggable="false"
                        />
                    </div>
                ) : (
                    <div className="p-4">
                        <FileIcon className="w-16 h-16 mx-auto" />
                        <p className="mt-2 font-semibold">Belgeyi Buraya Sürükleyin</p>
                    </div>
                )}
            </div>
        </div>
    );
};


const PairingPage: React.FC<PairingPageProps> = ({ history, onCreatePair, onUpdateEntry, onAutoPairRemaining }) => {
    const [unpairedEntries, setUnpairedEntries] = useState<HistoryEntry[]>([]);
    const [declarationSlot, setDeclarationSlot] = useState<HistoryEntry | null>(null);
    const [freightSlot, setFreightSlot] = useState<HistoryEntry | null>(null);

    // Drag states
    const [draggedItem, setDraggedItem] = useState<HistoryEntry | null>(null);
    const [dropTargetId, setDropTargetId] = useState<string | null>(null);
    const [dragOverSlot, setDragOverSlot] = useState<null | 'declaration' | 'freight'>(null);

    // Editing states
    const [editingId, setEditingId] = useState<string | null>(null);
    const [tempName, setTempName] = useState('');
    
    // Viewer states
    const declarationViewerRef = useRef<HTMLDivElement>(null);
    const freightViewerRef = useRef<HTMLDivElement>(null);
    const [declarationTransform, setDeclarationTransform] = useState({ scale: 1, x: 0, y: 0 });
    const [freightTransform, setFreightTransform] = useState({ scale: 1, x: 0, y: 0 });
    const [panningState, setPanningState] = useState<{ slot: 'declaration' | 'freight', startX: number, startY: number } | null>(null);


    // Filter and sort history to get unpaired items
    useEffect(() => {
        const freshUnpaired = history
            .filter(entry => (entry.declaration && !entry.freight) || (!entry.declaration && entry.freight))
            .sort((a, b) => {
                 const nameA = a.declaration?.fileName || a.freight?.fileName || '';
                 const nameB = b.declaration?.fileName || b.freight?.fileName || '';
                 return nameA.localeCompare(nameB);
            });

        setUnpairedEntries(freshUnpaired);
    }, [history]);

    const handleStartEdit = (entry: HistoryEntry) => {
        const doc = entry.declaration || entry.freight;
        if (doc) {
            setEditingId(entry.id);
            setTempName(doc.fileName);
        }
    };

    const handleConfirmEdit = async () => {
        if (!editingId || !tempName) {
            setEditingId(null);
            return;
        }
        const entryToUpdate = history.find(e => e.id === editingId);
        if (entryToUpdate) {
            const originalDoc = entryToUpdate.declaration || entryToUpdate.freight;
            if (originalDoc && originalDoc.fileName !== tempName) {
                const updatedDoc = { ...originalDoc, fileName: tempName };
                const newEntry = {
                    ...entryToUpdate,
                    declaration: entryToUpdate.declaration ? updatedDoc : undefined,
                    freight: entryToUpdate.freight ? updatedDoc : undefined,
                };
                await onUpdateEntry(newEntry);
            }
        }
        setEditingId(null);
    };
    
    // Drag handlers
    const handleDragStart = (e: React.DragEvent, entry: HistoryEntry) => {
        setDraggedItem(entry);
        e.dataTransfer.setData('text/plain', entry.id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragEnd = () => {
        setDraggedItem(null);
        setDropTargetId(null);
        setDragOverSlot(null);
    };

    const handleDropOnList = (e: React.DragEvent, dropTarget: HistoryEntry) => {
        e.preventDefault();
        if (!draggedItem || draggedItem.id === dropTarget.id) return;

        const items = [...unpairedEntries];
        const draggedIndex = items.findIndex(item => item.id === draggedItem.id);
        const targetIndex = items.findIndex(item => item.id === dropTarget.id);
        
        if (draggedIndex === -1 || targetIndex === -1) return;

        const [removed] = items.splice(draggedIndex, 1);
        items.splice(targetIndex, 0, removed);
        
        setUnpairedEntries(items);
    };

    const handleDropOnSlot = (slot: 'declaration' | 'freight', e: React.DragEvent) => {
        e.preventDefault();
        const droppedId = e.dataTransfer.getData('text/plain');
        const droppedItem = unpairedEntries.find(item => item.id === droppedId);

        if (!droppedItem) return;
        
        if ((slot === 'declaration' && freightSlot?.id === droppedId) || (slot === 'freight' && declarationSlot?.id === droppedId)) return;

        if (slot === 'declaration') {
            setDeclarationSlot(droppedItem);
            setDeclarationTransform({ scale: 1, x: 0, y: 0 }); // Reset view on new doc
        } else {
            setFreightSlot(droppedItem);
            setFreightTransform({ scale: 1, x: 0, y: 0 }); // Reset view on new doc
        }
    };

    const handleClearSlot = (slot: 'declaration' | 'freight') => {
        if (slot === 'declaration') setDeclarationSlot(null);
        else setFreightSlot(null);
    };

    const handlePair = () => {
        if (declarationSlot && freightSlot) {
            onCreatePair(declarationSlot.id, freightSlot.id).then(() => {
                setDeclarationSlot(null);
                setFreightSlot(null);
            });
        }
    };
    
    const handleAutoPair = () => {
        const itemsToPair = displayedUnpairedEntries;
        if (itemsToPair.length > 1) {
            onAutoPairRemaining(itemsToPair);
        }
    };

    const displayedUnpairedEntries = useMemo(() => {
        return unpairedEntries.filter(e => e.id !== declarationSlot?.id && e.id !== freightSlot?.id);
    }, [unpairedEntries, declarationSlot, freightSlot]);

    // --- Viewer Control Handlers ---
    const handleRotate = (slot: 'declaration' | 'freight', direction: 'left' | 'right') => {
        const entry = slot === 'declaration' ? declarationSlot : freightSlot;
        if (!entry) return;

        const docToUpdate = entry.declaration || entry.freight;
        if (!docToUpdate) return;
        
        const angle = direction === 'left' ? -90 : 90;
        const currentRotation = docToUpdate.rotation || 0;
        const newRotation = (currentRotation + angle + 360) % 360;
        const updatedDoc = { ...docToUpdate, rotation: newRotation };
        
        const updatedEntry = {
            ...entry,
            declaration: entry.declaration ? updatedDoc : undefined,
            freight: entry.freight ? updatedDoc : undefined
        };
        onUpdateEntry(updatedEntry);
    };

    const handlePanStart = (e: React.MouseEvent, slot: 'declaration' | 'freight') => { e.preventDefault(); const transform = slot === 'declaration' ? declarationTransform : freightTransform; setPanningState({ slot, startX: e.clientX - transform.x, startY: e.clientY - transform.y }); };
    const handlePanMove = (e: React.MouseEvent) => { if (!panningState) return; e.preventDefault(); const newX = e.clientX - panningState.startX; const newY = e.clientY - panningState.startY; if (panningState.slot === 'declaration') setDeclarationTransform(prev => ({ ...prev, x: newX, y: newY })); else setFreightTransform(prev => ({ ...prev, x: newX, y: newY })); };
    const handlePanEnd = () => setPanningState(null);
    
    const handleZoom = (slot: 'declaration' | 'freight', direction: 'in' | 'out' | 'reset') => {
        const setTransform = slot === 'declaration' ? setDeclarationTransform : setFreightTransform;
        const viewerRef = slot === 'declaration' ? declarationViewerRef : freightViewerRef;

        if (direction === 'reset') {
            setTransform({ scale: 1, x: 0, y: 0 });
            return;
        }
        
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

    const handleWheelZoom = (e: React.WheelEvent<HTMLDivElement>, slot: 'declaration' | 'freight') => {
        e.preventDefault();
        const setTransform = slot === 'declaration' ? setDeclarationTransform : setFreightTransform;
        
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

    return (
        <div className="w-full h-full flex flex-col" onMouseMove={handlePanMove} onMouseUp={handlePanEnd} onMouseLeave={handlePanEnd}>
            <div className="flex-shrink-0 flex items-start justify-between mb-4">
                <div>
                    <h1 className="text-3xl font-bold text-text-primary">Manuel Belge Eşleştirme</h1>
                    <p className="text-md text-text-secondary mt-1">Belgeleri sıralayın ve eşleştirmek için sağdaki alanlara sürükleyin.</p>
                </div>
                <div className="flex items-center gap-4">
                     <button 
                        onClick={handleAutoPair} 
                        disabled={displayedUnpairedEntries.length < 2}
                        className="btn btn-secondary"
                        title="Kalan belgeleri isme göre otomatik olarak eşleştirir."
                    >
                        <SparklesIcon className="w-5 h-5"/>
                        Kalanları Otomatik Eşleştir
                    </button>
                    <button onClick={handlePair} disabled={!declarationSlot || !freightSlot} className="btn btn-primary w-48">
                        <LinkIcon className="w-5 h-5" />
                        Eşleştir
                    </button>
                </div>
            </div>

            <div className="flex-1 flex gap-6 min-h-0">
                {/* Left Panel: Unpaired Documents */}
                <aside className="w-2/5 h-full flex flex-col">
                    <h2 className="text-lg font-semibold text-text-primary mb-2">Sıralama Alanı ({displayedUnpairedEntries.length})</h2>
                    <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-2 gap-4" onDragLeave={() => setDropTargetId(null)} onDragEnd={handleDragEnd}>
                        {displayedUnpairedEntries.length > 0 ? displayedUnpairedEntries.map(entry => (
                            <SortableItem
                                key={entry.id}
                                entry={entry}
                                isEditing={editingId === entry.id}
                                tempName={tempName}
                                setTempName={setTempName}
                                onStartEdit={handleStartEdit}
                                onConfirmEdit={handleConfirmEdit}
                                onCancelEdit={() => setEditingId(null)}
                                onDragStart={handleDragStart}
                                onDragOver={(e, target) => { e.preventDefault(); setDropTargetId(target.id); }}
                                onDrop={handleDropOnList}
                                isDragged={draggedItem?.id === entry.id}
                                isDropTarget={dropTargetId === entry.id}
                            />
                        )) : (
                            <div className="text-center py-16 text-text-muted col-span-2">
                                <p>Eşleştirilecek belge bulunmuyor.</p>
                            </div>
                        )}
                    </div>
                </aside>

                {/* Right Panel: Pairing Area */}
                <main className="w-3/5 h-full flex gap-4 border-l border-border pl-6">
                    <InteractiveViewer
                        title="Beyanname"
                        entry={declarationSlot}
                        onDrop={(e) => handleDropOnSlot('declaration', e)}
                        onClear={() => handleClearSlot('declaration')}
                        isDropTarget={dragOverSlot === 'declaration'}
                        setDropTarget={(isTarget) => setDragOverSlot(isTarget ? 'declaration' : null)}
                        transform={declarationTransform}
                        onZoom={(dir) => handleZoom('declaration', dir)}
                        onRotate={(dir) => handleRotate('declaration', dir)}
                        onPanStart={(e) => handlePanStart(e, 'declaration')}
                        onWheelZoom={(e) => handleWheelZoom(e, 'declaration')}
                        viewerRef={declarationViewerRef}
                        panningState={panningState?.slot === 'declaration'}
                    />
                    <InteractiveViewer
                        title="Navlun Faturası"
                        entry={freightSlot}
                        onDrop={(e) => handleDropOnSlot('freight', e)}
                        onClear={() => handleClearSlot('freight')}
                        isDropTarget={dragOverSlot === 'freight'}
                        setDropTarget={(isTarget) => setDragOverSlot(isTarget ? 'freight' : null)}
                        transform={freightTransform}
                        onZoom={(dir) => handleZoom('freight', dir)}
                        onRotate={(dir) => handleRotate('freight', dir)}
                        onPanStart={(e) => handlePanStart(e, 'freight')}
                        onWheelZoom={(e) => handleWheelZoom(e, 'freight')}
                        viewerRef={freightViewerRef}
                        panningState={panningState?.slot === 'freight'}
                    />
                </main>
            </div>
        </div>
    );
};

export default PairingPage;
