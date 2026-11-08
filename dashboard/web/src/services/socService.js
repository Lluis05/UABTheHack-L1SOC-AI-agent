import { request } from './apiClient.js'

// Endpoints del backend del dashboard (dashboard/server.py)
const ticketPath = (id) => `/tickets/${encodeURIComponent(id)}`
const incidentPath = (id) => `/incidents/${encodeURIComponent(id)}`

export const socService = {
  config: () => request('GET', '/config'),
  health: () => request('GET', '/health'),
  tickets: () => request('GET', '/tickets'),
  trace: (ticketId) => request('GET', `${ticketPath(ticketId)}/trace`),
  incidents: () => request('GET', '/incidents'),
  report: (incidentId) => request('GET', `${incidentPath(incidentId)}/report`),
  generateReport: (incidentId, fresh) => request('POST', `${incidentPath(incidentId)}/report${fresh ? '?fresh=true' : ''}`),
  metrics: () => request('GET', '/metrics'),
  containmentLog: () => request('GET', '/containment/log'),
  runContainment: (ticketId, body) => request('POST', `${ticketPath(ticketId)}/containment`, body),
  decide: (ticketId, body) => request('POST', `${ticketPath(ticketId)}/decision`, body),
  chat: (ticketId, body) => request('POST', `${ticketPath(ticketId)}/chat`, body),
  startTriage: (body) => request('POST', '/triage', body),
  triageStatus: (jobId) => request('GET', `/triage/${encodeURIComponent(jobId)}`),
}
