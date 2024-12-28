# templeffect

A powerful, type-safe templating library for TypeScript powered by [Effect](https://effect.website). It provides a seamless way to create and compose templates with built-in parameter validation, template nesting, and automatic type inference.

## Features

- 🔒 Type-safe template parameters
- 🎯 Built-in parameter validation
- 🔄 Template composition and nesting
- 📐 Automatic indentation handling
- ⚡ Effect-based async template resolution
- 🌊 Streaming template rendering support
- 🎨 Rich parameter type support (strings, numbers, dates, UUIDs, etc.)
- 🔧 Custom Schema support for anything that can be encoded as a string

## Installation

```bash
npm install templeffect
# or
yarn add templeffect
# or
pnpm add templeffect
```

## Quick Example

```typescript
import * as T from 'templeffect'
import { Effect } from 'effect'

// Create a template with a typed parameter
const makeHtml = T.template('page')`<html>
  <body>
    <h1>Hello, ${T.param('name')}!</h1>
  </body>
</html>`

// Use the template with type checking
Effect.runPromise(makeHtml({ name: 'world' }))
  .then(result => console.log(result.output))
```

## API Documentation

### Template Creation

#### `template(name: string)`

Creates a new template with the given name. The template supports parameter interpolation and type checking.

```typescript
const greeting = T.template('greeting')`Hello, ${T.param('name')}!`
```

#### `dedent(name: string)`

Creates a new template that automatically removes common leading whitespace from every line, making template definitions more readable.

```typescript
const html = T.dedent('page')`
  <html>
    <body>
      <h1>${T.param('title')}</h1>
    </body>
  </html>`
```

### Parameter Types

#### `param(name: string)`
Creates a string parameter.
```typescript
T.param('name') // Type: string
```

#### `number(name: string)`
Creates a number parameter that parses from string.
```typescript
T.number('age') // Type: number
```

#### `boolean(name: string)`
Creates a boolean parameter that parses from string.
```typescript
T.boolean('isActive') // Type: boolean
```

#### `integer(name: string)`
Creates an integer parameter that parses from string.
```typescript
T.integer('count') // Type: number (integer)
```

#### `uuid(name: string)`
Creates a UUID parameter with validation.
```typescript
T.uuid('id') // Type: string (UUID format)
```

#### `ulid(name: string)`
Creates a ULID parameter with validation.
```typescript
T.ulid('id') // Type: string (ULID format)
```

#### `date(name: string)`
Creates a Date parameter.
```typescript
T.date('timestamp') // Type: Date
```

#### `bigInt(name: string)`
Creates a BigInt parameter.
```typescript
T.bigInt('largeNumber') // Type: bigint
```

#### `bigDecimal(name: string)`
Creates a BigDecimal parameter.
```typescript
T.bigDecimal('precise') // Type: bigdecimal
```

#### `duration(name: string)`
Creates a Duration parameter that handles time spans.
```typescript
T.duration('timeout') // Type: Duration
```

#### `json(name: string, space?: string | number)`
Creates a parameter that handles JSON data with optional pretty printing.
```typescript
T.json('data', 2) // Type: unknown (parsed JSON)
```

### Advanced Features

#### Template Nesting

Templates can be nested within other templates:

```typescript
const header = T.template('header')`<h1>${T.param('title')}</h1>`
const page = T.template('page')`
  <html>
    <body>
      ${header}
      <p>${T.param('content')}</p>
    </body>
  </html>`

// Usage
page({
  header: { title: 'Welcome' },
  content: 'Hello world!'
})
```

#### Streaming Templates

Templates can be streamed for efficient processing of large templates or real-time output:

```typescript
import { Stream } from 'effect'

const largeTemplate = T.template('large')`
  <div>
    <h1>${T.param('title')}</h1>
    ${T.param('content')}
  </div>`

// Access the streaming version of the template
const stream = largeTemplate.stream({ 
  title: 'Large Content',
  content: '...' 
})

// Process the stream in chunks
Stream.runForEach(
  stream,
  (chunk) => console.log(chunk), // Each chunk is a string
)
```

The streaming implementation:
- Processes template parts incrementally
- Maintains proper indentation across chunks
- Handles both static and dynamic content
- Preserves template composition
- Supports dedentation with `T.dedent`

Example with dedentation and streaming:

```typescript
const indentedTemplate = T.dedent('page')`
  <html>
    <body>
      <h1>${T.param('title')}</h1>
      <div>
        ${T.param('content')}
      </div>
    </body>
  </html>`

// Stream with proper indentation
const stream = indentedTemplate.stream({
  title: 'Streaming Demo',
  content: 'Multi\nLine\nContent'
})

// Each chunk will maintain proper indentation
Stream.runForEach(stream, console.log)
```

#### Effect Integration

Templates can directly use Effect values:

```typescript
const dynamic = T.template('dynamic')`
  <div>
    ${Effect.succeed('Dynamic content')}
  </div>`
```

## License

MIT

