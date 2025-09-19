
import React from 'react';
import { Theme } from '../types';
import { SunIcon, MoonIcon } from './Icons';

interface ThemeToggleProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ theme, onThemeChange }) => {
  const isDark = theme === Theme.DARK;

  const toggleTheme = () => {
    onThemeChange(isDark ? Theme.LIGHT : Theme.DARK);
  };

  return (
    <button
      onClick={toggleTheme}
      className="relative inline-flex items-center h-8 w-14 rounded-full bg-[var(--color-border)] transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--color-background-light)] focus:ring-[var(--color-accent)]"
      aria-label={isDark ? 'Açık moda geç' : 'Koyu moda geç'}
    >
      <span
        className={`absolute left-1 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-[var(--color-background-light)] shadow-md transform transition-transform duration-300 ease-in-out ${
          isDark ? 'translate-x-6' : 'translate-x-0'
        }`}
      >
        {isDark ? (
            <MoonIcon className="h-full w-full p-1 text-text-secondary" />
        ) : (
            <SunIcon className="h-full w-full p-1 text-[var(--color-warning)]" />
        )}
      </span>
    </button>
  );
};

export default ThemeToggle;