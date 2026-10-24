// Extracts a human-readable reason from an error (Error, plain string from
// Tauri commands, Supabase error object, etc.) so error toasts always state
// the type/cause instead of a generic message.
export function errorMessage(err: unknown, fallback: string = 'سبب غير معروف'): string {
    try {
        if (typeof err === 'string') {
            const s = err.trim();
            return s || fallback;
        }
        if (err && typeof err === 'object') {
            const anyErr = err as any;
            const msg = anyErr.message ?? anyErr.msg ?? anyErr.error_description ?? anyErr.error ?? anyErr.details;
            if (typeof msg === 'string' && msg.trim()) return msg.trim();
            if (msg && typeof msg === 'object') return errorMessage(msg, fallback);
            const code = anyErr.code ?? anyErr.hint;
            if (typeof code === 'string' && code.trim()) return code.trim();
            try {
                const json = JSON.stringify(err);
                if (json && json !== '{}') return json;
            } catch { /* circular / non-serializable */ }
        }
        if (err !== undefined && err !== null) {
            const s = String(err).trim();
            if (s && s !== '[object Object]') return s;
        }
    } catch { /* never let the formatter itself throw */ }
    return fallback;
}
