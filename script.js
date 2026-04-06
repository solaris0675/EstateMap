// --- TOAST NOTIFICATION SYSTEM ---
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const msgSpan = document.getElementById('toastMessage');

    if (msgSpan) {
        msgSpan.innerText = message;
    } else {
        toast.innerText = message;
    }

    toast.style.backgroundColor = type === 'error' ? '#ef4444' : '#22c55e';
    toast.style.color = 'white';
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

// Mock Property Data (Fallback)
const initialMockProperties = [];

// State
let properties = [];
let conversations = [];
let currentUser = null;
let userRole = "buyer";
let activeProperty = null;
let activeConversationId = null;
let mapMarkers = [];
let regionalOverlays = [];

// UI Elements
const sidebar = document.getElementById('sidebar');
const listingsContainer = document.getElementById('listings');
const loginModal = document.getElementById('loginModal');
const loginForm = document.getElementById('loginForm');
const authError = document.getElementById('authError');
const listPropertyBtn = document.getElementById('listPropertyBtn');
const mapElement = document.getElementById('map');
const propertyOverlay = document.getElementById('propertyOverlay');

// Initialize Map
const map = L.map('map').setView([34.0522, -118.2437], 10);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Geolocation
map.locate({ setView: true, maxZoom: 12 });
map.on('locationfound', (e) => {
    L.circle(e.latlng, { color: '#4f46e5', radius: e.accuracy / 2 }).addTo(map);
});

// Custom Icon
const customIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    shadowSize: [41, 41]
});

// --- AUTHENTICATION ---

// Monitor Auth State
auth.onAuthStateChanged(async (user) => {
    console.log("🔐 Auth State Changed:", user ? user.email : "No user");

    if (user) {
        currentUser = user;

        try {
            const userDoc = await db.collection("users").doc(user.uid).get();
            console.log("📄 User document exists:", userDoc.exists);

            if (userDoc.exists) {
                const userData = userDoc.data();
                userRole = userData.role;
                console.log("✅ Role from Firestore:", userRole);
            } else {
                // If Google Login (new user), create doc with buyer role
                console.log("⚠️ No user document found. Creating new buyer account...");
                userRole = "buyer";
                await db.collection("users").doc(user.uid).set({
                    email: user.email,
                    role: "buyer",
                    createdAt: new Date().toISOString()
                });
                console.log("✅ Created new user document with buyer role");
            }
        } catch (e) {
            console.error("❌ Error fetching user role:", e);
            userRole = "buyer";
            showToast("Error loading user data. Defaulting to buyer role.", "error");
        }

        updateUIForUser();
        loginModal.classList.add('hidden');

        subscribeToProperties();
        subscribeToConversations();

        console.log("✅ Logged in as:", user.email, "| Role:", userRole);
        showToast(`Welcome back! Logged in as ${userRole}`, "success");
    } else {
        console.log("👤 No user logged in - Guest mode");
        currentUser = null;
        userRole = "guest";
        updateUIForUser();
        subscribeToProperties();
    }
});

// Guest Access
document.getElementById('closeLoginModal').addEventListener('click', () => {
    loginModal.classList.add('hidden');
});

// Open Login Manual
document.getElementById('loginSidebarBtn').addEventListener('click', () => {
    loginModal.classList.remove('hidden');
});


// Login Logic
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPass').value;

    console.log("🔑 Attempting login for:", email);

    try {
        await auth.signInWithEmailAndPassword(email, pass);
        authError.style.display = 'none';
        console.log("✅ Login successful");
    } catch (error) {
        console.error("❌ Login error:", error.code, error.message);

        // User-friendly error messages
        let errorMsg = error.message;
        if (error.code === 'auth/user-not-found') {
            errorMsg = "No account found with this email. Please register first.";
        } else if (error.code === 'auth/wrong-password') {
            errorMsg = "Incorrect password. Please try again.";
        } else if (error.code === 'auth/invalid-email') {
            errorMsg = "Invalid email address format.";
        } else if (error.code === 'auth/too-many-requests') {
            errorMsg = "Too many failed attempts. Please try again later.";
        }

        authError.innerText = errorMsg;
        authError.style.display = 'block';
        showToast(errorMsg, "error");
    }
});

// Register
document.getElementById('btnSignUp').addEventListener('click', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const pass = document.getElementById('loginPass').value;
    const role = document.getElementById('loginRole').value;

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, pass);
        const user = userCredential.user;

        await db.collection("users").doc(user.uid).set({
            email: email,
            role: role,
            createdAt: new Date().toISOString()
        });

        await user.updateProfile({
            displayName: email.split('@')[0]
        });

        authError.style.display = 'none';
    } catch (error) {
        authError.innerText = error.message;
        authError.style.display = 'block';
    }
});

// Google Login
document.getElementById('btnGoogle').addEventListener('click', async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        await auth.signInWithPopup(provider);
        authError.style.display = 'none';
    } catch (error) {
        authError.innerText = error.message;
        authError.style.display = 'block';
    }
});


// Logout
document.getElementById('logoutBtn').addEventListener('click', () => {
    auth.signOut().then(() => {
        alert("Logged out!");
        location.reload();
    });
});

function updateUIForUser() {
    const loginBtn = document.getElementById('loginSidebarBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const myListingsBtn = document.getElementById('myListingsBtn');
    const roleDisplay = document.getElementById('userRoleDisplay');
    const roleText = document.getElementById('currentRoleText');
    const switchRoleBtn = document.getElementById('switchRoleBtn');

    // Default Hidden
    listPropertyBtn.style.display = 'none';
    myListingsBtn.style.display = 'none';
    document.getElementById('adminDashboardBtn').style.display = 'none';
    switchRoleBtn.style.display = 'none';
    roleDisplay.style.display = 'none';

    if (currentUser) {
        logoutBtn.style.display = 'block';
        loginBtn.style.display = 'none';
        roleDisplay.style.display = 'block';
        roleText.innerText = userRole.charAt(0).toUpperCase() + userRole.slice(1);

        if (userRole === 'owner') {
            listPropertyBtn.style.display = 'flex';
            myListingsBtn.style.display = 'flex';
            subscribeToMyProperties();
        } else if (userRole === 'admin') {
            document.getElementById('adminDashboardBtn').style.display = 'flex';
            subscribeToPendingProperties();
        } else {
            // Buyer - Show Switch Option
            switchRoleBtn.style.display = 'block';
        }
    } else {
        // Guest
        logoutBtn.style.display = 'none';
        loginBtn.style.display = 'block';
        roleDisplay.style.display = 'block';
        roleText.innerText = "Guest";
    }
}

// Switch Role Logic
document.getElementById('switchRoleBtn').addEventListener('click', async () => {
    if (!currentUser) return;
    try {
        await db.collection("users").doc(currentUser.uid).update({ role: "owner" });
        userRole = "owner";
        showToast("Switched to Owner Account! You can now list properties.");
        updateUIForUser();
    } catch (err) {
        console.error("Role Switch Error:", err);
        if (err.message.includes("Missing or insufficient permissions")) {
            // FORCE LOCAL OVERRIDE (User cannot fix rules)
            showToast("Database Locked! Using Local Owner Mode.", "warning");
            userRole = "owner";
            updateUIForUser();
            alert("⚠️ I have switched you to OWNER locally because your database is locked.\n\nYou can now see the buttons, but your changes won't save to the cloud until you fix the Rules.");
        } else {
            showToast("Error switching role: " + err.message, "error");
        }
    }
});

// --- FIRESTORE DATA ---

// Properties (APPROVED ONLY for MAP)
function subscribeToProperties() {
    db.collection("properties")
        .where("status", "==", "approved")
        .onSnapshot((snapshot) => {
            properties = [];
            snapshot.forEach((doc) => {
                properties.push({ id: doc.id, ...doc.data() });
            });
            renderMarkers();
            renderRegionalIndicators();
            renderListings();
        });
}

// ADMIN: Pending Properties
let pendingProperties = [];
function subscribeToPendingProperties() {
    db.collection("properties")
        .where("status", "==", "pending")
        .onSnapshot((snapshot) => {
            pendingProperties = [];
            snapshot.forEach((doc) => {
                pendingProperties.push({ id: doc.id, ...doc.data() });
            });
            renderAdminDashboard();
        });
}

// OWNER: My Properties
let myProperties = [];
function subscribeToMyProperties() {
    if (!currentUser) return;
    db.collection("properties")
        .where("ownerId", "==", currentUser.uid)
        .onSnapshot((snapshot) => {
            myProperties = [];
            snapshot.forEach((doc) => {
                myProperties.push({ id: doc.id, ...doc.data() });
            });
            // Auto-update if modal is open
            if (!document.getElementById('myListingsModal').classList.contains('hidden')) {
                renderMyListings();
            }
        });
}

// My Listings Modal UI
const myListingsModal = document.getElementById('myListingsModal');
const myListingsList = document.getElementById('myListingsList');

document.getElementById('myListingsBtn').addEventListener('click', () => {
    myListingsModal.classList.remove('hidden');
    renderMyListings();
});

document.getElementById('closeMyListings').addEventListener('click', () => {
    myListingsModal.classList.add('hidden');
});

function renderMyListings() {
    myListingsList.innerHTML = '';
    if (myProperties.length === 0) {
        myListingsList.innerHTML = '<p style="text-align: center; color: #64748b;">You have no listings yet.</p>';
        return;
    }

    myProperties.forEach(prop => {
        const item = document.createElement('div');
        item.style.padding = '15px';
        item.style.borderBottom = '1px solid #eee';
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';

        const statusColor = prop.status === 'approved' ? '#22c55e' : '#f59e0b';
        const statusText = prop.status === 'approved' ? 'Approved' : 'Pending';

        item.innerHTML = `
            <div>
                <div style="font-weight:600;">${prop.title}</div>
                <div style="font-size:0.8rem; color:#64748b;">${prop.price} - ${prop.location}</div>
                <div style="font-size:0.75rem; color:${statusColor};">Status: ${statusText}</div>
            </div>
        `;
        myListingsList.appendChild(item);
    });
}

// Admin Dashboard UI
const adminModal = document.getElementById('adminModal');
const adminList = document.getElementById('adminList');

document.getElementById('adminDashboardBtn').addEventListener('click', () => {
    adminModal.classList.remove('hidden');
    renderAdminDashboard();
});

document.getElementById('closeAdmin').addEventListener('click', () => {
    adminModal.classList.add('hidden');
});

function renderAdminDashboard() {
    adminList.innerHTML = '';
    if (pendingProperties.length === 0) {
        adminList.innerHTML = '<p style="text-align: center; color: #64748b;">No pending listings.</p>';
        return;
    }

    pendingProperties.forEach(prop => {
        const item = document.createElement('div');
        item.style.padding = '15px';
        item.style.borderBottom = '1px solid #eee';
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';

        item.innerHTML = `
            <div>
                <div style="font-weight:600;">${prop.title}</div>
                <div style="font-size:0.8rem; color:#64748b;">${prop.price} - ${prop.location}</div>
                <div style="font-size:0.75rem; color:#94a3b8;">By: ${prop.owner.name}</div>
            </div>
            <div>
                <button class="approve-btn" data-id="${prop.id}" style="background:#22c55e; color:white; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;">Approve</button>
            </div>
        `;
        adminList.appendChild(item);
    });

    // Add Event Listeners to Approve Buttons
    document.querySelectorAll('.approve-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const propId = e.target.getAttribute('data-id');
            try {
                await db.collection("properties").doc(propId).update({ status: 'approved' });
                alert("Listing Approved!");
            } catch (err) {
                alert("Error: " + err.message);
            }
        });
    });
}

// Conversations
function subscribeToConversations() {
    if (!currentUser) return;

    db.collection("conversations")
        .orderBy("lastUpdated", "desc")
        .onSnapshot((snapshot) => {
            const allConvs = [];
            snapshot.forEach((doc) => {
                allConvs.push({ id: doc.id, ...doc.data() });
            });

            conversations = allConvs.filter(c =>
                c.participants && c.participants.includes(currentUser.uid)
            );

            if (!document.getElementById('inboxModal').classList.contains('hidden')) {
                renderInbox();
            }

            document.getElementById('msgCount').innerText = conversations.length;

            if (activeConversationId) {
                const activeConv = conversations.find(c => c.id === activeConversationId);
                if (activeConv) {
                    renderChatMessages(activeConv.messages);
                }
            }
        });
}

// --- RENDER FUNCTIONS ---
function renderMarkers() {
    mapMarkers.forEach(m => map.removeLayer(m));
    mapMarkers = [];

    properties.forEach(prop => {
        const marker = L.marker([prop.lat, prop.lng], { icon: customIcon }).addTo(map);
        marker.on('click', () => {
            showPropertyDetails(prop);
            map.flyTo([prop.lat, prop.lng], 13);
        });
        mapMarkers.push(marker);
    });
}

// Regional Value Indicators
function renderRegionalIndicators() {
    // Clear existing overlays
    regionalOverlays.forEach(overlay => map.removeLayer(overlay));
    regionalOverlays = [];

    if (properties.length === 0) return;

    // Group properties into regions (grid-based approach)
    const regionSize = 0.05; // degrees (approximately 5km)
    const regions = {};

    properties.forEach(prop => {
        const regionLat = Math.floor(prop.lat / regionSize) * regionSize;
        const regionLng = Math.floor(prop.lng / regionSize) * regionSize;
        const regionKey = `${regionLat},${regionLng}`;

        if (!regions[regionKey]) {
            regions[regionKey] = {
                lat: regionLat,
                lng: regionLng,
                properties: [],
                prices: []
            };
        }

        const price = parseFloat(prop.price.replace(/[^0-9.]/g, '')) || 0;
        regions[regionKey].properties.push(prop);
        regions[regionKey].prices.push(price);
    });

    // Create overlays for each region
    Object.values(regions).forEach(region => {
        if (region.properties.length < 2) return; // Skip regions with only 1 property

        const avgPrice = region.prices.reduce((a, b) => a + b, 0) / region.prices.length;

        // Calculate price trend (if properties have price history)
        let priceTrend = 0;
        const propsWithHistory = region.properties.filter(p => p.priceHistory && p.priceHistory.length > 1);
        if (propsWithHistory.length > 0) {
            const trends = propsWithHistory.map(p => {
                const history = p.priceHistory;
                const oldPrice = history[0];
                const newPrice = history[history.length - 1];
                return ((newPrice - oldPrice) / oldPrice) * 100;
            });
            priceTrend = trends.reduce((a, b) => a + b, 0) / trends.length;
        }

        // Color based on price level
        const maxPrice = Math.max(...region.prices);
        const minPrice = Math.min(...region.prices);
        const priceRange = maxPrice - minPrice;
        const normalizedPrice = priceRange > 0 ? (avgPrice - minPrice) / priceRange : 0.5;

        // Green (affordable) to Red (expensive)
        const color = normalizedPrice < 0.5
            ? `rgb(${Math.round(normalizedPrice * 510)}, 200, 100)`
            : `rgb(255, ${Math.round((1 - normalizedPrice) * 400)}, 100)`;

        // Create rectangle overlay
        const bounds = [
            [region.lat, region.lng],
            [region.lat + regionSize, region.lng + regionSize]
        ];

        const rectangle = L.rectangle(bounds, {
            color: color,
            weight: 2,
            fillColor: color,
            fillOpacity: 0.15,
            className: 'region-overlay'
        }).addTo(map);

        // Tooltip with regional stats
        const trendIcon = priceTrend > 0 ? '📈' : priceTrend < 0 ? '📉' : '➡️';
        const tooltipContent = `
            <div style="font-family: 'Outfit', sans-serif; padding: 5px;">
                <strong style="color: #1e293b;">Regional Stats</strong><br>
                <span style="color: #64748b; font-size: 0.85rem;">
                    Avg Price: <strong>$${(avgPrice / 1000).toFixed(0)}k</strong><br>
                    Properties: <strong>${region.properties.length}</strong><br>
                    Trend: <strong>${trendIcon} ${priceTrend.toFixed(1)}%</strong>
                </span>
            </div>
        `;

        rectangle.bindTooltip(tooltipContent, {
            permanent: false,
            direction: 'top',
            className: 'region-tooltip'
        });

        regionalOverlays.push(rectangle);
    });
}

function renderListings() {
    listingsContainer.innerHTML = '';
    properties.forEach(prop => {
        const item = document.createElement('div');
        item.className = 'listing-item';
        item.style.padding = '15px';
        item.style.borderBottom = '1px solid #eee';
        item.style.cursor = 'pointer';
        item.innerHTML = `
            <div style="font-weight:600; font-size: 1.1rem; color: #1e293b;">${prop.price}</div>
            <div style="font-size: 0.9rem; color: #64748b;">${prop.beds} bds | ${prop.baths} ba | ${prop.sqft} sqft</div>
            <div style="font-size: 0.85rem; color: #94a3b8;">${prop.location}</div>
        `;
        item.addEventListener('click', () => {
            showPropertyDetails(prop);
            map.flyTo([prop.lat, prop.lng], 13);
        });
        listingsContainer.appendChild(item);
    });
}

function showPropertyDetails(prop) {
    activeProperty = prop;
    document.getElementById('overlayImage').style.backgroundImage = `url('${prop.image}')`;
    document.getElementById('overlayTitle').innerText = prop.title;
    document.getElementById('overlayPrice').innerText = prop.price;
    document.getElementById('overlayLocation').innerText = prop.location;
    document.getElementById('overlayDescription').innerText = prop.description;

    // Update owner information dynamically
    if (prop.owner) {
        document.getElementById('ownerName').innerText = prop.owner.name || 'Property Owner';
        document.getElementById('ownerAvatar').src = prop.owner.img || 'https://i.pravatar.cc/150?img=3';
    }

    propertyOverlay.classList.remove('hidden');

    const isOwner = currentUser && prop.ownerId === currentUser.uid;
    document.getElementById('startChatBtn').classList.toggle('hidden', !!isOwner);
    const closeBtn = document.getElementById('closeListingBtn');
    if (closeBtn) closeBtn.classList.toggle('hidden', !isOwner);

    renderChart(prop);
}

// --- ADD PROPERTY (Firebase) ---
const addPropertyModal = document.getElementById('addPropertyModal');
const listPropertyForm = document.getElementById('addPropertyForm');
let isAdding = false;
let tempMarker = null;

listPropertyBtn.addEventListener('click', () => {
    isAdding = true;
    sidebar.classList.add('hidden');
    showToast("Click on the map to set property location.", "info");
    mapElement.style.cursor = 'crosshair';
});

map.on('click', (e) => {
    if (isAdding) {
        const { lat, lng } = e.latlng;
        if (tempMarker) map.removeLayer(tempMarker);
        tempMarker = L.marker([lat, lng], { icon: customIcon }).addTo(map);

        document.getElementById('propLat').value = lat;
        document.getElementById('propLng').value = lng;
        addPropertyModal.classList.remove('hidden');
        document.getElementById('toast').classList.add('hidden');
        mapElement.style.cursor = '';
        isAdding = false;
    }
});

listPropertyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const priceValue = parseFloat(document.getElementById('propPrice').value.replace(/[^0-9.]/g, '')) || 500000;
    const ownerName = currentUser.displayName || currentUser.email.split('@')[0] || "Owner";

    // Generate dynamic price history (5 years of data)
    const priceHistory = [];
    for (let i = 4; i >= 0; i--) {
        const yearAgo = priceValue * (1 - (i * 0.03)); // 3% growth per year
        priceHistory.push(Math.round(yearAgo));
    }

    const newProp = {
        title: document.getElementById('propTitle').value,
        price: document.getElementById('propPrice').value,
        location: "New Listing",
        beds: document.getElementById('propBeds').value,
        baths: document.getElementById('propBaths').value,
        sqft: document.getElementById('propSqft').value,
        description: document.getElementById('propDesc').value,
        image: document.getElementById('propImage').value || "https://images.unsplash.com/photo-1600596542815-2a429fe5364b?auto=format&fit=crop&w=800&q=80",
        images: ["https://images.unsplash.com/photo-1600596542815-2a429fe5364b?auto=format&fit=crop&w=800&q=80"],
        priceHistory: priceHistory,
        lat: parseFloat(document.getElementById('propLat').value),
        lng: parseFloat(document.getElementById('propLng').value),
        owner: { name: ownerName, img: "https://i.pravatar.cc/150?img=10", uid: currentUser.uid },
        ownerId: currentUser.uid,
        status: "pending",
        createdAt: new Date().toISOString()
    };

    try {
        await db.collection("properties").add(newProp);
        addPropertyModal.classList.add('hidden');
        listPropertyForm.reset();
        sidebar.classList.remove('hidden');
        if (tempMarker) map.removeLayer(tempMarker);

        showToast("Property Listed! Waiting for Approval.");
        // Open My Listings to show it's pending
        document.getElementById('myListingsBtn').click();

    } catch (err) {
        console.error("Error adding document: ", err);

        if (err.message.includes("Missing or insufficient permissions")) {
            // DEMO MODE (Forced Local Experience)
            showToast("Database Locked! Saving LOCALLY (Demo Mode)", "warning");

            // Simulate Success
            newProp.id = "demo_" + Date.now();

            // Add to admin list locally
            pendingProperties.push(newProp);
            renderAdminDashboard();

            // Add to My Listings locally
            myProperties.push(newProp);
            // Force open My Listings to show feedback
            const myListingsBtn = document.getElementById('myListingsBtn');
            if (myListingsBtn) myListingsBtn.click();
            renderMyListings();

            // Reset UI
            addPropertyModal.classList.add('hidden');
            listPropertyForm.reset();
            sidebar.classList.remove('hidden');
            if (tempMarker) map.removeLayer(tempMarker);

            alert("⚠️ I SAVED YOUR LISTING LOCALLY ⚠️\n\nYour database is locked, so I saved this to your browser memory.\n\nNow go to:\n1. 'My Listings' to see it (Pending)\n2. Switch to 'Admin' Role\n3. 'Admin Dashboard' to Approve it.");

        } else {
            showToast("Error: " + err.message, 'error');
        }
    }
});

// --- CHAT SYSTEM (Firebase) ---
const chatModal = document.getElementById('chatModal');
const chatBody = document.getElementById('chatBody');
const chatInput = document.getElementById('chatInput');

document.getElementById('startChatBtn').addEventListener('click', async () => {
    if (!currentUser) {
        alert("Please login to chat");
        return;
    }

    let existingConv = conversations.find(c =>
        c.propertyId === activeProperty.id && c.participants.includes(currentUser.uid)
    );

    if (existingConv) {
        openConversation(existingConv.id);
    } else {
        const newConv = {
            propertyId: activeProperty.id,
            propertyTitle: activeProperty.title,
            participants: [currentUser.uid, activeProperty.ownerId],
            ownerName: activeProperty.owner.name || 'Property Owner',
            buyerName: currentUser.displayName || currentUser.email || 'Buyer',
            messages: [],
            lastUpdated: new Date().toISOString()
        };

        try {
            const docRef = await db.collection("conversations").add(newConv);
            openConversation(docRef.id);
        } catch (err) {
            console.error(err);
        }
    }
});

function openConversation(convId) {
    activeConversationId = convId;
    chatModal.classList.remove('hidden');
    document.getElementById('inboxModal').classList.add('hidden');

    const conv = conversations.find(c => c.id === convId);
    if (conv) {
        // Update chat header with the other participant's name
        const otherParticipantName = currentUser.uid === conv.participants[0]
            ? (conv.ownerName || 'Owner')
            : (conv.buyerName || 'Buyer');

        document.getElementById('chatUserName').innerText = otherParticipantName;

        renderChatMessages(conv.messages);
    }
}

function renderChatMessages(messages) {
    chatBody.innerHTML = '';
    messages.forEach(msg => {
        const type = msg.senderId === currentUser.uid ? 'sent' : 'received';
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${type}`;
        msgDiv.innerHTML = `<p>${msg.text}</p>`;
        chatBody.appendChild(msgDiv);
    });
    chatBody.scrollTop = chatBody.scrollHeight;
}

document.getElementById('sendMessage').addEventListener('click', async () => {
    const text = chatInput.value.trim();
    if (!text || !activeConversationId) return;

    const newMessage = {
        text: text,
        senderId: currentUser.uid,
        timestamp: new Date().toISOString()
    };

    try {
        await db.collection("conversations").doc(activeConversationId).update({
            messages: firebase.firestore.FieldValue.arrayUnion(newMessage),
            lastUpdated: new Date().toISOString()
        });
        chatInput.value = '';
    } catch (err) {
        console.error("Msg Error", err);
    }
});

// --- HELPER -- 
// Chart (Same as before)
let priceChart = null;
function renderChart(prop) {
    const ctx = document.getElementById('priceChart').getContext('2d');
    if (priceChart) priceChart.destroy();

    // Generate price history if not available
    let dataPoints = prop.priceHistory;
    if (!dataPoints || dataPoints.length === 0) {
        const currentPrice = parseFloat(prop.price.replace(/[^0-9.]/g, '')) || 500000;
        dataPoints = [];
        for (let i = 4; i >= 0; i--) {
            dataPoints.push(Math.round(currentPrice * (1 - (i * 0.03))));
        }
    }

    // Calculate regional average (properties within 0.1 degree radius)
    const regionalProps = properties.filter(p => {
        const distance = Math.sqrt(
            Math.pow(p.lat - prop.lat, 2) + Math.pow(p.lng - prop.lng, 2)
        );
        return distance < 0.1 && p.id !== prop.id;
    });

    const regionalAvg = regionalProps.length > 0
        ? regionalProps.map(p => parseFloat(p.price.replace(/[^0-9.]/g, '')) || 0)
            .reduce((a, b) => a + b, 0) / regionalProps.length
        : null;

    const currentYear = new Date().getFullYear();
    const labels = dataPoints.map((_, i) => `${currentYear - dataPoints.length + i + 1}`);

    const datasets = [{
        label: 'Property Value ($)',
        data: dataPoints,
        borderColor: '#4f46e5',
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        fill: true,
        tension: 0.4
    }];

    // Add regional average line if available
    if (regionalAvg) {
        datasets.push({
            label: 'Regional Average ($)',
            data: Array(dataPoints.length).fill(regionalAvg),
            borderColor: '#22c55e',
            borderDash: [5, 5],
            fill: false,
            tension: 0
        });
    }

    priceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return context.dataset.label + ': $' + context.parsed.y.toLocaleString();
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        callback: function (value) {
                            return '$' + (value / 1000).toFixed(0) + 'k';
                        }
                    }
                }
            }
        }
    });
}

// Global UI Listeners
document.getElementById('closeOverlay').onclick = () => propertyOverlay.classList.add('hidden');
document.getElementById('closeChat').onclick = () => chatModal.classList.add('hidden');
document.getElementById('closeAddProperty').onclick = () => {
    addPropertyModal.classList.add('hidden');
    sidebar.classList.remove('hidden');
};
document.getElementById('inboxBtn').onclick = () => {
    renderInbox();
    document.getElementById('inboxModal').classList.remove('hidden');
    sidebar.classList.add('hidden');
};
document.getElementById('closeInbox').onclick = () => {
    document.getElementById('inboxModal').classList.add('hidden');
    sidebar.classList.remove('hidden');
};

function renderInbox() {
    const list = document.getElementById('inboxList');
    list.innerHTML = '';
    if (conversations.length === 0) list.innerHTML = '<div style="padding:20px;">No messages.</div>';

    conversations.forEach(c => {
        const item = document.createElement('div');
        item.style.padding = '15px';
        item.style.borderBottom = '1px solid #eee';
        item.innerHTML = `<b>${c.propertyTitle}</b><br><small>Participants: ${c.participants.length}</small>`;
        item.onclick = () => openConversation(c.id);
        list.appendChild(item);
    });
}

// Delete Property
document.getElementById('closeListingBtn').onclick = async () => {
    if (!currentUser || !activeProperty) return;
    if (confirm("Delete this listing?")) {
        try {
            await db.collection("properties").doc(activeProperty.id).delete();
            propertyOverlay.classList.add('hidden');
            alert("Deleted.");
        } catch (err) {
            alert(err.message);
        }
    }
};

// Gallery (Restored)
const galleryModal = document.getElementById('galleryModal');
const closeGalleryBtn = document.getElementById('closeGallery');
const galleryGrid = document.getElementById('galleryGrid');

document.getElementById('viewPhotosBtn').addEventListener('click', () => {
    galleryGrid.innerHTML = '';
    const images = activeProperty.images || [activeProperty.image];
    images.forEach(img => {
        const div = document.createElement('div');
        div.style.backgroundImage = `url('${img}')`;
        div.style.height = '200px';
        div.style.backgroundSize = 'cover';
        div.style.borderRadius = '12px';
        galleryGrid.appendChild(div);
    });
    galleryModal.classList.remove('hidden');
});
closeGalleryBtn.addEventListener('click', () => galleryModal.classList.add('hidden'));

