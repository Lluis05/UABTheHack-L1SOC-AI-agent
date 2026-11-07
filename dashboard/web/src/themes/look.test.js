import { describe, expect, it } from 'vitest'
import { DEFAULT_LOOK, pickLook } from './look.js'

describe('variante estética', () => {
  const available = ['actual', 'refinado']

  it('gana la URL, luego lo recordado y si no, la de por defecto', () => {
    expect(pickLook('refinado', 'actual', available)).toBe('refinado')
    expect(pickLook(null, 'refinado', available)).toBe('refinado')
    expect(pickLook(null, null, available)).toBe(DEFAULT_LOOK)
  })

  it('ignora nombres desconocidos', () => {
    expect(pickLook('neon', 'refinado', available)).toBe('refinado')
    expect(pickLook('neon', 'otro', available)).toBe(DEFAULT_LOOK)
  })
})
