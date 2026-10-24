import { APP_VERSION } from '../types';
import { isTauri } from '../services/tauriService';

export interface UpdateInfo {
    hasUpdate: boolean;
    latestVersion: string;
    downloadUrl: string;
    notes?: string;
    notSupported?: boolean; // true when not running in Tauri
    offline?: boolean;       // true when we skipped because the device is offline
    checkFailed?: boolean;   // true when the updater endpoint/signature check failed
    noReleases?: boolean;    // true when the endpoint suggests no release has been published yet
}

export type UpdateProgressHandler = (percent: number) => void;

// The pending update returned by tauri-plugin-updater (kept between check and install)
let pendingUpdate: any = null;

/**
 * Reads the actual app version from the Tauri runtime when available,
 * falling back to the bundled APP_VERSION constant (web preview).
 */
const getAppVersion = async (): Promise<string> => {
    if (!isTauri()) return APP_VERSION;
    try {
        const { getVersion } = await import('@tauri-apps/api/app');
        return await getVersion();
    } catch (e) {
        console.warn('Failed to read version from runtime, using APP_VERSION.', e);
        return APP_VERSION;
    }
};

/**
 * Checks GitHub Releases for a newer signed version via tauri-plugin-updater.
 * Returns null when the check could not be performed for an unexpected reason.
 */
export const checkForUpdates = async (): Promise<UpdateInfo | null> => {
    const currentVersion = await getAppVersion();

    if (!isTauri()) {
        return { hasUpdate: false, latestVersion: currentVersion, downloadUrl: '', notSupported: true };
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        console.log('App is offline: Skipping update check.');
        return { hasUpdate: false, latestVersion: currentVersion, downloadUrl: '', offline: true };
    }

    // NOTE: We intentionally do NOT pre-flight the endpoint from JS. A browser
    // fetch from the webview is subject to CORS and fails even when the endpoint
    // is fine, producing a false "cannot reach update server". We rely on the
    // Tauri updater's own Rust network stack (check()) instead.
    try {
        const { check } = await import('@tauri-apps/plugin-updater');
        const update = await check();

        if (!update) {
            return { hasUpdate: false, latestVersion: currentVersion, downloadUrl: '' };
        }

        pendingUpdate = update;
        return {
            hasUpdate: true,
            latestVersion: update.version,
            downloadUrl: '',
            notes: update.body || '',
        };
    } catch (error) {
        console.warn('Update check skipped (Updater error).', error);
        // Best-effort: a 404 / "not found" usually means no release published yet.
        const raw = String((error as any)?.message || '');
        const status = String((error as any)?.status ?? '');
        const noReleases = /404|not found|no release|unable to find|does not exist/i.test(raw) || /404/.test(status);
        return { hasUpdate: false, latestVersion: currentVersion, downloadUrl: '', checkFailed: true, noReleases };
    }
};

/**
 * Downloads the update (signature verified by the plugin with the embedded pubkey),
 * installs it silently, then restarts the application.
 * The optional onProgress callback receives a 0-100 download percentage.
 */
export const performUpdate = async (onProgress?: UpdateProgressHandler): Promise<void> => {
    let contentLength = 0;
    let downloaded = 0;

    if (!pendingUpdate) {
        // Re-check if install was requested without a prior successful check
        const { check } = await import('@tauri-apps/plugin-updater');
        pendingUpdate = await check();
    }
    if (!pendingUpdate) {
        throw new Error('لا يوجد تحديث مهيأ. أعد التحقق من التحديثات.');
    }

    await pendingUpdate.downloadAndInstall((event: any) => {
        switch (event.event) {
            case 'Started':
                contentLength = event.data.contentLength ?? 0;
                downloaded = 0;
                break;
            case 'Progress':
                downloaded += event.data.chunk;
                if (contentLength > 0 && onProgress) {
                    onProgress(Math.min(99, Math.round((downloaded / contentLength) * 100)));
                }
                break;
            default:
                break;
        }
    });

    pendingUpdate = null;
    if (onProgress) onProgress(100);

    // Restart into the new version
    const { relaunch } = await import('@tauri-apps/plugin-process');
    try {
        await relaunch();
    } catch {
        throw new Error('تم تثبيت التحديث بنجاح. أعد تشغيل التطبيق يدويًا لإكمال التثبيت.');
    }
};
