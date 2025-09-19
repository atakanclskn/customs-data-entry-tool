
import React, { useState, useCallback } from 'react';
import FileUpload from './FileUpload';
import { DocumentInfo } from '../types';
import { SpinnerIcon } from './Icons';

interface AnalysisPageProps {
  onConfirmPairing: (files: DocumentInfo[]) => Promise<void>;
}

const createImageThumbnail = (dataUrl: string, fileType: string, maxWidth = 800, maxHeight = 800, quality = 0.7): Promise<string> => {
    return new Promise((resolve) => {
        if (!fileType.startsWith('image/')) {
            resolve(dataUrl); 
            return;
        }

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let { width, height } = img;

            if (width > height) {
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width *= maxHeight / height;
                    height = maxHeight;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                console.error('Could not get canvas context, returning original dataUrl');
                resolve(dataUrl);
                return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = (err) => {
            console.error("Failed to load image for thumbnailing, returning original dataUrl", err);
            resolve(dataUrl);
        };
        img.src = dataUrl;
    });
};

const AnalysisPage: React.FC<AnalysisPageProps> = ({ onConfirmPairing }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelection = useCallback(async (files: File[]) => {
    setIsLoading(true);
    setError(null);
    if (files.length === 0) {
        setIsLoading(false);
        return;
    }

    const processedFiles: DocumentInfo[] = [];
    for (const file of files) {
        try {
            const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = (error) => reject(error);
                reader.readAsDataURL(file);
            });
            
            let rotation = 0;
            let width = 0;
            let height = 0;

            if (file.type.startsWith('image/')) {
                const img = new Image();
                const imgLoadPromise = new Promise(resolve => { img.onload = resolve; });
                img.src = dataUrl;
                await imgLoadPromise;
                width = img.width;
                height = img.height;
                if (img.width > img.height) {
                    rotation = 90; // Assume landscape images of documents should be rotated
                }
            }

            const previewDataUrl = await createImageThumbnail(dataUrl, file.type);

            const docInfo: DocumentInfo = {
              id: `doc_${new Date().getTime()}_${Math.random()}`,
              fileName: file.name,
              previewDataUrl,
              fullResolutionDataUrl: dataUrl,
              fileType: file.type,
              rotation,
              width,
              height,
            };
            
            processedFiles.push(docInfo);
        } catch (e) {
            console.error(`Error processing file: ${file.name}`, e);
            setError(`${file.name} adlı dosya işlenirken bir hata oluştu.`);
        }
    }

    const sortedFiles = processedFiles.sort((a, b) =>
        a.fileName.localeCompare(b.fileName)
    );

    await onConfirmPairing(sortedFiles);
    setIsLoading(false);
  }, [onConfirmPairing]);

  if (isLoading) {
      return (
          <div className="w-full h-full flex flex-col items-center justify-center text-center">
              <SpinnerIcon className="w-12 h-12 text-accent mb-4" />
              <p className="text-xl font-semibold">Dosyalar işleniyor ve eşleştiriliyor...</p>
              <p className="text-text-secondary">Lütfen bekleyin.</p>
          </div>
      );
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
        <div className="w-full max-w-3xl modern-card rounded-2xl p-8">
            <h1 className="text-3xl font-bold text-center mb-2 text-text-primary">Veri Giriş Aracı</h1>
            <p className="text-md text-center text-text-secondary mb-8">Eşleştirmek ve veri girmek için beyanname ve navlun faturalarını yükleyin.</p>
            <FileUpload onFilesSelect={handleFileSelection} disabled={isLoading} />
             {error && <p className="text-[var(--color-danger)] mt-4 text-center">{error}</p>}
        </div>
    </div>
  );
};

export default AnalysisPage;
