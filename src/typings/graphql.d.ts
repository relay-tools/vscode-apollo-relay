declare module "graphql/jsutils/suggestionList" {
  function suggestionList(input: string, options: string[]): string[]
  export default suggestionList
}

declare module "graphql/jsutils/didYouMean" {
  function didYouMean(suggestions: string[]): string
  export default didYouMean
}
