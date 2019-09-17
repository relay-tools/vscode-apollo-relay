# vscode-apollo-relay

[![npm](https://img.shields.io/npm/v/vscode-apollo-relay.svg)](https://www.npmjs.com/package/vscode-apollo-relay)
[![build](https://img.shields.io/travis/relay-tools/vscode-apollo-relay/master.svg)](https://travis-ci.org/relay-tools/vscode-apollo-relay/builds)

Simple configuration of [vscode-apollo] for Relay projects.

Features:

- Read all user configuration from [relay-config], if the project is setup with it.
- Provides definitions for all Relay directives for validation and auto-completion purposes.
- Provides validation of `@argumentDefinitions` and `@arguments` directives.

[Changelog](https://github.com/relay-tools/vscode-apollo-relay/blob/master/CHANGELOG.md)

## Install

```sh
# using npm
npm install --save vscode-apollo-relay

# using yarn
yarn add vscode-apollo-relay
```

## Usage

In your `apollo.config.js` file:

```js
const { config } = require("vscode-apollo-relay").generateConfig()
module.exports = config
```

Or, if you don’t use [relay-config] and the default values don’t work for you:

```js
const path = require("path")
const {
  config,
  directivesFile,
  includesGlobPattern
} = require("vscode-apollo-relay").generateConfig()

module.exports = {
  client: {
    ...config.client,
    service: {
      ...config.client.service,
      localSchemaFile: "./path/to/schema.graphql",
    },
    includes: [
      directivesFile,
      path.join("./path/to/source", includesGlobPattern(["js", "jsx"]))
    ],
    excludes: ["./path/to/exclude"],
  }
}
```

### Compat

If you are still using the compatibility mode of Relay you can enable additional validation rules that only apply to Relay compat. `generateConfig` takes a `compat` boolean argument to enable these extra validation rules. Ie:

```js
const { config } = require("vscode-apollo-relay").generateConfig(/* compat: */ true)
module.exports = config
```

## Development

```sh
# lint
yarn run lint

# build
yarn run build

# test
yarn run test
```

## License

MIT © [Eloy Durán](https://github.com/alloy)

[vscode-apollo]: https://marketplace.visualstudio.com/items?itemName=apollographql.vscode-apollo
[relay-config]: https://relay.dev/docs/en/installation-and-setup#set-up-relay-with-a-single-config-file
