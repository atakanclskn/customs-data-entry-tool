
export enum DocumentType {
  DECLARATION = 'DECLARATION',
  FREIGHT = 'FREIGHT',
}

export interface DeclarationData {
  [key: string]: string;
  // Extracted from Declaration
  'Alıcı'?: string;
  'ALICI VKN'?: string;
  'KONTEYNER NO'?: string;
  'Teslim şekli'?: string;
  'Brüt KG'?: string;
  'SON AMBAR'?: string;
  'ÖZET BEYAN NO'?: string;
  'BEYANNAME TESCİL TARİHİ'?: string;
  'TAREKS-TARIM-TSE'?: string;
  // Manual - from Freight Invoice
  'D.Ö.'?: string;
  'Nakliyeci'?: string;
  'Fat. Tarihi'?: string;
  'Tahmini Çıkış Tarihi'?: string;
  'Varış Tarihi'?: string;
  'TT'?: string;
  'Çıkış Limanı'?: string;
  'Hacim'?: string;
  'w/m navlun'?: string;
  'Navlun Fatura Tutarı'?: string;
  'Rakip EXW / FCA'?: string;
  'All in Fatura Tutarı'?: string;
  'Öykü Dönem Navlun w/m'?: string;
  'Total Fark w/m'?: string;
  'Varış Limanı'?: string;
  'HAT'?: string;
  'KAYIT TARİHİ'?: string;
}

export enum Page {
  ANALYSIS = 'ANALYSIS',
  HISTORY = 'HISTORY',
  PAIRING = 'PAIRING',
}

export type NavigateFunction = (page: Page) => void;

export interface DocumentInfo {
  id: string;
  fileName: string;
  previewDataUrl: string | null;
  fullResolutionDataUrl: string | null;
  fileType: string;
  rotation?: number; // In degrees (e.g., 0, 90, 180, 270)
  width?: number;
  height?: number;
}

export interface HistoryEntry {
  id: string; // ID for the pair/entry
  analyzedAt: string; // ISO string date
  declaration?: DocumentInfo;
  freight?: DocumentInfo;
  status: 'SUCCESS' | 'ERROR';
  data?: DeclarationData;
  error?: string;
  verified?: boolean; // For data verification
  pairingVerified?: boolean; // For pairing confirmation
}


export enum Theme {
  LIGHT = 'LIGHT',
  DARK = 'DARK',
}

export interface FileWithUrl {
  file: File;
  dataUrl: string;
}