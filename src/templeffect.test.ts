import { describe, expect, it } from '@effect/vitest'
import { Duration, Effect, Stream } from 'effect'
import * as T from './template.js'

describe('templeffect', () => {
  it.effect('interpolates parameters', () =>
    Effect.gen(function* () {
      const makeHtml = T.template('foo')`<html>
  <body>
    <h1>Hello, ${T.param('name')}!</h1>
  </body>
</html>`

      const result = yield* makeHtml({ name: 'world' })
      expect(result).toMatchInlineSnapshot(`
        "<html>
          <body>
            <h1>Hello, world!</h1>
          </body>
        </html>"
      `)
    }),
  )

  it.effect('supports effects as parameters', () =>
    Effect.gen(function* () {
      const makeHtml = T.template('foo')`<html>
  <body>
    <h1>Hello, ${T.param('name')}!</h1>
  </body>
</html>`

      const world: Effect.Effect<string, Error, never> = Effect.succeed('world')
      const result = yield* makeHtml({ name: world })
      expect(result).toMatchInlineSnapshot(`
        "<html>
          <body>
            <h1>Hello, world!</h1>
          </body>
        </html>"
      `)
    }),
  )

  it.effect('supports streaming', () =>
    Effect.gen(function* () {
      const makeHtml = T.template('foo')`<html>
  <body>
    <h1>Hello, ${T.param('name')}!</h1>
  </body>
</html>`

      const parts = Array.from(yield* Stream.runCollect(makeHtml.stream({ name: 'world' })))

      expect(parts).toMatchInlineSnapshot(`
        [
          "<html>
          <body>
            <h1>Hello, ",
          "world",
          "!</h1>
          </body>
        </html>",
        ]
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
      expect(result).toMatchInlineSnapshot(`
        "<html>
          <body>
            <h1>Hello, world!</h1>
          </body>
        </html>"
      `)
    }),
  )

  it.effect('support streaming dedent', () =>
    Effect.gen(function* () {
      const makeHtml = T.dedent('foo')`<html>
                                         <body>
                                           <h1>Hello, ${T.param('name')}!</h1>
                                         </body>
                                       </html>`

      const parts = Array.from(yield* Stream.runCollect(makeHtml.stream({ name: 'world' })))
      expect(parts).toMatchInlineSnapshot(`
        [
          "<html>
          <body>
            <h1>Hello, ",
          "world",
          "!</h1>
          </body>
        </html>",
        ]
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
      expect(result).toMatchInlineSnapshot(`
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
      const A = T.template('A')`<section>
        <h1>Hello, ${T.param('name')}!</h1>
      </section>`
      const B = T.dedent('B')`<html>
                                <body>
                                  ${A}
                                </body>
                              </html>`

      const result = yield* B({ A: { name: 'world' } })
      expect(result).toMatchInlineSnapshot(`
        "<html>
          <body>
            <section>
              <h1>Hello, world!</h1>
            </section>
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
      expect(result).toMatchInlineSnapshot(`
        "<html>
          <body>
            <h1>Hello, world!</h1>
          </body>
        </html>"
      `)
    }),
  )

  it.effect('supports various parameter types', () =>
    Effect.gen(function* () {
      const template = T.dedent('types')`
        <div>
          <p>Number: ${T.number('num')}</p>
          <p>Integer: ${T.integer('int')}</p>
          <p>Boolean: ${T.boolean('bool')}</p>
          <p>UUID: ${T.uuid('id')}</p>
          <p>ULID: ${T.ulid('ulid')}</p>
          <p>Date: ${T.date('date')}</p>
          <p>BigInt: ${T.bigInt('big')}</p>
          <p>Duration: ${T.duration('time')}</p>
          <pre>${T.json('data', 2).unsafe()}</pre>
        </div>`

      const result = yield* template({
        num: 42.5,
        int: 42,
        bool: true,
        id: '123e4567-e89b-12d3-a456-426614174000',
        ulid: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
        date: new Date('2024-01-01'),
        big: BigInt('9007199254740991'),
        time: Duration.seconds(30),
        data: { hello: 'world' },
      })

      expect(result).toMatchInlineSnapshot(`
        "
        <div>
          <p>Number: 42.5</p>
          <p>Integer: 42</p>
          <p>Boolean: true</p>
          <p>UUID: 123e4567-e89b-12d3-a456-426614174000</p>
          <p>ULID: 01ARZ3NDEKTSV4RRFFQ69G5FAV</p>
          <p>Date: 2024-01-01T00:00:00.000Z</p>
          <p>BigInt: 9007199254740991</p>
          <p>Duration: 30s</p>
          <pre>{
          "hello": "world"
        }</pre>
        </div>"
      `)
    }),
  )

  it.effect('supports optional parameters', () =>
    Effect.gen(function* () {
      const template = T.dedent('optional')`<html>
        <body>
          <h1>Hello, ${T.param('name').optional('world')}!</h1>
        </body>
      </html>`

      const result = yield* template({ name: 'Effect' })
      expect(result).toMatchInlineSnapshot(`
        "<html>
          <body>
            <h1>Hello, Effect!</h1>
          </body>
        </html>"
      `)

      const result2 = yield* template()
      expect(result2).toMatchInlineSnapshot(`
        "<html>
          <body>
            <h1>Hello, world!</h1>
          </body>
        </html>"
      `)
    }),
  )

  it.effect('supports forEach', () =>
    Effect.gen(function* () {
      const template = T.dedent('forEach')`<html>
        <body>
          <h1>Hello, ${T.forEach(T.param('names'), ({ value }) => value, ', ')}</h1>
        </body>
      </html>`

      const result = yield* template({ names: ['John', 'Jane'] })
      expect(result).toMatchInlineSnapshot(`
        "<html>
          <body>
            <h1>Hello, John, Jane</h1>
          </body>
        </html>"
      `)
    }),
  )

  it.effect('supports with', () =>
    Effect.gen(function* () {
      yield* Effect.gen(function* () {
        const template = T.dedent('with')`<html>
          <body>
            <h1>Hello, ${T.with(T.param('name'), ({ value }) => value.toUpperCase())}</h1>
          </body>
        </html>`

        const result = yield* template({ name: 'world' })
        expect(result).toMatchInlineSnapshot(`
          "<html>
            <body>
              <h1>Hello, WORLD</h1>
            </body>
          </html>"
        `)
      })
    }),
  )

  it.effect('supports if', () =>
    Effect.gen(function* () {
      const template = T.dedent('if')`<html>
        <body>
          <h1>Hello, ${T.if(T.param('name'), {
            if: ({ value }) => value === 'world',
            // biome-ignore lint/suspicious/noThenProperty: <explanation>
            then: ({ value }) => value.toUpperCase(),
            else: () => 'world',
          })}</h1>
        </body>
      </html>`

      const result = yield* template({ name: 'world' })
      expect(result).toMatchInlineSnapshot(`
        "<html>
          <body>
            <h1>Hello, WORLD</h1>
          </body>
        </html>"
      `)
    }),
  )
})
