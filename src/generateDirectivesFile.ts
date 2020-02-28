import * as fs from "fs"
import * as os from "os"
import * as path from "path"
import { IRTransforms } from "relay-compiler"

export function directivesFilename() {
  const { version } = require("relay-compiler/package.json")
  return path.join(os.tmpdir(), `relay-compiler-directives-v${version}.graphql`)
}

export function generateDirectivesFile() {
  const tempfile = directivesFilename()
  const extensions = [
    ...IRTransforms.schemaExtensions,
    "directive @arguments on FRAGMENT_SPREAD",
    "directive @argumentDefinitions on FRAGMENT_DEFINITION",
  ]
  fs.writeFileSync(tempfile, extensions.join("\n"))
  return tempfile
}
