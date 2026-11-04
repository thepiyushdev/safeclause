<script>
  import { user, isPro, authHeaders, readJson, openAuth, openPay, link, saveProject } from "./app.js";

  export let text = "";
  export let jur = "india";

  let step = "idle";
  let error = "";
  let upgrade = false;
  let f = null;

  function toInt(v) {
    const n = parseInt(v, 10);
    return isFinite(n) ? n : null;
  }
  function toNum(v) {
    const n = parseFloat(v);
    return isFinite(n) ? n : null;
  }
  function cap(v, n) {
    return String(v || "").trim().slice(0, n);
  }

  async function start() {
    error = "";
    upgrade = false;
    if (!$user) { openAuth("login", "Log in to save this contract to Contract Memory."); return; }
    if (text.trim().length < 50) { error = "Scan a contract first."; return; }
    step = "reading";
    try {
      const r = await fetch("/api/extract-terms", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ text: text.trim().slice(0, 10000), jurisdiction: jur }),
      });
      const d = await readJson(r);
      if (!r.ok || !d.success) throw new Error(d.error || "Could not read the contract terms.");
      const t = d.terms;
      f = {
        name: t.name || "", client_name: t.client_name || "",
        payment_days: t.payment_days == null ? "" : t.payment_days,
        late_fee_pct_month: t.late_fee_pct_month == null ? "" : t.late_fee_pct_month,
        revision_cap: t.revision_cap == null ? "" : t.revision_cap,
        hourly_rate: t.hourly_rate == null ? "" : t.hourly_rate,
        liability_cap: t.liability_cap || "",
        scope_text: (t.scope_items || []).join("\n"),
        ex_scope: t.excerpts.scope, ex_revision: t.excerpts.revision, ex_payment: t.excerpts.payment, ex_liability: t.excerpts.liability,
      };
      step = "review";
    } catch (e) {
      error = e && e.message ? e.message : "Could not read the contract terms.";
      step = "idle";
    }
  }

  async function save() {
    if (!f.name.trim()) { error = "Give the project a name."; return; }
    error = "";
    upgrade = false;
    step = "saving";
    try {
      await saveProject({
        name: cap(f.name, 120), client_name: cap(f.client_name, 120) || null, jurisdiction: jur,
        payment_days: toInt(f.payment_days), late_fee_pct_month: toNum(f.late_fee_pct_month),
        revision_cap: toInt(f.revision_cap), revisions_used: 0, hourly_rate: toNum(f.hourly_rate),
        liability_cap: cap(f.liability_cap, 160) || null,
        scope_items: f.scope_text.split("\n").map(function (x) { return x.trim().slice(0, 160); }).filter(Boolean).slice(0, 8),
        excerpts: { scope: cap(f.ex_scope, 400), revision: cap(f.ex_revision, 400), payment: cap(f.ex_payment, 400), liability: cap(f.ex_liability, 400) },
      });
      step = "saved";
    } catch (e) {
      error = e && e.message ? e.message : "Could not save the project.";
      upgrade = error.indexOf("Free plan") !== -1;
      step = "review";
    }
  }
</script>

<section class="card">
  <b>Save to Contract Memory (Active Project)</b>
  {#if step === "idle" || step === "reading"}
    <p class="muted small" style="margin:6px 0 12px">Optional. We suggest the key terms from this contract (payment days, revision cap, scope, rates). You review and edit them before anything is saved. Your full contract is never stored. This powers Scope Guard and Payment Chaser.</p>
    <button class="btn primary block" on:click={start} disabled={step === "reading"}>{step === "reading" ? "Reading contract terms..." : "Save to Contract Memory (Active Project)"}</button>
  {:else if step === "review" || step === "saving"}
    <p class="muted small" style="margin:6px 0 12px">Check the details. Only what you keep here is saved. Clear any field you do not want stored.</p>
    <div class="grid2">
      <div><label for="mp-name">Project name</label><input id="mp-name" bind:value={f.name} maxlength="120" /></div>
      <div><label for="mp-client">Client name</label><input id="mp-client" bind:value={f.client_name} maxlength="120" /></div>
      <div><label for="mp-pay">Payment terms (days, e.g. 30 for Net-30)</label><input id="mp-pay" type="number" min="0" inputmode="numeric" bind:value={f.payment_days} /></div>
      <div><label for="mp-late">Late fee (% per month)</label><input id="mp-late" type="number" min="0" step="0.1" inputmode="decimal" bind:value={f.late_fee_pct_month} /></div>
      <div><label for="mp-rev">Revision rounds included</label><input id="mp-rev" type="number" min="0" inputmode="numeric" bind:value={f.revision_cap} /></div>
      <div><label for="mp-rate">Hourly rate ({jur === "india" ? "₹" : "$"})</label><input id="mp-rate" type="number" min="0" inputmode="decimal" bind:value={f.hourly_rate} /></div>
    </div>
    <label for="mp-liab">Liability cap</label>
    <input id="mp-liab" bind:value={f.liability_cap} maxlength="160" />
    <label for="mp-scope">Scope deliverables (one per line)</label>
    <textarea id="mp-scope" rows="4" bind:value={f.scope_text}></textarea>
    <h3 class="sub">Short clause excerpts (max 400 characters each)</h3>
    <label for="mp-ex1">Scope clause</label>
    <textarea id="mp-ex1" rows="3" maxlength="400" bind:value={f.ex_scope}></textarea>
    <label for="mp-ex2">Revision clause</label>
    <textarea id="mp-ex2" rows="3" maxlength="400" bind:value={f.ex_revision}></textarea>
    <label for="mp-ex3">Payment / late fee clause</label>
    <textarea id="mp-ex3" rows="3" maxlength="400" bind:value={f.ex_payment}></textarea>
    <label for="mp-ex4">Liability clause</label>
    <textarea id="mp-ex4" rows="3" maxlength="400" bind:value={f.ex_liability}></textarea>
    <div class="row" style="margin-top:6px">
      <button class="btn primary mfull" on:click={save} disabled={step === "saving"}>{step === "saving" ? "Saving..." : "Save project"}</button>
      <button class="btn mfull" on:click={() => (step = "idle")} disabled={step === "saving"}>Cancel</button>
    </div>
  {:else}
    <div class="ok">✅ Saved. Your project is now active.</div>
    <div class="row" style="margin-top:12px">
      <a class="btn primary mfull" href="/scope-guard" on:click={(e) => link(e, "/scope-guard")}>Open Scope Guard</a>
      <a class="btn mfull" href="/chaser" on:click={(e) => link(e, "/chaser")}>Open Payment Chaser</a>
    </div>
  {/if}
  {#if error}<div class="error" role="alert">⚠️ {error}</div>{/if}
  {#if upgrade}<button class="btn primary block" style="margin-top:10px" on:click={() => openPay("pro_year")}>Upgrade to Pro ⚡</button>{/if}
</section>
