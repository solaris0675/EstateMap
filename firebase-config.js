
// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBz0nAXigCqdRIENVi5TZ23HVpxm4C5OHE",
    authDomain: "realestatemap-882fe.firebaseapp.com",
    projectId: "realestatemap-882fe",
    storageBucket: "realestatemap-882fe.firebasestorage.app",
    messagingSenderId: "456738882037",
    appId: "1:456738882037:web:15f2cf692d444d93b320bc",
    measurementId: "G-E0XS7V6NHZ"
};

// Initialize Firebase (Global Namespace)
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
