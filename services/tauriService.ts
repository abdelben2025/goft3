import { Database } from '../types';

/**
 * Checks whether the application is currently running inside the Tauri (Rust) desktop environment.
 */
export const isTauri = (): boolean => {
    return typeof window !== 'undefined' && (
        Boolean((window as any).__TAURI_INTERNALS__) ||
        Boolean((window as any).__TAURI__)
    );
};

// Safe invoke wrapper
async function invokeTauri<T>(cmd: string, args?: Record<string, any>): Promise<T> {
    try {
        const { invoke } = await import('@tauri-apps/api/core');
        return await invoke<T>(cmd, args);
    } catch (e) {
        console.error(`Tauri invoke failed for command: ${cmd}`, e);
        throw e;
    }
}

export const tauriDb = {
    isAvailable: isTauri,

    async getDatabase(): Promise<Database> {
        return await invokeTauri<Database>('get_database');
    },

    async addItem(table: keyof Database, item: any): Promise<number> {
        return await invokeTauri<number>('add_item', {
            table: table as string,
            item,
        });
    },

    async upsertItem(table: keyof Database, item: any): Promise<number> {
        return await invokeTauri<number>('upsert_item', {
            table: table as string,
            item,
        });
    },

    async updateItem(table: keyof Database, idField: string, id: number, item: any): Promise<boolean> {
        return await invokeTauri<boolean>('update_item', {
            table: table as string,
            idField,
            id,
            item,
        });
    },

    async deleteItem(table: keyof Database, idField: string, id: number): Promise<boolean> {
        return await invokeTauri<boolean>('delete_item', {
            table: table as string,
            idField,
            id,
        });
    },

    async deleteOperationCascade(operationId: number): Promise<boolean> {
        return await invokeTauri<boolean>('delete_operation_cascade', {
            operationId,
        });
    },

    async resetDatabase(): Promise<boolean> {
        return await invokeTauri<boolean>('reset_database');
    },

    async importDatabase(dbJson: Database): Promise<number> {
        return await invokeTauri<number>('import_database', {
            dbJson,
        });
    },

    async exportDatabase(): Promise<Database> {
        return await invokeTauri<Database>('export_database');
    },

    async saveBackup(content: string, path: string, passphrase: string): Promise<void> {
        return await invokeTauri<void>('save_backup', { content, path, passphrase });
    },

    async readBackup(path: string, passphrase: string = ''): Promise<string> {
        return await invokeTauri<string>('read_backup', { path, passphrase });
    },

    async exportSqliteDb(path: string): Promise<void> {
        return await invokeTauri<void>('export_sqlite_db', { path });
    },

    async exportSupabaseSqlite(path: string, dbJson: Record<string, any[]>): Promise<number> {
        return await invokeTauri<number>('export_supabase_sqlite', { path, dbJson });
    },

    async getLocalDbPath(): Promise<string> {
        return await invokeTauri<string>('get_local_db_path');
    },
};
