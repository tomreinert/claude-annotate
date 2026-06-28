#!/usr/bin/env node
// Live UI Annotate — channel server.
//
// A Claude Code *channel*: an MCP server (stdio) that PUSHES events into the
// running session. The drawing toolbar overlaid on the page POSTs to the local
// HTTP listener here when the user hits Send; we forward that as a
// `notifications/claude/channel` event, so Claude reacts even when it is not
// parked in a tool call. Two-way: Claude calls the `reply` tool to show a toast
// back on the page (SSE on /events).
//
// PORT: each session spawns its own server, so we bind an EPHEMERAL port by
// default (set ANNOTATE_PORT to pin one). Claude learns the actual port via the
// `get_endpoint` tool and injects it into the overlay, so every session's toolbar
// talks to ITS OWN server — no cross-session collision on a shared fixed port.
//
// stdout is reserved for the MCP JSON-RPC stream — every log goes to stderr.
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import http from "node:http";
import crypto from "node:crypto";

const FIXED_PORT = process.env.ANNOTATE_PORT ? Number(process.env.ANNOTATE_PORT) : 0;
// Per-session secret. Claude hands it to the overlay via get_endpoint; every
// /send and /events request must carry it (?t=). This stops any other web page or
// local process from posting into this session even if it finds the port.
const TOKEN = crypto.randomBytes(18).toString("hex");
let endpoint = null; // set once the HTTP server is listening

// --- outbound (Claude -> overlay): SSE listeners for toasts ----------------
const listeners = new Set();
function broadcast(obj) {
  const data = `data: ${JSON.stringify(obj)}\n\n`;
  for (const res of listeners) { try { res.write(data); } catch (e) {} }
}

const mcp = new Server(
  { name: "annotate", version: "0.2.4" },
  {
    capabilities: { experimental: { "claude/channel": {} }, tools: {} },
    instructions: [
      "The 'annotate' channel delivers live UI feedback from a drawing toolbar overlaid on the page open in the Playwright MCP browser.",
      "Before injecting the overlay, call the 'get_endpoint' tool to get THIS session's channel {url, token} (JSON), and inject them as window.__ANNOT_ENDPOINT and window.__ANNOT_TOKEN (see the annotate skill) so the toolbar posts to this session and is authorized.",
      "A <channel source=\"annotate\"> event means the user drew annotations on the page at the given url and pressed Send.",
      "When one arrives, do this in order, without narrating the mechanics:",
      "(1) browser_evaluate `() => window.__annot && window.__annot.setBar(false)` to hide the toolbar;",
      "(2) browser_take_screenshot as png, viewport only (NOT fullPage), to .playwright-mcp/annot.png;",
      "(3) browser_evaluate `() => window.__annot && window.__annot.arm()` to clear the canvas and restore the toolbar;",
      "(4) Read the PNG and incorporate the drawn feedback into the code.",
      "Then call the annotate 'reply' tool with one short line describing what you changed or are doing, so the user sees a confirmation toast on the page.",
      "If window.__annot is missing, the overlay is not loaded — (re)inject it per the annotate skill before continuing.",
    ].join(" "),
  }
);

// --- tools -----------------------------------------------------------------
mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_endpoint",
      description: "Return this session's annotate channel {url, token} as JSON. Inject url as window.__ANNOT_ENDPOINT and token as window.__ANNOT_TOKEN before the overlay so the toolbar posts to this session and is authorized.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "reply",
      description: "Show a short confirmation toast on the annotated page. One line: what you changed or are doing.",
      inputSchema: {
        type: "object",
        properties: { text: { type: "string", description: "One short line to show the user." } },
        required: ["text"],
      },
    },
  ],
}));

mcp.setRequestHandler(CallToolRequestSchema, async (req) => {
  if (req.params.name === "get_endpoint") {
    return { content: [{ type: "text", text: JSON.stringify({ url: endpoint, token: TOKEN }) }] };
  }
  if (req.params.name === "reply") {
    const text = String((req.params.arguments || {}).text || "").trim();
    broadcast({ type: "toast", text });
    return { content: [{ type: "text", text: "shown" }] };
  }
  throw new Error(`unknown tool: ${req.params.name}`);
});

await mcp.connect(new StdioServerTransport());

// --- inbound (overlay -> Claude): HTTP listener ----------------------------
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (req.method === "OPTIONS") { res.writeHead(204, CORS); return res.end(); }

  // Everything except the health check requires this session's token.
  if (url.pathname !== "/health" && url.searchParams.get("t") !== TOKEN) {
    res.writeHead(403, { ...CORS, "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: false, error: "forbidden" }));
  }

  // overlay subscribes here for reply toasts
  if (req.method === "GET" && url.pathname === "/events") {
    res.writeHead(200, { ...CORS, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" });
    res.write(": connected\n\n");
    listeners.add(res);
    req.on("close", () => listeners.delete(res));
    return;
  }

  // overlay's health ping (lets it tell "channel not running" from a real error)
  if (req.method === "GET" && url.pathname === "/health") {
    res.writeHead(200, { ...CORS, "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true }));
  }

  // overlay Send -> push a channel event into the session
  if (req.method === "POST" && url.pathname === "/send") {
    let body = "";
    req.on("data", (c) => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on("end", async () => {
      let info = {};
      try { info = JSON.parse(body || "{}"); } catch (e) {}
      const pageUrl = String(info.url || "");
      const marks = String(info.notes ?? "");
      try {
        await mcp.notification({
          method: "notifications/claude/channel",
          params: {
            content: `User submitted UI annotations (${marks} mark${marks === "1" ? "" : "s"})${pageUrl ? " on " + pageUrl : ""}. Capture and incorporate them now.`,
            meta: { url: pageUrl, marks },
          },
        });
      } catch (e) { process.stderr.write(`annotate: notify failed: ${e}\n`); }
      res.writeHead(200, { ...CORS, "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }

  res.writeHead(404, CORS); res.end("not found");
});

// If a pinned ANNOTATE_PORT is busy, fall back to an ephemeral port rather than
// crashing the whole MCP server (which shows up as "Failed to reconnect … -32000").
server.on("error", (e) => {
  if (e && e.code === "EADDRINUSE" && FIXED_PORT !== 0) {
    process.stderr.write(`annotate: port ${FIXED_PORT} busy, using an ephemeral port\n`);
    server.listen(0, "127.0.0.1");
  } else {
    process.stderr.write(`annotate: http server error: ${e}\n`);
  }
});

server.listen(FIXED_PORT, "127.0.0.1", () => {
  endpoint = `http://localhost:${server.address().port}`;
  process.stderr.write(`annotate channel: ${endpoint}\n`);
});
