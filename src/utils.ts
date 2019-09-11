import { ASTNode, FragmentSpreadNode, FragmentDefinitionNode, GraphQLType } from "graphql"
import { visit, BREAK, GraphQLNonNull } from "./dependencies"

export function findFragmentSpreadParent(nodes: readonly any[]): FragmentSpreadNode | undefined {
  return nodes.find(isFragmentSpread)
}

export function findFragmentDefinitionParent(nodes: readonly any[]): FragmentDefinitionNode | undefined {
  return nodes.find(isFragmentDefinition)
}

export function isFragmentSpread(node: any): node is FragmentSpreadNode {
  return node != null && node.kind === "FragmentSpread"
}

export function isFragmentDefinition(node: any): node is FragmentDefinitionNode {
  return node != null && node.kind === "FragmentDefinition"
}

export function containsVariableNodes(node: ASTNode): boolean {
  let hasVars = false

  visit(node, {
    Variable() {
      hasVars = true
      return BREAK
    },
  })
  return hasVars
}

export function makeNonNullable(type: GraphQLType): GraphQLType {
  if (!(type instanceof GraphQLNonNull)) {
    return new GraphQLNonNull(type)
  }
  return type
}
