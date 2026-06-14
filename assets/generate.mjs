// Generates Junto submission image assets (logo, cover, screenshots) from inline SVG.
// Run: node assets/generate.mjs   (sharp is a devDependency of ../agent)
import { createRequire } from "node:module";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const sharp = require(join(dirname(fileURLToPath(import.meta.url)), "../agent/node_modules/sharp"));

const OUT = dirname(fileURLToPath(import.meta.url));
mkdirSync(OUT, { recursive: true });

const BG = "#0d1117";
const PANEL = "#161b22";
const LINE = "#30363d";
const TXT = "#e6edf3";
const MUT = "#8b949e";
const A1 = "#6366f1"; // indigo
const A2 = "#a855f7"; // violet
const GO = "#3fb950"; // green

const defs = `
<defs>
  <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="${A1}"/>
    <stop offset="1" stop-color="${A2}"/>
  </linearGradient>
</defs>`;

// Reusable node-graph mark: a parent node linking to children (ENS subname tree).
function mark(cx, cy, s, stroke = "url(#g)") {
  const r = 9 * s;
  const dy = 46 * s, dx = 52 * s;
  const kids = [
    [cx - dx, cy + dy],
    [cx, cy + dy],
    [cx + dx, cy + dy],
  ];
  const links = kids.map(([x, y]) => `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="${stroke}" stroke-width="${3 * s}" stroke-opacity="0.8"/>`).join("");
  const dots = kids.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r * 0.7}" fill="${BG}" stroke="url(#g)" stroke-width="${3 * s}"/>`).join("");
  return `${links}<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#g)"/>${dots}`;
}

async function render(name, svg, w, h) {
  const path = join(OUT, name);
  await sharp(Buffer.from(svg)).resize(w, h).png().toFile(path);
  console.log("wrote", name, `${w}x${h}`);
}

// ---------- Logo 512x512 ----------
const logo = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
${defs}
<rect width="512" height="512" rx="112" fill="${BG}"/>
<rect x="6" y="6" width="500" height="500" rx="106" fill="none" stroke="${LINE}" stroke-width="2"/>
${mark(256, 196, 2.1)}
<text x="256" y="430" font-family="Inter, Arial, sans-serif" font-size="92" font-weight="800" fill="${TXT}" text-anchor="middle">Junto</text>
</svg>`;

// ---------- Cover 1280x720 (16:9) ----------
const cover = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
${defs}
<rect width="1280" height="720" fill="${BG}"/>
<rect width="1280" height="720" fill="url(#g)" opacity="0.06"/>
<text x="96" y="250" font-family="Inter, Arial, sans-serif" font-size="120" font-weight="800" fill="${TXT}">Junto</text>
<text x="100" y="320" font-family="Inter, Arial, sans-serif" font-size="40" font-weight="600" fill="${TXT}">Events &amp; RSVPs, native to ENS.</text>
<text x="100" y="372" font-family="Inter, Arial, sans-serif" font-size="26" fill="${MUT}">Every event is an ENS name. Every ticket is a subname you own.</text>
<rect x="100" y="430" width="600" height="110" rx="12" fill="${PANEL}" stroke="${LINE}"/>
<text x="124" y="478" font-family="ui-monospace, Menlo, monospace" font-size="26" fill="${A2}">alice.ethny.juntoevents.eth</text>
<text x="124" y="514" font-family="ui-monospace, Menlo, monospace" font-size="22" fill="${GO}">xyz.junto.status = "going" ✓</text>
<g transform="translate(1080,330)">${mark(0, -60, 2.7)}</g>
</svg>`;

// ---------- Screenshot 1: name hierarchy ----------
function node(x, y, w, label, sub, accent = false) {
  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="64" rx="10" fill="${PANEL}" stroke="${accent ? A2 : LINE}" stroke-width="${accent ? 2 : 1}"/>
    <text x="${x + 20}" y="${y + 30}" font-family="ui-monospace, Menlo, monospace" font-size="20" fill="${TXT}">${label}</text>
    <text x="${x + 20}" y="${y + 52}" font-family="Inter, Arial, sans-serif" font-size="14" fill="${MUT}">${sub}</text>
  </g>`;
}
const ss1 = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
${defs}
<rect width="1600" height="900" fill="${BG}"/>
<text x="80" y="100" font-family="Inter, Arial, sans-serif" font-size="44" font-weight="800" fill="${TXT}">The ENS name is the database</text>
<text x="80" y="146" font-family="Inter, Arial, sans-serif" font-size="22" fill="${MUT}">No off-chain store. Events and tickets live entirely in ENS.</text>
<line x1="360" y1="290" x2="360" y2="430" stroke="${LINE}" stroke-width="2"/>
<line x1="360" y1="430" x2="360" y2="640" stroke="${LINE}" stroke-width="2"/>
<line x1="360" y1="500" x2="900" y2="500" stroke="${LINE}" stroke-width="2"/>
<line x1="360" y1="610" x2="900" y2="610" stroke="${LINE}" stroke-width="2"/>
${node(120, 240, 480, "juntoevents.eth", "wrapped parent — owned by host", true)}
${node(120, 430, 480, "ethny.juntoevents.eth", "event — metadata in text records", true)}
${node(900, 470, 520, "alice.ethny.juntoevents.eth", "ticket subname — owned by attendee")}
${node(900, 580, 520, "bob.ethny.juntoevents.eth", "ticket subname — owned by attendee")}
</svg>`;

// ---------- Screenshot 2: event as records ----------
function row(y, k, v, vcolor = A2) {
  return `<text x="120" y="${y}" font-family="ui-monospace, Menlo, monospace" font-size="24" fill="${MUT}">${k}</text>
  <text x="640" y="${y}" font-family="ui-monospace, Menlo, monospace" font-size="24" fill="${vcolor}">${v}</text>`;
}
const ss2 = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
${defs}
<rect width="1600" height="900" fill="${BG}"/>
<text x="80" y="100" font-family="Inter, Arial, sans-serif" font-size="44" font-weight="800" fill="${TXT}">Event metadata = ENS text records</text>
<text x="80" y="146" font-family="ui-monospace, Menlo, monospace" font-size="22" fill="${MUT}">ethny.juntoevents.eth</text>
<rect x="80" y="190" width="1440" height="520" rx="14" fill="${PANEL}" stroke="${LINE}"/>
${row(280, "xyz.junto.title", "\"ETHGlobal NY Kickoff\"")}
${row(350, "xyz.junto.location", "\"New York\"")}
${row(420, "xyz.junto.capacity", "\"100\"")}
${row(490, "xyz.junto.status", "\"going\"", GO)}
<line x1="120" y1="540" x2="1480" y2="540" stroke="${LINE}"/>
${row(620, "resolver", "PublicResolver 0xE996…49b5", TXT)}
${row(670, "owner", "host (NameWrapper)", TXT)}
</svg>`;

// ---------- Screenshot 3: agent terminal ----------
const term = [
  ["$ ", "pnpm tsx src/rsvp.ts ethny.juntoevents.eth alice", TXT],
  ["", "Discovering event via ENS resolution...", MUT],
  ["", "  -> \"ETHGlobal NY Kickoff\" in New York (cap 100)", TXT],
  ["", "RSVPing as alice.ethny.juntoevents.eth", MUT],
  ["", "  tx: 0xac5794…93a5", MUT],
  ["", "  mined in block 11055186 (success)", TXT],
  ["", "", TXT],
  ["", "Ticket subname: alice.ethny.juntoevents.eth", TXT],
  ["", "  xyz.junto.status = \"going\"", A2],
  ["", "✅ End-to-end RSVP verified via ENS.", GO],
].map((l, i) => `<text x="60" y="${250 + i * 46}" font-family="ui-monospace, Menlo, monospace" font-size="26" fill="${l[2]}"><tspan fill="${A2}">${l[0]}</tspan>${l[1]}</text>`).join("");
const ss3 = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">
${defs}
<rect width="1600" height="900" fill="${BG}"/>
<text x="80" y="110" font-family="Inter, Arial, sans-serif" font-size="44" font-weight="800" fill="${TXT}">An ENS-named agent RSVPs on your behalf</text>
<rect x="40" y="170" width="1520" height="640" rx="14" fill="#0b0f14" stroke="${LINE}"/>
<circle cx="80" cy="200" r="7" fill="#ff5f56"/><circle cx="104" cy="200" r="7" fill="#ffbd2e"/><circle cx="128" cy="200" r="7" fill="#27c93f"/>
${term}
</svg>`;

await render("logo.png", logo, 512, 512);
await render("cover.png", cover, 1280, 720);
await render("screenshot-1-hierarchy.png", ss1, 1600, 900);
await render("screenshot-2-records.png", ss2, 1600, 900);
await render("screenshot-3-agent.png", ss3, 1600, 900);
console.log("done");
