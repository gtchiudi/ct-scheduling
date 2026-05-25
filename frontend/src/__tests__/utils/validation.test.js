/**
 * Unit tests for src/utils/validation.js
 * Pure functions — no React, no mocking needed.
 */

import { describe, it, expect } from 'vitest'
import { validateEmail, validatePhone } from '../../utils/validation.js'

describe('validateEmail', () => {
  it('accepts a standard email address', () => {
    expect(validateEmail('test@example.com')).toBe(true)
  })

  it('rejects a string with no @', () => {
    expect(validateEmail('notanemail')).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(validateEmail('')).toBe(false)
  })

  it('accepts a minimal valid address (single char TLD)', () => {
    expect(validateEmail('a@b.c')).toBe(true)
  })

  it('rejects an address with no domain extension', () => {
    expect(validateEmail('user@domain')).toBe(false)
  })

  it('rejects an address with leading @', () => {
    expect(validateEmail('@example.com')).toBe(false)
  })

  it('accepts addresses with subdomains', () => {
    expect(validateEmail('user@mail.example.com')).toBe(true)
  })
})

describe('validatePhone', () => {
  it('accepts an empty string (phone is optional)', () => {
    expect(validatePhone('')).toBe(true)
  })

  it('accepts exactly 10 digits', () => {
    expect(validatePhone('5551234567')).toBe(true)
  })

  it('accepts formatted phone with dashes (10 digits after stripping)', () => {
    expect(validatePhone('555-123-4567')).toBe(true)
  })

  it('accepts formatted phone with parentheses and spaces', () => {
    expect(validatePhone('(555) 123-4567')).toBe(true)
  })

  it('rejects 9 digits', () => {
    expect(validatePhone('123456789')).toBe(false)
  })

  it('rejects 11 digits', () => {
    expect(validatePhone('12345678901')).toBe(false)
  })

  it('accepts a string of only non-digit characters (0 digits = valid per implementation)', () => {
    // validatePhone strips non-digits; 0 digits passes the "0 or 10" check
    expect(validatePhone('---')).toBe(true)
  })
})
