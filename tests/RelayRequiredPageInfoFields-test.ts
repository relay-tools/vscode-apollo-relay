import { RelayRequiredPageInfoFields } from "../src/RelayRequiredPageInfoFields"
import { parse, buildSchema, validate } from "graphql"
import { generateDirectivesFile } from "../src/generateDirectivesFile"
import { readFileSync } from "fs"

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
}
`)

function validateDocuments(source: string) {
  return validate(schema, parse(source), [RelayRequiredPageInfoFields])
}

describe(RelayRequiredPageInfoFields, () => {
  it("Validates connection with no pageInfo specified", () => {
    const errors = validateDocuments(`
      query MyQuery($id: ID!) {
        fooConnection(first: 10, after: null) @connection(key: "MyQuery_fooConnection") {
          edges {
            cursor
          }
        }
      }
    `)

    expect(errors).toHaveLength(1)
    expect(errors).toContainEqual(
      expect.objectContaining({ message: 'Missing pageInfo selection on connection "fooConnection".' })
    )
  })
  it("Allows valid forward connection ", () => {
    const errors = validateDocuments(`
      query MyQuery($id: ID!) {
        fooConnection(first: 10, after: null) @connection(key: "MyQuery_fooConnection") {
          pageInfo {
            endCursor
            hasNextPage
          }
        }
      }
    `)

    expect(errors).toHaveLength(0)
  })
  it("Disallows forward with backward connection pageInfo connection ", () => {
    const errors = validateDocuments(`
      query MyQuery($id: ID!) {
        fooConnection(first: 10, after: null) @connection(key: "MyQuery_fooConnection") {
          pageInfo {
            startCursor
            hasPreviousPage
          }
        }
      }
    `)

    expect(errors).toHaveLength(1)
    expect(errors).toContainEqual(
      expect.objectContaining({
        message: 'Missing forward pageInfo fields "hasNextPage" and "endCursor" for connection "fooConnection".',
      })
    )
  })
  it("Allows valid backward connection ", () => {
    const errors = validateDocuments(`
      query MyQuery($id: ID!) {
        fooConnection(last: 10, before: null) @connection(key: "MyQuery_fooConnection") {
          pageInfo {
            startCursor
            hasPreviousPage
          }
        }
      }
    `)

    expect(errors).toHaveLength(0)
  })
  it("Disallows backward with forward connection pageInfo connection ", () => {
    const errors = validateDocuments(`
      query MyQuery($id: ID!) {
        fooConnection(last: 10, before: null) @connection(key: "MyQuery_fooConnection") {
          pageInfo {
            endCursor
            hasNextPage
          }
        }
      }
    `)

    expect(errors).toHaveLength(1)
    expect(errors).toContainEqual(
      expect.objectContaining({
        message: 'Missing backward pageInfo fields "hasPreviousPage" and "startCursor" for connection "fooConnection".',
      })
    )
  })
})
