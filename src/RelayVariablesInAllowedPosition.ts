import { GraphQLSchema, GraphQLType, ValueNode, ValidationRule } from "graphql"
import { isNonNullType, isTypeSubTypeOf, typeFromAST, GraphQLError, parseType } from "./dependencies"
import { getArgumentDefinitions } from "./argumentDefinitions"

export const RelayVariablesInAllowedPosition: ValidationRule = function RelayVariablesInAllowedPosition(context) {
  let varDefMap = Object.create(null)
  return {
    FragmentDefinition: {
      enter(fragmentDefinition) {
        varDefMap = Object.create(null)
        const argumentDefinitions = getArgumentDefinitions(fragmentDefinition)

        if (argumentDefinitions != null) {
          argumentDefinitions.forEach(def => {
            if (def.value.kind !== "ObjectValue") {
              return
            }
            const typeField = def.value.fields.find(f => f.name.value === "type")
            if (typeField == null || typeField.value.kind !== "StringValue") {
              return
            }
            try {
              const parsedType = parseType(typeField.value.value)
              varDefMap[def.name.value] = {
                type: parsedType,
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
          if (varDef && type) {
            // A var type is allowed if it is the same or more strict (e.g. is
            // a subtype of) than the expected type. It can be more strict if
            // the variable type is non-null when the expected type is nullable.
            // If both are list types, the variable item type can be more strict
            // than the expected item type (contravariant).
            const schema = context.getSchema()
            const varType = typeFromAST(schema, varDef.type)
            if (varType && !allowedVariableUsage(schema, varType, varDef.defaultValue, type, defaultValue)) {
              context.reportError(
                new GraphQLError(badVarPosMessage(varName, varType.toString(), type.toString()), [varDef.node, node])
              )
            }
          }
        }
      },
    },
    OperationDefinition: {
      enter() {
        varDefMap = Object.create(null)
      },
      leave(operation) {
        const usages = context.getVariableUsages(operation)

        for (const { node, type, defaultValue } of usages) {
          const varName = node.name.value
          const varDef = varDefMap[varName]
          if (varDef && type) {
            // A var type is allowed if it is the same or more strict (e.g. is
            // a subtype of) than the expected type. It can be more strict if
            // the variable type is non-null when the expected type is nullable.
            // If both are list types, the variable item type can be more strict
            // than the expected item type (contravariant).
            const schema = context.getSchema()
            const varType = typeFromAST(schema, varDef.type)
            if (varType && !allowedVariableUsage(schema, varType, varDef.defaultValue, type, defaultValue)) {
              context.reportError(
                new GraphQLError(badVarPosMessage(varName, varType.toString(), type.toString()), [varDef.node, node])
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
  locationDefaultValue?: any
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
