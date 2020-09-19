import { LocalServiceConfig } from "apollo-language-server/lib/config"
import { ValidationRule } from "graphql/validation"
import { Config } from "relay-compiler/lib/bin/RelayCompilerMain"
import { generateConfig } from "../src/generateConfig"

jest.mock("cosmiconfig", () => () => ({
  searchSync: () => ({
    config: {
      schema: "path/to/schema.graphql",
      src: "path/to/src-root",
      exclude: ["path/to/exclude"],
    } as Config,
  }),
}))

describe(generateConfig, () => {
  xdescribe("when user does not use relay-config", () => {
    it("uses a default schema file", () => {
      jest.mock("relay-config", () => ({ loadConfig: () => null }))
      const config = generateConfig().config.client!.service as LocalServiceConfig
      expect(config.localSchemaFile).toEqual("./data/schema.graphql")
    })

    it("uses a default source root", () => {
      jest.mock("relay-config", () => ({ loadConfig: () => null }))
      const config = generateConfig().config.client!
      expect(config.includes).toEqual("./src/**/*.{graphql,js,jsx}")
    })
  })

  it("specifies the schema file", () => {
    const config = generateConfig().config.client!.service as LocalServiceConfig
    expect(config.localSchemaFile).toEqual("path/to/schema.graphql")
  })

  it("specifies the source files to include", () => {
    const config = generateConfig().config.client!
    expect(config.includes).toContain("path/to/src-root/**/*.{graphql,js,jsx}")
  })

  it("specifies the source files to exclude", () => {
    const config = generateConfig().config.client!
    expect(config.excludes).toContain("path/to/exclude")
  })

  it("excludes validation rules that are incompatible with Relay", () => {
    const config = generateConfig().config.client!
    const rules = config.validationRules as ValidationRule[]
    expect(rules.map(({ name }) => name)).not.toContain("NoUndefinedVariablesRule")
  })

  it("includes the RelayUnknownArgumentNames validation rule", () => {
    const config = generateConfig().config.client!
    const rules = config.validationRules as ValidationRule[]
    expect(rules.map(({ name }) => name)).toContain("RelayKnownArgumentNames")
  })

  it("specifies the relay-compiler directives dump to include", () => {
    const config = generateConfig().config.client!
    expect(config.includes).toContainEqual(expect.stringMatching(/relay-compiler-directives-v\d+\.\d+\.\d+/))
  })

  it.todo("specifies the source files to include with a different language plugin")
})
