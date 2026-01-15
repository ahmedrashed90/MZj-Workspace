// sync-bridge.js (ESM) - Bridge: SOURCE(mzj-agenda) -> TARGET(mzj-workspace-c7d4e)/media_specs
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

import { targetApp, targetAuth, targetDb } from "./firebase.js";
import { doLogout } from "./guard.js";

const $ = (s)=>document.querySelector(s);

// ----- UI (sidebar mobile) -----
const sidebar = $("#wsSidebar");
const backdrop = $("#wsBackdrop");
const btnMenu = $("#btnMenu");
function openSidebar(){ sidebar.classList.add("open"); backdrop.classList.add("show"); }
function closeSidebar(){ sidebar.classList.remove("open"); backdrop.classList.remove("show"); }
btnMenu?.addEventListener("click", openSidebar);
backdrop?.addEventListener("click", closeSidebar);

// ----- Status -----
const connDot = $("#connDot");
const connText = $("#connText");
function setStatus(mode, text){
  connDot.className = "dot " + (mode==="ok"?"ok":mode==="err"?"err":"warn");
  connText.textContent = text;
}

// ----- Counters -----
const cCreated = $("#cCreated");
const cUpdated = $("#cUpdated");
const cDeleted = $("#cDeleted");
const cErrors  = $("#cErrors");
const lastEvent = $("#lastEvent");
const evtBody = $("#evtBody");
const evtCount = $("#evtCount");

const counts = { created:0, updated:0, deleted:0, errors:0 };
const events = [];
function pushEvent(type, docId, key, note=""){
  const t = new Date().toLocaleString("ar-SA");
  events.unshift({t,type,docId,key,note});
  if(events.length>50) events.length = 50;
  evtCount.textContent = String(events.length);
  evtBody.innerHTML = events.map(e=>`
    <tr>
      <td>${e.t}</td>
      <td>${e.type}</td>
      <td>${e.docId||""}</td>
      <td>${(e.key||"").slice(0,90)}</td>
      <td>${e.note||""}</td>
    </tr>
  `).join("");
  lastEvent.textContent = `${t} • ${type} • ${docId}`;
}
function bump(which){
  counts[which]++; 
  cCreated.textContent = String(counts.created);
  cUpdated.textContent = String(counts.updated);
  cDeleted.textContent = String(counts.deleted);
  cErrors.textContent  = String(counts.errors);
}

// ----- Auth -----
const btnLogout = $("#btnLogout");
btnLogout.addEventListener("click", ()=>doLogout("./index.html"));

const emailEl = $("#email");
const passEl  = $("#password");
const btnLogin = $("#btnLogin");
const authMsg = $("#authMsg");

let sourceApp, sourceAuth, sourceDb;
let unsub = null;

const SOURCE_CONFIG = {
  apiKey: "AIzaSyC614bGqnYf4Q-weTNemzWENTpa8DjGeHw",
  authDomain: "mzj-agenda.firebaseapp.com",
  projectId: "mzj-agenda",
  storageBucket: "mzj-agenda.firebasestorage.app",
  messagingSenderId: "834700407721",
  appId: "1:834700407721:web:75c17665d4f032fd65cab8"
};

function ensureSource(){
  if(sourceApp) return;
  sourceApp = initializeApp(SOURCE_CONFIG, "sourceApp");
  sourceAuth = getAuth(sourceApp);
  sourceDb = getFirestore(sourceApp);
}

async function loginBoth(email, password){
  ensureSource();
  // sign into source and target
  await signInWithEmailAndPassword(sourceAuth, email, password);
  await signInWithEmailAndPassword(targetAuth, email, password);
}

function canStart(){
  return !!(sourceAuth?.currentUser && targetAuth?.currentUser);
}

btnLogin.addEventListener("click", async ()=>{
  authMsg.textContent = "";
  const email = (emailEl.value||"").trim();
  const pass  = (passEl.value||"").trim();
  if(!email || !pass){
    authMsg.textContent = "اكتب الإيميل وكلمة المرور.";
    return;
  }
  try{
    setStatus("warn","جارِ تسجيل الدخول…");
    await loginBoth(email, pass);
    setStatus("ok","تم تسجيل الدخول (مصدر + هدف)");
    authMsg.textContent = "تم تسجيل الدخول. شغّل المزامنة من زر تشغيل المزامنة.";
  }catch(e){
    setStatus("err","فشل تسجيل الدخول");
    authMsg.textContent = "فشل تسجيل الدخول. تأكد أن نفس الحساب موجود في المصدر والهدف.";
  }
});

// Keep status on reload
onAuthStateChanged(targetAuth, (u)=>{
  if(u){
    setStatus("ok", `هدف: ${u.email||""}`);
  }else{
    setStatus("warn","الهدف: غير مسجل");
  }
});

// ----- Sync logic -----
const btnStart = $("#btnStart");
const btnStop  = $("#btnStop");

btnStart.addEventListener("click", async ()=>{
  if(unsub) return;
  ensureSource();
  if(!canStart()){
    pushEvent("error", "", "", "يجب تسجيل الدخول (مصدر + هدف) أولاً");
    bump("errors");
    setStatus("warn","سجّل دخول أولاً");
    return;
  }

  try{
    setStatus("warn","تشغيل المزامنة…");
    const srcCol = collection(sourceDb, "media_specs");
    const qy = query(srcCol);

    const targetCol = collection(targetDb, "media_specs");

    unsub = onSnapshot(qy, async (snap)=>{
      // process changes sequentially (avoid quota spikes)
      for(const ch of snap.docChanges()){
        const id = ch.doc.id;
        const data = ch.doc.data() || {};
        const key = data.key || data.uniqueKey || data.specKey || "";

        try{
          if(ch.type === "removed"){
            await deleteDoc(doc(targetCol, id));
            bump("deleted");
            pushEvent("deleted", id, key, "حذف من الهدف");
          }else{
            await setDoc(doc(targetCol, id), {
              ...data,
              _syncedFrom: "mzj-agenda",
              _syncedAt: new Date().toISOString()
            }, { merge:true });

            if(ch.type === "added"){ bump("created"); pushEvent("created", id, key, "Upsert للهدف"); }
            if(ch.type === "modified"){ bump("updated"); pushEvent("updated", id, key, "تحديث للهدف"); }
          }
        }catch(err){
          bump("errors");
          pushEvent("error", id, key, "فشل كتابة الهدف (Rules?)");
        }

        await new Promise(r=>setTimeout(r, 60));
      }
      setStatus("ok","المزامنة تعمل (Live)");
    }, (err)=>{
      bump("errors");
      setStatus("err","فشل الاتصال بالمصدر");
      pushEvent("error","", "", "فشل onSnapshot للمصدر");
    });

    btnStart.disabled = true;
    btnStop.disabled = false;

  }catch(e){
    bump("errors");
    setStatus("err","فشل تشغيل المزامنة");
    pushEvent("error","", "", "فشل تشغيل المزامنة");
  }
});

btnStop.addEventListener("click", ()=>{
  if(unsub){
    unsub();
    unsub = null;
  }
  btnStart.disabled = false;
  btnStop.disabled = true;
  setStatus("warn","تم إيقاف المزامنة");
  pushEvent("stopped","", "", "المزامنة توقفت");
});
