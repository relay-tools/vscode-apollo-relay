import {
  DirectiveNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  ObjectValueNode,
  TypeNode,
  ValidationContext,
  ValidationRule,
} from "graphql"
import { getArgumentDefinitions } from "./argumentDefinitions"
import { defaultValidationRules, didYouMean, GraphQLError, parseType, suggestionList, visit } from "./dependencies"
import { containsVariableNodes } from "./utils"

const KnownArgumentNames = defaultValidationRules.find((rule) => rule.name.startsWith("KnownArgumentNames"))!

// tslint:disable-next-line: no-shadowed-variable
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
    FragmentSpread(fragmentSpreadNode) {
      const fragmentDefinitionNode = context.getFragment(fragmentSpreadNode.name.value)
      if (
        fragmentDefinitionNode &&
        (!fragmentSpreadNode.directives ||
          fragmentSpreadNode.directives.findIndex((directive) => directive.name.value === "arguments") === -1) &&
        getArgumentDefinitions(fragmentDefinitionNode)
      ) {
        validateFragmentArguments(context, fragmentDefinitionNode, fragmentSpreadNode)
      }
    },
    Directive(directiveNode, _key, _parent, _nodePath, ancestors) {
      if (directiveNode.name.value === "argumentDefinitions") {
        validateFragmentArgumentDefinitions(context, directiveNode)
        return false
      }
      if (directiveNode.name.value === "arguments") {
        const fragmentSpreadNode = ancestors[ancestors.length - 1] as FragmentSpreadNode
        const fragmentDefinitionNode = context.getFragment(fragmentSpreadNode.name.value)
        if (fragmentDefinitionNode) {
          validateFragmentArguments(context, fragmentDefinitionNode, fragmentSpreadNode, directiveNode)
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
    directiveNode.arguments.forEach((argumentNode) => {
      const metadataNode = argumentNode.value
      if (metadataNode.kind !== "ObjectValue" || !metadataNode.fields.some((field) => field.name.value === "type")) {
        context.reportError(
          new GraphQLError(
            `Metadata of argument definition should be of type "Object" with a "type" and optional "defaultValue" key.`,
            metadataNode
          )
        )
      } else {
        metadataNode.fields.forEach((fieldNode) => {
          const name = fieldNode.name.value
          if (name !== "type" && name !== "defaultValue") {
            context.reportError(
              new GraphQLError(`Unknown key "${name}" in argument definition metadata.`, fieldNode.name)
            )
          }
          const valueNode = fieldNode.value
          if (name === "type") {
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
          } else if (name === "defaultValue") {
            if (containsVariableNodes(fieldNode.value)) {
              context.reportError(
                new GraphQLError(
                  `defaultValue contains variables for argument ${argumentNode.name.value} in argument definition metadata.`,
                  valueNode
                )
              )
            }
          }
        })
      }
    })
  }
}

function isNullableArgument(argumentDefinition: ObjectValueNode): boolean {
  const typeField = argumentDefinition.fields.find((f) => f.name.value === "type")
  if (typeField == null) {
    return false
  }

  if (typeField.value.kind !== "StringValue") {
    return false
  }
  try {
    const type = parseType(typeField.value.value)
    return type.kind !== "NonNullType"
  } catch (e) {
    return false
  }
}

function validateFragmentArguments(
  context: ValidationContext,
  fragmentDefinitionNode: FragmentDefinitionNode,
  fragmentSpreadNode: FragmentSpreadNode,
  directiveNode?: DirectiveNode
) {
  const argumentDefinitionNodes = getArgumentDefinitions(fragmentDefinitionNode)
  if (!argumentDefinitionNodes) {
    context.reportError(
      new GraphQLError(
        `No fragment argument definitions exist for fragment "${fragmentSpreadNode.name.value}".`,
        fragmentSpreadNode
      )
    )
  } else {
    const argumentNodes = [...((directiveNode && directiveNode.arguments) || [])]
    argumentDefinitionNodes.forEach((argumentDef) => {
      const argumentIndex = argumentNodes.findIndex((a) => a.name.value === argumentDef.name.value)
      if (argumentIndex >= 0) {
        argumentNodes.splice(argumentIndex, 1)
      } else {
        const value = argumentDef.value
        if (value.kind === "ObjectValue") {
          if (
            value.fields.findIndex((field) => field.name.value === "defaultValue") === -1 &&
            !isNullableArgument(value)
          ) {
            context.reportError(
              new GraphQLError(
                `Missing required fragment argument "${argumentDef.name.value}".`,
                directiveNode || fragmentSpreadNode
              )
            )
          }
        } else {
          console.log(`Unexpected fragment argument value kind "${value.kind}".`)
        }
      }
    })
    argumentNodes.forEach((argumentNode) => {
      const suggestions: string[] = suggestionList(
        argumentNode.name.value,
        argumentDefinitionNodes.map((argDef) => argDef.name.value)
      )
      context.reportError(
        new GraphQLError(
          `Unknown fragment argument "${argumentNode.name.value}".` + didYouMean(suggestions.map((x) => `"${x}"`)),
          directiveNode
        )
      )
    })
  }
}
