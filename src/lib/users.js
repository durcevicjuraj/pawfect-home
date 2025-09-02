import { doc, getDoc, setDoc, serverTimestamp,updateDoc } from "firebase/firestore";
import { db } from "./firebase";

export async function updateUserDoc(uid, data) {
  await updateDoc(doc(db, "users", uid), data);
}

export async function ensureUserDoc(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      email: user.email || null,
      displayName: user.displayName || null,
      role: "user",
      createdAt: serverTimestamp(),
    });
  }
}
