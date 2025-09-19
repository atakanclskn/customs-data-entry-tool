
import React from 'react';
import { NavigateFunction, Theme } from '../types';
import ThemeToggle from './ThemeToggle';

interface SettingsPageProps {
  error: string | null;
  setError: (error: string | null) => void;
  navigate: NavigateFunction;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
}


const SettingsPage: React.FC<SettingsPageProps> = ({ error, setError, theme, onThemeChange }) => {
    
  return (
    <div className="w-full">
      <div className="flex items-center mb-8">
          <h1 className="text-3xl font-bold text-text-primary">Ayarlar</h1>
      </div>

      <div className="max-w-2xl mx-auto space-y-8">

        <div className="modern-card rounded-2xl p-8">
            <h2 className="text-xl font-semibold text-accent mb-4">Görünüm</h2>
            <div className="flex items-center justify-between">
                <p className="text-text-primary font-medium">Uygulama Teması</p>
                <ThemeToggle theme={theme} onThemeChange={onThemeChange} />
            </div>
             <p className="text-sm text-text-muted mt-2">
                Uygulamanın görünümünü açık veya koyu mod arasında değiştirin.
            </p>
        </div>

      </div>
    </div>
  );
};

export default SettingsPage;
