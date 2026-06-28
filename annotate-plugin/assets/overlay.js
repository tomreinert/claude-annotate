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
// Flow (channel-based): the user draws and clicks Send -> the overlay POSTs to the
// local annotate *channel* server (its URL + token are injected per session as
// window.__ANNOT_ENDPOINT / window.__ANNOT_TOKEN), which pushes a
// <channel source="annotate"> event into the Claude Code session. Claude then hides
// the bar, screenshots, re-arms, reads the PNG, and incorporates the feedback —
// and may call its reply tool, which streams back over /events as a toast here.
// No blocking MCP call: Send lands whether or not Claude is mid-turn.
//
// Tools: pen (quadratic-smoothed), rectangle (Shift = square), arrow (Shift = snap
// 45°), text (sticky note). Shortcuts: A/R/P/T pick a tool, Cmd/Ctrl+Z undo.
//
// This file is a single bare arrow function: pass its contents verbatim as the
// `content` of addInitScript and/or the `function` of browser_evaluate.
(() => {
  // Only run on local dev origins. addInitScript fires on EVERY page in the browser
  // context, so this keeps the overlay (and the session token) from activating on any
  // third-party site that happens to be opened in the same browser.
  const H = (typeof location !== "undefined" && location.hostname) || "";
  if (!(H === "localhost" || H === "127.0.0.1" || H === "::1" || H === "[::1]" || H.endsWith(".localhost"))) return "skipped: non-local origin";
  // The injecting session sets these to ITS OWN channel server (each session uses a
  // different ephemeral port + secret token). No fallback: if they're missing the
  // overlay still draws but Send reports it isn't configured, rather than guessing a
  // port and possibly hitting another session.
  const ENDPOINT = (typeof window !== "undefined" && window.__ANNOT_ENDPOINT) || null;
  const TOKEN = (typeof window !== "undefined" && window.__ANNOT_TOKEN) || "";
  const Q = "?t=" + encodeURIComponent(TOKEN); // /events only — EventSource can't set headers
  const LS = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
  if (LS.get("__annot_off") === "1") return "disabled";
  // Re-injection: if the API is live AND its DOM is still attached, just re-arm.
  // If the nodes were torn out (framework re-render/HMR) leave the stale API behind
  // and fall through to a clean rebuild.
  if (window.__annot) {
    if (document.getElementById("__annot_svg")) { window.__annot.arm(); return "re-armed"; }
    try { delete window.__annot; } catch (e) { window.__annot = undefined; }
  }

  // Runs both via browser_evaluate (page already loaded) and via addInitScript
  // (runs before <body> exists) — so defer the DOM build until the body is ready.
  const build = () => {
  // Idempotent: strip any prior overlay instance so we never stack two toolbars.
  document.querySelectorAll("#__annot_svg,[data-annot-ui]").forEach(n => { try { n.remove(); } catch (e) {} });

  const NS = "http://www.w3.org/2000/svg";
  const COLORS = ["#ff2d55", "#0a84ff", "#34c759", "#ffd60a", "#111111"];
  const SIZES = { S: 2.5, M: 4, L: 7 };
  const state = { tool: "pen", color: COLORS[0], size: SIZES.M, drawing: false, start: null, node: null, pts: [], items: [], shift: false, editing: null };
  let sending = false; // true between Send and Claude's arm(); blocks re-send and new strokes

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
  Object.assign(sendBtn.style, { background: "#34c759", color: "#03210d", padding: "0 11px" }); sendBtn.onmouseenter = () => sendBtn.style.background = "#2fb850"; sendBtn.onmouseleave = () => sendBtn.style.background = "#34c759"; sendBtn.title = "Send annotations to Claude (toolbar stays)"; sendBtn.onclick = send; bar.appendChild(sendBtn);
  const minBtn = iconBtn("close", "Minimize (reopen from the ✏ pill)", minimize); bar.appendChild(minBtn);

  // --- launcher pill --------------------------------------------------------
  const launcher = document.createElement("button"); launcher.setAttribute("data-annot-ui", "1"); launcher.title = "Open annotation toolbar"; launcher.innerHTML = iconSvg("pen", 22);
  Object.assign(launcher.style, { position: "fixed", bottom: "20px", right: "20px", zIndex: "2147483647", width: "46px", height: "46px", borderRadius: "50%", display: "none", alignItems: "center", justifyContent: "center", background: "rgba(28,28,30,.9)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", border: "1px solid rgba(255,255,255,.14)", color: "#fff", cursor: "pointer", boxShadow: "0 6px 24px rgba(0,0,0,.4)" });
  launcher.onclick = expand;

  // --- toast (Claude -> user, via the channel reply tool) -------------------
  const toast = document.createElement("div"); toast.setAttribute("data-annot-ui", "1");
  Object.assign(toast.style, { position: "fixed", bottom: "78px", left: "50%", transform: "translateX(-50%) translateY(8px)", zIndex: "2147483647", maxWidth: "min(440px,90vw)", padding: "10px 14px", background: "rgba(28,28,30,.92)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", color: "#fff", font: "13px -apple-system,system-ui,sans-serif", lineHeight: "1.4", border: "1px solid rgba(255,255,255,.14)", borderRadius: "12px", boxShadow: "0 8px 30px rgba(0,0,0,.4)", opacity: "0", pointerEvents: "none", transition: "opacity .2s, transform .2s", whiteSpace: "pre-wrap" });
  let toastTimer = null;
  function showToast(text, ms) { toast.textContent = text; toast.style.opacity = "1"; toast.style.transform = "translateX(-50%) translateY(0)"; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.style.opacity = "0"; toast.style.transform = "translateX(-50%) translateY(8px)"; }, ms || 4200); }
  function hideToast() { clearTimeout(toastTimer); toast.style.opacity = "0"; toast.style.transform = "translateX(-50%) translateY(8px)"; }

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
    if (sending) return; // don't start strokes that arm() is about to clear
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
  function gripDown(e) { const r = bar.getBoundingClientRect(); drag = { dx: e.clientX - r.left, dy: e.clientY - r.top }; bar.style.transition = "none"; grip.style.cursor = "grabbing"; e.preventDefault(); }
  function dragMove(e) { if (!drag) return; const x = Math.max(6, Math.min(window.innerWidth - bar.offsetWidth - 6, e.clientX - drag.dx)); const y = Math.max(6, Math.min(window.innerHeight - bar.offsetHeight - 6, e.clientY - drag.dy)); bar.style.left = x + "px"; bar.style.top = y + "px"; bar.style.bottom = "auto"; bar.style.transform = "none"; }
  function dragUp() { drag = null; grip.style.cursor = "grab"; }
  grip.addEventListener("pointerdown", gripDown);
  window.addEventListener("pointermove", dragMove);
  window.addEventListener("pointerup", dragUp);

  // --- input wiring ---------------------------------------------------------
  svg.addEventListener("pointerdown", down); window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  function onKey(e) { if (bar.style.display === "none") return; /* minimized: don't hijack the app's keys (e.g. Cmd+Z) */ const t = e.target; if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.isContentEditable)) return; if ((e.metaKey || e.ctrlKey) && (e.key === "z" || e.key === "Z")) { e.preventDefault(); undo(); return; } const map = { a: "arrow", r: "box", p: "pen", t: "text" }; const tool = map[e.key.toLowerCase()]; if (tool) setTool(tool); }
  window.addEventListener("keydown", onKey);

  document.body.appendChild(svg); document.body.appendChild(bar); document.body.appendChild(launcher); document.body.appendChild(toast);

  // --- reply stream (Claude -> toast) ---------------------------------------
  let es = null;
  function connectEvents() {
    if (!ENDPOINT || !TOKEN) return; // not configured for this page; nothing to listen to
    try {
      es = new EventSource(ENDPOINT + "/events" + Q);
      es.onmessage = ev => { try { const m = JSON.parse(ev.data); if (m && m.type === "toast" && m.text) showToast(m.text, 6000); } catch (e) {} };
      // EventSource auto-reconnects on error; nothing to do here.
    } catch (e) { es = null; }
  }
  connectEvents();

  // --- show/hide & lifecycle ------------------------------------------------
  function expand() { bar.style.display = "flex"; launcher.style.display = "none"; svg.style.pointerEvents = "auto"; LS.set("__annot_min", "0"); }
  function minimize() { if (state.editing) { state.editing.blur(); } bar.style.display = "none"; launcher.style.display = "flex"; svg.style.pointerEvents = "none"; LS.set("__annot_min", "1"); }
  // setBar(false) hides the overlay UI for a CLEAN capture without moving it: opacity
  // only, so the toolbar stays exactly in place (and minimized/expanded state is kept).
  // The drawings (svg) stay visible on purpose — they are what gets screenshotted.
  function setBar(visible) {
    const v = visible ? "" : "0", pe = visible ? "" : "none";
    bar.style.opacity = v; bar.style.pointerEvents = pe;
    launcher.style.opacity = v; launcher.style.pointerEvents = pe;
    if (!visible) hideToast();
  }
  // arm(): clear the canvas and make the toolbar visible again, in place. Does NOT
  // collapse, move, or change minimized/expanded state — the bar just stays put.
  function arm() { if (state.editing) { const ed = state.editing; state.editing = null; rm(ed); } clearAll(); sending = false; setBar(true); setTool(state.tool); renderColors(); renderSizes(); }
  // send(): POST the drawings to the channel; Claude captures + incorporates. The
  // toolbar deliberately stays put — no collapse — so it never flickers away on Send.
  async function send() {
    if (sending) return; // already in flight; ignore double-clicks until arm() resets
    if (!ENDPOINT || !TOKEN) { showToast("Annotate isn't set up for this page. Re-run /annotate.", 9000); return; }
    if (state.editing) state.editing.blur(); // commit any open note first
    sending = true;
    try {
      const r = await fetch(ENDPOINT + "/send", { method: "POST", headers: { "Content-Type": "application/json", "X-Annot-Token": TOKEN }, body: JSON.stringify({ url: location.href, notes: String(state.items.length) }) });
      if (!r.ok) throw new Error("status " + r.status);
      showToast("Sent to Claude…");
    } catch (e) {
      sending = false;
      showToast("Can't reach the annotate channel. Start Claude with:\n--dangerously-load-development-channels plugin:annotate@tom-tools", 9000);
    }
  }
  // disable(): fully leave review mode — remove the overlay and stop it returning on reload.
  function disable() { LS.set("__annot_off", "1"); if (state.editing) { const ed = state.editing; state.editing = null; rm(ed); } try { if (es) es.close(); } catch (e) {} window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("keydown", onKey); window.removeEventListener("pointermove", dragMove); window.removeEventListener("pointerup", dragUp); rm(svg); rm(bar); rm(launcher); rm(toast); delete window.__annot; }

  window.__annot = {
    arm, send, setBar, disable, expand, minimize, clear: clearAll, toast: showToast,
    count: () => state.items.length
  };

  // initial visibility: respect a prior minimize, else open
  clearAll(); setTool(state.tool); renderColors(); renderSizes();
  LS.get("__annot_min") === "1" ? minimize() : expand();
  return "annotation overlay ready (channel, persistent, launcher, bottom)";
  };

  if (document.body) return build();
  document.addEventListener("DOMContentLoaded", build);
  return "deferred until DOMContentLoaded";
})();
