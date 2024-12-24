import { Duration, Effect, identity, type ParseResult, pipe, Schema } from 'effect'
import { ArrayFormatter } from 'effect/ParseResult'
import * as utils from './utils.js'

export interface Template<
  Name extends string,
  Values extends ReadonlyArray<Template.AnyParamType>,
> {
  readonly _tag: 'Template'
  readonly name: Name
  readonly template: TemplateStringsArray
  readonly values: Values

  (
    ...[params]: [keyof Template.Parameters<Values>] extends [never]
      ? [{}?]
      : [Template.Parameters<Values>]
  ): Effect.Effect<
    { readonly name: Name; readonly params: Template.Parameters<Values>; readonly output: string },
    Template.ErrorFromValue<Values[number]> | TemplateFailure,
    Template.ContextFromValue<Values[number]>
  >
}

export declare namespace Template {
  export type Any = Template<any, readonly any[]>

  export type Primitive = string | number | boolean | bigint | null | undefined

  export type AnyParamType =
    | Primitive
    | Parameter<any, any>
    | Effect.Effect<string, any, any>
    | Template<any, readonly any[]>

  export type Parameters<Values extends ReadonlyArray<AnyParamType>> = DeriveParameters<Values, {}>

  export type Error<T extends Template<any, any>> = T extends Template<any, infer Values>
    ? ErrorFromValue<Values[number]>
    : never

  type ErrorFromValue<T extends Template.AnyParamType> = T extends Effect.Effect<any, any, any>
    ? Effect.Effect.Error<T>
    : T extends Template.Any
      ? ErrorFromValue<T['values'][number]>
      : never

  export type Context<T extends Template<any, any>> = T extends Template<any, infer Values>
    ? ContextFromValue<Values[number]>
    : never

  type ContextFromValue<T extends Template.AnyParamType> = [T] extends [
    Effect.Effect<any, any, infer R>,
  ]
    ? R
    : T extends Template<any, infer Values>
      ? ContextFromValue<Values[number]>
      : never

  type DeriveParameters<
    Values extends ReadonlyArray<any>,
    Result extends Record<string, any>,
  > = Values extends readonly [infer First, ...infer Rest]
    ? [First] extends [Parameter<infer Name, infer Schema>]
      ? DeriveParameters<Rest, Result & { readonly [K in Name]: Schema.Schema.Type<Schema> }>
      : [First] extends [Template<infer Name, infer TemplateValues>]
        ? DeriveParameters<
            Rest,
            Result & { readonly [K in Name]: Template.Parameters<TemplateValues> }
          >
        : DeriveParameters<Rest, Result>
    : Result
}

/**
 * @since 1.0.0
 * @category schemas
 */
export interface Issue
  extends Schema.Struct<{
    _tag: Schema.Literal<
      [
        'Pointer',
        'Unexpected',
        'Missing',
        'Composite',
        'Refinement',
        'Transformation',
        'Type',
        'Forbidden',
      ]
    >
    path: PropertyKeysNoSymbol
    message: typeof Schema.String
  }> {}

/**
 * @since 1.0.0
 * @category schemas
 */
export interface PropertyKeysNoSymbol
  extends Schema.transform<
    Schema.Array$<Schema.Union<[typeof Schema.String, typeof Schema.Number]>>,
    Schema.Array$<
      Schema.Union<[typeof Schema.SymbolFromSelf, typeof Schema.String, typeof Schema.Number]>
    >
  > {}

/**
 * @since 1.0.0
 * @category schemas
 */
export const PropertyKeysNoSymbol: PropertyKeysNoSymbol = Schema.transform(
  Schema.Array(Schema.Union(Schema.String, Schema.Number)),
  Schema.Array(Schema.Union(Schema.SymbolFromSelf, Schema.String, Schema.Number)),
  {
    decode: identity,
    encode: (items) => items.filter((item) => typeof item !== 'symbol'),
  },
)

/**
 * @since 1.0.0
 * @category schemas
 */
export const Issue: Issue = Schema.Struct({
  _tag: Schema.Literal(
    'Pointer',
    'Unexpected',
    'Missing',
    'Composite',
    'Refinement',
    'Transformation',
    'Type',
    'Forbidden',
  ),
  path: PropertyKeysNoSymbol,
  message: Schema.String,
})

export class TemplateFailure extends Schema.TaggedError<TemplateFailure>()('TemplateFailure', {
  issues: Schema.Array(Issue),
}) {
  static fromParseError(parseError: ParseResult.ParseError) {
    return new TemplateFailure({ issues: ArrayFormatter.formatIssueSync(parseError.issue) })
  }
}

export interface Parameter<Name extends string, Schema extends Schema.Schema<any, string, any>> {
  readonly _tag: 'Parameter'
  readonly name: Name
  readonly schema: Schema
}

export function paramWithSchema<
  const Name extends string,
  const Schema extends Schema.Schema<any, string, any>,
>(name: Name, schema: Schema): Parameter<Name, Schema> {
  return { _tag: 'Parameter', name, schema }
}

export function param<const Name extends string>(
  name: Name,
): Parameter<Name, typeof Schema.String> {
  return paramWithSchema(name, Schema.String)
}

export function number<const Name extends string>(
  name: Name,
): Parameter<Name, typeof Schema.NumberFromString> {
  return paramWithSchema(name, Schema.NumberFromString)
}

export function boolean<const Name extends string>(
  name: Name,
): Parameter<Name, Schema.SchemaClass<boolean, string, never>> {
  return paramWithSchema(name, Schema.compose(Schema.String, Schema.BooleanFromString))
}

export function integer<const Name extends string>(
  name: Name,
): Parameter<Name, Schema.SchemaClass<number, string, never>> {
  return paramWithSchema(name, Schema.compose(Schema.NumberFromString, Schema.Int))
}

export function uuid<const Name extends string>(name: Name): Parameter<Name, typeof Schema.UUID> {
  return paramWithSchema(name, Schema.UUID)
}

export function ulid<const Name extends string>(name: Name): Parameter<Name, typeof Schema.ULID> {
  return paramWithSchema(name, Schema.ULID)
}

export function date<const Name extends string>(name: Name): Parameter<Name, typeof Schema.Date> {
  return paramWithSchema(name, Schema.Date)
}

export function bigInt<const Name extends string>(
  name: Name,
): Parameter<Name, typeof Schema.BigInt> {
  return paramWithSchema(name, Schema.BigInt)
}

export function bigDecimal<const Name extends string>(
  name: Name,
): Parameter<Name, typeof Schema.BigDecimal> {
  return paramWithSchema(name, Schema.BigDecimal)
}

export function duration<const Name extends string>(
  name: Name,
): Parameter<Name, Schema.SchemaClass<Duration.Duration, string, never>> {
  return paramWithSchema(
    name,
    Schema.transform(Schema.String, Schema.DurationFromSelf, {
      decode: decodeDuration,
      encode: encodeDuration,
      strict: true,
    }),
  )
}

// Base nanosecond conversion constants
const MS_NANOS = BigInt(1_000_000)
const SEC_NANOS = MS_NANOS * BigInt(1_000)
const MIN_NANOS = SEC_NANOS * BigInt(60)
const HOUR_NANOS = MIN_NANOS * BigInt(60)
const DAY_NANOS = HOUR_NANOS * BigInt(24)

function decodeDuration(input: string): Duration.Duration {
  if (input === 'Infinity') {
    return Duration.infinity
  }

  // Split into components like ["1d", "2h", "3m", "4s", "5ms", "6ns"]
  const parts = input.trim().split(/\s+/)

  let totalNanos = BigInt(0)

  for (const part of parts) {
    const lastIndex = part.length - 1
    const lastChar = part[lastIndex]
    if (lastChar === 'd') {
      totalNanos += DAY_NANOS * BigInt(part.slice(0, lastIndex))
    } else if (lastChar === 'h') {
      totalNanos += HOUR_NANOS * BigInt(part.slice(0, lastIndex))
    } else if (lastChar === 'm') {
      totalNanos += MIN_NANOS * BigInt(part.slice(0, lastIndex))
    } else if (lastChar === 's') {
      const previousChar = part[lastIndex - 1]
      if (previousChar === 'm') {
        // Handle milliseconds (ms)
        totalNanos += MS_NANOS * BigInt(part.slice(0, lastIndex - 1))
      } else if (previousChar === 'n') {
        // Handle nanoseconds (ns)
        totalNanos += BigInt(part.slice(0, lastIndex - 1))
      } else {
        // Handle seconds (s)
        totalNanos += SEC_NANOS * BigInt(part.slice(0, lastIndex))
      }
    } else {
      throw new Error(`Invalid duration format: ${input}`)
    }
  }

  return Duration.nanos(totalNanos)
}

function encodeDuration(duration: Duration.Duration): string {
  return Duration.format(duration)
}

const ArbitraryJson = (space?: string | number) =>
  Schema.transform(Schema.String, Schema.Unknown, {
    decode: (input) => JSON.parse(input), // Never used, so we don't bother with error handling
    encode: (input) => JSON.stringify(input, null, space),
    strict: true,
  })

export function json<const Name extends string>(
  name: Name,
  space?: string | number,
): Parameter<Name, Schema.SchemaClass<unknown, string, never>> {
  return paramWithSchema(name, ArbitraryJson(space))
}

type CompiledTemplate<Name extends string, Values extends ReadonlyArray<Template.AnyParamType>> = (
  params: Template.Parameters<Values>,
) => Effect.Effect<
  { readonly name: Name; readonly params: Template.Parameters<Values>; readonly output: string },
  Template.ErrorFromValue<Values[number]> | TemplateFailure,
  Template.ContextFromValue<Values[number]>
>

export function template<const Name extends string>(name: Name) {
  return <const Values extends ReadonlyArray<Template.AnyParamType>>(
    template: TemplateStringsArray,
    ...values: Values
  ): Template<Name, Values> => liftTemplateImpl(new TemplateImpl(name, template, values))
}

export function dedent<const Name extends string>(name: Name) {
  return <const Values extends ReadonlyArray<Template.AnyParamType>>(
    template: TemplateStringsArray,
    ...values: Values
  ): Template<Name, Values> => liftDedentImpl(new TemplateImpl(name, template, values))
}

function liftTemplateImpl<
  const Name extends string,
  const Values extends ReadonlyArray<Template.AnyParamType>,
>(impl: TemplateImpl<Name, Values>): Template<Name, Values> {
  return liftImpl(impl, compile)
}

function liftDedentImpl<
  const Name extends string,
  const Values extends ReadonlyArray<Template.AnyParamType>,
>(impl: TemplateImpl<Name, Values>): Template<Name, Values> {
  return liftImpl(impl, compileDedent)
}

function liftImpl<
  const Name extends string,
  const Values extends ReadonlyArray<Template.AnyParamType>,
>(impl: TemplateImpl<Name, Values>, f: typeof compile): Template<Name, Values> {
  // Lazily compiled template
  let compiled: CompiledTemplate<Name, Values> | null = null
  function lifted(params: Template.Parameters<Values>) {
    if (!compiled) {
      compiled = f(impl)
    }
    return compiled(params)
  }

  Object.defineProperties(lifted, {
    _tag: { value: 'Template' },
    name: { value: impl.name },
    template: { value: impl.template },
    values: { value: impl.values },
  })

  return lifted as any
}

class TemplateImpl<
  const Name extends string,
  const Values extends ReadonlyArray<Template.AnyParamType>,
> {
  constructor(
    readonly name: Name,
    readonly template: TemplateStringsArray,
    readonly values: Values,
  ) {}
}

function compile<
  const Name extends string,
  const Values extends ReadonlyArray<Template.AnyParamType>,
>(template: TemplateImpl<Name, Values>): CompiledTemplate<Name, Values> {
  return (params = {} as Template.Parameters<Values>) =>
    pipe(
      params,
      encode_(compileParametersSchema(template)),
      Effect.catchTag('ParseError', TemplateFailure.fromParseError),
      Effect.map((output) => ({ name: template.name, params, output })),
    )
}

function compileDedent<
  const Name extends string,
  const Values extends ReadonlyArray<Template.AnyParamType>,
>(template: TemplateImpl<Name, Values>): CompiledTemplate<Name, Values> {
  const compiled = compile(template)

  return <const Params extends Template.Parameters<Values>>(params: Params) =>
    Effect.map(compiled(params as any), ({ name, output }) => ({
      name,
      params,
      output: utils.dedent(output),
    }))
}

const compileParametersSchemaCache = new WeakMap<
  TemplateImpl<any, any>,
  Schema.Schema<any, any, any>
>()

function compileParametersSchema<
  const Name extends string,
  const Values extends ReadonlyArray<Template.AnyParamType>,
>(t: TemplateImpl<Name, Values>): Schema.Schema<Template.Parameters<Values>, string, any> {
  const cached = compileParametersSchemaCache.get(t)
  if (cached) return cached

  const { template, values } = t
  const fields: Record<string, Schema.Schema<any, string, any>> = {}
  const staticParts = new Map<number, string>()
  const dynamicParts = new Map<
    number,
    [string | null, (...params: any[]) => Effect.Effect<string, any, any>]
  >()
  const parts: Array<'static' | 'dynamic'> = Array(values.length)

  for (let i = 0; i < values.length; i++) {
    const value = values[i]
    if (value === null || value === undefined) {
      staticParts.set(i, '')
      parts[i] = 'static'
    } else if (isPrimitive(value)) {
      staticParts.set(i, String(value))
      parts[i] = 'static'
    } else if (Effect.isEffect(value)) {
      dynamicParts.set(i, [null, () => value])
      parts[i] = 'dynamic'
    } else if (value._tag === 'Parameter') {
      fields[value.name] = Schema.typeSchema(value.schema)
      dynamicParts.set(i, [value.name, encode_(value.schema)])
      parts[i] = 'dynamic'
    } else if (value._tag === 'Template') {
      const valueSchema: Schema.Schema<any, string, any> = compileParametersSchema(value)
      fields[value.name] = Schema.typeSchema(valueSchema)
      dynamicParts.set(i, [value.name, encode_(valueSchema)])
      parts[i] = 'dynamic'
    } else {
      throw new Error(`Invalid template value: ${JSON.stringify(value)}`)
    }
  }

  const schema = Schema.transformOrFail(Schema.String, Schema.Struct(fields), {
    strict: true,
    decode: () =>
      Effect.dieMessage(
        'Not implemented intentionally, only encode is utilized. Schema is just for the convenience of Effect users.',
      ),
    encode: (input) => {
      return Effect.map(
        Effect.forEach(
          dynamicParts.values(),
          ([name, encode]) => {
            const effect = name === null ? encode() : encode(input[name])
            return effect
          },
          { concurrency: 'unbounded' },
        ),
        (computed) => {
          let result = template[0]
          let computedIndex = 0
          for (let i = 0; i < values.length; i++) {
            if (parts[i] === 'static') {
              result += staticParts.get(i)
            } else {
              result += computed[computedIndex++]
            }
            result += template[i + 1]
          }
          return result
        },
      )
    },
  }) as any

  compileParametersSchemaCache.set(t, schema)

  return schema
}

const encodeCache = new WeakMap<
  Schema.Schema<any, any, any>,
  (input: any) => Effect.Effect<any, any, any>
>()

function encode_<A, I, R>(schema: Schema.Schema<A, I, R>) {
  const cached = encodeCache.get(schema)
  if (cached) return cached
  const encode = Schema.encode(schema, { errors: 'all' })
  encodeCache.set(schema, encode)
  return encode
}

const PRIMITIVE_TYPEOF_VALUES = ['string', 'number', 'boolean', 'bigint', 'undefined']

function isPrimitive(value: Template.AnyParamType): value is Template.Primitive {
  return PRIMITIVE_TYPEOF_VALUES.includes(typeof value) || value === null
}
