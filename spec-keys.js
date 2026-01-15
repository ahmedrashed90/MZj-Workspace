// spec-keys.js (ESM)
import { auth, db } from "./firebase.js";
import { doLogout } from "./guard.js";
import {
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

import {
  collection, query, orderBy, limit,
  onSnapshot
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
const btnOpenMedia = $("#btnOpenMedia");

btnLogout.addEventListener("click", ()=>doLogout("./index.html"));
btnOpenMedia.addEventListener("click", ()=>window.location.href="./media.html");

btnLogin.addEventListener("click", async ()=>{
  authMsg.textContent = "";
  try{
    await signInWithEmailAndPassword(auth, (emailEl.value||"").trim(), (passEl.value||"").trim());
  }catch(_){
    authMsg.textContent = "فشل تسجيل الدخول.";
  }
});

const MEDIA_COL = collection(db, "media_specs");

const docsCountEl = $("#docsCount");
const missingShootEl = $("#missingShoot");
const inAgendaEl = $("#inAgenda");
const rowsBadgeEl = $("#rowsBadge");
const tb = $("#tbl tbody");

const searchEl = $("#search");
const shootFilter = $("#shootFilter");
const inAgendaFilter = $("#inAgendaFilter");
const btnClear = $("#btnClear");

const filters = { q:"", shoot:"", inAgenda:"" };
searchEl.addEventListener("input",(e)=>{filters.q=e.target.value||""; render();});
shootFilter.addEventListener("change",(e)=>{filters.shoot=e.target.value||""; render();});
inAgendaFilter.addEventListener("change",(e)=>{filters.inAgenda=e.target.value||""; render();});
btnClear.addEventListener("click", ()=>{
  filters.q="";filters.shoot="";filters.inAgenda="";
  searchEl.value="";shootFilter.value="";inAgendaFilter.value="";
  render();
});

let rows = [];

function applyFilters(list){
  const q = (filters.q||"").trim().toLowerCase();
  return list.filter(r=>{
    if(filters.shoot && (r.shoot||"لا") !== filters.shoot) return false;
    if(filters.inAgenda && (r.inAgenda||"لا") !== filters.inAgenda) return false;
    if(q){
      const key = String(r.key||"").toLowerCase();
      if(!key.includes(q)) return false;
    }
    return true;
  });
}

function render(){
  const filtered = applyFilters(rows);

  docsCountEl.textContent = String(rows.length||0);
  missingShootEl.textContent = String(filtered.filter(r=>(r.shoot||"لا")!=="نعم").length||0);
  inAgendaEl.textContent = String(filtered.filter(r=>(r.inAgenda||"لا")==="نعم").length||0);
  rowsBadgeEl.textContent = `${filtered.length} صف`;

  tb.innerHTML = "";
  filtered.forEach((r, idx)=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${idx+1}</td>
      <td>${r.id}</td>
      <td class="keycell" data-key="${String(r.key||"").replace(/"/g,"&quot;")}">${r.key||""}</td>
      <td>${r.shoot||"لا"}</td>
      <td>${r.edit||"لا"}</td>
      <td>${r.edit==="نعم" ? `${r.specsReel||"لا"} • ${(r.shootDate||"")}` : "—"}</td>
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

function tsToText(ts){
  try{
    // Firestore Timestamp has toDate()
    const d = ts?.toDate ? ts.toDate() : null;
    if(!d) return "";
    return d.toLocaleString("ar-SA");
  }catch(_){ return ""; }
}

function startLive(){
  setStatus("warn", "Live…");
  const qy = query(MEDIA_COL, orderBy("updatedAt","desc"), limit(1000));
  onSnapshot(qy, (snap)=>{
    rows = snap.docs.map(d=>{
      const data = d.data() || {};
      return {
        id: d.id,
        key: data.key || "",
        shoot: data.shoot || "لا",
        edit: data.edit || "لا",
        specsReel: data.specsReel || "لا",
        shootDate: data.shootDate || "",
        inAgenda: data.inAgenda || "لا",
        agendaMonth: data.agendaMonth || "",
        agendaYear: data.agendaYear || "",
        updatedAtText: tsToText(data.updatedAt)
      };
    });
    render();
    setStatus("ok", "متصل — Live");
  }, ()=>{
    setStatus("warn", "تعذر الاتصال");
  });
}

onAuthStateChanged(auth, (user)=>{
  if(user){
    authGate.style.display="none";
    appRoot.style.display="block";
    setStatus("ok", `متصل: ${user.email||""}`);
    startLive();
  }else{
    appRoot.style.display="none";
    authGate.style.display="grid";
    setStatus("warn", "لم يتم تسجيل الدخول");
  }
});

setStatus("warn", "جارِ الاتصال…");
