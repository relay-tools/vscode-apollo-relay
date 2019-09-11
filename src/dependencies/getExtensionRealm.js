let mod = module
if (typeof jest === "undefined") {
  while (mod && !mod.id.includes("apollographql.vscode-apollo")) {
    mod = mod.parent!
  }
  if (mod === null) {
    throw new Error("Unable to find vscode-apollo's node_modules")
  }
}

module.exports = mod