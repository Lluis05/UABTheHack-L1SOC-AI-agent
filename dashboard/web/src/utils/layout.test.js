import { describe, expect, it } from 'vitest'
import { parseInline, parseMarkdown } from './markdown.js'
import { clampWidth, fitPanes, parseLayout } from './panes.js'

describe('markdown del asistente', () => {
  it('separa negrita, código y texto', () => {
    expect(parseInline('Regla **UC-EML-001** con `EML-0053502`.')).toEqual([
      { type: 'text', text: 'Regla ' }, { type: 'strong', text: 'UC-EML-001' }, { type: 'text', text: ' con ' },
      { type: 'code', text: 'EML-0053502' }, { type: 'text', text: '.' },
    ])
  })

  it('reconoce subtítulos, párrafos, viñetas, numeradas y anidadas', () => {
    const blocks = parseMarkdown([
      '### Severidad', 'La severidad es **baja**.', 'Sigue aquí.', '',
      '- Regla base: low', '  - ajuste 0', '- Activo: Media', '',
      '1. Primero', '2) Segundo',
    ].join('\n'))
    expect(blocks.map((b) => b.type)).toEqual(['heading', 'paragraph', 'list', 'list'])
    expect(blocks[1].inlines.map((i) => i.text).join('')).toBe('La severidad es baja. Sigue aquí.')
    expect(blocks[2]).toMatchObject({ ordered: false })
    expect(blocks[2].items.map((i) => i.level)).toEqual([0, 1, 0])
    expect(blocks[3]).toMatchObject({ ordered: true })
    expect(blocks[3].items).toHaveLength(2)
  })

  it('una línea sangrada sin marcador continúa el elemento anterior', () => {
    const [list] = parseMarkdown('- Explicación larga\n  que sigue')
    expect(list.items[0].inlines[0].text).toBe('Explicación larga que sigue')
  })

  it('la etiqueta de una viñeta («Etiqueta: texto») va en negrita', () => {
    const [list] = parseMarkdown('- Regla base: `UC-EML-001` con severidad low\n- Sin etiqueta aquí')
    expect(list.items[0].inlines.slice(0, 3)).toEqual([
      { type: 'strong', text: 'Regla base:' }, { type: 'text', text: ' ' }, { type: 'code', text: 'UC-EML-001' },
    ])
    expect(list.items[1].inlines).toEqual([{ type: 'text', text: 'Sin etiqueta aquí' }])
  })

  it('no interpreta HTML: queda como texto', () => {
    const [p] = parseMarkdown('<img src=x onerror=alert(1)>')
    expect(p.inlines).toEqual([{ type: 'text', text: '<img src=x onerror=alert(1)>' }])
  })
})

describe('columnas ajustables', () => {
  const limits = { leftMin: 240, asideMin: 320, centerMin: 420 }
  const layout = { leftWidth: 380, asideWidth: 420, leftCollapsed: false, asideCollapsed: false }
  const fit = (container, patch = {}, hasAside = true) =>
    fitPanes({ container, layout: { ...layout, ...patch }, hasAside, limits, gutter: 16, rail: 40 })

  it('clampWidth respeta mínimo y máximo', () => {
    expect(clampWidth(100, 240, 600)).toBe(240)
    expect(clampWidth(700, 240, 600)).toBe(600)
    expect(clampWidth(500, 240, 100)).toBe(240) // si el máximo queda por debajo, manda el mínimo
  })

  it('con sitio de sobra usa los anchos guardados', () => {
    expect(fit(1900)).toEqual({ left: 380, aside: 420 })
  })

  it('si no cabe, encoge los laterales para dejar el mínimo al centro', () => {
    const { left, aside } = fit(1200)
    expect(1200 - 32 - left - aside).toBeGreaterThanOrEqual(420)
  })

  it('plegada, una columna ocupa solo el raíl y el resto se lo queda el centro', () => {
    expect(fit(1900, { leftCollapsed: true }).left).toBe(40)
    expect(fit(1900, { asideCollapsed: true }).aside).toBe(40)
    expect(fit(1900, {}, false).aside).toBe(0)
  })

  it('parseLayout fusiona con los valores por defecto y descarta basura', () => {
    expect(parseLayout('{"leftWidth":300,"asideCollapsed":true,"x":1}', layout))
      .toEqual({ ...layout, leftWidth: 300, asideCollapsed: true })
    expect(parseLayout('{"leftWidth":"ancho"}', layout)).toEqual(layout)
    expect(parseLayout('no-json', layout)).toEqual(layout)
  })
})
