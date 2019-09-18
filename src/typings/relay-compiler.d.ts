declare module "relay-compiler" {
  const IRTransforms: any
}

declare module "relay-compiler/bin/RelayCompilerMain" {
  type PluginInitializer = () => PluginInterface

  interface PluginInterface {
    inputExtensions: string[]
    outputExtension: string
    // findGraphQLTags: GraphQLTagFinder;
    // formatModule: FormatModule;
    // typeGenerator: TypeGenerator;
  }

  function getLanguagePlugin(language: string | PluginInitializer): PluginInterface

  interface Config {
    schema: string
    src: string
    language: string | PluginInitializer
    exclude: string[]
  }
}
