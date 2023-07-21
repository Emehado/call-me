// Import the functions you need from the SDKs you need
import {initializeApp} from 'firebase/app';
import {getFirestore} from 'firebase/firestore';
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: 'AIzaSyADh9k5KD3FK3ORS5H9PfZV9tx3XjWulo8',
  authDomain: 'callme-b2759.firebaseapp.com',
  databaseURL: 'https://callme-b2759-default-rtdb.firebaseio.com',
  projectId: 'callme-b2759',
  storageBucket: 'callme-b2759.appspot.com',
  messagingSenderId: '816559698416',
  appId: '1:816559698416:web:0e0e2db59d4d4e073c2d35',
  measurementId: 'G-Z6ME9B8TKJ',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

const firestoreDB = getFirestore(app);

// const fireStore = firestoreDB.fireStore();

export {firestoreDB};
