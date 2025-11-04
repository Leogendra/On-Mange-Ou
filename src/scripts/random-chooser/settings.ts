import { AppSettings, RandomChoices } from "./types";
import { STORAGE_KEY_SETTINGS } from "./constants";




export function loadSettings(): AppSettings {
    try {
        const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (error) {
        console.warn(`Error loading settings from localStorage: ${error}`);
        localStorage.removeItem(STORAGE_KEY_SETTINGS);
    }
    return {
        restaurants: [],
        version: "1.0"
    };
}

export function saveSettings(settings: AppSettings) {
    try {
        localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    } catch (error) {
        console.error(`Error saving settings to localStorage: ${error}`);
    }
}

export function updateSettings(updates: Partial<AppSettings>) {
    const currentSettings = loadSettings();
    const newSettings = { ...currentSettings, ...updates };
    saveSettings(newSettings);
}

export function areWeightsEnabled(): boolean {
    const settings = loadSettings();
    return settings.weightsEnabled !== false;
}

export function toggleWeights() {
    const currentState = areWeightsEnabled();
    updateSettings({ weightsEnabled: !currentState });
}

export function saveRestaurantsToStorageInternal(choices: RandomChoices) {
    const settings = loadSettings();
    const restaurantsData = choices.map(choice => {
        const existingRestaurant = settings.restaurants.find(r => r.name === choice.name);
        return {
            name: choice.name,
            address: choice.address || "",
            location: {
                lat: choice.location.lat,
                long: choice.location.long
            },
            weight: existingRestaurant?.weight || 1
        };
    });
    updateSettings({ restaurants: restaurantsData });
}
