import { isTauri } from '../services/tauriService';

/**
 * Save a Blob to disk.
 *
 * In the Tauri desktop app the WebView routinely blocks programmatic anchor
 * downloads (blob: URLs), so we use the native "Save As" dialog + a small Rust
 * command. In a plain browser (e.g. `npm run dev`) we fall back to the classic
 * Blob anchor download.
 */
export const saveBlobToFile = async (blob: Blob, suggestedName: string): Promise<boolean> => {
    if (isTauri()) {
        try {
            const [{ save }, { invoke }] = await Promise.all([
                import('@tauri-apps/plugin-dialog'),
                import('@tauri-apps/api/core'),
            ]);

            const path = await save({ defaultPath: suggestedName });
            if (!path) return false; // user cancelled

            const bytes = new Uint8Array(await blob.arrayBuffer());
            await invoke('save_binary_file', { path, contents: Array.from(bytes) });
            return true;
        } catch (e) {
            console.error('Tauri save failed:', e);
            throw e;
        }
    }

    // Browser fallback
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = suggestedName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    return true;
};
