import { build } from "esbuild";

await build({
  entryPoints: ["src/action.ts"],
  outfile: "dist/action.cjs",
  bundle: true,
  platform: "node",
  target: "node24",
  format: "cjs",
  sourcemap: false,
  minify: false,
  banner: { js: "// FailSift GitHub Action bundle" }
});
