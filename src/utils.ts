import type { Unsafe } from './unsafe.js'

const SPACE_OR_TABS = /^[ \t]*/

// Cache for indent calculations
const indentCache = new WeakMap<TemplateStringsArray, number>()

/**
 * Efficiently processes a template string and its interpolated values
 * while maintaining proper indentation
 */
export function processTemplate(
  template: TemplateStringsArray,
  values: ReadonlyArray<string | Unsafe>,
  shouldDedent: boolean,
): string {
  // Fast path for empty or single-part templates
  if (template.length === 1) return template[0]
  if (values.length === 0) return template.join('')
  
  if (shouldDedent) {
    // Check cache first
    let minIndent = indentCache.get(template)
    if (minIndent === undefined) {
      minIndent = getMinIndent(template)
      indentCache.set(template, minIndent)
    }
    return processDedentTemplate(template, values, minIndent)
  }
  
  return processSimpleTemplate(template, values)
}

/**
 * Process template without dedenting - fastest path
 */
function processSimpleTemplate(
  template: TemplateStringsArray,
  values: ReadonlyArray<string | Unsafe>,
): string { 
  // Use array join for better performance with pre-allocated size
  const result = new Array(template.length + values.length)
  result[0] = template[0]
  
  for (let i = 0; i < values.length; i++) {
    const value = values[i]
    result[i * 2 + 1] = toString(value)
    result[i * 2 + 2] = template[i + 1]
  }
  
  return result.join('')
}

function toString(value: string | Unsafe): string {
  if (typeof value === 'string') return value
  return value.content
}

/**
 * Process template with dedenting - preserves proper indentation
 */
function processDedentTemplate(
  template: TemplateStringsArray,
  values: ReadonlyArray<string | Unsafe>,
  minIndent: number,
): string {
  // Fast path for no indentation
  if (minIndent === 0) return processSimpleTemplate(template, values)
  
  const parts: string[] = []
  const firstPart = processTemplateSection(template[0], minIndent)
  parts.push(firstPart)

  // Process values and remaining template parts
  let lastContent = firstPart
  for (let i = 0; i < values.length; i++) {
    const value = values[i]
    const valueStr = processValue(value, lastContent)
    parts.push(valueStr)
    
    const nextSection = processTemplateSection(template[i + 1], minIndent)
    parts.push(nextSection)
    lastContent = nextSection
  }

  return parts.join('')
}

/**
 * Process a template section with proper indentation
 */
function processTemplateSection(templatePart: string, minIndent: number): string {
  // Fast path for single line or no indent
  if (!templatePart.includes('\n') || minIndent === 0) return templatePart
  
  const lines = templatePart.split('\n')
  if (lines.length === 1) return templatePart

  const processedLines = new Array(lines.length)
  processedLines[0] = lines[0]
  
  // Process remaining lines with caching
  for (let i = 1; i < lines.length; i++) {
    processedLines[i] = processLine(lines[i], minIndent)
  }

  return processedLines.join('\n')
}

/**
 * Process an interpolated value, handling multiline strings and unsafe content
 */
function processValue(value: string | Unsafe, previousContent: string): string {
  if (typeof value !== 'string') return value.content
  
  const valueString = value.toString()
  if (!valueString.includes('\n')) return valueString

  const valueLines = valueString.split('\n')
  const lastNewlineIndex = previousContent.lastIndexOf('\n')
  const currentIndent = lastNewlineIndex === -1 
    ? getLineIndent(previousContent)
    : getLineIndent(previousContent.slice(lastNewlineIndex + 1))

  // Fast path for simple indentation
  if (!currentIndent) return valueString
  
  return valueLines
    .map((line, index) => index === 0 ? line : `${currentIndent}${line}`)
    .join('\n')
}

// Cache for indent calculations
const lineIndentCache = new Map<string, string>()

/**
 * Efficiently calculates the indentation level of a line
 */
function getLineIndent(line: string): string {
  let indent = lineIndentCache.get(line)
  if (indent === undefined) {
    indent = line.match(SPACE_OR_TABS)?.[0] ?? ''
    lineIndentCache.set(line, indent)
  }
  return indent
}

/**
 * Efficiently finds the minimum indentation level in a template string,
 * excluding empty lines and the first line
 */
function findMinIndent(template: string): number {
  // Fast path for simple strings
  if (!template.includes('\n')) return 0
  
  let min = Number.POSITIVE_INFINITY
  let start = template.indexOf('\n') + 1
  if (start === 0) return 0

  while (start < template.length) {
    const end = template.indexOf('\n', start)
    const slice = template.slice(start, end === -1 ? template.length : end)
    if (slice.trim()) {
      const indent = getLineIndent(slice).length
      if (indent === 0) return 0 // Fast path - no need to continue if we find zero indent
      min = Math.min(min, indent)
    }
    if (end === -1) break
    start = end + 1
  }
  return min === Number.POSITIVE_INFINITY ? 0 : min
}

/**
 * Process a single line with the given minimum indentation
 */
function processLine(line: string, minIndent: number): string {
  // Fast path for empty lines
  if (!line || minIndent === 0) return line
  
  const indent = getLineIndent(line)
  return indent.length >= minIndent ? line.slice(minIndent) : line.trimStart()
}

/**
 * Get the minimum indentation across all template parts
 */
function getMinIndent(template: ArrayLike<string>): number {
  // Fast path for single-line templates
  if (template.length === 1 && !template[0].includes('\n')) return 0
  
  let min = Number.POSITIVE_INFINITY
  for (let i = 0; i < template.length; i++) {
    const indent = findMinIndent(template[i])
    if (indent === 0) return 0 // Fast path - no need to continue if we find zero indent
    min = Math.min(min, indent)
  }
  return min === Number.POSITIVE_INFINITY ? 0 : min
}
