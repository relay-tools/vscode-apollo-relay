import { readFileSync } from "fs"
import { buildSchema, parse, validate } from "graphql"
import { generateDirectivesFile } from "../src/generateDirectivesFile"
import { RelayKnownVariableNames } from "../src/RelayKnownVariableNames"

const schema = buildSchema(`
${readFileSync(generateDirectivesFile(), "utf8")}

type Foo {
  bar: String
  baz: Boolean
}

type Query {
  foo: Foo
  node(id: ID!): Foo
  conditionalNode(id: ID!, condition: Boolean!): Foo
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

  it("Does not Validate fragments before they are used in operations", () => {
    const errors = validateDocuments(`
      fragment MyFragment on Query @argumentDefinitions(id: { type: "ID!"}) {
        ... {
          node(id: $id) @include(if: $shouldInclude) {
            bar
          }
        }
      }
    `)

    expect(errors.length).toBe(0)
  })

  it("Validates fragments when used in at least one operation", () => {
    const errors = validateDocuments(`
      query MyQuery {
        ... MyFragment @arguments(id: "ID")
      }
      fragment MyFragment on Query @argumentDefinitions(id: { type: "ID!"}) {
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
        message: 'Variable "$shouldInclude" is used by fragment "MyFragment", but not defined by operation "MyQuery".',
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
        message: 'Variable "$shouldInclude" is used by fragment "MyFragment", but not defined by operation "MyQuery".',
      })
    )
  })

  it("Allows operation defined variables across multiple queries", () => {
    const errors = validateDocuments(`
      query MyQuery ($id: ID!, $shouldInclude: Boolean!) {
        ... MyFragment
      }
      query MyOtherQuery ($id: ID!, $shouldInclude: Boolean) {
        ... MyFragment
      }
      fragment MyFragment on Query {
        ... {
          conditionalNode(id: $id, condition: $shouldInclude){
            bar
          }
        }
      }
    `)

    expect(errors).toHaveLength(0)
  })

  it("Recognises which operations are not defining a variable defined in some operation", () => {
    const errors = validateDocuments(`
      query MyQuery ($id: ID!, $shouldInclude: Boolean!) {
        ... MyFragment
      }
      query MyOtherQuery ($id: ID!) {
        ... MyFragment
      }
      fragment MyFragment on Query {
        ... {
          conditionalNode(id: $id, condition: $shouldInclude){
            bar
          }
        }
      }
    `)

    expect(errors).toHaveLength(1)
    expect(errors).toContainEqual(
      expect.objectContaining({
        message:
          'Variable "$shouldInclude" is used by fragment "MyFragment", but not defined by operation "MyOtherQuery".',
      })
    )
  })
})
