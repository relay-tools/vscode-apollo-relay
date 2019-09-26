import * as path from "path"
import { ApolloConfigFormat } from "apollo-language-server/lib/config"
import { ValidationRule } from "graphql"
import { defaultValidationRules, RelayConfig, RelayCompilerMain } from "./dependencies"
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
  const compatOnlyRules = compat ? [RelayCompatRequiredPageInfoFields] : []

  const includesGlobPattern = (inputExtensions: string[]) => `**/*.{graphql,${inputExtensions.join(",")}}`

  const configInclude = relayConfig ? relayConfig.include : undefined
  const src = (relayConfig || DEFAULTS).src
  const includes = configInclude
    ? configInclude.map(i => path.join(src, i))
    : [path.join((relayConfig || DEFAULTS).src, includesGlobPattern(extensions))]

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
      includes: [directivesFile, ...includes],
      excludes: relayConfig && relayConfig.exclude ? relayConfig.exclude.map(ex => path.join(src, ex)) : [],
      tagName: "graphql",
    },
  }

  return { config, directivesFile, includesGlobPattern }
}
