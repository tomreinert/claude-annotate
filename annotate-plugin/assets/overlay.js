// Self-contained annotation overlay, injected via Playwright browser_evaluate.
//
// The toolbar is a PERSISTENT surface — it stays up across many send/work cycles,
// it is not a one-shot "round". Lifecycle:
//   1. inject this script        -> toolbar shown at the bottom, ready to draw
//   2. user draws, then clicks:
//        ✓ Send   -> outcome "send"   (hand current drawings to Claude; toolbar stays)
//        ✕ Close  -> outcome "close"  (remove the toolbar; reopen by saying "annotate")
//   3. caller awaits __annot.waitNext() in a single blocking browser_evaluate; it
//      returns the outcome. On "send" the caller captures, then calls arm() to clear
//      the canvas for the next drawing while the toolbar stays. On "close" the
//      caller writes `off` to the project mode file.
//
// Drawings live in a fixed full-screen SVG layer above the page so a normal
// viewport screenshot captures them. This file is a single bare arrow function:
// pass its entire contents verbatim as the `function` argument to browser_evaluate.
() => {
  if (window.__annot) { window.__annot.arm(); return "re-armed"; }

  const NS = "http://www.w3.org/2000/svg";
  const COLORS = ["#ff2d55", "#0a84ff", "#34c759", "#ffd60a", "#000000"];
  const state = { tool: "arrow", color: COLORS[0], drawing: false, start: null, node: null, items: [], outcome: null, resolve: null };

  // --- layers ---------------------------------------------------------------
  const svg = document.createElementNS(NS, "svg");
  Object.assign(svg.style, { position: "fixed", inset: "0", width: "100vw", height: "100vh", zIndex: "2147483646", cursor: "crosshair" });
  svg.setAttribute("id", "__annot_svg");
  const defs = document.createElementNS(NS, "defs");
  defs.innerHTML = COLORS.map((c, i) =>
    `<marker id="ah${i}" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L9,3 L0,6 Z" fill="${c}"/></marker>`).join("");
  svg.appendChild(defs);
  const ahId = () => `ah${COLORS.indexOf(state.color)}`;

  // --- toolbar (persistent, bottom-center) ----------------------------------
  const bar = document.createElement("div");
  Object.assign(bar.style, { position: "fixed", bottom: "20px", left: "50%", transform: "translateX(-50%)", zIndex: "2147483647", display: "flex", gap: "6px", padding: "6px 8px", background: "rgba(28,28,30,.95)", borderRadius: "12px", alignItems: "center", font: "13px -apple-system,system-ui,sans-serif", color: "#fff", boxShadow: "0 4px 24px rgba(0,0,0,.4)", userSelect: "none" });
  bar.setAttribute("data-annot-ui", "1");
  const mkBtn = (label, title) => { const b = document.createElement("button"); b.textContent = label; b.title = title; Object.assign(b.style, { background: "transparent", border: "1px solid transparent", color: "#fff", borderRadius: "8px", padding: "4px 8px", cursor: "pointer", fontSize: "15px", whiteSpace: "nowrap" }); return b; };
  const tools = [["arrow", "↗", "Arrow"], ["box", "▭", "Box"], ["pen", "✎", "Freehand"], ["text", "T", "Text"]];
  const toolBtns = {};
  tools.forEach(([t, icon, title]) => { const b = mkBtn(icon, title); b.onclick = () => setTool(t); toolBtns[t] = b; bar.appendChild(b); });
  const sep = () => { const s = document.createElement("div"); Object.assign(s.style, { width: "1px", height: "20px", background: "rgba(255,255,255,.2)" }); return s; };
  bar.appendChild(sep());
  COLORS.forEach(c => { const sw = document.createElement("button"); Object.assign(sw.style, { width: "18px", height: "18px", borderRadius: "50%", background: c, border: "2px solid transparent", cursor: "pointer", padding: "0" }); sw.onclick = () => { state.color = c; renderColors(); }; sw.dataset.color = c; bar.appendChild(sw); });
  bar.appendChild(sep());
  const undoBtn = mkBtn("⤺", "Undo"); undoBtn.onclick = undo; bar.appendChild(undoBtn);
  const clearBtn = mkBtn("Clear", "Clear all"); clearBtn.onclick = clearAll; bar.appendChild(clearBtn);
  bar.appendChild(sep());
  const sendBtn = mkBtn("✓ Send", "Send annotations to Claude (toolbar stays)"); sendBtn.style.background = "#34c759"; sendBtn.style.fontWeight = "600"; sendBtn.onclick = () => finish("send"); bar.appendChild(sendBtn);
  const closeBtn = mkBtn("✕ Close", "Close the toolbar — say 'annotate' to reopen"); closeBtn.onclick = closeOverlay; bar.appendChild(closeBtn);

  function renderColors() { bar.querySelectorAll("[data-color]").forEach(s => s.style.borderColor = s.dataset.color === state.color ? "#fff" : "transparent"); }
  function setTool(t) { state.tool = t; Object.entries(toolBtns).forEach(([k, b]) => b.style.borderColor = k === t ? "#fff" : "transparent"); }

  // --- drawing --------------------------------------------------------------
  const pt = e => ({ x: e.clientX, y: e.clientY });
  const setLine = (l, a, b) => { l.setAttribute("x1", a.x); l.setAttribute("y1", a.y); l.setAttribute("x2", b.x); l.setAttribute("y2", b.y); };
  const setRect = (r, a, b) => { r.setAttribute("x", Math.min(a.x, b.x)); r.setAttribute("y", Math.min(a.y, b.y)); r.setAttribute("width", Math.abs(a.x - b.x)); r.setAttribute("height", Math.abs(a.y - b.y)); };
  function down(e) {
    if (e.target.closest("[data-annot-ui]")) return;
    const p = pt(e); state.start = p; state.drawing = true;
    if (state.tool === "arrow") { const l = document.createElementNS(NS, "line"); l.setAttribute("stroke", state.color); l.setAttribute("stroke-width", "3"); l.setAttribute("marker-end", `url(#${ahId()})`); setLine(l, p, p); svg.appendChild(l); state.node = l; }
    else if (state.tool === "box") { const r = document.createElementNS(NS, "rect"); r.setAttribute("stroke", state.color); r.setAttribute("stroke-width", "3"); r.setAttribute("fill", "none"); svg.appendChild(r); state.node = r; setRect(r, p, p); }
    else if (state.tool === "pen") { const pa = document.createElementNS(NS, "path"); pa.setAttribute("stroke", state.color); pa.setAttribute("stroke-width", "3"); pa.setAttribute("fill", "none"); pa.setAttribute("stroke-linecap", "round"); pa.setAttribute("stroke-linejoin", "round"); pa.setAttribute("d", `M${p.x},${p.y}`); svg.appendChild(pa); state.node = pa; }
    else if (state.tool === "text") { state.drawing = false; placeText(p); }
  }
  function move(e) { if (!state.drawing) return; const p = pt(e), n = state.node; if (state.tool === "arrow") setLine(n, state.start, p); else if (state.tool === "box") setRect(n, state.start, p); else if (state.tool === "pen") n.setAttribute("d", n.getAttribute("d") + ` L${p.x},${p.y}`); }
  function up() { if (state.drawing && state.node) state.items.push(state.node); state.drawing = false; state.node = null; }
  function placeText(p) {
    const inp = document.createElement("input"); inp.setAttribute("data-annot-ui", "1");
    Object.assign(inp.style, { position: "fixed", left: p.x + "px", top: p.y + "px", zIndex: "2147483647", font: "bold 16px -apple-system,system-ui,sans-serif", color: state.color, background: "rgba(255,255,255,.9)", border: "1px dashed " + state.color, borderRadius: "4px", padding: "2px 4px" });
    document.body.appendChild(inp); inp.focus();
    const commit = () => { const v = inp.value.trim(); inp.remove(); if (!v) return; const t = document.createElementNS(NS, "text"); t.setAttribute("x", p.x + 4); t.setAttribute("y", p.y + 18); t.setAttribute("fill", state.color); t.setAttribute("style", "font:bold 16px -apple-system,system-ui,sans-serif;paint-order:stroke;stroke:#fff;stroke-width:3px"); t.textContent = v; svg.appendChild(t); state.items.push(t); };
    inp.onblur = commit;
    inp.onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); inp.blur(); } if (e.key === "Escape") { inp.value = ""; inp.blur(); } };
  }
  function undo() { const n = state.items.pop(); if (n) n.remove(); }
  function clearAll() { state.items.forEach(n => n.remove()); state.items = []; }

  svg.addEventListener("mousedown", down); window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
  document.body.appendChild(svg); document.body.appendChild(bar);

  // --- lifecycle ------------------------------------------------------------
  // arm(): ready for a fresh drawing while keeping the toolbar up (clear canvas,
  // show bar, reset the pending outcome). Used on inject and after each "send".
  function arm() { state.outcome = null; clearAll(); bar.style.display = "flex"; svg.style.pointerEvents = "auto"; setTool("arrow"); renderColors(); }
  function setBar(visible) { bar.style.display = visible ? "flex" : "none"; }
  // finish(): resolve the pending wait without tearing anything down (toolbar
  // and drawings stay; the caller hides the bar only for the capture frame).
  function finish(outcome) { state.outcome = outcome || "send"; if (state.resolve) { state.resolve(state.outcome); state.resolve = null; } }
  function closeOverlay() {
    window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up);
    svg.remove(); bar.remove(); delete window.__annot;
    if (state.resolve) { state.resolve("close"); state.resolve = null; } else { state.outcome = "close"; }
  }

  window.__annot = {
    arm, finish, setBar, clear: clearAll,
    get outcome() { return state.outcome; },
    count: () => state.items.length,
    // Blocking wait. Resolves with "send" or "close". Self-caps so a possible
    // MCP timeout never strands the loop — the caller just re-issues and the
    // sticky outcome means no click is ever lost.
    waitNext(capMs) {
      return new Promise(res => {
        if (state.outcome) return res(state.outcome);
        state.resolve = res;
        setTimeout(() => { if (!state.outcome) { state.resolve = null; res("rearm"); } }, capMs || 240000);
      });
    }
  };
  arm();
  return "annotation overlay ready (persistent toolbar, bottom)";
}
