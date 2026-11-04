<script>
  import { user, isPro, openAuth, openPay, link, copyToClipboard, projects, invoices, loadProjects, loadInvoices, saveInvoice, markInvoicePaid, deleteInvoice } from "../lib/app.js";
  import DisclaimerBanner from "../lib/DisclaimerBanner.svelte";

  const DAY = 86400000;
  let projectId = "";
  let amount = "";
  let invDate = ymd(new Date());
  let dueDate = "";
  let dueTouched = false;
  let rate = 12;
  let error = "";
  let saving = false;
  let showPaid = false;
  let openId = "";
  let copied = "";

  $: if ($user) { loadProjects(); loadInvoices(); }
  $: if (!projectId && $projects.length) projectId = $projects[0].id;
  $: project = $projects.find(function (p) { return p.id === projectId; }) || null;
  $: if (project && invDate && !dueTouched && project.payment_days != null) dueDate = addDays(invDate, project.payment_days);
  $: list = $invoices.filter(function (i) { return showPaid ? true : !i.paid_at; });
  $: paidCount = $invoices.filter(function (i) { return i.paid_at; }).length;

  function pad(n) { return n < 10 ? "0" + n : String(n); }
  function ymd(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function parse(iso) { return new Date(iso + "T00:00:00"); }
  function addDays(iso, n) { const d = parse(iso); d.setDate(d.getDate() + n); return ymd(d); }
  function diffDays(aIso, bIso) { return Math.round((parse(bIso) - parse(aIso)) / DAY); }
  function today() { return ymd(new Date()); }
  function projectOf(id, list2) { return list2.find(function (p) { return p.id === id; }) || null; }
  function sym(p) { return p && p.jurisdiction === "global" ? "$" : "₹"; }
  function money(n, p) {
    return sym(p) + Math.round(Number(n) || 0).toLocaleString(p && p.jurisdiction === "global" ? "en-US" : "en-IN");
  }

  function track(inv, p, r) {
    const diff = diffDays(today(), inv.due_date);
    const overdue = Math.max(0, -diff);
    const age = diffDays(inv.invoice_date, today());
    const amt = Number(inv.amount) || 0;
    const delay = amt * ((Number(r) || 0) / 100) * (overdue / 365);
    const pct = p && p.late_fee_pct_month != null ? Number(p.late_fee_pct_month) : null;
    const lateFee = pct ? amt * (pct / 100) * (overdue / 30) : null;
    const india = !p || p.jurisdiction !== "global";
    let level = 1;
    if (overdue >= 30 || (india && age > 45 && overdue > 0)) level = 3;
    else if (overdue >= 14) level = 2;
    return { diff: diff, overdue: overdue, age: age, delay: delay, lateFee: lateFee, level: level, paid: !!inv.paid_at };
  }

  function statusText(t) {
    if (t.paid) return "Paid";
    if (t.diff > 0) return "Due in " + t.diff + (t.diff === 1 ? " day" : " days");
    if (t.diff === 0) return "Due today";
    return t.overdue + (t.overdue === 1 ? " day" : " days") + " overdue";
  }
  function statusCls(t) {
    if (t.paid) return "low";
    if (t.overdue >= 14) return "high";
    if (t.overdue > 0 || t.diff <= 3) return "med";
    return "low";
  }

  function letters(inv, p, t) {
    const client = p && p.client_name ? p.client_name : "[Client Name]";
    const name = p ? p.name : "the project";
    const amt = money(inv.amount, p);
    const sign = "\n\nBest regards,\n[Your Name]";
    const days = p && p.payment_days != null ? p.payment_days : null;
    const clause = p && p.excerpts && p.excerpts.payment ? p.excerpts.payment : "";
    const india = !p || p.jurisdiction !== "global";

    const l1 = "Subject: Friendly reminder: invoice for " + name + " due " + inv.due_date + "\n\nHi " + client + ",\n\nHope you are doing well. This is a quick reminder that my invoice for " + name + " (" + amt + ", dated " + inv.invoice_date + ") is due on " + inv.due_date + ".\n\nIf payment is already in process, thank you and please ignore this note. If you need anything from me to release it (a PO number, bank details or a corrected invoice), let me know and I will send it right away." + sign;

    let l2 = "Subject: Overdue invoice for " + name + " (" + amt + ", " + t.overdue + " days past due)\n\nHi " + client + ",\n\nMy invoice for " + name + " (" + amt + ", dated " + inv.invoice_date + ") was due on " + inv.due_date + " and is now " + t.overdue + " days overdue.\n\n";
    if (clause) l2 += "As agreed in our contract: \"" + clause + "\"\n\n";
    else if (days != null) l2 += "Our agreement provides for payment within " + days + " days.\n\n";
    if (t.lateFee) l2 += "Under the contract's late-fee terms, a late fee of about " + money(t.lateFee, p) + " has accrued so far.\n\n";
    l2 += "Please confirm the payment date within 5 business days. If there is an issue with the invoice, tell me today so we can resolve it quickly." + sign;

    let l3 = "Subject: Formal demand for payment: " + name + "\n\nDear " + client + ",\n\nThis is a formal notice that my invoice dated " + inv.invoice_date + " for " + amt + " in respect of " + name + " remains unpaid. It was due on " + inv.due_date + ", and " + t.overdue + " days have passed since the due date.\n\n";
    if (clause) l3 += "The agreement states: \"" + clause + "\"\n\n";
    if (t.lateFee) l3 += "Late charges of about " + money(t.lateFee, p) + " have accrued under the agreement.\n\n";
    if (india) l3 += "I am registered as a micro or small enterprise under the Micro, Small and Medium Enterprises Development Act, 2006 (Udyam Registration No. [UDYAM-XX-00-0000000]). Section 15 of the Act requires payment within the agreed period, which may not exceed 45 days from the day of acceptance of the services, and Section 16 provides for compound interest on delayed payments at three times the bank rate notified by the Reserve Bank of India. I reserve the right to claim this interest and to approach the MSME Facilitation Council.\n\n";
    l3 += "I request payment in full within 7 days of this notice. If payment is not received, I will pursue the remedies available to me under the agreement and applicable law, and the costs of recovery may be claimed from you." + sign;

    return [
      { n: 1, title: "Level 1: Friendly reminder", text: l1, free: true },
      { n: 2, title: "Level 2: Firm reminder (14+ days overdue)", text: l2, free: false },
      { n: 3, title: "Level 3: Formal demand notice", text: l3, free: false, note: india ? "Use the MSMED paragraph only if you are Udyam-registered. This is a draft, not legal advice. Have a CA or lawyer check it before sending." : "This is a draft, not legal advice. Check local rules before sending." },
    ];
  }

  async function add() {
    error = "";
    if (!project) { error = "Select a project first."; return; }
    const amt = parseFloat(amount);
    if (!isFinite(amt) || amt <= 0) { error = "Enter the invoice amount."; return; }
    if (!invDate || !dueDate) { error = "Enter the invoice date and due date."; return; }
    saving = true;
    try {
      await saveInvoice({ project_id: project.id, amount: amt, invoice_date: invDate, due_date: dueDate });
      amount = "";
      dueTouched = false;
    } catch (e) {
      error = e && e.message ? e.message : "Could not save the invoice.";
    } finally {
      saving = false;
    }
  }

  async function paid(inv) {
    try { await markInvoicePaid(inv.id, today()); } catch (e) { error = e.message; }
  }
  async function remove(inv) {
    try { await deleteInvoice(inv.id); } catch (e) { error = e.message; }
  }
  async function copy(id, text) {
    await copyToClipboard(text);
    copied = id;
    setTimeout(function () { if (copied === id) copied = ""; }, 1600);
  }
</script>

<div class="wrap narrow page">
  <h1 class="h2">Payment Chaser</h1>
  <p class="lead" style="margin:0 0 14px;text-align:left">The contract says Net-30. The client is on Day 41. Here's your exact escalation sequence.</p>

  {#if !$user}
    <section class="card">
      <p style="margin:0 0 12px">Log in to track invoices against your saved projects.</p>
      <button class="btn primary block" on:click={() => openAuth("login", "Log in to use Payment Chaser.")}>Log in</button>
    </section>
  {:else if $projects.length === 0}
    <section class="card">
      <b>No active project yet</b>
      <p class="muted small" style="margin:6px 0 12px">Scan a contract and choose Save to Contract Memory. Payment Chaser reads the payment terms and late-fee clause you saved.</p>
      <a class="btn primary block" href="/dashboard" on:click={(e) => link(e, "/dashboard")}>Scan a contract</a>
    </section>
  {:else}
    <section class="card">
      <b>Track an invoice</b>
      <label for="pc-project" style="margin-top:10px">Project</label>
      <select id="pc-project" bind:value={projectId}>
        {#each $projects as p}<option value={p.id}>{p.name}{p.client_name ? " – " + p.client_name : ""}</option>{/each}
      </select>
      <div class="grid2">
        <div><label for="pc-amt">Invoice amount ({sym(project)})</label><input id="pc-amt" type="number" min="0" inputmode="decimal" bind:value={amount} /></div>
        <div><label for="pc-rate">Your cost of money (% per year)</label><input id="pc-rate" type="number" min="0" max="60" inputmode="decimal" bind:value={rate} /></div>
        <div><label for="pc-inv">Invoice date</label><input id="pc-inv" type="date" bind:value={invDate} on:change={() => (dueTouched = false)} /></div>
        <div>
          <label for="pc-due">Due date {project && project.payment_days != null ? "(Net-" + project.payment_days + ", auto)" : ""}</label>
          <input id="pc-due" type="date" bind:value={dueDate} on:input={() => (dueTouched = true)} />
        </div>
      </div>
      <button class="btn primary block" on:click={add} disabled={saving}>{saving ? "Saving..." : "Add invoice"}</button>
      {#if error}<div class="error" role="alert">⚠️ {error}</div>{/if}
      {#if error.indexOf("Free plan") !== -1}<button class="btn primary block" style="margin-top:10px" on:click={() => openPay("pro_year")}>Upgrade to Pro ⚡</button>{/if}
    </section>

    {#each list as inv (inv.id)}
      {@const p = projectOf(inv.project_id, $projects)}
      {@const t = track(inv, p, rate)}
      <article class="card inv">
        <div class="row between" style="margin-bottom:6px">
          <b>{p ? p.name : "Project"}{p && p.client_name ? " – " + p.client_name : ""}</b>
          <span class="badge {statusCls(t)}"><i class="dot"></i>{statusText(t)}</span>
        </div>
        <div class="num" style="font-size:1.4rem;font-weight:800">{money(inv.amount, p)}</div>
        <p class="muted small" style="margin:2px 0 8px">Invoiced {inv.invoice_date} • Due {inv.due_date}</p>
        {#if !t.paid}
          <ul class="lines">
            <li><span>{t.diff >= 0 ? "Days until due" : "Days overdue"}</span><b class="num">{t.diff >= 0 ? t.diff : t.overdue}</b></li>
            <li><span>Cost of delayed capital so far</span><b class="num">{money(t.delay, p)}</b></li>
            {#if t.lateFee}<li><span>Contract late fee accrued</span><b class="num">{money(t.lateFee, p)}</b></li>{/if}
            <li><span>Suggested now</span><b>Level {t.level}</b></li>
          </ul>
        {/if}
        <div class="row">
          {#if !t.paid}<button class="btn sm mfull" on:click={() => (openId = openId === inv.id ? "" : inv.id)}>{openId === inv.id ? "Hide" : "Show"} escalation sequence</button>{/if}
          {#if !t.paid}<button class="btn sm mfull" on:click={() => paid(inv)}>Mark paid</button>{/if}
          <button class="btn sm mfull" on:click={() => remove(inv)}>Delete</button>
        </div>
        {#if openId === inv.id && !t.paid}
          {#each letters(inv, p, t) as L}
            <div class="lvl" class:sug={L.n === t.level}>
              <div class="rw-h">
                <span class="rw-tag">{L.title}{L.n === t.level ? " • suggested" : ""}</span>
                {#if L.free || $isPro}<button class="btn sm" on:click={() => copy(inv.id + L.n, L.text)}>{copied === inv.id + L.n ? "Copied ✓" : "Copy"}</button>{/if}
              </div>
              {#if L.free || $isPro}
                {#if L.note}<p class="muted small" style="margin:0 0 6px">{L.note}</p>{/if}
                <div class="mail">{L.text}</div>
              {:else}
                <div class="locked">
                  <div class="blurred" aria-hidden="true"><div class="mail">Subject: Overdue invoice{"\n\n"}Hi, my invoice was due on the date above and is now overdue. As agreed in our contract...</div></div>
                  <div class="lock-over"><div class="lock-card">
                    <div class="lock-t">🔒 Pro: full legal escalation letters</div>
                    <button class="btn primary block" on:click={() => openPay("pro_year")}>Upgrade to Pro ⚡</button>
                  </div></div>
                </div>
              {/if}
            </div>
          {/each}
        {/if}
      </article>
    {/each}

    {#if paidCount > 0}
      <div class="row" style="margin-top:12px"><button class="btn sm mfull" on:click={() => (showPaid = !showPaid)}>{showPaid ? "Hide" : "Show"} paid invoices ({paidCount})</button></div>
    {/if}
    {#if list.length === 0}
      <section class="card"><p class="muted" style="margin:0">No open invoices. Add one above to start tracking.</p></section>
    {/if}
  {/if}
  <div style="margin-top:18px"><DisclaimerBanner /></div>
</div>
