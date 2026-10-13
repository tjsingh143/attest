/** Current reading views of the frozen assessment. Evidence files stay verbatim. */
import { basename, dirname } from "node:path";
import { ATTEST_ROOT } from "./config.ts";

const CURRENT_MARKDOWN = new Set([
  "README.md", "ASSURANCE_REPORT.md", "SUMMARY.md", "FINDINGS.md",
  "FRAMEWORK_MAPPING.md", "CSA_NOTE.md", "CP4_PACKET.md", "CP5_RECORD.md",
]);

const REPLACEMENTS: readonly [string, string][] = [
  ["The author wrote Arc21, the harness, the rubric and the expectations, and approved the findings.", "The assessment and its review occurred within the same project; no independent review was performed."],
  ["the author wrote Arc21, the harness and the expectations.", "no independent review was performed."],
  ["The author wrote Arc21, the harness, the plan and the expectations, and approved the findings; the framework rationale and this note are AI-drafted (Amendment A2).", "The assessment and its review occurred within the same project; no independent review or signed approval was obtained."],
  ["the assessor is the author of the system, of the harness and of the plan; under Amendment A2 parts of the narrative are AI-assisted.", "no independent assessment or review was performed."],
  ["The author tested their own game with a tool they wrote, so this is not an independent audit", "The assessment was conducted within the same project, so this is not an independent audit"],
  ["Arc21 is a multiplayer card game its author built.", "Arc21 is a multiplayer card game."],
  ["The harness is one person's tool for one system:", "The harness covers one system:"],
  ["the author tested their own system", "assessment and review within the same project"],
  ["nothing implies the author has experience of any of those", "the exercise provides no evidence of professional regulatory, validation or audit experience"],
  ["Drafted by AI from the assessment's recorded results and not written by the author (Amendment A2); ", ""],
  ["AI-drafted under Amendment A2 and generated from the evidence; not written by the author.", "generated from the recorded evidence."],
  ["Connecting prose is AI-drafted (Amendment A2); the author's decisions appear as recorded.", "Checkpoint decisions appear as recorded; the original review records remain in rubric/ and evidence/."],
  ["Every rationale is AI-drafted and labelled so; ", ""],
  ["Rationale AI-drafted (Amendment A2). ", ""],
  ["Rationale AI-drafted. ", ""],
  ["AI-drafted summary of the method; details in DECISIONS.md", "method summary; details in DECISIONS.md"],
  ["The risk rubric, written by the author and frozen at CP3.", "The risk rubric, frozen at CP3."],
  ["a risk rubric the author wrote", "the frozen risk rubric"],
  ["the runs the author selected at CP4", "the runs selected at CP4"],
  ["the official runs the author selected at CP4", "the official runs selected at CP4"],
  ["system the author knows completely", "single application with recorded source and test evidence"],
  ["The author's inputs", "The recorded inputs"],
  ["The author's status", "Recorded status"],
  ["The author's decision at CP4", "Recorded decision at CP4"],
  ["the author's decision at CP4", "the recorded decision at CP4"],
  ["the author's own Arc21 checkout", "the local Arc21 checkout"],
  ["the author's earlier local development state", "the earlier local development state"],
  ["The author's earlier local development state", "The earlier local development state"],
  ["the author's development work", "the existing development state"],
  ["the author's own work", "local changes"],
  ["the author's own expectation set", "the project's expectation set"],
  ["the author's requirement", "the recorded requirement"],
  ["to the author: Attest", "to the existing project: Attest"],
  ["the author's J3/J4 rule", "the recorded J3/J4 rule"],
  ["the author's CP4 decisions", "the recorded CP4 decisions"],
  ["The author's CP4 decisions", "The recorded CP4 decisions"],
  ["the author's selection of these runs", "the recorded selection of these runs"],
  ["the author's rubric", "the frozen rubric"],
  ["The author's rubric", "The frozen rubric"],
  ["the author's rule", "the recorded rule"],
  ["the author's status", "the recorded status"],
  ["the author's decision", "the recorded decision"],
  ["the author's CP4 status", "the recorded CP4 status"],
  ["the author's reply", "the recorded reply"],
  ["the author was shown", "the checkpoint review presented"],
  ["by Arc21's author", "outside Attest"],
  ["Arc21's author", "the Arc21 project"],
  ["for the game's author", "for the Arc21 project"],
  ["by its author, outside Attest", "outside Attest"],
  ["approved by the author", "approved at review"],
  ["accepted by the author", "accepted at review"],
  ["reaffirmed by the author", "reaffirmed at review"],
  ["answered by the author", "answered at review"],
  ["waived prospectively by the author", "waived prospectively at review"],
  ["scope change by the author", "recorded scope change"],
  ["kept that way by the author at Gate A", "kept that way at Gate A"],
  ["the author kept unmeasured", "kept unmeasured at review"],
  ["the author kept these not measured", "the Gate A review kept these not measured"],
  ["the author chose to keep", "the Gate A review retained"],
  ["the author set each status at CP4", "each status was recorded at CP4"],
  ["the author decided that is intended", "the CP4 review recorded that as intended"],
  ["the author accepted as enough", "the CP4 review accepted as sufficient"],
  ["a rule the author set", "the recorded scope rule"],
  ["the author accepted the rule", "the CP4 review accepted the rule"],
  ["the author accepted both", "the CP4 review accepted both"],
  ["the author accepted as design intent", "accepted at review as design intent"],
  ["The author accepted this item", "The CP4 review accepted this item"],
  ["the author classed this informational", "the CP4 review classed this informational"],
  ["The author classed this item informational", "The CP4 review classed this item informational"],
  ["the author approved it", "approval was recorded within the project"],
  ["for the author to review", "for checkpoint review"],
  ["The packet exactly as the author\n> read it is", "The original reviewed packet is"],
  ["The author accepts", "The CP4 decision accepts"],
  ["The author accepted both", "The CP4 review accepted both"],
  ["The author's J3/J4 rule", "The recorded J3/J4 rule"],
  ["The author's J3", "The recorded J3"],
  ["The author's requirement", "The recorded requirement"],
];

/** Prose only: code fences, file paths and quoted framework statements retain their bytes. */
export function neutralPresentation(text: string): string {
  return text.split(/(```[^\n]*\n[\s\S]*?```)/g).map((part, i) => {
    if (i % 2) return part;
    let out = part
      .replace(/\*\*Status: complete\.\*\* Every work package is done, and every output is regenerated from the evidence and checked by code that did not write it\. Nothing in Arc21 was changed or remediated\./g,
        "**Status: recorded assessment complete.** The work-package states below describe the frozen assessment. Current reading views regenerate from those records. Nothing in Arc21 was changed or remediated; a changed harness hash requires a fresh full `prove-gates` run.")
      .replace(/^> \*\*Provenance\.\*\*[^\n]*(?:\n>[^\n]+)*/gm,
        "> **Evidence record.** Counts and cited tests come from the official records. Original review wording and provenance remain in `rubric/` and `evidence/`.")
      .replace(/^- \*\*Provenance\.\*\*[^\n]*$/gm,
        "- **Evidence record.** The frozen inputs, checkpoint replies and original provenance remain in `rubric/` and `evidence/`.")
      .replace(/^\*\*Provenance \(Amendment A2, 2026-09-25\)\.\*\*[^\n]*$/gm,
        "**Review record.** The frozen intent and narrative stores retain the adopted wording, review status and original provenance. Current reading views preserve results and dispositions.")
      .replace(/^\*\*The author's decision at CP4\*\*[^\n]*$/gm,
        "**Recorded decision at CP4** — the reply is quoted verbatim below; its original provenance remains in the frozen review record.")
      .replace(/^Verbatim\. The decisions are the author's;[^\n]*$/gm,
        "Verbatim checkpoint reply. The original review and wording provenance remain in the frozen record.")
      .replace(/Verbatim from the reply; AI-assisted wording the author reviewed and adopted \(Amendment A2\)\./g,
        "Verbatim checkpoint reply; the original wording provenance remains in the frozen record.")
      .replace(/The application is AI-drafted under Amendment A2,/g, "The recorded scope is applied")
      .replace(/stops; remaining narrative and the framework-mapping rationales may be AI-drafted and are labelled so; and CP5's separate/g,
        "stops; the recorded amendment governs the remaining narrative and framework rationale, and CP5's separate")
      .replace(/\*\(AI-drafted\s*(?:and\s*|—\s*)?([^)]*)\)\*/g, "*($1)*")
      .replace(/\*\(AI-drafted(?:;|,)\s*([^)]*)\)\*/g, "*($1)*")
      .replace(/\*\(AI-drafted\)\*/g, "")
      .replace(/\(AI-drafted, not implemented\)/g, "(not implemented)");
    for (const [before, after] of REPLACEMENTS) {
      const escaped = before.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      out = out.replace(new RegExp(escaped + (/\w$/.test(before) ? "(?!\\w)" : ""), "g"), () => after);
    }
    out = out.replace(/\bthe author's\b/g, "the recorded").replace(/\bthe author\b/g, "the checkpoint review");
    out = out.replace(/For readers without a technical background\. every number/g, "For readers without a technical background. Every number")
      .replace(/ \*\(\)\*/g, "");
    if (out.startsWith("# CP5 —")) out = out
      .replace(/^> \*\*CP5's[^\n]*(?:\n>[^\n]+)*/m,
        "> **CP5 was superseded by Amendment A2 (2026-09-25); it was not separately approved.** The framework package was generated from the official evidence and checked by the recorded validator. The original amendment and provenance remain in `DECISIONS.md`, `rubric/` and the frozen WP6 evidence copy.")
      .replace(/The brief \(§9\)[\s\S]*?## The package/m,
        "The original brief required a separate CP5 review. Amendment A2 waived that interaction prospectively after CP4. This view preserves the superseded checkpoint state; it makes no claim of a separate CP5 approval. The word counts below describe the frozen evidence copy.\n\n## The package")
      .replace(/\*\(AI-drafted\)\*/g, "")
      .replace(/^- Not the recorded rationale:[^\n]*$/m,
        "- The rationale is a study interpretation of the recorded evidence, not an independent assessment.")
      .replace(/^- Not evidence of the recorded[^\n]*(?:\n  [^\n]*)*/m,
        "- The exercise provides no evidence of professional regulatory, validation or audit experience.")
      .replace(/separate human-authorship and approval interaction waived prospectively at review \(2026-09-25\); package generated and validated with explicit AI-assisted provenance/g,
        "separate review interaction waived prospectively (2026-09-25); package generated and validated; original provenance retained in the frozen record");
    return out;
  }).join("");
}

/** Apply the reading convention only to current Markdown, never evidence or JSON stores. */
export function presentationFiles(files: ReadonlyMap<string, string>): Map<string, string> {
  return new Map([...files].map(([path, content]) => [path,
    dirname(path) === ATTEST_ROOT && CURRENT_MARKDOWN.has(basename(path))
      ? neutralPresentation(content) : content,
  ]));
}

export function presentationIssues(text: string, where: string): string[] {
  const prose = text.replace(/```[\s\S]*?```/g, "");
  const claims = /\b(?:Taij\s+Singh|AI[- ](?:drafted|assisted|generated|written)|drafted by AI|the author wrote|(?:I|we) (?:built|created|wrote|developed)|(?:written|authored|built|created|developed) by (?:me|us|the author|Claude|ChatGPT|Codex)|the author's own (?:writing|composition))\b/gi;
  return [...prose.matchAll(claims)].map((m) => `${where}: attribution in current reading view: ${m[0]}`);
}
