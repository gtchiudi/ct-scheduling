/**
 * Component tests for src/components/HeaderBar.jsx
 *
 * HeaderBar renders nav links conditionally based on:
 *   - authenticatedAtom (boolean)
 *   - userGroupsAtom (string[])
 *   - useLocation().pathname
 *   - Pending request stats API (mocked via MSW)
 *
 * Why we mock atoms.jsx:
 *   Several atoms use atomWithStorage + onMount side effects (e.g., isAuthAtom
 *   resets authenticatedAtom to false when no localStorage token is present).
 *   Mocking atoms.jsx gives plain atoms with no side effects, so tests stay
 *   deterministic without needing real tokens in localStorage.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { atom, createStore, Provider } from 'jotai'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'

import { server } from '../mocks/server.js'

// ---------------------------------------------------------------------------
// Stable atom instances shared between mock and tests
// ---------------------------------------------------------------------------
const _authenticatedAtom = atom(false)
const _userGroupsAtom = atom([])
const _userInitialAtom = atom('U')

vi.mock('../../components/atoms.jsx', () => ({
  authenticatedAtom: _authenticatedAtom,
  userGroupsAtom: _userGroupsAtom,
  userInitialAtom: _userInitialAtom,
  isAuthAtom: atom(null, () => {}),
  // Provide any other atoms the component tree may reference
  editAppointmentAtom: atom(false),
  refreshAtom: atom(false),
}))

// Import AFTER mock is registered
const { default: HeaderBar } = await import('../../components/HeaderBar.jsx')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderHeaderBar({
  authenticated = false,
  userGroups = [],
  userInitial = 'T',
  path = '/',
} = {}) {
  const store = createStore()
  store.set(_authenticatedAtom, authenticated)
  store.set(_userGroupsAtom, userGroups)
  store.set(_userInitialAtom, userInitial)

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  return render(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[path]}>
          <HeaderBar />
        </MemoryRouter>
      </QueryClientProvider>
    </Provider>
  )
}

// ---------------------------------------------------------------------------
// Unauthenticated
// ---------------------------------------------------------------------------

describe('unauthenticated user', () => {
  it('renders Login button', () => {
    renderHeaderBar()
    expect(screen.getByText(/login/i)).toBeInTheDocument()
  })

  it('does not render the User Menu (Avatar) button', () => {
    renderHeaderBar()
    expect(screen.queryByRole('button', { name: /user menu/i })).not.toBeInTheDocument()
  })

  it('renders the REQUEST PICKUP/DELIVERY nav link', () => {
    renderHeaderBar()
    expect(screen.getByText(/request pickup\/delivery/i)).toBeInTheDocument()
  })

  it('does not show Pending Requests or Calendar links', () => {
    renderHeaderBar()
    expect(screen.queryByText(/pending requests/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^calendar$/i)).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Dispatch user — home page
// ---------------------------------------------------------------------------

describe('authenticated Dispatch user on /', () => {
  it('renders Pending Requests button', () => {
    renderHeaderBar({ authenticated: true, userGroups: ['Dispatch'], path: '/' })
    // Nav links now render both in the desktop button row and in the user
    // avatar menu (shown below md instead of a separate hamburger menu) —
    // both copies exist in the DOM simultaneously, toggled via CSS display.
    expect(screen.getAllByText(/pending requests/i)[0]).toBeInTheDocument()
  })

  it('renders Calendar button', () => {
    renderHeaderBar({ authenticated: true, userGroups: ['Dispatch'], path: '/' })
    expect(screen.getAllByText(/^calendar$/i)[0]).toBeInTheDocument()
  })

  it('does not render Login button when authenticated', () => {
    renderHeaderBar({ authenticated: true, userGroups: ['Dispatch'], path: '/' })
    expect(screen.queryByText(/^login$/i)).not.toBeInTheDocument()
  })

  it('renders Avatar (User Menu button) when authenticated', () => {
    renderHeaderBar({ authenticated: true, userGroups: ['Dispatch'], userInitial: 'G', path: '/' })
    expect(screen.getByRole('button', { name: /user menu/i })).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Dock user — home page
// ---------------------------------------------------------------------------

describe('authenticated Dock user on /', () => {
  it('renders Calendar button', () => {
    renderHeaderBar({ authenticated: true, userGroups: ['Dock'], path: '/' })
    expect(screen.getAllByText(/^calendar$/i)[0]).toBeInTheDocument()
  })

  it('does NOT render Pending Requests button', () => {
    renderHeaderBar({ authenticated: true, userGroups: ['Dock'], path: '/' })
    expect(screen.queryByText(/pending requests/i)).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Admin user — home page
// ---------------------------------------------------------------------------

describe('authenticated Admin user on /', () => {
  it('renders both Pending Requests and Calendar buttons', () => {
    renderHeaderBar({ authenticated: true, userGroups: ['Admin'], path: '/' })
    expect(screen.getAllByText(/pending requests/i)[0]).toBeInTheDocument()
    expect(screen.getAllByText(/^calendar$/i)[0]).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Dispatch user — Calendar page
// ---------------------------------------------------------------------------

describe('authenticated Dispatch user on /Calendar', () => {
  it('renders Pending Requests button', () => {
    renderHeaderBar({ authenticated: true, userGroups: ['Dispatch'], path: '/Calendar' })
    expect(screen.getAllByText(/pending requests/i)[0]).toBeInTheDocument()
  })

  it('does NOT render a Calendar button (already on Calendar page)', () => {
    renderHeaderBar({ authenticated: true, userGroups: ['Dispatch'], path: '/Calendar' })
    expect(screen.queryByText(/^calendar$/i)).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Dock user — Calendar page
// ---------------------------------------------------------------------------

describe('authenticated Dock user on /Calendar', () => {
  it('renders Home button', () => {
    renderHeaderBar({ authenticated: true, userGroups: ['Dock'], path: '/Calendar' })
    expect(screen.getAllByText(/^home$/i)[0]).toBeInTheDocument()
  })

  it('does NOT render Pending Requests button', () => {
    renderHeaderBar({ authenticated: true, userGroups: ['Dock'], path: '/Calendar' })
    expect(screen.queryByText(/pending requests/i)).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Settings menu — Admin Page link
// ---------------------------------------------------------------------------

describe('settings menu', () => {
  it('Admin user sees Admin Page option in user menu', async () => {
    const user = userEvent.setup()
    renderHeaderBar({ authenticated: true, userGroups: ['Admin'], userInitial: 'A', path: '/' })
    await user.click(screen.getByRole('button', { name: /user menu/i }))
    await waitFor(() =>
      expect(screen.getByText(/admin page/i)).toBeInTheDocument()
    )
  })

  it('non-Admin user does NOT see Admin Page option in user menu', async () => {
    const user = userEvent.setup()
    renderHeaderBar({ authenticated: true, userGroups: ['Dispatch'], userInitial: 'D', path: '/' })
    await user.click(screen.getByRole('button', { name: /user menu/i }))
    await waitFor(() =>
      expect(screen.queryByText(/admin page/i)).not.toBeInTheDocument()
    )
  })
})

// ---------------------------------------------------------------------------
// Nav links inside the user avatar menu — this is how narrow-screen users
// reach Pending Requests/Calendar/etc. now that there's no separate
// hamburger menu; the desktop button row is hidden below md instead.
// ---------------------------------------------------------------------------

describe('nav links inside the user avatar menu', () => {
  it('shows Pending Requests alongside Logout when the avatar menu is opened', async () => {
    const user = userEvent.setup()
    renderHeaderBar({ authenticated: true, userGroups: ['Dispatch'], userInitial: 'D', path: '/' })
    await user.click(screen.getByRole('button', { name: /user menu/i }))
    const menuItems = await waitFor(() => screen.getAllByRole('menuitem'))
    const texts = menuItems.map((el) => el.textContent)
    expect(texts.some((t) => /pending requests/i.test(t))).toBe(true)
    expect(texts.some((t) => /logout/i.test(t))).toBe(true)
  })

  it('the Pending Requests menu item links to /PendingRequests', async () => {
    const user = userEvent.setup()
    renderHeaderBar({ authenticated: true, userGroups: ['Dispatch'], userInitial: 'D', path: '/' })
    await user.click(screen.getByRole('button', { name: /user menu/i }))
    const menuItems = await waitFor(() => screen.getAllByRole('menuitem'))
    const pendingItem = menuItems.find((el) => /pending requests/i.test(el.textContent))
    expect(pendingItem).toHaveAttribute('href', '/PendingRequests')
  })
})

// ---------------------------------------------------------------------------
// Pending stats badge
// ---------------------------------------------------------------------------

describe('pending stats badge', () => {
  it('shows the pending count from the API in the badge', async () => {
    server.use(
      http.get('/api/pending-requests-stats/', () =>
        HttpResponse.json({ pending_count: 5, has_urgent_requests: false })
      )
    )
    renderHeaderBar({ authenticated: true, userGroups: ['Dispatch'], path: '/' })
    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument()
    })
  })
})
