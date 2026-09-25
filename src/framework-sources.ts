/**
 * Attest — the framework texts WP6 cites, fetched from their primary sources (D3.60).
 *
 * `attest framework-sources` downloads NIST's own machine-readable SP 800-53 Rev. 5
 * catalog (OSCAL JSON) and the eCFR's XML for 21 CFR Part 11, extracts the controls
 * and paragraphs WP6 names, and writes them verbatim to rubric/framework-sources.json
 * with the sha256 of every downloaded file. WP6 takes every quoted control statement
 * and regulation paragraph from that file, so no framework text in the mapping is
 * typed by hand, and validate-wp6 refuses a mapping whose quoted text differs from it.
 *
 * The snapshot is pinned: re-running the command re-fetches, and a changed upstream
 * text shows up as a diff in version control rather than silently. The FDA CSA
 * guidance is a PDF; its identifying details are recorded here (title, dates, docket,
 * sha256 of the file read), and the CSA note paraphrases it with section references
 * rather than quoting it.
 *
 * This is a study exercise. Quoting a control is not a claim that Arc21 meets it.
 */
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ATTEST_ROOT } from "./config.ts";

export const FRAMEWORK_SOURCES_PATH = join(ATTEST_ROOT, "rubric", "framework-sources.json");

const NIST_CATALOG_URL = "https://raw.githubusercontent.com/usnistgov/oscal-content/main/nist.gov/SP800-53/rev5/json/NIST_SP-800-53_rev5_catalog.json";
const ECFR_TITLES_URL = "https://www.ecfr.gov/api/versioner/v1/titles.json";
const ecfrPart11Url = (date: string) => `https://www.ecfr.gov/api/versioner/v1/full/${date}/title-21.xml?part=11`;
const CSA_PAGE_URL = "https://www.fda.gov/regulatory-information/search-fda-guidance-documents/computer-software-assurance-production-and-quality-management-system-software";
const CSA_DOCUMENT_URL = "https://www.fda.gov/media/188844/download";

/** The controls WP6 considers: the brief's minimum set, plus three the evidence directly bears on. */
export const NIST_CONTROL_IDS = ["AC-2", "AC-3", "AC-6", "AC-24", "AU-2", "AU-3", "AU-9", "AU-12", "CM-3", "SI-7", "CA-2", "CA-7"] as const;
/** The Part 11 paragraphs WP6 considers (the brief's minimum set) and the definitions that bound them. */
export const PART11_PARAGRAPHS = ["11.3(b)(4)", "11.3(b)(6)", "11.10", "11.10(d)", "11.10(e)", "11.10(g)", "11.300", "11.300(a)", "11.300(b)", "11.300(c)", "11.300(d)", "11.300(e)"] as const;

export interface FrameworkSources {
  readonly WARNING: string;
  readonly retrievedOn: string;
  readonly nist: {
    readonly source: string; readonly catalogTitle: string; readonly catalogVersion: string; readonly lastModified: string; readonly sha256: string;
    readonly controls: Readonly<Record<string, { readonly title: string; readonly statement: readonly string[] }>>;
  };
  readonly part11: {
    readonly source: string; readonly pointInTime: string; readonly sha256: string;
    readonly paragraphs: Readonly<Record<string, { readonly heading: string; readonly text: string }>>;
  };
  readonly csa: {
    readonly title: string; readonly issued: string; readonly supersedes: string; readonly docket: string;
    readonly page: string; readonly document: string; readonly sha256: string; readonly framework: readonly string[];
    readonly note: string;
  };
}

const sha256 = (b: Uint8Array | string): string => createHash("sha256").update(b).digest("hex");

async function get(url: string): Promise<Uint8Array> {
  const res = await fetch(url, { headers: { "user-agent": "attest-framework-sources (study exercise)" } });
  if (!res.ok) throw new Error(`GET ${url} → HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

type Oscal = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** A control's statement as NIST prints it: labelled items, parameters in brackets. */
export function renderOscalStatement(control: Oscal): string[] {
  const labels = new Map<string, string>();
  for (const p of (control.params ?? []) as Oscal[]) {
    if (p.select) labels.set(p.id, `[Selection (${p.select["how-many"] ?? "one"}): ${(p.select.choice as string[] ?? []).join("; ")}]`);
    else labels.set(p.id, `[Assignment: ${p.label ?? p.id}]`);
  }
  const insert = (s: string): string => s.replace(/\{\{\s*insert: param,\s*([^}\s]+)\s*\}\}/g, (_m, id: string) => labels.get(id) ?? `[${id}]`);
  // Selections may themselves reference parameters.
  for (const [k, v] of labels) labels.set(k, insert(v));
  const out: string[] = [];
  const walk = (parts: Oscal[], depth: number): void => {
    for (const pt of parts) {
      if (pt.name !== "statement" && pt.name !== "item") continue;
      const label = ((pt.props ?? []) as Oscal[]).find((x) => x.name === "label")?.value as string | undefined;
      const prose = insert(String(pt.prose ?? "")).replace(/\]\(#[^)]*\)/g, "").replace(/\[([A-Z]{2}-\d+[a-z.]*)/g, "$1").trim();
      if (prose || label) out.push(`${"  ".repeat(depth)}${label ? `${label} ` : ""}${prose}`.trimEnd());
      walk((pt.parts ?? []) as Oscal[], pt.name === "statement" ? depth : depth + 1);
    }
  };
  walk((control.parts ?? []) as Oscal[], 0);
  return out;
}

/** Plain text of an eCFR XML fragment. */
function xmlText(x: string): string {
  return x.replace(/<[^>]+>/g, "").replace(/&#x([0-9a-f]+);/gi, (_m, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&quot;/g, "\"").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
}

export function extractPart11(xml: string): Record<string, { heading: string; text: string }> {
  const out: Record<string, { heading: string; text: string }> = {};
  const section = (n: string) => {
    const m = new RegExp(`<DIV8 N="${n.replace(".", "\\.")}"[^>]*>([\\s\\S]*?)</DIV8>`).exec(xml);
    if (!m) throw new Error(`eCFR: § ${n} not found`);
    const heading = xmlText(/<HEAD>([\s\S]*?)<\/HEAD>/.exec(m[1]!)?.[1] ?? "");
    const paras = [...m[1]!.matchAll(/<P>([\s\S]*?)<\/P>/g)].map((p) => xmlText(p[1]!));
    return { heading, paras };
  };
  const s3 = section("11.3");
  for (const [key, lead] of [["11.3(b)(4)", "(4) Closed system"], ["11.3(b)(6)", "(6) Electronic record"]] as const) {
    const t = s3.paras.find((p) => p.startsWith(lead));
    if (!t) throw new Error(`eCFR: ${key} not found`);
    out[key] = { heading: s3.heading, text: t };
  }
  for (const n of ["11.10", "11.300"]) {
    const s = section(n);
    out[n] = { heading: s.heading, text: s.paras[0]! };
    for (const p of s.paras.slice(1)) {
      const m = /^\(([a-z])\)/.exec(p);
      if (m) out[`${n}(${m[1]})`] = { heading: s.heading, text: p };
    }
  }
  for (const k of PART11_PARAGRAPHS) if (!out[k]) throw new Error(`eCFR: ${k} not extracted`);
  return Object.fromEntries(PART11_PARAGRAPHS.map((k) => [k, out[k]!]));
}

export async function fetchFrameworkSources(log: (s: string) => void): Promise<FrameworkSources> {
  log(`  NIST SP 800-53 Rev. 5 catalog (OSCAL): ${NIST_CATALOG_URL}`);
  const nistBytes = await get(NIST_CATALOG_URL);
  const catalog = (JSON.parse(new TextDecoder().decode(nistBytes)) as Oscal).catalog as Oscal;
  const byId = new Map<string, Oscal>();
  const walk = (c: Oscal): void => { byId.set(String(c.id), c); for (const s of (c.controls ?? []) as Oscal[]) walk(s); };
  for (const g of catalog.groups as Oscal[]) for (const c of (g.controls ?? []) as Oscal[]) walk(c);
  const controls: Record<string, { title: string; statement: string[] }> = {};
  for (const id of NIST_CONTROL_IDS) {
    const c = byId.get(id.toLowerCase());
    if (!c) throw new Error(`NIST catalog: ${id} not found`);
    controls[id] = { title: String(c.title), statement: renderOscalStatement(c) };
  }

  const titles = JSON.parse(new TextDecoder().decode(await get(ECFR_TITLES_URL))) as { titles: { number: number; latest_issue_date: string }[] };
  const date = titles.titles.find((t) => t.number === 21)?.latest_issue_date;
  if (!date) throw new Error("eCFR: no latest issue date for title 21");
  log(`  21 CFR Part 11 (eCFR, as of ${date}): ${ecfrPart11Url(date)}`);
  const ecfrBytes = await get(ecfrPart11Url(date));
  const paragraphs = extractPart11(new TextDecoder().decode(ecfrBytes));

  log(`  FDA CSA guidance: ${CSA_DOCUMENT_URL}`);
  const csaBytes = await get(CSA_DOCUMENT_URL);

  return {
    WARNING: "Generated by `npm run attest framework-sources` from the primary sources below and never edited by hand. The NIST control statements and the Part 11 paragraphs are verbatim; NIST's parameters are shown in brackets as NIST prints them. WP6 quotes only from this file. Quoting a control or a regulation is not a claim that Arc21, or anyone, meets it: WP6 is a study exercise.",
    retrievedOn: new Date().toISOString().slice(0, 10),
    nist: {
      source: NIST_CATALOG_URL,
      catalogTitle: String(catalog.metadata?.title ?? ""),
      catalogVersion: String(catalog.metadata?.version ?? ""),
      lastModified: String(catalog.metadata?.["last-modified"] ?? ""),
      sha256: sha256(nistBytes),
      controls,
    },
    part11: { source: ecfrPart11Url(date), pointInTime: date, sha256: sha256(ecfrBytes), paragraphs },
    csa: {
      title: "Computer Software Assurance for Production and Quality Management System Software — Guidance for Industry and Food and Drug Administration Staff",
      issued: "February 3, 2026",
      supersedes: "\"Computer Software Assurance for Production and Quality System Software,\" issued September 24, 2025",
      docket: "FDA-2022-D-0795",
      page: CSA_PAGE_URL,
      document: CSA_DOCUMENT_URL,
      sha256: sha256(csaBytes),
      framework: [
        "V.A(1) Identifying the Intended Use",
        "V.A(2) Determining the Risk-Based Approach",
        "V.A(3) Production or Quality Management System Software Changes",
        "V.A(4) Determining the Appropriate Assurance Activities",
        "V.A(5) Additional Considerations for Assurance Activities",
        "V.A(6) Establishing the Appropriate Record",
      ],
      note: "Identifying details and section headings transcribed from the document whose sha256 is recorded here (a PDF, read on the retrieval date). The guidance is nonbinding and addresses medical device manufacturers' production and quality management system software; Arc21 is neither.",
    },
  };
}

export async function writeFrameworkSources(log: (s: string) => void): Promise<FrameworkSources> {
  const s = await fetchFrameworkSources(log);
  await writeFile(FRAMEWORK_SOURCES_PATH, JSON.stringify(s, null, 2) + "\n");
  log(`  ${Object.keys(s.nist.controls).length} NIST controls (catalog ${s.nist.catalogVersion}), ${Object.keys(s.part11.paragraphs).length} Part 11 paragraphs (as of ${s.part11.pointInTime}), CSA guidance recorded`);
  log(`  written to rubric/framework-sources.json`);
  return s;
}
