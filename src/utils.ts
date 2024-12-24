const SPACE_OR_TABS = /^[ \t]*/

export function dedent(input: string): string {
  const lines = input.split('\n')

  if (lines.length < 2) return input.trimStart()

  const minIndent = lines.slice(1).reduce((min, line) => {
    const indent = line.match(SPACE_OR_TABS)?.[0].length ?? 0
    return Math.min(min, indent)
  }, Number.POSITIVE_INFINITY)

  // Remove that amount of indentation from all lines
  return lines
    .map((line, index) => {
      if (index === 0) {
        return line.trimStart()
      }
      return line.slice(minIndent)
    })
    .join('\n')
}
