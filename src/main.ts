import "leaflet/dist/leaflet.css";
import "./style.css";
import leaflet from "leaflet";
import luck from "./luck";
import "./leafletWorkaround";

const MERRILL_CLASSROOM = leaflet.latLng({
    lat: 36.9995,
    lng: -122.0533
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

// Interface to manage coin IDs
interface Coin {
    id: number;
    cacheKey: string;
}

// Array to store player coins
let playerInventory: Coin[] = [];

// Create an object to store cache information including coin values
const cacheData: Record<string, { coins: Coin[] }> = {};

// Create a map to keep track of known tiles
const knownTiles: Set<string> = new Set();

// Change makePit into makeCache
function makeCache(i: number, j: number) {
    const globalI = Math.round((MERRILL_CLASSROOM.lat + i * TILE_DEGREES) * 1e4);
    const globalJ = Math.round((MERRILL_CLASSROOM.lng + j * TILE_DEGREES) * 1e4);
    const cacheKey = `${globalI}:${globalJ}`;
    // Check if the tile already exists
    if (!knownTiles.has(cacheKey)) {
        knownTiles.add(cacheKey);
        if (cacheData[cacheKey] === undefined) {
            // Initialize cache data with 3 coins if not already set
            cacheData[cacheKey] = { coins: [] };
            for (let k = 1; k <= 3; k++) {
                cacheData[cacheKey].coins.push({ id: k, cacheKey: cacheKey });
            }
        }
        // calculate leaflet bounds based on merrill classroom
        const bounds = leaflet.latLngBounds([
            [MERRILL_CLASSROOM.lat + i * TILE_DEGREES, MERRILL_CLASSROOM.lng + j * TILE_DEGREES],
            [MERRILL_CLASSROOM.lat + (i + 1) * TILE_DEGREES, MERRILL_CLASSROOM.lng + (j + 1) * TILE_DEGREES],
        ]);
        const cache: leaflet.Layer = leaflet.rectangle(bounds);
        // Creates popup to handle coin logic
        cache.bindPopup(() => {
            const coinList = cacheData[cacheKey].coins.map((coin) => `<li>${coin.cacheKey}#${coin.id} <button class="collect">Collect</button></li>`).join('');
            const container: HTMLDivElement = document.createElement("div");
            container.innerHTML = `
                <div>This is a cache at "${globalI}:${globalJ}".</div>
                <div>Inventory:</div>
                <ul>${coinList}</ul>
                <div>Your Inventory: ${playerInventory.length.toString()} coins.</div>
                <button id="deposit">Deposit Most Recent Coin</button>
            `;
            const collectButtons = container.querySelectorAll(".collect");
            collectButtons.forEach((button, index) => {
                const coinId = index + 1;
                button.setAttribute("data-id", coinId.toString());
                button.addEventListener("click", () => collectCoin(cacheKey, coinId));
            });
            const depositButton: HTMLButtonElement = container.querySelector("#deposit")!;
            depositButton.addEventListener("click", () => depositMostRecentCoin(cacheKey));
            return container;
        });
        cache.addTo(map);
    }
}

// Function used to take a coin from a cache and enter it into player inventory
function collectCoin(cacheKey: string, coinId: number) {
    console.log('Attempting to collect coin with ID:', coinId);
    console.log('Current coins:', cacheData[cacheKey].coins);
    if (playerInventory.length < 3) {
        const coinIndex = cacheData[cacheKey].coins.findIndex((coin) => coin.id === coinId);
        console.log('Coin index found:', coinIndex);
        if (coinIndex !== -1) {
            const collectedCoin: Coin = cacheData[cacheKey].coins.splice(coinIndex, 1)[0];
            console.log('Collected coin:', collectedCoin);
            playerInventory.push(collectedCoin);
            console.log('Updated player inventory:', playerInventory);
            updatePopupContent(cacheKey);
        }
    }
}

// Function used to deposit your most recent coin into a cache
function depositMostRecentCoin(cacheKey: string) {
    if (playerInventory.length > 0) {
        const mostRecentCoin = playerInventory.pop();
        if (mostRecentCoin) {
            cacheData[cacheKey].coins.push(mostRecentCoin);
            updatePopupContent(cacheKey);
        }
    }
}

// Function used to handle changing of popup content after collecting or depositing coins.
function updatePopupContent(cacheKey: string) {
    map.eachLayer((layer: leaflet.Layer) => {
        if (layer instanceof leaflet.Rectangle && layer.getBounds().toBBoxString() === cacheKey) {
            const inventoryCount = playerInventory.length;
            const newContainer: HTMLDivElement = document.createElement("div");
            newContainer.innerHTML = `
                <div>This is a cache at "${cacheKey}".</div>
                <div>Inventory: ${generateCoinList(cacheKey)}</div>
                <div>Your Inventory: ${inventoryCount} coins.</div>
                <button id="deposit">Deposit Most Recent Coin</button>
            `;
        }
    });
}

// Creates a button for collecting each coin
function generateCoinList(cacheKey: string): string {
    return cacheData[cacheKey].coins.map((coin) => `<li>${coin.cacheKey}#${coin.id} <button class="collect">Collect</button></li>`).join('');
}

for (let i = -NEIGHBORHOOD_SIZE; i < NEIGHBORHOOD_SIZE; i++) {
    for (let j = - NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
        if (luck([i, j].toString()) < PIT_SPAWN_PROBABILITY) {
            makeCache(i, j);
        }
    }
}