// guard.js (ESM) - Protect pages
import { auth } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

export function requireAuth({ redirectTo="./index.html" } = {}){
  return new Promise((resolve)=>{
    onAuthStateChanged(auth, (user)=>{
      if(!user){
        window.location.href = redirectTo;
        return;
      }
      resolve(user);
    });
  });
}

export async function doLogout(){
  await signOut(auth);
  window.location.href = "./index.html";
}
