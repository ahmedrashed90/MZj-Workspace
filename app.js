// app.js (ESM) - Tasks & Campaigns Manager
import { db } from "./firebase.js";
import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, orderBy, serverTimestamp, getDocs, limit
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const $ = (s, r=document)=>r.querySelector(s);
const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));

/* ---------- UI helpers ---------- */
const toast = $("#toast");
function showToast(t){
  toast.textContent = t;
  toast.classList.add("show");
  setTimeout(()=>toast.classList.remove("show"), 1600);
}
function esc(s){ return String(s ?? "").replace(/[&<>"']/g, c=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[c])); }

function openModal(id){ $("#"+id).classList.add("show"); }
function closeModal(id){ $("#"+id).classList.remove("show"); }

/* ---------- Sidebar (mobile) ---------- */
const sidebar = $("#wsSidebar");
const backdrop = $("#wsBackdrop");
$("#btnMenu").addEventListener("click", ()=>{
  sidebar.classList.add("open");
  backdrop.classList.add("show");
});
backdrop.addEventListener("click", ()=>{
  sidebar.classList.remove("open");
  backdrop.classList.remove("show");
});

/* ---------- Menus (kebab) ---------- */
document.addEventListener("click", (e)=>{
  const kebab = e.target.closest("[data-kebab]");
  const menu  = e.target.closest(".menu");

  if(!kebab && !menu){
    $$(".menu.show").forEach(m=>m.classList.remove("show"));
    return;
  }
  if(kebab){
    const card = kebab.closest(".board");
    const m = $(".menu", card);
    $$(".menu.show").forEach(x=>{ if(x!==m) x.classList.remove("show"); });
    m.classList.toggle("show");
  }
});

/* ---------- Modals close ---------- */
$$("[data-close]").forEach(b=>b.addEventListener("click", ()=>closeModal(b.getAttribute("data-close"))));
$$(".modal").forEach(m=>{
  m.addEventListener("click", (e)=>{ if(e.target===m) m.classList.remove("show"); });
});
document.addEventListener("keydown", (e)=>{
  if(e.key === "Escape"){
    $$(".modal.show").forEach(m=>m.classList.remove("show"));
    $$(".menu.show").forEach(m=>m.classList.remove("show"));
  }
});

/* ---------- Tabs ---------- */
const tabAgendas = $("#tabAgendas");
const tabCampaigns = $("#tabCampaigns");
const agendasSection = $("#agendasSection");
const campaignsSection = $("#campaignsSection");

function setTab(which){
  if(which==="agendas"){
    tabAgendas.classList.add("active");
    tabCampaigns.classList.remove("active");
    agendasSection.style.display = "block";
    campaignsSection.style.display = "block"; // keep both visible (professional split) - but highlight
    $("#agendasCard").scrollIntoView({behavior:"smooth", block:"start"});
  }else{
    tabCampaigns.classList.add("active");
    tabAgendas.classList.remove("active");
    $("#campaignsCard").scrollIntoView({behavior:"smooth", block:"start"});
  }
}
tabAgendas.addEventListener("click", ()=>setTab("agendas"));
tabCampaigns.addEventListener("click", ()=>setTab("campaigns"));

/* ---------- Firestore collections ---------- */
const agendasCol = collection(db, "agendas");
const campaignsCol = collection(db, "campaigns");
const tasksCol = collection(db, "tasks");
const usersCol = collection(db, "users");
const mediaSpecsCol = collection(db, "media_specs");

/* ---------- Data caches ---------- */
let usersCache = [];
let specCache = [];

/* ---------- Load Users (optional) ---------- */
async function loadUsers(){
  try{
    const snap = await getDocs(query(usersCol, limit(50)));
    usersCache = snap.docs.map(d=>({ id:d.id, ...(d.data()||{}) }));
  }catch(_){}
  if(usersCache.length===0){
    usersCache = [
      {id:"u_ahmed", name:"أحمد"},
      {id:"u_kareem", name:"كريم"},
      {id:"u_moh", name:"محمد"},
      {id:"u_admin", name:"إداري"}
    ];
  }
}

/* ---------- Load Unique Spec Keys from media_specs ---------- */
function simplifySpecLabel(docId, data){
  // prefer structured fields if present
  const car = data?.car || data?.carName || data?.makeModel || data?.vehicle || data?.name || "";
  const trim = data?.trim || data?.variant || data?.grade || data?.statement || "";
  const model = data?.model || data?.modelYear || data?.year || "";

  const parts = [car, trim, model].map(x=>String(x||"").trim()).filter(Boolean);
  if(parts.length>=2) return parts.join(" — ");

  // fallback: parse doc id by separators
  const raw = String(docId||"");
  const split = raw.split("|").map(s=>s.trim()).filter(Boolean);
  // If last two are colors, remove them (best effort)
  if(split.length >= 5){
    return [split[0], split[1], split[4]].filter(Boolean).join(" — "); // car, statement, model
  }
  if(split.length >= 3){
    return [split[0], split[1], split[2]].join(" — ");
  }
  return raw;
}

async function loadSpecs(){
  try{
    // keep it light
    const snap = await getDocs(query(mediaSpecsCol, limit(400)));
    specCache = snap.docs.map(d=>{
      const data = d.data()||{};
      return {
        id: d.id,
        label: simplifySpecLabel(d.id, data),
        raw: data
      };
    }).sort((a,b)=>a.label.localeCompare(b.label, "ar"));
  }catch(_){
    specCache = [];
  }
}

/* ---------- Builders (chips/pills) ---------- */
function builderInit(inputEl, addBtnEl, listEl){
  const state = { items: [] };
  const render = ()=>{
    listEl.innerHTML = "";
    state.items.forEach((name, idx)=>{
      const pill = document.createElement("div");
      pill.className = "pill2";
      pill.innerHTML = `<span>${esc(name)}</span><span class="x" data-x="${idx}" title="حذف"><i class="fa-solid fa-xmark"></i></span>`;
      listEl.appendChild(pill);
    });
  };
  const add = ()=>{
    const v = (inputEl.value||"").trim();
    if(!v) return;
    state.items.push(v);
    inputEl.value = "";
    render();
  };
  addBtnEl.addEventListener("click", add);
  inputEl.addEventListener("keydown", (e)=>{
    if(e.key==="Enter"){ e.preventDefault(); add(); }
  });
  listEl.addEventListener("click", (e)=>{
    const x = e.target.closest("[data-x]");
    if(!x) return;
    const idx = Number(x.getAttribute("data-x"));
    if(Number.isNaN(idx)) return;
    state.items.splice(idx, 1);
    render();
  });
  return {
    get: ()=>state.items.slice(),
    set: (arr)=>{ state.items = Array.isArray(arr)? arr.slice(): []; render(); }
  };
}

/* ---------- Agenda Modal logic ---------- */
const agModal = $("#agendaModal");
const agName = $("#agendaName");
const agCardsInput = $("#agendaCardsInput");
const agCardsAdd = $("#agendaCardsAdd");
const agCardsList = $("#agendaCardsList");
const agSave = $("#agendaSave");
const agError = $("#agendaError");

const agBuilder = builderInit(agCardsInput, agCardsAdd, agCardsList);

let agMode = "create";
let agEditId = null;

function openAgendaModal(mode, data){
  agError.classList.remove("show");
  agMode = mode;
  agEditId = data?.id || null;
  $("#agendaModalTitle").textContent = mode==="edit" ? "تعديل الأجندة" : "إنشاء أجندة";
  $("#agendaModalHint").textContent = mode==="edit" ? "عدّل اسم الأجندة والكروت ثم احفظ." : "اكتب اسم الأجندة وأضف الكروت (Columns).";
  agName.value = data?.name || "";
  agBuilder.set(data?.cards || []);
  agSave.innerHTML = mode==="edit"
    ? '<i class="fa-solid fa-floppy-disk"></i><span>حفظ التعديل</span>'
    : '<i class="fa-solid fa-check"></i><span>إنشاء</span>';
  openModal("agendaModal");
}

$("#btnNewAgenda").addEventListener("click", ()=>openAgendaModal("create"));
$("#btnNewAgenda2").addEventListener("click", ()=>openAgendaModal("create"));

agSave.addEventListener("click", async ()=>{
  const name = (agName.value||"").trim();
  const cards = agBuilder.get();
  if(!name){ agError.textContent="اكتب اسم الأجندة."; agError.classList.add("show"); return; }
  if(cards.length===0){ agError.textContent="أضف كارت واحد على الأقل."; agError.classList.add("show"); return; }

  try{
    if(agMode==="edit" && agEditId){
      await updateDoc(doc(db, "agendas", agEditId), {
        name, cards,
        updatedAt: serverTimestamp()
      });
      showToast("تم تعديل الأجندة");
    }else{
      await addDoc(agendasCol, {
        name, cards,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      showToast("تم إنشاء الأجندة");
    }
    closeModal("agendaModal");
  }catch(err){
    agError.textContent = "حصل خطأ في الحفظ. تأكد من صلاحيات Firestore Rules.";
    agError.classList.add("show");
  }
});

/* ---------- Campaign Modal logic ---------- */
const cpName = $("#cpName");
const cpDesc = $("#cpDesc");
const cpStart= $("#cpStart");
const cpEnd  = $("#cpEnd");
const cpCardsInput = $("#cpCardsInput");
const cpCardsAdd   = $("#cpCardsAdd");
const cpCardsList  = $("#cpCardsList");
const cpSave = $("#cpSave");
const cpError= $("#cpError");
const cpBuilder = builderInit(cpCardsInput, cpCardsAdd, cpCardsList);

let cpMode="create";
let cpEditId=null;

function openCampaignModal(mode, data){
  cpError.classList.remove("show");
  cpMode = mode;
  cpEditId = data?.id || null;
  $("#campaignModalTitle").textContent = mode==="edit" ? "تعديل الحملة" : "إنشاء حملة";
  $("#campaignModalHint").textContent = mode==="edit" ? "عدّل بيانات الحملة والكروت ثم احفظ." : "حدد بيانات الحملة وفترتها ثم أضف الكروت.";
  cpName.value = data?.name || "";
  cpDesc.value = data?.desc || "";
  cpStart.value= data?.start || "";
  cpEnd.value  = data?.end || "";
  cpBuilder.set(data?.cards || []);
  cpSave.innerHTML = mode==="edit"
    ? '<i class="fa-solid fa-floppy-disk"></i><span>حفظ التعديل</span>'
    : '<i class="fa-solid fa-check"></i><span>إنشاء</span>';
  openModal("campaignModal");
}

$("#btnNewCampaign").addEventListener("click", ()=>openCampaignModal("create"));
$("#btnNewCampaign2").addEventListener("click", ()=>openCampaignModal("create"));

cpSave.addEventListener("click", async ()=>{
  const name = (cpName.value||"").trim();
  const desc = (cpDesc.value||"").trim();
  const start= cpStart.value || "";
  const end  = cpEnd.value || "";
  const cards= cpBuilder.get();

  if(!name){ cpError.textContent="اكتب اسم الحملة."; cpError.classList.add("show"); return; }
  if(!start || !end){ cpError.textContent="حدد تاريخ البداية والنهاية."; cpError.classList.add("show"); return; }
  if(cards.length===0){ cpError.textContent="أضف كارت واحد على الأقل."; cpError.classList.add("show"); return; }

  try{
    if(cpMode==="edit" && cpEditId){
      await updateDoc(doc(db, "campaigns", cpEditId), {
        name, desc, start, end, cards,
        updatedAt: serverTimestamp()
      });
      showToast("تم تعديل الحملة");
    }else{
      await addDoc(campaignsCol, {
        name, desc, start, end, cards,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      showToast("تم إنشاء الحملة");
    }
    closeModal("campaignModal");
  }catch(err){
    cpError.textContent = "حصل خطأ في الحفظ. تأكد من صلاحيات Firestore Rules.";
    cpError.classList.add("show");
  }
});

/* ---------- Render Boards lists ---------- */
const agendasWrap = $("#agendasWrap");
const campaignsWrap = $("#campaignsWrap");
const emptyAg = $("#emptyAgendas");
const emptyCp = $("#emptyCampaigns");

function boardCard(type, obj){
  const el = document.createElement("div");
  el.className = "board";

  const title = esc(obj.name || "");
  const cards = (obj.cards || []).slice(0,4);
  const more  = (obj.cards || []).length - cards.length;

  const meta = type==="agenda"
    ? `آخر تحديث: ${esc(obj.updatedAtLabel || "—")} • ${(obj.cards||[]).length} كروت`
    : `من ${esc(obj.start || "—")} إلى ${esc(obj.end || "—")} • ${(obj.cards||[]).length} كروت`;

  const desc = type==="campaign" ? (obj.desc || "") : "";

  el.innerHTML = `
    <div class="top">
      <div>
        <div class="title">${title}</div>
        <div class="meta">${meta}</div>
        ${desc ? `<div class="meta" style="margin-top:6px">${esc(desc)}</div>` : ``}
      </div>

      <button class="kebab" type="button" data-kebab aria-label="خيارات">
        <i class="fa-solid fa-ellipsis-vertical"></i>
      </button>

      <div class="menu" role="menu">
        <button type="button" data-open="${obj.id}">
          <i class="fa-solid fa-arrow-up-right-from-square"></i><span>فتح</span>
        </button>
        <button type="button" data-edit="${obj.id}">
          <i class="fa-solid fa-pen"></i><span>تعديل</span>
        </button>
        <button type="button" class="danger" data-del="${obj.id}">
          <i class="fa-solid fa-trash"></i><span>حذف</span>
        </button>
      </div>
    </div>

    <div class="chips">
      ${cards.map(x=>`<span class="chip">${esc(x)}</span>`).join("")}
      ${more>0 ? `<span class="chip">+${more}</span>` : ``}
    </div>
  `;

  el.addEventListener("click", async (e)=>{
    const open = e.target.closest("[data-open]");
    const edit = e.target.closest("[data-edit]");
    const del  = e.target.closest("[data-del]");

    if(open){
      e.preventDefault();
      await openBoard(type, obj);
      return;
    }
    if(edit){
      e.preventDefault();
      if(type==="agenda") openAgendaModal("edit", obj);
      else openCampaignModal("edit", obj);
      return;
    }
    if(del){
      e.preventDefault();
      if(confirm("متأكد من الحذف؟ (سيتم حذف مهام البورد أيضًا)")){
        try{
          await deleteDoc(doc(db, type==="agenda"?"agendas":"campaigns", obj.id));
          // NOTE: tasks cleanup can be done by cloud function; for now we leave tasks.
          showToast("تم الحذف");
        }catch(_){
          showToast("فشل الحذف — راجع الصلاحيات");
        }
      }
      return;
    }
  });

  return el;
}

function tsToLabel(ts){
  try{
    if(!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const now = new Date();
    const diff = Math.abs(now - d);
    const days = Math.floor(diff/86400000);
    if(days===0) return "اليوم";
    if(days===1) return "أمس";
    return `${days} يوم`;
  }catch(_){ return "—"; }
}

let agendasUnsub = null;
let campaignsUnsub = null;

function watchBoards(){
  if(agendasUnsub) agendasUnsub();
  if(campaignsUnsub) campaignsUnsub();

  agendasUnsub = onSnapshot(query(agendasCol, orderBy("updatedAt","desc")), (snap)=>{
    agendasWrap.innerHTML = "";
    if(snap.empty){
      emptyAg.style.display = "flex";
    }else{
      emptyAg.style.display = "none";
      snap.docs.forEach(d=>{
        const data = d.data()||{};
        const obj = { id:d.id, ...data, updatedAtLabel: tsToLabel(data.updatedAt) };
        agendasWrap.appendChild(boardCard("agenda", obj));
      });
    }
  }, ()=>{
    // if rules block reads
    emptyAg.style.display="flex";
  });

  campaignsUnsub = onSnapshot(query(campaignsCol, orderBy("updatedAt","desc")), (snap)=>{
    campaignsWrap.innerHTML = "";
    if(snap.empty){
      emptyCp.style.display = "flex";
    }else{
      emptyCp.style.display = "none";
      snap.docs.forEach(d=>{
        const data = d.data()||{};
        const obj = { id:d.id, ...data, updatedAtLabel: tsToLabel(data.updatedAt) };
        campaignsWrap.appendChild(boardCard("campaign", obj));
      });
    }
  }, ()=>{
    emptyCp.style.display="flex";
  });
}

/* ---------- Board View + Tasks ---------- */
const boardView = $("#boardView");
const boardTitle = $("#boardTitle");
const boardBadge = $("#boardBadge");
const boardMeta  = $("#boardMeta");
const kanbanWrap = $("#kanbanWrap");
const boardBackBtn = $("#boardBackBtn");

let currentBoard = { type:null, id:null, name:null, cards:[] };

boardBackBtn.addEventListener("click", ()=>{
  boardView.classList.remove("show");
  $("#listsView").style.display = "block";
  currentBoard = { type:null, id:null, name:null, cards:[] };
  if(tasksUnsub){ tasksUnsub(); tasksUnsub=null; }
});

function dueTag(due){
  if(!due) return {cls:"", text:"بدون تاريخ"};
  const today = new Date(); today.setHours(0,0,0,0);
  const dd = new Date(due); dd.setHours(0,0,0,0);
  const diff = Math.round((dd - today)/86400000);
  if(diff < 0) return {cls:"danger", text:"متأخر"};
  if(diff === 0) return {cls:"warn", text:"اليوم"};
  if(diff <= 2) return {cls:"warn", text:`بعد ${diff} يوم`};
  return {cls:"ok", text:`بعد ${diff} يوم`};
}

let tasksUnsub = null;
let tasksByCol = new Map();

async function openBoard(type, obj){
  $("#listsView").style.display = "none";
  boardView.classList.add("show");

  currentBoard = {
    type,
    id: obj.id,
    name: obj.name,
    cards: (obj.cards||[]).slice()
  };

  boardTitle.textContent = obj.name || "";
  boardBadge.textContent = type==="agenda" ? "أجندة" : "حملة";
  boardMeta.textContent = type==="agenda"
    ? `الكروت: ${(obj.cards||[]).length}`
    : `الفترة: ${obj.start||"—"} → ${obj.end||"—"} • الكروت: ${(obj.cards||[]).length}`;

  // build columns skeleton
  kanbanWrap.innerHTML = "";
  tasksByCol = new Map();

  (obj.cards||[]).forEach((colName)=>{
    const colEl = document.createElement("div");
    colEl.className = "col";
    colEl.dataset.col = colName;

    colEl.innerHTML = `
      <div class="col-head">
        <div class="col-title">
          <span>${esc(colName)}</span>
          <span class="count" data-count>0</span>
        </div>
        <button class="smallbtn" type="button" data-add-task>
          <i class="fa-solid fa-plus"></i><span>تاسك</span>
        </button>
      </div>
      <div class="col-body" data-body></div>
    `;

    colEl.querySelector("[data-add-task]").addEventListener("click", ()=>{
      openTaskModal({ mode:"create", column:colName });
    });

    kanbanWrap.appendChild(colEl);
  });

  // watch tasks for this board
  if(tasksUnsub) tasksUnsub();
  const qTasks = query(
    tasksCol,
    where("parentType","==", type),
    where("parentId","==", obj.id),
    orderBy("createdAt","desc")
  );

  tasksUnsub = onSnapshot(qTasks, (snap)=>{
    // reset
    tasksByCol = new Map();
    (obj.cards||[]).forEach(c=>tasksByCol.set(c, []));

    snap.docs.forEach(d=>{
      const t = { id:d.id, ...(d.data()||{}) };
      const col = t.column || "بدون";
      if(!tasksByCol.has(col)) tasksByCol.set(col, []);
      tasksByCol.get(col).push(t);
    });

    renderTasks();
  });
}

function renderTasks(){
  // render each column
  $$(".col", kanbanWrap).forEach(colEl=>{
    const colName = colEl.dataset.col;
    const body = colEl.querySelector("[data-body]");
    const countEl = colEl.querySelector("[data-count]");

    const arr = tasksByCol.get(colName) || [];
    countEl.textContent = String(arr.length);

    body.innerHTML = "";
    if(arr.length===0){
      const empty = document.createElement("div");
      empty.className = "sub";
      empty.style.margin = "6px 4px 0";
      empty.textContent = "لا توجد مهام هنا بعد.";
      body.appendChild(empty);
      return;
    }

    arr.forEach(t=>{
      const card = document.createElement("div");
      card.className = "task";
      const dtag = dueTag(t.dueDate || "");

      const tags = [];
      if(t.userName) tags.push(`<span class="tag">${esc(t.userName)}</span>`);
      tags.push(`<span class="tag ${dtag.cls}">${esc(dtag.text)}</span>`);
      if(currentBoard.type==="campaign"){
        const linksCount = Array.isArray(t.links) ? t.links.length : 0;
        if(linksCount>0) tags.push(`<span class="tag">روابط: ${linksCount}</span>`);
      }

      const specLabel = t.uniqueSpecLabel || t.uniqueSpecKey || t.uniqueSpecId || "—";

      card.innerHTML = `
        <div class="t-top">
          <div>
            <div class="t-title">${esc(specLabel)}</div>
            <div class="t-meta">${t.desc ? esc(t.desc) : "بدون وصف"}</div>
          </div>
          <button class="task-btn" type="button" data-task-menu title="خيارات">
            <i class="fa-solid fa-ellipsis-vertical"></i>
          </button>
        </div>
        <div class="t-tags">${tags.join("")}</div>

        <div class="menu" style="top:46px; left:10px">
          <button type="button" data-edit-task="${t.id}">
            <i class="fa-solid fa-pen"></i><span>تعديل</span>
          </button>
          <button type="button" class="danger" data-del-task="${t.id}">
            <i class="fa-solid fa-trash"></i><span>حذف</span>
          </button>
        </div>
      `;

      const kebabBtn = card.querySelector("[data-task-menu]");
      const menu = card.querySelector(".menu");
      kebabBtn.addEventListener("click", (e)=>{
        e.stopPropagation();
        $$(".menu.show").forEach(m=>{ if(m!==menu) m.classList.remove("show"); });
        menu.classList.toggle("show");
      });

      card.addEventListener("click", (e)=>{
        const edit = e.target.closest("[data-edit-task]");
        const del  = e.target.closest("[data-del-task]");
        if(edit){
          e.preventDefault(); e.stopPropagation();
          openTaskModal({ mode:"edit", taskId:t.id, taskData:t });
          return;
        }
        if(del){
          e.preventDefault(); e.stopPropagation();
          deleteTask(t.id);
          return;
        }
      });

      body.appendChild(card);
    });
  });
}

/* ---------- Task Modal ---------- */
const taskModal = $("#taskModal");
const taskModalTitle = $("#taskModalTitle");
const taskHint = $("#taskHint");

const tSpec = $("#tSpec");
const tDesc = $("#tDesc");
const tDue  = $("#tDue");
const tUser = $("#tUser");
const tLinksWrap = $("#tLinksWrap");
const tLinkInput = $("#tLinkInput");
const tLinkAdd = $("#tLinkAdd");
const tLinksList= $("#tLinksList");
const tSave = $("#tSave");
const tError= $("#tError");

let tMode="create";
let tEditId=null;
let tColumn=null;
let tLinks=[];

function syncLinks(){
  tLinksList.innerHTML = "";
  tLinks.forEach((url, idx)=>{
    const pill = document.createElement("div");
    pill.className = "pill2";
    pill.innerHTML = `<span>${esc(url)}</span><span class="x" data-x="${idx}" title="حذف"><i class="fa-solid fa-xmark"></i></span>`;
    tLinksList.appendChild(pill);
  });
}
tLinkAdd.addEventListener("click", ()=>{
  const v = (tLinkInput.value||"").trim();
  if(!v) return;
  tLinks.push(v);
  tLinkInput.value="";
  syncLinks();
});
tLinkInput.addEventListener("keydown", (e)=>{
  if(e.key==="Enter"){ e.preventDefault(); tLinkAdd.click(); }
});
tLinksList.addEventListener("click", (e)=>{
  const x = e.target.closest("[data-x]");
  if(!x) return;
  const idx = Number(x.getAttribute("data-x"));
  if(Number.isNaN(idx)) return;
  tLinks.splice(idx,1);
  syncLinks();
});

function fillUsersSelect(selectedId){
  tUser.innerHTML = "";
  usersCache.forEach(u=>{
    const opt = document.createElement("option");
    opt.value = u.id;
    opt.textContent = u.name || u.fullName || u.email || u.id;
    tUser.appendChild(opt);
  });
  if(selectedId) tUser.value = selectedId;
}

function fillSpecsSelect(selectedId){
  tSpec.innerHTML = "";
  if(specCache.length===0){
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "لا توجد بيانات Unique Spec Keys بعد";
    tSpec.appendChild(opt);
    return;
  }
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = "اختر Unique Spec Key";
  tSpec.appendChild(opt0);

  specCache.forEach(s=>{
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.label;
    tSpec.appendChild(opt);
  });

  if(selectedId) tSpec.value = selectedId;
}

function openTaskModal({mode, column, taskId, taskData}){
  tError.classList.remove("show");

  tMode = mode;
  tEditId = taskId || null;
  tColumn = column || taskData?.column || null;

  const isCampaign = currentBoard.type === "campaign";
  tLinksWrap.style.display = isCampaign ? "block" : "none";

  taskModalTitle.textContent = mode==="edit" ? "تعديل تاسك" : "إضافة تاسك";
  taskHint.textContent = isCampaign
    ? "اختار Unique Spec Key (بدون ألوان) + وصف + موعد + روابط (اختياري) + المسؤول."
    : "اختار Unique Spec Key (بدون ألوان) + وصف + موعد + المسؤول.";

  // populate selects
  fillUsersSelect(taskData?.userId || "");
  fillSpecsSelect(taskData?.uniqueSpecId || "");

  // values
  tDesc.value = taskData?.desc || "";
  tDue.value  = taskData?.dueDate || "";
  tUser.value = taskData?.userId || (usersCache[0]?.id || "");
  tSpec.value = taskData?.uniqueSpecId || "";

  tLinks = Array.isArray(taskData?.links) ? taskData.links.slice() : [];
  tLinkInput.value = "";
  syncLinks();

  tSave.innerHTML = mode==="edit"
    ? '<i class="fa-solid fa-floppy-disk"></i><span>حفظ التعديل</span>'
    : '<i class="fa-solid fa-check"></i><span>إضافة</span>';

  openModal("taskModal");
}

async function deleteTask(id){
  if(!confirm("حذف التاسك؟")) return;
  try{
    await deleteDoc(doc(db, "tasks", id));
    showToast("تم حذف التاسك");
  }catch(_){
    showToast("فشل الحذف — راجع الصلاحيات");
  }
}

tSave.addEventListener("click", async ()=>{
  const specId = (tSpec.value||"").trim();
  const desc = (tDesc.value||"").trim();
  const due = (tDue.value||"").trim();
  const userId = (tUser.value||"").trim();

  if(!specId){ tError.textContent="اختر Unique Spec Key."; tError.classList.add("show"); return; }
  if(!tColumn){ tError.textContent="تعذر تحديد الكارت/العمود."; tError.classList.add("show"); return; }

  const userObj = usersCache.find(u=>u.id===userId) || {};
  const userName = userObj.name || userObj.fullName || userObj.email || userId;

  const specObj = specCache.find(s=>s.id===specId) || {};
  const uniqueSpecLabel = specObj.label || specId;

  const payload = {
    parentType: currentBoard.type,
    parentId: currentBoard.id,
    column: tColumn,
    uniqueSpecId: specId,
    uniqueSpecLabel,
    desc,
    dueDate: due || "",
    userId,
    userName,
    updatedAt: serverTimestamp()
  };

  if(currentBoard.type==="campaign"){
    payload.links = tLinks.slice();
  }

  try{
    if(tMode==="edit" && tEditId){
      await updateDoc(doc(db,"tasks", tEditId), payload);
      showToast("تم تعديل التاسك");
    }else{
      payload.createdAt = serverTimestamp();
      await addDoc(tasksCol, payload);
      showToast("تم إضافة التاسك");
    }
    closeModal("taskModal");
  }catch(err){
    tError.textContent="حصل خطأ في الحفظ. تأكد من Firestore Rules وأنك مسجل دخول إذا القواعد بتطلب.";
    tError.classList.add("show");
  }
});

/* ---------- Init ---------- */
async function init(){
  await Promise.all([loadUsers(), loadSpecs()]);
  watchBoards();
  showToast("جاهز");
}
init();
