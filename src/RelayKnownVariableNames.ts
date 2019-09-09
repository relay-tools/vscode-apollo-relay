import { ValidationRule } from "graphql"
import { GraphQLError } from "./dependencies"
import { getArgumentDefinitions } from "./argumentDefinitions"

export function undefinedVarMessage(varName: string, opName?: string): string {
  return opName
    ? `Variable "$${varName}" is not defined by operation "${opName}".`
    : `Variable "$${varName}" is not defined.`
}

export function undefinedVarMessageFragment(varName: string, fragmentName: string): string {
  return `Variable "$${varName}" is not defined by fragment "${fragmentName}".`
}

export const RelayKnownVariableNames: ValidationRule = function RelayKnownVariableNames(context) {
  let variableNameDefined = Object.create(null)
  return {
    OperationDefinition: {
      enter() {
        variableNameDefined = Object.create(null)
      },
      leave(operation) {
        const usages = context.getVariableUsages(operation)

        usages.forEach(({ node }) => {
          const varName = node.name.value
          if (variableNameDefined[varName] !== true) {
            context.reportError(
              new GraphQLError(undefinedVarMessage(varName, operation.name && operation.name.value), [node, operation])
            )
          }
        })
      },
    },
    VariableDefinition(node) {
      variableNameDefined[node.variable.name.value] = true
    },
    FragmentDefinition: {
      enter(fragmentDefinitionNode) {
        variableNameDefined = Object.create(null)
        const argumentDefinitions = getArgumentDefinitions(fragmentDefinitionNode)
        if (argumentDefinitions != null) {
          argumentDefinitions.forEach(def => (variableNameDefined[def.name.value] = true))
        }
      },
      leave(fragmentDefinitionNode) {
        const varUsages = context.getVariableUsages(fragmentDefinitionNode)
        if (varUsages.length === 0) {
          return
        }

        varUsages.forEach(({ node }) => {
          const varName = node.name.value
          if (variableNameDefined[varName] !== true) {
            context.reportError(
              new GraphQLError(undefinedVarMessageFragment(varName, fragmentDefinitionNode.name.value), [
                node,
                fragmentDefinitionNode,
              ])
            )
          }
        })
      },
    },
  }
}
