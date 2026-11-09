<script>
  import { copyToClipboard, fmt } from "./app.js";
  export let clause = "";
  export let email = "";
  let copied = "";
  async function copy(kind, text) {
    await copyToClipboard(text);
    copied = kind;
    setTimeout(function () { if (copied === kind) copied = ""; }, 1600);
  }
</script>

<div class="rw">
  <div class="rw-h">
    <span class="rw-tag">Suggested safer rewrite</span>
    <button class="btn sm" on:click={() => copy("c", clause)}>{copied === "c" ? "Copied ✓" : "Copy Clause"}</button>
  </div>
  <p class="ins">{fmt(clause)}</p>
  <div class="rw-h">
    <span class="rw-tag">Counter-proposal email</span>
    <button class="btn sm primary" on:click={() => copy("e", email)}>{copied === "e" ? "Copied ✓" : "Copy Counter-Proposal Email"}</button>
  </div>
  <div class="mail">{fmt(email)}</div>
</div>
