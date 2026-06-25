import { getAuthCredentials, validateCredentials } from "../lib/auth";
import { loadLocalEnv } from "../lib/load-env";
import { validateStaffLogin } from "../lib/repositories";

loadLocalEnv();

async function main() {
  const username = process.argv[2] ?? process.env.VSC_AUTH_USERNAME ?? "admin";
  const password = process.argv[3] ?? process.env.VSC_AUTH_PASSWORD;

  if (!password) {
    throw new Error("Usage: npm run auth:check -- <username> <password>");
  }

  const credentials = getAuthCredentials();
  const staff = await validateStaffLogin(username, password);
  const fallback = validateCredentials(username.trim(), password);

  console.log(
    JSON.stringify(
      {
        username,
        envFallbackConfigured: Boolean(credentials.username && credentials.password),
        envFallbackUsername: credentials.username || null,
        staffLoginOk: Boolean(staff),
        staffRole: staff?.role ?? null,
        fallbackLoginOk: fallback,
        loginWouldPass: Boolean(staff || fallback),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
