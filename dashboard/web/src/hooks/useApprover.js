import { useState } from 'react'
import { APPROVER_STORAGE_KEY } from '../config/constants.js'
import { readLocal, writeLocal } from '../services/storage.js'

// Nombre de quien aprueba: se recuerda en este navegador para no reescribirlo en cada acción.
export function useApprover() {
  const [approver, setApprover] = useState(() => readLocal(APPROVER_STORAGE_KEY))
  const update = (value) => { setApprover(value); writeLocal(APPROVER_STORAGE_KEY, value) }
  return [approver.trim(), approver, update]
}
