// Markdown mínimo para las respuestas del asistente (tests en markdown.test.js).
// Solo un subconjunto: subtítulos (#), viñetas (- * •), listas numeradas (1. o 1)), **negrita** y `código`.
// Devuelve una estructura de datos que pinta AppRichText con elementos React: nunca HTML crudo (sin riesgo de
// inyección aunque la respuesta repita texto del atacante).

const RE_HEADING = /^#{1,4}\s+(.*)$/
const RE_BULLET = /^(\s*)[-*•]\s+(.*)$/
const RE_ORDERED = /^(\s*)\d+[.)]\s+(.*)$/
const RE_INLINE = /(\*\*[^*\n]+\*\*|`[^`\n]+`)/
const NESTED_INDENT = 2

export function parseInline(text) {
  return text.split(RE_INLINE).filter(Boolean).map((part) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return { type: 'strong', text: part.slice(2, -2) }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) return { type: 'code', text: part.slice(1, -1) }
    return { type: 'text', text: part }
  })
}

// «Etiqueta: explicación» en una viñeta: la etiqueta va en negrita para poder escanear la lista
const RE_ITEM_LABEL = /^([^:`*\n]{2,40}):\s+(.+)$/

function parseItem(text) {
  const label = text.match(RE_ITEM_LABEL)
  return label ? [{ type: 'strong', text: `${label[1]}:` }, { type: 'text', text: ' ' }, ...parseInline(label[2])] : parseInline(text)
}

function listItem(match, ordered) {
  return { ordered, level: match[1].length >= NESTED_INDENT ? 1 : 0, text: match[2].trim() }
}

export function parseMarkdown(source) {
  const blocks = []
  let paragraph = null
  let list = null
  const closeParagraph = () => { paragraph = null }
  const closeList = () => { list = null }

  for (const raw of String(source || '').replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trimEnd()
    if (!line.trim()) { closeParagraph(); closeList(); continue }

    const heading = line.match(RE_HEADING)
    const item = (line.match(RE_BULLET) && listItem(line.match(RE_BULLET), false))
      || (line.match(RE_ORDERED) && listItem(line.match(RE_ORDERED), true))

    if (heading) {
      closeParagraph(); closeList()
      blocks.push({ type: 'heading', text: heading[1].replace(/\*\*/g, '').trim() })
    } else if (item) {
      closeParagraph()
      // Una lista nueva si cambia el tipo en el nivel principal (viñetas ↔ numerada)
      if (!list || (item.level === 0 && list.ordered !== item.ordered)) {
        list = { type: 'list', ordered: item.ordered, items: [] }
        blocks.push(list)
      }
      list.items.push({ level: item.level, text: item.text })
    } else if (list && /^\s+/.test(raw)) {
      // Línea sangrada sin marcador: continúa el elemento anterior
      const last = list.items[list.items.length - 1]
      last.text = `${last.text} ${line.trim()}`
    } else {
      closeList()
      if (!paragraph) { paragraph = { type: 'paragraph', text: '' }; blocks.push(paragraph) }
      paragraph.text = paragraph.text ? `${paragraph.text} ${line.trim()}` : line.trim()
    }
  }

  return blocks.map((b) => (b.type === 'list'
    ? { ...b, items: b.items.map((i) => ({ level: i.level, inlines: parseItem(i.text) })) }
    : { type: b.type, inlines: parseInline(b.text) }))
}
