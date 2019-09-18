declare module "relay-config" {
  import { Config } from "relay-compiler/bin/RelayCompilerMain"

  function loadConfig(): undefined | Config
}
