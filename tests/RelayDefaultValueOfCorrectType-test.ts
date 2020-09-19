import { readFileSync } from "fs"
import { buildSchema, parse, validate } from "graphql"
import { generateDirectivesFile } from "../src/generateDirectivesFile"
import { RelayDefaultValueOfCorrectType } from "../src/RelayDefaultValueOfCorrectType"

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
  conditionalNode(id: ID!, condition: Boolean!): Foo
}
`)

function validateDocuments(source: string) {
  return validate(schema, parse(source), [RelayDefaultValueOfCorrectType])
}

describe(RelayDefaultValueOfCorrectType, () => {
  it("Disallows null as default value", () => {
    const errors = validateDocuments(`
      fragment MyFragment on Query @argumentDefinitions(intVal: { type: "Int", defaultValue: null }) {
		  __typename
	  }
    `)

    // My relay compiler hates when/if I do this.
    expect(errors).toHaveLength(1)
    expect(errors).toContainEqual(
      expect.objectContaining({
        message:
          'defaultValue for argument "intVal" on fragment "MyFragment" cannot be null. Instead, omit defaultValue.',
      })
    )
  })

  it("Disallows bad default values", () => {
    const errors = validateDocuments(`
      fragment MyFragment on Query @argumentDefinitions(intVal: { type: "Int", defaultValue: "String" }, reqStrVal: { type: "String!", defaultValue: 5 }) {
		  __typename
	  }

    `)

    expect(errors).toHaveLength(2)
    expect(errors).toContainEqual(
      expect.objectContaining({
        message: 'defaultValue for argument "intVal" on fragment "MyFragment" is expected to be of type "Int!".',
      })
    )
    expect(errors).toContainEqual(
      expect.objectContaining({
        message: 'defaultValue for argument "reqStrVal" on fragment "MyFragment" is expected to be of type "String!".',
      })
    )
  })

  it("Allows good default values", () => {
    const errors = validateDocuments(`
      fragment MyFragment on Query @argumentDefinitions(intVal: { type: "Int", defaultValue: 10 }, reqStrVal: { type: "String!", defaultValue: "Hello" }) {
		  __typename
	  }

    `)

    expect(errors).toHaveLength(0)
  })

  it("Disallows bad list values", () => {
    const errors = validateDocuments(`
      fragment MyFragment on Query @argumentDefinitions(intVal: { type: "[Int]", defaultValue: ["String"] }, reqStrVal: { type: "[String!]!", defaultValue: [5] }) {
		  __typename
	  }

    `)

    expect(errors).toHaveLength(2)
    expect(errors).toContainEqual(
      expect.objectContaining({
        message: 'defaultValue for argument "intVal" on fragment "MyFragment" is expected to be of type "[Int]!".',
      })
    )
    expect(errors).toContainEqual(
      expect.objectContaining({
        message:
          'defaultValue for argument "reqStrVal" on fragment "MyFragment" is expected to be of type "[String!]!".',
      })
    )
  })

  it("Allows good literal arguments for lists", () => {
    const errors = validateDocuments(`
      fragment MyFragment on Query @argumentDefinitions(intVal: { type: "[Int]", defaultValue: [10] }, reqStrVal: { type: "[String!]!", defaultValue: ["Test"] }) {
		  __typename
	  }
    `)

    expect(errors).toHaveLength(0)
  })
})
