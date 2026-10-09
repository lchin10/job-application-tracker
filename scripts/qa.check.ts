// Self-check for the notes Q&A parser. Run: node scripts/qa.check.ts
import assert from "node:assert/strict";
import { parseQA, formatQA } from "../src/lib/qa.ts";

const notes = `Referred by Sam.

Q: Why do you want to work here?
Tags: why us, videonest, Made Up
A: I love the product.

Second paragraph.
q: Describe a hard project
At Celeri I built...`;

const { intro, items } = parseQA(notes);
assert.equal(intro, "Referred by Sam.");
assert.equal(items.length, 2);
assert.deepEqual(items[0], {
  q: "Why do you want to work here?",
  tags: ["Why us", "VideoNest", "Made Up"],
  a: "I love the product.\n\nSecond paragraph.",
});
assert.deepEqual(items[1], { q: "Describe a hard project", tags: [], a: "At Celeri I built..." });

// Round trip is stable.
const out = formatQA(intro, items);
assert.deepEqual(parseQA(out), { intro, items });
assert.equal(formatQA(parseQA(out).intro, parseQA(out).items), out);

// No Q: lines = plain intro only.
assert.deepEqual(parseQA("just an answer\nline 2"), { intro: "just an answer\nline 2", items: [] });
assert.deepEqual(parseQA(null), { intro: "", items: [] });

console.log("qa ok");
