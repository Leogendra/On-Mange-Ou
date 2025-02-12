import "./style.css";
import { Location } from "./utils";
import Map from "./map";
import RESTAURANTS from "./restaurants";

const map = new Map("map");
map.centerAt(Location.at(43.609935462710816, 3.885456818340369), 16);
map.addMarker(
    Location.at(43.609935462710816, 3.885456818340369),
    "/person.png"
);

const restaurants = document.querySelector("#restaurants");
for (const restaurant of RESTAURANTS) {
    map.addMarker(restaurant.location, "/restaurant.png", restaurant.name);

    const item = document.createElement("div");
    item.classList.add("restaurant");

    const title = document.createElement("h2");
    title.innerText = restaurant.name;

    const address = document.createElement("h3");
    address.innerText = restaurant.address;

    item.appendChild(title);
    item.appendChild(address);

    restaurants?.appendChild(item);
}
