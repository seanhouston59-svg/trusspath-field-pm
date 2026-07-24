import { build as esbuild } from "esbuild";
import { readFile, rm, mkdir, copyFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

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

  // Bundle seed photos into api/seed-photos so they're available at runtime on Vercel.
  const srcSeedDir = "server/seed-photos";
  if (existsSync(srcSeedDir)) {
    const dstSeedDir = "api/seed-photos";
    await mkdir(dstSeedDir, { recursive: true });
    const files = await readdir(srcSeedDir);
    for (const f of files) {
      await copyFile(join(srcSeedDir, f), join(dstSeedDir, f));
    }
  }
}

buildApi().catch((err) => {
  console.error(err);
  process.exit(1);
});
