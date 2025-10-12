// Shared frontend constants
// Prefer env-configured base URL; fall back to localhost dev default.
// We expose only the browser-facing base here and always append '/api'.
const browserBase = process.env.NEXT_PUBLIC_API_URL_BROWSER || 'http://localhost:8080';
export const API_BASE_URL = browserBase.replace(/\/$/, '');
