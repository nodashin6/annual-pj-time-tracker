import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

// ESM で動くため __dirname は使えない。
const DIR = fileURLToPath(new URL(".", import.meta.url));

const read = (file: string) => readFileSync(join(DIR, file), "utf8");

/**
 * import 文だけを抜き出す(コメント中の言及を拾わないため)。
 * Prettier が長い named import を複数行に折り返しても拾えるよう、行単位ではなく
 * ソース全体に対して `import ... from "..."` をまたいでマッチする。
 */
const importStatements = (src: string): string => {
  const withoutComments = src
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
    .replace(/\/\/.*$/gm, ""); // line comments
  const matches = withoutComments.match(
    /import\s+[\s\S]*?from\s+["'][^"']*["']\s*;?/g
  );
  return (matches ?? []).join("\n");
};

describe("層の依存の向き", () => {
  const CORE_FILES = ["tree.ts", "plan.ts"];

  for (const file of CORE_FILES) {
    it(`${file} は progress.ts を import しない`, () => {
      const imports = importStatements(read(file));
      expect(imports).not.toMatch(/["']\.\/progress["']/);
    });

    it(`${file} は TaskEntry を import しない`, () => {
      const imports = importStatements(read(file));
      expect(imports).not.toMatch(/\bTaskEntry\b/);
    });
  }

  it("progress.ts はコア層を import してよい(向きが逆でないことの確認)", () => {
    const imports = importStatements(read("progress.ts"));
    expect(imports).toMatch(/["']\.\/tree["']/);
    expect(imports).toMatch(/["']\.\/plan["']/);
  });
});
