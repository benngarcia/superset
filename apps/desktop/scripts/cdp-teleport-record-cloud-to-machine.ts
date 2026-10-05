/**
 * Record a teleport out of a cloud sandbox onto this device, as one
 * continuous screencast: right-click the cloud row, pick this device, let
 * the move run, open the new worktree, and ask its arrival terminal what
 * landed.
 *
 *   ROW_TEXT="cloud source" bun run scripts/cdp-teleport-record-cloud-to-machine.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";

const PORT = process.env.RENDERER_REMOTE_DEBUG_PORT ?? "9222";
const VITE_PORT = process.env.DESKTOP_VITE_PORT ?? "3005";
const ROW_TEXT = process.env.ROW_TEXT ?? "cloud source";
const OUT = process.env.OUT_DIR ?? "/tmp/teleport-cloud-to-machine-rec";
mkdirSync(OUT, { recursive: true });

const targets: Array<{
	type: string;
	url: string;
	webSocketDebuggerUrl?: string;
}> = await fetch(`http://127.0.0.1:${PORT}/json/list`).then((r) => r.json());
const page = targets.find(
	(t) => t.type === "page" && t.url.includes(`localhost:${VITE_PORT}`),
);
if (!page?.webSocketDebuggerUrl) throw new Error("no matching renderer");

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve) => {
	socket.onopen = resolve;
});
let nextId = 1;
const pending = new Map<number, (v: unknown) => void>();
const frames: Array<{ file: string; t: number }> = [];
const t0 = Date.now();
socket.onmessage = (event) => {
	const message = JSON.parse(String(event.data));
	if (message.method === "Page.screencastFrame") {
		const t = Date.now() - t0;
		const file = `${OUT}/frame-${String(t).padStart(7, "0")}.jpg`;
		writeFileSync(file, Buffer.from(message.params.data, "base64"));
		frames.push({ file, t });
		send("Page.screencastFrameAck", { sessionId: message.params.sessionId });
		return;
	}
	pending.get(message.id)?.(message);
	pending.delete(message.id);
};
// biome-ignore lint/suspicious/noExplicitAny: raw CDP envelopes
function send(method: string, params: unknown = {}): Promise<any> {
	const id = nextId++;
	socket.send(JSON.stringify({ id, method, params }));
	return new Promise((resolve) => pending.set(id, resolve as never));
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const since = () => `t+${((Date.now() - t0) / 1000).toFixed(1)}s`;
async function evaluate(expression: string) {
	const r = await send("Runtime.evaluate", {
		expression,
		awaitPromise: true,
		returnByValue: true,
	});
	return r.result?.result?.value;
}
type Point = { x: number; y: number };
async function click(at: Point, button: "left" | "right" = "left") {
	await send("Input.dispatchMouseEvent", {
		type: "mouseMoved",
		x: at.x,
		y: at.y,
	});
	await wait(200);
	await send("Input.dispatchMouseEvent", {
		type: "mousePressed",
		x: at.x,
		y: at.y,
		button,
		buttons: button === "left" ? 1 : 2,
		clickCount: 1,
	});
	await wait(70);
	await send("Input.dispatchMouseEvent", {
		type: "mouseReleased",
		x: at.x,
		y: at.y,
		button,
		buttons: 0,
		clickCount: 1,
	});
}
async function typeText(text: string) {
	await send("Input.insertText", { text });
	await wait(400);
}
async function pressEnter() {
	await send("Input.dispatchKeyEvent", {
		type: "keyDown",
		key: "Enter",
		code: "Enter",
		windowsVirtualKeyCode: 13,
		text: "\r",
		unmodifiedText: "\r",
	});
	await send("Input.dispatchKeyEvent", {
		type: "keyUp",
		key: "Enter",
		code: "Enter",
		windowsVirtualKeyCode: 13,
	});
}
async function find(
	selector: string,
	needle: string,
	predicate = "true",
): Promise<Point | null> {
	return evaluate(`(() => {
    const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find(e => {
      const r = e.getBoundingClientRect();
      return (e.textContent||'').includes(${JSON.stringify(needle)}) && r.width > 0 && (${predicate});
    });
    if (!el) return null; const r = el.getBoundingClientRect();
    return { x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) };
  })()`);
}
async function waitFor(
	selector: string,
	needle: string,
	ms: number,
	predicate = "true",
): Promise<Point | null> {
	const until = Date.now() + ms;
	while (Date.now() < until) {
		const at = await find(selector, needle, predicate);
		if (at) return at;
		await wait(400);
	}
	return null;
}
async function paneTabs(): Promise<Array<Point & { label: string }>> {
	return evaluate(
		`(() => [...document.querySelectorAll('[data-slot=context-menu-trigger] [data-slot=tooltip-trigger] > span')]
      .map(e => { const r = e.getBoundingClientRect(); return { label: (e.textContent||'').trim(), x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2), w: r.width }; })
      .filter(t => t.y < 50 && t.x > 280 && t.w > 0 && t.label.length > 0)
      .sort((a, b) => a.x - b.x))()`,
	);
}
async function snapshot(name: string) {
	const s = await send("Page.captureScreenshot", { format: "png" });
	if (s.result?.data)
		writeFileSync(`${OUT}/${name}.png`, Buffer.from(s.result.data, "base64"));
}
const dialogText = () =>
	evaluate(
		`(() => { const d = document.querySelector('[data-slot=dialog-content]'); return d ? d.innerText : null; })()`,
	);
const stepsDone = (): Promise<number> =>
	evaluate(
		"document.querySelectorAll('[data-slot=dialog-content] svg.lucide-check').length",
	);

await send("Page.enable");
await send("Runtime.enable");
await send("Page.startScreencast", {
	format: "jpeg",
	quality: 80,
	maxWidth: 1920,
	maxHeight: 1108,
	everyNthFrame: 2,
});
console.log("recording…");
await wait(1500);

console.log("1. right-click the cloud row");
const row = await find(
	"span, div",
	ROW_TEXT,
	`r.x < 280 && e.children.length === 0 && (e.textContent||'').trim().startsWith(${JSON.stringify(ROW_TEXT)})`,
);
if (!row) throw new Error(`no sidebar row named ${ROW_TEXT}`);
await click(row, "right");
const item = await waitFor("[role=menuitem]", "Teleport", 6000);
if (!item) throw new Error("Teleport… not in the context menu");
await wait(1000);
console.log("2. Teleport…");
await click(item);
await waitFor("[data-slot=dialog-content]", "Teleport", 8000);
await wait(1500);

console.log("3. pick this device");
const firstHost = await waitFor(
	"[data-slot=dialog-content] button[aria-pressed]",
	"",
	6000,
);
if (!firstHost) throw new Error("no host offered");
await click(firstHost);
await wait(800);
console.log(
	"   picked:",
	(await dialogText())?.split("\n").slice(2, 4).join(" | "),
);
const review = await waitFor(
	"[data-slot=dialog-content] button",
	"Review",
	4000,
);
if (!review) throw new Error("no Review button");
await click(review);
console.log("4. plan (the sandbox answers with a probe in its own terminal)");
const planned = await waitFor("[data-slot=dialog-content]", "Branch", 90000);
console.log(
	"   plan:",
	planned ? "rendered" : "missing",
	JSON.stringify((await dialogText())?.slice(0, 260)),
);
await snapshot("01-plan");
await wait(3000);

console.log("5. Teleport");
const go = await waitFor("[data-slot=dialog-content] button", "Teleport", 4000);
if (!go) throw new Error("no Teleport button");
await click(go);
const started = Date.now();
let doneCount = -1;
let openThere: Point | null = null;
while (Date.now() - started < 10 * 60_000) {
	const done = await stepsDone();
	if (done !== doneCount) {
		doneCount = done;
		console.log(
			`   t+${((Date.now() - started) / 1000).toFixed(1)}s steps done: ${done}`,
		);
	}
	const text = (await dialogText()) ?? "";
	if (/failed/i.test(text)) {
		await snapshot("02-failed");
		console.log("   FAILED:", text.slice(0, 400));
		break;
	}
	openThere = await evaluate(`(() => {
    const b = [...document.querySelectorAll('[data-slot=dialog-content] button')].find(e => /Open on/.test(e.textContent||''));
    if (!b || b.disabled) return null; const r = b.getBoundingClientRect();
    return { x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) };
  })()`);
	if (openThere) break;
	await wait(500);
}
await snapshot("02-steps-done");

if (openThere) {
	console.log("6. Open on this device");
	await wait(2000);
	await click(openThere);
	let tabs: Array<Point & { label: string }> = [];
	const tabDeadline = Date.now() + 3 * 60_000;
	while (Date.now() < tabDeadline && tabs.length === 0) {
		tabs = await paneTabs();
		if (tabs.length === 0) await wait(1000);
	}
	console.log("   tabs:", tabs.map((t) => t.label).join(" | "));
	await wait(4000);
	// The host ran the project's setup in its own pane; the arrival terminal
	// is the first plain "Terminal".
	const arrivalTab = tabs.find((tab) => tab.label === "Terminal") ?? tabs[0];
	if (arrivalTab) await click(arrivalTab);
	await wait(800);
	await click({ x: 900, y: 500 });
	await wait(400);
	await typeText(
		"echo \"TELEPORT_VERIFY $(git status --porcelain=v1 --untracked-files=all | wc -l | tr -d ' ') files on $(git branch --show-current) in $(pwd)\"; cat CLOUD_NOTES.md",
	);
	await pressEnter();
	const proofDeadline = Date.now() + 20_000;
	let line: string | null = null;
	while (Date.now() < proofDeadline && !line) {
		line = await evaluate(
			"(() => { const m = document.body.innerText.match(/TELEPORT_VERIFY \\d+ files on \\S+ in \\S+/); return m ? m[0] : null; })()",
		);
		if (!line) await wait(500);
	}
	console.log(`   ${since()} destination verifies live:`, line ? "YES" : "no");
	console.log("   ", line);
	await wait(3000);
	await snapshot("03-destination");
	await wait(6000);
	const latest = await paneTabs();
	const agentTab = latest.at(-1);
	if (agentTab && latest.length > 1) {
		console.log("7. resumed agent pane:", agentTab.label);
		await click(agentTab);
		await wait(8000);
		await snapshot("04-resumed-agent");
	}
}

await send("Page.stopScreencast");
writeFileSync(`${OUT}/frames.json`, JSON.stringify(frames));
console.log(
	`frames: ${frames.length}, duration ${((Date.now() - t0) / 1000).toFixed(1)}s`,
);
socket.close();
