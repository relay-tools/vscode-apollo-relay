import { FragmentDefinitionNode, ArgumentNode } from "graphql"
import { visit } from "./dependencies"

export function getArgumentDefinitions(fragmentDefinitionNode: FragmentDefinitionNode) {
  let argumentDefinitionNodes: readonly ArgumentNode[] | undefined
  visit(fragmentDefinitionNode, {
    Directive(argumentDefinitionsDirectiveNode) {
      if (argumentDefinitionsDirectiveNode.name.value === "argumentDefinitions") {
        argumentDefinitionNodes = argumentDefinitionsDirectiveNode.arguments
      } else {
        return false
      }
    },
  })
  return argumentDefinitionNodes
}
