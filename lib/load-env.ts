import { loadEnvConfig } from "@next/env";

let loaded = false;

export function loadLocalEnv() {
  if (!loaded) {
    loadEnvConfig(process.cwd());
    loaded = true;
  }
}
