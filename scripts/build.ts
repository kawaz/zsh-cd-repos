import { $ } from "bun";
import { mkdirSync } from "node:fs";

const SHEBANG =
  "#!/bin/sh\n':' //; b=$(command -v bun) && exec \"$b\" --bun \"$0\" \"$@\"; exec node \"$0\" \"$@\"\n";
const OUTDIR = "bin";
const OUTFILE = `${OUTDIR}/cd-repos`;
const ENTRYPOINT = "src/cli.ts";

mkdirSync(OUTDIR, { recursive: true });

const jsFile = `${OUTFILE}.js`;

const result = await Bun.build({
  entrypoints: [ENTRYPOINT],
  outdir: OUTDIR,
  naming: "cd-repos.js",
  target: "node",
});

if (!result.success) {
  console.error("Build failed: cd-repos");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

let text = await Bun.file(jsFile).text();
text = text.replace(/^#!.*\n/, "");
await Bun.write(OUTFILE, SHEBANG + text);
await $`rm -f ${jsFile}`;
await $`chmod +x ${OUTFILE}`;

console.log(`Built: ${OUTFILE}`);
