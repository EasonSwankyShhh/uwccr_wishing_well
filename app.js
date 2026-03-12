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

// 修改這段：增加一個 phone 參數
function openWhatsApp(text, phone = "") {
  // 如果有電話，就加在 wa.me/ 後面；沒有的話就維持現狀
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
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

        const requesterPhone = phoneToWaMePath(t.contact).replace("/", "");
        openWhatsApp(makeObtainText(t, who), requesterPhone);
}

     // 1. 抓取電話
        const requesterPhone = phoneToWaMePath(t.contact).replace("/", "");
        
        // 2. 撥號（注意這裡所有的符號都是半形）
        openWhatsApp(makeObtainText(t, who), requesterPhone);
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

// 專業的數據清理邏輯 (Data Cleansing)
function purgeOldData() {
    const now = new Date().getTime();
    let requests = JSON.parse(localStorage.getItem('requests')) || [];

    // 將所有過期的 Request 過濾掉
    const cleanData = requests.filter(req => {
        // 確保 deadline 是有效的時間格式
        const expiry = new Date(req.deadline).getTime();
        return expiry > now; // 只保留「未來」的任務
    });

    // 如果數據有變動，更新存儲並重新渲染
    if (cleanData.length !== requests.length) {
        localStorage.setItem('requests', JSON.stringify(cleanData));
        renderRequests(); // 呼叫你原本畫出清單的那個 function
        console.log("System: Expired records have been purged for data integrity.");
    }
}

// 網頁一載入就清一次，確保畫面乾淨
purgeOldData();

// 核心邏輯：自動清洗過期數據 (Data Integrity Protection)
function purgeExpiredRequests() {
    const now = new Date().getTime(); // 獲取當前時間戳
    let requests = JSON.parse(localStorage.getItem('requests')) || [];

    // 篩選：只保留「結束時間 > 現在時間」的 Request
    const cleanList = requests.filter(req => {
        const deadlineDate = new Date(req.deadline).getTime();
        return deadlineDate > now;
    });

    // 如果發現有數據被篩掉了，就更新儲存並重新整理頁面
    if (cleanList.length !== requests.length) {
        localStorage.setItem('requests', JSON.stringify(cleanList));
        location.reload(); 
        console.log("System: Expired requests purged for data integrity.");
    }
}

// 立即執行並設定每分鐘檢查一次
purgeExpiredRequests();
setInterval(purgeExpiredRequests, 60000);
