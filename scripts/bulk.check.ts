// Self-check for the bulk-add table parser. Run: node scripts/bulk.check.ts
import assert from "node:assert/strict";
import { parseBulk, parseSalary } from "../src/lib/bulk.ts";

const expected = [
  {
    company: "SpruceID",
    role: "Full-Stack Software Engineer (New Grad)",
    salary_min: 110,
    salary_max: 140,
    salary_currency: "USD",
    job_url: "https://jobs.ashbyhq.com/spruceid/3d182b7f",
    location: ["remote"],
    company_size: "11-50",
  },
  {
    company: "CLEAR",
    role: "Forward Deployed AI Engineer II",
    salary_min: 180,
    salary_max: 220,
    salary_currency: "USD",
    job_url: "https://job-boards.greenhouse.io/clear/jobs/8259786",
    location: ["nyc"],
    company_size: "1001-5000",
  },
];

// One cell per line (copied rendered table).
const lines = `Company
Role
Salary range
Job listing link
Location
Company size
SpruceID
Full-Stack Software Engineer (New Grad)
$110K–$140K + equity
https://jobs.ashbyhq.com/spruceid/3d182b7f
Remote (US)
11-50
CLEAR
Forward Deployed AI Engineer II
$180K–$220K total comp (incl. bonus + RSUs)
https://job-boards.greenhouse.io/clear/jobs/8259786
NYC (on-site)
1,001-5,000
`;
assert.deepEqual(parseBulk(lines), expected);

// Tab-separated, columns reordered by header.
const tsv = [
  "Role\tCompany\tLocation\tSalary range\tJob listing link\tCompany size",
  "Full-Stack Software Engineer (New Grad)\tSpruceID\tRemote (US)\t$110K–$140K + equity\thttps://jobs.ashbyhq.com/spruceid/3d182b7f\t11-50",
].join("\n");
assert.deepEqual(parseBulk(tsv), [expected[0]]);

// Markdown table.
const md = `| Company | Role | Salary range | Job listing link | Location | Company size |
|---|---|---|---|---|---|
| CLEAR | Forward Deployed AI Engineer II | $180K–$220K total comp (incl. bonus + RSUs) | https://job-boards.greenhouse.io/clear/jobs/8259786 | NYC (on-site) | 1001-5000 |`;
assert.deepEqual(parseBulk(md), [expected[1]]);

assert.deepEqual(parseSalary("$95,000"), [95, 95]);
assert.deepEqual(parseSalary("—"), [null, null]);

console.log("bulk ok");
