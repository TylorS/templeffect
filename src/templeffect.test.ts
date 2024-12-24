import { describe, it, expect } from '@effect/vitest'
import * as T from './index.js'
import { Effect } from 'effect'

describe('templeffect', () => {
  it.effect('interpolates parameters', () =>
    Effect.gen(function* () {
      const makeHtml = T.template('foo')`<html>
  <body>
    <h1>Hello, ${T.param('name')}!</h1>
  </body>
</html>`

      const result = yield* makeHtml({ name: 'world' })
      expect(result.output).toMatchInlineSnapshot(`
        "<html>
          <body>
            <h1>Hello, world!</h1>
          </body>
        </html>"
      `)
    }),
  )

  it.effect('dedents template', () =>
    Effect.gen(function* () {
      const makeHtml = T.dedent('foo')`<html>
                                        <body>
                                          <h1>Hello, ${T.param('name')}!</h1>
                                        </body>
                                      </html>`

      const result = yield* makeHtml({ name: 'world' })
      expect(result.output).toMatchInlineSnapshot(`
        "<html>
          <body>
            <h1>Hello, world!</h1>
          </body>
        </html>"
      `)
    }),
  )

  it.effect('supports parameters with a Schema', () =>
    Effect.gen(function* () {
      const timestamp = new Date('2024-12-24T12:00:00Z')
      const timestampParam = T.date('timestamp')
      const makeHtml = T.dedent('foo')`<html>
                                        <body>
                                          <h1>Its currently ${timestampParam}!</h1>
                                          <section>
                                            <h2>Its currently ${timestampParam}!</h2>
                                          </section>
                                        </body>
                                      </html>`

      const result = yield* makeHtml({ timestamp })
      expect(result.output).toMatchInlineSnapshot(`
        "<html>
          <body>
            <h1>Its currently 2024-12-24T12:00:00.000Z!</h1>
            <section>
              <h2>Its currently 2024-12-24T12:00:00.000Z!</h2>
            </section>
          </body>
        </html>"
      `)
    }),
  )

  it.effect('supports nested templates', () =>
    Effect.gen(function* () {
      const A = T.template('A')`<p><h1>Hello, ${T.param('name')}!</h1></p>`
      const B = T.dedent('B')`<html>
                                <body>
                                  ${A}
                                </body>
                              </html>`

      const result = yield* B({ A: { name: 'world' } })
      expect(result.output).toMatchInlineSnapshot(`
        "<html>
          <body>
            <p><h1>Hello, world!</h1></p>
          </body>
        </html>"
      `)
    }),
  )

  it.effect('supports arbitrary Effect values', () =>
    Effect.gen(function* () {
      const makeHtml = T.dedent('foo')`<html>
                                        <body>
                                          <h1>Hello, ${Effect.succeed('world')}!</h1>
                                        </body>
                                      </html>`

      const result = yield* makeHtml()
      expect(result.output).toMatchInlineSnapshot(`
        "<html>
          <body>
            <h1>Hello, world!</h1>
          </body>
        </html>"
      `)
    }),
  )

  
})
