import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
const registry = new Map();
function walk(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
    );
}
function record(text, group) {
  if (!text.trim() || !/[\p{L}]/u.test(text)) return;
  if (!registry.has(text)) registry.set(text, new Set());
  registry.get(text).add(group);
}
for (const file of [
  ...walk("src/app"),
  ...walk("src/components"),
  ...walk("src/config"),
  ...walk("src/lib/checkout"),
  ...walk("src/lib/payments"),
].filter((f) => /\.tsx?$/.test(f) && !/[\\/](admin|cms)[\\/]/.test(f))) {
  const source = fs.readFileSync(file, "utf8");
  const tree = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const group = file
    .replaceAll("\\", "/")
    .replace(/^src\/(app|components|config)\//, "")
    .replace(/\/page\.tsx$|\.tsx?$/g, "")
    .replaceAll("/", " · ");
  function visit(n) {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      const text = n.text,
        p = n.parent;
      let allowed = false;
      if (
        ts.isPropertyAssignment(p) &&
        [
          "label",
          "error",
          "title",
          "question",
          "answer",
          "heading",
          "text",
          "description",
          "name",
          "supportEmail",
          "default",
        ].includes(p.name.getText(tree).replaceAll('"', ""))
      )
        allowed = true;
      if (
        ts.isJsxExpression(p) &&
        ts.isJsxAttribute(p.parent) &&
        p.parent.name.getText(tree) === "text"
      )
        allowed = true;
      if (
        ts.isJsxAttribute(p) &&
        [
          "placeholder",
          "alt",
          "title",
          "label",
          "error",
          "category",
          "current",
        ].includes(p.name.getText(tree))
      )
        allowed = true;
      if (
        /^src\/lib\/(checkout|payments)\//.test(file.replaceAll("\\", "/")) &&
        text.length > 20 &&
        text.includes(" ")
      )
        allowed = true;
      if (ts.isBinaryExpression(p) || ts.isConditionalExpression(p))
        allowed = true;
      if (
        allowed &&
        text.length <= 8000 &&
        !/^https?:|^\/|^[.#]|^[a-z]+:[a-z]/.test(text)
      )
        record(text, group);
    }
    ts.forEachChild(n, visit);
  }
  visit(tree);
}
fs.writeFileSync(
  "src/data/cms-copy.generated.json",
  JSON.stringify(
    [...registry]
      .map(([text, groups]) => ({ text, groups: [...groups].sort() }))
      .sort(
        (a, b) =>
          a.groups[0].localeCompare(b.groups[0]) ||
          a.text.localeCompare(b.text),
      ),
    null,
    2,
  ) + "\n",
);
console.log(`${registry.size} editable storefront text entries.`);
