import { existsSync, readFileSync, unlinkSync } from "fs"
import { parse, visit } from "graphql"
import { directivesFilename, generateDirectivesFile } from "../src/generateDirectivesFile"

describe(generateDirectivesFile, () => {
  const tempfile = directivesFilename()

  beforeAll(() => {
    if (existsSync(tempfile)) {
      unlinkSync(tempfile)
    }
  })

  it("generates the file", () => {
    expect(generateDirectivesFile()).toEqual(tempfile)
    expect(existsSync(tempfile)).toBe(true)
  })

  it("includes relay-compiler's directives", () => {
    const document = parse(readFileSync(tempfile, "utf8"))
    const directives: string[] = []
    visit(document, {
      DirectiveDefinition(node) {
        directives.push(node.name.value)
        return false
      },
    })
    expect(directives.sort()).toMatchInlineSnapshot(`
      Array [
        "DEPRECATED__relay_ignore_unused_variables_error",
        "appendEdge",
        "argumentDefinitions",
        "arguments",
        "connection",
        "deleteRecord",
        "inline",
        "match",
        "module",
        "prependEdge",
        "raw_response_type",
        "refetchable",
        "relay",
        "relay_test_operation",
        "stream_connection",
      ]
    `)
  })
})
