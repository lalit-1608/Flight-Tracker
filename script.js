 // Firebase SDKs 
    
        import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, setDoc, onSnapshot, collection, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        document.addEventListener('DOMContentLoaded', () => {
            // State Management
            let currentView = "search";
            let currentSearchType = "flight";
            let currentFetchedFlights = [];
            let favorites = [];
            let db;
            let auth;
            let userId;
            const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
            const firebaseConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');

            // DOM Elements
            const tabSearch = document.getElementById("tabSearch");
            const tabFavorites = document.getElementById("tabFavorites");
            const searchPanel = document.getElementById("search-panel");
            const favoritesCountEl = document.getElementById("favorites-count");
            const userInfoEl = document.getElementById("user-info");
            const clearFavoritesBtn = document.getElementById("clear-favorites-btn");
            const favoritesManagementSection = document.getElementById("favorites-management");

            const tabFlightNumber = document.getElementById("tabFlightNumber");
            const tabRoute = document.getElementById('tabRoute');
            const flightNumberSearch = document.getElementById('flightNumberSearch');
            const routeSearch = document.getElementById('routeSearch');

            const flightIataInput = document.getElementById("flight_iata");
            const depIataInput = document.getElementById("dep_iata");
            const arrIataInput = document.getElementById("arr_iata");
            const searchFlightBtn = document.getElementById('searchFlightBtn');
            const searchRouteBtn = document.getElementById('searchRouteBtn');

            const resultsContainer = document.getElementById('results-container');
            const loader = document.getElementById('loader');
            const messageEl = document.getElementById('message');
            const filterSection = document.getElementById('filter-section');
            const statusFilter = document.getElementById('status-filter');
            
            // Modal Elements
            const messageModal = document.getElementById('message-modal');
            const modalText = document.getElementById('modal-text');
            const closeModalBtn = document.getElementById('close-modal-btn');
            
            // Helper functions
            function showMessage(message, type = 'error') {
                messageEl.textContent = message;
                messageEl.classList.remove('hidden', 'bg-red-100', 'border-red-400', 'text-red-700', 'bg-green-100', 'border-green-400', 'text-green-700');
                if (type === 'error') {
                    messageEl.classList.add('bg-red-100', 'border-red-400', 'text-red-700');
                } else if (type === 'success') {
                    messageEl.classList.add('bg-green-100', 'border-green-400', 'text-green-700');
                }
                messageEl.classList.remove('hidden');
            }

            function showLoader(visible) {
                if (visible) {
                    loader.classList.remove('hidden');
                    resultsContainer.classList.add('hidden');
                    messageEl.classList.add('hidden');
                    filterSection.classList.add('hidden');
                } else {
                    loader.classList.add('hidden');
                    resultsContainer.classList.remove('hidden');
                    if (currentFetchedFlights.length > 0) {
                        filterSection.classList.remove('hidden');
                    }
                }
            }
            
            function showModal(message) {
                modalText.textContent = message;
                messageModal.style.display = 'flex';
            }

            closeModalBtn.onclick = () => {
                messageModal.style.display = 'none';
            };

            window.onclick = (event) => {
                if (event.target == messageModal) {
                    messageModal.style.display = 'none';
                }
            };
            
            // Firestore Functions
            function getFavoritesDocRef() {
                if (!db || !userId) return null;
                return doc(db, 'artifacts', appId, 'users', userId, 'favorites', 'my-flights');
            }

            async function toggleFavorite(flight) {
                const favoritesDocRef = getFavoritesDocRef();
                if (!favoritesDocRef) {
                    showModal("Authentication failed. Please refresh the page.");
                    return;
                }
                try {
                    const favoriteIndex = favorites.findIndex(f => f.flight.iata === flight.flight.iata);
                    let updatedFavorites;
                    if (favoriteIndex > -1) {
                        updatedFavorites = [...favorites];
                        updatedFavorites.splice(favoriteIndex, 1);
                        showMessage(`Removed flight ${flight.flight.iata} from favorites.`, 'success');
                    } else {
                        updatedFavorites = [...favorites, flight];
                        showMessage(`Added flight ${flight.flight.iata} to favorites.`, 'success');
                    }
                    await setDoc(favoritesDocRef, { list: updatedFavorites });
                } catch (e) {
                    console.error("Error toggling favorite:", e);
                    showModal("An error occurred. Could not update favorites.");
                }
            }
            
            async function clearFavorites() {
                const favoritesDocRef = getFavoritesDocRef();
                if (!favoritesDocRef) {
                    showModal("Authentication failed. Please refresh the page.");
                    return;
                }
                try {
                    await deleteDoc(favoritesDocRef);
                    showMessage("All favorites cleared successfully.", 'success');
                } catch (e) {
                    console.error("Error clearing favorites:", e);
                    showModal("An error occurred. Could not clear favorites.");
                }
            }

            function isFavorite(flight) {
                return favorites.some(f => f.flight.iata === flight.flight.iata);
            }

            function updateFavoritesCount() {
                favoritesCountEl.textContent = favorites.length;
            }

            // Rendering functions
            function renderFlights(flights) {
                resultsContainer.innerHTML = '';
                if (!flights || flights.length === 0) {
                    resultsContainer.innerHTML = '<p class="text-center text-gray-500 text-lg col-span-full">No flights found.</p>';
                    filterSection.classList.add('hidden');
                    return;
                }
                
                const filteredFlights = statusFilter.value === 'all' 
                    ? flights 
                    : flights.filter(f => f.flight_status === statusFilter.value);

                if (filteredFlights.length === 0) {
                     resultsContainer.innerHTML = '<p class="text-center text-gray-500 text-lg col-span-full">No flights match the current filter.</p>';
                }

                filteredFlights.forEach(flight => {
                    const isFav = isFavorite(flight);
                    const flightCard = document.createElement('div');
                    flightCard.className = 'bg-white p-6 rounded-xl shadow-md border border-gray-200 hover:shadow-lg transition-all duration-300';
                    flightCard.innerHTML = `
                        <div class="flex justify-between items-start mb-4">
                            <h3 class="text-xl font-bold text-blue-700">${flight.flight.iata}</h3>
                            <button class="favorite-btn" data-flight-iata="${flight.flight.iata}">
                                <svg class="w-6 h-6 ${isFav ? 'text-red-500' : 'text-gray-400'}" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                    <path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd"></path>
                                </svg>
                            </button>
                        </div>
                        <p class="text-gray-600 mb-2">
                            <span class="font-semibold">Status:</span> 
                            <span class="capitalize px-2 py-1 rounded-full text-xs font-bold ${
                                flight.flight_status === 'active' ? 'bg-green-200 text-green-800' : 
                                flight.flight_status === 'scheduled' ? 'bg-yellow-200 text-yellow-800' :
                                flight.flight_status === 'landed' ? 'bg-blue-200 text-blue-800' : 
                                'bg-red-200 text-red-800'
                            }">
                                ${flight.flight_status}
                            </span>
                        </p>
                        <div class="text-gray-600 space-y-2">
                            <p><span class="font-semibold">Route:</span> ${flight.departure.iata} → ${flight.arrival.iata}</p>
                            <p><span class="font-semibold">Airline:</span> ${flight.airline.name}</p>
                            <p><span class="font-semibold">Departure:</span> ${flight.departure.airport} (${flight.departure.timezone})</p>
                            <p><span class="font-semibold">Arrival:</span> ${flight.arrival.airport} (${flight.arrival.timezone})</p>
                        </div>
                    `;
                    resultsContainer.appendChild(flightCard);
                });
                
                document.querySelectorAll('.favorite-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const iata = e.currentTarget.dataset.flightIata;
                        const flight = currentFetchedFlights.find(f => f.flight.iata === iata);
                        if (flight) {
                            toggleFavorite(flight);
                        }
                    });
                });
            }

            function renderFavorites() {
                resultsContainer.innerHTML = '';
                showLoader(true);
                if (favorites.length === 0) {
                    resultsContainer.innerHTML = '<p class="text-center text-gray-500 text-lg col-span-full">You have no favorite flights yet.</p>';
                    filterSection.classList.add('hidden');
                } else {
                    renderFlights(favorites);
                }
                showLoader(false);
            }

            // Simulated API calls with mock data
            async function fetchFlightByNumber(iata) {
                showLoader(true);
                showMessage('');
                
                // Mock data
                const mockData = {
                    "pagination": { "limit": 100, "offset": 0, "count": 1, "total": 1 },
                    "data": [
                        {
                            "flight_date": "2023-10-27", "flight_status": "active",
                            "departure": { "airport": "Indira Gandhi International", "timezone": "Asia/Kolkata", "iata": "DEL" },
                            "arrival": { "airport": "Chhatrapati Shivaji International", "timezone": "Asia/Kolkata", "iata": "BOM" },
                            "airline": { "name": "IndiGo", "iata": "6E" },
                            "flight": { "number": "6367", "iata": iata, "icao": "IGO367" }
                        }
                    ]
                };

                // Simulate network delay
                return new Promise(resolve => {
                    setTimeout(() => {
                        showLoader(false);
                        resolve(mockData.data);
                    }, 1500);
                });
            }

            async function fetchFlightByRoute(dep, arr) {
                showLoader(true);
                showMessage('');

                // Mock data
                const mockData = {
                    "pagination": { "limit": 100, "offset": 0, "count": 2, "total": 2 },
                    "data": [
                        {
                            "flight_date": "2023-10-27", "flight_status": "landed",
                            "departure": { "airport": "Indira Gandhi International", "timezone": "Asia/Kolkata", "iata": dep },
                            "arrival": { "airport": "Chhatrapati Shivaji International", "timezone": "Asia/Kolkata", "iata": arr },
                            "airline": { "name": "Air India", "iata": "AI" },
                            "flight": { "number": "101", "iata": "AI101", "icao": "AIC101" }
                        },
                        {
                            "flight_date": "2023-10-27", "flight_status": "scheduled",
                            "departure": { "airport": "Indira Gandhi International", "timezone": "Asia/Kolkata", "iata": dep },
                            "arrival": { "airport": "Chhatrapati Shivaji International", "timezone": "Asia/Kolkata", "iata": arr },
                            "airline": { "name": "Vistara", "iata": "UK" },
                            "flight": { "number": "905", "iata": "UK905", "icao": "VTS905" }
                        }
                    ]
                };

                // Simulate network delay
                return new Promise(resolve => {
                    setTimeout(() => {
                        showLoader(false);
                        resolve(mockData.data);
                    }, 1500);
                });
            }


            // Event Listeners
            tabSearch.addEventListener("click", () => switchMainView("search"));
            tabFavorites.addEventListener("click", () => switchMainView("favorites"));
            clearFavoritesBtn.addEventListener("click", clearFavorites);

            tabFlightNumber.addEventListener("click", () => switchSearchTab("flight"));
            tabRoute.addEventListener("click", () => switchSearchTab("route"));

            searchFlightBtn.addEventListener("click", async () => {
                const flightIata = flightIataInput.value.trim().toUpperCase();
                if (!flightIata) {
                    showModal('Please enter a flight number.');
                    return;
                }
                currentFetchedFlights = await fetchFlightByNumber(flightIata);
                renderFlights(currentFetchedFlights);
            });

            searchRouteBtn.addEventListener("click", async () => {
                const depIata = depIataInput.value.trim().toUpperCase();
                const arrIata = arrIataInput.value.trim().toUpperCase();
                if (!depIata || !arrIata) {
                    showModal('Please enter both departure and arrival IATA codes.');
                    return;
                }
                currentFetchedFlights = await fetchFlightByRoute(depIata, arrIata);
                renderFlights(currentFetchedFlights);
            });
            
            statusFilter.addEventListener("change", () => {
                renderFlights(currentFetchedFlights);
            });

            function switchMainView(view) {
                currentView = view;
                tabSearch.classList.remove("active");
                tabFavorites.classList.remove("active");
                searchPanel.classList.add("hidden");
                resultsContainer.innerHTML = '';
                filterSection.classList.add('hidden');
                favoritesManagementSection.classList.add('hidden');

                if (view === "search") {
                    tabSearch.classList.add("active");
                    searchPanel.classList.remove("hidden");
                    renderFlights(currentFetchedFlights);
                } else {
                    tabFavorites.classList.add("active");
                    favoritesManagementSection.classList.remove('hidden');
                    renderFavorites();
                }
            }

            function switchSearchTab(tab) {
                currentSearchType = tab;
                tabFlightNumber.classList.remove("active");
                tabRoute.classList.remove("active");
                flightNumberSearch.classList.add("hidden");
                routeSearch.classList.add("hidden");

                if (tab === "flight") {
                    tabFlightNumber.classList.add("active");
                    flightNumberSearch.classList.remove("hidden");
                } else {
                    tabRoute.classList.add("active");
                    routeSearch.classList.remove("hidden");
                }
            }
            
            // Initial Firebase setup and data loading
            try {
                const app = initializeApp(firebaseConfig);
                db = getFirestore(app);
                auth = getAuth(app);

                onAuthStateChanged(auth, async (user) => {
                    if (user) {
                        userId = user.uid;
                        userInfoEl.textContent = `User ID: ${userId}`;
                        const favoritesDocRef = getFavoritesDocRef();
                        onSnapshot(favoritesDocRef, (docSnap) => {
                            if (docSnap.exists() && docSnap.data().list) {
                                favorites = docSnap.data().list;
                            } else {
                                favorites = [];
                            }
                            updateFavoritesCount();
                            if (currentView === 'favorites') {
                                renderFavorites();
                            }
                        });
                    } else {
                        try {
                            const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : '';
                            if (initialAuthToken) {
                                await signInWithCustomToken(auth, initialAuthToken);
                            } else {
                                await signInAnonymously(auth);
                            }
                        } catch (e) {
                             console.error("Error signing in:", e);
                             showModal("Failed to sign in. Please try again later.");
                        }
                    }
                });
            } catch (e) {
                console.error("Firebase initialization failed:", e);
                showModal("Failed to initialize Firebase. Favorites will not be saved.");
            }
        });