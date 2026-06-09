import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBnsd_70fTczXCWYVKWDy9b3E8sG7RHosQ",
  authDomain: "soulsync-30.firebaseapp.com",
  projectId: "soulsync-30",
  storageBucket: "soulsync-30.firebasestorage.app",
  messagingSenderId: "465139133631",
  appId: "1:465139133631:web:682947cc0ce3727bf1ea0a",
  databaseURL: "https://soulsync-30-default-rtdb.firebaseio.com"
};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
