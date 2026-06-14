#!/usr/bin/env node
/**
 * i18n drift detector.
 *
 * Scans `src/lib/i18n.js` for declared keys per language and `src/**\/{*.js,*.jsx}`
 * for `t("section.key")` call sites, then reports:
 *   - missing keys (used in code but not declared)
 *   - language asymmetry (declared in one lang but not the other)
 *
 * Runs as `node scripts/audit-i18n.js` from the frontend dir. Exits non-zero on
 * findings so it can gate CI / pre-commit. Dead keys are reported as warnings
 * only (we deliberately keep some `common.*` primitives as a vocabulary library).
 *
 * No build deps — uses only Node stdlib + a small new-Function eval of i18n.js.
 */
const fs = require("fs");
const path = require("path");

const FRONTEND_ROOT = path.resolve(__dirname, "..");
const I18N_PATH = path.join(FRONTEND_ROOT, "src/lib/i18n.js");
const SRC_ROOT = path.join(FRONTEND_ROOT, "src");

// Sections that count as i18n keys (filters out incidental "router.push" etc).
const SECTIONS = new Set([
  "nav", "common", "login", "dashboard", "employee", "attendance",
  "performance", "leave", "overtime", "shifts", "settings",
]);

// Generic primitives we keep around even when unused — they're a vocabulary
// library that pages will pick up over time. Listed here so we don't warn.
const ALLOWED_DEAD = new Set([
  "common.action", "common.cancel", "common.loading", "common.noData",
  "common.save", "common.search",
]);

function loadTranslations() {
  const code = fs.readFileSync(I18N_PATH, "utf8");
  const stripped = code
    .replace(/export\s+const\s+translations/, "const translations")
    .replace(/export\s+function\s+t/, "function t");
  const wrapper = stripped + "\n; module.exports = { translations };";
  const m = { exports: {} };
  // eslint-disable-next-line no-new-func
  new Function("module", "exports", "require", wrapper)(m, m.exports, require);
  return m.exports.translations;
}

function flatten(obj, prefix = "") {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(out, flatten(v, key));
    } else {
      out[key] = v;
    }
  }
  return out;
}

function walk(dir, exts) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      out.push(...walk(full, exts));
    } else if (exts.some((e) => entry.name.endsWith(e))) {
      out.push(full);
    }
  }
  return out;
}

function findUsedKeys() {
  const used = new Map(); // key -> [files]
  const re = /\bt\s*\(\s*(?:[a-zA-Z_$][\w$]*\s*,\s*)?["']([\w.\-]+)["']\s*\)/g;
  for (const file of walk(SRC_ROOT, [".js", ".jsx"])) {
    const text = fs.readFileSync(file, "utf8");
    let m;
    while ((m = re.exec(text)) !== null) {
      const key = m[1];
      if (!key.includes(".")) continue;
      if (!SECTIONS.has(key.split(".")[0])) continue;
      const list = used.get(key) || [];
      list.push(path.relative(FRONTEND_ROOT, file));
      used.set(key, list);
    }
  }
  return used;
}

function main() {
  const translations = loadTranslations();
  const langs = Object.keys(translations);
  const flatByLang = Object.fromEntries(
    langs.map((l) => [l, flatten(translations[l])])
  );
  const used = findUsedKeys();

  let errors = 0;
  let warnings = 0;

  // 1. Missing keys (used but not declared in any lang)
  for (const lang of langs) {
    const declared = new Set(Object.keys(flatByLang[lang]));
    const missing = [...used.keys()].filter((k) => !declared.has(k)).sort();
    if (missing.length) {
      errors += missing.length;
      console.error(`\n✖ Missing in lang="${lang}" (${missing.length}):`);
      for (const k of missing) {
        console.error(`    ${k}  used in: ${used.get(k)[0]}`);
      }
    }
  }

  // 2. Asymmetry between langs (declared in one, missing in another)
  if (langs.length === 2) {
    const [a, b] = langs;
    const setA = new Set(Object.keys(flatByLang[a]));
    const setB = new Set(Object.keys(flatByLang[b]));
    const onlyA = [...setA].filter((k) => !setB.has(k)).sort();
    const onlyB = [...setB].filter((k) => !setA.has(k)).sort();
    if (onlyA.length) {
      errors += onlyA.length;
      console.error(`\n✖ In "${a}" but not "${b}" (${onlyA.length}):`);
      onlyA.forEach((k) => console.error(`    ${k}`));
    }
    if (onlyB.length) {
      errors += onlyB.length;
      console.error(`\n✖ In "${b}" but not "${a}" (${onlyB.length}):`);
      onlyB.forEach((k) => console.error(`    ${k}`));
    }
  }

  // 3. Dead keys (declared in lang but never used). Warning only.
  const lang0 = langs[0];
  const declared0 = new Set(Object.keys(flatByLang[lang0]));
  const dead = [...declared0].filter(
    (k) => !used.has(k) && !ALLOWED_DEAD.has(k)
  ).sort();
  if (dead.length) {
    warnings += dead.length;
    console.warn(`\n⚠ Dead keys in "${lang0}" (${dead.length}, declared but unused):`);
    dead.forEach((k) => console.warn(`    ${k}`));
  }

  // Summary
  const counts = langs.map((l) => `${l}=${Object.keys(flatByLang[l]).length}`).join(", ");
  console.log(`\ni18n audit: ${counts}; used=${used.size}; errors=${errors}; warnings=${warnings}`);
  if (errors > 0) process.exit(1);
}

main();
