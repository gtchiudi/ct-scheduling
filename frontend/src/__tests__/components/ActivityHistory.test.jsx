/**
 * Component tests for src/components/ActivityHistory.jsx
 *
 * The component fetches GET /api/audit/timeline/?appointment=<id> (mocked via
 * MSW) and renders actions and notifications as one timeline. It must render
 * nothing at all for Dock users or when there is no appointment id.
 *
 * atoms.jsx is mocked with plain atoms (see HeaderBar.test.jsx for why).
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import { atom, createStore, Provider } from 'jotai'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { MemoryRouter } from 'react-router-dom'
import dayjs from 'dayjs'

import { server } from '../mocks/server.js'

const _userGroupsAtom = atom([])

vi.mock('../../components/atoms.jsx', () => ({
  userGroupsAtom: _userGroupsAtom,
  // Atoms Calendar.jsx imports, for the CustomViewer placement test below
  editAppointmentAtom: atom(false),
  authenticatedAtom: atom(true),
  authCheckedAtom: atom(true),
  isAuthAtom: atom(null, () => {}),
  refreshAtom: atom(false),
  warehouseDataEffectAtom: atom([], () => {}),
  warehouseCheckedAtom: atom([]),
}))

// The appointment form itself is covered by Form.test.jsx; stub it so the
// CustomViewer test only exercises where Activity history is placed.
vi.mock('../../components/Form.jsx', () => ({
  default: () => <div data-testid="appointment-form" />,
  APPOINTMENT_LENGTH_OPTIONS: [],
}))

const { default: ActivityHistory } = await import('../../components/ActivityHistory.jsx')
const { CustomViewer } = await import('../../routes/Calendar.jsx')

const APPT_ID = '11111111-1111-1111-1111-111111111111'
const FMT = 'MM/DD/YYYY hh:mm A'

const TIMELINE = [
  {
    type: 'notification',
    at: '2026-09-29T15:00:00-04:00',
    id: 'n-1',
    channel: 'email',
    kind: 'approval',
    recipient: 'carrier@example.com',
    status: 'sent',
    subject: 'Appointment Request Approved - #REF-1',
    error: '',
  },
  {
    type: 'event',
    at: '2026-09-29T14:03:00-04:00',
    id: 'e-2',
    action: 'edited',
    actor_name: 'Dana Smith',
    changes: {
      date_time: ['2026-09-30T08:00:00-04:00', '2026-10-01T13:00:00-04:00'],
      load_type: ['Full', 'LTL'],
      delivery: [false, true],
    },
  },
  {
    type: 'notification',
    at: '2026-09-29T13:00:00-04:00',
    id: 'n-2',
    channel: 'sms',
    kind: 'dock_ready',
    recipient: '5551234567',
    status: 'failed',
    subject: '',
    error: 'Twilio unavailable',
  },
  {
    type: 'event',
    at: '2026-09-29T12:00:00-04:00',
    id: 'e-1',
    action: 'created',
    actor_name: 'Request form',
    changes: {},
  },
  {
    type: 'event',
    at: null,
    id: 'e-0',
    action: 'approved',
    actor_name: 'Old Approver',
    changes: {},
  },
]

function renderHistory({ userGroups = ['Dispatch'], appointmentId = APPT_ID } = {}) {
  const store = createStore()
  store.set(_userGroupsAtom, userGroups)
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <ActivityHistory appointmentId={appointmentId} />
      </QueryClientProvider>
    </Provider>
  )
}

describe('ActivityHistory', () => {
  it('requests the timeline for the appointment and renders one row per item', async () => {
    let requestedId = null
    server.use(
      http.get('/api/audit/timeline/', ({ request }) => {
        requestedId = new URL(request.url).searchParams.get('appointment')
        return HttpResponse.json(TIMELINE)
      })
    )
    renderHistory()
    expect(screen.getByTestId('activity-history')).toBeInTheDocument()
    expect(screen.getByText('Activity history')).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByTestId('activity-item')).toHaveLength(5))
    expect(requestedId).toBe(APPT_ID)
  })

  it('shows a loading state before the timeline arrives', async () => {
    server.use(
      http.get('/api/audit/timeline/', async () => {
        await new Promise((r) => setTimeout(r, 50))
        return HttpResponse.json([])
      })
    )
    renderHistory()
    expect(screen.getByText(/loading activity/i)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('No activity recorded yet.')).toBeInTheDocument())
  })

  it('shows the empty state when there is no activity', async () => {
    server.use(http.get('/api/audit/timeline/', () => HttpResponse.json([])))
    renderHistory()
    await waitFor(() => expect(screen.getByText('No activity recorded yet.')).toBeInTheDocument())
    expect(screen.queryByTestId('activity-item')).not.toBeInTheDocument()
  })

  it('shows an error state when the request fails', async () => {
    server.use(
      http.get('/api/audit/timeline/', () => HttpResponse.json({ detail: 'boom' }, { status: 500 }))
    )
    renderHistory()
    // The component retries once (1s delay) before surfacing the error.
    expect(
      await screen.findByText(/could not load activity history/i, {}, { timeout: 3000 })
    ).toBeInTheDocument()
  })

  it('renders edits as field-level before → after with friendly labels and formatted datetimes', async () => {
    server.use(http.get('/api/audit/timeline/', () => HttpResponse.json(TIMELINE)))
    renderHistory()
    const items = await screen.findAllByTestId('activity-item')
    const edit = items[1]
    expect(within(edit).getByText('Edited')).toBeInTheDocument()
    expect(within(edit).getByText(/Dana Smith/)).toBeInTheDocument()
    const before = dayjs('2026-09-30T08:00:00-04:00').format(FMT)
    const after = dayjs('2026-10-01T13:00:00-04:00').format(FMT)
    const changes = within(edit).getAllByTestId('activity-change').map((el) => el.textContent)
    expect(changes).toContain(`Appointment date and time: ${before} → ${after}`)
    expect(changes).toContain('Load type: Full → LTL')
    expect(changes).toContain('Pickup or delivery: Pickup → Delivery')
    // Raw field keys and ISO strings never leak through
    expect(edit.textContent).not.toMatch(/date_time|2026-09-30T/)
  })

  it('renders notifications with channel, kind, recipient and subject; failures show the error', async () => {
    server.use(http.get('/api/audit/timeline/', () => HttpResponse.json(TIMELINE)))
    renderHistory()
    const items = await screen.findAllByTestId('activity-item')
    expect(within(items[0]).getByText(/Email sent: Approval/)).toBeInTheDocument()
    expect(within(items[0]).getByText(/carrier@example\.com/)).toBeInTheDocument()
    expect(within(items[0]).getByText('Appointment Request Approved - #REF-1')).toBeInTheDocument()
    expect(within(items[2]).getByText(/SMS failed: Dock ready/)).toBeInTheDocument()
    expect(within(items[2]).getByText('Twilio unavailable')).toBeInTheDocument()
  })

  it('shows the actor and formatted time for actions', async () => {
    server.use(http.get('/api/audit/timeline/', () => HttpResponse.json(TIMELINE)))
    renderHistory()
    const items = await screen.findAllByTestId('activity-item')
    expect(within(items[3]).getByText('Created')).toBeInTheDocument()
    expect(items[3].textContent).toContain(dayjs('2026-09-29T12:00:00-04:00').format(FMT))
    expect(items[3].textContent).toContain('Request form')
  })

  it('shows "date unknown" for items with a null time', async () => {
    server.use(http.get('/api/audit/timeline/', () => HttpResponse.json(TIMELINE)))
    renderHistory()
    const items = await screen.findAllByTestId('activity-item')
    expect(items[4].textContent).toContain('date unknown')
    expect(within(items[4]).getByText('Approved')).toBeInTheDocument()
  })

  it('renders for Admin users', async () => {
    server.use(http.get('/api/audit/timeline/', () => HttpResponse.json([])))
    renderHistory({ userGroups: ['Admin'] })
    expect(screen.getByTestId('activity-history')).toBeInTheDocument()
  })

  it('renders nothing and makes no request for Dock users', async () => {
    let called = false
    server.use(
      http.get('/api/audit/timeline/', () => {
        called = true
        return HttpResponse.json([])
      })
    )
    renderHistory({ userGroups: ['Dock'] })
    await new Promise((r) => setTimeout(r, 30))
    expect(screen.queryByTestId('activity-history')).not.toBeInTheDocument()
    expect(called).toBe(false)
  })

  it('renders nothing for a new appointment (no id)', async () => {
    let called = false
    server.use(
      http.get('/api/audit/timeline/', () => {
        called = true
        return HttpResponse.json([])
      })
    )
    renderHistory({ appointmentId: null })
    await new Promise((r) => setTimeout(r, 30))
    expect(screen.queryByTestId('activity-history')).not.toBeInTheDocument()
    expect(called).toBe(false)
  })
})

describe('placement in the appointment window (Calendar CustomViewer)', () => {
  function renderViewer(userGroups) {
    const store = createStore()
    store.set(_userGroupsAtom, userGroups)
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <CustomViewer event={{ request: { id: APPT_ID, ref_number: 'REF-1', check_in_time: null } }} />
          </MemoryRouter>
        </QueryClientProvider>
      </Provider>
    )
  }

  it('shows Activity history below the form for Dispatch', async () => {
    server.use(http.get('/api/audit/timeline/', () => HttpResponse.json(TIMELINE)))
    renderViewer(['Dispatch'])
    const history = await screen.findByTestId('activity-history')
    const form = screen.getByTestId('appointment-form')
    // history comes after the form in document order
    expect(form.compareDocumentPosition(history) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await waitFor(() => expect(within(history).getAllByTestId('activity-item')).toHaveLength(5))
  })

  it('does not show Activity history for Dock', async () => {
    renderViewer(['Dock'])
    expect(await screen.findByTestId('appointment-form')).toBeInTheDocument()
    expect(screen.queryByTestId('activity-history')).not.toBeInTheDocument()
  })
})
