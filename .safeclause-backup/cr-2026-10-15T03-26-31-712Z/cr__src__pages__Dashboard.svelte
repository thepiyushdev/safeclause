<script>
  import { onDestroy } from "svelte";
  import { user, credits, MAX_CHARS, authHeaders, readJson, openAuth, openPay, deriveScore, catLabel, fmt } from "../lib/app.js";
  import { SAMPLE_CONTRACTS } from "../lib/data.mjs";
  import { openReport } from "../lib/report.js";
  import ClauseCard from "../lib/ClauseCard.svelte";
  import RiskBadge from "../lib/RiskBadge.svelte";
  import RiskGauge from "../lib/RiskGauge.svelte";
  import DisclaimerBanner from "../lib/DisclaimerBanner.svelte";

  const MAX_FILE = 10 * 1024 * 1024;
  const STEPS = ["Reading your document", "Detecting risky clauses", "Scoring severity", "Drafting safer rewrites"];

  let jur = "india";
  let text = "";
  let drag = false;
  let fileInfo = null;
  let fileInput;
  let readingFile = false;
  let loading = false;
  let step = 0;
  let timer = null;
  let error = "";
  let result = null;
  let unlockedData = {};
  let unlocking = false;
  let unlockError = "";
  let cat = "All";

  $: flagged = result && Array.isArray(result.flagged_clauses) ? result.flagged_clauses : [];
  $: score = result ? deriveScore(result) : 0;
  $: highCount = flagged.filter(function (c) { return c.risk_level === "HIGH"; }).length;
  $: allUnlocked = flagged.length > 0 && flagged.every(function (c, i) { return !!unlockedData[i]; });
  $: cats = ["All"].concat(flagged.map(function (c) { return catLabel(c.category); }).filter(function (v, i, a) { return a.indexOf(v) === i; }));
  $: shown = flagged.map(function (c, i) { return { c: c, i: i }; }).filter(function (x) { return cat === "All" || catLabel(x.c.category) === cat; });
  $: unlockLabel = $credits < 1 ? "Unlock All Clauses for ₹49 (Get 1 Credit) ⚡" : "Use 1 Credit to Unlock All Clauses (Balance: " + $credits + ") ⚡";

  onDestroy(function () { if (timer) clearInterval(timer); });

  /* ---------- reading files ---------- */
  function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    return new Promise(function (resolve, reject) {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      s.onload = function () {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        resolve(window.pdfjsLib);
      };
      s.onerror = function () { reject(new Error("Could not load the PDF reader. Check your internet.")); };
      document.head.appendChild(s);
    });
  }

  async function readPdf(file) {
    const lib = await loadPdfJs();
    const doc = await lib.getDocument({ data: await file.arrayBuffer() }).promise;
    let out = "";
    const pages = Math.min(doc.numPages, 30);
    for (let p = 1; p <= pages && out.length < MAX_CHARS * 2; p++) {
      const page = await doc.getPage(p);
      const tc = await page.getTextContent();
      out += tc.items.map(function (it) { return it.str; }).join(" ") + "\n";
    }
    return out;
  }

  // A .docx is a zip file. We read word/document.xml straight from it, no extra library needed.
  async function readDocx(file) {
    const buf = await file.arrayBuffer();
    const dv = new DataView(buf);
    const u8 = new Uint8Array(buf);
    const dec = new TextDecoder();
    let eocd = -1;
    for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error("This DOCX file could not be read. Paste the text instead.");
    const count = dv.getUint16(eocd + 10, true);
    let p = dv.getUint32(eocd + 16, true);
    for (let n = 0; n < count; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true);
      const csize = dv.getUint32(p + 20, true);
      const nlen = dv.getUint16(p + 28, true);
      const elen = dv.getUint16(p + 30, true);
      const clen = dv.getUint16(p + 32, true);
      const off = dv.getUint32(p + 42, true);
      const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
      if (name === "word/document.xml") {
        const start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
        const data = u8.subarray(start, start + csize);
        let bytes;
        if (method === 0) {
          bytes = data;
        } else if (method === 8) {
          if (typeof DecompressionStream === "undefined") throw new Error("This browser cannot open DOCX files. Paste the text instead.");
          const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
          bytes = new Uint8Array(await new Response(stream).arrayBuffer());
        } else {
          throw new Error("Unsupported DOCX compression. Paste the text instead.");
        }
        return dec.decode(bytes)
          .replace(/<\/w:p>/g, "\n")
          .replace(/<w:tab\/>/g, " ")
          .replace(/<[^>]+>/g, "")
          .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
      }
      p += 46 + nlen + elen + clen;
    }
    throw new Error("No text found in this DOCX. Paste the text instead.");
  }

  async function handleFile(f) {
    if (!f) return;
    error = "";
    fileInfo = null;
    if (f.size > MAX_FILE) { error = "File is too large (max 10 MB)."; return; }
    const name = f.name || "document";
    const lower = name.toLowerCase();
    readingFile = true;
    try {
      let out = "";
      if (lower.endsWith(".pdf") || f.type === "application/pdf") out = await readPdf(f);
      else if (lower.endsWith(".docx")) out = await readDocx(f);
      else if (lower.endsWith(".txt") || lower.endsWith(".md") || (f.type || "").indexOf("text/") === 0) out = await f.text();
      else throw new Error("Unsupported file type. Use PDF, DOCX or TXT, or paste the text.");
      out = out.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
      if (!out) throw new Error("No readable text found. Scanned PDFs are not supported yet, so paste the text instead.");
      text = out.slice(0, MAX_CHARS);
      fileInfo = { name: name, size: f.size, chars: out.length, truncated: out.length > MAX_CHARS };
    } catch (e) {
      error = e && e.message ? e.message : "Could not read this file.";
    } finally {
      readingFile = false;
      if (fileInput) fileInput.value = "";
    }
  }

  function onDrop(e) {
    e.preventDefault();
    drag = false;
    handleFile(e.dataTransfer && e.dataTransfer.files ? e.dataTransfer.files[0] : null);
  }
  function onDragOver(e) { e.preventDefault(); drag = true; }
  function onPick(e) { handleFile(e.target.files ? e.target.files[0] : null); }
  function openPicker() { if (fileInput) fileInput.click(); }

  function loadSample(key) {
    text = SAMPLE_CONTRACTS[key];
    jur = key === "india" ? "india" : "global";
    fileInfo = null;
    error = "";
  }

  /* ---------- scan ---------- */
  // The jurisdiction is passed to the AI as a short note placed before the contract text.
  function jurisdictionNote() {
    if (jur === "india") {
      return "[AUDITOR NOTE - not part of the contract: the freelancer works under Indian law. Consider the Indian Contract Act 1872 (for example restraint-of-trade clauses) and MSMED Act 2006 payment-period norms (45 days) when judging risk and writing counter-clauses. Never quote this note.]\n\n";
    }
    return "[AUDITOR NOTE - not part of the contract: the freelancer works remotely under US, UK or international terms. Prefer standard Net-14 or Net-30 payment, IP assignment only after full payment, and a liability cap equal to fees paid. Never quote this note.]\n\n";
  }

  async function scan() {
    error = "";
    const t = text.trim();
    if (t.length < 50) { error = "Paste or upload your contract first (at least a few lines)."; return; }
    loading = true;
    step = 0;
    result = null;
    unlockedData = {};
    unlockError = "";
    cat = "All";
    timer = setInterval(function () { if (step < STEPS.length - 1) step += 1; }, 1400);
    try {
      const note = jurisdictionNote();
      const payload = note + t.slice(0, MAX_CHARS - note.length);
      const r = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: payload, jurisdiction: jur }),
      });
      const data = await readJson(r);
      if (!r.ok) throw new Error(data.error || "Server error (HTTP " + r.status + ")");
      result = data;
      setTimeout(function () {
        const el = document.getElementById("results");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    } catch (err) {
      error = err && err.message ? err.message : "Something went wrong. Please try again.";
    } finally {
      if (timer) clearInterval(timer);
      timer = null;
      loading = false;
    }
  }

  // 1 credit unlocks EVERY flagged clause of this audit in a single request.
  async function unlockAll() {
    error = "";
    if (!$user) { openAuth("login", "Log in to unlock. Your credits are saved to your account."); return; }
    if ($credits < 1) { openPay(1); return; }
    if (flagged.length === 0 || unlocking) return;
    unlocking = true;
    unlockError = "";
    try {
      const headers = await authHeaders();
      if (headers.Authorization === "Bearer ") throw new Error("Session expired. Please log in again.");
      const tokens = flagged.map(function (c) { return c.locked_token; });
      const r = await fetch("/api/unlock", { method: "POST", headers: headers, body: JSON.stringify({ tokens: tokens }) });
      const data = await readJson(r);
      if (r.status === 401) throw new Error("Session expired. Please log in again.");
      if (!r.ok || !data.success || !Array.isArray(data.unlocked)) {
        throw new Error(data.error || "Unlock failed (HTTP " + r.status + ").");
      }
      const map = {};
      data.unlocked.forEach(function (u) { map[u.index] = u; });
      unlockedData = map;
      credits.set(data.credits);
    } catch (err) {
      let msg = err && err.message ? err.message : "Unlock failed.";
      if (err instanceof TypeError) msg = "Network error. Check your connection and try again.";
      unlockError = msg;
    } finally {
      unlocking = false;
    }
  }

  function exportPdf() {
    const ok = openReport({ result: result, unlockedData: unlockedData, jur: jur, score: score });
    if (!ok) error = "Allow pop-ups for this site to download the PDF report.";
  }
</script>

<div class="wrap narrow page">
  <h1 class="h2">Contract scanner</h1>
  <p class="muted">Drop a contract to get a risk score, flagged clauses and safer rewrites.</p>

  <div class="seg" role="group" aria-label="Jurisdiction">
    <button class:on={jur === "india"} on:click={() => (jur = "india")}>🇮🇳 India <span class="muted small">(Act 1872 / MSMED)</span></button>
    <button class:on={jur === "global"} on:click={() => (jur = "global")}>🌐 US / UK / Global</button>
  </div>

  <section class="card">
    <div class="drop" class:drag role="button" tabindex="0" on:click={openPicker} on:keydown={(e) => { if (e.key === "Enter") openPicker(); }} on:dragover={onDragOver} on:dragleave={() => (drag = false)} on:drop={onDrop}>
      <div class="big" aria-hidden="true">📄</div>
      <b>{readingFile ? "Reading document..." : "Drop a PDF, DOCX or TXT here"}</b>
      <div class="muted small">or tap to browse • max 10 MB</div>
    </div>
    <input type="file" accept=".pdf,.docx,.txt,.md,application/pdf" bind:this={fileInput} on:change={onPick} hidden />

    {#if fileInfo}
      <div class="fileinfo">
        <span>📎 <b>{fileInfo.name}</b></span>
        <span class="num">{Math.max(1, Math.round(fileInfo.size / 1024))} KB • {fileInfo.chars.toLocaleString("en-IN")} characters read</span>
        {#if fileInfo.truncated}<span class="badge med">Only the first {MAX_CHARS.toLocaleString("en-IN")} characters are analysed</span>{/if}
      </div>
    {/if}

    <label for="ct">…or paste the contract text</label>
    <textarea id="ct" bind:value={text} rows="9" maxlength={MAX_CHARS} placeholder="Paste your client contract here..."></textarea>
    <div class="muted small num" style="margin:0 0 10px">{text.length} / {MAX_CHARS}</div>
    <div class="row">
      <button class="btn sm mfull" on:click={() => loadSample("india")}>Sample India</button>
      <button class="btn sm mfull" on:click={() => loadSample("us")}>Sample US</button>
    </div>

    <button class="btn primary lg block" style="margin-top:12px" on:click={scan} disabled={loading || readingFile}>
      {loading ? "Scanning..." : "Scan contract ⚡"}
    </button>

    {#if loading}
      <div class="scan" aria-live="polite">
        <ul>
          {#each STEPS as s, i}
            <li class:done={i < step} class:now={i === step}>
              {#if i < step}✓{:else if i === step}<span class="spin"></span>{:else}○{/if}
              {s}
            </li>
          {/each}
        </ul>
      </div>
    {/if}
    {#if error}<div class="error" role="alert">⚠️ {error}</div>{/if}
  </section>

  {#if result}
    <section id="results" class="card iri" style="scroll-margin-top:80px">
      <div class="report-head">
        <RiskGauge score={score} level={result.overall_risk_score} />
        <div>
          <div class="row" style="margin-bottom:8px">
            <RiskBadge level={result.overall_risk_score} />
            <span class="muted small num">{flagged.length} flagged • {highCount} high</span>
          </div>
          <p class="pre" style="margin:0 0 10px">{fmt(result.executive_summary)}</p>
          <button class="btn sm mfull" on:click={exportPdf}>📄 {allUnlocked ? "Download full PDF report" : "Download PDF preview"}</button>
        </div>
      </div>
    </section>

    {#if flagged.length > 0 && !allUnlocked}
      <section class="card" style="border-color:#c7d2fe;background:#f5f7ff">
        <b>Unlock all {flagged.length} safer rewrites with one credit</b>
        <p class="muted small" style="margin:4px 0 12px">Includes every counter-proposal email and the full PDF report.</p>
        <button class="btn primary block" on:click={unlockAll} disabled={unlocking}>{unlocking ? "Unlocking all clauses..." : unlockLabel}</button>
        {#if unlockError}<div class="error" role="alert">⚠️ {unlockError}</div>{/if}
      </section>
    {/if}

    {#if cats.length > 2}
      <div class="chips" style="margin-top:16px">
        {#each cats as c}<button class:on={cat === c} on:click={() => (cat = c)}>{c}</button>{/each}
      </div>
    {/if}

    {#each shown as x (x.i)}
      <ClauseCard clause={x.c} unlocked={unlockedData[x.i] || null} startOpen={x.i === 0} unlockLabel={unlockLabel} unlocking={unlocking} unlockError={unlockError} onUnlock={unlockAll} />
    {/each}

    {#if flagged.length === 0}
      <section class="card"><p style="margin:0">No major red flags found in the text you provided. ✅</p></section>
    {/if}
    <div style="margin-top:18px"><DisclaimerBanner /></div>
  {/if}
</div>
