import {
  ArgumentNode,
  FragmentDefinitionNode,
  GraphQLInputType,
  NameNode,
  OperationDefinitionNode,
  TypeNode,
  ValidationContext,
  ValueNode,
  VariableNode,
} from "graphql"
import { NodeWithSelectionSet, VariableUsage } from "graphql/validation/ValidationContext"
import { isInputType, parseType, typeFromAST, TypeInfo, visit, visitWithTypeInfo } from "./dependencies"
import { findFragmentSpreadParent } from "./utils"

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

export function getFragmentArgumentDefinitions(
  context: ValidationContext,
  fragmentDefinitionNode: FragmentDefinitionNode
): { [varName: string]: VariableOrArgumentDefinition } {
  const argDefs = getArgumentDefinitions(fragmentDefinitionNode)
  if (argDefs == null) {
    return {}
  }

  return argDefs.reduce((carry, argDef) => {
    const node = argDef.name
    const name = argDef.name.value

    let astTypeNode: TypeNode | undefined
    let defaultValue: ValueNode | undefined

    if (argDef.value.kind === "ObjectValue") {
      const typeField = argDef.value.fields.find((f) => f.name.value === "type")
      const defaultValueField = argDef.value.fields.find((f) => f.name.value === "defaultValue")

      if (typeField != null && typeField.value.kind === "StringValue") {
        try {
          astTypeNode = parseType(typeField.value.value)
        } catch {
          // ignore
        }
      }
      if (defaultValueField != null) {
        defaultValue = defaultValueField.value
      }
    }

    let schemaType: GraphQLInputType | undefined
    if (astTypeNode != null) {
      try {
        const type = typeFromAST(context.getSchema(), astTypeNode as any)
        if (isInputType(type)) {
          schemaType = type
        }
      } catch {
        // ignore
      }
    }

    carry[name] = {
      node,
      schemaType,
      typeNode: astTypeNode,
      defaultValue,
    }

    return carry
  }, {} as { [varName: string]: VariableOrArgumentDefinition })
}

function getVariableUsages(context: ValidationContext, nodeWithSelection: NodeWithSelectionSet): VariableUsage[] {
  const typeInfo = new TypeInfo(context.getSchema())
  const newUsages: VariableUsage[] = []
  visit(
    nodeWithSelection,
    visitWithTypeInfo(typeInfo, {
      VariableDefinition: () => false,
      Directive: (directive, _key, _parent, _hans, ancestors) => {
        if (directive.name.value !== "arguments" || !directive.arguments) {
          return
        }
        const fragmentSpreadParent = findFragmentSpreadParent(ancestors)
        if (!fragmentSpreadParent) {
          return false
        }
        const fragmentDefinition = context.getFragment(fragmentSpreadParent.name.value)
        if (fragmentDefinition == null) {
          return false
        }
        const fragmentArguments = getFragmentArgumentDefinitions(context, fragmentDefinition)

        directive.arguments.forEach((arg) => {
          const argumentName = arg.name.value
          const argumentValue = arg.value
          if (argumentValue.kind === "Variable") {
            const definition = fragmentArguments[argumentName]
            if (!definition) {
              newUsages.push({
                node: argumentValue,
                type: undefined,
                defaultValue: undefined,
              })
            } else {
              newUsages.push({
                node: argumentValue,
                type: definition.schemaType,
                defaultValue: definition.defaultValue,
              })
            }
          }
        })
        return false
      },
      Variable(variable) {
        newUsages.push({
          node: variable,
          type: typeInfo.getInputType(),
          defaultValue: typeInfo.getDefaultValue(),
        })
      },
    })
  )

  return newUsages
}

export interface VariableOrArgumentDefinition {
  node: VariableNode | NameNode
  schemaType?: GraphQLInputType
  typeNode?: TypeNode
  defaultValue?: ValueNode
}

export function isFragmentDefinedVariable(variableOrArgumentDefinition: VariableOrArgumentDefinition): boolean {
  return variableOrArgumentDefinition.node.kind === "Name"
}

export interface VariableUsageWithDefinition extends VariableUsage {
  variableDefinition?: VariableOrArgumentDefinition
  usingFragmentName: string | null
}
export function getRecursiveVariableUsagesWithRelayInfo(
  context: ValidationContext,
  nodeWithSelectionSet: OperationDefinitionNode | FragmentDefinitionNode
): readonly VariableUsageWithDefinition[] {
  const schema = context.getSchema()
  const rootVariables =
    nodeWithSelectionSet.kind === "OperationDefinition"
      ? nodeWithSelectionSet.variableDefinitions == null
        ? {}
        : nodeWithSelectionSet.variableDefinitions.reduce((carry, varDef) => {
            const variableName = varDef.variable.name.value
            carry[variableName] = {
              node: varDef.variable,
              defaultValue: varDef.defaultValue,
              typeNode: varDef.type,
            }
            try {
              const schemaType = typeFromAST(schema, varDef.type as any)
              if (isInputType(schemaType)) {
                carry[variableName].schemaType = schemaType
              }
            } catch {
              // ignore
            }
            return carry
          }, {} as { [varName: string]: VariableOrArgumentDefinition })
      : getFragmentArgumentDefinitions(context, nodeWithSelectionSet)
  const fragments =
    nodeWithSelectionSet.kind === "OperationDefinition"
      ? context.getRecursivelyReferencedFragments(nodeWithSelectionSet)
      : []

  const rootUsages = getVariableUsages(context, nodeWithSelectionSet).map((usage) => {
    const newUsage = { ...usage, usingFragmentName: null } as VariableUsageWithDefinition
    const varName = usage.node.name.value
    if (rootVariables[varName]) {
      newUsage.variableDefinition = rootVariables[varName]
    }
    return newUsage
  })

  const fragmentUsages = fragments.map((fragment): VariableUsageWithDefinition[] => {
    const argumentDefs = getFragmentArgumentDefinitions(context, fragment)

    const framgentUsages = getVariableUsages(context, fragment)

    return framgentUsages.map((usage) => ({
      ...usage,
      variableDefinition: argumentDefs[usage.node.name.value]
        ? argumentDefs[usage.node.name.value]
        : rootVariables[usage.node.name.value],
      usingFragmentName: fragment.name.value,
    }))
  })
  return [...rootUsages].concat(Array.prototype.concat.apply([], fragmentUsages))
}
