import { readFileSync } from "fs"
import { buildSchema, parse, validate } from "graphql"
import { generateDirectivesFile } from "../src/generateDirectivesFile"
import { RelayKnownArgumentNames } from "../src/RelayKnownArgumentNames"

const schema = buildSchema(`
${readFileSync(generateDirectivesFile(), "utf8")}

type Foo {
  bar: String
  baz: Boolean
}

type Query {
  foo: Foo
}
`)

function validateDocuments(source: string) {
  return validate(schema, parse(source), [RelayKnownArgumentNames])
}

describe(RelayKnownArgumentNames, () => {
  describe("concerning standard KnownArguments behaviour", () => {
    it("validates field arguments", () => {
      const errors = validateDocuments(`
      fragment FragmentWithFieldArgument on Foo {
        bar(az: true)
      }
      `)
      expect(errors).toContainEqual(
        expect.objectContaining({
          message: `Unknown argument "az" on field "bar" of type "Foo".`,
        })
      )
    })

    it("validates directive arguments", () => {
      const errors = validateDocuments(`
        fragment FragmentWithDirectiveArgument on Foo {
          ...OtherFragment @relay(ask: true)
        }
        fragment OtherFragment on Foo {
          bar
        }
        `)
      expect(errors).toContainEqual(
        expect.objectContaining({
          message: `Unknown argument "ask" on directive "@relay". Did you mean "mask"?`,
        })
      )
    })
  })

  describe("concerning fragment argument definitions", () => {
    it("validates that argument definitions get a list", () => {
      const errors = validateDocuments(`
        fragment FragmentWithoutArguments on Foo @argumentDefinitions {
          bar
        }
      `)
      expect(errors).toContainEqual(
        expect.objectContaining({
          message: `Missing required argument definitions.`,
        })
      )
    })

    it("validates that argument definitions exist", () => {
      const errors = validateDocuments(`
        fragment FragmentWithoutArguments on Foo {
          bar
        }

        fragment FragmentSpreadWithArguments on Foo {
          ...FragmentWithoutArguments @arguments(someArgument: "something")
        }
      `)
      expect(errors).toContainEqual(
        expect.objectContaining({
          message: `No fragment argument definitions exist for fragment "FragmentWithoutArguments".`,
        })
      )
    })

    it("validates that the argument definition is an object", () => {
      const errors = validateDocuments(`
        fragment FragmentWithArguments on Foo @argumentDefinitions(
          requiredArgument: true
        ) {
          bar
        }
      `)
      expect(errors).toContainEqual(
        expect.objectContaining({
          message: `Metadata of argument definition should be of type "Object" with a "type" and optional "defaultValue" key.`,
        })
      )
    })

    it("validates that a `type` is specified", () => {
      const errors = validateDocuments(`
        fragment FragmentWithArguments on Foo @argumentDefinitions(
          requiredArgument: {}
        ) {
          bar
        }
      `)
      expect(errors).toContainEqual(
        expect.objectContaining({
          message: `Metadata of argument definition should be of type "Object" with a "type" and optional "defaultValue" key.`,
        })
      )
    })

    it("validates that no unknown fields exist in metadata", () => {
      const errors = validateDocuments(`
        fragment FragmentWithArguments on Foo @argumentDefinitions(
          requiredArgument: { type: "String", foo: true }
        ) {
          bar
        }
      `)
      expect(errors).toContainEqual(
        expect.objectContaining({
          message: `Unknown key "foo" in argument definition metadata.`,
        })
      )
    })

    it("validates that the type is specified as a string value", () => {
      const errors = validateDocuments(`
        fragment FragmentWithArguments on Foo @argumentDefinitions(
          argumentWithTypeAsLiteral: { type: Foo }
        ) {
          bar
        }
      `)
      expect(errors).toContainEqual(
        expect.objectContaining({
          message: `Value for "type" in argument definition metadata must be specified as string literal.`,
        })
      )
    })

    it("validates that the defaultValue contains no variables", () => {
      const errors = validateDocuments(`
        fragment FragmentWithArguments on Foo @argumentDefinitions(
          argumentWithTypeAsLiteral: { type: "Foo", defaultValue: [$myVar] }
        ) {
          bar
        }
      `)
      expect(errors).toContainEqual(
        expect.objectContaining({
          message: `Value for "type" in argument definition metadata must be specified as string literal.`,
        })
      )
    })

    it("validates that the type is valid", () => {
      const errors = validateDocuments(`
        fragment FragmentWithArguments on Foo @argumentDefinitions(
          argumentWithTypeAsEnumValue: { type: "Bar" }
          argumentWithTypeAsEnumValueList: { type: "[Baz]" }
          argumentWithTypeAsNonEnumValue: { type: "10" }
        ) {
          bar
        }
      `)
      expect(errors).toContainEqual(
        expect.objectContaining({
          message: `Unknown type "Bar" in argument definition metadata.`,
        })
      )
      expect(errors).toContainEqual(
        expect.objectContaining({
          message: `Unknown type "Baz" in argument definition metadata.`,
        })
      )
      expect(errors).toContainEqual(
        expect.objectContaining({
          message: `Syntax Error: Expected Name, found Int "10"`,
        })
      )
    })

    it.todo("validates that the defaultValue matches type")
  })

  describe("concerning fragment arguments", () => {
    it("validates that required arguments exist in list", () => {
      const errors = validateDocuments(`
        fragment FragmentWithArguments on Foo @argumentDefinitions(
          requiredArgument: { type: "String!" }
          optionalArgument: { type: "String", defaultValue: "something" }
        ) {
          bar
        }

        fragment FragmentSpreadWithMissingArgument on Foo {
          ...FragmentWithArguments @arguments(optionalArgument: "something")
        }
      `)
      expect(errors).toContainEqual(
        expect.objectContaining({ message: `Missing required fragment argument "requiredArgument".` })
      )
    })

    it("considers nullable arguments as optional", () => {
      const errors = validateDocuments(`
        fragment FragmentWithArguments on Foo @argumentDefinitions(
          requiredArgument: { type: "String!" }
          optionalArgument: { type: "String" }
        ) {
          bar
        }

        fragment FragmentSpreadWithMissingArgument on Foo {
          ...FragmentWithArguments @arguments(requiredArgument: "something")
        }
      `)
      expect(errors).toEqual([])
    })

    it("validates required arguments when no list is given", () => {
      const errors = validateDocuments(`
        fragment FragmentWithArguments on Foo @argumentDefinitions(
          requiredArgument: { type: "String!" }
        ) {
          bar
        }

        fragment FragmentSpreadWithMissingArgument on Foo {
          ...FragmentWithArguments @arguments
        }
      `)
      expect(errors).toContainEqual(
        expect.objectContaining({ message: `Missing required fragment argument "requiredArgument".` })
      )
    })

    it.only("validates required arguments when no @arguments directive is used", () => {
      const errors = validateDocuments(`
        fragment FragmentWithArguments on Foo @argumentDefinitions(
          requiredArgument: { type: "String!" }
        ) {
          bar
        }

        fragment FragmentSpreadWithMissingArgument on Foo {
          ...FragmentWithArguments
        }
      `)
      expect(errors).toContainEqual(
        expect.objectContaining({ message: `Missing required fragment argument "requiredArgument".` })
      )
    })

    it("suggests alternatives when argument is unknown", () => {
      const errors = validateDocuments(`
        fragment FragmentWithArguments on Foo @argumentDefinitions(
          requiredArgument: { type: "String!" }
        ) {
          bar
        }

        fragment FragmentSpreadWithMissingArgument on Foo {
          ...FragmentWithArguments @arguments(equiredArgument: "whoops")
        }
      `)
      expect(errors).toContainEqual(
        expect.objectContaining({
          message: `Unknown fragment argument "equiredArgument". Did you mean "requiredArgument"?`,
        })
      )
    })
  })
})
