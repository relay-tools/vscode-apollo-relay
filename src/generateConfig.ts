import * as path from "path"

import { ApolloConfigFormat } from "apollo-language-server/lib/config"
import { ValidationRule } from "graphql"
import { getLanguagePlugin } from "relay-compiler/lib/RelayCompilerMain"
import { defaultValidationRules, RelayConfig } from "./dependencies"
import { generateDirectivesFile } from "./generateDirectivesFile"
import { RelayKnownArgumentNames } from "./RelayKnownArgumentNames"
import { RelayKnownVariableNames } from "./RelayKnownVariableNames"
import { RelayVariablesInAllowedPosition } from "./RelayVariablesInAllowedPosition"
import { RelayArgumentsOfCorrectType } from "./RelayArgumentsOfCorrectType"
import { RelayDefaultValueOfCorrectType } from "./RelayDefaultValueOfCorrectType"
import { RelayCompatRequiredPageInfoFields } from "./RelayCompatRequiredPageInfoFields"

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

export function generateConfig(compat: boolean = false) {
  const relayConfig = loadRelayConfig()

  const languagePlugin = getLanguagePlugin((relayConfig && relayConfig.language) || "javascript")
  const directivesFile = generateDirectivesFile()
  const includesGlobPattern = (inputExtensions: string[]) => `**/*.{graphql,${inputExtensions.join(",")}}`

  const compatOnlyRules = compat ? [RelayCompatRequiredPageInfoFields] : []

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
        RelayDefaultValueOfCorrectType,
        ...compatOnlyRules,
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
