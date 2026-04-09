export function createPageUrl(page) {
  if (page === 'Dashboard') return '/'
  return `/${page}`
}

export function getPaymentLabel(method) {
  return method === 'gcash' ? 'GCash' : 'Cash'
}
