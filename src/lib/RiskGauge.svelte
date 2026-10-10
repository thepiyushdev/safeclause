<script>
  export let score = 0;
  export let level = "MEDIUM";
  const LEN = 157.08;
  $: dash = (LEN * Math.max(0, Math.min(100, score))) / 100;
  $: color = level === "HIGH" ? "#e11d48" : level === "LOW" ? "#059669" : "#d97706";
</script>

<div class="gauge" role="img" aria-label="Risk score {score} out of 100">
  <svg viewBox="0 0 120 68" aria-hidden="true">
    <path class="trk" d="M10 60 A50 50 0 0 1 110 60" />
    <path class="val" d="M10 60 A50 50 0 0 1 110 60" style="stroke:{color};stroke-dasharray:{dash} 157.08" />
  </svg>
  <div class="gnum num">{score}<span>/100</span></div>
</div>
