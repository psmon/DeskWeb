#!/usr/bin/env node
// Incremental BitMidi catalog collector ("확보 스킬").
//
// Grows the file-managed index `frontend/public/bitmidi.json` (the DB seed) by
// pulling NEW songs from bitmidi.com — at most MAX_NEW (default 1000) per run,
// so a single reinforcement pass stays bounded. A cursor persists between runs
// (.secure-catalog.state.json) so each run continues where the last stopped and
// eventually covers the whole ~113k-song upstream catalog over many passes.
//
// Genre is classified from a keyword profile built off the EXISTING index
// ("기존확보인덱스를 바탕으로") — obvious matches (mario→게임 …) get their genre,
// everything else lands in the 기타 (other) bucket.
//
// The MidiPlayer DB re-seeds from this grown JSON on its next start (hash-guarded,
// INSERT OR IGNORE) — no manual migration.
//
// Usage:  node scripts/secure-catalog.mjs [maxNew]
// Dead-link checking is intentionally out of scope here — securing comes first.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SEED = join(HERE, "..", "frontend", "public", "bitmidi.json");
const STATE = join(HERE, ".secure-catalog.state.json");

const MAX_NEW = Math.max(1, Math.min(1000, Number(process.argv[2]) || 1000)); // ≤1000/run
const MAX_PAGES = 400;        // safety bound on upstream requests per run
const REQ_DELAY_MS = 150;     // be polite to bitmidi.com
const UA = "midi-ani-player catalog collector (github.com/psmon/DeskWeb)";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- load existing index + state ------------------------------------------
const catalog = JSON.parse(readFileSync(SEED, "utf8"));
const haveUrls = new Set(catalog.map((e) => e.url));
const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : { nextPage: 0, totalSecured: 0 };

console.log(`기존 확보: ${catalog.length}곡 · 이번 목표: 최대 ${MAX_NEW}곡 · 시작 페이지 ${state.nextPage}`);

// ---- genre keyword profile from existing titles ---------------------------
const STOP = new Set(
  "the of a to and in on for no ver version full main remix ost mid midi theme song from with".split(" "),
);
const tokenize = (title) =>
  title.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !STOP.has(w));

const profile = {};       // genre -> word -> count
const globalFreq = {};    // word -> total count across all genres
for (const e of catalog) {
  const g = e.genre || "기타";
  (profile[g] ??= {});
  for (const w of tokenize(e.title)) {
    profile[g][w] = (profile[g][w] || 0) + 1;
    globalFreq[w] = (globalFreq[w] || 0) + 1;
  }
}

// A word's contribution to a genre = how concentrated it is in that genre.
// Sum over the title's words; the best-scoring genre wins if it clears a floor,
// otherwise the song goes to 기타.
function classify(title) {
  const words = tokenize(title);
  if (!words.length) return "기타";
  let best = "기타";
  let bestScore = 0;
  for (const g of Object.keys(profile)) {
    if (g === "기타") continue;
    let score = 0;
    for (const w of words) {
      const inGenre = profile[g][w] || 0;
      if (inGenre) score += inGenre / globalFreq[w]; // 0..1 specificity
    }
    if (score > bestScore) {
      bestScore = score;
      best = g;
    }
  }
  return bestScore >= 0.8 ? best : "기타";
}

// ---- pretty-ish title cleanup ---------------------------------------------
function cleanTitle(name) {
  let t = String(name).replace(/\.midi?$/i, "").replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return "Untitled";
  // Capitalise first letter of each word, leaving existing ALL-CAPS tokens alone.
  return t.replace(/\b([a-z])(\w*)/g, (_, a, b) => a.toUpperCase() + b);
}

async function fetchPageOnce(page) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000); // hard per-request timeout
  try {
    const res = await fetch(`https://bitmidi.com/api/midi/all?page=${page}`, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const j = await res.json();
    const r = j.result || j;
    return { rows: r.results || [], pageTotal: r.pageTotal ?? null };
  } finally {
    clearTimeout(t);
  }
}

// bitmidi.com throttles with sporadic 502s — retry with exponential backoff.
async function fetchPage(page, attempts = 4) {
  let wait = 800;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fetchPageOnce(page);
    } catch (e) {
      if (i === attempts) throw e;
      await sleep(wait);
      wait = Math.min(wait * 2, 8000);
    }
  }
  throw new Error("unreachable");
}

// ---- collect ---------------------------------------------------------------
const added = [];
const byGenre = {};
let page = state.nextPage;
let pagesThisRun = 0;
let pageTotal = null;

while (added.length < MAX_NEW && pagesThisRun < MAX_PAGES) {
  let data;
  try {
    data = await fetchPage(page);
  } catch (e) {
    console.warn(`  page ${page} 실패 (${e.message}) — 건너뜀`);
    page++;
    pagesThisRun++;
    if (pageTotal && page >= pageTotal) page = 0;
    continue;
  }
  pageTotal = data.pageTotal ?? pageTotal;

  for (const row of data.rows) {
    if (!row.downloadUrl) continue;
    const url = new URL(row.downloadUrl, "https://bitmidi.com").href;
    if (url.split("/")[2] !== "bitmidi.com") continue; // whitelist
    if (haveUrls.has(url)) continue;
    haveUrls.add(url);
    const title = cleanTitle(row.name || row.slug || "Untitled");
    const genre = classify(title);
    added.push({ title, genre, url });
    byGenre[genre] = (byGenre[genre] || 0) + 1;
    if (added.length >= MAX_NEW) break;
  }

  page++;
  pagesThisRun++;
  if (pageTotal && page >= pageTotal) page = 0; // wrap around the upstream catalog
  if (pagesThisRun % 25 === 0)
    console.log(`  …page ${page} · 신규 ${added.length}곡 (스캔 ${pagesThisRun}p)`);
  await sleep(REQ_DELAY_MS);
}

// ---- persist ---------------------------------------------------------------
if (added.length === 0) {
  console.log("신규 확보 0곡 (이미 확보된 구간). state만 갱신하고 종료.");
} else {
  const merged = catalog.concat(added);
  // Write one object per line — valid JSON, but git-diff friendly as it grows.
  const body = merged.map((e) => JSON.stringify(e)).join(",\n");
  writeFileSync(SEED, `[\n${body}\n]\n`);
}

writeFileSync(
  STATE,
  JSON.stringify(
    { nextPage: page, totalSecured: (state.totalSecured || 0) + added.length, lastAdded: added.length },
    null,
    2,
  ),
);

console.log(`\n✅ 신규 확보 ${added.length}곡 → 총 ${catalog.length + added.length}곡`);
console.log("   장르 분포:", JSON.stringify(byGenre));
console.log(`   다음 시작 페이지: ${page} (누적 확보 ${(state.totalSecured || 0) + added.length}곡)`);
console.log("   반영: 미디플레이어 재시작 시 DB가 자동 재시드(INSERT OR IGNORE)됩니다.");
