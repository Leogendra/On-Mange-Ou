import Leaflet from "leaflet";
import { Location } from "./utils/location";
import { WeightedSet, random as weightedRandom } from "./utils/weighted-random";

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
		const randomChoice = weightedRandom(
			this.recoverSavedWeights(choicesSet)
		);
		const randomIndex = this.choices.indexOf(randomChoice);

		for (let i = 0; i < this.choices.length * 5 + randomIndex + 1; i++) {
			this.unselectAll();
			this.selectChoice(i % this.choices.length);

			await wait(50);
		}

		this.controlCache.get(this.choices[randomIndex])?.click();
		this.updateWeight(choicesSet, randomChoice);
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

	private initOrigin() {
		if (this.options.view !== undefined) {
			const origin = this.options.view.origin ?? Location.at(0, 0);

			this.map!.setView(origin.toTuple(), this.options.view.zoom);

			if (this.options.style?.originMarker !== undefined) {
				this.addMarker(origin, this.options.style.originMarker);
			}
		}
	}

	private addTileSet() {
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

	private addRandomChoiceMarkers() {
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

	private addRollControl() {
		const button = document.createElement("button");

		button.id = "random-chooser-map-control-roll";
		button.classList.add("random-chooser-map-control");

		button.innerText = this.options.text?.rollAction ?? "ROLL !";

		button.addEventListener("click", () => {
			this.roll();
		});

		this.addControl(button, "bottomright");
	}

	private addRandomChoiceControls() {
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

	private addInteractions() {
		for (const [choice, control] of this.controlCache.entries()) {
			control.addEventListener("click", (e) => {
				this.markerCache.get(choice)?.openPopup();
				e.stopPropagation();
			});
		}
	}

	private addMarker(
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

	private addControl(
		element: HTMLElement,
		position: Leaflet.ControlPosition
	): Leaflet.Control {
		const ExtendedControl = Leaflet.Control.extend({
			onAdd: (_: any) => element
		});
		const control = new ExtendedControl({ position }).addTo(this.map!);
		return control;
	}

	private selectChoice(choice: number | RandomChoice) {
		if (Number.isInteger(choice)) {
			choice = this.choices[Number(choice)];
		}

		this.controlCache
			.get(choice as RandomChoice)
			?.classList.add("selected");
	}

	private unselectAll() {
		for (const control of this.controlCache.values()) {
			control.classList.remove("selected");
		}
	}

	private recoverSavedWeights(
		items: Set<RandomChoice>
	): WeightedSet<RandomChoice> {
		const weights: WeightedSet<RandomChoice> = new Set();
		const rawWeights = localStorage.getItem("weights");

		for (const item of items) {
			weights.add({
				value: item,
				weight: 1
			});
		}

		if (rawWeights !== null) {
			const savedWeights = JSON.parse(rawWeights) as {
				[key: string]: number;
			};

			for (const [name, weight] of Object.entries(savedWeights)) {
				for (const item of weights) {
					if (item.value.name === name) {
						item.weight = weight;
					}
				}
			}
		}

		return weights;
	}

	private updateWeight(items: Set<RandomChoice>, decrement: RandomChoice) {
		const rawWeights = localStorage.getItem("weights");
		let weights: {
			[key: string]: number;
		} = {};

		if (rawWeights !== null) {
			const savedWeights: {
				[key: string]: number | undefined;
			} = JSON.parse(rawWeights);

			for (const item of items) {
				if (savedWeights[item.name] === undefined) {
					weights[item.name] = 1;
				} else {
					weights[item.name] = savedWeights[item.name]!;
				}
			}
		} else {
			for (const item of items) {
				weights[item.name] = 1;
			}
		}

		for (const [name, weight] of Object.entries(weights)) {
			if (decrement.name === name) {
				weights[name] = weight - 1;
			} else {
				weights[name] = weight + 2;
			}
		}

		localStorage.setItem("weights", JSON.stringify(weights));
	}
}

export default RandomChooserMap;
