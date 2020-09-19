import { ValidationRule } from "graphql"
import { getFragmentArgumentDefinitions } from "./argumentDefinitions"
import { GraphQLError, valueFromAST } from "./dependencies"
import { containsVariableNodes, findFragmentDefinitionParent, makeNonNullable } from "./utils"

// tslint:disable-next-line: no-shadowed-variable
export const RelayDefaultValueOfCorrectType: ValidationRule = function RelayDefaultValueOfCorrectType(context) {
  return {
    Directive(directive, _key, _parent, _path, ancestors) {
      if (directive.name.value !== "argumentDefinitions" || !directive.arguments) {
        return false
      }
      const fragmentDefinition = findFragmentDefinitionParent(ancestors)
      if (!fragmentDefinition) {
        return false
      }

      const typedArguments = getFragmentArgumentDefinitions(context, fragmentDefinition)

      directive.arguments.forEach((argument) => {
        if (argument.value.kind !== "ObjectValue") {
          return
        }
        const defaultValueField = argument.value.fields.find((f) => f.name.value === "defaultValue")
        if (!defaultValueField) {
          return
        }
        const arg = typedArguments[argument.name.value]
        if (!arg) {
          return
        }
        if (arg.schemaType && arg.defaultValue && !containsVariableNodes(arg.defaultValue)) {
          if (arg.defaultValue.kind === "NullValue") {
            context.reportError(
              new GraphQLError(
                cannotSpecifyNullAsDefaultValue(fragmentDefinition.name.value, argument.name.value),
                defaultValueField.value
              )
            )
            return
          }
          const value = valueFromAST(arg.defaultValue, arg.schemaType)

          if (value === undefined) {
            context.reportError(
              new GraphQLError(
                badValueMessage(
                  fragmentDefinition.name.value,
                  argument.name.value,
                  makeNonNullable(arg.schemaType).toString()
                ),
                defaultValueField.value
              )
            )
          }
        }
      })
    },
  }
}

function badValueMessage(fragmentName: string, argName: string, argType: string): string {
  return `defaultValue for argument "${argName}" on fragment "${fragmentName}" is expected to be of type "${argType}".`
}

function cannotSpecifyNullAsDefaultValue(fragmentName: string, argName: string): string {
  return `defaultValue for argument "${argName}" on fragment "${fragmentName}" cannot be null. Instead, omit defaultValue.`
}
