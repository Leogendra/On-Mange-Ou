import RandomChooserMap from "./scripts/random-chooser/RandomChooserMap";
import createRestaurantsFromConfig from "./scripts/utils/restaurants";
import { Location } from "./scripts/utils/location";

import RESTAURANT_ICON from "./assets/restaurant.png";
import PERSON_ICON from "./assets/person.png";
import "./styles/main.css";
import "./styles/controls.css";
import "./styles/dialogs.css";


async function init() {
    const configModules: Record<string, () => Promise<any>> = import.meta.glob("./data/config/*.json");

    const availableConfigs = Object.keys(configModules).map(p => {
        const parts = p.split("/");
        const file = parts[parts.length - 1];
        return file.replace(/\.json$/, "");
    });

    const urlParams = new URLSearchParams(window.location.search);
    const requestedConfig = urlParams.get("config") || window.localStorage.getItem("selectedConfig") || "default";

    // If a config is explicitly requested via URL, clear saved settings so the chosen default is applied
    if (urlParams.get("config")) {
        try {
            window.localStorage.removeItem("settings");
        } catch (e) {
            console.warn("Unable to clear saved settings:", e);
        }
    }

    let chosenName = requestedConfig;
    if (!availableConfigs.includes(chosenName)) {
        chosenName = availableConfigs.includes("default") ? "default" : availableConfigs[0];
    }

    let config: any | null = null;

    // Load default config first (fallback to the first available if "default" missing)
    const defaultKey = Object.keys(configModules).find(k => k.endsWith("/default.json")) || Object.keys(configModules)[0];
    let defaultConfig: any = {};
    if (defaultKey) {
        const defaultLoader = configModules[defaultKey];
        const defMod = await defaultLoader();
        defaultConfig = defMod.default ?? defMod;
    }

    const loader = configModules[`./data/config/${chosenName}.json`];
    if (loader) {
        const mod = await loader();
        const selectedConfig = mod.default ?? mod;
        config = { ...defaultConfig, ...selectedConfig };
        // if selected config doesn't provide defaultRestaurants, keep default's
        if (!("defaultRestaurants" in selectedConfig)) {
            config.defaultRestaurants = defaultConfig.defaultRestaurants;
        }
    } else {
        config = defaultConfig;
    }

    const RESTAURANTS = createRestaurantsFromConfig(config);

    const languageKeys = await import(`./data/lang/${config.language}.json`);

    new RandomChooserMap(RESTAURANTS, {
        view: {
            origin: Location.at(config.initialLat, config.initialLng),
            zoom: config.initialZoom,
            mapStyle: config.mapStyle
        },
        style: {
            originMarker: PERSON_ICON,
            randomMarker: RESTAURANT_ICON,
            markerSize: 64
        },
        text: languageKeys.default,
        availableConfigs: availableConfigs,
        selectedConfig: chosenName,
        language: config.language
    }).mountOn("map");
}

init();