import { ValidationRule, FragmentSpreadNode, ASTNode } from "graphql"
import { GraphQLError, visit, BREAK, valueFromAST } from "./dependencies"
import { getFragmentArgumentDefinitions } from "./argumentDefinitions"

function findFragmentSpreadParent(nodes: readonly any[]): FragmentSpreadNode | undefined {
  return nodes.find(isFragmentSpread)
}

function isFragmentSpread(node: any): node is FragmentSpreadNode {
  return node != null && node.kind === "FragmentSpread"
}

function hasVariables(node: ASTNode): boolean {
  let hasVars = false

  visit(node, {
    Variable() {
      hasVars = true
      return BREAK
    },
  })
  return hasVars
}

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

      directive.arguments.forEach(arg => {
        const argDef = typedArguments[arg.name.value]
        if (!argDef || !argDef.schemaType) {
          return
        }

        const schemaType = argDef.schemaType

        if (hasVariables(arg.value)) {
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
