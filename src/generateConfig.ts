import * as path from "path"

import { ApolloConfigFormat } from "apollo-language-server/lib/config"
import { ValidationRule } from "graphql"
import { getLanguagePlugin } from "relay-compiler/lib/RelayCompilerMain"
import { generateDirectivesFile } from "./generateDirectivesFile"
import { RelayKnownArgumentNames } from "./RelayKnownArgumentNames"
import { RelayKnownVariableNames } from "./RelayKnownVariableNames"
import { RelayVariablesInAllowedPosition } from "./RelayVariablesInAllowedPosition"
import { RelayArgumentsOfCorrectType } from "./RelayArgumentsOfCorrectType"
import { defaultValidationRules } from "apollo-language-server/lib/errors/validation"

import * as _RelayConfig from "relay-config"
let RelayConfig: typeof _RelayConfig | null = null
try {
  RelayConfig = require("relay-config")
} catch (_) {}

const DEFAULTS = {
  localSchemaFile: "./data/schema.graphql",
  src: "./src",
}

const ValidationRulesToExcludeForRelay = ["KnownArgumentNames", "NoUndefinedVariables", "VariablesInAllowedPosition"]

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
  const includesGlobPattern = (inputExtensions: string[]) => `**/*.{graphql,${inputExtensions.join(",")}}`

  const config: ApolloConfigFormat = {
    client: {
      service: {
        name: "local",
        localSchemaFile: relayConfig ? relayConfig.schema : DEFAULTS.localSchemaFile,
      },
      validationRules: [
        RelayKnownArgumentNames,
        RelayKnownVariableNames,
        RelayVariablesInAllowedPosition,
        RelayArgumentsOfCorrectType,
        ...defaultValidationRules.filter(
          (rule: ValidationRule) => !ValidationRulesToExcludeForRelay.includes(rule.name)
        ),
      ],
      includes: [
        directivesFile,
        path.join((relayConfig || DEFAULTS).src, includesGlobPattern(languagePlugin.inputExtensions)),
      ],
      excludes: relayConfig ? relayConfig.exclude : [],
      tagName: "graphql",
    },
  }

  return { config, directivesFile, includesGlobPattern }
}
