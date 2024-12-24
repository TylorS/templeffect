import { Schema } from 'effect'

/**
 * Marks content as unsafe/raw, skipping indentation processing
 */
export class Unsafe extends Schema.TaggedClass<Unsafe>()('Unsafe', { content: Schema.String }) {}

export class UnsafeFromString extends Schema.transform(Unsafe, Schema.String, {
  strict: true,
  encode: (fromA) => new Unsafe({ content: fromA }),
  decode: (toI) => toI.content,
}) {}

export class StringToUnsafe extends Schema.transform(Schema.String, Unsafe, {
  strict: true,
  decode: (fromA) => new Unsafe({ content: fromA }),
  encode: (toI) => toI.content,
}) {}
