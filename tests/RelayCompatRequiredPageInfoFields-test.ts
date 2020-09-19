import { readFileSync } from "fs"
import { buildSchema, DocumentNode, parse, validate } from "graphql"
import { generateDirectivesFile } from "../src/generateDirectivesFile"
import {
  connectionSelectionSetPaginationInfo,
  RelayCompatRequiredPageInfoFields,
} from "../src/RelayCompatRequiredPageInfoFields"

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
  return validate(schema, parse(source), [RelayCompatRequiredPageInfoFields])
}

describe(RelayCompatRequiredPageInfoFields, () => {
  describe(connectionSelectionSetPaginationInfo, () => {
    const pageInfoStartCursor = parse(`fragment PageInfoStartCursor on PageInfo {
      startCursor
    }`)
    const pageInfoEndCursor = parse(`fragment PageInfoEndCursor on PageInfo {
      endCursor
    }`)
    const pageInfoHasNextPage = parse(`fragment PageInfoHasNextPage on PageInfo {
      hasNextPage
    }`)
    const pageInfoHasPreviousPage = parse(`fragment PageInfoHasPreviousPage on PageInfo {
      hasPreviousPage
    }`)

    const connectionStartCursor = parse(`fragment ConnectionStartCursor on FooConnection {
      pageInfo {
        startCursor
      }
    }`)
    const connectionEndCursor = parse(`fragment ConnectionEndCursor on FooConnection {
      pageInfo {
        endCursor
      }
    }`)
    const connectionHasNextPage = parse(`fragment ConnectionHasNextPage on FooConnection {
      pageInfo {
        hasNextPage
      }
    }`)
    const connectionHasPreviousPage = parse(`fragment ConnectionHasPreviousPage on FooConnection {
      pageInfo {
        hasPreviousPage
      }
    }`)

    const fragmentMap: { [key: string]: DocumentNode } = {
      PageInfoStartCursor: pageInfoStartCursor,
      PageInfoEndCursor: pageInfoEndCursor,
      PageInfoHasNextPage: pageInfoHasNextPage,
      PageInfoHasPreviousPage: pageInfoHasPreviousPage,
      ConnectionStartCursor: connectionStartCursor,
      ConnectionEndCursor: connectionEndCursor,
      ConnectionHasNextPage: connectionHasNextPage,
      ConnectionHasPreviousPage: connectionHasPreviousPage,
    }

    const getFragment = (name: string) => {
      const doc = fragmentMap[name]
      if (doc == null) {
        return
      }
      const fragmentDef = doc.definitions[0]
      if (fragmentDef.kind === "FragmentDefinition") {
        return fragmentDef
      }
      throw new Error("Unexpected kind: " + fragmentDef.kind)
    }

    const getSelectionSetFromFragment = (source: string) => {
      const doc = parse(source)

      const def = doc.definitions[0]
      if (def.kind !== "FragmentDefinition") {
        throw new Error("Unexpected kind: " + def.kind)
      }

      return def.selectionSet
    }

    it("Finds no fields on selection with no fields", () => {
      const fragment = getSelectionSetFromFragment(`fragment TestFragment on FooConnection {
        __typename
      }`)

      expect(connectionSelectionSetPaginationInfo(getFragment, fragment)).toEqual({
        hasNextPage: false,
        hasPreviousPage: false,
        endCursor: false,
        startCursor: false,
      })
    })

    describe("Direct selections", () => {
      it("Finds startCursor on selection with startCursor", () => {
        const fragment = getSelectionSetFromFragment(`fragment TestFragment on FooConnection {
          pageInfo {
            startCursor
          }
        }`)

        expect(connectionSelectionSetPaginationInfo(getFragment, fragment)).toEqual({
          hasNextPage: false,
          hasPreviousPage: false,
          endCursor: false,
          startCursor: true,
        })
      })
      it("Finds endCursor on selection with endCursor", () => {
        const fragment = getSelectionSetFromFragment(`fragment TestFragment on FooConnection {
          pageInfo {
            endCursor
          }
        }`)

        expect(connectionSelectionSetPaginationInfo(getFragment, fragment)).toEqual({
          hasNextPage: false,
          hasPreviousPage: false,
          endCursor: true,
          startCursor: false,
        })
      })
      it("Finds hasNextPage on selection with hasNextPage", () => {
        const fragment = getSelectionSetFromFragment(`fragment TestFragment on FooConnection {
          pageInfo {
            hasNextPage
          }
        }`)

        expect(connectionSelectionSetPaginationInfo(getFragment, fragment)).toEqual({
          hasNextPage: true,
          hasPreviousPage: false,
          endCursor: false,
          startCursor: false,
        })
      })
      it("Finds hasPreviousPage on selection with hasPreviousPage", () => {
        const fragment = getSelectionSetFromFragment(`fragment TestFragment on FooConnection {
          pageInfo {
            hasPreviousPage
          }
        }`)

        expect(connectionSelectionSetPaginationInfo(getFragment, fragment)).toEqual({
          hasNextPage: false,
          hasPreviousPage: true,
          endCursor: false,
          startCursor: false,
        })
      })
    })
    describe("Fragments spread on connection", () => {
      it("Finds startCursor on selection with startCursor", () => {
        const fragment = getSelectionSetFromFragment(`fragment TestFragment on FooConnection {
          ... ConnectionStartCursor
        }`)

        expect(connectionSelectionSetPaginationInfo(getFragment, fragment)).toEqual({
          hasNextPage: false,
          hasPreviousPage: false,
          endCursor: false,
          startCursor: true,
        })
      })
      it("Finds endCursor on selection with endCursor", () => {
        const fragment = getSelectionSetFromFragment(`fragment TestFragment on FooConnection {
          ... ConnectionEndCursor
        }`)

        expect(connectionSelectionSetPaginationInfo(getFragment, fragment)).toEqual({
          hasNextPage: false,
          hasPreviousPage: false,
          endCursor: true,
          startCursor: false,
        })
      })
      it("Finds hasNextPage on selection with hasNextPage", () => {
        const fragment = getSelectionSetFromFragment(`fragment TestFragment on FooConnection {
          ... ConnectionHasNextPage
        }`)

        expect(connectionSelectionSetPaginationInfo(getFragment, fragment)).toEqual({
          hasNextPage: true,
          hasPreviousPage: false,
          endCursor: false,
          startCursor: false,
        })
      })
      it("Finds hasPreviousPage on selection with hasPreviousPage", () => {
        const fragment = getSelectionSetFromFragment(`fragment TestFragment on FooConnection {
          ... ConnectionHasPreviousPage
        }`)

        expect(connectionSelectionSetPaginationInfo(getFragment, fragment)).toEqual({
          hasNextPage: false,
          hasPreviousPage: true,
          endCursor: false,
          startCursor: false,
        })
      })
    })
    describe("Fragments spread on pageInfo", () => {
      it("Finds startCursor on selection with startCursor", () => {
        const fragment = getSelectionSetFromFragment(`fragment TestFragment on FooConnection {
          pageInfo {
            ... PageInfoStartCursor
          }
        }`)

        expect(connectionSelectionSetPaginationInfo(getFragment, fragment)).toEqual({
          hasNextPage: false,
          hasPreviousPage: false,
          endCursor: false,
          startCursor: true,
        })
      })
      it("Finds endCursor on selection with endCursor", () => {
        const fragment = getSelectionSetFromFragment(`fragment TestFragment on FooConnection {
          pageInfo {
            ... PageInfoEndCursor
          }
        }`)

        expect(connectionSelectionSetPaginationInfo(getFragment, fragment)).toEqual({
          hasNextPage: false,
          hasPreviousPage: false,
          endCursor: true,
          startCursor: false,
        })
      })
      it("Finds hasNextPage on selection with hasNextPage", () => {
        const fragment = getSelectionSetFromFragment(`fragment TestFragment on FooConnection {
          pageInfo {
            ... PageInfoHasNextPage
          }
        }`)

        expect(connectionSelectionSetPaginationInfo(getFragment, fragment)).toEqual({
          hasNextPage: true,
          hasPreviousPage: false,
          endCursor: false,
          startCursor: false,
        })
      })
      it("Finds hasPreviousPage on selection with hasPreviousPage", () => {
        const fragment = getSelectionSetFromFragment(`fragment TestFragment on FooConnection {
          pageInfo {
            ... PageInfoHasPreviousPage
          }
        }`)

        expect(connectionSelectionSetPaginationInfo(getFragment, fragment)).toEqual({
          hasNextPage: false,
          hasPreviousPage: true,
          endCursor: false,
          startCursor: false,
        })
      })
    })
  })
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

    expect(errors).toHaveLength(2)
    expect(errors).toContainEqual(
      expect.objectContaining({ message: 'Missing pageInfo.hasNextPage field on connection "MyQuery_fooConnection".' })
    )
    expect(errors).toContainEqual(
      expect.objectContaining({ message: 'Missing pageInfo.endCursor field on connection "MyQuery_fooConnection".' })
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

    expect(errors).toHaveLength(2)
    expect(errors).toContainEqual(
      expect.objectContaining({ message: 'Missing pageInfo.hasNextPage field on connection "MyQuery_fooConnection".' })
    )
    expect(errors).toContainEqual(
      expect.objectContaining({ message: 'Missing pageInfo.endCursor field on connection "MyQuery_fooConnection".' })
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

    expect(errors).toHaveLength(2)
    expect(errors).toContainEqual(
      expect.objectContaining({
        message: 'Missing pageInfo.hasPreviousPage field on connection "MyQuery_fooConnection".',
      })
    )
    expect(errors).toContainEqual(
      expect.objectContaining({ message: 'Missing pageInfo.startCursor field on connection "MyQuery_fooConnection".' })
    )
  })
})
