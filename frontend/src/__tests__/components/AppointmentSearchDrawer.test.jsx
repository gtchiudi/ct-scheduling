/**
 * Component tests for src/components/AppointmentSearchDrawer.jsx
 *
 * The drawer debounces user input, queries GET /api/request/?search=... via
 * react-query (mocked with MSW), and renders results. Selecting a result
 * must hand back the raw request object so Calendar.jsx can open it the same
 * way clicking an event on the calendar does.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '../mocks/server.js'
import AppointmentSearchDrawer from '../../components/AppointmentSearchDrawer.jsx'

const sampleResults = [
  {
    id: 'req-1',
    customer_name: 'Acme Co',
    company_name: 'Best Carrier',
    ref_number: 'REF123; REF124',
    date_time: '2026-01-15T14:00:00.000Z',
  },
]

function renderDrawer(overrides = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const props = {
    open: true,
    onClose: vi.fn(),
    onSelectRequest: vi.fn(),
    ...overrides,
  }
  return {
    ...render(
      <QueryClientProvider client={queryClient}>
        <AppointmentSearchDrawer {...props} />
      </QueryClientProvider>
    ),
    props,
  }
}

describe('AppointmentSearchDrawer', () => {
  it('does not query the backend for a query under 2 characters', async () => {
    let called = false
    server.use(
      http.get('/api/request/', () => {
        called = true
        return HttpResponse.json(sampleResults)
      })
    )
    const user = userEvent.setup()
    renderDrawer()
    await user.type(screen.getByPlaceholderText(/search reference/i), 'A')
    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(called).toBe(false)
  })

  it('queries by search term (scoped to approved appointments) and renders results', async () => {
    server.use(
      http.get('/api/request/', ({ request }) => {
        const url = new URL(request.url)
        expect(url.searchParams.get('search')).toBe('Acme')
        expect(url.searchParams.get('approved')).toBe('True')
        return HttpResponse.json(sampleResults)
      })
    )
    const user = userEvent.setup()
    renderDrawer()
    await user.type(screen.getByPlaceholderText(/search reference/i), 'Acme')
    await waitFor(() => {
      expect(screen.getByText('Acme Co')).toBeInTheDocument()
    })
  })

  it('selecting a result calls onSelectRequest with the raw request and closes the drawer', async () => {
    server.use(http.get('/api/request/', () => HttpResponse.json(sampleResults)))
    const { props } = renderDrawer()
    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText(/search reference/i), 'Acme')
    await waitFor(() => {
      expect(screen.getByText('Acme Co')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Acme Co'))
    expect(props.onSelectRequest).toHaveBeenCalledWith(sampleResults[0])
    expect(props.onClose).not.toHaveBeenCalled() // Calendar.jsx closes the drawer itself via onSelectRequest
  })

  it('shows a "No appointments found" message when the search returns nothing', async () => {
    server.use(http.get('/api/request/', () => HttpResponse.json([])))
    const user = userEvent.setup()
    renderDrawer()
    await user.type(screen.getByPlaceholderText(/search reference/i), 'Nothing')
    await waitFor(() => {
      expect(screen.getByText(/no appointments found/i)).toBeInTheDocument()
    })
  })

  it('calls onClose when the close button is clicked', async () => {
    const { props } = renderDrawer()
    const user = userEvent.setup()
    await user.click(screen.getByLabelText(/close search/i))
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })
})
