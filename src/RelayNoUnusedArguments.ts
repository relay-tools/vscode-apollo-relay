import { ValidationRule } from "graphql"
import { getFragmentArgumentDefinitions } from "./argumentDefinitions"
import { GraphQLError, visit } from "./dependencies"

export function unusedArgumentMessage(varName: string, framgnetName: string): string {
  return `Argument "${varName}" in fragment "${framgnetName}" is never used.`
}

// tslint:disable-next-line: no-shadowed-variable
export const RelayNoUnusedArguments: ValidationRule = function RelayNoUnusedArguments(context) {
  return {
    FragmentDefinition(fragmentDef) {
      const argumentDefinitions = getFragmentArgumentDefinitions(context, fragmentDef)
      const usages: { [name: string]: number } = {}

      visit(fragmentDef.selectionSet, {
        Variable(variableNode) {
          usages[variableNode.name.value] = 1
        },
      })

      Object.keys(argumentDefinitions).forEach((arg) => {
        const definition = argumentDefinitions[arg]

        if (!usages[arg]) {
          context.reportError(new GraphQLError(unusedArgumentMessage(arg, fragmentDef.name.value), definition.node))
        }
      })
    },
  }
}
