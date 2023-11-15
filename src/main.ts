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

// ChatGPT prompt: What is the best way to add a key property to a leaflet in typescript?
class CustomRectangle extends leaflet.Rectangle {
    cacheKey: string;
    constructor(bounds: leaflet.LatLngBoundsExpression, options?: leaflet.PathOptions) {
        super(bounds, options);
        this.cacheKey = '';
    }
}

// Handle Player Movement
let xOffset = 0;
let yOffset = 0;
const northButton = document.querySelector("#north")!;
const southButton = document.querySelector("#south")!;
const eastButton = document.querySelector("#east")!;
const westButton = document.querySelector("#west")!;
northButton.addEventListener("click", () => {
    movePlayer("north");
});
southButton.addEventListener("click", () => {
    movePlayer("south");
});
eastButton.addEventListener("click", () => {
    movePlayer("east");
});
westButton.addEventListener("click", () => {
    movePlayer("west");
});

function movePlayer(direction: string) {
    const movementStep = 0.0001; // Cell-granularity for movement
    let newLat = playerMarker.getLatLng().lat;
    let newLng = playerMarker.getLatLng().lng;
    // Update player's location based on the direction clicked
    switch (direction) {
        case "north":
            newLat += movementStep;
            xOffset += 1;
            break;
        case "south":
            newLat -= movementStep;
            xOffset -= 1;
            break;
        case "east":
            newLng += movementStep;
            yOffset += 1;
            break;
        case "west":
            newLng -= movementStep;
            yOffset -= 1;
            break;
        default:
            break;
    }
    const newPlayerPosition = leaflet.latLng(newLat, newLng);
    playerMarker.setLatLng(newPlayerPosition);
    map.setView(playerMarker.getLatLng());
    generateCachesAroundPlayer();
}

interface HiddenCache {
    layer: leaflet.Layer;
    cacheKey: string;
}

const hiddenCaches: HiddenCache[] = [];

function hideAllCaches() {
    map.eachLayer((layer: leaflet.Layer) => {
        if (layer instanceof leaflet.Rectangle) {
            const cacheKey = (layer as any).cacheKey;
            hiddenCaches.push({ layer, cacheKey });
            map.removeLayer(layer);
        }
    });
    console.log("Hidden caches: ", hiddenCaches.map(cache => cache.cacheKey));
}

function unhideCache(cacheKey: string) {
    const index = hiddenCaches.findIndex(cache => cache.cacheKey === cacheKey);
    if (index !== -1) {
        const { layer } = hiddenCaches.splice(index, 1)[0];
        map.addLayer(layer);
        console.log(`Cache with cacheKey '${cacheKey}' has been unhidden.`);
    } else {
        console.log(`Cache with cacheKey '${cacheKey}' not found in hiddenCaches.`);
    }
}

function generateCachesAroundPlayer() {
    // Remove all caches from area
    hideAllCaches();
    const range = 8;
    // Calculate the range boundaries based on player's position on the map
    const startX = -range + xOffset;
    const endX = range + xOffset;
    const startY = -range + yOffset;
    const endY = range + yOffset;
    for (let i = startX; i < endX; i++) {
        for (let j = startY; j < endY; j++) {
            if (luck([i, j].toString()) < PIT_SPAWN_PROBABILITY) {
                makeCache(i, j); // Added functionality to makeCache that unhides hidden caches if they already exist
            }
        }
    }
}

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
        const cache = new CustomRectangle(bounds);
        cache.cacheKey = cacheKey;
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
    } else {
        unhideCache(cacheKey);
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
    for (let j = -NEIGHBORHOOD_SIZE; j < NEIGHBORHOOD_SIZE; j++) {
        if (luck([i, j].toString()) < PIT_SPAWN_PROBABILITY) {
            makeCache(i, j);
        }
    }
}