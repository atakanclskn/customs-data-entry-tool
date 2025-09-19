
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
    if (!entryToReject || (!entryToReject.declaration && !entryToReject.freight)) return;

    // This handles cases where one doc might be missing if the function is called on a single-doc entry somehow.
    const docsToRecreate = [];
    if (entryToReject.declaration) docsToRecreate.push({ declaration: entryToReject.declaration });
    if (entryToReject.freight) docsToRecreate.push({ freight: entryToReject.freight });

    // 1. Create new single entries for all documents in the rejected entry.
    const newSingleEntries = await Promise.all(
        docsToRecreate.map(docData => historyService.addHistoryEntry(docData))
    );
    
    // 2. Delete the old paired (or single) entry
    await historyService.deleteHistoryEntry(entryId);

    // 3. Update state: remove the old entry and add the new one(s)
    setHistory(prev => {
        const remaining = prev.filter(e => e.id !== entryId);
        // Sort to ensure the new items are placed correctly by date
        return [...newSingleEntries, ...remaining].sort((a, b) => new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime());
    });
    
    // If we are in the fullscreen view, and we just rejected the current item,
    // we need to navigate away from it.
    if(fullscreenViewData?.selectedId === entryId) {
       const nextItem = history.find(item => item.id !== entryId && item.pairingVerified === false && item.declaration && item.freight);
       if(nextItem) {
            handleFullscreenNavigate(nextItem.id);
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
        
        // The user explicitly placed these. Trust their choice.
        // The previous logic incorrectly tried to guess by filename.

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
    
    const handleAutoPairRemaining = useCallback(async (entriesToPair: HistoryEntry[]) => {
        const sortedEntries = [...entriesToPair].sort((a, b) => {
            const nameA = a.declaration?.fileName || a.freight?.fileName || '';
            const nameB = b.declaration?.fileName || b.freight?.fileName || '';
            return nameA.localeCompare(nameB);
        });

        const newEntriesData: { declaration: DocumentInfo, freight: DocumentInfo }[] = [];
        const idsToDelete: string[] = [];
        
        // Ensure we only loop over full pairs
        const pairableLength = sortedEntries.length - (sortedEntries.length % 2);

        for (let i = 0; i < pairableLength; i += 2) {
            const entry1 = sortedEntries[i];
            const entry2 = sortedEntries[i+1];
            const doc1 = entry1.declaration || entry1.freight!;
            const doc2 = entry2.declaration || entry2.freight!;
            
            // This is the default pairing logic from handleCreatePairsFromFiles, assuming first is declaration and second is freight after sort.
            newEntriesData.push({ declaration: doc1, freight: doc2 });
            idsToDelete.push(entry1.id, entry2.id);
        }

        if (newEntriesData.length === 0) return;

        const newEntries = await Promise.all(newEntriesData.map(data => historyService.addHistoryEntry(data)));
        await historyService.deleteMultipleHistoryEntries(idsToDelete);
        
        setHistory(prev => {
            const remaining = prev.filter(e => !idsToDelete.includes(e.id));
            return [...newEntries, ...remaining].sort((a, b) => new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime());
        });
    }, []);


  // --- Pairing Workflow Logic ---
  const handleCreatePairsFromFiles = useCallback(async (files: DocumentInfo[]) => {
    setAppError(null);
    if (files.length === 0) return;

    const newEntriesData: { declaration?: DocumentInfo; freight?: DocumentInfo; }[] = [];
    
    // Group sorted files into pairs. The first is declaration, the second is freight.
    for (let i = 0; i < files.length; i += 2) {
        const entry: { declaration?: DocumentInfo; freight?: DocumentInfo; } = {};
        entry.declaration = files[i];
        if (i + 1 < files.length) {
            entry.freight = files[i + 1];
        }
        newEntriesData.push(entry);
    }

    if (newEntriesData.length > 0) {
        const newEntries = await Promise.all(newEntriesData.map(data => historyService.addHistoryEntry(data)));
        newEntries.sort((a,b) => new Date(a.analyzedAt).getTime() - new Date(b.analyzedAt).getTime());
        setHistory(prev => [...newEntries.slice().reverse(), ...prev]);
        handleOpenFullscreen('history', newEntries[0].id);
    }
  }, [handleOpenFullscreen]);


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
                  onAutoPairRemaining={handleAutoPairRemaining}
                />;
      default:
        return null;
    }
  };

  const getFullscreenItems = () => {
      if (!fullscreenViewData) return [];
      // For history context, show everything.
      // For analysis context (initial pairing), only show unverified pairs.
      if (fullscreenViewData.context === 'history') {
          return history;
      }
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
            selectedId={fullscreenViewData.selectedId}
            onClose={handleCloseFullscreen}
            onUpdateEntry={handleUpdateHistoryEntry}
            onNavigateItem={handleFullscreenNavigate}
            context={fullscreenViewData.context}
            onRejectPairing={handleRejectPairing}
        />
      )}
    </div>
  );
}

export default App;
