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
import { render, screen } from '@testing-library/react'
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
})

// ---------------------------------------------------------------------------
// /Calendar — docked, not completed
// ---------------------------------------------------------------------------

describe('/Calendar docked, not completed', () => {
  it('renders Complete button', () => {
    renderFormActions({
      requestData: { ...baseRequestData, check_in_time: NOW, docked_time: NOW },
    })
    expect(screen.getByRole('button', { name: /complete/i })).toBeInTheDocument()
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
