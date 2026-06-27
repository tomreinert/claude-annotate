// Self-contained annotation overlay, registered ONCE via Playwright addInitScript
// so the browser re-runs it on every page load (survives reloads/HMR, sent once).
//
// In-page state (localStorage) so it persists across reloads:
//   __annot_off : "1"  -> review disabled; this script no-ops (used by "stop reviewing")
//   __annot_min : "1"  -> collapsed to the launcher pill instead of the full toolbar
//
// The toolbar is a PERSISTENT, draggable surface (default bottom-center). It never
// destroys itself: ✕ collapses it to a small launcher pill (bottom-right) that the
// user clicks to reopen — no round-trip to Claude needed.
//
// Caller (Claude) flow: ensure the overlay is present, then await __annot.waitNext()
// in a blocking browser_evaluate. It resolves "send" when the user clicks Send.
// On send: setBar(false) -> screenshot -> arm(); read the PNG; incorporate.
//
// Tools: pen (quadratic-smoothed), rectangle (Shift = square), arrow (Shift = snap
// 45°), text (sticky note). Shortcuts: A/R/P/T pick a tool, Cmd/Ctrl+Z undo.
//
// This file is a single bare arrow function: pass its contents verbatim as the
// `content` of addInitScript and/or the `function` of browser_evaluate.
(() => {
  const LS = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
  if (LS.get("__annot_off") === "1") return "disabled";
  if (window.__annot) { window.__annot.arm(); return "re-armed"; }

  // Runs both via browser_evaluate (page already loaded) and via addInitScript
  // (runs before <body> exists) — so defer the DOM build until the body is ready.
  const build = () => {
  const NS = "http://www.w3.org/2000/svg";
  const COLORS = ["#ff2d55", "#0a84ff", "#34c759", "#ffd60a", "#111111"];
  const SIZES = { S: 2.5, M: 4, L: 7 };
  const state = { tool: "arrow", color: COLORS[0], size: SIZES.M, drawing: false, start: null, node: null, pts: [], items: [], outcome: null, resolve: null, shift: false, editing: null };

  // --- drawing layer --------------------------------------------------------
  const svg = document.createElementNS(NS, "svg");
  Object.assign(svg.style, { position: "fixed", inset: "0", width: "100vw", height: "100vh", zIndex: "2147483646", cursor: "crosshair", touchAction: "none" });
  svg.setAttribute("id", "__annot_svg");
  const defs = document.createElementNS(NS, "defs");
  // markerUnits="strokeWidth" so the arrowhead scales with the chosen stroke; sized big enough to read.
  defs.innerHTML = COLORS.map((c, i) =>
    `<marker id="__ah${i}" viewBox="0 0 12 12" markerWidth="5" markerHeight="5" refX="8" refY="6" orient="auto" markerUnits="strokeWidth"><path d="M1,1 L11,6 L1,11 L4.2,6 Z" fill="${c}"/></marker>`).join("");
  svg.appendChild(defs);
  const ahId = () => `__ah${COLORS.indexOf(state.color)}`;

  // --- icons ----------------------------------------------------------------
  const ICONS = {
    grip: '<circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/>',
    arrow: '<line x1="5" y1="19" x2="18" y2="6"/><polyline points="9.5,6 18,6 18,14.5"/>',
    box: '<rect x="4" y="6" width="16" height="12" rx="1.5"/>',
    pen: '<path d="M4 20l1-4L16 5l3 3L8 19z"/><path d="M14 7l3 3"/>',
    text: '<path d="M5 6h14"/><path d="M12 6v13"/>',
    undo: '<path d="M9 7 4 12l5 5"/><path d="M4 12h11a5 5 0 0 1 0 10"/>',
    send: '<path d="M22 2 11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>'
  };
  const fillIcons = new Set(["grip"]);
  const iconSvg = (name, sz) => `<svg width="${sz || 18}" height="${sz || 18}" viewBox="0 0 24 24" fill="${fillIcons.has(name) ? "currentColor" : "none"}" stroke="${fillIcons.has(name) ? "none" : "currentColor"}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;

  // --- toolbar --------------------------------------------------------------
  const bar = document.createElement("div");
  bar.setAttribute("data-annot-ui", "1");
  Object.assign(bar.style, { position: "fixed", bottom: "22px", left: "50%", transform: "translateX(-50%)", zIndex: "2147483647", display: "none", gap: "2px", padding: "6px", background: "rgba(28,28,30,.82)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", border: "1px solid rgba(255,255,255,.12)", borderRadius: "14px", alignItems: "center", font: "13px -apple-system,system-ui,sans-serif", color: "#fff", boxShadow: "0 8px 30px rgba(0,0,0,.4)", userSelect: "none" });

  const baseBtn = (el) => { Object.assign(el.style, { display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", minWidth: "32px", height: "32px", padding: "0 7px", background: "transparent", border: "0", color: "#fff", borderRadius: "8px", cursor: "pointer", transition: "background .12s, transform .06s" }); el.onmouseenter = () => { if (!el.dataset.active) el.style.background = "rgba(255,255,255,.09)"; }; el.onmouseleave = () => { if (!el.dataset.active) el.style.background = "transparent"; }; el.onmousedown = () => el.style.transform = "scale(.93)"; el.onmouseup = () => el.style.transform = ""; return el; };
  const iconBtn = (name, title, onclick) => { const b = document.createElement("button"); b.title = title; b.innerHTML = iconSvg(name); baseBtn(b); b.onclick = onclick; return b; };

  const grip = document.createElement("div"); grip.innerHTML = iconSvg("grip");
  Object.assign(grip.style, { display: "flex", alignItems: "center", padding: "0 2px", cursor: "grab", color: "rgba(255,255,255,.45)" });
  bar.appendChild(grip);
  const sep = () => { const s = document.createElement("div"); Object.assign(s.style, { width: "1px", height: "20px", margin: "0 4px", background: "rgba(255,255,255,.14)" }); return s; };
  bar.appendChild(sep());

  const toolBtns = {};
  [["arrow", "Arrow (A)"], ["box", "Rectangle (R)"], ["pen", "Pen (P)"], ["text", "Text (T)"]].forEach(([t, title]) => { const b = iconBtn(t, title, () => setTool(t)); toolBtns[t] = b; bar.appendChild(b); });
  bar.appendChild(sep());

  COLORS.forEach(c => { const sw = document.createElement("button"); sw.dataset.color = c; baseBtn(sw); Object.assign(sw.style, { minWidth: "26px", width: "26px", padding: "0" }); sw.innerHTML = `<span style="width:16px;height:16px;border-radius:50%;background:${c};box-shadow:0 0 0 1px rgba(255,255,255,.25) inset"></span>`; sw.onclick = () => { state.color = c; renderColors(); }; bar.appendChild(sw); });
  bar.appendChild(sep());

  const sizeBtns = {};
  Object.entries(SIZES).forEach(([label, v]) => { const b = document.createElement("button"); b.title = "Stroke " + label; baseBtn(b); Object.assign(b.style, { minWidth: "28px", width: "28px", padding: "0" }); const d = Math.round(v + 3); b.innerHTML = `<span style="width:${d}px;height:${d}px;border-radius:50%;background:currentColor"></span>`; b.onclick = () => { state.size = v; renderSizes(); }; sizeBtns[label] = b; bar.appendChild(b); });
  bar.appendChild(sep());

  bar.appendChild(iconBtn("undo", "Undo (Cmd/Ctrl+Z)", undo));
  const clearTextBtn = document.createElement("button"); clearTextBtn.textContent = "Clear"; baseBtn(clearTextBtn); clearTextBtn.style.fontSize = "13px"; clearTextBtn.title = "Remove all annotations"; clearTextBtn.onclick = clearAll; bar.appendChild(clearTextBtn);
  bar.appendChild(sep());

  const sendBtn = document.createElement("button"); baseBtn(sendBtn); sendBtn.innerHTML = iconSvg("send") + '<span style="font-weight:600">Send</span>';
  Object.assign(sendBtn.style, { background: "#34c759", color: "#03210d", padding: "0 11px" }); sendBtn.onmouseenter = () => sendBtn.style.background = "#2fb850"; sendBtn.onmouseleave = () => sendBtn.style.background = "#34c759"; sendBtn.title = "Send annotations to Claude (toolbar stays)"; sendBtn.onclick = () => finish("send"); bar.appendChild(sendBtn);
  const minBtn = iconBtn("close", "Minimize (reopen from the ✏ pill)", minimize); bar.appendChild(minBtn);

  // --- launcher pill --------------------------------------------------------
  const launcher = document.createElement("button"); launcher.setAttribute("data-annot-ui", "1"); launcher.title = "Open annotation toolbar"; launcher.innerHTML = iconSvg("pen", 22);
  Object.assign(launcher.style, { position: "fixed", bottom: "20px", right: "20px", zIndex: "2147483647", width: "46px", height: "46px", borderRadius: "50%", display: "none", alignItems: "center", justifyContent: "center", background: "rgba(28,28,30,.9)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", border: "1px solid rgba(255,255,255,.14)", color: "#fff", cursor: "pointer", boxShadow: "0 6px 24px rgba(0,0,0,.4)" });
  launcher.onclick = expand;

  function renderColors() { bar.querySelectorAll("[data-color]").forEach(s => { const on = s.dataset.color === state.color; s.firstChild.style.boxShadow = on ? `0 0 0 2px #fff, 0 0 0 3px ${s.dataset.color}` : "0 0 0 1px rgba(255,255,255,.25) inset"; }); }
  function renderSizes() { Object.entries(sizeBtns).forEach(([l, b]) => { const on = SIZES[l] === state.size; b.style.background = on ? "rgba(255,255,255,.16)" : "transparent"; b.dataset.active = on ? "1" : ""; }); }
  function setTool(t) { state.tool = t; Object.entries(toolBtns).forEach(([k, b]) => { const on = k === t; b.style.background = on ? "rgba(255,255,255,.18)" : "transparent"; b.dataset.active = on ? "1" : ""; }); }

  // --- drawing --------------------------------------------------------------
  const pt = e => ({ x: e.clientX, y: e.clientY });
  const setLine = (l, a, b) => { l.setAttribute("x1", a.x); l.setAttribute("y1", a.y); l.setAttribute("x2", b.x); l.setAttribute("y2", b.y); };
  const setRect = (r, a, b) => { r.setAttribute("x", Math.min(a.x, b.x)); r.setAttribute("y", Math.min(a.y, b.y)); r.setAttribute("width", Math.abs(a.x - b.x)); r.setAttribute("height", Math.abs(a.y - b.y)); };
  const mkPath = () => { const p = document.createElementNS(NS, "path"); p.setAttribute("stroke", state.color); p.setAttribute("stroke-width", state.size); p.setAttribute("fill", "none"); p.setAttribute("stroke-linecap", "round"); p.setAttribute("stroke-linejoin", "round"); svg.appendChild(p); return p; };
  const snap45 = (a, b) => { if (!state.shift) return b; const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy); const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4); return { x: a.x + Math.cos(ang) * len, y: a.y + Math.sin(ang) * len }; };
  const square = (a, b) => { if (!state.shift) return b; const s = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)); return { x: a.x + Math.sign(b.x - a.x || 1) * s, y: a.y + Math.sign(b.y - a.y || 1) * s }; };
  function smooth(pts) { if (pts.length < 2) return `M${pts[0].x},${pts[0].y}`; let d = `M${pts[0].x},${pts[0].y}`; for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2; d += ` Q${pts[i].x},${pts[i].y} ${mx},${my}`; } const l = pts[pts.length - 1]; return d + ` L${l.x},${l.y}`; }

  function down(e) {
    if (e.target.closest("[data-annot-ui]")) return;
    if (state.editing) { state.editing.blur(); return; } // a click outside an open note confirms it, no new shape
    e.preventDefault(); state.shift = e.shiftKey;
    const p = pt(e); state.start = p; state.drawing = true;
    if (state.tool === "arrow") { const l = document.createElementNS(NS, "line"); l.setAttribute("stroke", state.color); l.setAttribute("stroke-width", state.size); l.setAttribute("stroke-linecap", "round"); l.setAttribute("marker-end", `url(#${ahId()})`); setLine(l, p, p); svg.appendChild(l); state.node = l; }
    else if (state.tool === "box") { const r = document.createElementNS(NS, "rect"); r.setAttribute("stroke", state.color); r.setAttribute("stroke-width", state.size); r.setAttribute("fill", "none"); r.setAttribute("rx", "2"); svg.appendChild(r); state.node = r; setRect(r, p, p); }
    else if (state.tool === "pen") { state.pts = [p]; state.node = mkPath(); state.node.setAttribute("d", `M${p.x},${p.y}`); }
    else if (state.tool === "text") { state.drawing = false; placeText(p); }
  }
  function move(e) {
    if (!state.drawing) return; state.shift = e.shiftKey;
    const p = pt(e), n = state.node;
    if (state.tool === "arrow") setLine(n, state.start, snap45(state.start, p));
    else if (state.tool === "box") setRect(n, state.start, square(state.start, p));
    else if (state.tool === "pen") { state.pts.push(p); n.setAttribute("d", smooth(state.pts)); }
  }
  function up() { if (state.drawing && state.node) state.items.push(state.node); state.drawing = false; state.node = null; state.pts = []; }

  // Notes are sticky-style HTML: faint yellow, black border, black text — readable
  // over any background. They ignore the stroke color on purpose.
  const STICKY = { background: "#fff7a8", color: "#111", border: "1.5px solid #111", borderRadius: "4px", padding: "4px 8px", font: "600 15px -apple-system,system-ui,sans-serif", lineHeight: "1.3", boxShadow: "0 2px 8px rgba(0,0,0,.22)", maxWidth: "300px", whiteSpace: "pre-wrap", wordBreak: "break-word" };
  function placeText(p) {
    const inp = document.createElement("textarea"); inp.setAttribute("data-annot-ui", "1"); inp.rows = 1; inp.placeholder = "note…";
    Object.assign(inp.style, { position: "fixed", left: p.x + "px", top: p.y + "px", zIndex: "2147483646", outline: "none", resize: "none", overflow: "hidden", minWidth: "46px" }, STICKY);
    const grow = () => { inp.style.height = "auto"; inp.style.height = inp.scrollHeight + "px"; inp.style.width = "auto"; inp.style.width = Math.min(300, Math.max(46, inp.scrollWidth + 2)) + "px"; };
    state.editing = inp;
    document.body.appendChild(inp); inp.focus(); grow();
    const commit = () => {
      if (state.editing !== inp) return; state.editing = null;
      const v = inp.value.replace(/\s+$/, ""); const left = inp.style.left, top = inp.style.top; inp.remove(); if (!v) return;
      const note = document.createElement("div"); note.textContent = v;
      Object.assign(note.style, { position: "fixed", left, top, zIndex: "2147483646", pointerEvents: "none" }, STICKY);
      document.body.appendChild(note); state.items.push(note);
    };
    inp.oninput = grow;
    inp.onblur = commit;
    inp.onkeydown = e => { e.stopPropagation(); if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); inp.blur(); } if (e.key === "Escape") { inp.value = ""; inp.blur(); } };
  }
  const rm = n => { try { n.remove(); } catch (e) {} };
  function undo() { const n = state.items.pop(); if (n) rm(n); }
  function clearAll() { state.items.forEach(rm); state.items = []; }

  // --- dragging the toolbar -------------------------------------------------
  let drag = null;
  grip.addEventListener("pointerdown", e => { const r = bar.getBoundingClientRect(); drag = { dx: e.clientX - r.left, dy: e.clientY - r.top }; bar.style.transition = "none"; grip.style.cursor = "grabbing"; e.preventDefault(); });
  window.addEventListener("pointermove", e => { if (!drag) return; const x = Math.max(6, Math.min(window.innerWidth - bar.offsetWidth - 6, e.clientX - drag.dx)); const y = Math.max(6, Math.min(window.innerHeight - bar.offsetHeight - 6, e.clientY - drag.dy)); bar.style.left = x + "px"; bar.style.top = y + "px"; bar.style.bottom = "auto"; bar.style.transform = "none"; });
  window.addEventListener("pointerup", () => { drag = null; grip.style.cursor = "grab"; });

  // --- input wiring ---------------------------------------------------------
  svg.addEventListener("pointerdown", down); window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  function onKey(e) { const t = e.target; if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.isContentEditable)) return; if ((e.metaKey || e.ctrlKey) && (e.key === "z" || e.key === "Z")) { e.preventDefault(); undo(); return; } const map = { a: "arrow", r: "box", p: "pen", t: "text" }; const tool = map[e.key.toLowerCase()]; if (tool) setTool(tool); }
  window.addEventListener("keydown", onKey);

  document.body.appendChild(svg); document.body.appendChild(bar); document.body.appendChild(launcher);

  // --- show/hide & lifecycle ------------------------------------------------
  function expand() { bar.style.display = "flex"; launcher.style.display = "none"; svg.style.pointerEvents = "auto"; LS.set("__annot_min", "0"); }
  function minimize() { if (state.editing) { state.editing.blur(); } bar.style.display = "none"; launcher.style.display = "flex"; svg.style.pointerEvents = "none"; LS.set("__annot_min", "1"); }
  // setBar(false) hides ALL overlay UI for a clean capture; setBar(true) restores.
  function setBar(visible) { if (!visible) { bar.style.display = "none"; launcher.style.display = "none"; } else { LS.get("__annot_min") === "1" ? minimize() : expand(); } }
  // arm(): clear the canvas, show the toolbar ready to draw, reset the pending outcome.
  function arm() { if (state.editing) { const ed = state.editing; state.editing = null; rm(ed); } state.outcome = null; clearAll(); expand(); setTool(state.tool); renderColors(); renderSizes(); }
  function finish(outcome) { state.outcome = outcome || "send"; if (state.resolve) { state.resolve(state.outcome); state.resolve = null; } }
  // disable(): fully leave review mode — remove the overlay and stop it returning on reload.
  function disable() { LS.set("__annot_off", "1"); if (state.editing) { const ed = state.editing; state.editing = null; rm(ed); } window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("keydown", onKey); rm(svg); rm(bar); rm(launcher); delete window.__annot; if (state.resolve) { state.resolve("close"); state.resolve = null; } }

  window.__annot = {
    arm, finish, setBar, disable, expand, minimize, clear: clearAll,
    get outcome() { return state.outcome; },
    count: () => state.items.length,
    // Blocking wait. Resolves "send" (or "close" if disabled). Self-caps so a
    // possible MCP timeout never strands the loop — caller re-issues; sticky outcome
    // means no click is ever lost. Minimizing does NOT resolve it (still waiting).
    waitNext(capMs) {
      return new Promise(res => {
        if (state.outcome) return res(state.outcome);
        state.resolve = res;
        setTimeout(() => { if (!state.outcome) { state.resolve = null; res("rearm"); } }, capMs || 240000);
      });
    }
  };

  // initial visibility: respect a prior minimize, else open
  state.outcome = null; clearAll(); setTool(state.tool); renderColors(); renderSizes();
  LS.get("__annot_min") === "1" ? minimize() : expand();
  return "annotation overlay ready (persistent, launcher, bottom)";
  };

  if (document.body) return build();
  document.addEventListener("DOMContentLoaded", build);
  return "deferred until DOMContentLoaded";
})();
