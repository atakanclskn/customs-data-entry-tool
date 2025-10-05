import React, { useState, useEffect, useCallback } from 'react';
import { Page, HistoryEntry, DeclarationData, Theme, FileWithUrl, DocumentType, DocumentInfo } from './types';
import Sidebar from './components/Sidebar';
import AnalysisPage from './components/AnalysisPage';
import HistoryPage from './components/HistoryPage';
import PairingPage from './components/PairingPage';
import FullscreenAnalysisView from './components/FullscreenAnalysisView';
import * as historyService from './services/historyService';
import { MenuIcon } from './components/Icons';

function App() {
  const [page, setPage] = useState<Page>(Page.ANALYSIS);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [appError, setAppError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [pageKey, setPageKey] = useState(0);
  const [theme, setTheme] = useState<Theme>(Theme.DARK);

  // Fullscreen Editor State
  const [fullscreenViewData, setFullscreenViewData] = useState<{ context: 'analysis' | 'history', selectedId: string } | null>(null);


  useEffect(() => {
    const initializeApp = async () => {
        try {
          await historyService.migrateFromLocalStorage();
          const initialHistory = await historyService.getHistory();
          setHistory(initialHistory);
          
          const storedTheme = localStorage.getItem('appTheme') as Theme | null;
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          const initialTheme = storedTheme || (prefersDark ? Theme.DARK : Theme.LIGHT);
          setTheme(initialTheme);

        } catch (e) {
          console.error("Local storage'a veya IndexedDB'ye erişilemiyor.", e);
          setAppError("Tarayıcı verilerine erişilemiyor. Lütfen ayarları kontrol edin.");
        }
    };

    initializeApp();
  }, []);

  useEffect(() => {
    if (theme === Theme.DARK) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
  }, [theme]);


  const handleThemeChange = (newTheme: Theme) => {
    try {
        localStorage.setItem('appTheme', newTheme);
        setTheme(newTheme);
    } catch (e) {
        console.error("Local storage'a yazılamıyor.", e);
        setAppError("Tema tercihi tarayıcıda saklanamadı.");
    }
  }

  const handleUpdateHistoryEntry = useCallback(async (updatedEntry: HistoryEntry) => {
      const savedEntry = await historyService.updateHistoryEntry(updatedEntry);
      setHistory(prev => prev.map(entry => entry.id === savedEntry.id ? savedEntry : entry));
  }, []);
  
  const handleDeleteHistoryEntry = useCallback(async (id: string) => {
      await historyService.deleteHistoryEntry(id);
      setHistory(prev => prev.filter(entry => entry.id !== id));
  }, []);

  const handleDeleteMultipleHistoryEntries = useCallback(async (ids: string[]) => {
      await historyService.deleteMultipleHistoryEntries(ids);
      setHistory(prev => prev.filter(entry => !ids.includes(entry.id)));
  }, []);

  const handleClearHistory = useCallback(async () => {
      await historyService.clearHistory();
      setHistory([]);
  }, []);

  // --- Fullscreen View Handlers ---
  const handleOpenFullscreen = useCallback((context: 'analysis' | 'history', selectedId: string) => {
    setFullscreenViewData({ context, selectedId });
  }, []);

  const handleCloseFullscreen = useCallback(() => {
    setFullscreenViewData(null);
  }, []);
  
  const handleFullscreenNavigate = useCallback((newId: string) => {
    setFullscreenViewData(prev => (prev ? { ...prev, selectedId: newId } : null));
  }, []);
  
  const handleRejectPairing = useCallback(async (entryId: string) => {
    const entryToReject = history.find(e => e.id === entryId);
    if (!entryToReject) return;

    const isHistoryContext = fullscreenViewData?.context === 'history';

    // 1. Determine the original position of the item in the current view.
    const currentItems = isHistoryContext
        ? history
        : history.filter(h => h.pairingVerified === false && h.declaration && h.freight);
    const rejectedItemIndex = currentItems.findIndex(item => item.id === entryId);

    // 2. Perform DB operations and get the real new entries.
    const docsToRecreate: { declaration?: DocumentInfo; freight?: DocumentInfo; }[] = [];
    if (entryToReject.declaration) docsToRecreate.push({ declaration: entryToReject.declaration });
    if (entryToReject.freight) docsToRecreate.push({ freight: entryToReject.freight });

    const newSingleEntries = await Promise.all(
        docsToRecreate.map(docData => historyService.addHistoryEntry(docData, { pairingVerified: undefined }))
    );
    await historyService.deleteHistoryEntry(entryId);

    // 3. Manually construct the new history array to predict the next state.
    const newHistory = [...newSingleEntries, ...history.filter(e => e.id !== entryId)]
        .sort((a, b) => new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime());

    // 4. From this new history, determine the new list of items that will be displayed.
    const newItems = isHistoryContext
        ? newHistory
        : newHistory.filter(h => h.pairingVerified === false && h.declaration && h.freight);
    
    // 5. Determine the ID of the next item to navigate to.
    let nextItemId: string | null = null;
    if (newItems.length > 0) {
        const nextIndex = Math.min(rejectedItemIndex, newItems.length - 1);
        if (nextIndex >= 0) {
            nextItemId = newItems[nextIndex].id;
        }
    }

    // 6. Update state.
    setHistory(newHistory);
    
    // 7. Finally, perform navigation if we were viewing the rejected item.
    if (fullscreenViewData?.selectedId === entryId) {
        if (nextItemId) {
            handleFullscreenNavigate(nextItemId);
        } else {
            handleCloseFullscreen();
        }
    }
  }, [history, fullscreenViewData, handleCloseFullscreen, handleFullscreenNavigate]);

  const handleCreatePair = useCallback(async (id1: string, id2: string) => {
        const entry1 = history.find(e => e.id === id1); // From Slot 1 (Declaration)
        const entry2 = history.find(e => e.id === id2); // From Slot 2 (Freight)

        if (!entry1 || !entry2) return;

        const declarationDoc = entry1.declaration || entry1.freight;
        const freightDoc = entry2.declaration || entry2.freight;

        if (!declarationDoc || !freightDoc) return;
        
        // Create the new paired entry, marking it as verified since it's a manual action.
        const newPairedEntry = await historyService.addHistoryEntry(
            { declaration: declarationDoc, freight: freightDoc },
            { pairingVerified: true }
        );
        
        // Delete the old single entries
        await historyService.deleteMultipleHistoryEntries([id1, id2]);
        
        // Update state and navigate
        setHistory(prev => [newPairedEntry, ...prev.filter(e => e.id !== id1 && e.id !== id2)]);
        handleOpenFullscreen('history', newPairedEntry.id);

    }, [history, handleOpenFullscreen]);
    

  // --- Pairing Workflow Logic ---
  const handleCreatePairsFromFiles = useCallback(async (files: DocumentInfo[]) => {
    setAppError(null);
    if (files.length === 0) return;

    const newEntriesData: { declaration?: DocumentInfo; freight?: DocumentInfo; }[] = [];
    
    // Sort files alphabetically to ensure consistent pairing
    const sortedFiles = files.sort((a, b) => a.fileName.localeCompare(b.fileName, 'tr', { numeric: true }));

    let i = 0;
    while (i < sortedFiles.length) {
        const file1 = sortedFiles[i];
        const file2 = i + 1 < sortedFiles.length ? sortedFiles[i + 1] : null;

        const entry: { declaration?: DocumentInfo; freight?: DocumentInfo } = {};
        
        const isFile1Beyan = file1.fileName.toLowerCase().includes('beyan');
        const isFile2Beyan = file2?.fileName.toLowerCase().includes('beyan');

        if (file2) {
            if (isFile1Beyan && !isFile2Beyan) {
                entry.declaration = file1;
                entry.freight = file2;
                i += 2;
            } else if (!isFile1Beyan && isFile2Beyan) {
                entry.declaration = file2;
                entry.freight = file1;
                i += 2;
            } else {
                // If both are beyan or neither are, just pair them in order.
                entry.declaration = file1;
                entry.freight = file2;
                i += 2;
            }
        } else {
            // Last file is single
            entry.declaration = file1; // Default to declaration, user can fix in pairing.
            i += 1;
        }
        
        newEntriesData.push(entry);
    }

    if (newEntriesData.length > 0) {
        const newEntries = await Promise.all(newEntriesData.map(data => {
            const isSingleDoc = !data.declaration || !data.freight;
            return historyService.addHistoryEntry(data, isSingleDoc ? { pairingVerified: undefined } : { pairingVerified: false });
        }));
        
        setHistory(prev => [...newEntries, ...prev].sort((a, b) => new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime()));
        
        const firstPairToVerify = newEntries.find(e => e.pairingVerified === false);
        if (firstPairToVerify) {
             handleOpenFullscreen('analysis', firstPairToVerify.id);
        }
    }
  }, [handleOpenFullscreen]);
  
  const handleDeleteFromPair = useCallback(async (entryId: string, docTypeToDelete: 'declaration' | 'freight') => {
    const isAnalysisContext = fullscreenViewData?.context === 'analysis';
    const originalEntry = history.find(e => e.id === entryId);
    if (!originalEntry) return;

    const analysisItems = history.filter(h => h.pairingVerified === false && h.declaration && h.freight)
        .sort((a, b) => {
            const nameA = a.declaration?.fileName || a.freight?.fileName || '';
            const nameB = b.declaration?.fileName || b.freight?.fileName || '';
            return nameA.localeCompare(nameB, 'tr', { numeric: true });
        });
    const originalIndex = analysisItems.findIndex(item => item.id === entryId);

    // --- Zipper/Slide Logic: Re-pair the entire tail of the sequence ---
    if (isAnalysisContext && originalIndex >= 0 && originalIndex < analysisItems.length) {
        // 1. Flatten the document sequence starting from the current item.
        const allDocsInSequence = analysisItems.slice(originalIndex)
            .flatMap(entry => [entry.declaration, entry.freight].filter((d): d is DocumentInfo => !!d));
        
        const docToDelete = docTypeToDelete === 'declaration' ? originalEntry.declaration! : originalEntry.freight!;
        
        // 2. Remove the deleted document to get the new sequence for re-pairing.
        const remainingDocs = allDocsInSequence.filter(d => d.id !== docToDelete.id);

        // If removing the doc leaves the sequence empty, fallback to simple break-pair.
        if (remainingDocs.length > 0) {
            // 3. Delete all old pairs that are being replaced.
            const oldEntryIdsToDelete = analysisItems.slice(originalIndex).map(e => e.id);
            await historyService.deleteMultipleHistoryEntries(oldEntryIdsToDelete);
            
            // 4. Add the deleted document as a new single entry for manual pairing.
            const singleDeletedEntry = await historyService.addHistoryEntry(
                docTypeToDelete === 'declaration' ? { declaration: docToDelete } : { freight: docToDelete },
                { pairingVerified: undefined }
            );

            // 5. Create new pairs/singles from the remaining documents.
            const newEntriesData: { declaration?: DocumentInfo; freight?: DocumentInfo; }[] = [];
            let i = 0;
            while (i < remainingDocs.length) {
                const file1 = remainingDocs[i];
                const file2 = i + 1 < remainingDocs.length ? remainingDocs[i + 1] : null;
                const entry: { declaration?: DocumentInfo; freight?: DocumentInfo } = {};
                
                if (file2) {
                    const isFile1Beyan = file1.fileName.toLowerCase().includes('beyan');
                    const isFile2Beyan = file2.fileName.toLowerCase().includes('beyan');
                    if (isFile1Beyan && !isFile2Beyan) {
                        entry.declaration = file1;
                        entry.freight = file2;
                    } else if (!isFile1Beyan && isFile2Beyan) {
                        entry.declaration = file2;
                        entry.freight = file1;
                    } else {
                        entry.declaration = file1;
                        entry.freight = file2;
                    }
                    i += 2;
                } else {
                    const isFile1Beyan = file1.fileName.toLowerCase().includes('beyan');
                     if (isFile1Beyan) {
                        entry.declaration = file1;
                     } else {
                        entry.freight = file1;
                     }
                    i += 1;
                }
                newEntriesData.push(entry);
            }

            const newEntries = await Promise.all(newEntriesData.map(data => {
                const isSingleDoc = !data.declaration || !data.freight;
                return historyService.addHistoryEntry(data, isSingleDoc ? { pairingVerified: undefined } : { pairingVerified: false });
            }));
            
            // 6. Update state and navigate.
            setHistory(prev => {
                const oldIdsToDeleteSet = new Set(oldEntryIdsToDelete);
                let newHist = prev.filter(e => !oldIdsToDeleteSet.has(e.id));
                newHist.push(singleDeletedEntry, ...newEntries);
                return newHist.sort((a, b) => new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime());
            });

            const firstNewEntryToVerify = newEntries.find(e => e.pairingVerified === false);
            if (firstNewEntryToVerify) {
                handleFullscreenNavigate(firstNewEntryToVerify.id);
            } else {
                handleCloseFullscreen();
            }
            return; // Exit after handling the zipper logic.
        }
    }
    
    // --- Fallback Logic: Break pair into two singles (for History context or last item in Analysis) ---
    const docToDeleteInfo = docTypeToDelete === 'declaration' ? originalEntry.declaration : originalEntry.freight;
    const docToKeepInfo = docTypeToDelete === 'declaration' ? originalEntry.freight : originalEntry.declaration;
    
    if (!docToDeleteInfo) return;

    // 1. Create a new entry for the deleted document
    const newSingleEntryPromise = historyService.addHistoryEntry(
        docTypeToDelete === 'declaration' ? { declaration: docToDeleteInfo } : { freight: docToDeleteInfo },
        { pairingVerified: undefined }
    );
    
    // 2. Update the original entry to only contain the kept document
    const updatedOriginalEntry = {
        ...originalEntry,
        declaration: docToKeepInfo === originalEntry.declaration ? docToKeepInfo : undefined,
        freight: docToKeepInfo === originalEntry.freight ? docToKeepInfo : undefined,
        pairingVerified: undefined,
    };
    const updateOriginalPromise = historyService.updateHistoryEntry(updatedOriginalEntry);
    
    const [newSingleEntry] = await Promise.all([newSingleEntryPromise, updateOriginalPromise]);

    // Manually construct the new history state for navigation calculation
    const newHistory = [...history.map(e => e.id === entryId ? updatedOriginalEntry : e), newSingleEntry]
        .sort((a, b) => new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime());
    
    // Navigation Logic
    const currentItems = isAnalysisContext ? analysisItems : history;
    const originalItemIndex = currentItems.findIndex(item => item.id === entryId);
    
    const newItems = isAnalysisContext
        ? newHistory.filter(h => h.pairingVerified === false && h.declaration && h.freight)
        : newHistory;

    let nextItemId = null;
    if (newItems.length > 0) {
        const nextIndex = Math.min(originalItemIndex, newItems.length - 1);
        if (nextIndex >= 0 && nextIndex < newItems.length) {
            nextItemId = newItems[nextIndex].id;
        }
    }

    setHistory(newHistory);

    if (fullscreenViewData?.selectedId === entryId && isAnalysisContext) {
        if (nextItemId) {
            handleFullscreenNavigate(nextItemId);
        } else {
            handleCloseFullscreen();
        }
    }
}, [history, fullscreenViewData, handleCloseFullscreen, handleFullscreenNavigate]);


  const navigateAndCloseSidebar = (targetPage: Page) => {
    if (page !== targetPage) {
        setPage(targetPage);
        setPageKey(prev => prev + 1); // Trigger animation
    }
    setIsSidebarOpen(false);
  }
  
  const handleToggleSidebar = () => {
      setIsSidebarCollapsed(prev => !prev);
  }

  const renderPage = () => {
    switch (page) {
      case Page.ANALYSIS:
        return <AnalysisPage onConfirmPairing={handleCreatePairsFromFiles} />;
      case Page.HISTORY:
        return <HistoryPage 
                  history={history} 
                  onDelete={handleDeleteHistoryEntry}
                  onDeleteMultiple={handleDeleteMultipleHistoryEntries}
                  onClear={handleClearHistory}
                  onOpenInFullscreen={handleOpenFullscreen}
                  onUpdateEntry={handleUpdateHistoryEntry}
                  navigate={navigateAndCloseSidebar}
               />;
      case Page.PAIRING:
        return <PairingPage
                  history={history}
                  onCreatePair={handleCreatePair}
                  onUpdateEntry={handleUpdateHistoryEntry}
                  navigate={navigateAndCloseSidebar}
                />;
      default:
        return null;
    }
  };

  const getFullscreenItems = () => {
      if (!fullscreenViewData) return [];
      
      // When entering from the history page or "Edit" button, show all documents.
      if (fullscreenViewData.context === 'history') {
          return history;
      }

      // For the 'analysis' context, only show the unverified pairs.
      return history.filter(h => h.pairingVerified === false && h.declaration && h.freight);
  };

  return (
    <div className={`font-sans bg-background text-text-primary flex h-screen overflow-hidden theme-${theme}`}>
      <Sidebar 
        currentPage={page} 
        onNavigate={navigateAndCloseSidebar} 
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        theme={theme}
        onThemeChange={handleThemeChange}
        history={history}
        onOpenInFullscreen={handleOpenFullscreen}
        isCollapsed={isSidebarCollapsed}
        onToggle={handleToggleSidebar}
      />
      <main className={`flex-1 flex flex-col relative transition-all duration-300 ${isSidebarCollapsed ? 'md:pl-20' : 'md:pl-56'}`}>
        <div className="md:hidden">
            <button 
                onClick={() => setIsSidebarOpen(true)} 
                className="fixed top-4 left-4 z-20 p-2 text-text-primary bg-background-light/80 backdrop-blur-sm rounded-lg border border-border shadow-lg hover:bg-background transition-colors"
                aria-label="Menüyü aç"
            >
                <MenuIcon className="w-6 h-6" />
            </button>
        </div>
        <div key={pageKey} className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 animate-fade-in mt-16 md:mt-0">
          {renderPage()}
        </div>
      </main>
      {fullscreenViewData && (
        <FullscreenAnalysisView 
            items={getFullscreenItems()}
            history={history}
            selectedId={fullscreenViewData.selectedId}
            onClose={handleCloseFullscreen}
            onUpdateEntry={handleUpdateHistoryEntry}
            onNavigateItem={handleFullscreenNavigate}
            context={fullscreenViewData.context}
            onRejectPairing={handleRejectPairing}
            onDeleteFromPair={handleDeleteFromPair}
        />
      )}
    </div>
  );
}

export default App;