import { socService } from '../services/socService.js'
import { useAsync } from './useAsync.js'

// Constantes compartidas con el backend (acciones de la API, pasos del vivo, objetivos de tiempo)
export function useConfig() {
  return useAsync(socService.config, []).data
}
