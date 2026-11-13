<script>
  import { user, authHeaders, readJson, openAuth, copyToClipboard, fmtDate } from "../lib/app.js";

  let pw = "";
  let unlocked = false;
  let rows = [];
  let busy = false;
  let error = "";
  let copied = "";

  $: pending = rows.filter(function (r) { return r.status === "pending"; });
  $: done = rows.filter(function (r) { return r.status !== "pending"; });

  function usd(n) {
    return "$" + (Number(n) || 0).toFixed(2);
  }

  function isUsdt(r) {
    return r.payout_method === "usdt_trc20";
  }

  function addr(r) {
    return r.payout_address || r.upi_id || "";
  }

  function upiLink(r) {
    return "upi://pay?pa=" + addr(r) + "&pn=" + encodeURIComponent("ClauseRadar affiliate") + "&cu=INR&tn=" + encodeURIComponent("ClauseRadar referral payout");
  }

  async function call(action, extra) {
    const headers = await authHeaders();
    headers["x-admin-password"] = pw;
    const r = await fetch("/api/admin-payouts", { method: "POST", headers: headers, body: JSON.stringify(Object.assign({ action: action }, extra || {})) });
    const d = await readJson(r);
    if (!r.ok) throw new Error(d.error || "Request failed (HTTP " + r.status + ")");
    return d;
  }

  async function unlock(e) {
    if (e) e.preventDefault();
    error = "";
    busy = true;
    try {
      const d = await call("list");
      rows = d.payouts || [];
      unlocked = true;
    } catch (err) {
      error = err && err.message ? err.message : "Could not unlock.";
      unlocked = false;
    } finally {
      busy = false;
    }
  }

  async function act(id, action) {
    if (action === "reject" && !window.confirm("Reject this payout and refund the balance to the user?")) return;
    if (action === "approve" && !window.confirm("Approve only AFTER you have sent the money. Continue?")) return;
    error = "";
    busy = true;
    try {
      await call(action, { id: id });
      const d = await call("list");
      rows = d.payouts || [];
    } catch (err) {
      error = err && err.message ? err.message : "Action failed.";
    } finally {
      busy = false;
    }
  }

  function lock() {
    pw = "";
    unlocked = false;
    rows = [];
  }

  async function copy(id, text) {
    await copyToClipboard(text);
    copied = id;
    setTimeout(function () { if (copied === id) copied = ""; }, 1600);
  }
</script>

<div class="wrap narrow page">
  <h1 class="h2">Admin: payouts</h1>

  {#if !$user}
    <section class="card">
      <p style="margin:0 0 12px">Log in first, then enter the admin password.</p>
      <button class="btn primary block" on:click={() => openAuth("login", "Log in to open the admin panel.")}>Log in</button>
    </section>
  {:else if !unlocked}
    <section class="card">
      <form on:submit={unlock}>
        <label for="ad-pw">Admin password</label>
        <input id="ad-pw" type="password" bind:value={pw} autocomplete="off" required />
        <button class="btn primary block" type="submit" disabled={busy}>{busy ? "Checking..." : "Unlock"}</button>
      </form>
      {#if error}<div class="error" role="alert">⚠️ {error}</div>{/if}
    </section>
  {:else}
    <div class="row between">
      <span class="muted small">{pending.length} pending • {done.length} processed</span>
      <button class="btn sm mfull" on:click={lock}>Lock</button>
    </div>
    {#if error}<div class="error" role="alert">⚠️ {error}</div>{/if}

    <h3 class="sub">Pending</h3>
    {#each pending as r (r.id)}
      <article class="card">
        <div class="row between" style="margin-bottom:4px">
          <b class="num" style="font-size:1.4rem">{usd(r.amount)}</b>
          <span class="badge med"><i class="dot"></i>Pending ⏳</span>
        </div>
        <div style="margin:2px 0 6px">
          <span class={"mbadge " + (isUsdt(r) ? "mb-usdt" : "")}>{isUsdt(r) ? "USDT TRC20" : "UPI"}</span>
          {#if r.legacy_inr}<span class="muted small"> (requested earlier as ₹{r.legacy_inr})</span>{/if}
        </div>
        <div class="muted small" style="overflow-wrap:anywhere">{r.email} • {fmtDate(r.created_at)}</div>
        <div class="row" style="margin:10px 0 6px">
          <b style="overflow-wrap:anywhere;word-break:break-all">{addr(r)}</b>
          <button class="btn sm" on:click={() => copy(r.id, addr(r))}>{copied === r.id ? "Copied ✓" : (isUsdt(r) ? "Copy USDT Address" : "Copy UPI")}</button>
        </div>
        {#if isUsdt(r)}
          {#if r.address_ok === false}<div class="error" role="alert">⚠️ This address fails the TRON checksum. Do NOT send. Reject it so the user can retry.</div>{:else}<p class="muted small" style="margin:0 0 8px">Address checksum OK. Send USDT on the TRON (TRC20) network only.</p>{/if}
          <a class="btn block" href={"https://tronscan.org/#/address/" + addr(r)} target="_blank" rel="noopener noreferrer">View address on TronScan</a>
        {:else}
          <a class="btn block" href={upiLink(r)}>Pay via UPI app (enter the rupee amount for {usd(r.amount)})</a>
        {/if}
        <div class="row" style="margin:10px 0 0">
          <button class="btn primary mfull" on:click={() => act(r.id, "approve")} disabled={busy}>Approve ✅</button>
          <button class="btn mfull" on:click={() => act(r.id, "reject")} disabled={busy}>Reject ❌</button>
        </div>
        {#if r.evidence && r.evidence.length}
          <details class="faq" style="margin-top:12px">
            <summary>Referral sales behind this balance ({r.evidence.length})</summary>
            <p class="small">Check these Whop payment IDs (pay_...) in your Whop dashboard before approving.</p>
            {#each r.evidence as ev}
              <div class="payrow">
                <span class="small" style="overflow-wrap:anywhere">{ev.txn_id || "no payment id"} • {fmtDate(ev.created_at)}{ev.reversed ? " • reversed" : ""}</span>
                <b class="num small">{usd(ev.sale_amount)} → {usd(ev.commission_amount)}</b>
              </div>
            {/each}
          </details>
        {/if}
      </article>
    {/each}
    {#if pending.length === 0}<section class="card"><p class="muted" style="margin:0">No pending payouts.</p></section>{/if}

    <h3 class="sub">Processed</h3>
    {#each done as r (r.id)}
      <div class="payrow">
        <div style="min-width:0">
          <b class="num">{usd(r.amount)}</b> <span class={"mbadge " + (isUsdt(r) ? "mb-usdt" : "")}>{isUsdt(r) ? "USDT TRC20" : "UPI"}</span>
          <div class="muted small" style="overflow-wrap:anywhere">{r.email} • {addr(r)}</div>
        </div>
        {#if r.status === "approved"}
          <span class="badge low"><i class="dot"></i>Approved ✅ {fmtDate(r.approved_at)}</span>
        {:else}
          <span class="badge high"><i class="dot"></i>Rejected ❌</span>
        {/if}
      </div>
    {/each}
  {/if}
</div>
