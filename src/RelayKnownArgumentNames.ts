import {
  ArgumentNode,
  FragmentSpreadNode,
  ValidationRule,
  FragmentDefinitionNode,
  ValidationContext,
  DirectiveNode,
  TypeNode,
} from "graphql"
import { defaultValidationRules, didYouMean, GraphQLError, parseType, suggestionList, visit } from "./dependencies"

const KnownArgumentNames = defaultValidationRules.find(rule => rule.name === "KnownArgumentNames")!

export const RelayKnownArgumentNames: ValidationRule = function RelayKnownArgumentNames(context) {
  const originalRuleVisitor = KnownArgumentNames(context)
  return {
    Argument(argumentNode) {
      /**
       * Always forward field arguments to the original rule.
       */
      visit(argumentNode, originalRuleVisitor)
      return false
    },
    Directive(directiveNode, _key, _parent, _nodePath, ancestors) {
      if (directiveNode.name.value === "argumentDefinitions") {
        validateFragmentArgumentDefinitions(context, directiveNode)
        return false
      }
      if (directiveNode.name.value === "arguments") {
        const fragmentSpread = ancestors[ancestors.length - 1] as FragmentSpreadNode
        const fragmentDefinitionNode = context.getFragment(fragmentSpread.name.value)
        // If this doesn’t pass it will get flagged as a unknown fragment, so we don’t need to report it.
        if (fragmentDefinitionNode) {
          validateFragmentArguments(context, fragmentDefinitionNode, fragmentSpread, directiveNode)
        }
        return false
      }
      /**
       * Forward any other directives to original rule.
       */
      visit(directiveNode, originalRuleVisitor)
      return false
    },
  }
}

function validateFragmentArgumentDefinitions(context: ValidationContext, directiveNode: DirectiveNode) {
  if (!directiveNode.arguments || directiveNode.arguments.length === 0) {
    context.reportError(new GraphQLError(`Missing required argument definitions.`, directiveNode))
  } else {
    directiveNode.arguments.forEach(argumentNode => {
      const metadataNode = argumentNode.value
      if (metadataNode.kind !== "ObjectValue" || !metadataNode.fields.some(field => field.name.value === "type")) {
        context.reportError(
          new GraphQLError(
            `Metadata of argument definition should be of type "Object" with a "type" and optional "defaultValue" key.`,
            metadataNode
          )
        )
      } else {
        metadataNode.fields.forEach(fieldNode => {
          const name = fieldNode.name.value
          if (name !== "type" && name !== "defaultValue") {
            context.reportError(
              new GraphQLError(`Unknown key "${name}" in argument definition metadata.`, fieldNode.name)
            )
          }
          if (name === "type") {
            const valueNode = fieldNode.value
            if (valueNode.kind !== "StringValue") {
              context.reportError(
                new GraphQLError(
                  `Value for "type" in argument definition metadata must be specified as string literal.`,
                  valueNode
                )
              )
            } else {
              let typeNode: TypeNode | null = null
              try {
                typeNode = parseType(valueNode.value)
              } catch (error) {
                context.reportError(new GraphQLError(error.message, valueNode))
              }
              if (typeNode) {
                while (typeNode.kind === "NonNullType" || typeNode.kind === "ListType") {
                  typeNode = typeNode.type
                }
                if (!context.getSchema().getType(typeNode.name.value)) {
                  context.reportError(
                    new GraphQLError(
                      `Unknown type "${typeNode.name.value}" in argument definition metadata.`,
                      valueNode
                    )
                  )
                }
              }
            }
          }
        })
      }
    })
  }
}

function validateFragmentArguments(
  context: ValidationContext,
  fragmentDefinitionNode: FragmentDefinitionNode,
  fragmentSpread: FragmentSpreadNode,
  directiveNode: DirectiveNode
) {
  const argumentDefinitionNodes = getArgumentDefinitions(fragmentDefinitionNode)
  if (!argumentDefinitionNodes) {
    context.reportError(
      new GraphQLError(
        `No fragment argument definitions exist for fragment "${fragmentSpread.name.value}".`,
        fragmentSpread
      )
    )
  } else {
    const argumentNodes = [...(directiveNode.arguments || [])]
    argumentDefinitionNodes.forEach(argumentDef => {
      const argumentIndex = argumentNodes.findIndex(a => a.name.value === argumentDef.name.value)
      if (argumentIndex >= 0) {
        argumentNodes.splice(argumentIndex, 1)
      } else {
        const value = argumentDef.value
        if (value.kind === "ObjectValue") {
          if (value.fields.findIndex(field => field.name.value === "defaultValue") === -1) {
            context.reportError(
              new GraphQLError(`Missing required fragment argument "${argumentDef.name.value}".`, directiveNode)
            )
          }
        } else {
          console.log(`Unexpected fragment argument value kind "${value.kind}".`)
        }
      }
    })
    argumentNodes.forEach(argumentNode => {
      const suggestions: string[] = suggestionList(
        argumentNode.name.value,
        // FIXME: Unsure why argumentDefinitions could be `undefined` here again
        argumentDefinitionNodes!.map(argDef => argDef.name.value)
      )
      context.reportError(
        new GraphQLError(
          `Unknown fragment argument "${argumentNode.name.value}".` + didYouMean(suggestions.map(x => `"${x}"`)),
          directiveNode
        )
      )
    })
  }
}

function getArgumentDefinitions(fragmentDefinitionNode: FragmentDefinitionNode) {
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
