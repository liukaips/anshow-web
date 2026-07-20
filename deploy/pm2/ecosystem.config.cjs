const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");
const envFile = path.join(root, ".env");

function parseEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  const result = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    let value = match[2] ?? "";
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result[match[1]] = value;
  }
  return result;
}

const fileEnv = parseEnvFile(envFile);
const backendEnv = {
  ...fileEnv,
  NODE_ENV: "production",
  PORT: fileEnv.PORT || "4000",
};

module.exports = {
  apps: [
    {
      name: "anshow-backend",
      cwd: path.join(root, "backend"),
      script: "dist/server.js",
      env: backendEnv,
      max_memory_restart: "768M",
      time: true,
    },
    {
      name: "anshow-worker",
      cwd: path.join(root, "backend"),
      script: "dist/worker/index.js",
      env: backendEnv,
      max_memory_restart: "512M",
      time: true,
    },
    {
      name: "anshow-frontend",
      cwd: path.join(root, "frontend/.next/standalone/frontend"),
      script: "server.js",
      env: {
        NODE_ENV: "production",
        HOSTNAME: "127.0.0.1",
        PORT: "3000",
        BACKEND_INTERNAL_URL: "http://127.0.0.1:4000",
        SITE_URL: fileEnv.SITE_URL,
      },
      max_memory_restart: "768M",
      time: true,
    },
  ],
};
