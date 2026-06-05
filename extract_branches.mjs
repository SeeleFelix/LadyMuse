import { createReadStream } from "fs";
import { createInterface } from "readline";
import { createGunzip } from "zlib";

async function main() {
  const path = "/home/narcissus/Workspace/LadyMuse/data/aat/aat_full_2026-05-17.nt";

  // Pass 1: collect parent relationships and labels
  const parentOf = new Map(); // uri -> parentUri
  const labelOf = new Map(); // uri -> english label
  let lineCount = 0;

  const rs = createReadStream(path);
  const rl = createInterface({ input: rs });

  for await (const line of rl) {
    lineCount++;
    if (lineCount % 5000000 === 0) console.error(`  ${lineCount/1000000}M lines...`);

    const m = line.match(/^<([^>]+)> <([^>]+)> (.+) \.$/);
    if (!m) continue;
    const [, s, p, o] = m;

    if (p.includes("broaderPreferred")) {
      const pu = o.match(/^<([^>]+)>$/)?.[1];
      if (pu) parentOf.set(s, pu);
    }
    if (p.includes("prefLabel") && o.includes('@en')) {
      const label = o.match(/^"(.+)"@en/)?.[1];
      if (label && !labelOf.has(s)) labelOf.set(s, label);
    }
  }

  console.error(`Parsed ${lineCount} lines, ${labelOf.size} labels, ${parentOf.size} parents`);

  // Pass 2: build child counts by parent
  const childCount = new Map(); // parentUri -> count
  const childrenOf = new Map(); // parentUri -> [childUris]
  for (const [child, parent] of parentOf) {
    childCount.set(parent, (childCount.get(parent) || 0) + 1);
    if (!childrenOf.has(parent)) childrenOf.set(parent, []);
    childrenOf.get(parent).push(child);
  }

  // Pass 3: find hierarchy roots and print their tree
  const roots = [];
  for (const [uri, label] of labelOf) {
    if (label.includes("(hierarchy name)")) {
      const c = childCount.get(uri) || 0;
      roots.push({ uri, label, count: c });
    }
  }
  roots.sort((a, b) => b.count - a.count);

  for (const root of roots) {
    console.log(`\n=== ${root.label} (${root.count} children) ===`);
    const depth1 = childrenOf.get(root.uri) || [];
    for (const d1 of depth1.slice(0, 30)) {
      const d1Label = labelOf.get(d1) || d1;
      const d1Count = childCount.get(d1) || 0;
      console.log(`  ${d1Label} (${d1Count})`);
    }
    if (depth1.length > 30) console.log(`  ... and ${depth1.length - 30} more`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
