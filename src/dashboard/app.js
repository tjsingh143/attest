/* Attest dashboard — client. Reads the evidence summary embedded by `attest reports`
   (never fetched, never edited) and renders the posture, effectiveness, coverage,
   findings, drift, the framework study and an evidence drill-down.
   Every string from the evidence is inserted with textContent. */
(function () {
  "use strict";
  var D = JSON.parse(document.getElementById("attest-data").textContent);
  var V = D.verdicts;
  var VLABEL = { effective: "effective", deficient: "deficient", gap: "gap", characterized: "characterized", not_measured: "not measured" };
  var VICON = { effective: "✓", deficient: "✕", gap: "△", characterized: "◆", not_measured: "?" };
  var STATUS = { open: "open", accepted_design_intent: "accepted / design intent", informational: "informational", not_measured: "not measured" };

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === "text") n.textContent = attrs[k];
      else if (k === "class") n.className = attrs[k];
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c != null) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }
  function $(id) { return document.getElementById(id); }
  function pct(n, d) { return d ? Math.round((n / d) * 1000) / 10 + "%" : "0%"; }

  // ---------------------------------------------------------------- theme
  var root = document.documentElement;
  function setTheme(t) {
    if (t === "system") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", t);
    document.querySelectorAll(".theme button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.t === t)); });
    try { localStorage.setItem("attest-theme", t); } catch (e) { /* storage unavailable */ }
  }
  var saved = "system";
  try { saved = localStorage.getItem("attest-theme") || "system"; } catch (e) { saved = "system"; }
  document.querySelectorAll(".theme button").forEach(function (b) { b.addEventListener("click", function () { setTheme(b.dataset.t); }); });
  setTheme(saved);

  // ---------------------------------------------------------------- tooltip
  var tip = $("tip");
  function showTip(target, x, y) {
    var t = target.getAttribute("data-tip-value"), l = target.getAttribute("data-tip-label"), s = target.getAttribute("data-tip-sub");
    tip.textContent = "";
    tip.appendChild(el("strong", { text: t }));
    tip.appendChild(el("div", {}, [el("span", { class: "line " + (target.getAttribute("data-tip-class") || "") }), l]));
    if (s) tip.appendChild(el("div", { class: "muted", text: s }));
    tip.style.display = "block";
    var w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.min(window.innerWidth - w - 8, Math.max(8, x + 12)) + "px";
    tip.style.top = Math.max(8, y - h - 10) + "px";
  }
  document.addEventListener("pointermove", function (e) {
    var t = e.target.closest && e.target.closest("[data-tip-value]");
    if (t) showTip(t, e.clientX, e.clientY); else tip.style.display = "none";
  });
  document.addEventListener("focusin", function (e) {
    var t = e.target.closest && e.target.closest("[data-tip-value]");
    if (t) { var r = t.getBoundingClientRect(); showTip(t, r.left + r.width / 2, r.top); } else tip.style.display = "none";
  });
  document.addEventListener("focusout", function () { tip.style.display = "none"; });

  // ---------------------------------------------------------------- pieces
  function statusKey(v) {
    return el("span", { class: "key" }, [el("span", { class: "sw v-" + v }), el("span", { class: "ic", "aria-hidden": "true", text: VICON[v] }), VLABEL[v]]);
  }
  function legend(keys) { return el("div", { class: "legend", role: "list" }, keys.map(function (k) { return el("span", { role: "listitem" }, [k]); })); }

  /** One row of a stacked bar. segs: [{cls, value, label}] */
  function barRow(name, sub, segs, total) {
    var track = el("div", { class: "track", role: "img", "aria-label": name + ": " + segs.filter(function (s) { return s.value; }).map(function (s) { return s.value + " " + s.label; }).join(", ") });
    var live = segs.filter(function (s) { return s.value > 0; });
    live.forEach(function (s, i) {
      var b = el("button", {
        class: "seg " + s.cls + (i === live.length - 1 ? " end" : ""), type: "button",
        "data-tip-value": String(s.value), "data-tip-label": s.label, "data-tip-sub": pct(s.value, total) + " of " + total, "data-tip-class": s.cls,
        "aria-label": s.value + " " + s.label,
      });
      b.style.flex = s.value + " 0 0";
      track.appendChild(b);
    });
    return [el("div", { class: "name" }, [name, sub ? el("div", { class: "muted", text: sub }) : null]), track, el("div", { class: "total", text: String(total) })];
  }

  function verdictBars(rows) {
    var g = el("div", { class: "bars" });
    rows.forEach(function (r) {
      barRow(r.name, r.sub, V.map(function (v) { return { cls: "v-" + v, value: r.counts[v], label: VLABEL[v] }; }), r.counts.total).forEach(function (n) { g.appendChild(n); });
    });
    return g;
  }

  function verdictTable(rows, firstHead) {
    var t = el("table");
    t.appendChild(el("thead", {}, [el("tr", {}, [el("th", { text: firstHead })].concat(V.map(function (v) { return el("th", { class: "num", text: VLABEL[v] }); })).concat([el("th", { class: "num", text: "total" })]))]));
    var b = el("tbody");
    rows.forEach(function (r) { b.appendChild(el("tr", {}, [el("td", { text: r.name })].concat(V.map(function (v) { return el("td", { class: "num", text: String(r.counts[v]) }); })).concat([el("td", { class: "num", text: String(r.counts.total) })]))); });
    t.appendChild(b);
    return el("div", { class: "tablewrap" }, [t]);
  }

  /** A card whose chart has a table-view twin. */
  function chartCard(title, sub, chart, table, extra) {
    var tableBtn = el("button", { class: "btn", type: "button", "aria-pressed": "false", text: "Table view" });
    var tw = el("div", { hidden: "" }, [table]);
    tableBtn.addEventListener("click", function () {
      var on = tableBtn.getAttribute("aria-pressed") !== "true";
      tableBtn.setAttribute("aria-pressed", String(on)); tw.hidden = !on; chart.hidden = on;
    });
    return el("section", { class: "card" }, [
      el("div", { class: "card-head" }, [el("div", {}, [el("h2", { text: title }), sub ? el("p", { class: "sub", text: sub }) : null]), tableBtn]),
      extra || null, chart, tw,
    ]);
  }

  // ---------------------------------------------------------------- header + hero
  var m = D.meta;
  $("asof").textContent = "Evidence as of " + m.asOf + " · WP3 run " + m.wp3 + " · WP4 run " + m.wp4 + " · schema " + m.schema;
  var T = D.totals;
  var hero = $("hero");
  hero.appendChild(el("section", { class: "card" }, [
    el("div", { class: "hero" }, [
      el("div", {}, [
        el("div", { class: "hero-fig" }, [String(T.effective), el("small", { text: " / " + T.total })]),
        el("p", { class: "sub", text: "tests held exactly as approved (effective). Not measured is never counted as held." }),
      ]),
      el("div", {}, [
        el("h2", { text: "Every test, by verdict" }),
        legend(V.map(statusKey)),
        verdictBars([{ name: "All " + T.total + " Test IDs", counts: T }]),
      ]),
    ]),
    el("div", { class: "kpis" }, [
      kpi("Deficient", T.deficient, "control exercised, did not hold", "deficient"),
      kpi("Gap", T.gap, "control asked about does not exist", "gap"),
      kpi("Characterized", T.characterized, "recorded fact, not pass or fail", "characterized"),
      kpi("Not measured", T.not_measured, "never counted as effective", "not_measured"),
      kpi("Open findings", D.findings.filter(function (f) { return f.status === "open"; }).length, D.findings.filter(function (f) { return f.status === "open"; }).map(function (f) { return f.id; }).join(", ") + " — nothing remediated", null),
      kpi("Resources with a control", D.coverage.withControl + " / " + D.coverage.resources, D.coverage.without.length ? D.coverage.without.length + " without" : "none without a control", null),
      kpi("Pass → fail across history", D.drift.passToFail, "WP4, " + D.drift.states.length + " schema states", null),
      kpi("Independent validation", m.validation, "validate-wp3, raw records re-derived", null),
    ]),
  ]));
  function kpi(label, value, note, v) {
    return el("div", { class: "kpi" }, [
      el("div", { class: "label" }, v ? [el("span", { class: "sw v-" + v }), el("span", { class: "ic", "aria-hidden": "true", text: VICON[v] }), label] : [label]),
      el("div", { class: "value", text: String(value) }),
      el("div", { class: "note", text: note }),
    ]);
  }

  // ---------------------------------------------------------------- effectiveness
  var eff = $("effectiveness");
  var famRows = D.byFamily.map(function (f) { return { name: f.code + " " + f.name, counts: f.counts }; });
  var tierRows = D.byTier.map(function (t) { return { name: t.tier === "suite" ? "Suite-level (no single resource)" : t.tier + "-depth tests", counts: t.counts }; });
  eff.appendChild(el("div", { class: "grid2" }, [
    chartCard("By control family", "WP3, the ten families and the boundary cases", verdictBars(famRows), verdictTable(famRows, "Family"), legend(V.map(statusKey))),
    chartCard("By risk tier (test depth)", "Every SECURITY DEFINER function test runs at High depth by the planning rule", verdictBars(tierRows), verdictTable(tierRows, "Depth"), legend(V.map(statusKey))),
  ]));

  // ---------------------------------------------------------------- coverage
  var cov = D.coverage;
  var covSegs = [
    { cls: "o-1", value: cov.named, label: "named by at least one Test ID" },
    { cls: "o-2", value: cov.resourceOnly, label: "exercised only through tests of their resource" },
    { cls: "o-3", value: cov.unexercised, label: "not exercised by any test" },
  ];
  var covBars = el("div", { class: "bars" }); barRow("All " + cov.controls + " controls", null, covSegs, cov.controls).forEach(function (n) { covBars.appendChild(n); });
  var covTable = el("div", { class: "tablewrap" }, [el("table", {}, [
    el("thead", {}, [el("tr", {}, [el("th", { text: "Controls" }), el("th", { class: "num", text: "count" })])]),
    el("tbody", {}, covSegs.map(function (s) { return el("tr", {}, [el("td", { text: s.label }), el("td", { class: "num", text: String(s.value) })]); })),
  ])]);
  $("coverage").appendChild(el("div", { class: "grid2" }, [
    el("section", { class: "card" }, [
      el("h2", { text: "Resources with a control" }),
      el("p", { class: "sub", text: "WP0, read from the live catalogs of the frozen build" }),
      el("div", { class: "hero-fig", style: "font-size:40px" }, [pct(cov.withControl, cov.resources), el("small", { text: " (" + cov.withControl + " of " + cov.resources + ")" })]),
      el("p", {}, [el("strong", { text: "Without a control: " }), cov.without.length ? cov.without.join(", ") : "none — every resource has row-level security or no client path."]),
      el("div", { class: "tablewrap" }, [el("table", {}, [
        el("thead", {}, [el("tr", {}, [el("th", { text: "Structural observation" }), el("th", { class: "num", text: "resources" })])]),
        el("tbody", {}, Object.keys(cov.observations).map(function (k) { return el("tr", {}, [el("td", {}, [el("code", { text: k })]), el("td", { class: "num", text: String(cov.observations[k]) })]); })),
      ])]),
    ]),
    chartCard("Controls exercised by a test", "Named by a Test ID's control id, a mechanism it asserts, or a function its statement calls", covBars, covTable,
      legend(covSegs.map(function (s) { return el("span", { class: "key" }, [el("span", { class: "sw " + s.cls }), s.label]); }))),
  ]));

  // ---------------------------------------------------------------- findings
  var ft = el("table");
  ft.appendChild(el("thead", {}, [el("tr", {}, ["#", "Item", "Tier", "Evidence", "Tests", "The author's status", ""].map(function (h, i) { return el("th", { class: i === 4 ? "num" : "", text: h }); }))]));
  var fb = el("tbody");
  D.findings.forEach(function (f) {
    var show = el("button", { class: "btn", type: "button", text: "Show tests" });
    show.disabled = !f.tests.length;
    show.addEventListener("click", function () { showTestSet(f.id + " — " + f.title, f.tests); $("drill").scrollIntoView({ behavior: "smooth", block: "start" }); });
    fb.appendChild(el("tr", {}, [el("td", { text: f.id }), el("td", { text: f.title }), el("td", { text: f.tier }), el("td", {}, [f.evidence === "none" ? "WP0 observation" : statusKey(f.evidence)]),
      el("td", { class: "num", text: String(f.tests.length) }), el("td", {}, [el("span", { class: "status", text: STATUS[f.status] || f.status })]), el("td", {}, [show])]));
  });
  ft.appendChild(fb);
  $("findings").appendChild(el("section", { class: "card" }, [
    el("h2", { text: "Ranked findings (WP5)" }),
    el("p", { class: "sub", text: "Ranked from the frozen tiers and the evidence; each status is the author's decision at CP4 (" + m.cp4 + "). Nothing was remediated, fixed or closed. Full detail: FINDINGS.md." }),
    D.scope ? el("p", { class: "sub", text: "A2 under the author's rule: " + D.scope.trailRequired + " of " + D.scope.total + " resources require a trail and have none; " + D.scope.excluded + " excluded as transient live state; " + D.scope.conditional + " conditional on J4." }) : null,
    el("div", { class: "tablewrap" }, [ft]),
  ]));

  // ---------------------------------------------------------------- drift
  var dt = el("table");
  var dh = ["Compared", "added", "removed", "definition changed", "attributes changed", "new, no control", "newly exposed", "pass → fail", "fail → pass"];
  dt.appendChild(el("thead", {}, [el("tr", {}, dh.map(function (h, i) { return el("th", { class: i ? "num" : "", text: h }); }))]));
  dt.appendChild(el("tbody", {}, D.drift.diffs.map(function (d) {
    return el("tr", {}, [el("td", { text: d.from + " → " + d.to })].concat([d.added, d.removed, d.definitionChanged, d.attributesChanged, d.newUnprotected, d.newlyExposed, d.passToFail == null ? "—" : d.passToFail, d.failToPass == null ? "—" : d.failToPass].map(function (x) { return el("td", { class: "num", text: String(x) }); })));
  })));
  $("drift").appendChild(el("section", { class: "card" }, [
    el("h2", { text: "Drift across Arc21's own history (WP4)" }),
    el("p", { class: "sub", text: "Today's approved questions asked of earlier schemas, rebuilt from Arc21's git history without touching the checkout — not findings about Arc21 today." }),
    el("ul", {}, D.drift.states.map(function (s) { return el("li", {}, [el("code", { text: s.name }), " — " + s.label + " (" + s.migrationCount + " migrations, exit " + s.exit + ")"]); })),
    el("div", { class: "tablewrap" }, [dt]),
    el("p", { style: "margin-top:8px" }, [el("strong", { text: "Caught without anyone looking: " }), D.drift.newUnprotected.map(function (u) { return u.resource + " (" + (u.clientReachable ? "reachable by a client role" : "no client grant today — one GRANT from exposed") + ")"; }).join("; ") || "nothing"]),
    D.drift.transitions.length ? el("p", { class: "sub", text: "Fail → pass: " + D.drift.transitions.join("; ") }) : null,
  ]));

  // ---------------------------------------------------------------- framework (study)
  var mt = el("table");
  mt.appendChild(el("thead", {}, [el("tr", {}, ["Identifier", "Title", "Support", "Evidence"].map(function (h) { return el("th", { text: h }); }))]));
  mt.appendChild(el("tbody", {}, D.framework.map(function (x) {
    return el("tr", {}, [el("td", { text: x.id }), el("td", { text: x.title }), el("td", { text: x.support + (x.subject === "attest" ? " (Attest's own activity)" : "") }), el("td", { text: x.evidence })]);
  })));
  $("framework").appendChild(el("section", { class: "card" }, [
    el("h2", { text: "Framework mapping — a study exercise (WP6)" }),
    el("p", { class: "sub", text: "Not compliance, not validation, not certification, not an independent audit; Arc21 is not a regulated system. Rationale AI-drafted. Full text: FRAMEWORK_MAPPING.md and CSA_NOTE.md." }),
    el("div", { class: "tablewrap" }, [mt]),
  ]));

  // ---------------------------------------------------------------- drill-down
  var groups = D.resources.map(function (r) { return { title: r.name, tag: r.tier, controls: r.controls.concat(r.resourceTests.length ? [{ id: r.name + " (the resource as a whole)", kind: "resource-level tests", detail: "anonymous reach, audit trail, boundary and integrity tests of the resource rather than of one control", tests: r.resourceTests }] : []) }; })
    .concat(D.functions.length ? [{ title: "SECURITY DEFINER and granted functions", tag: "functions", controls: D.functions.map(function (f) { return { id: f.name, kind: f.controls.join("; "), detail: f.controls.join("; "), tests: f.tests }; }) }] : [])
    .concat(D.suite.length ? [{ title: "Suite-level tests", tag: "suite", controls: [{ id: "mechanism and boundary tests", kind: "suite", detail: "FORCE / BYPASSRLS mechanism on an Attest scratch table, role attributes, expired session at the API boundary", tests: D.suite }] }] : []);
  var q = $("q"), fTier = $("f-tier"), fVerdict = $("f-verdict"), list = $("list"), detail = $("detail");
  var current = null;
  function matches(c, g) {
    var s = q.value.trim().toLowerCase();
    if (fTier.value !== "all" && g.tag !== fTier.value) return false;
    if (fVerdict.value !== "all" && !c.tests.some(function (t) { return D.records[t].v === fVerdict.value; })) return false;
    if (!s) return true;
    return (g.title + " " + c.id + " " + c.kind + " " + c.detail + " " + c.tests.join(" ")).toLowerCase().indexOf(s) >= 0;
  }
  function renderList() {
    list.textContent = "";
    var shown = 0;
    groups.forEach(function (g) {
      var cs = g.controls.filter(function (c) { return matches(c, g); });
      if (!cs.length) return;
      var box = el("div", { class: "group" }, [el("div", { class: "group-h" }, [el("span", { text: g.title }), el("span", { class: "muted", text: g.tag })])]);
      cs.forEach(function (c) {
        shown++;
        var b = el("button", { class: "ctl", type: "button" }, [el("span", { text: c.id.indexOf("#") > 0 ? c.id.split("#")[1] : c.id }), el("span", { class: "k", text: " · " + c.kind + " · " + c.tests.length + " test" + (c.tests.length === 1 ? "" : "s") })]);
        if (current === c) b.setAttribute("aria-current", "true");
        b.addEventListener("click", function () { current = c; renderList(); showControl(c, g); });
        box.appendChild(b);
      });
      list.appendChild(box);
    });
    if (!shown) list.appendChild(el("div", { class: "empty", text: "No control matches these filters." }));
  }
  function testCard(id) {
    var r = D.records[id];
    var dl = el("dl");
    function row(k, v) { if (v) { dl.appendChild(el("dt", { text: k })); dl.appendChild(el("dd", { text: v })); } }
    row("Identity", r.i); row("Expected", r.e); row("Actual", r.x); row("Parameters", r.a); row("Attack simulated (intent)", r.n); row("Verdict reason", r.vr); row("Control", r.c); row("Resource", r.r);
    return el("div", { class: "test" }, [
      el("div", { class: "row" }, [el("strong", { style: "color:var(--ink-1)", text: id }), statusKey(r.v), el("span", { text: r.p }), el("span", { text: r.f }), el("span", { class: "mono", text: r.ts })]),
      el("pre", { class: "mono", text: r.s }),
      dl,
    ]);
  }
  function showControl(c, g) {
    detail.textContent = "";
    detail.appendChild(el("h3", { text: c.id }));
    detail.appendChild(el("p", { class: "sub", text: c.kind + " — " + c.detail }));
    if (!c.tests.length) { detail.appendChild(el("div", { class: "empty", text: "No Test ID names this control; it is exercised, if at all, through the other tests of " + g.title + "." })); return; }
    c.tests.forEach(function (t) { detail.appendChild(testCard(t)); });
  }
  function showTestSet(title, ids) {
    current = null; renderList();
    detail.textContent = "";
    detail.appendChild(el("h3", { text: title }));
    ids.forEach(function (t) { detail.appendChild(testCard(t)); });
  }
  [q, fTier, fVerdict].forEach(function (x) { x.addEventListener("input", renderList); });
  renderList();
  detail.appendChild(el("div", { class: "empty", text: "Select a control to see its tests — the statement issued, the identity it ran as, what was expected, what happened, and when. Or use “Show tests” on a finding." }));
})();
