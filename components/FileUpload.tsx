
import React, { useState, useCallback } from 'react';
import { UploadIcon } from './Icons';

interface FileUploadProps {
  onFilesSelect: (files: File[]) => void;
  disabled: boolean;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFilesSelect, disabled }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFilesSelect(Array.from(e.target.files));
    }
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesSelect(Array.from(e.dataTransfer.files));
    }
  }, [onFilesSelect, disabled]);

  const handleDragEvent = (e: React.DragEvent<HTMLDivElement>, isEntering: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    setIsDragging(isEntering);
  }

  return (
    <div
      className={`relative w-full p-8 border-2 border-dashed rounded-xl transition-all duration-300 ${
        isDragging 
          ? 'border-accent shadow-[0_0_20px_var(--color-accent-glow)] bg-[var(--color-accent)]/10' 
          : 'border-border hover:border-accent/50 hover:bg-background-light'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      onDrop={handleDrop}
      onDragOver={(e) => handleDragEvent(e, true)}
      onDragEnter={(e) => handleDragEvent(e, true)}
      onDragLeave={(e) => handleDragEvent(e, false)}
    >
      <input
        type="file"
        id="file-upload"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        onChange={handleFileChange}
        accept="image/jpeg,image/png,image/jpg,application/pdf"
        disabled={disabled}
        multiple
      />
      <label htmlFor="file-upload" className="flex flex-col items-center justify-center text-center cursor-pointer">
        <UploadIcon className={`w-12 h-12 mb-4 transition-colors ${isDragging ? 'text-accent' : 'text-text-muted'}`} />
        <p className="text-xl font-semibold text-text-primary">Dosyaları sürükleyip bırakın</p>
        <p className="text-text-secondary">veya seçmek için tıklayın</p>
        <p className="text-xs text-text-muted mt-4">Desteklenen formatlar: JPG, PNG, PDF</p>
      </label>
    </div>
  );
};

export default FileUpload;