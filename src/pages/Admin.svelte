<script>
  let adminPassword = "";
  let unlocked = false;
  let loading = false;
  let err = "";
  let payouts = [];
  let wallets = [];
  let referrals = [];

  async function unlockAdmin() {
    err = "";
    loading = true;
    try {
      const r = await fetch("/api/affiliate?action=admin_list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword
        },
        body: JSON.stringify({ action: "admin_list", admin_password: adminPassword })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Invalid password");
      payouts = d.payouts || [];
      wallets = d.wallets || [];
      referrals = d.referrals || [];
      unlocked = true;
    } catch (e) {
      err = e.message;
    } finally {
      loading = false;
    }
  }

  async function updatePayout(payoutId, status) {
    loading = true;
    err = "";
    try {
      const r = await fetch("/api/affiliate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword
        },
        body: JSON.stringify({
          action: "admin_update_payout",
          admin_password: adminPassword,
          payout_id: payoutId,
          status
        })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Update failed");
      await unlockAdmin();
    } catch (e) {
      err = e.message;
    } finally {
      loading = false;
    }
  }
</script>

<div class="admin-wrap">
  {#if !unlocked}
    <div class="lock-card">
      <div class="lock-icon">🔐</div>
      <h1>ClauseRadar Secret Admin Control</h1>
      <p>Restricted strictly to the founder's device. Enter your Admin Master Password to manage affiliate UPI payouts.</p>
      {#if err}
        <div class="err-box">{err}</div>
      {/if}
      <input
        type="password"
        placeholder="Enter Admin Password..."
        bind:value={adminPassword}
        on:keydown={(e) => e.key === "Enter" && unlockAdmin()}
      />
      <button class="btn-unlock" on:click={unlockAdmin} disabled={loading}>
        {loading ? "Verifying..." : "Unlock Admin Dashboard →"}
      </button>
    </div>
  {:else}
    <div class="admin-head">
      <div>
        <h1>⚡ Founder Payout & Affiliate Control</h1>
        <p>Pay affiliates via UPI from your phone and click <strong>Approve ✅</strong> to update their dashboard live.</p>
      </div>
      <button class="btn-refresh" on:click={unlockAdmin}>🔄 Refresh Data</button>
    </div>

    {#if err}
      <div class="err-box">{err}</div>
    {/if}

    <div class="card">
      <h2>💸 UPI Payout Requests ({payouts.filter(p => p.status === 'pending').length} Pending)</h2>
      {#if payouts.length === 0}
        <p class="muted">No payout requests yet.</p>
      {:else}
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>User Email</th>
                <th>Amount</th>
                <th>UPI ID</th>
                <th>Status</th>
                <th>Founder Action</th>
              </tr>
            </thead>
            <tbody>
              {#each payouts as p}
                <tr>
                  <td>{new Date(p.created_at).toLocaleString()}</td>
                  <td>{p.email}</td>
                  <td><strong class="amt">₹{p.amount}</strong></td>
                  <td>
                    <span class="upi-code">{p.upi_id}</span>
                    <button class="btn-mini" on:click={() => navigator.clipboard.writeText(p.upi_id)}>Copy UPI</button>
                    <a
                      class="btn-mini upi-pay"
                      href={`upi://pay?pa=${encodeURIComponent(p.upi_id)}&pn=ClauseRadarPartner&am=${p.amount}&cu=INR`}
                    >
                      📱 Pay on UPI App
                    </a>
                  </td>
                  <td>
                    <span class="badge {p.status}">{p.status.toUpperCase()}</span>
                  </td>
                  <td>
                    {#if p.status === "pending"}
                      <button class="btn-approve" on:click={() => updatePayout(p.id, "approved")}>
                        ✅ Approve Paid
                      </button>
                      <button class="btn-reject" on:click={() => updatePayout(p.id, "rejected")}>
                        ❌ Reject
                      </button>
                    {:else}
                      <span class="done-txt">Processed</span>
                    {/if}
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>

    <div class="card">
      <h2>🏆 Top Affiliate Partners ({wallets.length})</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Partner Email</th>
              <th>Ref Code</th>
              <th>Referrals</th>
              <th>Available Wallet</th>
              <th>Total Earned</th>
            </tr>
          </thead>
          <tbody>
            {#each wallets as w}
              <tr>
                <td>{w.email}</td>
                <td><code>{w.ref_code}</code></td>
                <td>{w.total_referrals}</td>
                <td>₹{w.wallet_balance}</td>
                <td><strong>₹{w.total_earned}</strong></td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>

<style>
  .admin-wrap { max-width: 1080px; margin: 0 auto; padding: 40px 18px 80px; color: #f8fafc; }
  .lock-card { max-width: 440px; margin: 60px auto; background: rgba(15,23,42,0.85); border: 1px solid rgba(148,163,184,0.2); border-radius: 16px; padding: 32px 24px; text-align: center; }
  .lock-icon { font-size: 42px; margin-bottom: 10px; }
  .lock-card input { width: 100%; padding: 12px 14px; border-radius: 10px; border: 1px solid rgba(148,163,184,0.3); background: #020617; color: #fff; margin: 16px 0 12px; box-sizing: border-box; }
  .btn-unlock { width: 100%; padding: 12px; background: #10b981; color: #fff; border: none; border-radius: 10px; font-weight: 700; cursor: pointer; }
  .admin-head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 24px; }
  .btn-refresh { background: rgba(255,255,255,0.08); color: #fff; border: 1px solid rgba(255,255,255,0.15); padding: 10px 16px; border-radius: 10px; cursor: pointer; }
  .card { background: rgba(15,23,42,0.82); border: 1px solid rgba(148,163,184,0.16); border-radius: 16px; padding: 22px; margin-bottom: 22px; }
  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th, td { text-align: left; padding: 12px 10px; border-bottom: 1px solid rgba(148,163,184,0.12); }
  .amt { color: #34d399; font-size: 16px; }
  .upi-code { font-family: monospace; color: #38bdf8; margin-right: 8px; }
  .btn-mini { background: rgba(255,255,255,0.08); border: 1px solid rgba(148,163,184,0.2); color: #e2e8f0; padding: 4px 8px; border-radius: 6px; font-size: 11px; cursor: pointer; text-decoration: none; margin-right: 4px; }
  .upi-pay { background: rgba(56,189,248,0.15); border-color: rgba(56,189,248,0.4); color: #38bdf8; }
  .btn-approve { background: #10b981; color: #fff; border: none; padding: 7px 12px; border-radius: 8px; font-weight: 700; cursor: pointer; margin-right: 6px; }
  .btn-reject { background: rgba(239,68,68,0.2); color: #fca5a5; border: 1px solid rgba(239,68,68,0.4); padding: 7px 10px; border-radius: 8px; cursor: pointer; }
  .badge { padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; }
  .badge.approved { background: rgba(16,185,129,0.2); color: #34d399; }
  .badge.pending { background: rgba(245,158,11,0.2); color: #fbbf24; }
  .badge.rejected { background: rgba(239,68,68,0.2); color: #f87171; }
  .err-box { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.4); color: #fca5a5; padding: 10px; border-radius: 8px; margin-bottom: 12px; }
</style>
