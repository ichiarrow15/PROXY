const cheerio = require("cheerio");

const DEFAULT_HOSTS = ["example.com", "wikipedia.org"];
const MAX_BYTES = 3 * 1024 * 1024;

function allowedHosts() {
  const raw = process.env.ALLOWED_HOSTS || DEFAULT_HOSTS.join(",");
  return raw.split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
}
function isPublicHost(host) {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  // Reject obvious local/private destinations, even if someone misconfigures the allowlist.
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") ||
      h === "127.0.0.1" || h === "::1" || h.startsWith("10.") ||
      h.startsWith("192.168.") || h.startsWith("169.254.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(h) || h === "0.0.0.0") return false;
  return true;
}
function validate(raw, base) {
  let u;
  try { u = new URL(raw, base); } catch { throw new Error("URLが正しくありません"); }
  if (!["http:", "https:"].includes(u.protocol)) throw new Error("HTTP/HTTPS以外は開けません");
  if (u.username || u.password) throw new Error("認証情報付きURLには対応していません");
  if (!isPublicHost(u.hostname)) throw new Error("ローカルネットワークへの接続は許可されていません");
  const ok = allowedHosts().some(d => u.hostname.toLowerCase() === d || u.hostname.toLowerCase().endsWith("." + d));
  if (!ok) throw new Error("このドメインは許可リストにありません");
  return u;
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
function errorPage(message) {
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <body style="background:#07111f;color:#dffaff;font:16px system-ui;padding:28px">
  <main style="max-width:700px;margin:auto;border:1px solid #1685ae;border-radius:16px;padding:22px">
  <h2 style="color:#65e6ff">NEON PROXY · 接続エラー</h2><p>${escapeHtml(message)}</p>
  <p>許可リスト内の公開Webサイトか確認してください。</p></main></body>`;
}
async function fetchPage(url, redirects = 0) {
  if (redirects > 4) throw new Error("リダイレクト回数が上限を超えました");
  const response = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(12000),
    headers: { "User-Agent": "NEON-PROXY/2.0 (web preview)", "Accept": "text/html,application/xhtml+xml" }
  });
  if ([301,302,303,307,308].includes(response.status)) {
    const loc = response.headers.get("location");
    if (!loc) throw new Error("転送先が見つかりません");
    const next = validate(loc, url);
    return fetchPage(next.toString(), redirects + 1);
  }
  const type = response.headers.get("content-type") || "";
  if (!type.toLowerCase().includes("text/html") && !type.toLowerCase().includes("application/xhtml+xml")) {
    throw new Error("この試作版はHTMLページのみ表示できます");
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new Error("ページサイズが3MBを超えました");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { bytes.set(c, offset); offset += c.byteLength; }
  return { status: response.status, html: new TextDecoder("utf-8").decode(bytes) };
}

module.exports = async function handler(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).send("Method Not Allowed");
  }
  try {
    const raw = Array.isArray(req.query.url) ? req.query.url[0] : req.query.url;
    if (!raw) return res.status(400).send(errorPage("URLを指定してください"));
    let target = validate(raw);
    const result = await fetchPage(target.toString());
    const $ = cheerio.load(result.html);
    // This is a constrained preview, not a full browser: active content and form submission are removed.
    $("script, iframe, frame, object, embed, form, portal, template").remove();
    $("base, meta[http-equiv]").remove();
    $("*").each((_, el) => {
      const attrs = el.attribs || {};
      for (const name of Object.keys(attrs)) {
        if (/^on/i.test(name) || name.toLowerCase() === "srcdoc") $(el).removeAttr(name);
        if (["href","src","action","formaction","xlink:href"].includes(name.toLowerCase()) &&
            /^\s*javascript:/i.test(attrs[name] || "")) $(el).removeAttr(name);
      }
    });
    $("form").remove();
    $("a").each((_, el) => {
      const href = $(el).attr("href");
      if (!href || href.startsWith("#")) { $(el).removeAttr("href"); return; }
      try {
        const absolute = new URL(href, target).toString();
        const checked = validate(absolute);
        $(el).attr("href", "/api/view?url=" + encodeURIComponent(checked.toString()));
        $(el).attr("target", "_self");
        $(el).attr("rel", "noopener noreferrer");
      } catch { $(el).removeAttr("href"); }
    });
    $("head").prepend(`<base href="${escapeHtml(target.origin + target.pathname.replace(/[^/]*$/, ""))}">`);
    $("body").prepend(`<div style="position:sticky;top:0;z-index:2147483000;background:#061426;color:#70eaff;border-bottom:1px solid #168fc2;padding:7px 12px;font:12px system-ui">NEON PROXY PREVIEW · scripts / forms / embeds disabled</div>`);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Security-Policy",
      "default-src https: http: data:; script-src 'none'; object-src 'none'; frame-src 'none'; form-action 'none'; connect-src 'none'; base-uri 'self'");
    res.setHeader("Cache-Control", "no-store");
    return res.status(result.status || 200).send($.html());
  } catch (err) {
    return res.status(400).setHeader("Content-Type", "text/html; charset=utf-8").send(errorPage(err.message || "ページを開けませんでした"));
  }
};
