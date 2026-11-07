import Box from '@mui/material/Box'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import AppIcon from './AppIcon.jsx'

const ICON_COL = 36
const LABEL_COL = { xs: 92, sm: 118 }
// En móvil el icono sobra: deja ese ancho al valor
const ICON_CELL = { display: { xs: 'none', sm: 'table-cell' } }
const ACTION_COL = 64
// Cabecera solo para lectores de pantalla: icono y etiqueta de cada fila ya dicen qué es cada columna
const visuallyHidden = { position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }

// Ficha en tabla: una fila por dato con icono, etiqueta, valor (texto o tags en horizontal) y acción opcional.
// rows: [{key, icon, label, value, action?}]
export default function AppKeyValueTable({ rows, label }) {
  return (
    <Table size="small" aria-label={label} sx={{ tableLayout: 'fixed', '& td': { py: 0.9, verticalAlign: 'middle' } }}>
      <TableHead sx={{ '& th': { p: 0, border: 0 } }}>
        <TableRow>
          <TableCell sx={{ width: ICON_COL, ...ICON_CELL }}><Box component="span" sx={visuallyHidden}>Icono</Box></TableCell>
          <TableCell sx={{ width: LABEL_COL }}><Box component="span" sx={visuallyHidden}>Campo</Box></TableCell>
          <TableCell><Box component="span" sx={visuallyHidden}>Valor</Box></TableCell>
          <TableCell sx={{ width: ACTION_COL }}><Box component="span" sx={visuallyHidden}>Más</Box></TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.key} hover>
            <TableCell sx={{ pr: 0, ...ICON_CELL }}><AppIcon name={r.icon} /></TableCell>
            <TableCell sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>{r.label}</TableCell>
            <TableCell>{r.value}</TableCell>
            <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{r.action}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
