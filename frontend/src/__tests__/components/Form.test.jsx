/**
 * Component tests for the load configuration dropdown in src/components/Form.jsx
 *
 * "Palletized or Floor Loaded" (requestData.load_config) is delivery-only: it
 * appears directly under "Select Pickup or Delivery" once Delivery is chosen,
 * and never for a pickup. The field is optional — appointments saved before it
 * existed come back with load_config: null and must still render and submit.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Provider, createStore } from 'jotai'
import { LocalizationProvider } from '@mui/x-date-pickers'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { http, HttpResponse } from 'msw'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezonePlugin from 'dayjs/plugin/timezone'
import { server } from '../mocks/server.js'
import Form from '../../components/Form.jsx'

// main.jsx normally installs these; the date pickers need them to honour the
// warehouse timezone.
dayjs.extend(utc)
dayjs.extend(timezonePlugin)

const WAREHOUSE = {
  id: 'wh-1',
  name: 'Test Warehouse',
  address: '123 Test St',
  phone_number: '5551234567',
  timezone: 'America/New_York',
  color: '#02B40B',
  appointments_per_slot: 1,
}

const CUSTOMER = {
  id: 'cust-1',
  customer_name: 'Acme Corp',
  email_address: 'acme@example.com',
  send_email_updates: false,
}

/** A pending delivery as the backend returns it, i.e. with a nested customer. */
function makeRequest(overrides = {}) {
  return {
    id: 'req-1',
    approved: false,
    active: true,
    company_name: 'Pending Co',
    customer_name: CUSTOMER.customer_name,
    customer: CUSTOMER,
    phone_number: '5551234567',
    email: 'pending@example.com',
    warehouse: WAREHOUSE.id,
    ref_number: 'PO-1',
    load_type: 'Full',
    container_drop: false,
    container_number: '',
    note_section: '',
    date_time: '2026-12-01T14:00:00.000Z',
    appointment_length: 15,
    delivery: true,
    load_config: null,
    trailer_number: '',
    driver_phone_number: null,
    sms_consent: false,
    dock_number: null,
    check_in_time: null,
    docked_time: null,
    completed_time: null,
    cancelled_time: null,
    ...overrides,
  }
}

beforeEach(() => {
  window.localStorage.clear()
  server.use(
    http.get('/api/warehouse', () => HttpResponse.json([WAREHOUSE])),
    http.get('/api/customer/', () => HttpResponse.json([CUSTOMER])),
    http.get('/api/request/', () => HttpResponse.json([]))
  )
})

function renderForm({ path = '/RequestForm', request = undefined } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <Provider store={createStore()}>
      <QueryClientProvider client={queryClient}>
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <MemoryRouter initialEntries={[path]}>
            <Form request={request} closeModal={() => {}} />
          </MemoryRouter>
        </LocalizationProvider>
      </QueryClientProvider>
    </Provider>
  )
}

const deliverySelect = () =>
  screen.getByRole('combobox', { name: /select pickup or delivery/i })

const loadConfigSelect = () =>
  screen.queryByRole('combobox', { name: /palletized or floor loaded/i })

// Every select in Form.jsx renders its menu with disablePortal, which makes MUI
// mark the surrounding container aria-hidden while the menu is open — so the
// options are only reachable with `hidden: true`.
const openOptions = () => screen.findAllByRole('option', { hidden: true })

async function pickOption(user, combobox, optionName) {
  await user.click(combobox)
  const options = await openOptions()
  await user.click(options.find((o) => o.textContent === optionName))
}

/** The value the form will actually submit, read off MUI's hidden input. */
const submittedLoadConfig = () =>
  document.querySelector('input[name="load_config"]')?.value

// ---------------------------------------------------------------------------
// Conditional rendering
// ---------------------------------------------------------------------------

describe('load configuration dropdown visibility', () => {
  it('is hidden until Pickup or Delivery is chosen', async () => {
    renderForm()
    await screen.findByRole('combobox', { name: /select pickup or delivery/i })
    expect(loadConfigSelect()).not.toBeInTheDocument()
  })

  it('appears with exactly Palletized and Floor Loaded when Delivery is chosen', async () => {
    const user = userEvent.setup()
    renderForm()
    await pickOption(user, deliverySelect(), 'Delivery')

    const select = loadConfigSelect()
    expect(select).toBeInTheDocument()

    await user.click(select)
    const options = await openOptions()
    expect(options.map((o) => o.textContent)).toEqual(['Palletized', 'Floor Loaded'])
  })

  it('stays hidden when Pickup is chosen', async () => {
    const user = userEvent.setup()
    renderForm()
    await pickOption(user, deliverySelect(), 'Pickup')
    expect(loadConfigSelect()).not.toBeInTheDocument()
  })

  it('hides and clears the chosen value when Delivery is switched to Pickup', async () => {
    const user = userEvent.setup()
    renderForm()
    await pickOption(user, deliverySelect(), 'Delivery')
    await pickOption(user, loadConfigSelect(), 'Palletized')
    expect(submittedLoadConfig()).toBe('Palletized')

    await pickOption(user, deliverySelect(), 'Pickup')
    expect(loadConfigSelect()).not.toBeInTheDocument()

    // Back to Delivery: the stale Palletized must not have survived the round trip.
    await pickOption(user, deliverySelect(), 'Delivery')
    expect(submittedLoadConfig()).toBe('')
  })
})

// ---------------------------------------------------------------------------
// Existing appointments
// ---------------------------------------------------------------------------

describe('existing appointments', () => {
  it('shows the saved configuration for a delivery that has one', async () => {
    renderForm({ path: '/PendingRequests', request: makeRequest({ load_config: 'Floor Loaded' }) })
    expect(await screen.findByRole('combobox', { name: /palletized or floor loaded/i }))
      .toHaveTextContent('Floor Loaded')
  })

  it('renders an empty dropdown for a delivery saved before the field existed', async () => {
    renderForm({ path: '/PendingRequests', request: makeRequest({ load_config: null }) })
    const select = await screen.findByRole('combobox', { name: /palletized or floor loaded/i })
    // MUI renders a zero-width space as the placeholder for an empty select.
    expect(select.textContent.replace(/\u200b/g, '').trim()).toBe('')
    expect(submittedLoadConfig()).toBe('')
  })

  it('does not render the dropdown for an existing pickup', async () => {
    renderForm({
      path: '/PendingRequests',
      request: makeRequest({ delivery: false, load_config: null }),
    })
    await screen.findByRole('combobox', { name: /select pickup or delivery/i })
    expect(loadConfigSelect()).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Submitted payload
// ---------------------------------------------------------------------------

describe('submitted payload', () => {
  function captureUpdate() {
    const captured = {}
    server.use(
      http.put('/api/request/:id/', async ({ request }) => {
        captured.body = await request.json()
        return HttpResponse.json(captured.body)
      })
    )
    return captured
  }

  it('sends the newly chosen configuration on approve', async () => {
    const user = userEvent.setup()
    const captured = captureUpdate()
    renderForm({ path: '/PendingRequests', request: makeRequest({ load_config: null }) })

    await pickOption(
      user,
      await screen.findByRole('combobox', { name: /palletized or floor loaded/i }),
      'Palletized'
    )
    await user.click(screen.getByRole('button', { name: /approve/i }))

    await waitFor(() => expect(captured.body).toBeTruthy())
    expect(captured.body.load_config).toBe('Palletized')
    expect(captured.body.delivery).toBe(true)
  })

  it('sends null when the appointment is switched to a pickup', async () => {
    const user = userEvent.setup()
    const captured = captureUpdate()
    renderForm({ path: '/PendingRequests', request: makeRequest({ load_config: 'Palletized' }) })

    await pickOption(user, await screen.findByRole('combobox', { name: /select pickup or delivery/i }), 'Pickup')
    await user.click(screen.getByRole('button', { name: /approve/i }))

    await waitFor(() => expect(captured.body).toBeTruthy())
    expect(captured.body.load_config).toBeNull()
    expect(captured.body.delivery).toBe(false)
  })

  it('sends null for a delivery left without a configuration', async () => {
    const user = userEvent.setup()
    const captured = captureUpdate()
    renderForm({ path: '/PendingRequests', request: makeRequest({ load_config: null }) })

    await user.click(await screen.findByRole('button', { name: /approve/i }))

    await waitFor(() => expect(captured.body).toBeTruthy())
    expect(captured.body.load_config).toBeNull()
  })
})
