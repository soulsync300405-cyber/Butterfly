import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBnsd_70fTczXCWYVKWDy9b3E8sG7RHosQ",
  authDomain: "soulsync-30.firebaseapp.com",
  projectId: "soulsync-30",
  storageBucket: "soulsync-30.firebasestorage.app",
  messagingSenderId: "465139133631",
  appId: "1:465139133631:web:682947cc0ce3727bf1ea0a",
  measurementId: "G-WWN9K8DFDF"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function testFirestore() {
  try {
    console.log("Testing write...");
    const docRef = await addDoc(collection(db, "test_connection"), { time: Date.now() });
    console.log("Write successful! ID:", docRef.id);

    console.log("Testing read...");
    const querySnapshot = await getDocs(collection(db, "test_connection"));
    querySnapshot.forEach((doc) => {
      console.log(`${doc.id} => ${doc.data().time}`);
    });
    process.exit(0);
  } catch (err) {
    console.error("Firebase Error:", err);
    process.exit(1);
  }
}

testFirestore();
