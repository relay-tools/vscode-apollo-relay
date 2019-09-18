declare module "relay-config" {
  import { Config } from "relay-compiler/lib/bin/RelayCompilerMain"

  function loadConfig(): undefined | Config
}
