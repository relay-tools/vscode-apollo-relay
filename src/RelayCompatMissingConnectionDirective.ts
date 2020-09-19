import { FieldNode, ValidationRule } from "graphql"
import { GraphQLError } from "./dependencies"
import { getConnectionDirective, isConnectionType } from "./utils"

function hasAfterArgument(fieldNode: FieldNode): boolean {
  return !!(fieldNode.arguments && fieldNode.arguments.find((arg) => arg.name.value === "after"))
}

function hasBeforeArgument(fieldNode: FieldNode): boolean {
  return !!(fieldNode.arguments && fieldNode.arguments.find((arg) => arg.name.value === "before"))
}

// tslint:disable-next-line: no-shadowed-variable
export const RelayCompatMissingConnectionDirective: ValidationRule = function RelayCompatMissingConnectionDirective(
  context
) {
  return {
    Field: {
      enter(fieldNode) {
        if (!fieldNode.selectionSet) {
          return
        }
        const type = context.getType()
        if (!type || !isConnectionType(type)) {
          return
        }
        const connectionDirective = getConnectionDirective(fieldNode)
        if (!connectionDirective && (hasAfterArgument(fieldNode) || hasBeforeArgument(fieldNode))) {
          context.reportError(new GraphQLError("Missing @connection directive", fieldNode))
        }
      },
    },
  }
}
