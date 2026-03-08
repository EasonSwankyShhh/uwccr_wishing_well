import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://kzjkconzkznxjizqbtjo.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYm" + "FzZSIsInJlZiI6Imt6amtjb256a3pueGppenFidGpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2ODk3NTQsImV4cC" + "I6MjA4ODI2NTc1NH0.UxaWC57SFXXb3bvRgwRJZ3PMb3g54_wRHchh-AQ3Yqk";

console.log("app.js loaded");

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = (id) => document.getElementById(id);

function phoneToWaMePath(contactRaw) {
  if (!contactRaw) return "";
  const digits = contactRaw.replace(/[^\d]/g, "");
  return digits.length >= 8 ? `/${digits}` : "";
}

function makeRequestText(t) {
  return [
    "📌 UWC TASK REQUEST",
    `Title: ${t.title}`,
    `Deadline: ${t.deadline}`,
    `Reward: ${t.prize}`,
    "",
    "Click link to obtain:",
    window.location.href
  ].join("\n");
}

function makeObtainText(t, who) {
  return [
    "✅ OBTAIN",
    `I want to obtain your request.`,
    `• Title: ${t.title}`,
    `• Deadline: ${t.deadline}`,
    `• Prize: ${t.prize}`,
    "",
    `From: ${who}`,
    "When can we coordinate?"
  ].join("\n");
}

function openWhatsApp(text) {
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.location.href = url;
}

async function refresh() {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    $("list").innerHTML = `<div class="msg">Load failed: ${error.message}</div>`;
    return;
  }

  const tasks = data ?? [];
  if (tasks.length === 0) {
    $("list").innerHTML = `<div class="msg">No requests yet.</div>`;
    return;
  }

  $("list").innerHTML = tasks.map(t => {
    const badge = t.status === "open"
      ? `<div class="badge">OPEN</div>`
      : `<div class="badge">CLAIMED · ${t.claimed_by ?? "someone"}</div>`;

    const shareBtn = `<a class="btnlink gray" href="#" data-act="share" data-id="${t.id}">Share</a>`;
    const obtainBtn = t.status === "open"
      ? `<a class="btnlink" href="#" data-act="obtain" data-id="${t.id}">Obtain</a>`
      : `<a class="btnlink gray" href="#" onclick="return false;">Claimed</a>`;

    return `
      <div class="item">
        <div style="font-weight:700;">${t.title}</div>
        <div class="meta">Deadline: ${t.deadline} · Prize: ${t.prize}</div>
        ${badge}
        <div class="row">${shareBtn}${obtainBtn}</div>
        <div class="meta">${t.contact ? "Contact: " + t.contact : "Contact: (not provided)"}</div>
      </div>
    `;
  }).join("");

  $("list").querySelectorAll("a[data-act][data-id]").forEach(a => {
    a.onclick = async (e) => {
      e.preventDefault();
      const act = a.dataset.act;
      const id = a.dataset.id;
      const t = tasks.find(x => x.id === id);
      if (!t) return;

      if (act === "share") openWhatsApp(makeRequestText(t));

      if (act === "obtain") {
        const who = (localStorage.getItem("uwc_name") || prompt("Your name?") || "").trim();
        if (!who) return;
        localStorage.setItem("uwc_name", who);

        const { data: claimed, error } = await supabase
          .from("tasks")
          .update({ status: "claimed", claimed_by: who, claimed_at: new Date().toISOString() })
          .eq("id", id)
          .eq("status", "open")
          .select()
          .maybeSingle();

        if (error) return alert("Claim failed: " + error.message);
        if (!claimed) { alert("Too late—someone already claimed it."); return refresh(); }

        openWhatsApp(makeObtainText(t, who));
      }
    };
  });
}

$("post").onclick = async () => {
  const title = $("title").value.trim();
  const deadline = $("deadline").value.trim();
  const prize = $("prize").value.trim();
  const contact = $("contact").value.trim();

  if (!title || !deadline || !prize) return ($("msg").textContent = "Fill title/deadline/prize.");

  const { error } = await supabase.from("tasks").insert([{
  title,
  deadline,
  prize,
  contact,
  status: "open",
  claimed_by: null,
  created_at: new Date()
}]);

  $("msg").textContent = "Posted!";
  $("title").value = $("deadline").value = $("prize").value = $("contact").value = "";
  refresh();
};

$("refresh").onclick = refresh;
refresh();

// Function to clear expired requests automatically
function clearExpiredRequests() {
    const now = new Date().getTime();
    let requests = JSON.parse(localStorage.getItem('requests')) || [];
    
    // Only keep requests that haven't expired yet
    const activeRequests = requests.filter(req => {
        return new Date(req.deadline).getTime() > now;
    });

    if (activeRequests.length !== requests.length) {
        localStorage.setItem('requests', JSON.stringify(activeRequests));
        location.reload(); // Refresh to update the UI
    }
}

// Check for expired requests every 30 seconds
setInterval(clearExpiredRequests, 30000);