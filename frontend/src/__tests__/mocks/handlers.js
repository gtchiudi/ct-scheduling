import { http, HttpResponse } from 'msw'

export const handlers = [
  // Default: 2 pending requests, no urgency
  http.get('/api/pending-requests-stats/', () => {
    return HttpResponse.json({ pending_count: 2, has_urgent_requests: false })
  }),
]
