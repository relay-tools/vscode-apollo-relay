import { readFileSync } from "fs"
import { buildSchema, parse, validate } from "graphql"
import { generateDirectivesFile } from "../src/generateDirectivesFile"
import { RelayArgumentsOfCorrectType } from "../src/RelayArgumentsOfCorrectType"

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
  return validate(schema, parse(source), [RelayArgumentsOfCorrectType])
}

describe(RelayArgumentsOfCorrectType, () => {
  it("Disallows bad literal arguments", () => {
    const errors = validateDocuments(`
      fragment MyFragment on Query @argumentDefinitions(intVal: { type: "Int" }, reqStrVal: { type: "String!" }) {
		  __typename
	  }

	  query MyQuery {
		  ... MyFragment @arguments(intVal: "Test", reqStrVal: null)
	  }
    `)

    expect(errors).toHaveLength(2)
    expect(errors).toContainEqual(
      expect.objectContaining({
        message: 'Argument "intVal" for fragment "MyFragment" is expected to be of type "Int".',
      })
    )
    expect(errors).toContainEqual(
      expect.objectContaining({
        message: 'Argument "reqStrVal" for fragment "MyFragment" is expected to be of type "String!".',
      })
    )
  })

  it("Allows good literal arguments", () => {
    const errors = validateDocuments(`
      fragment MyFragment on Query @argumentDefinitions(intVal: { type: "Int" }, reqStrVal: { type: "String!" }) {
		  __typename
	  }

	  query MyQuery {
		  ... MyFragment @arguments(intVal: null, reqStrVal: "string")
	  }
    `)

    expect(errors).toHaveLength(0)
  })

  // We should probably have a different validation rule for this. As far as I know this sort of stuff is not allowed within relay
  it("Ignores nested variable arguments", () => {
    const errors = validateDocuments(`
      fragment MyFragment on Query @argumentDefinitions(intVal: { type: "[Int!]" }, reqStrVal: { type: "String!" }) {
		  __typename
	  }

	  query MyQuery {
		  ... MyFragment @arguments(intVal: [$variable], reqStrVal: "string")
	  }
    `)

    expect(errors).toHaveLength(0)
  })

  it("Disallows bad literal arguments for lists", () => {
    const errors = validateDocuments(`
      fragment MyFragment on Query @argumentDefinitions(intVal: { type: "[Int]" }, reqStrVal: { type: "[String!]!" }) {
		  __typename
	  }

	  query MyQuery {
		  ... MyFragment @arguments(intVal: ["Test"], reqStrVal: [null])
	  }
    `)

    expect(errors).toHaveLength(2)
    expect(errors).toContainEqual(
      expect.objectContaining({
        message: 'Argument "intVal" for fragment "MyFragment" is expected to be of type "[Int]".',
      })
    )
    expect(errors).toContainEqual(
      expect.objectContaining({
        message: 'Argument "reqStrVal" for fragment "MyFragment" is expected to be of type "[String!]!".',
      })
    )
  })

  it("Allows good literal arguments for lists", () => {
    const errors = validateDocuments(`
      fragment MyFragment on Query @argumentDefinitions(intVal: { type: "[Int]" }, reqStrVal: { type: "[String!]!" }) {
		  __typename
	  }

	  query MyQuery {
		  ... MyFragment @arguments(intVal: [10], reqStrVal: ["Test"])
	  }
    `)

    expect(errors).toHaveLength(0)
  })
})
