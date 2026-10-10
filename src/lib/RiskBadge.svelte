<script>
  export let level = "MEDIUM";
  export let label = "";
  $: cls = level === "HIGH" ? "high" : level === "LOW" ? "low" : "med";
</script>

<span class="badge {cls}"><i class="dot"></i>{label || level + " RISK"}</span>
