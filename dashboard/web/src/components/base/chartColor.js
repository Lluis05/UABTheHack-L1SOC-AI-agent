// Color de una marca de gráfica a partir de una clave del tema: 'sevHigh' (paleta con .main) o 'chart.llm'.
export function chartColor(theme, key) {
  const value = key.split('.').reduce((node, part) => node?.[part], theme.palette)
  return typeof value === 'string' ? value : value?.main ?? theme.palette.chart.bar
}
