/**
 * Tests for src/routes/AuditLog.jsx (the /AuditLog page).
 *
 * The page reads two server-paged endpoints (/api/audit/events/ and
 * /api/audit/notifications/, both mocked with MSW), passes the current filters
 * as query params, and downloads a CSV of the same filters via axios.
 *
 * atoms.jsx is mocked with plain atoms (see HeaderBar.test.jsx for why).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { atom, createStore, Provider } from 'jotai'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import dayjs from 'dayjs'

import { server } from '../mocks/server.js'

const WAREHOUSES = [
  { id: 'wh-1', name: 'Main' },
  { id: 'wh-2', name: 'Annex' },
]

const _authenticatedAtom = atom(true)
const _authCheckedAtom = atom(true)
const _userGroupsAtom = atom(['Dispatch'])
const _warehouseDataAtom = atom(WAREHOUSES)

vi.mock('../../components/atoms.jsx', () => ({
  authenticatedAtom: _authenticatedAtom,
  authCheckedAtom: _authCheckedAtom,
  userGroupsAtom: _userGroupsAtom,
  warehouseDataEffectAtom: atom((get) => get(_warehouseDataAtom), () => {}),
}))

const { default: AuditLog } = await import('../../routes/AuditLog.jsx')

const FMT = 'MM/DD/YYYY hh:mm A'

function makeEvent(i, overrides = {}) {
  return {
    id: `ev-${i}`,
    appointment: `appt-${i}`,
    appointment_ref: `REF-${i};PO-${i}`,
    appointment_company: `Carrier ${i}`,
    warehouse: 'wh-1',
    warehouse_name: 'Main',
    actor: 3,
    actor_name: 'Dana Smith',
    action: 'approved',
    changes: {},
    occurred_at: '2026-09-29T14:03:00-04:00',
    ...overrides,
  }
}

function makeNotification(i, overrides = {}) {
  return {
    id: `n-${i}`,
    appointment: `appt-${i}`,
    appointment_ref: `REF-${i}`,
    appointment_company: `Carrier ${i}`,
    warehouse_name: 'Main',
    channel: 'email',
    recipient: `driver${i}@example.com`,
    kind: 'approval',
    subject: `Appointment Request Approved - #REF-${i}`,
    status: 'sent',
    error: '',
    sent_at: '2026-09-29T15:00:00-04:00',
    ...overrides,
  }
}

const paged = (results, count = results.length) =>
  HttpResponse.json({ count, next: null, previous: null, results })

let eventRequests
let notificationRequests

beforeEach(() => {
  eventRequests = []
  notificationRequests = []
  server.use(
    http.get('/api/audit/actors/', () =>
      HttpResponse.json([
        { id: 3, name: 'Dana Smith' },
        { id: 7, name: 'Lee Park' },
      ])
    ),
    http.get('/api/audit/events/', ({ request }) => {
      const params = new URL(request.url).searchParams
      eventRequests.push(params)
      return paged([
        makeEvent(1, {
          action: 'edited',
          changes: { date_time: ['2026-09-30T08:00:00-04:00', '2026-10-01T13:00:00-04:00'] },
        }),
        makeEvent(2, { action: 'created', actor: null, actor_name: 'Request form', occurred_at: null }),
      ], 120)
    }),
    http.get('/api/audit/notifications/', ({ request }) => {
      const params = new URL(request.url).searchParams
      notificationRequests.push(params)
      return paged([
        makeNotification(1),
        makeNotification(2, { channel: 'sms', kind: 'dock_ready', status: 'failed', subject: '', error: 'Twilio down', recipient: '5551234567' }),
      ])
    })
  )
})

function renderPage({ userGroups = ['Dispatch'], authenticated = true, authChecked = true } = {}) {
  const store = createStore()
  store.set(_userGroupsAtom, userGroups)
  store.set(_authenticatedAtom, authenticated)
  store.set(_authCheckedAtom, authChecked)
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/AuditLog']}>
          <Routes>
            <Route path="/AuditLog" element={<AuditLog />} />
            <Route path="/Calendar" element={<div>Calendar page</div>} />
            <Route path="/login" element={<div>Login page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>
  )
}

const lastEventParams = () => eventRequests[eventRequests.length - 1]
const lastNotificationParams = () => notificationRequests[notificationRequests.length - 1]

async function pickOption(user, comboboxName, optionName) {
  await user.click(screen.getByRole('combobox', { name: comboboxName }))
  const listbox = await screen.findByRole('listbox')
  await user.click(within(listbox).getByRole('option', { name: optionName }))
}

describe('access', () => {
  it('redirects Dock users to the calendar', async () => {
    renderPage({ userGroups: ['Dock'] })
    expect(await screen.findByText('Calendar page')).toBeInTheDocument()
  })

  it('redirects anonymous users to login', async () => {
    renderPage({ authenticated: false, userGroups: [] })
    expect(await screen.findByText('Login page')).toBeInTheDocument()
  })

  it('does not redirect before the first auth check has finished', async () => {
    renderPage({ authenticated: false, authChecked: false, userGroups: [] })
    await new Promise((r) => setTimeout(r, 30))
    expect(screen.queryByText('Login page')).not.toBeInTheDocument()
  })

  it('renders for Admin users', async () => {
    renderPage({ userGroups: ['Admin'] })
    expect(await screen.findByTestId('audit-events-table')).toBeInTheDocument()
  })
})

describe('Appointment activity tab', () => {
  it('shows both tabs, defaulting to Appointment activity', async () => {
    renderPage()
    expect(screen.getByRole('tab', { name: 'Appointment activity' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'Notifications' })).toBeInTheDocument()
    expect(await screen.findByTestId('audit-events-table')).toBeInTheDocument()
  })

  it('requests page 1 with the default page size and renders rows', async () => {
    renderPage()
    const table = await screen.findByTestId('audit-events-table')
    await waitFor(() => expect(within(table).getAllByTestId('audit-row')).toHaveLength(2))
    expect(lastEventParams().get('page')).toBe('1')
    expect(lastEventParams().get('page_size')).toBe('50')
    const rows = within(table).getAllByTestId('audit-row')
    expect(rows[0].textContent).toContain('Edited')
    expect(rows[0].textContent).toContain('Dana Smith')
    expect(rows[0].textContent).toContain('REF-1, PO-1')
    expect(rows[0].textContent).toContain(
      `Appointment date and time: ${dayjs('2026-09-30T08:00:00-04:00').format(FMT)} → ${dayjs('2026-10-01T13:00:00-04:00').format(FMT)}`
    )
    expect(rows[1].textContent).toContain('Request form')
    expect(rows[1].textContent).toContain('date unknown')
  })

  it('pages on the server via TablePagination', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findAllByTestId('audit-row')
    expect(screen.getByText('1–50 of 120')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /next page/i }))
    await waitFor(() => expect(lastEventParams().get('page')).toBe('2'))
  })

  it('sends person, action, warehouse and date filters and resets to page 1', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findAllByTestId('audit-row')
    await user.click(screen.getByRole('button', { name: /next page/i }))
    await waitFor(() => expect(lastEventParams().get('page')).toBe('2'))

    await pickOption(user, 'Person', 'Lee Park')
    await waitFor(() => expect(lastEventParams().get('actor')).toBe('7'))
    expect(lastEventParams().get('page')).toBe('1')

    await pickOption(user, 'Action', 'Edited')
    await user.click(within(screen.getByRole('listbox')).getByRole('option', { name: 'Cancelled' }))
    await user.keyboard('{Escape}')
    await waitFor(() => expect(lastEventParams().get('action')).toBe('edited,cancelled'))

    await pickOption(user, 'Warehouse', 'Annex')
    await waitFor(() => expect(lastEventParams().get('warehouse')).toBe('wh-2'))

    await user.type(screen.getByLabelText('From'), '2026-09-01')
    await user.type(screen.getByLabelText('To'), '2026-09-30')
    await waitFor(() => {
      expect(lastEventParams().get('start')).toBe('2026-09-01')
      expect(lastEventParams().get('end')).toBe('2026-09-30')
    })
  })

  it('offers "Request form / unknown" as a person filter (actor=none)', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findAllByTestId('audit-row')
    await pickOption(user, 'Person', 'Request form / unknown')
    await waitFor(() => expect(lastEventParams().get('actor')).toBe('none'))
  })

  it('shows the empty state', async () => {
    server.use(http.get('/api/audit/events/', () => paged([])))
    renderPage()
    expect(await screen.findByText('No activity matches these filters.')).toBeInTheDocument()
  })

  it('shows the error state', async () => {
    server.use(http.get('/api/audit/events/', () => HttpResponse.json({ detail: 'Nope' }, { status: 500 })))
    renderPage()
    expect(
      await screen.findByText(/error loading audit log: nope/i, {}, { timeout: 3000 })
    ).toBeInTheDocument()
  })

  it('shows a loading state', async () => {
    server.use(
      http.get('/api/audit/events/', async () => {
        await new Promise((r) => setTimeout(r, 50))
        return paged([])
      })
    )
    renderPage()
    expect(screen.getByText('Loading...')).toBeInTheDocument()
    expect(await screen.findByText('No activity matches these filters.')).toBeInTheDocument()
  })
})

describe('Notifications tab', () => {
  async function openTab(user) {
    await user.click(screen.getByRole('tab', { name: 'Notifications' }))
    return screen.findByTestId('audit-notifications-table')
  }

  it('renders notifications with channel, type, status, recipient, subject and error', async () => {
    const user = userEvent.setup()
    renderPage()
    const table = await openTab(user)
    const rows = await within(table).findAllByTestId('audit-row')
    expect(rows).toHaveLength(2)
    expect(rows[0].textContent).toContain('Email')
    expect(rows[0].textContent).toContain('Approval')
    expect(rows[0].textContent).toContain('Sent')
    expect(rows[0].textContent).toContain('driver1@example.com')
    expect(rows[0].textContent).toContain('Appointment Request Approved - #REF-1')
    expect(rows[1].textContent).toContain('SMS')
    expect(rows[1].textContent).toContain('Dock ready')
    expect(rows[1].textContent).toContain('Failed')
    expect(rows[1].textContent).toContain('Twilio down')
    expect(lastNotificationParams().get('page')).toBe('1')
  })

  it('sends channel, type, status, warehouse, date and recipient filters', async () => {
    const user = userEvent.setup()
    renderPage()
    await openTab(user)
    await screen.findAllByTestId('audit-row')

    await pickOption(user, 'Channel', 'SMS')
    await waitFor(() => expect(lastNotificationParams().get('channel')).toBe('sms'))

    await pickOption(user, 'Type', 'Dock ready')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(lastNotificationParams().get('kind')).toBe('dock_ready'))

    await pickOption(user, 'Status', 'Failed')
    await waitFor(() => expect(lastNotificationParams().get('status')).toBe('failed'))

    await pickOption(user, 'Warehouse', 'Main')
    await waitFor(() => expect(lastNotificationParams().get('warehouse')).toBe('wh-1'))

    await user.type(screen.getByLabelText('From'), '2026-09-01')
    await waitFor(() => expect(lastNotificationParams().get('start')).toBe('2026-09-01'))

    await user.type(screen.getByLabelText('Recipient'), 'driver')
    await waitFor(() => expect(lastNotificationParams().get('recipient')).toBe('driver'))
  })

  it('shows the empty state', async () => {
    server.use(http.get('/api/audit/notifications/', () => paged([])))
    const user = userEvent.setup()
    renderPage()
    await openTab(user)
    expect(await screen.findByText('No notifications match these filters.')).toBeInTheDocument()
  })
})

describe('Export CSV', () => {
  let createObjectURL
  let revokeObjectURL
  let clickSpy

  beforeEach(() => {
    createObjectURL = vi.fn(() => 'blob:mock')
    revokeObjectURL = vi.fn()
    window.URL.createObjectURL = createObjectURL
    window.URL.revokeObjectURL = revokeObjectURL
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })

  afterEach(() => {
    clickSpy.mockRestore()
  })

  it('downloads the events CSV with the current filters and export=csv', async () => {
    let exportParams = null
    server.use(
      http.get('/api/audit/events/', ({ request }) => {
        const params = new URL(request.url).searchParams
        if (params.get('export') === 'csv') {
          exportParams = params
          return new HttpResponse('occurred_at,action\n', {
            headers: {
              'Content-Type': 'text/csv',
              'Content-Disposition': 'attachment; filename="audit-events.csv"',
            },
          })
        }
        eventRequests.push(params)
        return paged([makeEvent(1)])
      })
    )
    const user = userEvent.setup()
    renderPage()
    await screen.findAllByTestId('audit-row')
    await pickOption(user, 'Person', 'Dana Smith')
    await waitFor(() => expect(lastEventParams().get('actor')).toBe('3'))

    await user.click(screen.getByRole('button', { name: /export csv/i }))
    await waitFor(() => expect(clickSpy).toHaveBeenCalled())
    expect(exportParams.get('actor')).toBe('3')
    expect(exportParams.get('page')).toBeNull()
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    const anchor = clickSpy.mock.contexts[0]
    expect(anchor.download).toBe('audit-events.csv')
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock')
  })

  it('downloads the notifications CSV with export=csv', async () => {
    let exportParams = null
    server.use(
      http.get('/api/audit/notifications/', ({ request }) => {
        const params = new URL(request.url).searchParams
        if (params.get('export') === 'csv') {
          exportParams = params
          return new HttpResponse('sent_at\n', { headers: { 'Content-Type': 'text/csv' } })
        }
        notificationRequests.push(params)
        return paged([makeNotification(1)])
      })
    )
    const user = userEvent.setup()
    renderPage()
    await user.click(screen.getByRole('tab', { name: 'Notifications' }))
    await screen.findAllByTestId('audit-row')
    await pickOption(user, 'Status', 'Sent')
    await waitFor(() => expect(lastNotificationParams().get('status')).toBe('sent'))
    await user.click(screen.getByRole('button', { name: /export csv/i }))
    await waitFor(() => expect(clickSpy).toHaveBeenCalled())
    expect(exportParams.get('status')).toBe('sent')
    expect(clickSpy.mock.contexts[0].download).toBe('notifications.csv')
  })

  it('shows an error when the export fails', async () => {
    server.use(
      http.get('/api/audit/events/', ({ request }) => {
        const params = new URL(request.url).searchParams
        if (params.get('export') === 'csv') return new HttpResponse(null, { status: 500 })
        return paged([makeEvent(1)])
      })
    )
    const user = userEvent.setup()
    renderPage()
    await screen.findAllByTestId('audit-row')
    await user.click(screen.getByRole('button', { name: /export csv/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/export failed/i)
    expect(clickSpy).not.toHaveBeenCalled()
  })
})
