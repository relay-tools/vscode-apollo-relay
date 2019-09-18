/**
 * Ok, so in this module we find an ancestral module that resides inside vscode extension, as we need to require
 * dependencies used by the vscode extension from the same dependency tree in order to not lead to conflicts where
 * e.g. graphql-js parts come from different modules (i.e. the user's node_modules).
 */

import * as _ApolloValidation from "apollo-language-server/lib/errors/validation"
import * as _GraphQL from "graphql"
import * as _RelayConfig from "relay-config"
import * as _RelayCompilerMain from "relay-compiler/bin/RelayCompilerMain"

let mod = module
if (typeof jest === "undefined") {
  while (mod && !mod.id.includes("apollographql.vscode-apollo")) {
    mod = mod.parent!
  }
  if (mod === null) {
    throw new Error("Unable to find vscode-apollo's node_modules")
  }
}

export const { defaultValidationRules } = mod.require(
  "apollo-language-server/lib/errors/validation"
) as typeof _ApolloValidation

export const {
  BREAK,
  GraphQLError,
  parseType,
  visit,
  isNonNullType,
  valueFromAST,
  isTypeSubTypeOf,
  getNullableType,
  typeFromAST,
  GraphQLNonNull,
  GraphQLObjectType,
  visitWithTypeInfo,
  isInputType,
  TypeInfo,
} = mod.require("graphql") as typeof _GraphQL

export const didYouMean = mod.require("graphql/jsutils/didYouMean").default as (suggestions: string[]) => string

export const suggestionList = mod.require("graphql/jsutils/suggestionList").default as (
  input: string,
  options: string[]
) => string[]

let relayConfigMod: typeof _RelayConfig | null = null
try {
  relayConfigMod = require("relay-config")
} catch (_) {}
export const RelayConfig = relayConfigMod

let relayCompilerMainMod: typeof _RelayCompilerMain | null = null
try {
  // relay-compiler v6
  relayCompilerMainMod = require("relay-compiler/bin/RelayCompilerMain")
} catch (_) {
  try {
    // relay-compiler v5
    relayCompilerMainMod = require("relay-compiler/lib/RelayCompilerMain")
  } catch (_) {}
}
export const RelayCompilerMain = relayCompilerMainMod
