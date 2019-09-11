import { ValidationRule, GraphQLOutputType, FieldNode, SelectionSetNode } from "graphql"
import { getNullableType, GraphQLObjectType, GraphQLError } from "./dependencies"

function isConnectionType(type: GraphQLOutputType): boolean {
  const nullableType = getNullableType(type)

  if (!(nullableType instanceof GraphQLObjectType)) {
    return false
  }

  return nullableType.name.endsWith("Connection")
}

function hasConnectionDirective(fieldNode: FieldNode): boolean {
  return !!(fieldNode.directives && fieldNode.directives.find(d => d.name.value === "connection"))
}

function hasFirstArgument(fieldNode: FieldNode): boolean {
  return !!(fieldNode.arguments && fieldNode.arguments.find(arg => arg.name.value === "first"))
}

function hasLastArgument(fieldNode: FieldNode): boolean {
  return !!(fieldNode.arguments && fieldNode.arguments.find(arg => arg.name.value === "last"))
}

function hasAfterArgument(fieldNode: FieldNode): boolean {
  return !!(fieldNode.arguments && fieldNode.arguments.find(arg => arg.name.value === "after"))
}

function hasBeforeArgument(fieldNode: FieldNode): boolean {
  return !!(fieldNode.arguments && fieldNode.arguments.find(arg => arg.name.value === "before"))
}

function getPageInfoSelection(fieldNode: FieldNode): SelectionSetNode | null {
  if (!fieldNode.selectionSet) {
    return null
  }

  const selection = fieldNode.selectionSet.selections.find(
    s => s.kind === "Field" && !s.alias && s.name.value === "pageInfo"
  )
  if (!selection || selection.kind !== "Field" || !selection.selectionSet) {
    return null
  }

  return selection.selectionSet
}

function hasForwardConnectionPageInfoFields(selectionSet: SelectionSetNode): boolean {
  const endCursorField = selectionSet.selections.find(
    s => s.kind === "Field" && !s.alias && s.name.value === "endCursor"
  )
  const hasNextPageField = selectionSet.selections.find(
    s => s.kind === "Field" && !s.alias && s.name.value === "hasNextPage"
  )

  return !!(endCursorField && hasNextPageField)
}

function hasBackwardConnectionPageInfoFields(selectionSet: SelectionSetNode): boolean {
  const startCursorField = selectionSet.selections.find(
    s => s.kind === "Field" && !s.alias && s.name.value === "startCursor"
  )
  const hasPreviousPageField = selectionSet.selections.find(
    s => s.kind === "Field" && !s.alias && s.name.value === "hasPreviousPage"
  )

  return !!(startCursorField && hasPreviousPageField)
}

export const RelayRequiredPageInfoFields: ValidationRule = function RelayRequiredPageInfoFields(context) {
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
        if (!hasConnectionDirective(fieldNode)) {
          return
        }

        const isForwardConnection = hasFirstArgument(fieldNode) && hasAfterArgument(fieldNode)
        const isBackwardConnection = hasLastArgument(fieldNode) && hasBeforeArgument(fieldNode)

        const pageInfoSelection = getPageInfoSelection(fieldNode)

        const selectionName = fieldNode.alias || fieldNode.name

        if (!pageInfoSelection) {
          context.reportError(
            new GraphQLError(`Missing pageInfo selection on connection "${selectionName.value}".`, [fieldNode])
          )
          return
        }

        if (isForwardConnection && !hasForwardConnectionPageInfoFields(pageInfoSelection)) {
          context.reportError(
            new GraphQLError(
              `Missing forward pageInfo fields "hasNextPage" and "endCursor" for connection "${selectionName.value}".`,
              [fieldNode]
            )
          )
          return
        }

        if (isBackwardConnection && !hasBackwardConnectionPageInfoFields(pageInfoSelection)) {
          context.reportError(
            new GraphQLError(
              `Missing backward pageInfo fields "hasPreviousPage" and "startCursor" for connection "${selectionName.value}".`,
              [fieldNode]
            )
          )
          return
        }
      },
    },
  }
}
