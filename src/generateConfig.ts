import * as path from "path"

import { ApolloConfigFormat } from "apollo-language-server/lib/config"
import { ValidationRule } from "graphql"
import { getLanguagePlugin } from "relay-compiler/lib/RelayCompilerMain"
import { defaultValidationRules, RelayConfig } from "./dependencies"
import { generateDirectivesFile } from "./generateDirectivesFile"
import { RelayKnownArgumentNames } from "./RelayKnownArgumentNames"

// TODO: Document these in README as things to lookout for.
const DEFAULTS = {
  localSchemaFile: "./data/schema.graphql",
  src: "./src",
}

const ValidationRulesToExcludeForRelay = ["KnownArgumentNames", "NoUndefinedVariables"]

function loadRelayConfig() {
  if (!RelayConfig) {
    console.log("User has not installed relay-config, so needs manual configuration.")
    return null
  } else {
    const config = RelayConfig.loadConfig()
    if (!config) {
      console.log("Unable to load user's config from relay-config, so needs manual configuration.")
    }
    return config || null
  }
}

export function generateConfig() {
  const relayConfig = loadRelayConfig()

  const languagePlugin = getLanguagePlugin((relayConfig && relayConfig.language) || "javascript")
  const directivesFile = generateDirectivesFile()
  const includesGlobPattern = `**/*.{graphql,${languagePlugin.inputExtensions.join(",")}}`

  const config: ApolloConfigFormat = {
    client: {
      service: {
        name: "local",
        localSchemaFile: relayConfig ? relayConfig.schema : DEFAULTS.localSchemaFile,
      },
      validationRules: [
        RelayKnownArgumentNames,
        ...defaultValidationRules.filter(
          (rule: ValidationRule) => !ValidationRulesToExcludeForRelay.includes(rule.name)
        ),
      ],
      includes: [directivesFile, path.join((relayConfig || DEFAULTS).src, includesGlobPattern)],
      excludes: relayConfig ? relayConfig.exclude : [],
      tagName: "graphql",
    },
  }

  return { config, directivesFile, includesGlobPattern }
}
