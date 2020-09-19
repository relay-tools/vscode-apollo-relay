import { ValidationRule } from "graphql"
import { getRecursiveVariableUsagesWithRelayInfo } from "./argumentDefinitions"
import { GraphQLError } from "./dependencies"

export function undefinedVarMessage(
  varName: string,
  opName: string | undefined,
  usingFragmentName: string | null
): string {
  opName = !opName ? "unnamed operation" : opName
  return usingFragmentName
    ? `Variable "$${varName}" is used by fragment "${usingFragmentName}", but not defined by operation "${opName}".`
    : `Variable "$${varName}" is not defined by operation "${opName}".`
}

// tslint:disable-next-line: no-shadowed-variable
export const RelayKnownVariableNames: ValidationRule = function RelayKnownVariableNames(context) {
  return {
    OperationDefinition(opDef) {
      const usages = getRecursiveVariableUsagesWithRelayInfo(context, opDef)

      const errors = Object.create(null)

      usages.forEach((usage) => {
        const varName = usage.node.name.value
        if (!usage.variableDefinition) {
          const location = [...(!usage.usingFragmentName ? [usage.node] : []), opDef]
          const errorStr = undefinedVarMessage(varName, opDef.name && opDef.name.value, usage.usingFragmentName)
          if (!errors[errorStr]) {
            if (usage.usingFragmentName) {
              errors[errorStr] = true
            }
            context.reportError(new GraphQLError(errorStr, location))
          }
        }
      })
    },
  }
}
