import Leaflet from "leaflet";
import { Location } from "./location";

export interface RandomChoice {
	name: string;
	description: string;
	location: Location;
}

type RandomChoices = Array<RandomChoice>;

type RandomChooserMapOptions = {
	view?: {
		origin?: Location;
		zoom?: number;
	};
	style?: {
		markerSize?: number;
		originMarker?: string;
		randomMarker?: string;
	};
	text?: {
		chooseRandom?: string;
	};
};

class RandomChooserMap {
	private choices: RandomChoices;
	private options: RandomChooserMapOptions;
	private map: Leaflet.Map | null = null;

	public constructor(
		choices: RandomChoices,
		options?: RandomChooserMapOptions
	) {
		this.choices = choices;
		this.options = options ?? {};
	}

	public mountOn(root: HTMLElement | string) {
		this.map = Leaflet.map(root);
		this.initOrigin();
		this.addTileSet();
		this.addRandomChoiceMarkers();
		this.addRollControl();
	}

	initOrigin() {
		if (this.options.view !== undefined) {
			const origin = this.options.view.origin ?? Location.at(0, 0);

			this.map!.setView(origin.toTuple(), this.options.view.zoom);

			if (this.options.style?.originMarker !== undefined) {
				this.addMarker(origin, this.options.style.originMarker);
			}
		}
	}

	addTileSet() {
		Leaflet.tileLayer(
			"https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png",
			{
				attribution:
					'données © <a href="//osm.org/copyright">OpenStreetMap</a>/ODbL - rendu <a href="//openstreetmap.fr">OSM France</a>',
				minZoom: 1,
				maxZoom: 20
			}
		).addTo(this.map!);
	}

	addRandomChoiceMarkers() {
		if (this.options.style?.randomMarker !== undefined) {
			for (const choice of this.choices) {
				this.addMarker(
					choice.location,
					this.options.style.randomMarker,
					choice.name
				);
			}
		}
	}

	addRollControl() {
		const button = document.createElement("button");

		button.id = "random-chooser-map-control-roll";
		button.classList.add("random-chooser-map-control");

		button.innerText = this.options.text?.chooseRandom ?? "ROLL !";

		button.addEventListener("click", () => {
			console.log("ROLLING EYEEEEEEEEES !!!");
		});

		this.addControl(button, "bottomleft");
	}

	addMarker(
		location: Location,
		image: string,
		message: string | undefined = undefined
	): Leaflet.Marker {
		const markerSize = this.options.style?.markerSize ?? 16;

		const marker = Leaflet.marker(location.toTuple(), {
			icon: Leaflet.icon({
				iconUrl: image,
				iconSize: [markerSize, markerSize],
				popupAnchor: [0, -markerSize / 2]
			})
		}).addTo(this.map!);

		if (message !== undefined) {
			marker.bindPopup(message);
		}

		return marker;
	}

	addControl(
		element: HTMLElement,
		position: Leaflet.ControlPosition
	): Leaflet.Control {
		const ExtendedControl = Leaflet.Control.extend({
			onAdd: (_: any) => element
		});
		const control = new ExtendedControl({ position }).addTo(this.map!);
		return control;
	}
}

export default RandomChooserMap;
