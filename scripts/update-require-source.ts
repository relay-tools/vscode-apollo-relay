/**
 * Updates the source of an require statement.
 *
 * ```bash
 * $ jscodeshift \
 *   --transform=path/to/codemods/src/update-require-source.ts \
 *   --extensions=ts src/schema/artwork/index.ts \
 *   --rename-from='schema\/object_identification'
 *   --rename-to=src/schemaV2/object_identification.ts
 * ```
 */

import { Transform, CallExpression } from "jscodeshift"
import path from "path"

interface Options {
  /**
   * A regexp that matches the import source to update.
   */
  "rename-from": string

  /**
   * The new source to use for the import declaration.
   */
  "rename-to": string

  /**
   * When true, the new `to` value is made relative to the input file's location.
   * This is the default.
   *
   * When false, the `to` path will be used as-is, which is useful if you have
   * module mappings in place.
   */
  "rename-relative"?: boolean
}

const transform: Transform = (file, api, options) => {
  const { "rename-from": renameFrom, "rename-to": renameTo, "rename-relative": renameRelative } = {
    "rename-relative": true,
    ...options,
  } as Options

  if (!renameFrom || !renameTo) {
    throw new Error("--rename-from and --rename-to are required options")
  }

  const renameFromRegExp = new RegExp(renameFrom)
  const normalizedRenameTo = path.join(
    path.dirname(renameRelative ? path.resolve(renameTo) : renameTo),
    path.basename(renameTo, path.extname(renameTo))
  )
  const fileDirname = path.dirname(file.path)

  const j = api.jscodeshift
  return j(file.source)
    .find(j.CallExpression, (node: CallExpression) => {
      if (j.Identifier.check(node.callee) && node.callee.name === "require") {
        const arg = node.arguments[0]
        return j.StringLiteral.check(arg) && renameFromRegExp.test(arg.value)
      }
      return false
    })
    .replaceWith(({ node }) => {
      return j.callExpression(node.callee, [
        j.stringLiteral(renameRelative ? makeRelative(fileDirname, normalizedRenameTo) : normalizedRenameTo),
      ])
    })
    .toSource()
}

function makeRelative(from: string, to: string) {
  const result = path.relative(from, to)
  return result[0] !== "." ? `./${result}` : result
}

export const parser = "ts"
export default transform
