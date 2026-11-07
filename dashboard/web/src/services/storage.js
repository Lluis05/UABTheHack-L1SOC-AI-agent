// Preferencias locales. El navegador puede bloquear el almacenamiento: entonces simplemente no se recuerda.
export function readLocal(key, fallback = '') {
  try { return localStorage.getItem(key) ?? fallback } catch { return fallback }
}

export function writeLocal(key, value) {
  try { localStorage.setItem(key, value) } catch { /* sin almacenamiento disponible */ }
}
