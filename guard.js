// guard.js (ESM) - for TARGET auth only
import { targetAuth } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

export function requireTargetAuth({ redirectTo="./index.html" } = {}) {
  return new Promise((resolve) => {
    onAuthStateChanged(targetAuth, (user) => {
      if (!user) {
        window.location.href = redirectTo;
        return;
      }
      resolve(user);
    });
  });
}

export async function doLogout(redirectTo="./index.html") {
  await signOut(targetAuth);
  window.location.href = redirectTo;
}
