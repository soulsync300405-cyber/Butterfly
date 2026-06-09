import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBnsd_70fTczXCWYVKWDy9b3E8sG7RHosQ",
  authDomain: "soulsync-30.firebaseapp.com",
  projectId: "soulsync-30",
  storageBucket: "soulsync-30.firebasestorage.app",
  messagingSenderId: "465139133631",
  appId: "1:465139133631:web:682947cc0ce3727bf1ea0a",
  databaseURL: "https://soulsync-30-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

async function testFirebase() {
  try {
    console.log("Testing write...");
    await set(ref(db, "test_connection"), { time: Date.now() });
    console.log("Write successful!");

    console.log("Testing read...");
    const snap = await get(ref(db, "test_connection"));
    console.log("Read successful! Data:", snap.val());
    process.exit(0);
  } catch (err) {
    console.error("Firebase Error:", err);
    process.exit(1);
  }
}

testFirebase();
