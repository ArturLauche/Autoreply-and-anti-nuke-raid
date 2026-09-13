/**
 * check-env-vars.cjs — Liệt kê mọi biến môi trường mà code tham chiếu
 * (process.env.X / import.meta.env.X). CHỈ đọc tên biến trong mã nguồn,
 * KHÔNG bao giờ đọc giá trị env thật. Chạy: node scripts/check-env-vars.cjs
 */
const fs = require("fs");
const path = require("path");

const roots = ["convex", "bot/src", "src", "scripts"].filter((d) => fs.existsSync(d));
const found = new Map(); // TÊN BIẾN -> danh sách file

function walk(dir) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "_generated") continue;
      walk(p);
    } else if (/\.(ts|tsx|js|cjs|mjs)$/.test(e.name)) {
      const abs = path.resolve(p);
      if (abs === path.resolve(__filename)) continue; // bỏ qua chính script này (tránh tự khớp regex)
      const src = fs.readFileSync(p, "utf8");
      for (const m of src.matchAll(/process\.env\.([A-Z_][A-Z0-9_]*)/g)) {
        const list = found.get(m[1]) ?? [];
        list.push(p);
        found.set(m[1], list);
      }
      for (const m of src.matchAll(/import\.meta\.env\.([A-Z_][A-Z0-9_]*)/g)) {
        const name = `VITE_${m[1].replace(/^VITE_/, "")}`;
        const list = found.get(name) ?? [];
        list.push(p);
        found.set(name, list);
      }
    }
  }
}

for (const r of roots) walk(r);

const names = [...found.keys()].sort();
console.log(`Tìm thấy ${names.length} biến môi trường được tham chiếu trong mã nguồn:\n`);
for (const n of names) {
  const files = [...new Set(found.get(n))];
  console.log(`  ${n.padEnd(24)} (${files.length} file)  ví dụ: ${files[0]}`);
}

// Đối chiếu với tài liệu env của bot (nếu có) — chỉ tên, không giá trị.
const botReadme = path.join("bot", "README.md");
if (fs.existsSync(botReadme)) {
  const doc = fs.readFileSync(botReadme, "utf8");
  const missingInDoc = names.filter(
    (n) => !n.startsWith("VITE_") && !doc.includes(n) && !n.startsWith("npm_"),
  );
  if (missingInDoc.length) {
    console.log("\n⚠️ Các biến CHƯA được ghi trong bot/README.md (cân nhắc thêm tài liệu):");
    for (const n of missingInDoc) console.log(`  - ${n}`);
  } else {
    console.log("\n✅ Mọi biến env của bot đều đã có trong bot/README.md.");
  }
}
