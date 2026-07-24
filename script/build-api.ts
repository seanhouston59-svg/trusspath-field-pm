import { build as esbuild } from "esbuild";
import { readFile, rm, mkdir, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";

// Bundle the Vercel serverless function so all sibling modules resolve.
// Node modules stay external — Vercel installs them.
async function buildApi() {
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const external = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
    "node:*",
  ];

  await esbuild({
    entryPoints: ["api-src/index.ts"],
    platform: "node",
    target: "node20",
    format: "cjs",
    bundle: true,
    outfile: "api/index.js",
    external,
    logLevel: "info",
    // Rewrite @shared alias
    alias: {
      "@shared": "./shared",
    },
  });

  // Ensure data.db sits next to the function for `includeFiles: data.db` to pick up.
  if (existsSync("data.db")) {
    if (!existsSync("api/data.db")) {
      await copyFile("data.db", "api/data.db");
    }
  }
}

buildApi().catch((err) => {
  console.error(err);
  process.exit(1);
});
