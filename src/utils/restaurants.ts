import { Location } from "./location";

export class Restaurant {
	private _name: string;
	private _location: Location;
	private _address: string;

	public constructor(name: string, address: string, location: Location) {
		this._name = name;
		this._location = location;
		this._address = address;
	}

	public get name(): string {
		return this._name;
	}

	public get location(): Location {
		return this._location;
	}

	public get address(): string {
		return this._address;
	}
}

export const all: Array<Restaurant> = [
	new Restaurant(
		"Giraya",
		"22 Pl. du Millénaire, 34000 Montpellier",
		Location.at(43.607848623402234, 3.8894554656255598)
	),
	new Restaurant(
		"Grand Slam",
		"16 Rue Boussairolles, 34000 Montpellier",
		Location.at(43.60768439445637, 3.8812468082320444)
	),
	new Restaurant(
		"Subway",
		"4 Rue de Verdun, 34000 Montpellier",
		Location.at(43.60756628044681, 3.8802459617421103)
	),
	new Restaurant(
		"Thai to Box",
		"13 Rue de Verdun, 34000 Montpellier",
		Location.at(43.60722883336906, 3.8807294299039223)
	),
	new Restaurant(
		"Bistro Régent",
		"26 All. Jules Milhau, 34000 Montpellier",
		Location.at(43.60919396081588, 3.8819854087880383)
	),
	new Restaurant(
		"Cuisine S",
		"All. Jules Milhau, 34000 Montpellier",
		Location.at(43.60877550101456, 3.882493898330213)
	)
];

export default all;
