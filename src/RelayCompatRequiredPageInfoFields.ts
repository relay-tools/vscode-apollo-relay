import { FieldNode, FragmentDefinitionNode, SelectionSetNode, ValidationRule } from "graphql"
import { GraphQLError, visit } from "./dependencies"
import { getConnectionDirective, isConnectionType } from "./utils"

function hasFirstArgument(fieldNode: FieldNode): boolean {
  return !!(fieldNode.arguments && fieldNode.arguments.find((arg) => arg.name.value === "first"))
}

function hasLastArgument(fieldNode: FieldNode): boolean {
  return !!(fieldNode.arguments && fieldNode.arguments.find((arg) => arg.name.value === "last"))
}

function hasAfterArgument(fieldNode: FieldNode): boolean {
  return !!(fieldNode.arguments && fieldNode.arguments.find((arg) => arg.name.value === "after"))
}

function hasBeforeArgument(fieldNode: FieldNode): boolean {
  return !!(fieldNode.arguments && fieldNode.arguments.find((arg) => arg.name.value === "before"))
}

function rollupFieldsInfo(fieldsInfo: PaginationFields[]): PaginationFields {
  return fieldsInfo.reduce(
    (carry, el) => {
      carry.hasNextPage = carry.hasNextPage || el.hasNextPage
      carry.hasPreviousPage = carry.hasPreviousPage || el.hasPreviousPage
      carry.endCursor = carry.endCursor || el.endCursor
      carry.startCursor = carry.startCursor || el.startCursor
      return carry
    },
    {
      hasNextPage: false,
      hasPreviousPage: false,
      endCursor: false,
      startCursor: false,
    }
  )
}

export function connectionSelectionSetPaginationInfo(
  getFragment: (name: string) => FragmentDefinitionNode | null | undefined,
  selectionSetNode: SelectionSetNode
): PaginationFields {
  const fieldsInfo: PaginationFields[] = []

  visit(selectionSetNode, {
    SelectionSet(selectionSet) {
      if (selectionSet !== selectionSetNode) {
        // Don't recurse into other selection sets
        return false
      }
    },
    InlineFragment(inlineFragment) {
      fieldsInfo.push(connectionSelectionSetPaginationInfo(getFragment, inlineFragment.selectionSet))
      return false
    },
    Field(fieldNode) {
      if (fieldNode.name.value === "pageInfo" && fieldNode.selectionSet) {
        fieldsInfo.push(pageInfoSelectionSetPaginationInfo(getFragment, fieldNode.selectionSet))
        return false
      }
    },
    FragmentSpread(fragmentSpread) {
      const fragmentDefinitionNode = getFragment(fragmentSpread.name.value)
      if (fragmentDefinitionNode) {
        fieldsInfo.push(connectionSelectionSetPaginationInfo(getFragment, fragmentDefinitionNode.selectionSet))
      }
      return false
    },
  })
  return rollupFieldsInfo(fieldsInfo)
}

interface PaginationFields {
  hasNextPage: boolean
  hasPreviousPage: boolean
  startCursor: boolean
  endCursor: boolean
}

function pageInfoSelectionSetPaginationInfo(
  getFragment: (name: string) => FragmentDefinitionNode | null | undefined,
  selectionSetNode: SelectionSetNode
): PaginationFields {
  const fields: PaginationFields = {
    hasNextPage: false,
    hasPreviousPage: false,
    startCursor: false,
    endCursor: false,
  }
  const nestedFieldsInfo: PaginationFields[] = []

  visit(selectionSetNode, {
    SelectionSet(selectionSet) {
      if (selectionSet !== selectionSetNode) {
        // Don't recurse into other selection sets
        return false
      }
    },
    InlineFragment(inlineFragment) {
      nestedFieldsInfo.push(pageInfoSelectionSetPaginationInfo(getFragment, inlineFragment.selectionSet))
      return false
    },
    Field(fieldNode) {
      if (fieldNode.name.value === "startCursor") {
        fields.startCursor = true
      }
      if (fieldNode.name.value === "endCursor") {
        fields.endCursor = true
      }
      if (fieldNode.name.value === "hasPreviousPage") {
        fields.hasPreviousPage = true
      }
      if (fieldNode.name.value === "hasNextPage") {
        fields.hasNextPage = true
      }
    },
    FragmentSpread(fragmentSpread) {
      const fragmentDefinitionNode = getFragment(fragmentSpread.name.value)
      if (fragmentDefinitionNode) {
        nestedFieldsInfo.push(pageInfoSelectionSetPaginationInfo(getFragment, fragmentDefinitionNode.selectionSet))
      }
      return false
    },
  })
  return rollupFieldsInfo([fields, ...nestedFieldsInfo])
}

// tslint:disable-next-line: no-shadowed-variable
export const RelayCompatRequiredPageInfoFields: ValidationRule = function RelayCompatRequiredPageInfoFields(context) {
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
        if (!connectionDirective) {
          return
        }

        const isForwardConnection = hasFirstArgument(fieldNode) && hasAfterArgument(fieldNode)
        const isBackwardConnection = hasLastArgument(fieldNode) && hasBeforeArgument(fieldNode)
        const selectionName = fieldNode.alias || fieldNode.name

        const paginationFields = connectionSelectionSetPaginationInfo(
          (name) => context.getFragment(name),
          fieldNode.selectionSet
        )

        const connectionName = connectionDirective.key || selectionName

        if (isForwardConnection) {
          if (!paginationFields.hasNextPage) {
            context.reportError(
              new GraphQLError(
                `Missing pageInfo.hasNextPage field on connection "${connectionName}".`,
                connectionDirective.directive
              )
            )
          }
          if (!paginationFields.endCursor) {
            context.reportError(
              new GraphQLError(
                `Missing pageInfo.endCursor field on connection "${connectionName}".`,
                connectionDirective.directive
              )
            )
          }
        }

        if (isBackwardConnection) {
          if (!paginationFields.hasPreviousPage) {
            context.reportError(
              new GraphQLError(
                `Missing pageInfo.hasPreviousPage field on connection "${connectionName}".`,
                connectionDirective.directive
              )
            )
          }
          if (!paginationFields.startCursor) {
            context.reportError(
              new GraphQLError(
                `Missing pageInfo.startCursor field on connection "${connectionName}".`,
                connectionDirective.directive
              )
            )
          }
        }
      },
    },
  }
}
