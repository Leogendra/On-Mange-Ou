import { Location } from "./utils";

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

const RESTAURANTS: Array<Restaurant> = [
    new Restaurant(
        "Giraya",
        "22 Pl. du Millénaire, 34000 Montpellier",
        Location.at(43.607848623402234, 3.8894554656255598)
    ),
];
export default RESTAURANTS;
