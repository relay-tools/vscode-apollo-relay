import { ValidationContext, OperationDefinitionNode, ValueNode, TypeNode, GraphQLInputType, ASTNode } from "graphql"
import { isTypeSubTypeOf, typeFromAST } from "./dependencies"

export function operationsReferencingFragment(
  context: ValidationContext,
  fragmentName: string
): OperationDefinitionNode[] {
  const document = context.getDocument()

  const result: OperationDefinitionNode[] = []

  document.definitions.forEach(def => {
    if (def.kind === "OperationDefinition") {
      const referencedFragments = context.getRecursivelyReferencedFragments(def)
      if (referencedFragments.find(r => r.name.value === fragmentName)) {
        result.push(def)
      }
    }
  })

  return result
}

interface VariableDefinitions {
  [name: string]: { type: TypeNode; defaultValue: ValueNode | undefined; node: ASTNode }
}

interface VariableDefinitionsWithASTType {
  [name: string]: { astType: GraphQLInputType; type: TypeNode; defaultValue: ValueNode | undefined; node: ASTNode }
}

function intersectValues<T>(values: T[][]): T[] {
  if (values.length === 0) {
    return []
  }
  return values[0].filter(v => values.every(v2 => v2.indexOf(v) >= 0))
}

export function getOperationsDefinedVariableDefinitionsForFragment(
  context: ValidationContext,
  fragmentName: string
): VariableDefinitions {
  return operationsDefinedVariables(context, operationsReferencingFragment(context, fragmentName))
}

/**
 * Returns a list of all variables defined in all the operations where the variables match
 */
export function operationsDefinedVariables(
  context: ValidationContext,
  operations: OperationDefinitionNode[]
): VariableDefinitions {
  if (operations.length === 0) {
    return {}
  }
  const schema = context.getSchema()
  const variables: VariableDefinitionsWithASTType[] = operations.map(op => {
    if (op.variableDefinitions == null) {
      return {}
    }

    return op.variableDefinitions.reduce(
      (carry, varDef) => ({
        ...carry,
        [varDef.variable.name.value]: {
          type: varDef.type,
          astType: typeFromAST(schema, varDef.type as any) as GraphQLInputType,
          defaultValue: varDef.defaultValue,
          node: varDef.variable,
        },
      }),
      {} as VariableDefinitionsWithASTType
    )
  })

  const sameVariables = intersectValues(variables.map(v => Object.keys(v)))

  return sameVariables.reduce(
    (carry, varName): VariableDefinitions => {
      const varDefs = variables.map(vars => vars[varName])

      const lowestCommonDef = varDefs.find(def =>
        varDefs.every(def2 => isTypeSubTypeOf(schema, def2.astType, def.astType))
      )
      if (lowestCommonDef == null) {
        return carry
      }
      if (lowestCommonDef.type.kind !== "NonNullType") {
        // We turn this into a non null type if all of the definitions have a default value that is not null
        const makeNonNull = varDefs.every(def => {
          return def.defaultValue != null && def.defaultValue.kind !== "NullValue"
        })
        if (makeNonNull) {
          return {
            ...carry,
            [varName]: {
              type: {
                kind: "NonNullType",
                type: lowestCommonDef.type,
                loc: lowestCommonDef.type.loc,
              },
              defaultValue: undefined,
              node: lowestCommonDef.node,
            },
          }
        }
        return {
          ...carry,
          [varName]: {
            type: lowestCommonDef.type,
            defaultValue: undefined,
            node: lowestCommonDef.node,
          },
        }
      }

      return {
        ...carry,
        [varName]: {
          type: lowestCommonDef.type,
          defaultValue: lowestCommonDef.defaultValue,
          node: lowestCommonDef.node,
        },
      }
    },
    {} as VariableDefinitions
  )
}
