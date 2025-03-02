import {
  type BigDecimal,
  Duration,
  Effect,
  identity,
  ParseResult,
  pipe,
  Pipeable,
  Record,
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

  <
    Params extends HasRequiredKeys<Template.Parameters<Values>> extends true
      ? [Template.Parameters<Values>]
      : [Template.Parameters<Values>?],
  >(
    ...[params]: Params
  ): Effect.Effect<
    string,
    Template.ErrorFromValue<Values[number]> | Template.ErrorFromParams<Params[0]> | TemplateFailure,
    Template.ContextFromValue<Values[number]> | Template.ContextFromParams<Params[0]>
  >

  readonly stream: <
    Params extends HasRequiredKeys<Template.Parameters<Values>> extends true
      ? [Template.Parameters<Values>]
      : [Template.Parameters<Values>?],
  >(
    ...[params]: Params
  ) => Stream.Stream<
    string,
    Template.ErrorFromValue<Values[number]> | TemplateFailure,
    Template.ContextFromValue<Values[number]>
  >
}

export type Parameters<T extends Template<any, any>> = T extends Template<any, infer Values>
  ? Template.Parameters<Values>
  : never

type HasRequiredKeys<T> = {} extends T ? false : true

export declare namespace Template {
  export type Any = Template<any, readonly any[]>

  export type Primitive = string | number | boolean | bigint | null | undefined

  export type AnyParamType =
    | Primitive
    | Parameter.Any
    | ForEach<Parameter.Any, any, any>
    | With<Parameter.Any, any, any>
    | Effect.Effect<Primitive, any, any>
    | Template<any, readonly any[]>
    | Unsafe

  export type Parameters<Values extends ReadonlyArray<AnyParamType>> = Types.Simplify<
    DeriveParameters<Values, true, {}>
  >

  export type ResolvedParameters<Values extends ReadonlyArray<AnyParamType>> = Types.Simplify<
    DeriveParameters<Values, false, {}>
  >

  export type Error<T extends Template<any, any>> = T extends Template<any, infer Values>
    ? ErrorFromValue<Values[number]>
    : never

  type ErrorFromValue<T extends Template.AnyParamType> = T extends Effect.Effect<any, any, any>
    ? Effect.Effect.Error<T>
    : T extends Template<infer _, infer Values>
      ? ErrorFromValue<Values[number]>
      : [T] extends [ForEach<infer _, infer E, infer __>]
        ? E
        : [T] extends [With<infer _, infer E, infer __>]
          ? E
          : never

  type ErrorFromParams<T> = {
    [K in keyof T]: T[K] extends Effect.Effect<any, any, any> ? Effect.Effect.Error<T[K]> : never
  }[keyof T]

  export type Context<T extends Template<any, any>> = T extends Template<any, infer Values>
    ? ContextFromValue<Values[number]>
    : never

  type ContextFromValue<T extends Template.AnyParamType> = [T] extends [
    Effect.Effect<any, any, infer R>,
  ]
    ? R
    : T extends Template<any, infer Values>
      ? ContextFromValue<Values[number]>
      : [T] extends [ForEach<infer _, infer __, infer R>]
        ? R
        : [T] extends [With<infer _, infer __, infer R>]
          ? R
          : never

  type ContextFromParams<T> = {
    [K in keyof T]: T[K] extends Effect.Effect<any, any, infer R>
      ? R
      : T[K] extends Template<any, infer Values>
        ? ContextFromValue<Values[number]>
        : never
  }[keyof T]

  type DeriveParameters<
    Values extends ReadonlyArray<any>,
    IncludeEffects extends boolean,
    Result extends Record<string, any>,
  > = Values extends readonly [infer First, ...infer Rest]
    ? DeriveParameters<Rest, IncludeEffects, Result & DeriveParameter<First, IncludeEffects>>
    : Result

  type DeriveParameter<Value, IncludeEffects extends boolean> = [Value] extends [
    Parameter<infer Name, infer A, infer _I, infer _R, infer Optional>,
  ]
    ? Optional extends true
      ? {
          readonly [K in Name]?:
            | A
            | (IncludeEffects extends true ? Effect.Effect<A, any, any> : never)
        }
      : {
          readonly [K in Name]:
            | A
            | (IncludeEffects extends true ? Effect.Effect<A, any, any> : never)
        }
    : [Value] extends [Template<infer Name, infer Values extends ReadonlyArray<any>>]
      ? { readonly [K in Name]: DeriveParameters<Values, IncludeEffects, {}> }
      : [Value] extends [ForEach<infer Parameter extends Parameter.Any, infer E, infer R>]
        ? {
            readonly [K in Parameter.Name<Parameter>]:
              | ReadonlyArray<Parameter.Type<Parameter>>
              | (IncludeEffects extends true
                  ? Effect.Effect<ReadonlyArray<Parameter.Type<Parameter>>, any, any>
                  : never)
          }
        : [Value] extends [With<infer Parameter extends Parameter.Any, infer E, infer R>]
          ? {
              readonly [K in Parameter.Name<Parameter>]:
                | Parameter.Type<Parameter>
                | (IncludeEffects extends true
                    ? Effect.Effect<Parameter.Type<Parameter>, any, any>
                    : never)
            }
          : {}
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
  A,
  I extends string | Unsafe | null | undefined,
  R,
  Optional extends boolean = false,
> implements Pipeable.Pipeable
{
  readonly _tag = 'Parameter'

  constructor(
    readonly name: Name,
    readonly schema: Schema.Schema<A, I, R>,
    readonly isOptional: Optional,
    readonly fallback: () => string,
  ) {}

  pipe() {
    // biome-ignore lint/style/noArguments: <explanation>
    return Pipeable.pipeArguments(this, arguments)
  }

  unsafe(this: Parameter<Name, A, string, R, Optional>): Parameter<Name, A, Unsafe, R, Optional> {
    return asUnsafe(this)
  }

  optional(
    this: Parameter<Name, A, string, R, Optional> | Parameter<Name, A, Unsafe, R, Optional>,
    fallback: string | (() => string) = () => '',
  ): this extends Parameter<Name, A, string, R, Optional>
    ? Parameter<Name, A | null | undefined, string | null | undefined, R, true>
    : Parameter<Name, A | null | undefined, Unsafe | null | undefined, R, true> {
    return paramWithSchema(this.name, Schema.NullishOr(this.schema), true, fallback) as any
  }
}

export namespace Parameter {
  export type Any = Parameter<any, any, any, any, any>

  export type Name<T extends Any> = T extends Parameter<infer Name, any, any, any, any>
    ? Name
    : never
  export type Type<T extends Any> = T extends Parameter<
    any,
    infer A,
    infer I,
    infer R,
    infer Optional
  >
    ? [Optional] extends [false]
      ? A
      : A | undefined
    : never
  export type Input<T extends Any> = T extends Parameter<any, any, infer I, any, infer Optional>
    ? [Optional] extends [false]
      ? I
      : I | undefined
    : never
  export type Output<T extends Any> = T extends Parameter<any, any, any, infer R, any> ? R : never
  export type Optional<T extends Any> = T extends Parameter<any, any, any, any, infer Optional>
    ? Optional
    : never
}

export function paramWithSchema<
  const Name extends string,
  const A,
  const I extends string | Unsafe | null | undefined,
  const R,
  const Optional extends boolean = false,
>(
  name: Name,
  schema: Schema.Schema<A, I, R>,
  optional: Optional = false as Optional,
  fallback: string | (() => string) = () => '',
): Parameter<Name, A, I, R, Optional> {
  return new Parameter(
    name,
    schema,
    optional,
    typeof fallback === 'function' ? fallback : () => fallback,
  )
}

export function param<const Name extends string>(
  name: Name,
): Parameter<Name, string, string, never, false> {
  return paramWithSchema(name, Schema.String)
}

export function unsafe<const Name extends string>(
  name: Name,
): Parameter<Name, string, Unsafe, never, false> {
  return paramWithSchema(name, UnsafeFromString)
}

export function number<const Name extends string>(
  name: Name,
): Parameter<Name, number, string, never, false> {
  return paramWithSchema(name, Schema.NumberFromString)
}

export function boolean<const Name extends string>(
  name: Name,
): Parameter<Name, boolean, string, never, false> {
  return paramWithSchema(name, Schema.compose(Schema.String, Schema.BooleanFromString))
}

export function integer<const Name extends string>(
  name: Name,
): Parameter<Name, number, string, never, false> {
  return paramWithSchema(name, Schema.compose(Schema.NumberFromString, Schema.Int))
}

export function uuid<const Name extends string>(
  name: Name,
): Parameter<Name, string, string, never, false> {
  return paramWithSchema(name, Schema.UUID)
}

export function ulid<const Name extends string>(
  name: Name,
): Parameter<Name, string, string, never, false> {
  return paramWithSchema(name, Schema.ULID)
}

export function date<const Name extends string>(
  name: Name,
): Parameter<Name, Date, string, never, false> {
  return paramWithSchema(name, Schema.Date)
}

export function bigInt<const Name extends string>(
  name: Name,
): Parameter<Name, bigint, string, never, false> {
  return paramWithSchema(name, Schema.BigInt)
}

export function bigDecimal<const Name extends string>(
  name: Name,
): Parameter<Name, BigDecimal.BigDecimal, string, never, false> {
  return paramWithSchema(name, Schema.BigDecimal)
}

export function duration<const Name extends string>(
  name: Name,
): Parameter<Name, Duration.Duration, string, never, false> {
  return paramWithSchema(
    name,
    Schema.transform(Schema.String, Schema.DurationFromSelf, {
      decode: decodeDuration,
      encode: encodeDuration,
      strict: true,
    }),
  )
}

export function asUnsafe<
  const Name extends string,
  A,
  I extends string,
  R,
  Optional extends boolean,
>(parameter: Parameter<Name, A, I, R, Optional>) {
  return paramWithSchema<Name, A, Unsafe, R, Optional>(
    parameter.name,
    swap(Schema.compose(swap(parameter.schema), StringToUnsafe)),
    parameter.isOptional,
    parameter.fallback,
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
): Parameter<Name, unknown, string, never, false> {
  return paramWithSchema(name, ArbitraryJson(space))
}

type CompiledTemplate<Values extends ReadonlyArray<Template.AnyParamType>> = (
  params: Template.ResolvedParameters<Values>,
) => Effect.Effect<
  string,
  Template.ErrorFromValue<Values[number]> | TemplateFailure,
  Template.ContextFromValue<Values[number]>
>

type StreamedTemplate<Values extends ReadonlyArray<Template.AnyParamType>> = (
  params: Template.ResolvedParameters<Values>,
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
  f: (impl: TemplateImpl<Name, Values>) => CompiledTemplate<Values>,
  g: (impl: TemplateImpl<Name, Values>) => StreamedTemplate<Values>,
): Template<Name, Values> {
  // Lazily compiled template
  let compiled: CompiledTemplate<Values> | null = null
  function lifted(params: Template.Parameters<Values>) {
    if (!compiled) {
      compiled = f(impl)
    }
    return compiled(params)
  }

  let streamed: StreamedTemplate<Values> | null = null
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
>(template: TemplateImpl<Name, Values>, indent: boolean): CompiledTemplate<Values> {
  const compiled = compileParametersSchema(template, indent)
  return <P extends Template.Parameters<Values>>(params: P = {} as P) =>
    pipe(
      Effect.flatMap(unwrap<Values, P>(params), encode_(compiled)),
      Effect.catchTag('ParseError', TemplateFailure.fromParseError),
    ) as any
}

const UNBOUNDED_CONCURRENCY = { concurrency: 'unbounded' } as const

function unwrap<
  const Values extends ReadonlyArray<Template.AnyParamType>,
  const P extends Template.Parameters<Values>,
>(
  params: P,
): Effect.Effect<
  Template.ResolvedParameters<Values>,
  {
    [K in keyof P]: P[K] extends Effect.Effect<any, any, any> ? Effect.Effect.Error<P[K]> : never
  }[keyof P],
  {
    [K in keyof P]: P[K] extends Effect.Effect<any, any, any> ? Effect.Effect.Context<P[K]> : never
  }[keyof P]
> {
  return Effect.all(
    Record.map(params as {}, (v) => (Effect.isEffect(v) ? v : Effect.succeed(v))) as any,
    UNBOUNDED_CONCURRENCY,
  ) as any
}

function compileStream<
  const Name extends string,
  const Values extends ReadonlyArray<Template.AnyParamType>,
>(template: TemplateImpl<Name, Values>, indent: boolean): StreamedTemplate<Values> {
  const { values, template: templateStrings } = template
  const { parts, staticParts, dynamicParts } = compileParameters(template, indent)
  const minIndent = utils.getMinIndent(templateStrings)

  return <P extends Template.Parameters<Values>>(params: P = {} as P) =>
    Stream.asyncEffect<
      string,
      Template.ErrorFromValue<Values[number]> | TemplateFailure,
      Template.ContextFromValue<Values[number]>
    >((emit) =>
      Effect.flatMap(unwrap<Values, P>(params), (params: Template.ResolvedParameters<Values>) =>
        Effect.fiberIdWith((fiberId) => {
          const buffer = utils.withBuffers(values.length, emit, fiberId)
          const firstPart = utils.processTemplatePart(
            templateStrings[0],
            minIndent,
            indent,
            true,
            null,
          )
          return Effect.promise(() => emit.single(firstPart)).pipe(
            Effect.zipRight(
              Effect.forEach(parts, (part: 'static' | 'dynamic', index: number) => {
                const lastContent = templateStrings[index]
                if (part === 'static') {
                  // biome-ignore lint/style/noNonNullAssertion: We know the buffer exists
                  const staticValue = staticParts.get(index)!
                  const processedValue = utils.processValuePart(staticValue, indent, lastContent)
                  const nextTemplate = utils.processTemplatePart(
                    templateStrings[index + 1],
                    minIndent,
                    indent,
                    false,
                    processedValue,
                  )
                  return buffer
                    .onSuccess(index, processedValue)
                    .pipe(
                      Effect.zipRight(buffer.onSuccess(index, nextTemplate)),
                      Effect.zipRight(buffer.onEnd(index)),
                    )
                }

                // biome-ignore lint/style/noNonNullAssertion: We know the buffer exists
                const [name, encode, fallback] = dynamicParts.get(index)!
                return encode(
                  name === null ? {} : (params[name as keyof typeof params] ?? fallback?.()),
                ).pipe(
                  Effect.map((value) => utils.processValuePart(value, indent, lastContent)),
                  Effect.flatMap((processedValue) => {
                    const nextTemplate = utils.processTemplatePart(
                      templateStrings[index + 1],
                      minIndent,
                      indent,
                      false,
                      processedValue,
                    )
                    return buffer
                      .onSuccess(index, processedValue)
                      .pipe(
                        Effect.zipRight(buffer.onSuccess(index, nextTemplate)),
                        Effect.zipRight(buffer.onEnd(index)),
                      )
                  }),
                )
              }),
            ),
          )
        }),
      ),
    )
}

const compileParametersSchemaCache = new WeakMap<TemplateImpl<any, any>, CompiledParameters>()

type CompiledParameters = {
  fields: Record<string, Schema.Schema<any, string, any>>
  staticParts: Map<number, string>
  dynamicParts: Map<
    number,
    [
      key: string | null,
      encode: (...params: any[]) => Effect.Effect<string, any, any>,
      fallback?: () => string,
    ]
  >
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
    [
      key: string | null,
      encode: (...params: any[]) => Effect.Effect<string, any, any>,
      fallback?: () => string,
    ]
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
      const tuple: [
        key: string | null,
        encode: (...params: any[]) => Effect.Effect<string, any, any>,
        fallback?: () => string,
      ] = [value.name, encode_(value.schema)]
      if (value.isOptional) {
        tuple.push(value.fallback)
      }
      dynamicParts.set(i, tuple)
      parts[i] = 'dynamic'
    } else if (value._tag === 'Template') {
      const valueSchema: Schema.Schema<any, string, any> = compileParametersSchema(value, indent)
      fields[value.name] = Schema.typeSchema(valueSchema)
      dynamicParts.set(i, [value.name, encode_(valueSchema)])
      parts[i] = 'dynamic'
    } else if (value._tag === 'ForEach') {
      const parameter = value.parameter
      const typeSchema = Schema.Array(Schema.typeSchema(parameter.schema))
      fields[parameter.name] = typeSchema as any
      dynamicParts.set(i, [
        parameter.name,
        encode_(
          Schema.String.pipe(
            Schema.transformOrFail(typeSchema, {
              decode: () =>
                Effect.dieMessage('Not implemented intentionally, only encode is utilized.'),
              encode: (input) =>
                Effect.forEach(
                  input,
                  (item, i) =>
                    pipe(
                      item,
                      encode_(parameter.schema),
                      Effect.flatMap((input) => {
                        const y = value.fn({ value: item, input }, i)
                        if (Effect.isEffect(y)) {
                          return y
                        }
                        return Effect.succeed(y)
                      }),
                    ),
                  UNBOUNDED_CONCURRENCY,
                ).pipe(Effect.map((items) => items.join(value.delimiter))),
              strict: true,
            }),
          ),
        ),
      ])
      parts[i] = 'dynamic'
    } else if (value._tag === 'With') {
      const fn = value.fn
      const schema = value.parameter.schema
      fields[value.parameter.name] = Schema.typeSchema(schema)
      dynamicParts.set(i, [
        value.parameter.name,
        (value) =>
          pipe(
            value,
            encode_(schema),
            Effect.flatMap((input) => {
              const y = fn({ value, input })
              if (Effect.isEffect(y)) {
                return y
              }
              return Effect.succeed(y)
            }),
          ),
      ])
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
          ([name, encode, fallback]) => encode(name === null ? {} : (input[name] ?? fallback?.())),
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

export class ForEach<P extends Parameter.Any, E, R> {
  readonly _tag = 'ForEach' as const

  constructor(
    readonly parameter: P,
    readonly fn: (
      params: { value: Parameter.Type<P>; input: Parameter.Input<P> },
      index: number,
    ) => string | Effect.Effect<string, E, R>,
    readonly delimiter: string,
  ) {}

  separator(delimiter: string): ForEach<P, E, R> {
    return new ForEach(this.parameter, this.fn, delimiter)
  }
}

export function forEach<P extends Parameter.Any, E = never, R = never>(
  parameter: P,
  fn: (
    params: { value: Parameter.Type<P>; input: Parameter.Input<P> },
    index: number,
  ) => string | Effect.Effect<string, E, R>,
  separator = '',
): ForEach<P, E, R> {
  return new ForEach(parameter, fn, separator)
}

export class With<P extends Parameter.Any, E, R> {
  readonly _tag = 'With' as const

  constructor(
    readonly parameter: P,
    readonly fn: ({
      value,
      input,
    }: { value: Parameter.Type<P>; input: Parameter.Input<P> }) =>
      | string
      | Effect.Effect<string, E, R>,
  ) {}
}

function with_<P extends Parameter.Any, E = never, R = never>(
  parameter: P,
  fn: (params: { value: Parameter.Type<P>; input: Parameter.Input<P> }) =>
    | string
    | Effect.Effect<string, E, R>,
): With<P, E, R> {
  return new With(parameter, fn)
}

export { with_ as with }

export class Case<P extends Parameter.Any, E = never, R = never, E2 = never, R2 = never> {
  constructor(
    readonly parameter: P,
    readonly predicate: (params: { value: Parameter.Type<P>; input: Parameter.Input<P> }) =>
      | boolean
      | Effect.Effect<boolean, E, R>,
    readonly then: (params: { value: Parameter.Type<P>; input: Parameter.Input<P> }) =>
      | string
      | Effect.Effect<string, E2, R2>,
  ) {}
}

export namespace Case {
  export type Any = Case<Parameter.Any, any, any, any, any>
}

function if_<
  P extends Parameter.Any,
  E = never,
  R = never,
  E2 = never,
  R2 = never,
  E3 = never,
  R3 = never,
>(
  parameter: P,
  ifParams: {
    if: (params: { value: Parameter.Type<P>; input: Parameter.Input<P> }) =>
      | boolean
      | Effect.Effect<boolean, E, R>
    then: (params: { value: Parameter.Type<P>; input: Parameter.Input<P> }) =>
      | string
      | Effect.Effect<string, E2, R2>
    else: (params: { value: Parameter.Type<P>; input: Parameter.Input<P> }) =>
      | string
      | Effect.Effect<string, E3, R3>
  },
) {
  return with_(parameter, (params) =>
    Effect.if(ifParams.if(params), {
      onTrue: () => liftEffect_(ifParams.then(params)),
      onFalse: () => liftEffect_(ifParams.else(params)),
    }),
  )
}

export { if_ as if }

function liftEffect_<A, E = never, R = never>(
  valueOrEffect: A | Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R> {
  if (Effect.isEffect(valueOrEffect)) {
    return valueOrEffect
  }
  return Effect.succeed(valueOrEffect)
}
