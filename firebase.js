// firebase.js (TARGET: mzj-workspace-c7d4e) - ESM CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

export const targetConfig = {
  apiKey: "AIzaSyDXXDsJKnKb_0HynSTnP22QYc0yrUdx-cw",
  authDomain: "mzj-workspace-c7d4e.firebaseapp.com",
  projectId: "mzj-workspace-c7d4e",
  storageBucket: "mzj-workspace-c7d4e.firebasestorage.app",
  messagingSenderId: "1080687990992",
  appId: "1:1080687990992:web:4a496249bbf330fc37a6d5"
};

export const targetApp = initializeApp(targetConfig, "targetApp");
export const targetAuth = getAuth(targetApp);
export const targetDb = getFirestore(targetApp);
