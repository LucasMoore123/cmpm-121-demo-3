import "leaflet/dist/leaflet.css";
import "./style.css";
import leaflet from "leaflet";
import luck from "./luck";
import "./leafletWorkaround";

const MERRILL_CLASSROOM = leaflet.latLng({
    lat: 36.9995,
    lng: - 122.0533
});

const GAMEPLAY_ZOOM_LEVEL = 19;
const TILE_DEGREES = 1e-4;
const NEIGHBORHOOD_SIZE = 8;
const PIT_SPAWN_PROBABILITY = 0.1;

const mapContainer = document.querySelector<HTMLElement>("#map")!;

const map = leaflet.map(mapContainer, {
    center: MERRILL_CLASSROOM,
    zoom: GAMEPLAY_ZOOM_LEVEL,
    minZoom: GAMEPLAY_ZOOM_LEVEL,
    maxZoom: GAMEPLAY_ZOOM_LEVEL,
    zoomControl: false,
    scrollWheelZoom: false
});

leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; <a href=\"http://www.openstreetmap.org/copyright\">OpenStreetMap</a>"
}).addTo(map);

const playerMarker = leaflet.marker(MERRILL_CLASSROOM);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

const sensorButton = document.querySelector("#sensor")!;
sensorButton.addEventListener("click", () => {
    navigator.geolocation.watchPosition((position) => {
        playerMarker.setLatLng(leaflet.latLng(position.coords.latitude, position.coords.longitude));
        map.setView(playerMarker.getLatLng());
    });
});

// Initialize the player's inventory with 3 coins
let playerInventory: number = 3;

// Create an object to store cache information including coin values
const cacheData: Record<string, { coins: number }> = {};

// Change makePit into makeCache, which will hold our coins
function makeCache(i: number, j: number) {
    const cacheKey = `${i},${j}`;

    if (cacheData[cacheKey] === undefined) {
        // Initialize cache data with 3 coins if not already set
        cacheData[cacheKey] = { coins: 3 };
    }

    // calculate leaflet bounds based on merrill classroom
    const bounds = leaflet.latLngBounds([
        [MERRILL_CLASSROOM.lat + i * TILE_DEGREES,
        MERRILL_CLASSROOM.lng + j * TILE_DEGREES],
        [MERRILL_CLASSROOM.lat + (i + 1) * TILE_DEGREES,
        MERRILL_CLASSROOM.lng + (j + 1) * TILE_DEGREES],
    ]);
    const cache: leaflet.Layer = leaflet.rectangle(bounds);
    cache.bindPopup(() => {
        const coins: number = cacheData[cacheKey].coins;
        const container: HTMLDivElement = document.createElement("div");
        container.innerHTML = `
            <div>This is a cache at "${i},${j}".</div>
            <div>It contains ${coins} coins.</div>
            <div>Your Inventory: ${playerInventory} coins.</div>
            <button id="collect">Collect Coins</button>
            <button id="deposit">Deposit Coins</button>
        `;
        const collectButton: HTMLButtonElement = container.querySelector("#collect")!;
        collectButton.addEventListener("click", () => {
            if (playerInventory < 3 && coins > 0) {
                playerInventory += 1; // Collect one coin
                cacheData[cacheKey].coins -= 1; // Remove one coin from the cache
                container.querySelectorAll("div")[1].textContent = `It contains ${cacheData[cacheKey].coins} coins.`; // ChatGPT Prompt: How can I edit specific parts of a container's innerHTML using typescript?
                container.querySelectorAll("div")[2].textContent = `Your Inventory: ${playerInventory} coins.`;
            }
        });
        const depositButton: HTMLButtonElement = container.querySelector("#deposit")!;
        depositButton.addEventListener("click", () => {
            if (playerInventory > 0) {
                playerInventory -= 1; // Deposit one coin
                cacheData[cacheKey].coins += 1; // Add one coin to the cache
                container.querySelectorAll("div")[1].textContent = `It contains ${cacheData[cacheKey].coins} coins.`;
                container.querySelectorAll("div")[2].textContent = `Your Inventory: ${playerInventory} coins.`;
            }
        });
        return container;
    });
    cache.addTo(map);
}

for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
    for (let j = - NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
        if (luck([i, j].toString()) < PIT_SPAWN_PROBABILITY) {
            makeCache(i, j);
        }
    }
}