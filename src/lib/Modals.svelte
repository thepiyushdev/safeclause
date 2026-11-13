<script>
  import { sb, user, deviceState, authModal, payModal, showRecovery, toast, revokeDevice, syncDevice, markFreshLogin } from "./app.js";
  import PlanPicker from "./PlanPicker.svelte";

  let email = "";
  let password = "";
  let authMsg = "";
  let authOk = false;
  let authBusy = false;
  let newPassword = "";

  $: otherActive = ($deviceState.devices || []).filter(function (d) { return !d.current && d.active; });

  function closeAuth() {
    authModal.update(function (m) { return Object.assign({}, m, { open: false }); });
    authMsg = "";
  }
  function setMode(mode) {
    authModal.update(function (m) { return Object.assign({}, m, { mode: mode }); });
    authMsg = "";
  }
  function openPayFromDevice() {
    deviceState.update(function (d) { return Object.assign({}, d, { blocked: false }); });
    payModal.set({ open: true, planId: "pro_year" });
  }

  function closePay() {
    payModal.update(function (m) { return Object.assign({}, m, { open: false }); });
  }
  function pickPlan(id) {
    payModal.update(function (m) { return Object.assign({}, m, { planId: id }); });
  }

  async function submitAuth(e) {
    if (e) e.preventDefault();
    if (!sb) { authMsg = "Login is not configured yet (Supabase keys missing)."; return; }
    authBusy = true;
    authMsg = "";
    authOk = false;
    try {
      if ($authModal.mode === "forgot") {
        const r = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
        if (r.error) throw r.error;
        authOk = true;
        authMsg = "Password reset link sent. Check your email.";
      } else if ($authModal.mode === "signup") {
        const r = await sb.auth.signUp({ email: email.trim(), password: password, options: { emailRedirectTo: window.location.origin } });
        if (r.error) throw r.error;
        if (r.data && r.data.session) closeAuth();
        else { authOk = true; authMsg = "Account created. Check your email to confirm, then log in."; }
      } else {
        const r = await sb.auth.signInWithPassword({ email: email.trim(), password: password });
        if (r.error) throw r.error;
        password = "";
        markFreshLogin();
        closeAuth();
      }
    } catch (err) {
      authMsg = err && err.message ? err.message : "Something went wrong.";
    } finally {
      authBusy = false;
    }
  }

  async function googleSignIn() {
    if (!sb) { authMsg = "Login is not configured yet (Supabase keys missing)."; return; }
    authBusy = true;
    authMsg = "";
    authOk = false;
    markFreshLogin();
    try { window.sessionStorage.setItem("cr_return", window.location.pathname); } catch (e) {}
    const r = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
    if (r.error) {
      authMsg = r.error.message || "Google sign-in is not available right now.";
      authBusy = false;
    }
  }

  async function saveNewPassword(e) {
    if (e) e.preventDefault();
    if (newPassword.length < 6) { authMsg = "Use at least 6 characters."; return; }
    authBusy = true;
    authMsg = "";
    try {
      const r = await sb.auth.updateUser({ password: newPassword });
      if (r.error) throw r.error;
      showRecovery.set(false);
      newPassword = "";
    } catch (err) {
      authMsg = err && err.message ? err.message : "Could not update password.";
    } finally {
      authBusy = false;
    }
  }
</script>

{#if $authModal.open}
  <div class="backdrop" role="presentation" on:click|self={closeAuth} on:keydown={(e) => e.key === "Escape" && closeAuth()}>
    <div class="modal" role="dialog" aria-modal="true">
      <button class="x" aria-label="Close" on:click={closeAuth}>✕</button>
      <h2>{$authModal.mode === "signup" ? "Create your account" : $authModal.mode === "forgot" ? "Reset password" : "Welcome back"}</h2>
      {#if $authModal.note}<p class="muted small">{$authModal.note}</p>{/if}
      {#if !sb}<div class="error">Supabase keys are missing, so login is disabled.</div>{/if}
      {#if $authModal.mode !== "forgot"}
        <button class="btn block gbtn" type="button" on:click={googleSignIn} disabled={authBusy}>
          <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" /><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" /><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" /><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" /></svg>
          Continue with Google
        </button>
        <div class="or">or use email</div>
      {/if}
      <form on:submit={submitAuth}>
        <input type="email" placeholder="Email" bind:value={email} required autocomplete="email" />
        {#if $authModal.mode !== "forgot"}
          <input type="password" placeholder="Password (min 6 characters)" bind:value={password} required minlength="6" autocomplete={$authModal.mode === "signup" ? "new-password" : "current-password"} />
        {/if}
        <button class="btn primary block" type="submit" disabled={authBusy}>
          {authBusy ? "Please wait..." : $authModal.mode === "signup" ? "Sign up" : $authModal.mode === "forgot" ? "Send reset link" : "Log in"}
        </button>
      </form>
      {#if authMsg}<div class={authOk ? "ok" : "error"}>{authMsg}</div>{/if}
      <div class="links">
        {#if $authModal.mode !== "login"}<button on:click={() => setMode("login")}>Log in</button>{/if}
        {#if $authModal.mode !== "signup"}<button on:click={() => setMode("signup")}>Create account</button>{/if}
        {#if $authModal.mode !== "forgot"}<button on:click={() => setMode("forgot")}>Forgot password?</button>{/if}
      </div>
    </div>
  </div>
{/if}

{#if $showRecovery}
  <div class="backdrop" role="presentation">
    <div class="modal" role="dialog" aria-modal="true">
      <h2>Set a new password</h2>
      <form on:submit={saveNewPassword}>
        <input type="password" placeholder="New password" bind:value={newPassword} minlength="6" required autocomplete="new-password" />
        <button class="btn primary block" type="submit" disabled={authBusy}>{authBusy ? "Saving..." : "Save password"}</button>
      </form>
      {#if authMsg}<div class="error">{authMsg}</div>{/if}
    </div>
  </div>
{/if}

{#if $payModal.open}
  <div class="backdrop" role="presentation" on:click|self={closePay} on:keydown={(e) => e.key === "Escape" && closePay()}>
    <div class="modal" role="dialog" aria-modal="true">
      <button class="x" aria-label="Close" on:click={closePay}>✕</button>
      <h2>Upgrade to Pro</h2>
      <p class="muted small" style="margin-top:0">Every rewrite unlocked, unlimited Scope Guard and Payment Chaser, PDF reports and up to 3 devices.</p>
      <PlanPicker planId={$payModal.planId} on:change={(e) => pickPlan(e.detail)} />
    </div>
  </div>
{/if}

{#if $user && $deviceState.blocked}
  <div class="backdrop" role="presentation">
    <div class="modal" role="dialog" aria-modal="true">
      <h2>Device limit reached</h2>
      <p class="muted small">{$deviceState.plan === "pro" ? "Pro allows up to 3 devices at the same time." : "The Free plan allows 1 device at a time. Pro allows up to 3."} Sign out one of these devices to continue on this one.</p>
      {#each otherActive as d (d.device_id)}
        <div class="dev">
          <div style="min-width:0"><b>{d.label}</b><div class="muted small">Active now</div></div>
          <button class="btn sm" on:click={() => revokeDevice(d.device_id)}>Sign out</button>
        </div>
      {/each}
      <div class="row" style="margin-top:12px">
        {#if $deviceState.plan !== "pro"}<button class="btn primary mfull" on:click={openPayFromDevice}>Upgrade to Pro ⚡</button>{/if}
        <button class="btn mfull" on:click={() => syncDevice("register")}>Try again</button>
      </div>
    </div>
  </div>
{/if}

{#if $toast.open}
  <div class={"toast" + ($toast.ok ? " ok" : "")} role="status" aria-live="polite">
    {$toast.text}
    <button class="x" aria-label="Dismiss" on:click={() => toast.update((t) => Object.assign({}, t, { open: false }))}>✕</button>
  </div>
{/if}
