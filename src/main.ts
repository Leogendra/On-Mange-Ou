import "./style.css";
import PERSON_ICON from "./assets/person.png";
import RESTAURANT_ICON from "./assets/restaurant.png";

import { Location } from "./utils/location";
import RESTAURANTS from "./utils/restaurants";
import RandomChooserMap from "./RandomChooserMap";

import config from "./data/config.json";


async function init() {
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
        text: languageKeys.default
    }).mountOn("map");
}

init();