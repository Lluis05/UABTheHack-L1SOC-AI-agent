// Todas las entidades del incidente (hosts, IPs, usuarios, dominios...) en una lista sin repetir
export function incidentEntities(incident = {}) {
  return [...new Set(Object.values(incident.entities || {}).flat().filter(Boolean))]
}

// Tácticas de la cadena en orden de aparición (x_tactics si la correlación lo da; si no, desde kill_chain)
export function incidentTactics(incident = {}) {
  return incident.x_tactics || [...new Set((incident.kill_chain || []).map((k) => k.tactic))]
}
