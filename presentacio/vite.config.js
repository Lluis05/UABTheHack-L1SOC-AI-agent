import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// Un único index.html con todo dentro (JS, CSS y fuentes): se abre con doble clic, sin servidor ni red,
// y no compite por memoria con el dashboard y la API durante la defensa.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: { assetsInlineLimit: Number.MAX_SAFE_INTEGER },
  test: { environment: 'node' },
})
