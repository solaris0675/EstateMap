# EstateMap
A map-based real estate platform where buyers discover listings on an interactive map, owners post properties, and admins approve them 
# 🗺️ EstateMap — Premium Property Finder

A real-time, map-based real estate platform where buyers can discover properties, owners can list them, and admins can moderate listings — all in a single-page, no-framework web app.

![EstateMap](https://img.shields.io/badge/Firebase-Realtime-orange?logo=firebase) ![Leaflet](https://img.shields.io/badge/Leaflet-1.9.4-green?logo=leaflet) ![License](https://img.shields.io/badge/license-MIT-blue)

---

## ✨ Features

### 🏠 Property Listings
- Browse properties as interactive markers on a live OpenStreetMap map
- View property details: title, price, beds, baths, sq ft, description, and owner info
- Photo gallery viewer for multiple property images
- Price history chart with a regional average comparison line (Chart.js)

### 👤 Authentication
- Email/password login and registration
- Google OAuth sign-in
- Guest mode (browse without an account)
- Role-based access: **Buyer**, **Property Owner**, or **Admin**

### 📍 Map Interactions
- Auto-geolocation on load — centers the map to your current position
- Click anywhere on the map to pin a new listing location (owners)
- Leaflet circle overlay shows your detected location accuracy

### 🏷️ Property Listing (Owners)
- Owners can post new listings by clicking the map, then filling out a form
- Fields: title, price, sq ft, beds, baths, image URL, description
- Listings go into a **pending** state until approved by an admin
- Owners can view and delete their own listings via "My Listings"

### 🛡️ Admin Dashboard
- Admins see a pending queue of all submitted listings
- One-click approve or reject for each submission
- Approved listings appear live on the map for all users

### 💬 Real-Time Messaging
- Buyers can start a chat with a property owner directly from the listing detail panel
- Messages are stored in Firestore and sync in real time
- Inbox modal shows all active conversations for the logged-in user

### 📱 Responsive Design
- Mobile-first layout: sidebar shifts to a bottom sheet on smaller screens
- Property overlay panel goes full-width on mobile
- Glassmorphism sidebar with backdrop blur for a premium feel

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Map | [Leaflet.js](https://leafletjs.com/) 1.9.4 + OpenStreetMap tiles |
| Auth & Database | [Firebase](https://firebase.google.com/) (Auth + Firestore) |
| Charts | [Chart.js](https://www.chartjs.org/) |
| Styling | Vanilla CSS with CSS custom properties |
| Icons | [Font Awesome](https://fontawesome.com/) 6.4 |
| Fonts | [Outfit](https://fonts.google.com/specimen/Outfit) (Google Fonts) |
| Runtime | Plain HTML + Vanilla JS (no framework, no bundler) |

---

## 📁 Project Structure

```
EstateMap/
├── index.html          # App shell — all modals, overlays, and map container
├── style.css           # All styles (sidebar, overlays, chat, modals, responsive)
├── script.js           # App logic — auth, Firestore, map, chat, listings
└── firebase-config.js  # Firebase initialization (API key lives here)
```

---

## 🚀 Getting Started

### Prerequisites
- A Firebase project with **Authentication** and **Firestore** enabled
- A web browser (no build step needed)

### 1. Clone the repository

```bash
git clone https://github.com/solaris0675/EstateMap.git
cd EstateMap
```

### 2. Configure Firebase

Open `firebase-config.js` and replace the config object with your own Firebase project credentials:

```js
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

> ⚠️ Never commit a real API key to a public repo. Use Firebase security rules and domain restrictions to protect your project.

### 3. Enable Firebase services

In the [Firebase Console](https://console.firebase.google.com/):

- **Authentication** → Enable *Email/Password* and *Google* sign-in providers
- **Firestore** → Create a database in production or test mode

### 4. Set up Firestore collections

The app expects the following collections. They are created automatically on first use, but here's the schema for reference:

**`users`**
```json
{
  "email": "user@example.com",
  "role": "buyer | owner | admin",
  "createdAt": "ISO timestamp"
}
```

**`properties`**
```json
{
  "title": "Sunny Beach House",
  "price": "$750,000",
  "beds": 3,
  "baths": 2,
  "sqft": 1800,
  "description": "...",
  "image": "https://...",
  "lat": 34.05,
  "lng": -118.24,
  "ownerId": "uid",
  "owner": { "name": "John Doe" },
  "status": "pending | approved",
  "createdAt": "ISO timestamp"
}
```

**`conversations`**
```json
{
  "propertyId": "...",
  "propertyTitle": "...",
  "participants": ["buyerUid", "ownerUid"],
  "ownerName": "Jane Smith",
  "buyerName": "John Doe",
  "messages": [
    { "text": "Is this available?", "senderId": "uid", "timestamp": "..." }
  ],
  "lastUpdated": "ISO timestamp"
}
```

### 5. Run the app

Since this is a plain HTML project, just open `index.html` in a browser — or serve it locally with any static file server:

```bash
# Using Python
python -m http.server 8080

# Using Node.js (npx)
npx serve .
```

Then visit `http://localhost:8080`.

---

## 🔐 User Roles

| Role | Capabilities |
|---|---|
| **Guest** | Browse map, view listings (read-only) |
| **Buyer** | All guest access + chat with owners, inbox |
| **Owner** | All buyer access + list properties, manage own listings |
| **Admin** | All owner access + approve/reject pending listings |

Roles are set at registration. Buyers can request a role switch to Owner from the sidebar.

---

## 🗺️ Firestore Security Rules (Recommended)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }

    match /properties/{propId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update, delete: if request.auth.uid == resource.data.ownerId
                            || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }

    match /conversations/{convId} {
      allow read, write: if request.auth.uid in resource.data.participants;
      allow create: if request.auth != null;
    }
  }
}
```

---

## 📸 Screenshots

> _Add your screenshots here_

| Map View | Property Detail | Chat |
|---|---|---|
| ![map]() | ![detail]() | ![chat]() |

---

## 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you'd like to change.

---

## 📄 License

MIT © [solaris0675](https://github.com/solaris0675)
