import { describe, expect, it } from 'vitest'
import { CHAT_ROLE } from '../config/constants.js'
import { canSend, chatMessage, toHistory } from './chat.js'

describe('chat del ticket', () => {
  const msgs = [
    chatMessage(CHAT_ROLE.USER, '¿Por qué se cerró?'),
    chatMessage(CHAT_ROLE.MODEL, 'Por SCCM_INVENTORY.'),
    chatMessage(CHAT_ROLE.ERROR, 'Gemini no ha respondido'),
    chatMessage(CHAT_ROLE.USER, '  '),
    chatMessage(CHAT_ROLE.USER, '¿Quién lo decidió?'),
  ]

  it('toHistory quita errores y vacíos y se queda con los últimos', () => {
    expect(toHistory(msgs, 10)).toEqual([msgs[0], msgs[1], msgs[4]])
    expect(toHistory(msgs, 2)).toEqual([msgs[1], msgs[4]])
    expect(toHistory(msgs, 0)).toEqual([])
  })

  it('canSend exige texto, no estar ocupado y no pasarse del máximo', () => {
    expect(canSend('hola', false, 10)).toBe(true)
    expect(canSend('   ', false, 10)).toBe(false)
    expect(canSend('hola', true, 10)).toBe(false)
    expect(canSend('x'.repeat(11), false, 10)).toBe(false)
  })
})
