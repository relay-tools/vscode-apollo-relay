import { GraphQLSchema, GraphQLType, ValidationRule, ValueNode } from "graphql"
import { getRecursiveVariableUsagesWithRelayInfo, isFragmentDefinedVariable } from "./argumentDefinitions"
import { GraphQLError, isNonNullType, isTypeSubTypeOf } from "./dependencies"

// tslint:disable-next-line: no-shadowed-variable
export const RelayVariablesInAllowedPosition: ValidationRule = function RelayVariablesInAllowedPosition(context) {
  return {
    FragmentDefinition(fragmentDef) {
      const schema = context.getSchema()
      const varUsages = getRecursiveVariableUsagesWithRelayInfo(context, fragmentDef)

      varUsages.forEach((usage) => {
        if (usage.variableDefinition) {
          const varDefType = usage.variableDefinition.schemaType
          const varDefDefault = usage.variableDefinition.defaultValue
          const definitionNode = usage.variableDefinition.node

          const locationType = usage.type
          const locationDefaultValue = usage.defaultValue
          const varName = usage.node.name.value
          if (
            varDefType &&
            locationType &&
            definitionNode &&
            !allowedVariableUsage(schema, varDefType, varDefDefault, locationType, locationDefaultValue)
          ) {
            // The diagnostics in vscode does seemingly not support errors in one file having a related location
            // in a different file
            const location = [...(!usage.usingFragmentName ? [definitionNode] : []), usage.node]
            context.reportError(
              new GraphQLError(badVarPosMessage(varName, varDefType.toString(), locationType.toString()), location)
            )
          }
        }
      })
    },
    OperationDefinition(opDef) {
      const schema = context.getSchema()
      const varUsages = getRecursiveVariableUsagesWithRelayInfo(context, opDef)

      const errors = Object.create(null)

      varUsages.forEach((usage) => {
        // We only check for variables that are not defined in the fragment itself
        // as the visitor for the fragment definition will test for that
        // thus giving errors for those variables even when the fragment is not
        // used in an operation
        if (usage.variableDefinition && !isFragmentDefinedVariable(usage.variableDefinition)) {
          const varDefType = usage.variableDefinition.schemaType
          const varDefDefault = usage.variableDefinition.defaultValue
          const definitionNode = usage.variableDefinition.node

          const locationType = usage.type
          const locationDefaultValue = usage.defaultValue
          const varName = usage.node.name.value
          if (
            varDefType &&
            locationType &&
            definitionNode &&
            !allowedVariableUsage(schema, varDefType, varDefDefault, locationType, locationDefaultValue)
          ) {
            // The diagnostics in vscode does seemingly not support errors in one file having a related location
            // in a different file
            const location = [...(!usage.usingFragmentName ? [usage.node] : []), opDef]
            const errorStr = badVarPosMessage(varName, varDefType.toString(), locationType.toString())
            if (!errors[errorStr]) {
              if (usage.usingFragmentName) {
                errors[errorStr] = true
              }
              context.reportError(new GraphQLError(errorStr, location))
            }
          }
        }
      })
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
