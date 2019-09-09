import { RelayVariablesInAllowedPosition } from "../src/RelayVariablesInAllowedPosition"
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
  nodes(ids: [ID!]): [Foo]
}
`)

function validateDocuments(source: string) {
  return validate(schema, parse(source), [RelayVariablesInAllowedPosition])
}

describe(RelayVariablesInAllowedPosition, () => {
  it("Allows valid query", () => {
    const errors = validateDocuments(`
      query MyQuery($id: ID!) {
        ... {
          node(id: $id) {
            bar
          }
        }
      }
    `)

    expect(errors.length).toBe(0)
  })

  it("Disallows invalid query", () => {
    const errors = validateDocuments(`
      query MyQuery($id: ID) {
        ... {
          node(id: $id) {
            bar
          }
        }
      }
  `)

    expect(errors.length).toBe(1)
    expect(errors).toContainEqual(
      expect.objectContaining({ message: 'Variable "$id" of type "ID" used in position expecting type "ID!".' })
    )
  })

  it("Allows valid fragment", () => {
    const errors = validateDocuments(`
      fragment MyFragment on Query @argumentDefinitions(id: { type: "ID!" }) {
        ... {
          node(id: $id) {
            bar
          }
        }
      }
  `)

    expect(errors.length).toBe(0)
  })

  it("Respects default values allowing nullable types in non nullable locations", () => {
    const errors = validateDocuments(`
      query MyQuery ($ids: [ID!]) {
        ... MyFragment @arguments(ids: $ids)
      }
      fragment MyFragment on Query @argumentDefinitions(ids: { type: "[ID!]!", defaultValue: [] }) {
        ... {
          nodes(ids: $ids) {
            bar
          }
        }
      }
  `)

    expect(errors.length).toBe(0)
  })

  it("Respects default values in operation definition allowing nullable types in non nullable locations", () => {
    const errors = validateDocuments(`
      query MyQueryTest ($ids: [ID!] = []) {
        ... MyFragment @arguments(ids: $ids)
      }
      fragment MyFragment on Query @argumentDefinitions(ids: { type: "[ID!]!" }) {
        ... {
          nodes(ids: $ids) {
            bar
          }
        }
      }
  `)

    expect(errors.length).toBe(0)
  })

  it("Disallows invalid fragments", () => {
    const errors = validateDocuments(`
      fragment MyFragment on Query @argumentDefinitions(id: { type: "ID" }) {
        ... {
          node(id: $id) {
            bar
          }
        }
      }

      fragment MyFragment2 on Query @argumentDefinitions(ids: { type: "[ID]" }) {
        ... {
          nodes(ids: $ids) {
            bar
          }
        }
      }
  `)

    expect(errors.length).toBe(2)
    expect(errors).toContainEqual(
      expect.objectContaining({ message: 'Variable "$id" of type "ID" used in position expecting type "ID!".' })
    )
    expect(errors).toContainEqual(
      expect.objectContaining({ message: 'Variable "$ids" of type "[ID]" used in position expecting type "[ID!]".' })
    )
  })

  it("Validates @arguments usage", () => {
    const errors = validateDocuments(`
      query MyQuery($id: ID) {
        ... MyFragment @arguments(id: $id)
      }
      fragment MyFragment on Query @argumentDefinitions(id: { type: "ID!" }) {
        ... {
          node(id: $id) {
            bar
          }
        }
      }
  `)

    expect(errors.length).toBe(1)
    expect(errors).toContainEqual(
      expect.objectContaining({ message: 'Variable "$id" of type "ID" used in position expecting type "ID!".' })
    )
  })

  it("Validates variables used in fragments defined by operation", () => {
    const errors = validateDocuments(`
      query MyQuery($id: ID, $shouldInclude: Boolean!) {
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

    expect(errors.length).toBe(1)
    expect(errors).toContainEqual(
      expect.objectContaining({ message: 'Variable "$id" of type "ID" used in position expecting type "ID!".' })
    )
  })
})
