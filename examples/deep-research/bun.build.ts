import type { BuildConfig } from "bun";

const config: BuildConfig = {
  entrypoints: ["./src/ui/main.tsx"],
  outdir: "./dist/ui",
  target: "browser",
  format: "esm",
  splitting: true,
  minify: process.env.NODE_ENV === "production",
  sourcemap: "external",
  naming: {
    entry: "[dir]/[name].[ext]",
    chunk: "[name]-[hash].[ext]",
    asset: "assets/[name]-[hash].[ext]",
  },
  loader: {
    ".ogg": "dataurl",
    ".mp3": "dataurl",
    ".wav": "dataurl",
    ".png": "dataurl",
    ".jpg": "dataurl",
    ".jpeg": "dataurl",
    ".gif": "dataurl",
    ".svg": "dataurl",
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify(
      process.env.NODE_ENV || "development"
    ),
  },
};

// Build the UI
const result = await Bun.build(config);

if (!result.success) {
  console.error("Build failed:");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

console.log("Build successful!");
console.log(`Generated ${result.outputs.length} files`);
