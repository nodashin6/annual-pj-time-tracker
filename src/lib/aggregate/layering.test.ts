import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

// ESM で動くため __dirname は使えない。
const DIR = fileURLToPath(new URL(".", import.meta.url));

const read = (file: string) => readFileSync(join(DIR, file), "utf8");

/** import 文だけを抜き出す(コメント中の言及を拾わないため)。 */
const importLines = (src: string): string[] =>
  src.split("\n").filter((l) => /^\s*import\s/.test(l));

describe("層の依存の向き", () => {
  const CORE_FILES = ["tree.ts", "plan.ts"];

  for (const file of CORE_FILES) {
    it(`${file} は progress.ts を import しない`, () => {
      const imports = importLines(read(file)).join("\n");
      expect(imports).not.toMatch(/["']\.\/progress["']/);
    });

    it(`${file} は TaskEntry を import しない`, () => {
      const imports = importLines(read(file)).join("\n");
      expect(imports).not.toMatch(/\bTaskEntry\b/);
    });
  }

  it("progress.ts はコア層を import してよい(向きが逆でないことの確認)", () => {
    const imports = importLines(read("progress.ts")).join("\n");
    expect(imports).toMatch(/["']\.\/tree["']/);
    expect(imports).toMatch(/["']\.\/plan["']/);
  });
});
