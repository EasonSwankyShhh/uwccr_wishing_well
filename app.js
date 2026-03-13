import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://kzjkconzkznxjizqbtjo.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYm" + "FzZSIsInJlZiI6Imt6amtjb256a3pueGppenFidGpvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2ODk3NTQsImV4cC" + "I6MjA4ODI2NTc1NH0.UxaWC57SFXXb3bvRgwRJZ3PMb3g54_wRHchh-AQ3Yqk";

console.log("app.js 2.0 (with image upload) loaded");

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (id) => document.getElementById(id);

// --- 工具函式 ---
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

function openWhatsApp(text, phone = "") {
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  window.location.href = url;
}

// --- 核心功能：刷新列表 ---
async function refresh() {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    if ($("list")) $("list").innerHTML = `<div class="msg">Load failed: ${error.message}</div>`;
    return;
  }

  const tasks = data ?? [];

  // --- 統計邏輯 ---
  if ($("granted-count")) $("granted-count").textContent = tasks.filter(t => t.status === "claimed").length;
  if ($("active-count")) $("active-count").textContent = tasks.filter(t => t.status === "open").length;

  // --- 空白狀態提示 ---
  if (tasks.length === 0) {
    if ($("list")) $("list").innerHTML = `<div class="msg">The well is quiet... 🪙<br><span style="font-size: 0.9rem; color: #888;">Be the first to make a wish!</span></div>`;
    return;
  }

  // --- 畫出清單 ---
  if ($("list")) {
    $("list").innerHTML = tasks.map(t => {
      const badge = t.status === "open"
        ? `<div class="badge">OPEN</div>`
        : `<div class="badge">CLAIMED · ${t.claimed_by ?? "someone"}</div>`;

      // 處理可選的描述和圖片
      const descHtml = t.description ? `<div style="margin: 8px 0; color: #bbb; font-size: 0.9rem; line-height: 1.4;">${t.description}</div>` : "";
      const imgHtml = t.image_url ? `<img src="${t.image_url}" style="max-width: 100%; border-radius: 8px; margin: 8px 0; max-height: 250px; object-fit: cover; border: 1px solid #333;">` : "";

      const shareBtn = `<a class="btnlink gray" href="#" data-act="share" data-id="${t.id}">Share</a>`;
      const obtainBtn = t.status === "open"
        ? `<a class="btnlink" href="#" data-act="obtain" data-id="${t.id}">Obtain</a>`
        : `<a class="btnlink gray" href="#" onclick="return false;">Claimed</a>`;

      return `
        <div class="item">
          <div style="font-weight:700; font-size: 1.1rem;">${t.title}</div>
          <div class="meta">Deadline: ${t.deadline} · Prize: ${t.prize}</div>
          ${descHtml}
          ${imgHtml}
          ${badge}
          <div class="row">${shareBtn}${obtainBtn}</div>
          <div class="meta">${t.contact ? "Contact: " + t.contact : "Contact: (not provided)"}</div>
        </div>
      `;
    }).join("");
  }

  // --- 綁定按鈕事件 ---
  if ($("list")) {
    $("list").querySelectorAll("a[data-act][data-id]").forEach(a => {
      a.onclick = async (e) => {
        e.preventDefault();
        const act = a.dataset.act;
        const id = a.dataset.id;
        const t = tasks.find(x => x.id === id);
        if (!t) return;

        if (act === "share") {
          openWhatsApp(makeRequestText(t));
        }

        if (act === "obtain") {
          const who = (localStorage.getItem("uwc_name") || prompt("Your name?") || "").trim();
          if (!who) return;
          localStorage.setItem("uwc_name", who);

          const { data: claimed, error: updateErr } = await supabase
            .from("tasks")
            .update({ status: "claimed", claimed_by: who, claimed_at: new Date().toISOString() })
            .eq("id", id)
            .eq("status", "open")
            .select()
            .maybeSingle();

          if (updateErr) {
            alert("Claim failed: " + updateErr.message);
            return;
          }

          if (!claimed) {
            alert("Too late—someone already claimed it.");
            return refresh();
          }

          const requesterPhone = phoneToWaMePath(t.contact).replace("/", "");
          openWhatsApp(makeObtainText(t, who), requesterPhone);
        }
      };
    });
  }
} // refresh 結束

// --- 核心功能：發文邏輯 (包含圖片上傳) ---
if ($("post")) {
  $("post").onclick = async () => {
    // 顯示上傳中狀態
    $("msg").textContent = "Uploading... please wait.";
    $("post").disabled = true;

    const title = $("title").value.trim();
    const deadline = $("deadline").value.trim();
    const prize = $("prize").value.trim();
    const contact = $("contact").value.trim();
    const description = $("description") ? $("description").value.trim() : "";
    
    // 獲取檔案原始資料
    const fileInput = $("image_file");
    const file = fileInput.files[0];
    let finalImageUrl = null;

    if (!title || !deadline || !prize) {
      $("msg").textContent = "Fill title/deadline/prize.";
      $("post").disabled = false;
      return;
    }

    // --- 新增：處理圖片上傳的邏輯 ---
    if (file) {
      // 產生一個唯一的檔名 (防止重複)
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      // 1. 上傳檔案到 Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('task-images') // 這裡要對應你剛才建立的 Bucket 名稱
        .upload(filePath, file);

      if (uploadError) {
        $("msg").textContent = "Image upload failed: " + uploadError.message;
        $("post").disabled = false;
        return;
      }

      // 2. 獲取上傳後的公開網址
      const { data: urlData } = supabase.storage
        .from('task-images')
        .getPublicUrl(filePath);
        
      finalImageUrl = urlData.publicUrl;
    }
    // --------------------------------

    // 3. 將所有資料 (包含圖片網址) 存入資料庫
    const { error } = await supabase.from("tasks").insert([{
      title,
      deadline,
      prize,
      contact,
      description,
      image_url: finalImageUrl, // 存入剛剛拿到的公開網址
      status: "open",
      claimed_by: null,
      created_at: new Date()
    }]);

    if (error) {
      alert("Error: " + error.message);
      $("post").disabled = false;
      return;
    }

    // 發送成功，清空輸入框並刷新
    $("msg").textContent = "Posted!";
    $("post").disabled = false;
    $("title").value = $("deadline").value = $("prize").value = $("contact").value = "";
    if ($("description")) $("description").value = "";
    if ($("image_file")) $("image_file").value = ""; // 清空檔案選擇器
    refresh();
  };
}

if ($("refresh")) {
  $("refresh").onclick = refresh;
}

// 網頁載入時立刻抓資料
refresh();
