import { describe, it, expect } from 'vitest'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { toApiDateTime } from '../../utils/datetime.js'

dayjs.extend(utc)
dayjs.extend(timezone)

describe('toApiDateTime', () => {
  it('includes the UTC offset and preserves the instant', () => {
    const iso = '2026-12-01T20:00:00.000Z'
    const out = toApiDateTime(iso)
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/)
    expect(dayjs(out).valueOf()).toBe(dayjs(iso).valueOf())
  })

  it("uses a zoned dayjs's own offset (warehouse timezone picker)", () => {
    const chicago = dayjs.tz('2026-12-01 14:00', 'America/Chicago')
    expect(toApiDateTime(chicago)).toBe('2026-12-01T14:00:00-06:00')
  })

  it('drops milliseconds (the backend compares to the second)', () => {
    expect(toApiDateTime('2026-12-01T20:00:00.789Z')).not.toContain('.789')
  })
})
