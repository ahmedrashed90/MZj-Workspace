// media.js (ESM)
import { auth, db } from "./firebase.js";
import { doLogout } from "./guard.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

import {
  doc, getDoc, setDoc, serverTimestamp,
  collection, query, where, getDocs, documentId
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const $ = (s)=>document.querySelector(s);

const sidebar = $("#wsSidebar");
const backdrop = $("#wsBackdrop");
const btnMenu = $("#btnMenu");

function openSidebar(){ sidebar.classList.add("open"); backdrop.classList.add("show"); }
function closeSidebar(){ sidebar.classList.remove("open"); backdrop.classList.remove("show"); }
btnMenu?.addEventListener("click", openSidebar);
backdrop?.addEventListener("click", closeSidebar);

const connDot = $("#connDot");
const connText = $("#connText");
function setStatus(mode, text){
  connDot.className = "dot " + (mode==="ok"?"ok":mode==="err"?"err":"warn");
  connText.textContent = text;
}

const authGate = $("#authGate");
const appRoot  = $("#app");
const btnLogin = $("#btnLogin");
const emailEl  = $("#email");
const passEl   = $("#password");
const authMsg  = $("#authMsg");

const btnLogout = $("#btnLogout");
const btnSync   = $("#btnSync");
const btnOpenSpecs = $("#btnOpenSpecs");

btnLogout.addEventListener("click", ()=>doLogout("./index.html"));
btnOpenSpecs.addEventListener("click", ()=>window.location.href="./spec-keys.html");

btnLogin.addEventListener("click", async ()=>{
  authMsg.textContent = "";
  try{
    await signInWithEmailAndPassword(auth, (emailEl.value||"").trim(), (passEl.value||"").trim());
  }catch(e){
    authMsg.textContent = "فشل تسجيل الدخول.";
  }
});

const STATE_REF = doc(db, "mzj_admin_state", "v1");
const MEDIA_COL = collection(db, "media_specs");

const DEFAULT_MEDIA = {
  shoot: "لا",
  edit: "لا",
  specsReel: "لا",
  shootDate: "",
  inAgenda: "لا",
  agendaMonth: "",
  agendaYear: ""
};

const SOLD_STATES = ["مباع تحت التسليم","مباع تم التسليم","الوكالة"];

function clean(v){
  return String(v ?? "")
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g,'')
    .replace(/\s+/g,' ')
    .trim();
}

function normArabicBasic(s){
  return clean(s)
    .replace(/[أإآ]/g,'ا')
    .replace(/ة/g,'ه')
    .replace(/\s*\|\s*/g,'|')
    .toLowerCase();
}

function buildSpecKey(rec){
  const parts = [
    clean(rec.car),
    clean(rec.variant),
    clean(rec.extColor),
    clean(rec.intColor),
    clean(rec.modelYear)
  ].map(p=>p||"-");
  return parts.join(" | ");
}
function docIdFromKeyNorm(keyNorm){
  return (keyNorm || "").replaceAll("/", "_").slice(0, 900);
}
function isSoldRow(rec){
  const placeRaw = clean(rec.place || rec.location || rec["المكان"] || "");
  if(!placeRaw) return false;
  return SOLD_STATES.some(st => placeRaw.includes(st));
}

let stock = [];
let specs = [];
let mediaMap = new Map();
const filters = { q:"", shoot:"", edit:"" };

const uniqueCountEl = $("#uniqueCount");
const stockCountEl = $("#stockCount");
const visibleCountEl = $("#visibleCount");
const missingShootEl = $("#missingShoot");
const rowsBadgeEl = $("#rowsBadge");
const tb = $("#tbl tbody");

const searchEl = $("#search");
const shootFilter = $("#shootFilter");
const editFilter = $("#editFilter");
const btnClear = $("#btnClear");

searchEl.addEventListener("input", (e)=>{ filters.q = e.target.value || ""; render(); });
shootFilter.addEventListener("change", (e)=>{ filters.shoot = e.target.value || ""; render(); });
editFilter.addEventListener("change", (e)=>{ filters.edit = e.target.value || ""; render(); });
btnClear.addEventListener("click", ()=>{
  filters.q=""; filters.shoot=""; filters.edit="";
  searchEl.value=""; shootFilter.value=""; editFilter.value="";
  render();
});

function computeSpecsFromStock(rows){
  const map = new Map();
  for(const r of rows){
    if(isSoldRow(r)) continue;

    const keyHuman = buildSpecKey(r);
    const keyNorm  = normArabicBasic(keyHuman);
    const docId    = docIdFromKeyNorm(keyNorm);

    if(!map.has(docId)){
      map.set(docId, { key:keyHuman, keyNorm, docId, count:1 });
    }else{
      map.get(docId).count++;
    }
  }
  return Array.from(map.values()).sort((a,b)=>(b.count||0)-(a.count||0));
}

async function fetchMedia(docIds){
  const missing = docIds.filter(id => id && !mediaMap.has(id));
  if(!missing.length) return;

  for(let i=0;i<missing.length;i+=30){
    const chunk = missing.slice(i,i+30);
    const qy = query(MEDIA_COL, where(documentId(), "in", chunk));
    const snap = await getDocs(qy);
    snap.forEach(ds=>{
      const d = ds.data() || {};
      mediaMap.set(ds.id, {
        shoot: d.shoot || "لا",
        edit: d.edit || "لا",
        specsReel: d.specsReel || "لا",
        shootDate: d.shootDate || "",
        inAgenda: d.inAgenda || "لا",
        agendaMonth: d.agendaMonth || "",
        agendaYear: d.agendaYear || ""
      });
    });
    chunk.forEach(id=>{
      if(!mediaMap.has(id)) mediaMap.set(id, {...DEFAULT_MEDIA});
    });
  }
}

function getMedia(docId){
  return mediaMap.get(docId) || {...DEFAULT_MEDIA};
}

async function saveMedia(docId, patch){
  const before = getMedia(docId);
  const after = { ...before, ...patch };

  if(after.edit !== "نعم"){
    after.specsReel = "لا";
    after.shootDate = "";
  }
  if(after.inAgenda !== "نعم"){
    after.agendaMonth = "";
    after.agendaYear = "";
  }

  mediaMap.set(docId, after);

  await setDoc(doc(MEDIA_COL, docId), {
    key: specs.find(x=>x.docId===docId)?.key || "",
    ...after,
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser?.email || ""
  }, { merge:true });
}

function applyFilters(list){
  const q = (filters.q||"").trim().toLowerCase();
  return list.filter(s=>{
    const m = getMedia(s.docId);
    if(filters.shoot && (m.shoot||"لا") !== filters.shoot) return false;
    if(filters.edit && (m.edit||"لا") !== filters.edit) return false;
    if(q){
      if(!(String(s.key||"").toLowerCase().includes(q))) return false;
    }
    return true;
  });
}

function render(){
  const filtered = applyFilters(specs);

  const totalCars = specs.reduce((sum, s)=>sum + (Number(s.count)||0), 0);
  uniqueCountEl.textContent = String(specs.length||0);
  stockCountEl.textContent = String(totalCars||0);
  visibleCountEl.textContent = String(filtered.length||0);

  const miss = filtered.filter(s => (getMedia(s.docId).shoot||"لا") !== "نعم").length;
  missingShootEl.textContent = String(miss||0);
  rowsBadgeEl.textContent = `${filtered.length} صف`;

  tb.innerHTML = "";
  filtered.forEach((s, idx)=>{
    const m = getMedia(s.docId);
    const tr = document.createElement("tr");
    tr.dataset.docId = s.docId;

    tr.innerHTML = `
      <td>${idx+1}</td>
      <td class="keycell" data-key="${(s.key||"").replace(/"/g,"&quot;")}">${s.key||""}</td>
      <td><span class="badge">× ${s.count||0}</span></td>
      <td>
        <select class="mini js-shoot">
          <option value="لا" ${m.shoot==="لا"?"selected":""}>لا</option>
          <option value="نعم" ${m.shoot==="نعم"?"selected":""}>نعم</option>
        </select>
      </td>
      <td>
        <select class="mini js-edit">
          <option value="لا" ${m.edit==="لا"?"selected":""}>لا</option>
          <option value="نعم" ${m.edit==="نعم"?"selected":""}>نعم</option>
        </select>
      </td>
      <td>
        <div class="row" style="gap:8px;flex-wrap:wrap">
          <select class="mini js-specsReel" style="min-width:170px" ${m.edit==="نعم"?"":"disabled"}>
            <option value="لا" ${m.specsReel==="لا"?"selected":""}>صور + ريل مواصفات: لا</option>
            <option value="نعم" ${m.specsReel==="نعم"?"selected":""}>صور + ريل مواصفات: نعم</option>
          </select>
          <input class="mini js-shootDate" type="date" value="${(m.shootDate||"").slice(0,10)}" ${m.edit==="نعم"?"":"disabled"} />
        </div>
      </td>
      <td>
        <select class="mini js-inAgenda">
          <option value="لا" ${m.inAgenda==="لا"?"selected":""}>لا</option>
          <option value="نعم" ${m.inAgenda==="نعم"?"selected":""}>نعم</option>
        </select>
      </td>
      <td>
        <div class="row" style="gap:8px;flex-wrap:wrap">
          <select class="mini js-agendaMonth" style="min-width:150px" ${m.inAgenda==="نعم"?"":"disabled"}>
            <option value="">شهر</option>
            ${["1","2","3","4","5","6","7","8","9","10","11","12"].map(v=>`<option value="${v}" ${(String(m.agendaMonth)===v)?"selected":""}>${v}</option>`).join("")}
          </select>
          <input class="mini js-agendaYear" type="number" min="2000" max="2100" placeholder="سنة" value="${m.agendaYear||""}" ${m.inAgenda==="نعم"?"":"disabled"} />
        </div>
      </td>
    `;
    tb.appendChild(tr);
  });
}

tb.addEventListener("click", async (e)=>{
  const keyEl = e.target.closest(".keycell");
  if(keyEl){
    const key = keyEl.getAttribute("data-key") || "";
    if(key) await navigator.clipboard.writeText(key);
  }
});

tb.addEventListener("change", async (e)=>{
  const row = e.target.closest("tr");
  if(!row) return;
  const docId = row.dataset.docId;
  if(!docId) return;

  try{
    if(e.target.classList.contains("js-shoot")){
      await saveMedia(docId, { shoot: e.target.value });
    }
    if(e.target.classList.contains("js-edit")){
      const val = e.target.value;
      // enable/disable edit details
      row.querySelector(".js-specsReel")?.toggleAttribute("disabled", val!=="نعم");
      row.querySelector(".js-shootDate")?.toggleAttribute("disabled", val!=="نعم");
      await saveMedia(docId, { edit: val });
    }
    if(e.target.classList.contains("js-specsReel")){
      await saveMedia(docId, { specsReel: e.target.value });
    }
    if(e.target.classList.contains("js-shootDate")){
      await saveMedia(docId, { shootDate: e.target.value || "" });
    }
    if(e.target.classList.contains("js-inAgenda")){
      const val = e.target.value;
      row.querySelector(".js-agendaMonth")?.toggleAttribute("disabled", val!=="نعم");
      row.querySelector(".js-agendaYear")?.toggleAttribute("disabled", val!=="نعم");
      await saveMedia(docId, { inAgenda: val });
    }
    if(e.target.classList.contains("js-agendaMonth")){
      await saveMedia(docId, { agendaMonth: e.target.value || "" });
    }
    if(e.target.classList.contains("js-agendaYear")){
      await saveMedia(docId, { agendaYear: (e.target.value||"").trim() });
    }
    setStatus("ok", "تم الحفظ");
    render();
  }catch(_){
    setStatus("warn", "تعذر الحفظ - راجع الصلاحيات");
  }
});

btnSync.addEventListener("click", async ()=>{
  try{
    setStatus("warn", "مزامنة…");
    // write minimal docs for any missing specs (batched by 200 sequential)
    const toWrite = specs.filter(s => !s.docId || !mediaMap.has(s.docId)).map(s=>s.docId).filter(Boolean);

    // Also write docs that exist in map but have no stored key (ensure key is stored for spec-keys listing)
    // We'll just upsert for all visible specs but with minimal payload; throttled by chunks.
    const ids = specs.map(s=>s.docId).filter(Boolean);
    let wrote = 0;

    for(let i=0;i<ids.length;i+=80){
      const chunk = ids.slice(i,i+80);
      for(const id of chunk){
        const m = getMedia(id);
        const key = specs.find(x=>x.docId===id)?.key || "";
        await setDoc(doc(MEDIA_COL, id), {
          key,
          ...m,
          updatedAt: serverTimestamp(),
          updatedBy: auth.currentUser?.email || ""
        }, { merge:true });
        wrote++;
      }
      // small pause (yield)
      await new Promise(r=>setTimeout(r, 250));
    }
    setStatus("ok", `تمت المزامنة (${wrote})`);
  }catch(e){
    setStatus("warn", "فشل المزامنة");
  }
});

async function initData(){
  setStatus("warn", "تحميل المخزون…");
  const s = await getDoc(STATE_REF);
  if(s.exists()){
    const d = s.data() || {};
    stock = Array.isArray(d.stock) ? d.stock : [];
  }else{
    stock = [];
  }
  specs = computeSpecsFromStock(stock);
  await fetchMedia(specs.map(x=>x.docId));
  render();
  setStatus("ok", "جاهز");
}

onAuthStateChanged(auth, async (user)=>{
  if(user){
    authGate.style.display = "none";
    appRoot.style.display = "block";
    setStatus("ok", `متصل: ${user.email||""}`);
    await initData();
  }else{
    appRoot.style.display = "none";
    authGate.style.display = "grid";
    setStatus("warn", "لم يتم تسجيل الدخول");
  }
});

// init
setStatus("warn", "جارِ الاتصال…");
