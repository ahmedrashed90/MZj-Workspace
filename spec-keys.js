// spec-keys.js (ESM) - TARGET only (mzj-workspace-c7d4e)
import { targetAuth, targetDb } from "./firebase.js";
import { doLogout } from "./guard.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

import {
  collection, query, orderBy, limit, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

const $ = (s)=>document.querySelector(s);

// sidebar mobile
const sidebar = $("#wsSidebar");
const backdrop = $("#wsBackdrop");
const btnMenu = $("#btnMenu");
function openSidebar(){ sidebar.classList.add("open"); backdrop.classList.add("show"); }
function closeSidebar(){ sidebar.classList.remove("open"); backdrop.classList.remove("show"); }
btnMenu?.addEventListener("click", openSidebar);
backdrop?.addEventListener("click", closeSidebar);

// status
const connDot = $("#connDot");
const connText = $("#connText");
function setStatus(mode, text){
  connDot.className = "dot " + (mode==="ok"?"ok":mode==="err"?"err":"warn");
  connText.textContent = text;
}

// controls
$("#btnLogout").addEventListener("click", ()=>doLogout("./index.html"));
$("#btnRefresh").addEventListener("click", ()=>{ render(); });

const searchEl = $("#search");
const shootFilter = $("#shootFilter");
const editFilter = $("#editFilter");
const agendaFilter = $("#agendaFilter");
const btnClear = $("#btnClear");

const rowsBadge = $("#rowsBadge");
const docsCountEl = $("#docsCount");
const missingShootEl = $("#missingShoot");
const missingEditEl = $("#missingEdit");
const inAgendaEl = $("#inAgenda");

const tb = $("#tbl tbody");

const filters = { q:"", shoot:"", edit:"", agenda:"" };
function wire(){
  searchEl.addEventListener("input",(e)=>{filters.q=e.target.value||""; render();});
  shootFilter.addEventListener("change",(e)=>{filters.shoot=e.target.value||""; render();});
  editFilter.addEventListener("change",(e)=>{filters.edit=e.target.value||""; render();});
  agendaFilter.addEventListener("change",(e)=>{filters.agenda=e.target.value||""; render();});
  btnClear.addEventListener("click", ()=>{
    filters.q="";filters.shoot="";filters.edit="";filters.agenda="";
    searchEl.value="";shootFilter.value="";editFilter.value="";agendaFilter.value="";
    render();
  });
}
wire();

let rows = [];

function tsToText(ts){
  try{
    const d = ts?.toDate ? ts.toDate() : null;
    if(!d) return "";
    return d.toLocaleString("ar-SA");
  }catch(_){ return ""; }
}

function applyFilters(list){
  const q = (filters.q||"").trim().toLowerCase();
  return list.filter(r=>{
    if(filters.shoot && (r.shoot||"لا") !== filters.shoot) return false;
    if(filters.edit && (r.edit||"لا") !== filters.edit) return false;
    if(filters.agenda && (r.inAgenda||"لا") !== filters.agenda) return false;
    if(q){
      const key = String(r.key||"").toLowerCase();
      const id  = String(r.id||"").toLowerCase();
      if(!key.includes(q) && !id.includes(q)) return false;
    }
    return true;
  });
}

function render(){
  const filtered = applyFilters(rows);

  rowsBadge.textContent = String(filtered.length);
  docsCountEl.textContent = String(rows.length);

  missingShootEl.textContent = String(filtered.filter(r=>(r.shoot||"لا")!=="نعم").length);
  missingEditEl.textContent  = String(filtered.filter(r=>(r.edit||"لا")!=="نعم").length);
  inAgendaEl.textContent     = String(filtered.filter(r=>(r.inAgenda||"لا")==="نعم").length);

  tb.innerHTML = "";
  filtered.forEach((r, idx)=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${idx+1}</td>
      <td>${r.id}</td>
      <td class="keycell" data-key="${String(r.key||"").replace(/"/g,"&quot;")}">${r.key||""}</td>
      <td>${r.shoot||"لا"}</td>
      <td>${r.edit||"لا"}</td>
      <td>${r.inAgenda||"لا"}</td>
      <td>${r.inAgenda==="نعم" ? (r.agendaMonth||"") : "—"}</td>
      <td>${r.inAgenda==="نعم" ? (r.agendaYear||"") : "—"}</td>
      <td>${r.updatedAtText||"—"}</td>
    `;
    tb.appendChild(tr);
  });
}

tb.addEventListener("click", async (e)=>{
  const el = e.target.closest(".keycell");
  if(!el) return;
  const key = el.getAttribute("data-key") || "";
  if(key) await navigator.clipboard.writeText(key);
});

function startLive(){
  setStatus("warn","Live…");
  const col = collection(targetDb, "media_specs");
  const qy = query(col, orderBy("updatedAt","desc"), limit(2000));
  onSnapshot(qy, (snap)=>{
    rows = snap.docs.map(d=>{
      const data = d.data() || {};
      return {
        id: d.id,
        key: data.key || "",
        shoot: data.shoot || "لا",
        edit: data.edit || "لا",
        inAgenda: data.inAgenda || "لا",
        agendaMonth: data.agendaMonth || "",
        agendaYear: data.agendaYear || "",
        updatedAtText: tsToText(data.updatedAt)
      };
    });
    render();
    setStatus("ok","متصل — Live");
  }, ()=>{
    setStatus("err","تعذر الاتصال");
  });
}

onAuthStateChanged(targetAuth, (user)=>{
  if(user){
    setStatus("ok", `متصل: ${user.email||""}`);
    startLive();
  }else{
    window.location.href = "./index.html";
  }
});
