import * as path from "path"

import { ApolloConfigFormat } from "apollo-language-server/lib/config"
import { ValidationRule } from "graphql"
import { defaultValidationRules, RelayCompilerMain, RelayConfig } from "./dependencies"
import { generateDirectivesFile } from "./generateDirectivesFile"
import { RelayArgumentsOfCorrectType } from "./RelayArgumentsOfCorrectType"
import { RelayCompatMissingConnectionDirective } from "./RelayCompatMissingConnectionDirective"
import { RelayCompatRequiredPageInfoFields } from "./RelayCompatRequiredPageInfoFields"
import { RelayDefaultValueOfCorrectType } from "./RelayDefaultValueOfCorrectType"
import { RelayKnownArgumentNames } from "./RelayKnownArgumentNames"
import { RelayKnownVariableNames } from "./RelayKnownVariableNames"
import { RelayNoUnusedArguments } from "./RelayNoUnusedArguments"
import { RelayVariablesInAllowedPosition } from "./RelayVariablesInAllowedPosition"

const DEFAULTS = {
  localSchemaFile: "./data/schema.graphql",
  src: "./src",
}

const ValidationRulesToExcludeForRelay = [
  "KnownArgumentNames",
  "NoUndefinedVariables",
  "VariablesInAllowedPosition",
  "NoMissingClientDirectives",
]

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

function getInputExtensions(relayConfig: ReturnType<typeof loadRelayConfig>) {
  if (!RelayCompilerMain) {
    console.log("Unable to load relay-compiler, so `includes` may need manual configuration.")
  }
  const languagePlugin =
    RelayCompilerMain && RelayCompilerMain.getLanguagePlugin((relayConfig && relayConfig.language) || "javascript")
  return languagePlugin ? languagePlugin.inputExtensions : ["js", "jsx"]
}

export function generateConfig(compat: boolean = false) {
  const relayConfig = loadRelayConfig()
  const extensions = getInputExtensions(relayConfig)
  const directivesFile = generateDirectivesFile()
  const compatOnlyRules = compat ? [RelayCompatRequiredPageInfoFields, RelayCompatMissingConnectionDirective] : []

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
        RelayDefaultValueOfCorrectType,
        RelayNoUnusedArguments,
        ...compatOnlyRules,
        ...defaultValidationRules.filter(
          (rule: ValidationRule) => !ValidationRulesToExcludeForRelay.some((name) => rule.name.startsWith(name))
        ),
      ],
      includes: [directivesFile, path.join((relayConfig || DEFAULTS).src, includesGlobPattern(extensions))],
      excludes: relayConfig ? relayConfig.exclude : [],
      tagName: "graphql",
    },
  }

  return { config, directivesFile, includesGlobPattern }
}
