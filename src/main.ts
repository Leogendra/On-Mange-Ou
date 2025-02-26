import "./style.css";
import PERSON_ICON from "./assets/person.png";
import RESTAURANT_ICON from "./assets/restaurant.png";

import { Location } from "./utils/location";
import RESTAURANTS from "./utils/restaurants";
import RandomChooserMap from "./RandomChooserMap";

new RandomChooserMap(RESTAURANTS, {
	view: {
		origin: Location.at(43.609935462710816, 3.885456818340369),
		zoom: 16
	},
	style: {
		originMarker: PERSON_ICON,
		randomMarker: RESTAURANT_ICON,
		markerSize: 64
	},
	text: {
		rollAction: "On mange où ?"
	}
}).mountOn("map");
