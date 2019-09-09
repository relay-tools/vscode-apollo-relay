import { GraphQLSchema, GraphQLType, ValueNode, ValidationRule, VariableNode, GraphQLInputType } from "graphql"
import { isNonNullType, isTypeSubTypeOf, typeFromAST, GraphQLError, parseType } from "./dependencies"
import { getArgumentDefinitions } from "./argumentDefinitions"

export const RelayVariablesInAllowedPosition: ValidationRule = function RelayVariablesInAllowedPosition(context) {
  let varDefMap = Object.create(null)
  var varUsageMap: { node: VariableNode; type: GraphQLInputType; defaultValue: ValueNode | undefined }[] = []
  return {
    FragmentSpread(node) {
      // Collect variable arguments used inside fragment spreads such that we know the type for these
      // usages as well
      if (node.directives == null) {
        return
      }

      const argumentsDirective = node.directives.find(d => d.name.value === "arguments")
      if (argumentsDirective == null || argumentsDirective.arguments == null) {
        return
      }

      const fragmentSpreadDefinition = context.getFragment(node.name.value)

      if (fragmentSpreadDefinition == null) {
        return
      }
      const argumentDefinitions = getArgumentDefinitions(fragmentSpreadDefinition)

      if (argumentDefinitions == null) {
        return
      }

      argumentsDirective.arguments.forEach(arg => {
        const value = arg.value
        if (value.kind !== "Variable") {
          return
        }
        const argDef = argumentDefinitions.find(def => def.name.value === arg.name.value)

        if (argDef == null || argDef.value.kind !== "ObjectValue") {
          return
        }

        const typeField = argDef.value.fields.find(f => f.name.value === "type")
        if (typeField == null || typeField.value.kind !== "StringValue") {
          return
        }
        const defaultValue = argDef.value.fields.find(f => f.name.value === "defaultValue")
        try {
          const parsedType = parseType(typeField.value.value)
          varUsageMap.push({
            node: value,
            type: typeFromAST(
              context.getSchema(),
              parsedType as any /* Not sure why this is needed */
            ) as GraphQLInputType,
            defaultValue: defaultValue == null ? undefined : defaultValue.value,
          })
        } catch (e) {}
      })
    },
    FragmentDefinition: {
      enter(fragmentDefinition) {
        varDefMap = Object.create(null)
        varUsageMap = []
        const argumentDefinitions = getArgumentDefinitions(fragmentDefinition)

        if (argumentDefinitions) {
          argumentDefinitions.forEach(def => {
            if (def.value.kind !== "ObjectValue") {
              return
            }
            const typeField = def.value.fields.find(f => f.name.value === "type")
            if (typeField == null || typeField.value.kind !== "StringValue") {
              return
            }
            const defaultValue = def.value.fields.find(f => f.name.value === "defaultValue")
            try {
              const parsedType = parseType(typeField.value.value)
              varDefMap[def.name.value] = {
                type: parsedType,
                defaultValue: defaultValue == null ? undefined : defaultValue.value,
                node: def,
              }
            } catch (e) {}
          })
        }
      },
      leave(fragmentDefinition) {
        const usages = context.getVariableUsages(fragmentDefinition)

        for (const { node, type, defaultValue } of usages) {
          const varName = node.name.value
          const varDef = varDefMap[varName]
          if (varDef) {
            let workingType
            let workingDefault
            if (type) {
              workingType = type
              workingDefault = defaultValue
            } else {
              const argUsage = varUsageMap.find(vu => vu.node === node)
              if (argUsage) {
                workingType = argUsage.type
                workingDefault = argUsage.defaultValue
              } else {
                continue
              }
            }
            // A var type is allowed if it is the same or more strict (e.g. is
            // a subtype of) than the expected type. It can be more strict if
            // the variable type is non-null when the expected type is nullable.
            // If both are list types, the variable item type can be more strict
            // than the expected item type (contravariant).
            const schema = context.getSchema()
            const varType = typeFromAST(schema, varDef.type)
            if (varType && !allowedVariableUsage(schema, varType, varDef.defaultValue, workingType, workingDefault)) {
              context.reportError(
                new GraphQLError(badVarPosMessage(varName, varType.toString(), workingType.toString()), [
                  varDef.node,
                  node,
                ])
              )
            }
          }
        }
      },
    },
    OperationDefinition: {
      enter() {
        varDefMap = Object.create(null)
        varUsageMap = []
      },
      leave(operation) {
        const usages = context.getVariableUsages(operation)

        for (const { node, type, defaultValue } of usages) {
          const varName = node.name.value
          const varDef = varDefMap[varName]
          if (varDef) {
            let workingType
            let workingDefault
            if (type) {
              workingType = type
              workingDefault = defaultValue
            } else {
              const argUsage = varUsageMap.find(vu => vu.node === node)
              if (argUsage) {
                workingType = argUsage.type
                workingDefault = argUsage.defaultValue
              } else {
                continue
              }
            }
            // A var type is allowed if it is the same or more strict (e.g. is
            // a subtype of) than the expected type. It can be more strict if
            // the variable type is non-null when the expected type is nullable.
            // If both are list types, the variable item type can be more strict
            // than the expected item type (contravariant).
            const schema = context.getSchema()
            const varType = typeFromAST(schema, varDef.type)
            if (varType && !allowedVariableUsage(schema, varType, varDef.defaultValue, workingType, workingDefault)) {
              context.reportError(
                new GraphQLError(badVarPosMessage(varName, varType.toString(), workingType.toString()), [
                  varDef.node,
                  node,
                ])
              )
            }
          }
        }
      },
    },
    VariableDefinition(node) {
      varDefMap[node.variable.name.value] = {
        type: node.type,
        node: node,
        defaultValue: node.defaultValue,
      }
    },
  }
}

/**
 * This is ported from the `VariablesInAllowedPosition` rule from GraphQL itself
 */
function allowedVariableUsage(
  schema: GraphQLSchema,
  varType: GraphQLType,
  varDefaultValue: ValueNode | undefined,
  locationType: GraphQLType,
  locationDefaultValue: ValueNode | undefined
): boolean {
  if (isNonNullType(locationType) && !isNonNullType(varType)) {
    const hasNonNullVariableDefaultValue = varDefaultValue != null && varDefaultValue.kind !== "NullValue"
    const hasLocationDefaultValue = locationDefaultValue !== undefined
    if (!hasNonNullVariableDefaultValue && !hasLocationDefaultValue) {
      return false
    }
    const nullableLocationType = locationType.ofType
    return isTypeSubTypeOf(schema, varType, nullableLocationType)
  }
  return isTypeSubTypeOf(schema, varType, locationType)
}

function badVarPosMessage(varName: string, varType: string, expectedType: string): string {
  return `Variable "$${varName}" of type "${varType}" used in position expecting type "${expectedType}".`
}
