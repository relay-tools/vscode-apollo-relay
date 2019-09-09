import { RelayKnownVariableNames } from "../src/RelayKnownVariableNames"
import { parse, buildSchema, validate } from "graphql"
import { generateDirectivesFile } from "../src/generateDirectivesFile"
import { readFileSync } from "fs"

const schema = buildSchema(`
${readFileSync(generateDirectivesFile(), "utf8")}

type Foo {
  bar: String
  baz: Boolean
}

type Query {
  foo: Foo
  node(id: ID!): Foo
}
`)

function validateDocuments(source: string) {
  return validate(schema, parse(source), [RelayKnownVariableNames])
}

describe(RelayKnownVariableNames, () => {
  it("Validates regular queries fine", () => {
    const errors = validateDocuments(`
      query MyQuery($id: ID!) {
        ... {
          node(id: $id) @include(if: $shouldInclude) {
            bar
          }
        }
      }
    `)

    expect(errors.length).toBe(1)
    expect(errors).toContainEqual(
      expect.objectContaining({ message: 'Variable "$shouldInclude" is not defined by operation "MyQuery".' })
    )
  })

  it("Validates fragments", () => {
    const errors = validateDocuments(`
      fragment MyFragment on Query @argumentDefinitions(id: { type: "ID!"}) {
        ... {
          node(id: $id) @include(if: $shouldInclude) {
            bar
          }
        }
      }
    `)

    expect(errors.length).toBe(1)
    expect(errors).toContainEqual(
      expect.objectContaining({
        message:
          'Variable "$shouldInclude" is not defined by fragment "MyFragment" or defined in a compatible way across all operations using "MyFragment".',
      })
    )
  })

  it("Allows operation defined variables", () => {
    const errors = validateDocuments(`
      query MyQuery ($id: ID!) {
        ... MyFragment
      }
      fragment MyFragment on Query {
        ... {
          node(id: $id) @include(if: $shouldInclude) {
            bar
          }
        }
      }
    `)

    expect(errors).toHaveLength(1)
    expect(errors).toContainEqual(
      expect.objectContaining({
        message:
          'Variable "$shouldInclude" is not defined by fragment "MyFragment" or defined in a compatible way across all operations using "MyFragment".',
      })
    )
  })
})
