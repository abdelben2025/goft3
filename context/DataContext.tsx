import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef, useMemo } from 'react';
import { Database, User, OnlineUser, AppEvent, Operation, Engagement, Paiement } from '../types';
import { supabase, saveConfiguration, resetConfiguration, isConfigured } from '../services/supabaseClient';
import { hashPassword } from '../utils/authUtils';
import { tauriDb } from '../services/tauriService';

// Key for local storage backup
const LOCAL_DB_KEY = 'goft3_local_backup';
const PENDING_ACTIONS_KEY = 'goft3_pending_actions';

interface PendingAction {
    id: string; // Unique ID for the action
    type: 'ADD' | 'UPDATE' | 'DELETE' | 'DELETE_OP';
    table: keyof Database | 'T_OPERATION_CASCADE'; // Special case for cascading delete
    payload: any;
    timestamp: number;
    tempId?: number; // Used for identifying locally created items to update them later or exclude IDs
}

export type RefreshStatus = {
    ok: boolean;
    source: 'supabase' | 'local' | 'backup' | 'none';
    mirrored: boolean;
    errors?: string[];
};

interface DataContextType {
    db: Database;
    loading: boolean;
    isInitialLoad: boolean;
    isDbConfigured: boolean;
    onlineUsers: OnlineUser[];
    recentEvents: AppEvent[];
    isOnline: boolean; // New: Connection status
    isLocalDbConnected: boolean; // Local SQLite (goft3_local.db) reachable?
    pendingActionsCount: number; // New: Number of unsynced actions
    refreshData: () => Promise<RefreshStatus>;
    addItem: <T extends { [key: string]: any }>(tableName: keyof Database, item: Omit<T, keyof T & `ID_${string}`>) => Promise<any>;
    updateItem: <T extends { [key: string]: any }>(tableName: keyof Database, id: number, item: T) => Promise<any>;
    deleteItem: (tableName: keyof Database, id: number) => Promise<any>;
    deleteOperation: (id: number) => Promise<any>;
    resetDatabase: () => Promise<void>;
    importDatabase: (data: Database) => Promise<void>;
    runInTransaction: (callback: () => Promise<void>) => Promise<void>;
    joinPresence: (user: User) => void;
    leavePresence: () => void;
    broadcastEvent: (actionType: AppEvent['actionType'], description: string) => void;
    saveConfig: (url: string, key: string) => void;
    resetConfig: () => void;
    connectionError: string | null;
    integrityIssues: {
        brokenPieces: { piece: any; error: string; id_piece: number; id_operation: number }[];
        brokenEngagements: { engagement: any; error: string; id_engagement: number; id_piece: number; id_operation: number }[];
        brokenPaiements: { paiement: any; error: string; id_paiement: number; id_piece: number; id_operation: number }[];
    } | null;
}

const emptyDb: Database = {
    T_USER: [], T_BENEFICIAIRE: [], T_CATEGORIE: [], T_CP: [], T_DIRECTION: [], T_ENGAGEMENT: [],
    T_LOT_OPERATION: [], T_LOT_PIECE: [], T_ODS: [], T_OPERATION: [], T_PAIEMENT: [],
    T_PIECE: [], T_PROGRAMME: [], T_RUBRIQUE: [], T_RUBRIQUE_OP: [], T_SCATEGORIE: [],
    T_SCATEGORIE_OP: [], T_SPROGRAMME: [], T_COMPTE_BANCAIRE: [],
    T_BORDEREAU: [],
};

const DataContext = createContext<DataContextType | undefined>(undefined);

const TABLE_ID_FIELDS: { [key: string]: string } = {
    T_USER: 'ID_USER', T_BENEFICIAIRE: 'ID_BENEFICIAIRE', T_CATEGORIE: 'ID_CATEGORIE', T_CP: 'ID_CP', 
    T_DIRECTION: 'ID_DIRECTION', T_ENGAGEMENT: 'ID_ENGAGEMENT', T_LOT_OPERATION: 'ID_LOT', 
    T_LOT_PIECE: 'ID_LOT_PIECE', T_ODS: 'ID_ODS', T_OPERATION: 'ID_OPERATION', T_PAIEMENT: 'ID_PAIEMENT', 
    T_PIECE: 'ID_PIECE', T_PROGRAMME: 'ID_PROGRAMME', T_RUBRIQUE: 'ID_RUBRIQUE', T_RUBRIQUE_OP: 'ID_RUBRIQUE_OP', 
    T_SCATEGORIE: 'ID_SCATEGORIE', T_SCATEGORIE_OP: 'ID_SCATEGORIE_OP', T_SPROGRAMME: 'ID_SPROGRAMME',
    T_COMPTE_BANCAIRE: 'ID_COMPTE', T_BORDEREAU: 'ID_BORDEREAU',
};

const TABLE_AR_NAMES: { [key: string]: string } = {
    T_USER: 'مستخدم', T_BENEFICIAIRE: 'مستفيد', T_CATEGORIE: 'صنف', T_CP: 'اعتماد دفع', 
    T_DIRECTION: 'مديرية', T_ENGAGEMENT: 'التزام', T_LOT_OPERATION: 'حصة', 
    T_LOT_PIECE: 'رابط حصة', T_ODS: 'أمر خدمة', T_OPERATION: 'عملية', T_PAIEMENT: 'دفع', 
    T_PIECE: 'وثيقة', T_PROGRAMME: 'برنامج', T_RUBRIQUE: 'هيكلة كلفة', T_RUBRIQUE_OP: 'هيكلة عملية', 
    T_SCATEGORIE: 'صنف فرعي', T_SCATEGORIE_OP: 'صنف فرعي لعملية', T_SPROGRAMME: 'برنامج فرعي',
    T_COMPTE_BANCAIRE: 'حساب بنكي', T_BORDEREAU: 'جدول إرسال',
};

// Column projections: only fetch the columns used by the app (see types.ts)
// to reduce payload size. Every field below exists in the corresponding type,
// so no accessed property will be missing.
const TABLE_COLUMNS: { [key: string]: string } = {
    T_USER: 'ID_USER, USERNAME, PASSWORD, ROLE, ALLOWED_PAGES, ALLOWED_OPERATIONS',
    T_BENEFICIAIRE: 'ID_BENEFICIAIRE, BENEFICIAIRE, ADRESSE, RC, CODE_FISCALE',
    T_CATEGORIE: 'ID_CATEGORIE, C_CATEGORIE, INT_CATEGORIE',
    T_CP: 'ID_CP, ID_OPERATION, ANNEE, MONTANT_INITIALE_CP, MONTANT_FINALE_CP',
    T_DIRECTION: 'ID_DIRECTION, PORTEFEUILLE, INT_PORTEFEUILLE, ORDONATEUR, DIRECTION, ACTION, INT_ACTION, SACTION, INT_SACTION',
    T_ENGAGEMENT: 'ID_ENGAGEMENT, ID_OPERATION, ID_PIECE, ID_BORDEREAU, N_ENG, ANNEE, NATURE_ENG, OBJET_ENG, MONTANT_ENG, AE_ENG, TOTAL_ENG_ANTERIEURE, SOLDE_ANTERIEURE, SOLDE_RELIQUAT, DATE_ENG, N_VISA_CB, DATE_VISA_CB, BORD_OBJET, BORD_DOCS, BORD_COPIES',
    T_LOT_OPERATION: 'ID_LOT, ID_OPERATION, N_LOT, INTITULE_LOT, MONTANT_INITIALE_LOT, MONTANT_FINALE_LOT, ATTRIBUER',
    T_LOT_PIECE: 'ID_LOT_PIECE, ID_LOT, ID_PIECE, DELAI_EX_JOURS',
    T_ODS: 'ID_ODS, OBJET_ODS, NATURE_ODS, DATE_ODS, ID_PIECE, ID_LOT',
    T_OPERATION: 'ID_OPERATION, N_OPERATION, N_OPERATION_ANCIEN, INT_OPERATION, ID_CATEGORIE, ID_SCATEGORIE, status, TYPE_OP, CREATED_BY',
    T_PAIEMENT: 'ID_PAIEMENT, ID_OPERATION, ID_ENG, ID_PIECE, N_PAI, ANNEE, DATE_PAI, OBJET_PAI, MONTANT_PAI, TOTAL_PAI, N_MANDAT, DATE_MANDAT, DATE_ADMIS, MONTANT_TRAVAUX_REALISES, AVANCE_FORFAITAIRE, AVANCE_APPROVISIONNEMENT, RETENUE_GARANTIE, PENALITE_RETARD, AUTRE_DEDUCTION, REMBOURSEMENT_AVANCE_FORFAITAIRE, REMBOURSEMENT_AVANCE_APPROVISIONNEMENT',
    T_PIECE: 'ID_PIECE, NAT_PIECE, ID_PIECE_INIT, ID_OPERATION, PIECE, ID_BENEFICIAIRE, ID_COMPTE, MONTANT_PIECE, ID_SCATEGORIE, ID_RUBRIQUE, DELAI_EX_JOURS, SAI_ENG, SAI_PAI, N_VISA_CM, DATE_VISA_CM, CAUTION, TYPE_CAUTION, DATE_OD_PIECE, N_OD_PIECE, DATE_DEPOT_PIECE, BORDEREAU_PIECE',
    T_PROGRAMME: 'ID_PROGRAMME, PROGRAMME, INT_PROGRAMME',
    T_RUBRIQUE: 'ID_RUBRIQUE, RUBRIQUE',
    T_RUBRIQUE_OP: 'ID_RUBRIQUE_OP, ID_OPERATION, ID_RUBRIQUE, MONTANT_INITIALE, MONTANT_FINALE',
    T_SCATEGORIE: 'ID_SCATEGORIE, ID_CATEGORIE, C_SCATEGORIE, INT_SCATEGORIE',
    T_SCATEGORIE_OP: 'ID_SCATEGORIE_OP, ID_OPERATION, ID_SCATEGORIE, MONTANT_INITIALE, MONTANT_FINALE',
    T_SPROGRAMME: 'ID_SPROGRAMME, ID_PROGRAMME, SPROGRAMME, INT_SPROGRAMME',
    T_COMPTE_BANCAIRE: 'ID_COMPTE, ID_BENEFICIAIRE, RIB, BANQUE',
    T_BORDEREAU: 'ID_BORDEREAU, ID_PIECE, N_BORDEREAU, ANNEE, DATE_BORDEREAU, DESTINATAIRE, DOCUMENTS_JOINTS, COPIES_NOTE',
};

const isNetworkError = (error: any): boolean => {
    if (!error) return false;
    const msg = (error.message || '').toLowerCase();
    const code = error.code;
    return (
        error instanceof TypeError ||
        msg.includes('fetch') ||
        msg.includes('network') ||
        msg.includes('timeout') ||
        msg.includes('cors') ||
        msg.includes('failed to reach') ||
        msg.includes('unreachable') ||
        code === 'PGRST000' || 
        error.status === 0 ||
        error.status === 502 ||
        error.status === 503 ||
        error.status === 504
    );
};

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // 1. Core State (Light tables)
    const [dbMetadata, setDbMetadata] = useState<Partial<Database>>({});
    // 2. Heavy State (Separate for better reactivity)
    const [operations, setOperations] = useState<Operation[]>([]);
    const [engagements, setEngagements] = useState<Engagement[]>([]);
    const [paiements, setPaiements] = useState<Paiement[]>([]);
    
    // Derived full DB for compatibility
    const db = useMemo(() => ({
        ...emptyDb,
        ...dbMetadata,
        T_OPERATION: operations,
        T_ENGAGEMENT: engagements,
        T_PAIEMENT: paiements,
    } as Database), [dbMetadata, operations, engagements, paiements]);

    useEffect(() => {
        dbRef.current = db;
    }, [db]);

    const [integrityIssues, setIntegrityIssues] = useState<{
        brokenPieces: { piece: any; error: string; id_piece: number; id_operation: number }[];
        brokenEngagements: { engagement: any; error: string; id_engagement: number; id_piece: number; id_operation: number }[];
        brokenPaiements: { paiement: any; error: string; id_paiement: number; id_piece: number; id_operation: number }[];
    } | null>(null);

    const autoHealIdsTried = useRef<{
        T_ENGAGEMENT: Set<number>;
        T_PAIEMENT: Set<number>;
        T_PIECE: Set<number>;
    }>({
        T_ENGAGEMENT: new Set<number>(),
        T_PAIEMENT: new Set<number>(),
        T_PIECE: new Set<number>()
    });

    const validateDatabaseIntegrity = useCallback((targetDb: Database) => {
        const issues = {
            brokenPieces: [] as { piece: any; error: string; id_piece: number; id_operation: number }[],
            brokenEngagements: [] as { engagement: any; error: string; id_engagement: number; id_piece: number; id_operation: number }[],
            brokenPaiements: [] as { paiement: any; error: string; id_paiement: number; id_piece: number; id_operation: number }[],
        };

        const ops = targetDb.T_OPERATION || [];
        const pieces = targetDb.T_PIECE || [];
        const engs = targetDb.T_ENGAGEMENT || [];
        const pais = targetDb.T_PAIEMENT || [];
        const scats = targetDb.T_SCATEGORIE || [];
        const rubrics = targetDb.T_RUBRIQUE || [];

        // 1. Check Pieces (T_PIECE)
        if (ops.length > 0) {
            pieces.forEach(p => {
                const opExists = ops.some(op => Number(op.ID_OPERATION) === Number(p.ID_OPERATION));
                if (!opExists) {
                    const errMsg = `الوثيقة "${p.PIECE}" (ID: ${p.ID_PIECE}) ترتبط بعملية غير موجودة (ID_OPERATION: ${p.ID_OPERATION})`;
                    console.warn(`[Data Integrity - Foreign Key Broken] ${errMsg}`);
                    issues.brokenPieces.push({
                        piece: p,
                        error: errMsg,
                        id_piece: Number(p.ID_PIECE),
                        id_operation: Number(p.ID_OPERATION)
                    });
                }

                if (p.ID_SCATEGORIE && scats.length > 0) {
                    const scatExists = scats.some(sc => Number(sc.ID_SCATEGORIE) === Number(p.ID_SCATEGORIE));
                    if (!scatExists) {
                        const errMsg = `الوثيقة "${p.PIECE}" (ID: ${p.ID_PIECE}) ترتبط بصنف فرعي غير موجود (ID_SCATEGORIE: ${p.ID_SCATEGORIE})`;
                        console.warn(`[Data Integrity - Foreign Key Broken] ${errMsg}`);
                        issues.brokenPieces.push({
                            piece: p,
                            error: errMsg,
                            id_piece: Number(p.ID_PIECE),
                            id_operation: Number(p.ID_OPERATION)
                        });
                    }
                }

                if (p.ID_RUBRIQUE && rubrics.length > 0) {
                    const rubExists = rubrics.some(rub => Number(rub.ID_RUBRIQUE) === Number(p.ID_RUBRIQUE));
                    if (!rubExists) {
                        const errMsg = `الوثيقة "${p.PIECE}" (ID: ${p.ID_PIECE}) ترتبط بتفصيل هيكلة غير موجود (ID_RUBRIQUE: ${p.ID_RUBRIQUE})`;
                        console.warn(`[Data Integrity - Foreign Key Broken] ${errMsg}`);
                        issues.brokenPieces.push({
                            piece: p,
                            error: errMsg,
                            id_piece: Number(p.ID_PIECE),
                            id_operation: Number(p.ID_OPERATION)
                        });
                    }
                }
            });
        }

        // 2. Check Engagements (T_ENGAGEMENT)
        if (pieces.length > 0 && ops.length > 0) {
            engs.forEach(e => {
                const pExists = pieces.some(p => Number(p.ID_PIECE) === Number(e.ID_PIECE));
                if (!pExists) {
                    const errMsg = `الالتزام رقم "${e.N_ENG}" (ID: ${e.ID_ENGAGEMENT}) يرتبط بوثيقة غير موجودة (ID_PIECE: ${e.ID_PIECE})`;
                    console.warn(`[Data Integrity - Foreign Key Broken] ${errMsg}`);
                    issues.brokenEngagements.push({
                        engagement: e,
                        error: errMsg,
                        id_engagement: Number(e.ID_ENGAGEMENT),
                        id_piece: Number(e.ID_PIECE),
                        id_operation: Number(e.ID_OPERATION)
                    });
                }

                const opExists = ops.some(op => Number(op.ID_OPERATION) === Number(e.ID_OPERATION));
                if (!opExists) {
                    const errMsg = `الالتزام رقم "${e.N_ENG}" (ID: ${e.ID_ENGAGEMENT}) يرتبط بعملية غير موجودة (ID_OPERATION: ${e.ID_OPERATION})`;
                    console.warn(`[Data Integrity - Foreign Key Broken] ${errMsg}`);
                    issues.brokenEngagements.push({
                        engagement: e,
                        error: errMsg,
                        id_engagement: Number(e.ID_ENGAGEMENT),
                        id_piece: Number(e.ID_PIECE),
                        id_operation: Number(e.ID_OPERATION)
                    });
                }
            });
        }

        // 3. Check Paiements (T_PAIEMENT)
        if (pieces.length > 0 && ops.length > 0) {
            pais.forEach(pai => {
                const pExists = pieces.some(p => Number(p.ID_PIECE) === Number(pai.ID_PIECE));
                if (!pExists) {
                    const errMsg = `الدفع رقم "${pai.N_PAI}" (ID: ${pai.ID_PAIEMENT}) يرتبط بوثيقة غير موجودة (ID_PIECE: ${pai.ID_PIECE})`;
                    console.warn(`[Data Integrity - Foreign Key Broken] ${errMsg}`);
                    issues.brokenPaiements.push({
                        paiement: pai,
                        error: errMsg,
                        id_paiement: Number(pai.ID_PAIEMENT),
                        id_piece: Number(pai.ID_PIECE),
                        id_operation: Number(pai.ID_OPERATION)
                    });
                }

                const opExists = ops.some(op => Number(op.ID_OPERATION) === Number(pai.ID_OPERATION));
                if (!opExists) {
                    const errMsg = `الدفع رقم "${pai.N_PAI}" (ID: ${pai.ID_PAIEMENT}) يرتبط بعملية غير موجودة (ID_OPERATION: ${pai.ID_OPERATION})`;
                    console.warn(`[Data Integrity - Foreign Key Broken] ${errMsg}`);
                    issues.brokenPaiements.push({
                        paiement: pai,
                        error: errMsg,
                        id_paiement: Number(pai.ID_PAIEMENT),
                        id_piece: Number(pai.ID_PIECE),
                        id_operation: Number(pai.ID_OPERATION)
                    });
                }
            });
        }

        setIntegrityIssues(prev => {
            const hasNoIssues = issues.brokenPieces.length === 0 && 
                               issues.brokenEngagements.length === 0 && 
                               issues.brokenPaiements.length === 0;
            
            if (!prev) {
                if (hasNoIssues) {
                    return null;
                }
                return issues;
            }
            
            if (hasNoIssues) {
                return null;
            }
            
            const piecesEqual = prev.brokenPieces.length === issues.brokenPieces.length &&
                prev.brokenPieces.every((p, i) => p.id_piece === issues.brokenPieces[i].id_piece);
            const engsEqual = prev.brokenEngagements.length === issues.brokenEngagements.length &&
                prev.brokenEngagements.every((e, i) => e.id_engagement === issues.brokenEngagements[i].id_engagement);
            const paisEqual = prev.brokenPaiements.length === issues.brokenPaiements.length &&
                prev.brokenPaiements.every((p, i) => p.id_paiement === issues.brokenPaiements[i].id_paiement);

            if (piecesEqual && engsEqual && paisEqual) {
                return prev;
            }
            return issues;
        });
        return issues;
    }, []);


    const [loading, setLoading] = useState<boolean>(true);
    const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);
    const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
    const [isLocalDbConnected, setIsLocalDbConnected] = useState<boolean>(() => tauriDb.isAvailable());
    const [recentEvents, setRecentEvents] = useState<AppEvent[]>([]);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
    
    // Action Queue
    const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);

    const presenceChannelRef = useRef<any | null>(null);
    const presenceStatusRef = useRef<string>('CLOSED');
    const eventChannelRef = useRef<any | null>(null);
    const dbChangesChannelRef = useRef<any | null>(null);
    const currentUserRef = useRef<User | null>(null);
    const knownPresenceRef = useRef<Map<string | number, OnlineUser>>(new Map());
    const isBatchMode = useRef(false);
    const syncInProgress = useRef(false);
    const dbRef = useRef<Database | null>(null);
    const storageModeRef = useRef<'supabase' | 'local' | 'none'>('none');

    const applyDbToState = useCallback((loadedDb: Database) => {
        setOperations(loadedDb.T_OPERATION || []);
        setEngagements(loadedDb.T_ENGAGEMENT || []);
        setPaiements(loadedDb.T_PAIEMENT || []);

        const metadata = { ...loadedDb };
        delete (metadata as any).T_OPERATION;
        delete (metadata as any).T_ENGAGEMENT;
        delete (metadata as any).T_PAIEMENT;
        setDbMetadata(metadata);
    }, []);

    const mirrorDbToSqlite = useCallback(async (data: Database): Promise<boolean> => {
        if (!tauriDb.isAvailable()) return false;
        try {
            const count = await tauriDb.importDatabase(data);
            console.log(`SQLite mirror OK: ${count} rows written to goft3_local.db`);
            setIsLocalDbConnected(true);
            return true;
        } catch (e) {
            console.error('SQLite mirror failed:', e);
            setIsLocalDbConnected(false);
            return false;
        }
    }, []);

    // Immediate write-through to local SQLite (keeps offline DB identical to cloud)
    const mirrorUpsertToSqlite = useCallback(async (table: keyof Database, item: any) => {
        if (!tauriDb.isAvailable() || !item) return;
        try {
            await tauriDb.upsertItem(table, item);
        } catch (e) {
            console.warn(`SQLite mirror upsert failed for ${table}:`, e);
        }
    }, []);

    const mirrorDeleteFromSqlite = useCallback(async (table: keyof Database, id: number) => {
        if (!tauriDb.isAvailable()) return;
        try {
            const idField = TABLE_ID_FIELDS[table];
            await tauriDb.deleteItem(table, idField, id);
        } catch (e) {
            console.warn(`SQLite mirror delete failed for ${table}:`, e);
        }
    }, []);

    const addLocalItem = useCallback((table: keyof Database, item: any) => {
        if (table === 'T_OPERATION') setOperations(prev => {
            if (prev.some(x => x.ID_OPERATION === item.ID_OPERATION)) return prev;
            return [...prev, item];
        });
        else if (table === 'T_ENGAGEMENT') setEngagements(prev => {
            if (prev.some(x => x.ID_ENGAGEMENT === item.ID_ENGAGEMENT)) return prev;
            return [...prev, item];
        });
        else if (table === 'T_PAIEMENT') setPaiements(prev => {
            if (prev.some(x => x.ID_PAIEMENT === item.ID_PAIEMENT)) return prev;
            return [...prev, item];
        });
        else setDbMetadata(prev => {
            const list = (prev[table] || []) as any[];
            const idField = TABLE_ID_FIELDS[table];
            if (list.some(x => x[idField] === item[idField])) return prev;
            return { ...prev, [table]: [...list, item] };
        });
    }, []);

    const updateLocalItem = useCallback((table: keyof Database, id: number, updatedFields: any) => {
        const idField = TABLE_ID_FIELDS[table];
        if (table === 'T_OPERATION') {
            setOperations(prev => prev.map(x => x.ID_OPERATION === id ? { ...x, ...updatedFields } : x));
        } else if (table === 'T_ENGAGEMENT') {
            setEngagements(prev => prev.map(x => x.ID_ENGAGEMENT === id ? { ...x, ...updatedFields } : x));
        } else if (table === 'T_PAIEMENT') {
            setPaiements(prev => prev.map(x => x.ID_PAIEMENT === id ? { ...x, ...updatedFields } : x));
        } else {
            setDbMetadata(prev => {
                const list = (prev[table] || []) as any[];
                return {
                    ...prev,
                    [table]: list.map(x => x[idField] === id ? { ...x, ...updatedFields } : x)
                };
            });
        }
    }, []);

    const deleteLocalItem = useCallback((table: keyof Database, id: number, reorderedPaiements?: any[]) => {
        const idField = TABLE_ID_FIELDS[table];
        if (table === 'T_OPERATION') {
            setOperations(prev => prev.filter(x => x.ID_OPERATION !== id));
        } else if (table === 'T_ENGAGEMENT') {
            setEngagements(prev => prev.filter(x => x.ID_ENGAGEMENT !== id));
        } else if (table === 'T_PAIEMENT') {
            setPaiements(prev => {
                if (reorderedPaiements) return reorderedPaiements;
                return prev.filter(x => x.ID_PAIEMENT !== id);
            });
        } else {
            setDbMetadata(prev => {
                const list = (prev[table] || []) as any[];
                return {
                    ...prev,
                    [table]: list.filter(x => x[idField] !== id)
                };
            });
        }
    }, []);

    // Load Backup Helper
    const loadFromBackup = useCallback(() => {
        const backup = localStorage.getItem(LOCAL_DB_KEY);
        if (backup) {
            try {
                const parsedDb = JSON.parse(backup) as Database;
                
                // Update Split States
                setOperations(parsedDb.T_OPERATION || []);
                setEngagements(parsedDb.T_ENGAGEMENT || []);
                setPaiements(parsedDb.T_PAIEMENT || []);
                
                const metadata = { ...parsedDb };
                delete (metadata as any).T_OPERATION;
                delete (metadata as any).T_ENGAGEMENT;
                delete (metadata as any).T_PAIEMENT;
                setDbMetadata(metadata);
                
                console.log("Loaded data from local backup.");
                return true;
            } catch (e) {
                console.error("Failed to load backup", e);
                return false;
            }
        }
        return false;
    }, []);

    // Save Backup Helper
    const saveToBackup = useCallback((data: Database) => {
        try {
            localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(data));
        } catch (e) {
            console.error("Failed to save local backup (quota exceeded?)", e);
        }
    }, []);

    const refreshData = useCallback(async (opts?: { silent?: boolean }) => {
        const sb = supabase;
        const trySupabase = Boolean(sb) && isOnline;

        // ── Priority 1: Supabase (cloud) when configured and online ──
        if (trySupabase && sb) {
            const fetchAllRows = async (table: string) => {
                let allData: any[] = [];
                let from = 0;
                const limit = 1000;
                let hasMore = true;
                const idField = TABLE_ID_FIELDS[table];

                while (hasMore) {
                    const cols = TABLE_COLUMNS[table];
                    let query = sb.from(table).select(cols || '*').range(from, from + limit - 1);
                    if (idField) {
                        query = query.order(idField, { ascending: true });
                    }
                    let { data, error } = await query;

                    // If the projection references columns missing from the live DB
                    // schema, fall back to selecting all columns for this page.
                    if (error && cols && cols !== '*') {
                        console.warn(`Column projection failed for ${table}; falling back to all columns.`, error);
                        let fallback = sb.from(table).select('*').range(from, from + limit - 1);
                        if (idField) {
                            fallback = fallback.order(idField, { ascending: true });
                        }
                        ({ data, error } = await fallback);
                    }

                    if (error) {
                        return { data: null, error };
                    }
                    if (data && data.length > 0) {
                        allData = [...allData, ...data];
                        if (data.length < limit) {
                            hasMore = false;
                        } else {
                            from += limit;
                        }
                    } else {
                        hasMore = false;
                    }
                }
                return { data: allData, error: null };
            };

            let refreshStatus: RefreshStatus = { ok: false, source: 'supabase', mirrored: false };

            try {
                if (!opts?.silent) setLoading(true);
                setConnectionError(null);

                const results = await Promise.all(Object.keys(emptyDb).map(table =>
                    fetchAllRows(table)
                ));

                const newDb = { ...emptyDb };
                const errors: string[] = [];

                results.forEach((res, index) => {
                    const table = Object.keys(emptyDb)[index];
                    if (res.error) {
                        console.error(`Error fetching ${table}:`, res.error);
                        errors.push(table);
                    } else {
                        (newDb as any)[table] = res.data;
                    }
                });

                if (errors.length > 0) {
                    setConnectionError(`خطأ في تحميل بعض الجداول: ${errors.map(e => TABLE_AR_NAMES[e] || e).join(', ')}`);
                    if (isInitialLoad) {
                        if (tauriDb.isAvailable()) {
                            try {
                                const localDb = await tauriDb.getDatabase();
                                applyDbToState(localDb);
                                storageModeRef.current = 'local';
                            } catch {
                                loadFromBackup();
                            }
                        } else {
                            loadFromBackup();
                        }
                    } else if (tauriDb.isAvailable()) {
                        // Partial cloud success: keep local rows for failed tables,
                        // then mirror everything so goft3_local.db stays current.
                        try {
                            const localDb = await tauriDb.getDatabase();
                            for (const t of errors) {
                                (newDb as any)[t] = (localDb as any)[t] || [];
                            }
                        } catch { /* keep empty tables */ }
                        applyDbToState(newDb);
                        storageModeRef.current = 'supabase';
                        const mirrored = await mirrorDbToSqlite(newDb);
                        refreshStatus = { ok: false, source: 'supabase', mirrored, errors };
                    }
                } else {
                    const repairedPieces = newDb.T_PIECE.map(piece => {
                        const pieceEngs = newDb.T_ENGAGEMENT
                            .filter(e => Number(e.ID_PIECE) === piece.ID_PIECE)
                            .sort((a, b) => b.ID_ENGAGEMENT - a.ID_ENGAGEMENT);

                        const latestEng = pieceEngs[0];
                        const hasEffectiveEng = latestEng ? (latestEng as any).NATURE_ENG !== 'سحب' : false;
                        const hasPai = newDb.T_PAIEMENT.some(p => Number(p.ID_PIECE) === piece.ID_PIECE);
                        const needsUpdate = piece.SAI_ENG !== hasEffectiveEng || piece.SAI_PAI !== hasPai;

                        if (needsUpdate) {
                            (async () => {
                                try {
                                    await sb.from('T_PIECE')
                                        .update({ SAI_ENG: hasEffectiveEng, SAI_PAI: hasPai } as any)
                                        .eq('ID_PIECE', piece.ID_PIECE);
                                } catch (err: any) {
                                    console.error(`Error repairing piece ${piece.ID_PIECE} in DB:`, err);
                                }
                            })();
                            return { ...piece, SAI_ENG: hasEffectiveEng, SAI_PAI: hasPai };
                        }
                        return piece;
                    });

                    newDb.T_PIECE = repairedPieces;
                    applyDbToState(newDb);
                    saveToBackup(newDb);
                    storageModeRef.current = 'supabase';
                    validateDatabaseIntegrity(newDb);

                    // Keep the local SQLite mirror in sync whenever Supabase succeeds
                    // (awaited so post-login login flow guarantees goft3_local.db is fresh)
                    const mirrored = tauriDb.isAvailable() ? await mirrorDbToSqlite(newDb) : false;
                    refreshStatus = { ok: true, source: 'supabase', mirrored };
                }
            } catch (e) {
                console.error("Supabase fetch failed, falling back to local storage", e);
                setConnectionError("تعذر الاتصال بالخادم السحابي. جاري التحويل إلى القاعدة المحلية...");
                refreshStatus = { ok: false, source: 'local', mirrored: false };
                if (tauriDb.isAvailable()) {
                    try {
                        const localDb = await tauriDb.getDatabase();
                        applyDbToState(localDb);
                        storageModeRef.current = 'local';
                        setIsLocalDbConnected(true);
                        setLoading(false);
                        setIsInitialLoad(false);
                        return refreshStatus;
                    } catch (localErr) {
                        console.error("Local SQLite fallback failed", localErr);
                        setIsLocalDbConnected(false);
                    }
                }
                if (isInitialLoad) loadFromBackup();
            } finally {
                setLoading(false);
                setIsInitialLoad(false);
            }
            return refreshStatus;
        }

        // ── Priority 2: Local SQLite (Tauri) when offline or Supabase not configured ──
        if (tauriDb.isAvailable()) {
            try {
                if (!opts?.silent) setLoading(true);
                setConnectionError(null);
                const loadedDb = await tauriDb.getDatabase();
                applyDbToState(loadedDb);
                validateDatabaseIntegrity(loadedDb);
                storageModeRef.current = 'local';
                setIsLocalDbConnected(true);
                setLoading(false);
                setIsInitialLoad(false);
                return { ok: true, source: 'local' as const, mirrored: false };
            } catch (err: any) {
                console.error("Tauri getDatabase failed", err);
                setIsLocalDbConnected(false);
                setConnectionError(err.message || 'Tauri database error');
            }
        }

        // ── Priority 3: localStorage backup (web without Tauri) ──
        if (!sb) {
            storageModeRef.current = 'none';
            setLoading(false);
            setIsInitialLoad(false);
            return { ok: false, source: 'none' as const, mirrored: false };
        }

        // Supabase configured but offline and no local SQLite
        try {
            setConnectionError("لا يوجد اتصال بالإنترنت. جاري التحميل من النسخة الاحتياطية المحلية...");
            loadFromBackup();
        } finally {
            setLoading(false);
            setIsInitialLoad(false);
        }
        return { ok: false, source: 'backup' as const, mirrored: false };
    }, [isInitialLoad, saveToBackup, loadFromBackup, applyDbToState, mirrorDbToSqlite, isOnline]);


    const syncData = useCallback(async () => {
        const sb = supabase;
        if (syncInProgress.current || !sb) return;
        syncInProgress.current = true;

        try {
        // 1. Process Pending Actions
        if (pendingActions.length > 0) {
            console.log(`Syncing ${pendingActions.length} pending actions...`);
            let actionsProcessed = 0;
            const newActions = [...pendingActions];

            for (const action of pendingActions) {
                try {
                    if (action.type === 'ADD') {
                        // Remove temp ID before sending to Supabase
                        const idField = TABLE_ID_FIELDS[action.table as keyof Database];
                        const { [idField]: _tempId, ...payload } = action.payload;
                        
                        const result = await sb.from(action.table as string).insert(payload).select();
                        if (result.error) throw result.error;

                        const serverItem = result.data ? result.data[0] : null;
                        if (serverItem && action.tempId) {
                            const newId = serverItem[idField];
                            const tempId = action.tempId;

                            // Cascading ID replacement (only foreign-key ID_* fields) in subsequent pending actions
                            newActions.forEach(act => {
                                if (act.type === 'ADD' || act.type === 'UPDATE') {
                                    // 1. Primary key
                                    if (act.payload[idField] === tempId) {
                                        act.payload[idField] = newId;
                                    }
                                    // 2. Foreign keys only (avoid corrupting amounts/numbers that happen to equal tempId)
                                    Object.keys(act.payload).forEach(key => {
                                        if (key.startsWith('ID_') && act.payload[key] === tempId) {
                                            act.payload[key] = newId;
                                        }
                                    });
                                }
                            });
                        }
                    } else if (action.type === 'UPDATE') {
                        const idField = TABLE_ID_FIELDS[action.table as keyof Database];
                        const idValue = action.payload[idField];
                        
                        // Strip the primary key field from update payload to avoid Supabase primary key update errors
                        const { [idField]: _, ...updatePayload } = action.payload;
                        
                        const result = await sb.from(action.table as string).update(updatePayload).eq(idField, idValue);
                        if (result.error) throw result.error;
                    } else if (action.type === 'DELETE') {
                        const idField = TABLE_ID_FIELDS[action.table as keyof Database];
                        const result = await sb.from(action.table as string).delete().eq(idField, action.payload.id);
                        if (result.error) throw result.error;
                    } else if (action.type === 'DELETE_OP') {
                        const result = await sb.from('T_OPERATION').delete().eq('ID_OPERATION', action.payload.id);
                        if (result.error) throw result.error;
                    }
                    
                    // Remove executed action
                    newActions.shift(); 
                    actionsProcessed++;
                } catch (e: any) {
                    console.error("Sync failed for action:", action, e);
                    if (isNetworkError(e)) {
                        setIsOnline(false);
                        setConnectionError("تعذر الاتصال بالسيرفر أثناء المزامنة. سيتم المحاولة لاحقاً عند استعادة الاتصال.");
                        // Stop syncing on connection error to preserve order
                        break; 
                    } else {
                        // Permanent database error - discard to prevent blocking the queue forever
                        console.error("Permanent database error during sync. Discarding action to prevent queue blockage:", action, e);
                        newActions.shift();
                        actionsProcessed++;
                    }
                }
            }
            setPendingActions(newActions);
            if (actionsProcessed > 0) {
                console.log(`Successfully synced ${actionsProcessed} actions.`);
            }
        }

        // 2. Fetch fresh data
        await refreshData();
        } finally {
            syncInProgress.current = false;
        }
    }, [supabase, pendingActions, refreshData]);

    // Initial Load: hydrate from local/cache first, then refresh cloud in background
    useEffect(() => {
        let cancelled = false;
        const bootstrap = async () => {
            try {
                if (tauriDb.isAvailable()) {
                    const loadedDb = await tauriDb.getDatabase();
                    if (cancelled) return;
                    applyDbToState(loadedDb);
                    validateDatabaseIntegrity(loadedDb);
                    storageModeRef.current = 'local';
                    setIsLocalDbConnected(true);
                } else {
                    const backup = localStorage.getItem(LOCAL_DB_KEY);
                    if (backup) {
                        try {
                            const parsed = JSON.parse(backup);
                            if (cancelled) return;
                            applyDbToState(parsed);
                        } catch (e) {
                            console.error("Failed to parse local backup", e);
                        }
                    }
                }
            } catch (e) {
                console.error("Local cache hydration failed", e);
            } finally {
                if (!cancelled) {
                    setLoading(false);
                    refreshData({ silent: true });
                }
            }
        };
        bootstrap();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Initialize Pending Actions from Local Storage
    useEffect(() => {
        const storedActions = localStorage.getItem(PENDING_ACTIONS_KEY);
        if (storedActions) {
            try {
                setPendingActions(JSON.parse(storedActions));
            } catch (e) {
                console.error("Failed to parse pending actions", e);
            }
        }
    }, []);

    // Save Pending Actions to Local Storage whenever they change
    useEffect(() => {
        localStorage.setItem(PENDING_ACTIONS_KEY, JSON.stringify(pendingActions));
    }, [pendingActions]);

    // Handle Online/Offline Status
    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            setConnectionError(null);
            console.log("App is Online - Syncing with Supabase...");
            syncData();
        };
        const handleOffline = () => {
            setIsOnline(false);
            setConnectionError("لا يوجد اتصال بالإنترنت. جاري التحويل التلقائي إلى القاعدة المحلية (SQLite).");
            // Snapshot the latest cloud state into local SQLite before working offline
            if (tauriDb.isAvailable() && dbRef.current && storageModeRef.current === 'supabase') {
                mirrorDbToSqlite(dbRef.current);
            }
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [syncData, mirrorDbToSqlite]);

    // Automatically trigger Sync when transitioning online or when pending actions are loaded on mount
    useEffect(() => {
        if (isOnline && pendingActions.length > 0 && !loading && !isInitialLoad) {
            console.log("Auto-trigger sync: App is online with pending actions.");
            syncData();
        }
    }, [isOnline, pendingActions.length, loading, isInitialLoad, syncData]);

    // Periodic check to retry syncing if online (e.g. recovering from network dropout)
    useEffect(() => {
        if (!isOnline || pendingActions.length === 0) return;

        const interval = setInterval(() => {
            console.log("Periodic sync: retry check...");
            syncData();
        }, 15000); // Check every 15 seconds

        return () => clearInterval(interval);
    }, [isOnline, pendingActions.length, syncData]);



    // Realtime subscriptions
    useEffect(() => {
        if (supabase && isOnline && !dbChangesChannelRef.current) {
            const channel = supabase
                .channel('schema-db-changes')
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public' },
                    (payload: any) => {
                        if (!isOnline) return;
                        
                        const tableName = (payload.table as string).toUpperCase() as keyof Database;
                        const eventType = payload.eventType;
                        
                        if (isBatchMode.current) return;
                        
                        const idField = TABLE_ID_FIELDS[tableName];
                        if (!idField) return;

                        if (eventType === 'INSERT') {
                            const newRecord = payload.new;
                            if (tableName === 'T_OPERATION') {
                                setOperations(prev => {
                                    if (prev.some(x => (x as any)[idField] === newRecord[idField])) return prev;
                                    return [...prev, newRecord as any];
                                });
                            } else if (tableName === 'T_ENGAGEMENT') {
                                setEngagements(prev => {
                                    if (prev.some(x => (x as any)[idField] === newRecord[idField])) return prev;
                                    return [...prev, newRecord as any];
                                });
                            } else if (tableName === 'T_PAIEMENT') {
                                setPaiements(prev => {
                                    if (prev.some(x => (x as any)[idField] === newRecord[idField])) return prev;
                                    return [...prev, newRecord as any];
                                });
                            } else {
                                setDbMetadata(prev => {
                                    const list = (prev[tableName] || []) as any[];
                                    if (list.some(x => (x as any)[idField] === newRecord[idField])) return prev;
                                    return {
                                        ...prev,
                                        [tableName]: [...list, newRecord]
                                    };
                                });
                            }
                            // Immediate local SQLite mirror for realtime inserts (from other users)
                            mirrorUpsertToSqlite(tableName, newRecord);
                        } else if (eventType === 'UPDATE') {
                            const updatedRecord = payload.new;
                            if (tableName === 'T_OPERATION') {
                                setOperations(prev => prev.map(x => (x as any)[idField] === updatedRecord[idField] ? { ...x, ...updatedRecord } : x));
                            } else if (tableName === 'T_ENGAGEMENT') {
                                setEngagements(prev => prev.map(x => (x as any)[idField] === updatedRecord[idField] ? { ...x, ...updatedRecord } : x));
                            } else if (tableName === 'T_PAIEMENT') {
                                setPaiements(prev => prev.map(x => (x as any)[idField] === updatedRecord[idField] ? { ...x, ...updatedRecord } : x));
                            } else {
                                setDbMetadata(prev => {
                                    const list = (prev[tableName] || []) as any[];
                                    return {
                                        ...prev,
                                        [tableName]: list.map(x => (x as any)[idField] === updatedRecord[idField] ? { ...x, ...updatedRecord } : x)
                                    };
                                });
                            }
                            // Immediate local SQLite mirror for realtime updates
                            mirrorUpsertToSqlite(tableName, updatedRecord);
                        } else if (eventType === 'DELETE') {
                            const oldRecord = payload.old;
                            if (tableName === 'T_OPERATION') {
                                setOperations(prev => prev.filter(x => (x as any)[idField] !== oldRecord[idField]));
                            } else if (tableName === 'T_ENGAGEMENT') {
                                setEngagements(prev => prev.filter(x => (x as any)[idField] !== oldRecord[idField]));
                            } else if (tableName === 'T_PAIEMENT') {
                                setPaiements(prev => prev.filter(x => (x as any)[idField] !== oldRecord[idField]));
                            } else {
                                setDbMetadata(prev => {
                                    const list = (prev[tableName] || []) as any[];
                                    return {
                                        ...prev,
                                        [tableName]: list.filter(x => (x as any)[idField] !== oldRecord[idField])
                                    };
                                });
                            }
                            // Immediate local SQLite mirror for realtime deletes
                            if (oldRecord[idField] != null) {
                                mirrorDeleteFromSqlite(tableName, Number(oldRecord[idField]));
                            }
                        }
                    }
                )
                .subscribe();
            dbChangesChannelRef.current = channel;
        }
        return () => {
            if (dbChangesChannelRef.current) {
                dbChangesChannelRef.current.unsubscribe();
                dbChangesChannelRef.current = null;
            }
        };
    }, [isOnline]);

    const broadcastEvent = useCallback((actionType: AppEvent['actionType'], description: string, detail?: string) => {
        if (!currentUserRef.current) return;

        const event: AppEvent = {
            id: Math.random().toString(36).substr(2, 9),
            username: currentUserRef.current.USERNAME,
            actionType,
            description: detail ? `${description} (${detail})` : description,
            timestamp: new Date().toISOString()
        };

        // Update local state immediately (works offline too) so the sender sees the toast
        setRecentEvents(prev => {
            if (prev.some(e => e.id === event.id)) return prev;
            return [event, ...prev].slice(0, 10);
        });

        // Broadcast to other users only when online
        if (eventChannelRef.current && isOnline) {
            eventChannelRef.current.send({
                type: 'broadcast',
                event: 'app-activity',
                payload: event
            }).catch(() => {});
        }
    }, [isOnline]);

    const ensurePresenceChannel = useCallback(() => {
        if (!supabase || !isOnline) return null;
        if (presenceChannelRef.current) return presenceChannelRef.current;

        const channel = supabase.channel('online-users', {
            config: { presence: { key: `watcher-${Math.random().toString(36).slice(2)}` } },
        });

        channel.on('presence', { event: 'sync' }, () => {
            const state = channel.presenceState();
            const users: OnlineUser[] = [];
            for (const key in state) {
                for (const presence of (state[key] as any[])) {
                    if (presence && presence.user_id && !presence.probe) {
                        users.push({
                            userId: presence.user_id,
                            username: presence.username,
                            role: presence.role,
                            onlineAt: presence.online_at
                        });
                    }
                }
            }
            const uniqueUsers = Array.from(new Map(users.map(u => [u.userId, u])).values());
            setOnlineUsers(uniqueUsers);

            // Notify who connected / disconnected (skip self)
            const selfId = currentUserRef.current?.ID_USER;
            const prevIds = new Set(knownPresenceRef.current.keys());
            const currIds = new Set(uniqueUsers.map(u => u.userId));
            uniqueUsers.forEach(u => {
                if (!prevIds.has(u.userId) && u.userId !== selfId) {
                    const ev: AppEvent = {
                        id: Math.random().toString(36).substr(2, 9),
                        username: u.username,
                        actionType: 'login',
                        description: 'دخل إلى النظام',
                        timestamp: new Date().toISOString()
                    };
                    setRecentEvents(prev => [ev, ...prev].slice(0, 10));
                }
            });
            knownPresenceRef.current.forEach(u => {
                if (!currIds.has(u.userId) && u.userId !== selfId) {
                    const ev: AppEvent = {
                        id: Math.random().toString(36).substr(2, 9),
                        username: u.username,
                        actionType: 'logout',
                        description: 'غادر النظام',
                        timestamp: new Date().toISOString()
                    };
                    setRecentEvents(prev => [ev, ...prev].slice(0, 10));
                }
            });
            knownPresenceRef.current = new Map(uniqueUsers.map(u => [u.userId, u]));
        }).subscribe((status) => {
            presenceStatusRef.current = status;
            if (status === 'SUBSCRIBED') {
                const user = currentUserRef.current;
                if (user) {
                    channel.track({
                        user_id: user.ID_USER,
                        username: user.USERNAME,
                        role: user.ROLE,
                        online_at: new Date().toISOString(),
                    }).catch(() => {});
                } else {
                    channel.track({ probe: true, online_at: new Date().toISOString() }).catch(() => {});
                }
            }
        });
        presenceChannelRef.current = channel;
        return channel;
    }, [isOnline]);

    useEffect(() => {
        if (isOnline && supabase) {
            ensurePresenceChannel();
        }
    }, [isOnline, ensurePresenceChannel]);

    const joinPresence = useCallback((user: User) => {
        currentUserRef.current = user;
        if (!supabase || !isOnline) return;

        const channel = ensurePresenceChannel();
        if (channel && presenceStatusRef.current === 'SUBSCRIBED') {
            channel.track({
                user_id: user.ID_USER,
                username: user.USERNAME,
                role: user.ROLE,
                online_at: new Date().toISOString(),
            }).catch(() => {});
        }

        if (!eventChannelRef.current) {
            const evChannel = supabase.channel('app-events');
            evChannel.on('broadcast', { event: 'app-activity' }, ({ payload }) => {
                setRecentEvents(prev => [payload as AppEvent, ...prev].slice(0, 10));
            }).subscribe();
            eventChannelRef.current = evChannel;
        }
    }, [isOnline, ensurePresenceChannel]);

    const leavePresence = useCallback(async () => {
        currentUserRef.current = null;
        if (presenceChannelRef.current) {
            try {
                await presenceChannelRef.current.untrack();
            } catch {
                // ignore: channel already closed
            }
        }
        if (eventChannelRef.current) {
            await eventChannelRef.current.unsubscribe();
            eventChannelRef.current = null;
        }
    }, []);

    const runInTransaction = async (callback: () => Promise<void>) => {
        isBatchMode.current = true;
        setLoading(true);
        try {
            await callback();
        } catch (e) {
            console.error("Batch operation failed:", e);
            throw e;
        } finally {
            isBatchMode.current = false;
            // Only refresh if online, otherwise the local updates in callback should stick
            if (isOnline) await refreshData(); 
            else setLoading(false);
        }
    };

    const saveOfflineAddItem = useCallback(async (tableName: keyof Database, _item: any, tempId: number, newItem: any) => {
        // 1. Update Local State
        addLocalItem(tableName, newItem);
        
        // 2. Queue Action
        const action: PendingAction = {
            id: Math.random().toString(36).substr(2, 9),
            type: 'ADD',
            table: tableName,
            payload: newItem, // Contains tempId, removed during sync
            timestamp: Date.now(),
            tempId: tempId
        };

        // Local state updates for related pieces (Offline)
        if (tableName === 'T_ENGAGEMENT' && (newItem as any).ID_PIECE) {
            const pieceId = (newItem as any).ID_PIECE;
            const isWithdrawn = (newItem as any).NATURE_ENG === 'سحب';
            setDbMetadata(prev => {
                const T_PIECE = (prev.T_PIECE || []).map(p => p.ID_PIECE === pieceId ? { ...p, SAI_ENG: !isWithdrawn } : p);
                return { ...prev, T_PIECE };
            });
        } else if (tableName === 'T_PAIEMENT' && (newItem as any).ID_PIECE) {
            const pieceId = (newItem as any).ID_PIECE;
            setDbMetadata(prev => {
                const T_PIECE = (prev.T_PIECE || []).map(p => p.ID_PIECE === pieceId ? { ...p, SAI_PAI: true } : p);
                return { ...prev, T_PIECE };
            });
        }

        setPendingActions(prev => [...prev, action]);
        
        return newItem;
    }, [addLocalItem]);

    const saveOfflineUpdateItem = useCallback(async (tableName: keyof Database, id: number, item: any) => {
        const idField = TABLE_ID_FIELDS[tableName];
        updateLocalItem(tableName, id, item);

        // Local state updates for related pieces (Offline)
        if (tableName === 'T_ENGAGEMENT' && item.ID_PIECE) {
            const pieceId = item.ID_PIECE;
            const isWithdrawn = (item as any).NATURE_ENG === 'سحب';
            setDbMetadata(prev => {
                const T_PIECE = (prev.T_PIECE || []).map(p => p.ID_PIECE === pieceId ? { ...p, SAI_ENG: !isWithdrawn } : p);
                return { ...prev, T_PIECE };
            });
        } else if (tableName === 'T_PAIEMENT' && item.ID_PIECE) {
            const pieceId = item.ID_PIECE;
            setDbMetadata(prev => {
                const T_PIECE = (prev.T_PIECE || []).map(p => p.ID_PIECE === pieceId ? { ...p, SAI_PAI: true } : p);
                return { ...prev, T_PIECE };
            });
        }

        const action: PendingAction = {
            id: Math.random().toString(36).substr(2, 9),
            type: 'UPDATE',
            table: tableName,
            payload: { ...item, [idField]: id },
            timestamp: Date.now()
        };
        setPendingActions(prev => [...prev, action]);
        return item;
    }, [updateLocalItem]);

    const saveOfflineDeleteItem = useCallback(async (tableName: keyof Database, id: number) => {
        const idField = TABLE_ID_FIELDS[tableName];
        let reorderedPaiements: any[] | null = null;
        if (tableName === 'T_PAIEMENT') {
            const itemToDelete = (db.T_PAIEMENT || []).find(p => Number(p.ID_PAIEMENT) === Number(id));
            if (itemToDelete) {
                const opId = itemToDelete.ID_OPERATION;
                const year = itemToDelete.ANNEE;
                const sameContextPaiements = db.T_PAIEMENT
                    .filter(p => Number(p.ID_OPERATION) === Number(opId) && p.ANNEE === year && Number(p.ID_PAIEMENT) !== Number(id))
                    .sort((a, b) => (parseInt(a.N_PAI, 10) || 0) - (parseInt(b.N_PAI, 10) || 0));

                const updatedInContext: Paiement[] = [];
                for (let i = 0; i < sameContextPaiements.length; i++) {
                    const p = sameContextPaiements[i];
                    const newNPai = (i + 1).toString().padStart(2, '0');
                    updatedInContext.push({ ...p, N_PAI: newNPai });
                }

                reorderedPaiements = (db.T_PAIEMENT || [])
                    .filter(p => Number(p.ID_PAIEMENT) !== Number(id))
                    .map(p => {
                        const updated = updatedInContext.find(u => Number(u.ID_PAIEMENT) === Number(p.ID_PAIEMENT));
                        return updated || p;
                    });
            }
        }

        deleteLocalItem(tableName, id, reorderedPaiements || undefined);

        // Local state updates for related pieces (Offline)
        if (tableName === 'T_ENGAGEMENT' || tableName === 'T_PAIEMENT') {
            const itemToDelete = (db[tableName] as any[]).find((row: any) => row[idField] === id);
            if (itemToDelete && itemToDelete.ID_PIECE) {
                const pieceId = itemToDelete.ID_PIECE;
                if (tableName === 'T_ENGAGEMENT') {
                    const remaining = db.T_ENGAGEMENT.filter(e => e.ID_PIECE === pieceId && e.ID_ENGAGEMENT !== id)
                        .sort((a, b) => b.ID_ENGAGEMENT - a.ID_ENGAGEMENT);
                    const latest = remaining[0];
                    const effectivelyEngaged = latest ? (latest as any).NATURE_ENG !== 'سحب' : false;
                    const updatedPieces = db.T_PIECE.map(p => p.ID_PIECE === pieceId ? { ...p, SAI_ENG: effectivelyEngaged } : p);
                    setDbMetadata(prev => ({ ...prev, T_PIECE: updatedPieces }));
                } else {
                    const others = db.T_PAIEMENT.filter(p => p.ID_PIECE === pieceId && p.ID_PAIEMENT !== id);
                    if (others.length === 0) {
                        const updatedPieces = db.T_PIECE.map(p => p.ID_PIECE === pieceId ? { ...p, SAI_PAI: false } : p);
                        setDbMetadata(prev => ({ ...prev, T_PIECE: updatedPieces }));
                    }
                }
            }
        }

        const action: PendingAction = {
            id: Math.random().toString(36).substr(2, 9),
            type: 'DELETE',
            table: tableName,
            payload: { id },
            timestamp: Date.now()
        };
        setPendingActions(prev => [...prev, action]);
        return { message: 'Item deleted locally' };
    }, [db, deleteLocalItem]);

    const saveOfflineDeleteOperation = useCallback(async (id: number) => {
        const newOps = db.T_OPERATION.filter(op => op.ID_OPERATION !== id);
        setOperations(newOps);

        const action: PendingAction = {
            id: Math.random().toString(36).substr(2, 9),
            type: 'DELETE_OP',
            table: 'T_OPERATION_CASCADE' as any,
            payload: { id },
            timestamp: Date.now()
        };
        setPendingActions(prev => [...prev, action]);
        return { message: 'Operation deleted locally' };
    }, [db]);

    const enqueueForSupabaseSync = useCallback((type: PendingAction['type'], table: keyof Database | string, payload: any, tempId?: number) => {
        if (!supabase) return;
        const action: PendingAction = {
            id: Math.random().toString(36).substr(2, 9),
            type,
            table: table as keyof Database,
            payload,
            timestamp: Date.now(),
            tempId,
        };
        setPendingActions(prev => [...prev, action]);
    }, []);

    // Offline SQLite write path: persist locally + queue for Supabase sync when configured
    const addItemViaSqlite = useCallback(async (tableName: keyof Database, item: any) => {
        const idField = TABLE_ID_FIELDS[tableName];
        const newId = await tauriDb.addItem(tableName, item);
        const fullItem = { ...item, [idField]: newId };

        if (tableName === 'T_ENGAGEMENT' && fullItem.ID_PIECE) {
            const isWithdrawn = fullItem.NATURE_ENG === 'سحب';
            await tauriDb.updateItem('T_PIECE', 'ID_PIECE', fullItem.ID_PIECE, { SAI_ENG: !isWithdrawn });
            setDbMetadata(prev => ({
                ...prev,
                T_PIECE: (prev.T_PIECE || []).map(p => p.ID_PIECE === fullItem.ID_PIECE ? { ...p, SAI_ENG: !isWithdrawn } : p)
            }));
        } else if (tableName === 'T_PAIEMENT' && fullItem.ID_PIECE) {
            await tauriDb.updateItem('T_PIECE', 'ID_PIECE', fullItem.ID_PIECE, { SAI_PAI: true });
            setDbMetadata(prev => ({
                ...prev,
                T_PIECE: (prev.T_PIECE || []).map(p => p.ID_PIECE === fullItem.ID_PIECE ? { ...p, SAI_PAI: true } : p)
            }));
        }

        addLocalItem(tableName, fullItem);

        // Queue for later Supabase sync so offline work is not lost
        if (supabase) {
            enqueueForSupabaseSync('ADD', tableName, fullItem, newId);
        }

        const itemDetail = fullItem.PIECE || fullItem.BENEFICIAIRE || fullItem.INT_OPERATION || fullItem.USERNAME || fullItem.N_ENG || '';
        broadcastEvent('add', `${TABLE_AR_NAMES[tableName] || tableName}`, itemDetail);
        return fullItem;
    }, [addLocalItem, enqueueForSupabaseSync, broadcastEvent]);

    const addItem = async <T extends { [key: string]: any }>(tableName: keyof Database, item: Omit<T, keyof T & `ID_${string}`>) => {
        const idField = TABLE_ID_FIELDS[tableName];
        const tempId = -Date.now() - Math.floor(Math.random() * 1000);
        const newItem = { ...item, [idField]: tempId } as T;

        // ── Priority 1: Supabase when configured AND online ──
        if (supabase && isOnline) {
            let insertPayload = { ...item };
            if (tableName === 'T_PIECE') {
                const allowedKeys = [
                    'NAT_PIECE', 'ID_PIECE_INIT', 'ID_OPERATION', 'PIECE',
                    'ID_BENEFICIAIRE', 'ID_COMPTE', 'MONTANT_PIECE', 'ID_SCATEGORIE', 'ID_RUBRIQUE',
                    'DELAI_EX_JOURS', 'SAI_ENG', 'SAI_PAI', 'N_VISA_CM', 'DATE_VISA_CM', 'CAUTION', 'TYPE_CAUTION',
                    'DATE_OD_PIECE', 'N_OD_PIECE', 'DATE_DEPOT_PIECE', 'BORDEREAU_PIECE'
                ];
                insertPayload = Object.keys(insertPayload).reduce((acc: any, key) => {
                    if (allowedKeys.includes(key)) {
                        acc[key] = (insertPayload as any)[key];
                    }
                    return acc;
                }, {});
            }
            try {
                let result = await supabase.from(tableName as string).insert(insertPayload as any).select();
                if (result.error) {
                    if (result.error.code === 'PGRST204' && result.error.message.includes('CREATED_BY') && 'CREATED_BY' in item) {
                        const { CREATED_BY: _cb, ...rest } = item as any;
                        result = await supabase.from(tableName as string).insert(rest as any).select();
                    }
                }
                if (result.error) throw result.error;

                const serverItem = result.data ? result.data[0] : null;

                if (serverItem) {
                    if (tableName === 'T_ENGAGEMENT' && serverItem.ID_PIECE) {
                        const isWithdrawn = (serverItem as any).NATURE_ENG === 'سحب';
                        await supabase.from('T_PIECE').update({ SAI_ENG: !isWithdrawn } as any).eq('ID_PIECE', serverItem.ID_PIECE);
                        setDbMetadata(prev => ({
                            ...prev,
                            T_PIECE: (prev.T_PIECE || []).map(p => p.ID_PIECE === serverItem.ID_PIECE ? { ...p, SAI_ENG: !isWithdrawn } : p)
                        }));
                        // Immediate local mirror of the piece flag
                        const pieceRow = (dbRef.current?.T_PIECE || []).find(p => Number(p.ID_PIECE) === Number(serverItem.ID_PIECE));
                        if (pieceRow) {
                            await mirrorUpsertToSqlite('T_PIECE', { ...pieceRow, SAI_ENG: !isWithdrawn });
                        }
                    } else if (tableName === 'T_PAIEMENT' && serverItem.ID_PIECE) {
                        await supabase.from('T_PIECE').update({ SAI_PAI: true } as any).eq('ID_PIECE', serverItem.ID_PIECE);
                        setDbMetadata(prev => ({
                            ...prev,
                            T_PIECE: (prev.T_PIECE || []).map(p => p.ID_PIECE === serverItem.ID_PIECE ? { ...p, SAI_PAI: true } : p)
                        }));
                        const pieceRow = (dbRef.current?.T_PIECE || []).find(p => Number(p.ID_PIECE) === Number(serverItem.ID_PIECE));
                        if (pieceRow) {
                            await mirrorUpsertToSqlite('T_PIECE', { ...pieceRow, SAI_PAI: true });
                        }
                    }
                }

                // Immediate write-through to local SQLite so offline login/data stay current
                if (serverItem) {
                    await mirrorUpsertToSqlite(tableName, serverItem);
                }

                if (!isBatchMode.current && serverItem) {
                    addLocalItem(tableName, serverItem);
                    const itemDetail = (item as any).PIECE || (item as any).BENEFICIAIRE || (item as any).INT_OPERATION || (item as any).USERNAME || (item as any).N_ENG || '';
                    broadcastEvent('add', `${TABLE_AR_NAMES[tableName] || tableName}`, itemDetail);
                }
                return serverItem;
            } catch (err: any) {
                if (isNetworkError(err)) {
                    console.warn("Network error during addItem, falling back to local SQLite:", err);
                    setIsOnline(false);
                    setConnectionError("تعذر الاتصال بالسيرفر. تم الحفظ محلياً وسيتم مزامنتها تلقائياً عند استعادة الاتصال.");
                } else {
                    console.error("Supabase addItem failed, falling back to local storage:", err);
                }
                if (tauriDb.isAvailable()) {
                    return await addItemViaSqlite(tableName, item);
                }
                if (supabase) {
                    return await saveOfflineAddItem(tableName, item, tempId, newItem);
                }
                throw err;
            }
        }

        // ── Priority 2: Local SQLite when offline or Supabase not configured ──
        if (tauriDb.isAvailable()) {
            try {
                return await addItemViaSqlite(tableName, item);
            } catch (err: any) {
                console.error("Tauri addItem error:", err);
                throw err;
            }
        }

        // ── Priority 3: Web offline queue ──
        if (!supabase) throw new Error("قاعدة البيانات غير مهيأة. يرجى الاتصال بالإنترنت أول مرة لإعداد القاعدة.");
        return await saveOfflineAddItem(tableName, item, tempId, newItem);
    };

    const updateItemViaSqlite = useCallback(async (tableName: keyof Database, id: number, item: any) => {
        const idField = TABLE_ID_FIELDS[tableName];
        await tauriDb.updateItem(tableName, idField, id, item);

        if (tableName === 'T_ENGAGEMENT' && item.ID_PIECE) {
            const isWithdrawn = item.NATURE_ENG === 'سحب';
            await tauriDb.updateItem('T_PIECE', 'ID_PIECE', item.ID_PIECE, { SAI_ENG: !isWithdrawn });
            setDbMetadata(prev => ({
                ...prev,
                T_PIECE: (prev.T_PIECE || []).map(p => p.ID_PIECE === item.ID_PIECE ? { ...p, SAI_ENG: !isWithdrawn } : p)
            }));
        } else if (tableName === 'T_PAIEMENT' && item.ID_PIECE) {
            await tauriDb.updateItem('T_PIECE', 'ID_PIECE', item.ID_PIECE, { SAI_PAI: true });
            setDbMetadata(prev => ({
                ...prev,
                T_PIECE: (prev.T_PIECE || []).map(p => p.ID_PIECE === item.ID_PIECE ? { ...p, SAI_PAI: true } : p)
            }));
        }

        updateLocalItem(tableName, id, item);

        if (supabase) {
            enqueueForSupabaseSync('UPDATE', tableName, { ...item, [idField]: id });
        }

        const itemDetail = item.PIECE || item.BENEFICIAIRE || item.INT_OPERATION || item.USERNAME || item.N_ENG || '';
        broadcastEvent('update', `${TABLE_AR_NAMES[tableName] || tableName}`, itemDetail);
        return item;
    }, [updateLocalItem, enqueueForSupabaseSync, broadcastEvent]);

    const updateItem = async <T extends { [key: string]: any }>(tableName: keyof Database, id: number, item: T) => {
        const idField = TABLE_ID_FIELDS[tableName];

        // ── Priority 1: Supabase when configured AND online ──
        if (supabase && isOnline) {
            let updatePayload = { ...item };
            delete (updatePayload as any)[idField];

            if (tableName === 'T_PIECE') {
                const allowedKeys = [
                    'NAT_PIECE', 'ID_PIECE_INIT', 'ID_OPERATION', 'PIECE',
                    'ID_BENEFICIAIRE', 'ID_COMPTE', 'MONTANT_PIECE', 'ID_SCATEGORIE', 'ID_RUBRIQUE',
                    'DELAI_EX_JOURS', 'SAI_ENG', 'SAI_PAI', 'N_VISA_CM', 'DATE_VISA_CM', 'CAUTION', 'TYPE_CAUTION',
                    'DATE_OD_PIECE', 'N_OD_PIECE', 'DATE_DEPOT_PIECE', 'BORDEREAU_PIECE'
                ];
                updatePayload = Object.keys(updatePayload).reduce((acc: any, key) => {
                    if (allowedKeys.includes(key)) {
                        acc[key] = (updatePayload as any)[key];
                    }
                    return acc;
                }, {});
            }
            try {
                const { error } = await supabase.from(tableName as string).update(updatePayload as any).eq(idField, id);
                if (error) throw error;

                if (tableName === 'T_ENGAGEMENT' && item.ID_PIECE) {
                    const isWithdrawn = (item as any).NATURE_ENG === 'سحب';
                    await supabase.from('T_PIECE').update({ SAI_ENG: !isWithdrawn } as any).eq('ID_PIECE', item.ID_PIECE);
                    setDbMetadata(prev => ({
                        ...prev,
                        T_PIECE: (prev.T_PIECE || []).map(p => p.ID_PIECE === item.ID_PIECE ? { ...p, SAI_ENG: !isWithdrawn } : p)
                    }));
                    const pieceRow = (dbRef.current?.T_PIECE || []).find(p => Number(p.ID_PIECE) === Number(item.ID_PIECE));
                    if (pieceRow) {
                        await mirrorUpsertToSqlite('T_PIECE', { ...pieceRow, SAI_ENG: !isWithdrawn });
                    }
                } else if (tableName === 'T_PAIEMENT' && item.ID_PIECE) {
                    await supabase.from('T_PIECE').update({ SAI_PAI: true } as any).eq('ID_PIECE', item.ID_PIECE);
                    setDbMetadata(prev => ({
                        ...prev,
                        T_PIECE: (prev.T_PIECE || []).map(p => p.ID_PIECE === item.ID_PIECE ? { ...p, SAI_PAI: true } : p)
                    }));
                    const pieceRow = (dbRef.current?.T_PIECE || []).find(p => Number(p.ID_PIECE) === Number(item.ID_PIECE));
                    if (pieceRow) {
                        await mirrorUpsertToSqlite('T_PIECE', { ...pieceRow, SAI_PAI: true });
                    }
                }

                if (!isBatchMode.current) {
                    updateLocalItem(tableName, id, item);
                    const itemDetail = (item as any).PIECE || (item as any).BENEFICIAIRE || (item as any).INT_OPERATION || (item as any).USERNAME || (item as any).N_ENG || '';
                    broadcastEvent('update', `${TABLE_AR_NAMES[tableName] || tableName}`, itemDetail);
                }

                // Immediate write-through to local SQLite (full row with PK for reliable offline login)
                await mirrorUpsertToSqlite(tableName, { ...item, [idField]: id });
                return item;
            } catch (err: any) {
                if (isNetworkError(err)) {
                    console.warn("Network error during updateItem, falling back to local SQLite:", err);
                    setIsOnline(false);
                    setConnectionError("تعذر الاتصال بالسيرفر. تم التعديل محلياً وسيتم مزامنتها تلقائياً عند استعادة الاتصال.");
                } else {
                    console.error("Supabase updateItem failed, falling back to local storage:", err);
                }
                if (tauriDb.isAvailable()) {
                    return await updateItemViaSqlite(tableName, id, item);
                }
                if (supabase) {
                    return await saveOfflineUpdateItem(tableName, id, item);
                }
                throw err;
            }
        }

        // ── Priority 2: Local SQLite when offline or Supabase not configured ──
        if (tauriDb.isAvailable()) {
            try {
                return await updateItemViaSqlite(tableName, id, item);
            } catch (err: any) {
                console.error("Tauri updateItem error:", err);
                throw err;
            }
        }

        // ── Priority 3: Web offline queue ──
        if (!supabase) throw new Error("قاعدة البيانات غير مهيأة. يرجى الاتصال بالإنترنت أول مرة لإعداد القاعدة.");
        return await saveOfflineUpdateItem(tableName, id, item);
    };

    const deleteItemViaSqlite = async (tableName: keyof Database, id: number) => {
        try {
            const idField = TABLE_ID_FIELDS[tableName];
            await tauriDb.deleteItem(tableName, idField, id);

            let reorderedPaiements: Paiement[] | null = null;

            // Reset Piece status flags on deletion
            if (tableName === 'T_ENGAGEMENT' || tableName === 'T_PAIEMENT') {
                const itemToDelete = (db[tableName] as any[]).find((row: any) => row[idField] === id);
                if (itemToDelete && itemToDelete.ID_PIECE) {
                    const pieceId = itemToDelete.ID_PIECE;

                    if (tableName === 'T_ENGAGEMENT') {
                        // Recalculate SAI_ENG based on remaining engagements
                        const remaining = db.T_ENGAGEMENT.filter(e => e.ID_PIECE === pieceId && e.ID_ENGAGEMENT !== id)
                            .sort((a, b) => b.ID_ENGAGEMENT - a.ID_ENGAGEMENT);
                        const latest = remaining[0];
                        const effectivelyEngaged = latest ? (latest as any).NATURE_ENG !== 'سحب' : false;
                        await tauriDb.updateItem('T_PIECE', 'ID_PIECE', pieceId, { SAI_ENG: effectivelyEngaged });

                        // Update local state
                        setDbMetadata(prev => ({
                            ...prev,
                            T_PIECE: (prev.T_PIECE || []).map(p => p.ID_PIECE === pieceId ? { ...p, SAI_ENG: effectivelyEngaged } : p)
                        }));
                    } else {
                        // Simple existence for SAI_PAI
                        const others = db.T_PAIEMENT.filter(p => p.ID_PIECE === pieceId && p.ID_PAIEMENT !== id);
                        const effectivelyPaid = others.length > 0;
                        await tauriDb.updateItem('T_PIECE', 'ID_PIECE', pieceId, { SAI_PAI: effectivelyPaid });

                        // Update local state for piece status
                        setDbMetadata(prev => ({
                            ...prev,
                            T_PIECE: (prev.T_PIECE || []).map(p => p.ID_PIECE === pieceId ? { ...p, SAI_PAI: effectivelyPaid } : p)
                        }));

                        // Re-order payments for SAME Operation and SAME Year
                        const opId = itemToDelete.ID_OPERATION;
                        const year = itemToDelete.ANNEE;

                        const sameContextPaiements = db.T_PAIEMENT
                            .filter(p => Number(p.ID_OPERATION) === Number(opId) && p.ANNEE === year && Number(p.ID_PAIEMENT) !== Number(id))
                            .sort((a, b) => {
                                const nA = parseInt(a.N_PAI, 10) || 0;
                                const nB = parseInt(b.N_PAI, 10) || 0;
                                if (nA !== nB) return nA - nB;
                                return Number(a.ID_PAIEMENT) - Number(b.ID_PAIEMENT);
                            });

                        const updatedPaiementsInContext: Paiement[] = [];
                        for (let i = 0; i < sameContextPaiements.length; i++) {
                            const p = sameContextPaiements[i];
                            const newNPai = (i + 1).toString().padStart(2, '0');
                            if (p.N_PAI !== newNPai) {
                                await tauriDb.updateItem('T_PAIEMENT', 'ID_PAIEMENT', p.ID_PAIEMENT, { N_PAI: newNPai });
                                updatedPaiementsInContext.push({ ...p, N_PAI: newNPai });
                            } else {
                                updatedPaiementsInContext.push(p);
                            }
                        }

                        if (updatedPaiementsInContext.length > 0) {
                            reorderedPaiements = (db.T_PAIEMENT as Paiement[])
                                .filter(p => Number(p.ID_PAIEMENT) !== Number(id))
                                .map(p => {
                                    const updated = updatedPaiementsInContext.find(u => Number(u.ID_PAIEMENT) === Number(p.ID_PAIEMENT));
                                    return updated || p;
                                });
                        }
                    }
                }
            }

            deleteLocalItem(tableName, id, reorderedPaiements || undefined);
            const existingItem = (db as any)[tableName]?.find((row: any) => row[idField] === id);
            const itemDetail = existingItem ? (existingItem.PIECE || existingItem.BENEFICIAIRE || existingItem.INT_OPERATION || existingItem.USERNAME || existingItem.N_ENG || '') : '';

            // Queue for later Supabase sync so offline work is not lost
            if (supabase) {
                enqueueForSupabaseSync('DELETE', tableName, { id });
            }

            broadcastEvent('delete', `${TABLE_AR_NAMES[tableName] || tableName}`, itemDetail);
            return { message: 'Item deleted' };
        } catch (err: any) {
            console.error("Tauri deleteItem error:", err);
            throw err;
        }
    };

    const deleteItem = async (tableName: keyof Database, id: number) => {
        const idField = TABLE_ID_FIELDS[tableName];

        // ── Priority 1: Supabase when configured AND online ──
        if (supabase && isOnline) {
            try {
                const { error } = await supabase.from(tableName as string).delete().eq(idField, id);
                if (error) throw error;

                let reorderedPaiements: Paiement[] | null = null;

                // Reset Piece status flags on deletion
                if (tableName === 'T_ENGAGEMENT' || tableName === 'T_PAIEMENT') {
                    const itemToDelete = (db[tableName] as any[]).find((row: any) => row[idField] === id);
                    if (itemToDelete && itemToDelete.ID_PIECE) {
                        const pieceId = itemToDelete.ID_PIECE;

                        if (tableName === 'T_ENGAGEMENT') {
                            const remaining = db.T_ENGAGEMENT.filter(e => e.ID_PIECE === pieceId && e.ID_ENGAGEMENT !== id)
                                .sort((a, b) => b.ID_ENGAGEMENT - a.ID_ENGAGEMENT);
                            const latest = remaining[0];
                            const effectivelyEngaged = latest ? (latest as any).NATURE_ENG !== 'سحب' : false;
                            await supabase.from('T_PIECE').update({ SAI_ENG: effectivelyEngaged } as any).eq('ID_PIECE', pieceId);
                            setDbMetadata(prev => ({
                                ...prev,
                                T_PIECE: (prev.T_PIECE || []).map(p => p.ID_PIECE === pieceId ? { ...p, SAI_ENG: effectivelyEngaged } : p)
                            }));
                        } else {
                            const others = db.T_PAIEMENT.filter(p => p.ID_PIECE === pieceId && p.ID_PAIEMENT !== id);
                            const effectivelyPaid = others.length > 0;
                            await supabase.from('T_PIECE').update({ SAI_PAI: effectivelyPaid } as any).eq('ID_PIECE', pieceId);
                            setDbMetadata(prev => ({
                                ...prev,
                                T_PIECE: (prev.T_PIECE || []).map(p => p.ID_PIECE === pieceId ? { ...p, SAI_PAI: effectivelyPaid } : p)
                            }));

                            const opId = itemToDelete.ID_OPERATION;
                            const year = itemToDelete.ANNEE;

                            const sameContextPaiements = db.T_PAIEMENT
                                .filter(p => Number(p.ID_OPERATION) === Number(opId) && p.ANNEE === year && Number(p.ID_PAIEMENT) !== Number(id))
                                .sort((a, b) => {
                                    const nA = parseInt(a.N_PAI, 10) || 0;
                                    const nB = parseInt(b.N_PAI, 10) || 0;
                                    if (nA !== nB) return nA - nB;
                                    return Number(a.ID_PAIEMENT) - Number(b.ID_PAIEMENT);
                                });

                            const updatedPaiementsInContext: Paiement[] = [];
                            for (let i = 0; i < sameContextPaiements.length; i++) {
                                const p = sameContextPaiements[i];
                                const newNPai = (i + 1).toString().padStart(2, '0');
                                if (p.N_PAI !== newNPai) {
                                    await supabase.from('T_PAIEMENT').update({ N_PAI: newNPai } as any).eq('ID_PAIEMENT', p.ID_PAIEMENT);
                                    updatedPaiementsInContext.push({ ...p, N_PAI: newNPai });
                                } else {
                                    updatedPaiementsInContext.push(p);
                                }
                            }

                            if (updatedPaiementsInContext.length > 0) {
                                reorderedPaiements = (db.T_PAIEMENT as Paiement[])
                                    .filter(p => Number(p.ID_PAIEMENT) !== Number(id))
                                    .map(p => {
                                        const updated = updatedPaiementsInContext.find(u => Number(u.ID_PAIEMENT) === Number(p.ID_PAIEMENT));
                                        return updated || p;
                                    });
                            }
                        }
                    }
                }

                // Immediate write-through to local SQLite
                await mirrorDeleteFromSqlite(tableName, id);
                if (reorderedPaiements) {
                    for (const p of reorderedPaiements) {
                        await mirrorUpsertToSqlite('T_PAIEMENT', p);
                    }
                }
                if (tableName === 'T_ENGAGEMENT' || tableName === 'T_PAIEMENT') {
                    const itemToDelete = (db[tableName] as any[]).find((row: any) => row[idField] === id);
                    if (itemToDelete && itemToDelete.ID_PIECE) {
                        const pieceRow = (dbRef.current?.T_PIECE || []).find(p => Number(p.ID_PIECE) === Number(itemToDelete.ID_PIECE));
                        if (pieceRow) {
                            const remainingEngs = db.T_ENGAGEMENT.filter(e => Number(e.ID_PIECE) === Number(itemToDelete.ID_PIECE) && Number(e.ID_ENGAGEMENT) !== Number(id));
                            const remainingPais = db.T_PAIEMENT.filter(p => Number(p.ID_PIECE) === Number(itemToDelete.ID_PIECE) && Number(p.ID_PAIEMENT) !== Number(id));
                            const latestEng = [...remainingEngs].sort((a, b) => b.ID_ENGAGEMENT - a.ID_ENGAGEMENT)[0];
                            const mirroredPiece = {
                                ...pieceRow,
                                SAI_ENG: tableName === 'T_ENGAGEMENT'
                                    ? (latestEng ? (latestEng as any).NATURE_ENG !== 'سحب' : pieceRow.SAI_ENG)
                                    : pieceRow.SAI_ENG,
                                SAI_PAI: tableName === 'T_PAIEMENT'
                                    ? remainingPais.length > 0
                                    : pieceRow.SAI_PAI,
                            };
                            await mirrorUpsertToSqlite('T_PIECE', mirroredPiece);
                        }
                    }
                }

                if (!isBatchMode.current) {
                    const existingItem = (db as any)[tableName]?.find((row: any) => row[idField] === id);
                    const itemDetail = existingItem ? (existingItem.PIECE || existingItem.BENEFICIAIRE || existingItem.INT_OPERATION || existingItem.USERNAME || existingItem.N_ENG || '') : '';

                    deleteLocalItem(tableName, id, reorderedPaiements || undefined);

                    broadcastEvent('delete', `${TABLE_AR_NAMES[tableName] || tableName}`, itemDetail);
                }
                return { message: 'Item deleted' };
            } catch (err: any) {
                if (isNetworkError(err)) {
                    console.warn("Network error during deleteItem, falling back to local SQLite:", err);
                    setIsOnline(false);
                    setConnectionError("تعذر الاتصال بالسيرفر. تم الحذف محلياً وسيتم مزامنتها تلقائياً عند استعادة الاتصال.");
                } else {
                    console.error("Supabase deleteItem failed, falling back to local storage:", err);
                }
                if (tauriDb.isAvailable()) {
                    return await deleteItemViaSqlite(tableName, id);
                }
                if (supabase) {
                    return await saveOfflineDeleteItem(tableName, id);
                }
                throw err;
            }
        }

        // ── Priority 2: Local SQLite when offline or Supabase not configured ──
        if (tauriDb.isAvailable()) {
            return await deleteItemViaSqlite(tableName, id);
        }

        // ── Priority 3: Web offline queue ──
        if (!supabase) throw new Error("قاعدة البيانات غير مهيأة. يرجى الاتصال بالإنترنت أول مرة لإعداد القاعدة.");
        return await saveOfflineDeleteItem(tableName, id);
    };

    useEffect(() => {
        if (loading || isInitialLoad || tauriDb.isAvailable()) return;

        if (operations.length > 0 || engagements.length > 0 || paiements.length > 0 || Object.keys(dbMetadata).length > 0) {
            const results = validateDatabaseIntegrity(db);
            
            if (results) {
                const brokenEngs = results.brokenEngagements.filter(item => !autoHealIdsTried.current.T_ENGAGEMENT.has(item.id_engagement));
                const brokenPais = results.brokenPaiements.filter(item => !autoHealIdsTried.current.T_PAIEMENT.has(item.id_paiement));
                const brokenPieces = results.brokenPieces.filter(item => !autoHealIdsTried.current.T_PIECE.has(item.id_piece));

                if (brokenEngs.length > 0 || brokenPais.length > 0 || brokenPieces.length > 0) {
                    console.warn("[Data Integrity Auto-Heal] Detected references to non-existent rows. Starting repair...");

                    brokenEngs.forEach(item => autoHealIdsTried.current.T_ENGAGEMENT.add(item.id_engagement));
                    brokenPais.forEach(item => autoHealIdsTried.current.T_PAIEMENT.add(item.id_paiement));
                    brokenPieces.forEach(item => autoHealIdsTried.current.T_PIECE.add(item.id_piece));

                    const executeAutoHeal = async () => {
                        // 1. Broken Engagements
                        for (const item of brokenEngs) {
                            try {
                                const pStillExists = db.T_PIECE.some(p => Number(p.ID_PIECE) === Number(item.id_piece));
                                if (db.T_PIECE.length > 0 && !pStillExists) {
                                    console.warn(`[Data Integrity Auto-Heal] Automatically cleaning orphaned engagement ID: ${item.id_engagement} N_ENG: ${item.engagement.N_ENG}`);
                                    await deleteItem('T_ENGAGEMENT', item.id_engagement);
                                }
                            } catch (err) {
                                console.warn("[Data Integrity Auto-Heal] Failed to auto-delete engagement", err);
                            }
                        }

                        // 2. Broken Paiements
                        for (const item of brokenPais) {
                            try {
                                const pStillExists = db.T_PIECE.some(p => Number(p.ID_PIECE) === Number(item.id_piece));
                                if (db.T_PIECE.length > 0 && !pStillExists) {
                                    console.warn(`[Data Integrity Auto-Heal] Automatically cleaning orphaned paiement ID: ${item.id_paiement} N_PAI: ${item.paiement.N_PAI}`);
                                    await deleteItem('T_PAIEMENT', item.id_paiement);
                                }
                            } catch (err) {
                                console.warn("[Data Integrity Auto-Heal] Failed to auto-delete paiement", err);
                            }
                        }

                        // 3. Broken Pieces
                        for (const item of brokenPieces) {
                            try {
                                const opStillExists = db.T_OPERATION.some(op => Number(op.ID_OPERATION) === Number(item.id_operation));
                                if (db.T_OPERATION.length > 0 && !opStillExists) {
                                    console.warn(`[Data Integrity Auto-Heal] Automatically cleaning orphaned piece ID: ${item.id_piece} Name: ${item.piece.PIECE}`);
                                    await deleteItem('T_PIECE', item.id_piece);
                                }
                            } catch (err) {
                                console.warn("[Data Integrity Auto-Heal] Failed to auto-delete piece", err);
                            }
                        }
                    };

                    executeAutoHeal();
                }
            }
        }
    }, [db, validateDatabaseIntegrity, deleteItem, loading, isInitialLoad]);
    
    const deleteOperationViaSqlite = async (id: number) => {
        try {
            const op = db.T_OPERATION.find(o => o.ID_OPERATION === id);
            await tauriDb.deleteOperationCascade(id);
            const newOps = db.T_OPERATION.filter(o => o.ID_OPERATION !== id);
            setOperations(newOps);
            const opPieceIds = new Set(
                (db.T_PIECE || [])
                    .filter(p => Number(p.ID_OPERATION) === Number(id))
                    .map(p => Number(p.ID_PIECE))
            );
            const opLotIds = new Set(
                (db.T_LOT_OPERATION || [])
                    .filter(l => Number(l.ID_OPERATION) === Number(id))
                    .map(l => Number(l.ID_LOT))
            );
            setDbMetadata(prev => ({
                ...prev,
                T_PIECE: (prev.T_PIECE || []).filter(p => Number(p.ID_OPERATION) !== Number(id)),
                T_ENGAGEMENT: (prev.T_ENGAGEMENT || []).filter(e => Number(e.ID_OPERATION) !== Number(id)),
                T_PAIEMENT: (prev.T_PAIEMENT || []).filter(p => Number(p.ID_OPERATION) !== Number(id)),
                T_ODS: (prev.T_ODS || []).filter(o => !opPieceIds.has(Number(o.ID_PIECE))),
                T_CP: (prev.T_CP || []).filter(c => Number(c.ID_OPERATION) !== Number(id)),
                T_RUBRIQUE_OP: (prev.T_RUBRIQUE_OP || []).filter(r => Number(r.ID_OPERATION) !== Number(id)),
                T_SCATEGORIE_OP: (prev.T_SCATEGORIE_OP || []).filter(s => Number(s.ID_OPERATION) !== Number(id)),
                T_LOT_OPERATION: (prev.T_LOT_OPERATION || []).filter(l => Number(l.ID_OPERATION) !== Number(id)),
                T_LOT_PIECE: (prev.T_LOT_PIECE || []).filter(l => !opLotIds.has(Number(l.ID_LOT))),
            }));

            if (supabase) {
                enqueueForSupabaseSync('DELETE_OP', 'T_OPERATION_CASCADE', { id });
            }

            broadcastEvent('delete', 'عملية وكافة ملحقاتها', op?.INT_OPERATION);
            return { message: 'Operation deleted' };
        } catch (err: any) {
            console.error("Tauri deleteOperation error:", err);
            throw err;
        }
    };

    const deleteOperation = async (id: number) => {
        // ── Priority 1: Supabase when configured AND online ──
        if (supabase && isOnline) {
            try {
                const { error } = await supabase.from('T_OPERATION').delete().eq('ID_OPERATION', id);
                if (error) throw error;
                // Immediate cascade delete in local SQLite as well
                if (tauriDb.isAvailable()) {
                    try {
                        await tauriDb.deleteOperationCascade(id);
                    } catch (mirrorErr) {
                        console.warn('SQLite cascade mirror failed:', mirrorErr);
                    }
                }
                if (!isBatchMode.current) {
                    const op = db.T_OPERATION.find(o => o.ID_OPERATION === id);
                    const newOps = db.T_OPERATION.filter(o => o.ID_OPERATION !== id);
                    setOperations(newOps);
                    broadcastEvent('delete', 'عملية وكافة ملحقاتها', op?.INT_OPERATION);
                }
                return { message: 'Operation deleted' };
            } catch (err: any) {
                if (isNetworkError(err)) {
                    console.warn("Network error during deleteOperation, falling back to local SQLite:", err);
                    setIsOnline(false);
                    setConnectionError("تعذر الاتصال بالسيرفر. تم الحذف محلياً وسيتم مزامنتها تلقائياً عند استعادة الاتصال.");
                } else {
                    console.error("Supabase deleteOperation failed, falling back to local storage:", err);
                }
                if (tauriDb.isAvailable()) {
                    return await deleteOperationViaSqlite(id);
                }
                if (supabase) {
                    return await saveOfflineDeleteOperation(id);
                }
                throw err;
            }
        }

        // ── Priority 2: Local SQLite when offline or Supabase not configured ──
        if (tauriDb.isAvailable()) {
            return await deleteOperationViaSqlite(id);
        }

        // ── Priority 3: Web offline queue ──
        if (!supabase) throw new Error("قاعدة البيانات غير مهيأة. يرجى الاتصال بالإنترنت أول مرة لإعداد القاعدة.");
        return await saveOfflineDeleteOperation(id);
    };
    
    const resetDatabase = async () => {
        // ── Priority 1: Supabase cloud reset when online ──
        if (supabase && isOnline) {
            if (!window.confirm('تحذير: هذا الإجراء سيحذف جميع البيانات من قاعدة البيانات السحابية. هل أنت متأكد؟')) return;
            isBatchMode.current = true;
            setLoading(true);
            try {
                const tablesToDelete: (keyof Database)[] = [
                    'T_COMPTE_BANCAIRE', 'T_PAIEMENT', 'T_ENGAGEMENT', 'T_ODS', 'T_LOT_PIECE', 
                    'T_PIECE', 'T_RUBRIQUE_OP', 'T_SCATEGORIE_OP', 'T_LOT_OPERATION', 
                    'T_CP', 'T_OPERATION', 'T_SPROGRAMME', 'T_PROGRAMME', 'T_SCATEGORIE', 
                    'T_CATEGORIE', 'T_RUBRIQUE', 'T_BENEFICIAIRE', 'T_DIRECTION', 'T_USER', 'T_BORDEREAU'
                ];

                for (const table of tablesToDelete) {
                    await supabase.from(table as string).delete().neq(TABLE_ID_FIELDS[table], 0); 
                }
                
                const hashedAdmin = await hashPassword('admin');
                await supabase.from('T_USER').insert({ USERNAME: 'admin', PASSWORD: hashedAdmin, ROLE: 'admin' });
                broadcastEvent('reset', 'قاعدة البيانات بالكامل');

            } catch (e) {
                console.error("Reset failed", e);
            } finally {
                isBatchMode.current = false;
                await refreshData();
            }
            return;
        }

        // ── Priority 2: Local SQLite reset when offline ──
        if (tauriDb.isAvailable()) {
            try {
                await tauriDb.resetDatabase();
                await refreshData();
            } catch (e) {
                console.error("Tauri resetDatabase error:", e);
                throw e;
            }
            return;
        }

        alert("لا يمكن مسح قاعدة البيانات في وضع عدم الاتصال.");
    };

    const importDatabase = async (importedDb: Database) => {
        // ── Priority 1: Supabase cloud import when online ──
        if (supabase && isOnline) {
            if (!window.confirm('استيراد قاعدة بيانات جديدة سيحذف البيانات الحالية من السحابة. هل أنت متأكد؟')) return;

            isBatchMode.current = true;
            setLoading(true);
            try {
                 const tablesToDelete: (keyof Database)[] = [
                    'T_COMPTE_BANCAIRE', 'T_PAIEMENT', 'T_ENGAGEMENT', 'T_ODS', 'T_LOT_PIECE', 
                    'T_PIECE', 'T_RUBRIQUE_OP', 'T_SCATEGORIE_OP', 'T_LOT_OPERATION', 
                    'T_CP', 'T_OPERATION', 'T_SPROGRAMME', 'T_PROGRAMME', 'T_SCATEGORIE', 
                    'T_CATEGORIE', 'T_RUBRIQUE', 'T_BENEFICIAIRE', 'T_DIRECTION', 'T_USER', 'T_BORDEREAU'
                ];
                for (const table of tablesToDelete) {
                    await supabase.from(table as string).delete().neq(TABLE_ID_FIELDS[table], 0); 
                }

                const tableOrder: (keyof Database)[] = [
                    'T_USER', 'T_BENEFICIAIRE', 'T_CATEGORIE', 'T_DIRECTION', 'T_PROGRAMME', 'T_RUBRIQUE',
                    'T_SCATEGORIE', 'T_SPROGRAMME', 'T_OPERATION', 'T_CP', 'T_LOT_OPERATION', 
                    'T_RUBRIQUE_OP', 'T_SCATEGORIE_OP', 'T_PIECE', 'T_ENGAGEMENT', 'T_ODS', 
                    'T_LOT_PIECE', 'T_PAIEMENT', 'T_COMPTE_BANCAIRE', 'T_BORDEREAU'
                ];

                for (const tableName of tableOrder) {
                    const rows = importedDb[tableName];
                    if (rows && rows.length > 0) {
                        const { error } = await (supabase as any).from(tableName as string).insert(rows as any);
                        if (error) throw error;
                    }
                }
                broadcastEvent('import', 'قاعدة بيانات كاملة من ملف');
                alert('تم استيراد البيانات بنجاح إلى السحابة!');
            } catch (e) {
                console.error("Import failed:", e);
                alert('فشل استيراد البيانات. راجع وحدة التحكم للتفاصيل.');
            } finally {
                isBatchMode.current = false;
                await refreshData();
            }
            return;
        }

        // ── Priority 2: Local SQLite import when offline ──
        if (tauriDb.isAvailable()) {
            try {
                await tauriDb.importDatabase(importedDb);
                await refreshData();
            } catch (e) {
                console.error("Tauri importDatabase error:", e);
                throw e;
            }
            return;
        }

        alert("لا يمكن استيراد قاعدة البيانات في وضع عدم الاتصال.");
    };


    return (
        <DataContext.Provider value={{ 
            db, 
            loading, 
            isInitialLoad,
            isDbConfigured: !!isConfigured,
            onlineUsers, 
            recentEvents,
            connectionError,
            isLocalDbConnected,
            integrityIssues,
            isOnline,
            pendingActionsCount: pendingActions.length,
            refreshData, 
            addItem, 
            updateItem, 
            deleteItem, 
            deleteOperation, 
            resetDatabase, 
            importDatabase, 
            runInTransaction, 
            joinPresence, 
            leavePresence,
            broadcastEvent,
            saveConfig: saveConfiguration,
            resetConfig: resetConfiguration
        }}>
            {children}
        </DataContext.Provider>
    );
};

export const useData = (): DataContextType => {
    const context = useContext(DataContext);
    if (context === undefined) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
};