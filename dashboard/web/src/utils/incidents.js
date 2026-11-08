// Todas las entidades del incidente (hosts, IPs, usuarios, dominios...) en una lista sin repetir
export function incidentEntities(incident = {}) {
  return [...new Set(Object.values(incident.entities || {}).flat().filter(Boolean))]
}

// Tácticas de la cadena en orden de aparición (x_tactics si la correlación lo da; si no, desde kill_chain)
export function incidentTactics(incident = {}) {
  return incident.x_tactics || [...new Set((incident.kill_chain || []).map((k) => k.tactic))]
}

// Avisos del informe de investigación (nivel 3) que el N2 tiene que ver antes de leerlo, en orden de gravedad.
// Cada uno: {key, label, tone}. tone es una clave de la paleta (AppChip).
export function reportFlags(report) {
  if (!report) return []
  const flags = []
  if (report.x_stale) flags.push({ key: 'stale', label: 'Obsoleto: el incidente ha cambiado', tone: 'warning' })
  if (report.injection_detected) flags.push({ key: 'injection', label: 'Inyección detectada', tone: 'error' })
  if (report.x_no_ai) flags.push({ key: 'no_ai', label: 'Sin IA', tone: 'warning' })
  return flags
}

// Nombre del fichero al descargar el informe para entregarlo a N2
export function reportFileName(report) {
  return `informe_${report?.incident_id || 'incidente'}.json`
}
