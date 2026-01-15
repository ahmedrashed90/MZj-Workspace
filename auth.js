// auth.js (ESM)
import { auth } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const $ = (s)=>document.querySelector(s);

const email = $("#email");
const pass  = $("#pass");
const btnLogin = $("#btnLogin");
const btnReset = $("#btnReset");
const msg = $("#msg");

function show(type, text){
  msg.className = "msg show " + (type==="ok" ? "ok" : "err");
  msg.textContent = text;
}

onAuthStateChanged(auth, (user)=>{
  if(user){
    // already logged in
    window.location.href = "./tasks.html";
  }
});

btnLogin.addEventListener("click", async ()=>{
  msg.className = "msg";
  const e = (email.value||"").trim();
  const p = (pass.value||"").trim();
  if(!e || !p){ show("err","اكتب الإيميل وكلمة المرور."); return; }

  try{
    await signInWithEmailAndPassword(auth, e, p);
    show("ok","تم تسجيل الدخول… جاري التحويل");
    window.location.href = "./tasks.html";
  }catch(err){
    const code = (err && err.code) ? err.code : "";
    if(code==="auth/invalid-credential" || code==="auth/wrong-password" || code==="auth/user-not-found"){
      show("err","بيانات الدخول غير صحيحة.");
    }else if(code==="auth/too-many-requests"){
      show("err","محاولات كثيرة. جرّب بعد شوية.");
    }else{
      show("err","فشل تسجيل الدخول. راجع الإيميل/الباسورد أو الصلاحيات.");
    }
  }
});

btnReset.addEventListener("click", async ()=>{
  msg.className = "msg";
  const e = (email.value||"").trim();
  if(!e){ show("err","اكتب الإيميل الأول علشان نبعت رابط إعادة تعيين."); return; }

  try{
    await sendPasswordResetEmail(auth, e);
    show("ok","تم إرسال رابط إعادة تعيين كلمة المرور على الإيميل.");
  }catch(_){
    show("err","تعذر إرسال رابط إعادة التعيين. تأكد من الإيميل.");
  }
});
