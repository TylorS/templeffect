import {
  Duration,
  Effect,
  identity,
  ParseResult,
  pipe,
  Pipeable,
  Schema,
  Stream,
  type Types,
} from 'effect'
import { ArrayFormatter } from 'effect/ParseResult'
import { StringToUnsafe, type Unsafe, UnsafeFromString } from './unsafe.js'
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
    TemplateResult<Name, Template.Parameters<Values>>,
    Template.ErrorFromValue<Values[number]> | TemplateFailure,
    Template.ContextFromValue<Values[number]>
  >

  readonly stream: (
    ...[params]: [keyof Template.Parameters<Values>] extends [never]
      ? [{}?]
      : [Template.Parameters<Values>]
  ) => Stream.Stream<
    string,
    Template.ErrorFromValue<Values[number]> | TemplateFailure,
    Template.ContextFromValue<Values[number]>
  >
}

export interface TemplateResult<Name, Params> {
  readonly name: Name
  readonly params: Params
  readonly output: string
}

export declare namespace Template {
  export type Any = Template<any, readonly any[]>

  export type Primitive = string | number | boolean | bigint | null | undefined

  export type AnyParamType =
    | Primitive
    | Parameter<any, any>
    | Effect.Effect<Primitive, any, any>
    | Template<any, readonly any[]>
    | Unsafe

  export type Parameters<Values extends ReadonlyArray<AnyParamType>> = Types.Simplify<
    DeriveParameters<Values, {}>
  >

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

export class Parameter<
  Name extends string,
  Schema extends Schema.Schema<any, string, any> | Schema.Schema<any, Unsafe, any>,
> implements Pipeable.Pipeable
{
  readonly _tag = 'Parameter'

  constructor(
    readonly name: Name,
    readonly schema: Schema,
  ) {}

  pipe() {
    // biome-ignore lint/style/noArguments: <explanation>
    return Pipeable.pipeArguments(this, arguments)
  }

  unsafe<A, R>(this: Parameter<Name, Schema.Schema<A, string, R>>) {
    return asUnsafe(this)
  }
}

export function paramWithSchema<
  const Name extends string,
  const Schema extends Schema.Schema<any, string, any> | Schema.Schema<any, Unsafe, any>,
>(name: Name, schema: Schema): Parameter<Name, Schema> {
  return new Parameter(name, schema)
}

export function param<const Name extends string>(
  name: Name,
): Parameter<Name, typeof Schema.String> {
  return paramWithSchema(name, Schema.String)
}

export function unsafe<const Name extends string>(
  name: Name,
): Parameter<Name, typeof UnsafeFromString> {
  return paramWithSchema(name, UnsafeFromString)
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

export function asUnsafe<const Name extends string, A, R>(
  parameter: Parameter<Name, Schema.Schema<A, string, R>>,
) {
  return paramWithSchema(
    parameter.name,
    swap(Schema.compose(swap(parameter.schema), StringToUnsafe)),
  )
}

function swap<A, I, R>(schema: Schema.Schema<A, I, R>): Schema.Schema<I, A, R> {
  const decode = ParseResult.encode(schema, { errors: 'all' })
  const encode = ParseResult.decode(schema, { errors: 'all' })
  const typeSchema = Schema.typeSchema(schema)
  const encodedSchema = Schema.encodedSchema(schema)
  return Schema.transformOrFail(typeSchema, encodedSchema, {
    decode: decode,
    encode: encode,
    strict: true,
  })
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

type StreamedTemplate<Name extends string, Values extends ReadonlyArray<Template.AnyParamType>> = (
  params: Template.Parameters<Values>,
) => Stream.Stream<
  string,
  Template.ErrorFromValue<Values[number]> | TemplateFailure,
  Template.ContextFromValue<Values[number]>
>

export function template<const Name extends string>(name: Name) {
  return <const Values extends ReadonlyArray<Template.AnyParamType>>(
    template: TemplateStringsArray,
    ...values: Values
  ): Template<Name, Values> =>
    liftImpl(
      new TemplateImpl(name, template, values),
      (impl) => compile(impl, false),
      (impl) => compileStream(impl, false),
    )
}

export function dedent<const Name extends string>(name: Name) {
  return <const Values extends ReadonlyArray<Template.AnyParamType>>(
    template: TemplateStringsArray,
    ...values: Values
  ): Template<Name, Values> =>
    liftImpl(
      new TemplateImpl(name, template, values),
      (impl) => compile(impl, true),
      (impl) => compileStream(impl, true),
    )
}

function liftImpl<
  const Name extends string,
  const Values extends ReadonlyArray<Template.AnyParamType>,
>(
  impl: TemplateImpl<Name, Values>,
  f: (impl: TemplateImpl<Name, Values>) => CompiledTemplate<Name, Values>,
  g: (impl: TemplateImpl<Name, Values>) => StreamedTemplate<Name, Values>,
): Template<Name, Values> {
  // Lazily compiled template
  let compiled: CompiledTemplate<Name, Values> | null = null
  function lifted(params: Template.Parameters<Values>) {
    if (!compiled) {
      compiled = f(impl)
    }
    return compiled(params)
  }

  let streamed: StreamedTemplate<Name, Values> | null = null
  function liftedStream(params: Template.Parameters<Values>) {
    if (!streamed) {
      streamed = g(impl)
    }
    return streamed(params)
  }

  Object.defineProperties(lifted, {
    _tag: { value: 'Template' },
    name: { value: impl.name },
    template: { value: impl.template },
    values: { value: impl.values },
    stream: { value: liftedStream },
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
>(template: TemplateImpl<Name, Values>, indent: boolean): CompiledTemplate<Name, Values> {
  const compiled = compileParametersSchema(template, indent)
  return (params = {} as Template.Parameters<Values>) =>
    pipe(
      params,
      encode_(compiled),
      Effect.catchTag('ParseError', TemplateFailure.fromParseError),
      Effect.map((output) => ({ name: template.name, params, output })),
    )
}

function compileStream<
  const Name extends string,
  const Values extends ReadonlyArray<Template.AnyParamType>,
>(template: TemplateImpl<Name, Values>, indent: boolean): StreamedTemplate<Name, Values> {
  const { values, template: templateStrings } = template
  const { parts, staticParts, dynamicParts } = compileParameters(template, indent)
  const minIndent = utils.getMinIndent(templateStrings)

  return (params = {} as Template.Parameters<Values>) =>
    Stream.asyncEffect<
      string,
      Template.ErrorFromValue<Values[number]> | TemplateFailure,
      Template.ContextFromValue<Values[number]>
    >(
      (
        emit,
      ): Effect.Effect<
        void,
        Template.ErrorFromValue<Values[number]> | TemplateFailure,
        Template.ContextFromValue<Values[number]>
      > =>
        Effect.gen(function* () {
          const fiberId = yield* Effect.fiberId
          const buffer = utils.withBuffers(values.length, emit, fiberId)
          
          // Process first template part with dedentation
          const firstPart = utils.processTemplatePart(
            templateStrings[0],
            minIndent,
            indent,
            true,
            null,
          )
          yield* Effect.promise(() => emit.single(firstPart))
          let lastContent = firstPart
          
          yield* Effect.forEach(
            parts,
            (part, index) => {
              if (part === 'static') {
                // biome-ignore lint/style/noNonNullAssertion: We know the buffer exists
                const staticValue = staticParts.get(index)!
                const processedValue = utils.processValuePart(
                  staticValue,
                  minIndent,
                  indent,
                  lastContent,
                )
                const nextTemplate = utils.processTemplatePart(
                  templateStrings[index + 1],
                  minIndent,
                  indent,
                  false,
                  processedValue,
                )
                lastContent = nextTemplate
                return buffer
                  .onSuccess(index, processedValue)
                  .pipe(
                    Effect.zipRight(buffer.onSuccess(index, nextTemplate)),
                    Effect.zipRight(buffer.onEnd(index)),
                  )
              }

              // biome-ignore lint/style/noNonNullAssertion: We know the buffer exists
              const [name, encode] = dynamicParts.get(index)!
              return encode(name === null ? {} : params[name as keyof typeof params]).pipe(
                Effect.map((value) => utils.processValuePart(value, minIndent, indent, lastContent)),
                Effect.flatMap((processedValue) => {
                  const nextTemplate = utils.processTemplatePart(
                    templateStrings[index + 1],
                    minIndent,
                    indent,
                    false,
                    processedValue,
                  )
                  lastContent = nextTemplate
                  return buffer
                    .onSuccess(index, processedValue)
                    .pipe(
                      Effect.zipRight(buffer.onSuccess(index, nextTemplate)),
                      Effect.zipRight(buffer.onEnd(index)),
                    )
                }),
              )
            },
            { concurrency: 'unbounded' },
          )
        }),
    )
}

const compileParametersSchemaCache = new WeakMap<TemplateImpl<any, any>, CompiledParameters>()

type CompiledParameters = {
  fields: Record<string, Schema.Schema<any, string, any>>
  staticParts: Map<number, string>
  dynamicParts: Map<number, [string | null, (...params: any[]) => Effect.Effect<string, any, any>]>
  parts: Array<'static' | 'dynamic'>
}

function compileParameters<
  const Name extends string,
  const Values extends ReadonlyArray<Template.AnyParamType>,
>(t: TemplateImpl<Name, Values>, indent: boolean): CompiledParameters {
  const cached = compileParametersSchemaCache.get(t)
  if (cached) return cached as CompiledParameters

  const { values } = t
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
      dynamicParts.set(i, [null, () => Effect.map(value, String)])
      parts[i] = 'dynamic'
    } else if (value._tag === 'Parameter') {
      fields[value.name] = Schema.typeSchema(value.schema)
      dynamicParts.set(i, [value.name, encode_(value.schema)])
      parts[i] = 'dynamic'
    } else if (value._tag === 'Template') {
      const valueSchema: Schema.Schema<any, string, any> = compileParametersSchema(value, indent)
      fields[value.name] = Schema.typeSchema(valueSchema)
      dynamicParts.set(i, [value.name, encode_(valueSchema)])
      parts[i] = 'dynamic'
    } else {
      throw new Error(`Invalid template value: ${JSON.stringify(value)}`)
    }
  }

  compileParametersSchemaCache.set(t, { fields, staticParts, dynamicParts, parts })

  return { fields, staticParts, dynamicParts, parts } as any
}

function compileParametersSchema<
  const Name extends string,
  const Values extends ReadonlyArray<Template.AnyParamType>,
>(
  t: TemplateImpl<Name, Values>,
  indent: boolean,
): Schema.Schema<Template.Parameters<Values>, string, any> {
  const { template, values } = t
  const { fields, staticParts, dynamicParts, parts } = compileParameters(t, indent)

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
          ([name, encode]) => encode(name === null ? {} : input[name]),
          { concurrency: 'unbounded' },
        ),
        (computed) => {
          // Convert all computed values to strings first
          const computedStrings: string[] = []
          let computedIndex = 0
          for (let i = 0; i < values.length; i++) {
            if (parts[i] === 'static') {
              // biome-ignore lint/style/noNonNullAssertion: <explanation>
              computedStrings.push(staticParts.get(i)!)
            } else {
              computedStrings.push(computed[computedIndex++])
            }
          }

          // Use the optimized template processing function
          return utils.processTemplate(template, computedStrings, indent)
        },
      )
    },
  })

  return schema as any
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
  return (params: A = {} as A) => encode(params)
}

const PRIMITIVE_TYPEOF_VALUES = ['string', 'number', 'boolean', 'bigint', 'undefined']

function isPrimitive(value: Template.AnyParamType): value is Template.Primitive {
  return PRIMITIVE_TYPEOF_VALUES.includes(typeof value) || value === null
}
