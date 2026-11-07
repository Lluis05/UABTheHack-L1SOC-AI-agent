// La pestaña y el ticket abierto viven en la URL (?page=queue&ticket=TKT-…): se pueden enlazar y recargar.
export const URL_KEYS = { PAGE: 'page', TICKET: 'ticket' }

export function readUrlState(search, allowedPages, defaultPage) {
  const params = new URLSearchParams(search)
  const page = params.get(URL_KEYS.PAGE)
  return {
    page: allowedPages.includes(page) ? page : defaultPage,
    ticket: params.get(URL_KEYS.TICKET) || null,
  }
}

export function buildSearch({ page, ticket }) {
  const params = new URLSearchParams()
  if (page) params.set(URL_KEYS.PAGE, page)
  if (ticket) params.set(URL_KEYS.TICKET, ticket)
  const s = params.toString()
  return s ? `?${s}` : ''
}
