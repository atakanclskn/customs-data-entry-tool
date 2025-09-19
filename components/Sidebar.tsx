import React from 'react';
import { Page, NavigateFunction, Theme, HistoryEntry } from '../types';
import { AnalysisIcon, HistoryIcon, XIcon, ExpandIcon, LinkIcon, ChevronsLeftIcon, ChevronsRightIcon } from './Icons';
import ThemeToggle from './ThemeToggle';

interface SidebarProps {
  currentPage: Page;
  onNavigate: NavigateFunction;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  history: HistoryEntry[];
  onOpenInFullscreen: (context: 'analysis' | 'history', selectedId: string) => void;
  isCollapsed: boolean;
  onToggle: () => void;
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  page: Page;
  currentPage: Page;
  onNavigate: NavigateFunction;
  isCollapsed: boolean;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, page, currentPage, onNavigate, isCollapsed }) => {
  const isActive = currentPage === page;
  return (
    <li className="relative" title={isCollapsed ? label : ''}>
        <button
          onClick={() => onNavigate(page)}
          className={`w-full flex items-center p-3 rounded-lg transition-all duration-200 ease-in-out ${isCollapsed ? 'justify-center' : 'space-x-4'} ${
            isActive ? 'bg-[var(--color-background)] text-accent' : 'text-text-secondary hover:text-text-primary hover:bg-[var(--color-background)]'
          }`}
        >
          <div className={`transition-colors duration-200`}>{icon}</div>
          <span className={`font-semibold ${isCollapsed ? 'hidden' : 'inline'}`}>{label}</span>
        </button>
        {isActive && (
            <div className={`absolute top-1/2 -translate-y-1/2 h-6 w-1 bg-accent rounded-r-full ${isCollapsed ? 'left-0' : 'left-0'}`}></div>
        )}
    </li>
  );
};

const Sidebar: React.FC<SidebarProps> = ({ currentPage, onNavigate, isOpen, setIsOpen, theme, onThemeChange, history, onOpenInFullscreen, isCollapsed, onToggle }) => {
  return (
    <>
      {/* Overlay for mobile */}
       <div 
        className={`fixed inset-0 bg-black/60 z-30 md:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsOpen(false)}
      ></div>

      {/* Sidebar Content */}
      <aside className={`fixed top-0 left-0 h-screen flex flex-col p-4 shadow-2xl z-40
        bg-[var(--color-background-light)]
        md:border-r md:border-[var(--color-border)]
        transition-all duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:shadow-none
        ${isCollapsed ? 'w-20' : 'w-56'}`}>
        
        <div className={`relative flex items-center ${isCollapsed ? 'justify-center' : 'justify-end'} px-2`}>
            <button onClick={() => setIsOpen(false)} className="md:hidden p-2 text-text-muted">
                <XIcon className="w-6 h-6" />
            </button>
        </div>

        <nav className="flex flex-col flex-grow mt-4">
          <ul className="space-y-2">
            <NavItem icon={<AnalysisIcon className="w-6 h-6"/>} label="Veri" page={Page.ANALYSIS} currentPage={currentPage} onNavigate={onNavigate} isCollapsed={isCollapsed} />
            <li title={isCollapsed ? "Düzenle" : ''}>
                <button
                    onClick={() => {
                        if (history.length > 0) {
                            onOpenInFullscreen('history', history[0].id);
                            setIsOpen(false);
                        }
                    }}
                    disabled={history.length === 0}
                    className={`w-full flex items-center p-3 rounded-lg transition-all duration-200 ease-in-out text-text-secondary hover:text-text-primary hover:bg-[var(--color-background)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-text-secondary ${isCollapsed ? 'justify-center' : 'space-x-4'}`}
                    title={isCollapsed ? "Düzenle" : (history.length === 0 ? "Önce bir belge yükleyin" : "En son belgeyi düzenleyicide aç")}
                >
                    <ExpandIcon className="w-6 h-6"/>
                    <span className={`font-semibold ${isCollapsed ? 'hidden' : 'inline'}`}>Düzenle</span>
                </button>
            </li>
            <NavItem icon={<HistoryIcon className="w-6 h-6"/>} label="Geçmiş" page={Page.HISTORY} currentPage={currentPage} onNavigate={onNavigate} isCollapsed={isCollapsed} />
            <NavItem icon={<LinkIcon className="w-6 h-6"/>} label="Eşleştirme" page={Page.PAIRING} currentPage={currentPage} onNavigate={onNavigate} isCollapsed={isCollapsed} />
          </ul>
          
          <div className="mt-auto">
            {/* Desktop: Combined Controls */}
            <div className="hidden md:block">
              {isCollapsed ? (
                <div className="border-t border-border flex flex-col items-center space-y-4 py-4">
                  <ThemeToggle theme={theme} onThemeChange={onThemeChange} />
                  <button 
                    onClick={onToggle} 
                    title="Menüyü Genişlet" 
                    className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-[var(--color-background)]"
                  >
                    <ChevronsRightIcon className="w-6 h-6" />
                  </button>
                </div>
              ) : (
                <div className="border-t border-border pt-2">
                   <div className="flex items-center justify-between p-3">
                        <span className="font-semibold text-text-secondary">Tema</span>
                        <ThemeToggle theme={theme} onThemeChange={onThemeChange} />
                    </div>
                    <button 
                        onClick={onToggle}
                        className="w-full flex items-center p-3 rounded-lg text-text-secondary hover:text-text-primary hover:bg-[var(--color-background)] transition-colors"
                        title="Menüyü Daralt"
                    >
                        <ChevronsLeftIcon className="w-6 h-6" />
                        <span className="font-semibold ml-4">Daralt</span>
                    </button>
                </div>
              )}
            </div>
            
            {/* Mobile: Theme Toggle Only */}
            <div className="md:hidden border-t border-border mt-2 pt-2">
                <div className="flex items-center justify-between p-3">
                    <span className="font-semibold text-text-secondary">Tema</span>
                    <ThemeToggle theme={theme} onThemeChange={onThemeChange} />
                </div>
            </div>
          </div>
        </nav>
        
      </aside>
    </>
  );
};

export default Sidebar;
