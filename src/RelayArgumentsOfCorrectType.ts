import { ValidationRule } from "graphql"
import { getFragmentArgumentDefinitions } from "./argumentDefinitions"
import { GraphQLError, valueFromAST } from "./dependencies"
import { containsVariableNodes, findFragmentSpreadParent } from "./utils"

// tslint:disable-next-line: no-shadowed-variable
export const RelayArgumentsOfCorrectType: ValidationRule = function RelayArgumentsOfCorrectType(context) {
  return {
    Directive(directive, _key, _parent, _path, ancestors) {
      if (directive.name.value !== "arguments" || !directive.arguments) {
        return false
      }
      const fragmentSpread = findFragmentSpreadParent(ancestors)
      if (!fragmentSpread) {
        return false
      }
      const fragmentDefinition = context.getFragment(fragmentSpread.name.value)
      if (!fragmentDefinition) {
        return false
      }

      const typedArguments = getFragmentArgumentDefinitions(context, fragmentDefinition)

      directive.arguments.forEach((arg) => {
        const argDef = typedArguments[arg.name.value]
        if (!argDef || !argDef.schemaType) {
          return
        }

        const schemaType = argDef.schemaType

        if (containsVariableNodes(arg.value)) {
          return
        }

        const value = valueFromAST(arg.value, schemaType)

        if (value === undefined) {
          context.reportError(
            new GraphQLError(
              badValueMessage(fragmentDefinition.name.value, arg.name.value, schemaType.toString()),
              arg.value
            )
          )
        }
      })
    },
  }
}

function badValueMessage(fragmentName: string, argName: string, argType: string): string {
  return `Argument "${argName}" for fragment "${fragmentName}" is expected to be of type "${argType}".`
}
