import Leaflet from "leaflet";
import { Location } from "./location";

export class Marker {
	private marker: Leaflet.Marker;

	public constructor(
		map: Leaflet.Map,
		location: Location,
		icon: Leaflet.Icon | undefined = undefined,
		popup: string | undefined = undefined
	) {
		this.marker = Leaflet.marker(location.toTuple(), {
			icon
		}).addTo(map);

		if (popup !== undefined) {
			this.marker.bindPopup(popup);
		}
	}

	public open() {
		this.marker.openPopup();
	}

	public close() {
		this.marker.closePopup();
	}
}

export class WorldMap {
	private static readonly MARKER_SIZE = 64;

	private map: Leaflet.Map;

	public constructor(id: string) {
		this.map = Leaflet.map(id).setView([48.852969, 2.349903], 13);

		Leaflet.tileLayer(
			"https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png",
			{
				attribution:
					'données © <a href="//osm.org/copyright">OpenStreetMap</a>/ODbL - rendu <a href="//openstreetmap.fr">OSM France</a>',
				minZoom: 1,
				maxZoom: 20
			}
		).addTo(this.map);
	}

	addMarker(
		location: Location,
		image: string,
		message: string | undefined = undefined
	): Marker {
		return new Marker(
			this.map,
			location,
			Leaflet.icon({
				iconUrl: image,
				iconSize: [WorldMap.MARKER_SIZE, WorldMap.MARKER_SIZE],
				popupAnchor: [0, -WorldMap.MARKER_SIZE / 2]
			}),
			message
		);
	}

	centerAt(location: Location, zoom: number = 13) {
		this.map.setView(location.toTuple(), zoom);
	}
}

export default WorldMap;
