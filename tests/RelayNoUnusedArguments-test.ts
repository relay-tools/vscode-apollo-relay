import { readFileSync } from "fs"
import { buildSchema, parse, validate } from "graphql"
import { generateDirectivesFile } from "../src/generateDirectivesFile"
import { RelayNoUnusedArguments } from "../src/RelayNoUnusedArguments"

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
  return validate(schema, parse(source), [RelayNoUnusedArguments])
}

describe(RelayNoUnusedArguments, () => {
  it("Allows fragments without arguments", () => {
    const errors = validateDocuments(
      `
      fragment MyFragment on Query {
        foo {
          bar
        }
      }`
    )
    expect(errors).toHaveLength(0)
  })

  it("Allows fragments that uses its arguments arguments", () => {
    const errors = validateDocuments(
      `
      fragment MyFragment on Query @argumentDefinitions(arg1: { type: "Boolean!" }) {
        foo @include(if: $arg1) {
          bar
        }
      }`
    )
    expect(errors).toHaveLength(0)
  })

  it("Disallows fragments that does not use its arguments arguments", () => {
    const errors = validateDocuments(
      `
      fragment MyFragment on Query @argumentDefinitions(arg1: { type: "Boolean!" }) {
        foo {
          bar
        }
      }`
    )
    expect(errors).toHaveLength(1)
    expect(errors).toContainEqual(
      expect.objectContaining({ message: 'Argument "arg1" in fragment "MyFragment" is never used.' })
    )
  })

  it("Disallows one of two arguments in a fragment that is not used", () => {
    const errors = validateDocuments(
      `
      fragment MyFragment on Query @argumentDefinitions(arg1: { type: "Boolean!" }, arg2: { type: "Boolean!" }) {
        foo @include(if: $arg2) {
          bar
        }
      }`
    )
    expect(errors).toHaveLength(1)
    expect(errors).toContainEqual(
      expect.objectContaining({ message: 'Argument "arg1" in fragment "MyFragment" is never used.' })
    )
  })
})
