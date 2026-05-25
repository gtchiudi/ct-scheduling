import '@testing-library/jest-dom'
import { server } from './mocks/server.js'

// Start MSW server before all tests, reset handlers after each, close after all
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
