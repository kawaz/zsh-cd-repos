import { cmdList } from "./list.ts";
import { cmdPreview } from "./preview.ts";
import { cmdSearch } from "./search.ts";

const [command = "search", ...args] = process.argv.slice(2);

switch (command) {
  case "list":
    await cmdList();
    break;
  case "preview":
    await cmdPreview(args[0] ?? "");
    break;
  case "search":
    await cmdSearch(args[0] ?? "");
    break;
  default:
    console.error(`Usage: cd-repos {list|preview|search}`);
    process.exit(1);
}
