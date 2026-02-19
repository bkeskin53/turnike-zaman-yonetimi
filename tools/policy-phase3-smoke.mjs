// tools/policy-phase3-smoke.mjs
const BASE = process.env.TURNIKE_BASEURL ?? "http://localhost:3000";
const COOKIE = process.env.TURNIKE_COOKIE; // "turnike_session=..."
if (!COOKIE) {
  console.error("TURNIKE_COOKIE missing. Example: set TURNIKE_COOKIE=turnike_session=...");
  process.exit(1);
}

async function jfetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      ...(opts.headers ?? {}),
      Cookie: COOKIE,
      "Content-Type": "application/json",
    },
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { ok: res.ok, status: res.status, json, text };
}

(async () => {
  // 1) list
  const list1 = await jfetch("/api/policy/rule-sets", { method: "GET", headers: { Cookie: COOKIE } });
  console.log("LIST:", list1.status, list1.json ?? list1.text);

  // 2) create WHITE (idempotent değilse ikinci çalıştırmada 500/unique görebilirsin)
  const create = await jfetch("/api/policy/rule-sets", {
    method: "POST",
    body: JSON.stringify({ code: "WHITE", name: "White Collar" }),
  });
  console.log("CREATE:", create.status, create.json ?? create.text);

  // 3) list again and pick WHITE id
  const list2 = await jfetch("/api/policy/rule-sets", { method: "GET", headers: { Cookie: COOKIE } });
  const items = Array.isArray(list2.json?.items) ? list2.json.items : [];
  const white = items.find((x) => x.code === "WHITE");
  console.log("WHITE:", white);

  console.log("Done. For assignment test, call /api/policy/assignments with employeeId+ruleSetId.");
})();
