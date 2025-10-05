
import { HistoryEntry, DeclarationData, DocumentInfo } from '../types';
import { DECLARATION_FIELDS, FREIGHT_FIELDS } from '../constants';

const DB_NAME = 'AnalysisAppDB';
const DB_VERSION = 1;
const STORE_NAME = 'history';

let dbPromise: Promise<IDBDatabase> | null = null;

const getDB = (): Promise<IDBDatabase> => {
    if (dbPromise) {
        return dbPromise;
    }

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error("IndexedDB error:", request.error);
            reject("IndexedDB error: " + request.error);
        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onupgradeneeded = (event) => {
            const dbInstance = (event.target as IDBOpenDBRequest).result;
            if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
                dbInstance.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
    return dbPromise;
};

export const getHistory = async (): Promise<HistoryEntry[]> => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => {
            const sorted = (request.result as HistoryEntry[]).sort((a, b) => new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime());
            resolve(sorted);
        };
        request.onerror = () => {
            console.error('Error getting all entries from IndexedDB:', request.error);
            reject(request.error);
        };
    });
};

export const addHistoryEntry = async (
    entryData: { declaration?: DocumentInfo; freight?: DocumentInfo; },
    options?: { pairingVerified?: boolean | null }
): Promise<HistoryEntry> => {
    
    // Create an empty data object with all possible keys initialized to empty strings.
    const emptyData: DeclarationData = {};
    [...DECLARATION_FIELDS, ...FREIGHT_FIELDS].forEach(field => {
        emptyData[field] = '';
    });
    // Set a default for the radio button field
    emptyData['TAREKS-TARIM-TSE'] = 'YOK';
    // Set default value for Özet Beyan No
    emptyData['ÖZET BEYAN NO'] = 'IM';

    // Set KAYIT TARİHİ to today's date automatically
    const today = new Date();
    const formattedDate = `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth() + 1).padStart(2, '0')}.${today.getFullYear()}`;
    emptyData['KAYIT TARİHİ'] = formattedDate;


    const newEntry: HistoryEntry = {
        id: `hist_${new Date().getTime()}_${Math.random()}`,
        analyzedAt: new Date().toISOString(),
        status: 'SUCCESS',
        data: emptyData,
        // If option is null, it's a single doc for pairing, so status is undefined.
        // Otherwise, default to false (unverified pair).
        pairingVerified: options?.pairingVerified === null ? undefined : (options?.pairingVerified ?? false),
        declaration: entryData.declaration,
        freight: entryData.freight,
    };
    
    const db = await getDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put(newEntry);
    
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve(newEntry);
        transaction.onerror = () => reject(transaction.error);
    });
};


export const updateHistoryEntry = async (entry: HistoryEntry): Promise<HistoryEntry> => {
    const db = await getDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put(entry);
    
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve(entry);
        transaction.onerror = () => reject(transaction.error);
    });
};


export const deleteHistoryEntry = async (id: string): Promise<void> => {
    const db = await getDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.delete(id);

    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};

export const deleteMultipleHistoryEntries = async (ids: string[]): Promise<void> => {
    const db = await getDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    ids.forEach(id => store.delete(id));

    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};

export const clearHistory = async (): Promise<void> => {
    const db = await getDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.clear();

    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};

// Migration logic is no longer needed with the new simple flow.
export const migrateFromLocalStorage = async (): Promise<void> => {
    // This function is now a no-op but is kept to prevent breaking the initial app load sequence.
    return Promise.resolve();
};
