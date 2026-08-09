/**
 * Component tests for src/components/FormActions.jsx
 *
 * FormActions is a pure render component: given props, it renders the
 * appropriate action buttons for the current workflow state.
 *
 * Test strategy: render with minimal props, assert which buttons are visible
 * and whether they are enabled/disabled.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { LocalizationProvider } from '@mui/x-date-pickers'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import FormActions from '../../components/FormActions.jsx'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = '2025-12-01T10:00:00.000Z'

const defaultHandlers = {
  handleChange: vi.fn(),
  handleButton: vi.fn(),
  updateRequest: vi.fn(),
  handleNewRequest: vi.fn(),
  handleApprove: vi.fn(),
  setCancelConfirmOpen: vi.fn(),
  setDeclineConfirmOpen: vi.fn(),
  onPaperworkScannedChange: vi.fn(),
}

const baseRequestData = {
  approved: true,
  check_in_time: null,
  docked_time: null,
  completed_time: null,
  container_drop: false,
  dock_number: null,
  driver_phone_number: null,
  sms_consent: false,
}

function renderFormActions(overrides = {}) {
  const props = {
    requestData: { ...baseRequestData, ...overrides.requestData },
    path: overrides.path ?? '/Calendar',
    editAppointment: overrides.editAppointment ?? false,
    driverPhoneError: overrides.driverPhoneError ?? false,
    formAlert: overrides.formAlert ?? null,
    submitButtonDisabled: overrides.submitButtonDisabled ?? false,
    isSubmitting: overrides.isSubmitting ?? false,
    paperworkScanned: overrides.paperworkScanned ?? false,
    ...defaultHandlers,
    ...overrides.handlers,
  }

  return render(
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <MemoryRouter>
        <FormActions {...props} />
      </MemoryRouter>
    </LocalizationProvider>
  )
}

// ---------------------------------------------------------------------------
// /PendingRequests path
// ---------------------------------------------------------------------------

describe('/PendingRequests', () => {
  it('renders Decline and Approve buttons', () => {
    renderFormActions({ path: '/PendingRequests' })
    expect(screen.getByRole('button', { name: /decline/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument()
  })

  it('disables Approve when submitButtonDisabled=true', () => {
    renderFormActions({ path: '/PendingRequests', submitButtonDisabled: true })
    expect(screen.getByRole('button', { name: /approve/i })).toBeDisabled()
  })

  it('disables both buttons when isSubmitting=true', () => {
    renderFormActions({ path: '/PendingRequests', isSubmitting: true })
    expect(screen.getByRole('button', { name: /decline/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /approve/i })).toBeDisabled()
  })
})

// ---------------------------------------------------------------------------
// /RequestForm path (or unapproved request)
// ---------------------------------------------------------------------------

describe('/RequestForm', () => {
  it('renders Submit button', () => {
    renderFormActions({ path: '/RequestForm' })
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument()
  })
})

describe('/Calendar with approved=false', () => {
  it('renders Submit button when request is not yet approved', () => {
    renderFormActions({ requestData: { ...baseRequestData, approved: false } })
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// /Calendar — pre-check-in states
// ---------------------------------------------------------------------------

describe('/Calendar approved, not checked in', () => {
  it('renders Check-In button when not editing', () => {
    renderFormActions()
    expect(screen.getByRole('button', { name: /check-in/i })).toBeInTheDocument()
  })

  it('Check-In is enabled when no driver phone number (field is optional)', () => {
    renderFormActions({ requestData: { ...baseRequestData, driver_phone_number: null } })
    expect(screen.getByRole('button', { name: /check-in/i })).not.toBeDisabled()
  })

  it('Check-In is disabled when driverPhoneError=true', () => {
    renderFormActions({
      requestData: { ...baseRequestData, driver_phone_number: '555123456' },
      driverPhoneError: true,
    })
    expect(screen.getByRole('button', { name: /check-in/i })).toBeDisabled()
  })

  it('renders Cancel Appointment and Save Changes buttons when editAppointment=true', () => {
    renderFormActions({ editAppointment: true })
    expect(screen.getByRole('button', { name: /cancel appointment/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
  })

  it('does NOT render Check-In when editAppointment=true', () => {
    renderFormActions({ editAppointment: true })
    expect(screen.queryByRole('button', { name: /check-in/i })).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// /Calendar — checked in, not docked
// ---------------------------------------------------------------------------

describe('/Calendar checked in, not docked', () => {
  const checkedIn = { ...baseRequestData, check_in_time: NOW }

  it('renders Send To Dock button when container_drop=false', () => {
    renderFormActions({ requestData: checkedIn })
    expect(screen.getByRole('button', { name: /send to dock/i })).toBeInTheDocument()
  })

  it('renders Send To Yard button when container_drop=true', () => {
    renderFormActions({ requestData: { ...checkedIn, container_drop: true } })
    expect(screen.getByRole('button', { name: /send to yard/i })).toBeInTheDocument()
  })

  it('Send To Dock is disabled when formAlert has onAcknowledge', () => {
    renderFormActions({
      requestData: checkedIn,
      formAlert: { message: 'Warning', severity: 'warning', onAcknowledge: vi.fn() },
    })
    expect(screen.getByRole('button', { name: /send to dock/i })).toBeDisabled()
  })

  it('checking Drop in Yard opens a warning dialog instead of calling handleChange immediately', async () => {
    const handlers = { handleChange: vi.fn() }
    const user = userEvent.setup()
    renderFormActions({ requestData: checkedIn, handlers })
    await user.click(screen.getByLabelText(/drop in yard/i))
    expect(screen.getByText(/move the appointment to the all-day section/i)).toBeInTheDocument()
    expect(handlers.handleChange).not.toHaveBeenCalled()
  })

  it('"Go Back" dismisses the yard-drop warning without calling handleChange', async () => {
    const handlers = { handleChange: vi.fn() }
    const user = userEvent.setup()
    renderFormActions({ requestData: checkedIn, handlers })
    await user.click(screen.getByLabelText(/drop in yard/i))
    await user.click(screen.getByRole('button', { name: /go back/i }))
    await waitFor(() => {
      expect(screen.queryByText(/move the appointment to the all-day section/i)).not.toBeInTheDocument()
    })
    expect(handlers.handleChange).not.toHaveBeenCalled()
  })

  it('"Proceed" confirms the yard-drop warning and calls handleChange with container_drop=true', async () => {
    const handlers = { handleChange: vi.fn() }
    const user = userEvent.setup()
    renderFormActions({ requestData: checkedIn, handlers })
    await user.click(screen.getByLabelText(/drop in yard/i))
    await user.click(screen.getByRole('button', { name: /proceed/i }))
    expect(handlers.handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({ name: 'container_drop', checked: true }),
      })
    )
  })
})

// ---------------------------------------------------------------------------
// /Calendar — docked, not completed
// ---------------------------------------------------------------------------

describe('/Calendar docked, not completed', () => {
  const docked = { ...baseRequestData, check_in_time: NOW, docked_time: NOW }

  it('renders Complete button', () => {
    renderFormActions({ requestData: docked })
    expect(screen.getByRole('button', { name: /complete/i })).toBeInTheDocument()
  })

  it('renders a Paperwork Scanned checkbox', () => {
    renderFormActions({ requestData: docked })
    expect(screen.getByLabelText(/paperwork scanned/i)).toBeInTheDocument()
  })

  it('Complete is disabled until Paperwork Scanned is checked', () => {
    renderFormActions({ requestData: docked, paperworkScanned: false })
    expect(screen.getByRole('button', { name: /complete/i })).toBeDisabled()
  })

  it('Complete is enabled once Paperwork Scanned is checked', () => {
    renderFormActions({ requestData: docked, paperworkScanned: true })
    expect(screen.getByRole('button', { name: /complete/i })).not.toBeDisabled()
  })

  it('checking Paperwork Scanned calls onPaperworkScannedChange', async () => {
    const handlers = { onPaperworkScannedChange: vi.fn() }
    const user = userEvent.setup()
    renderFormActions({ requestData: docked, handlers })
    await user.click(screen.getByLabelText(/paperwork scanned/i))
    expect(handlers.onPaperworkScannedChange).toHaveBeenCalledTimes(1)
  })
})

// ---------------------------------------------------------------------------
// /Calendar — completed
// ---------------------------------------------------------------------------

describe('/Calendar completed', () => {
  it('renders Remove from Calendar button', () => {
    renderFormActions({
      requestData: {
        ...baseRequestData,
        check_in_time: NOW,
        docked_time: NOW,
        completed_time: NOW,
      },
    })
    expect(screen.getByRole('button', { name: /remove from calendar/i })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Unknown path
// ---------------------------------------------------------------------------

describe('unknown path', () => {
  it('renders nothing for an unrecognized path', () => {
    const { container } = renderFormActions({ path: '/UnknownPath' })
    expect(container).toBeEmptyDOMElement()
  })
})
