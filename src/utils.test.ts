import { describe, expect, it } from '@effect/vitest'
import { dedent } from './utils'

describe('dedent', () => {
  it('dedents template', () => {
    const input = `<html>
                     <body>
                       <h1>Hello, world!</h1>
                     </body>
                   </html>`

    const expected = `<html>
  <body>
    <h1>Hello, world!</h1>
  </body>
</html>`

    expect(dedent(input)).toEqual(expected)
  })
})
