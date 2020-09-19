import { readFileSync } from "fs"
import { buildSchema, parse, validate } from "graphql"
import { generateDirectivesFile } from "../src/generateDirectivesFile"
import { RelayCompatMissingConnectionDirective } from "../src/RelayCompatMissingConnectionDirective"

const schema = buildSchema(`
${readFileSync(generateDirectivesFile(), "utf8")}

type Foo {
  bar: String
  baz: Boolean
}

type FooEdge {
    node: Foo
    cursor: String!
}

type FooConnection {
    edges: [FooEdge!]!
    pageInfo: PageInfo!
}

type PageInfo {
    hasPreviousPage: Boolean!
    hasNextPage: Boolean!
    endCursor: String
    startCursor: String
}

type Query {
	fooConnection(first: Int last: Int after: String before: String): FooConnection
	foo: Foo
}
`)

function validateDocuments(source: string) {
  return validate(schema, parse(source), [RelayCompatMissingConnectionDirective])
}

describe(RelayCompatMissingConnectionDirective, () => {
  it("Should allow connections without @connection directive when no before or after is used", () => {
    const errors = validateDocuments(`
      query MyQuery {
        fooConnection {
          __typename
        }
      }
    `)
    expect(errors).toHaveLength(0)
  })
  it("Should disallow connections without @connection directive when before is used", () => {
    const errors = validateDocuments(`
      query MyQuery {
        fooConnection(before: $before) {
          __typename
        }
      }
    `)
    expect(errors).toHaveLength(1)
    expect(errors).toContainEqual(
      expect.objectContaining({
        message: "Missing @connection directive",
      })
    )
  })
  it("Should disallow connections without @connection directive when after is used", () => {
    const errors = validateDocuments(`
      query MyQuery {
        fooConnection(after: $after) {
          __typename
        }
      }
    `)
    expect(errors).toHaveLength(1)
    expect(errors).toContainEqual(
      expect.objectContaining({
        message: "Missing @connection directive",
      })
    )
  })
  it("Should allow connections with @connection directive", () => {
    const errors = validateDocuments(`
      query MyQuery {
        fooConnection(before: $before) @connection(key: "MyQuery_fooConnection") {
          __typename
        }
      }
    `)
    expect(errors).toHaveLength(0)
  })

  it("Should allow non connectionfields without @connection directive", () => {
    const errors = validateDocuments(`
      query MyQuery {
        foo
      }
    `)
    expect(errors).toHaveLength(0)
  })
})
