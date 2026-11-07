import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'

// columns: [{key, label, mono?, render?(row)}]. rowError(row) pinta la fila como error.
export default function AppTable({ columns, rows, getRowKey = (_, i) => i, rowError }) {
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          {columns.map((c) => <TableCell key={c.key} sx={{ color: 'text.secondary' }}>{c.label}</TableCell>)}
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row, i) => (
          <TableRow key={getRowKey(row, i)}>
            {columns.map((c) => (
              <TableCell
                key={c.key}
                sx={(t) => ({ ...(c.mono ? t.typography.mono : {}), color: rowError?.(row) ? 'error.main' : undefined })}
              >
                {c.render ? c.render(row) : row[c.key]}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
