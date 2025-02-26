import Leaflet from "leaflet";
import { Location } from "./location";
import * as NamedRandom from "./named-random";

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
		rollAction?: string;
	};
};

function wait(timeout: number): Promise<void> {
	return new Promise((success, _) => {
		setInterval(success, timeout);
	});
}

class RandomChooserMap {
	private choices: RandomChoices;
	private options: RandomChooserMapOptions;
	private map: Leaflet.Map | null = null;

	private markerCache: Map<RandomChoice, Leaflet.Marker> = new Map();
	private controlCache: Map<RandomChoice, HTMLElement> = new Map();

	public constructor(
		choices: RandomChoices,
		options?: RandomChooserMapOptions
	) {
		this.choices = choices;
		this.options = options ?? {};
	}

	public async roll() {
		const choicesSet = new Set(this.choices);
		const randomChoice = NamedRandom.random(
			NamedRandom.recoverSavedWeights(choicesSet)
		);
		const randomIndex = this.choices.indexOf(randomChoice);

		for (let i = 0; i < this.choices.length * 5 + randomIndex + 1; i++) {
			this.unselectAll();
			this.selectChoice(i % this.choices.length);

			await wait(50);
		}

		this.controlCache.get(this.choices[randomIndex])?.click();
		NamedRandom.updateWeight(choicesSet, randomChoice);
	}

	selectChoice(choice: number | RandomChoice) {
		if (Number.isInteger(choice)) {
			choice = this.choices[Number(choice)];
		}

		this.controlCache
			.get(choice as RandomChoice)
			?.classList.add("selected");
	}

	unselectAll() {
		for (const control of this.controlCache.values()) {
			control.classList.remove("selected");
		}
	}

	public mountOn(root: HTMLElement | string) {
		this.map = Leaflet.map(root);
		this.initOrigin();
		this.addTileSet();
		this.addRandomChoiceMarkers();
		this.addRollControl();
		this.addRandomChoiceControls();
		this.addInteractions();
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
					'&copy; Tiles made by <a href="https://openstreetmap.fr">OpenStreetMap France</a>',
				minZoom: 1,
				maxZoom: 20
			}
		).addTo(this.map!);
	}

	addRandomChoiceMarkers() {
		if (this.options.style?.randomMarker !== undefined) {
			for (const choice of this.choices) {
				const marker = this.addMarker(
					choice.location,
					this.options.style.randomMarker,
					choice.name
				);

				this.markerCache.set(choice, marker);
			}
		}
	}

	addRollControl() {
		const button = document.createElement("button");

		button.id = "random-chooser-map-control-roll";
		button.classList.add("random-chooser-map-control");

		button.innerText = this.options.text?.rollAction ?? "ROLL !";

		button.addEventListener("click", () => {
			this.roll();
		});

		this.addControl(button, "bottomright");
	}

	addRandomChoiceControls() {
		const container = document.createElement("aside");
		container.id = "random-chooser-map-control-choices";
		container.classList.add("random-chooser-map-control");

		for (const choice of this.choices) {
			const index = this.choices.indexOf(choice);

			const title = document.createElement("h2");
			title.innerText = choice.name;

			const description = document.createElement("h3");
			description.innerText = choice.description;

			const item = document.createElement("div");
			item.classList.add(
				"random-chooser-map-control",
				"random-chooser-map-control-choice"
			);
			item.appendChild(title);
			item.appendChild(description);

			container.appendChild(item);

			if (index !== this.choices.length - 1) {
				container.appendChild(document.createElement("hr"));
			}

			this.controlCache.set(choice, item);
		}

		this.addControl(container, "topright");
	}

	addInteractions() {
		for (const [choice, control] of this.controlCache.entries()) {
			control.addEventListener("click", (e) => {
				this.markerCache.get(choice)?.openPopup();
				e.stopPropagation();
			});
		}
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
