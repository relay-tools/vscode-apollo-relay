import {
  ASTNode,
  DirectiveNode,
  FieldNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  GraphQLOutputType,
  GraphQLType,
} from "graphql"
import { BREAK, getNullableType, GraphQLNonNull, GraphQLObjectType, visit } from "./dependencies"

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

export function getConnectionDirective(fieldNode: FieldNode): { key: string | null; directive: DirectiveNode } | null {
  const directive = fieldNode.directives && fieldNode.directives.find((d) => d.name.value === "connection")

  if (!directive) {
    return null
  }

  const keyArgument = directive.arguments && directive.arguments.find((arg) => arg.name.value === "key")
  if (!keyArgument || keyArgument.value.kind !== "StringValue") {
    return {
      key: null,
      directive,
    }
  }

  return {
    key: keyArgument.value.value,
    directive,
  }
}

export function isConnectionType(type: GraphQLOutputType): boolean {
  const nullableType = getNullableType(type)

  if (!(nullableType instanceof GraphQLObjectType)) {
    return false
  }

  return nullableType.name.endsWith("Connection")
}
