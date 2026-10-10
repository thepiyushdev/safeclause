<script>
  import { sb, user, credits, authModal, payModal, showRecovery, authHeaders, readJson, copyToClipboard, UPI_ID } from "./app.js";
  import { PACKS } from "./data.mjs";

  let email = "";
  let password = "";
  let authMsg = "";
  let authOk = false;
  let authBusy = false;
  let newPassword = "";
  let shot = null;
  let shotInput;
  let payBusy = false;
  let payMsg = "";
  let payOk = false;
  let copied = false;

  $: pack = PACKS.find(function (p) { return p.id === $payModal.packId; }) || PACKS[0];
  $: upiLink = "upi://pay?pa=" + UPI_ID + "&pn=ClauseRadar&am=" + pack.price + "&cu=INR&tn=ClauseRadar_Credit";

  function closeAuth() {
    authModal.update(function (m) { return Object.assign({}, m, { open: false }); });
    authMsg = "";
  }
  function setMode(mode) {
    authModal.update(function (m) { return Object.assign({}, m, { mode: mode }); });
    authMsg = "";
  }
  function closePay() {
    payModal.update(function (m) { return Object.assign({}, m, { open: false }); });
    payMsg = "";
  }
  function pickPack(id) {
    payModal.update(function (m) { return Object.assign({}, m, { packId: id }); });
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

  function shrinkImage(file) {
    return new Promise(function (resolve, reject) {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = function () {
        const ratio = Math.min(1, 1400 / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * ratio);
        c.height = Math.round(img.height * ratio);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL("image/jpeg", 0.82).split(",")[1]);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("Could not read this image.")); };
      img.src = url;
    });
  }

  function onShot(e) {
    shot = e.target.files && e.target.files[0] ? e.target.files[0] : null;
    payMsg = "";
  }

  async function copyUpi() {
    await copyToClipboard(UPI_ID);
    copied = true;
    setTimeout(function () { copied = false; }, 1600);
  }

  async function verifyPayment() {
    if (!shot) { payOk = false; payMsg = "Choose your payment screenshot first."; return; }
    payBusy = true;
    payMsg = "";
    payOk = false;
    try {
      const b64 = await shrinkImage(shot);
      const r = await fetch("/api/verify-payment", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ image: b64, mime: "image/jpeg", pack: pack.id }),
      });
      const data = await readJson(r);
      if (!r.ok || !data.success) throw new Error(data.error || "Verification failed.");
      credits.set(data.credits);
      payOk = true;
      payMsg = "✅ Payment verified! " + data.creditsAdded + " credit(s) added.";
      shot = null;
      if (shotInput) shotInput.value = "";
    } catch (err) {
      payOk = false;
      payMsg = err && err.message ? err.message : "Verification failed.";
    } finally {
      payBusy = false;
    }
  }
</script>

{#if $authModal.open}
  <div class="backdrop" on:click|self={closeAuth}>
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
  <div class="backdrop">
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
  <div class="backdrop" on:click|self={closePay}>
    <div class="modal" role="dialog" aria-modal="true">
      <button class="x" aria-label="Close" on:click={closePay}>✕</button>
      <h2>Buy credits</h2>
      <div class="chips">
        {#each PACKS as p}
          <button class:on={$payModal.packId === p.id} on:click={() => pickPack(p.id)}>{p.credits} credit{p.credits === 1 ? "" : "s"} • ₹{p.price}</button>
        {/each}
      </div>
      <p class="muted small">1 credit = 1 full contract unlock (all safer rewrites + counter-proposal emails + PDF report).</p>

      <h3 class="sub">Step 1: Pay ₹{pack.price}</h3>
      <a class="btn primary block upi" href={upiLink}>Tap to Pay with UPI ⚡</a>
      <p class="muted small">Opens GPay, PhonePe or Paytm on your phone. UPI ID: <b>{UPI_ID}</b>
        <button class="linkbtn" on:click={copyUpi}>{copied ? "Copied ✓" : "Copy"}</button>
      </p>

      <h3 class="sub">Step 2: Upload the payment screenshot</h3>
      <input type="file" accept="image/*" on:change={onShot} bind:this={shotInput} />
      <button class="btn block" on:click={verifyPayment} disabled={payBusy}>
        {payBusy ? "AI is verifying..." : "Verify payment & add credits"}
      </button>
      {#if payMsg}<div class={payOk ? "ok" : "error"}>{payMsg}</div>{/if}
    </div>
  </div>
{/if}
