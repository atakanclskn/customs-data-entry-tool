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

    // 1. Break the pair into two new single documents.
    const docsToRecreate: { declaration?: DocumentInfo; freight?: DocumentInfo; }[] = [];
    if (entryToReject.declaration) docsToRecreate.push({ declaration: entryToReject.declaration });
    if (entryToReject.freight) docsToRecreate.push({ freight: entryToReject.freight });

    const newSingleEntriesPromise = Promise.all(
        docsToRecreate.map(docData => historyService.addHistoryEntry(docData, { pairingVerified: undefined }))
    );
    
    // 2. While new singles are being created, figure out where to navigate next.
    const unverifiedQueue = history.filter(h => h.pairingVerified === false && h.declaration && h.freight);
    const rejectedItemIndex = unverifiedQueue.findIndex(item => item.id === entryId);
    let nextItemId: string | null = null;
    if (rejectedItemIndex !== -1 && rejectedItemIndex + 1 < unverifiedQueue.length) {
      nextItemId = unverifiedQueue[rejectedItemIndex + 1].id;
    }
    
    // 3. Delete the old incorrect pair from the database.
    await historyService.deleteHistoryEntry(entryId);

    // 4. Await the creation of the new single entries.
    const newSingleEntries = await newSingleEntriesPromise;

    // 5. Update the main history state.
    setHistory(prev => 
        [...newSingleEntries, ...prev.filter(e => e.id !== entryId)]
        .sort((a, b) => new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime())
    );

    // 6. Navigate to the next item in the queue or close if it was the last one.
    if (nextItemId) {
      handleFullscreenNavigate(nextItemId);
    } else {
      handleCloseFullscreen();
    }
  }, [history, handleCloseFullscreen, handleFullscreenNavigate]);

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

        if (file2) {
            // Strict sequential pairing: first file is declaration, second is freight.
            newEntriesData.push({ declaration: file1, freight: file2 });
            i += 2;
        } else {
            // Last file is single. Assign it as a declaration by default.
            newEntriesData.push({ declaration: file1 });
            i += 1;
        }
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

    if (isAnalysisContext) {
        // --- Zipper/Slide Logic: Re-pair the entire tail of the sequence ---
        const analysisItems = history.filter(h => h.pairingVerified === false && h.declaration && h.freight)
            .sort((a, b) => {
                const nameA = a.declaration!.fileName;
                const nameB = b.declaration!.fileName;
                return nameA.localeCompare(nameB, 'tr', { numeric: true });
            });
        
        const originalIndex = analysisItems.findIndex(item => item.id === entryId);

        if (originalIndex !== -1) {
            const tailItems = analysisItems.slice(originalIndex);
            const docsInTail = tailItems.flatMap(entry => [entry.declaration!, entry.freight!]);
            const oldEntryIdsToDelete = tailItems.map(e => e.id);
            const docToDelete = docTypeToDelete === 'declaration' ? originalEntry.declaration! : originalEntry.freight!;
            const remainingDocsForReparing = docsInTail.filter(d => d.id !== docToDelete.id);

            await historyService.deleteMultipleHistoryEntries(oldEntryIdsToDelete);
            const singleDeletedEntry = await historyService.addHistoryEntry(
                docTypeToDelete === 'declaration' ? { declaration: docToDelete } : { freight: docToDelete },
                { pairingVerified: undefined }
            );

            const newEntriesData: { declaration?: DocumentInfo; freight?: DocumentInfo; }[] = [];
            let i = 0;
            while (i < remainingDocsForReparing.length) {
                const file1 = remainingDocsForReparing[i];
                const file2 = i + 1 < remainingDocsForReparing.length ? remainingDocsForReparing[i + 1] : null;
                if (file2) {
                    newEntriesData.push({ declaration: file1, freight: file2 });
                    i += 2;
                } else {
                    newEntriesData.push({ declaration: file1 });
                    i += 1;
                }
            }
            const newEntries = await Promise.all(newEntriesData.map(data => {
                const isSingleDoc = !data.declaration || !data.freight;
                return historyService.addHistoryEntry(data, isSingleDoc ? { pairingVerified: undefined } : { pairingVerified: false });
            }));

            setHistory(prev => {
                const oldIdsToDeleteSet = new Set(oldEntryIdsToDelete);
                const newHist = prev.filter(e => !oldIdsToDeleteSet.has(e.id));
                newHist.push(singleDeletedEntry, ...newEntries);
                return newHist.sort((a, b) => new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime());
            });

            const firstNewEntryToVerify = newEntries.find(e => e.pairingVerified === false);
            if (firstNewEntryToVerify) {
                handleFullscreenNavigate(firstNewEntryToVerify.id);
            } else {
                handleCloseFullscreen();
            }
            return;
        }
    }
    
    // --- Fallback/History Context Logic: Break pair into a single ---
    const docToKeepInfo = docTypeToDelete === 'declaration' ? originalEntry.freight : originalEntry.declaration;
    
    if (!docToKeepInfo) { // If only one doc exists, just delete the whole entry.
      await handleDeleteHistoryEntry(entryId);
      handleCloseFullscreen();
      return;
    }

    const updatedOriginalEntry = {
        ...originalEntry,
        declaration: docToKeepInfo === originalEntry.declaration ? docToKeepInfo : undefined,
        freight: docToKeepInfo === originalEntry.freight ? docToKeepInfo : undefined,
        pairingVerified: undefined, // It's now a single, unpaired document
    };
    
    await handleUpdateHistoryEntry(updatedOriginalEntry);

    if (fullscreenViewData?.selectedId === entryId) {
       handleCloseFullscreen();
    }
}, [history, fullscreenViewData, handleCloseFullscreen, handleFullscreenNavigate, handleUpdateHistoryEntry, handleDeleteHistoryEntry]);


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
      
      if (fullscreenViewData.context === 'history') {
          return history;
      }
      
      // For the 'analysis' context (verification queue), only show unverified pairs in a stable order.
      return history
          .filter(h => h.pairingVerified === false && h.declaration && h.freight)
          .sort((a, b) => {
            const nameA = a.declaration!.fileName;
            const nameB = b.declaration!.fileName;
            return nameA.localeCompare(nameB, 'tr', { numeric: true });
          });
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