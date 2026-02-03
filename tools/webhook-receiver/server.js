const express = require("express");
const crypto = require("crypto");

const app = express();

// IMPORTANT: raw body lazım (HMAC için byte-byte aynı olmalı)
app.use(
  "/callback",
  express.raw({
    type: "*/*",
    limit: "2mb",
  })
);

function hmacSha256Hex(secret, rawBodyBuffer) {
  return crypto.createHmac("sha256", secret).update(rawBodyBuffer).digest("hex");
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "webhook-receiver" });
});

app.post("/callback", (req, res) => {
  const secret = String(process.env.WEBHOOK_SECRET ?? "");
  const sigHeader = String(req.headers["x-integration-webhook-signature"] ?? "");
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");

  const expected = secret ? `sha256=${hmacSha256Hex(secret, raw)}` : null;
  const ok = expected ? sigHeader === expected : null; // secret yoksa kıyas yapmayız

  // Logları net görelim diye
  console.log("---- webhook received ----");
  console.log("time:", new Date().toISOString());
  console.log("signature header:", sigHeader || "(missing)");
  if (expected) console.log("signature expected:", expected, "match:", ok);
  console.log("content-type:", req.headers["content-type"]);
  console.log("user-agent:", req.headers["user-agent"]);
  console.log("body:", raw.toString("utf8"));
  console.log("--------------------------");

  // İstersen bu response'u da okuyabilirler
  res.status(200).json({
    ok: true,
    signatureVerified: expected ? ok : null,
  });
});

const port = Number(process.env.PORT ?? 8088);
app.listen(port, "0.0.0.0", () => {
  console.log(`[webhook-receiver] listening on :${port}`);
});
