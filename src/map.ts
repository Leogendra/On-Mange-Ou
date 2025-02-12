import L from "leaflet";
import { Location } from "./utils";

export default class Map {
    private static readonly MARKER_SIZE = 64;

    private map: L.Map;

    constructor(id: string) {
        this.map = L.map(id).setView([48.852969, 2.349903], 13);

        L.tileLayer("https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png", {
            attribution:
                'données © <a href="//osm.org/copyright">OpenStreetMap</a>/ODbL - rendu <a href="//openstreetmap.fr">OSM France</a>',
            minZoom: 1,
            maxZoom: 20,
        }).addTo(this.map);
    }

    addMarker(
        location: Location,
        image: string,
        message: string | undefined = undefined
    ): void {
        const marker = L.marker(location.toTuple(), {
            icon: L.icon({
                iconUrl: image,
                iconSize: [Map.MARKER_SIZE, Map.MARKER_SIZE],
                popupAnchor: [0, -Map.MARKER_SIZE / 2],
            }),
        }).addTo(this.map);

        if (message !== undefined) {
            marker.bindPopup(message);
        }
    }

    centerAt(location: Location, zoom: number = 13) {
        this.map.setView(location.toTuple(), zoom);
    }
}
