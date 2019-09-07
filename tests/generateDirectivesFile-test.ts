import { directivesFilename, generateDirectivesFile } from "../src/generateDirectivesFile"
import { unlinkSync, existsSync, readFileSync } from "fs"
import { parse, visit } from "graphql"

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
        "argumentDefinitions",
        "arguments",
        "connection",
        "match",
        "module",
        "refetchable",
        "relay",
        "relay_test_operation",
        "stream_connection",
      ]
    `)
  })
})
