declare module "relay-config" {
  import { Config } from "relay-compiler/lib/RelayCompilerMain"

  function loadConfig(): undefined | Config
}
