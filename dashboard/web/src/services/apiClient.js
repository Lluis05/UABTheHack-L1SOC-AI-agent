// Cliente HTTP mínimo. Convierte los errores de FastAPI ({detail}) en mensajes legibles.
const API_PREFIX = '/api'

export function errorMessage(status, data) {
  const detail = data && data.detail
  if (Array.isArray(detail)) return detail.map((d) => `${d.loc?.slice(-1)[0]}: ${d.msg}`).join('; ')
  return detail || `HTTP ${status}`
}

export async function request(method, path, body) {
  const res = await fetch(API_PREFIX + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  if (!res.ok) throw new Error(errorMessage(res.status, data))
  return data
}
