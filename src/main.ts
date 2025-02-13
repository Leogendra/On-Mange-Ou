import "./style.css";
import { Location } from "./utils/location";
import { Marker, WorldMap } from "./utils/map";
import { all, Restaurant } from "./utils/restaurants";

type RestaurantItem = {
	restaurant: Restaurant;
	marker: Marker;
	element: HTMLElement;
};
type RestaurantMap = Map<string, RestaurantItem>;

function createWorldMap(elementId: string): WorldMap {
	const map = new WorldMap(elementId);
	map.centerAt(Location.at(43.609935462710816, 3.885456818340369), 16);
	map.addMarker(
		Location.at(43.609935462710816, 3.885456818340369),
		"/person.png"
	);
	return map;
}

function createAllRestaurants(elementId: string, map: WorldMap): RestaurantMap {
	const restaurants = new Map<
		string,
		{ restaurant: Restaurant; marker: Marker; element: HTMLElement }
	>();
	const restaurantsList = document.querySelector(`#${elementId}`);

	for (const restaurant of all) {
		const marker = map.addMarker(
			restaurant.location,
			"/restaurant.png",
			restaurant.name
		);

		const element = createRestaurantElement(restaurant);

		const item = {
			restaurant,
			marker,
			element: element
		};

		element.addEventListener("click", (_) => {
			unselectAllRestaurant();
			selectRestaurant(item);
		});
		restaurantsList?.appendChild(element);

		restaurants.set(restaurant.name, item);
	}

	return restaurants;
}

function createRestaurantElement(restaurant: Restaurant): HTMLElement {
	const item = document.createElement("div");
	item.classList.add("restaurant");

	const title = document.createElement("h2");
	title.innerText = restaurant.name;

	const address = document.createElement("h3");
	address.innerText = restaurant.address;

	item.appendChild(title);
	item.appendChild(address);

	return item;
}

function selectRestaurant(restaurant: RestaurantItem) {
	restaurant.element.classList.add("selected");
	restaurant.marker.open();
}

function unselectAllRestaurant() {
	for (const restaurant of RESTAURANTS.values()) {
		restaurant.element.classList.remove("selected");
		restaurant.marker.close();
	}
}

const WORLD_MAP = createWorldMap("map");
const RESTAURANTS = createAllRestaurants("restaurants", WORLD_MAP);
