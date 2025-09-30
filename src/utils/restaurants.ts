import { Location } from "./location";
import { RandomChoice } from "../RandomChooserMap";
import config from "../data/config.json";


export class Restaurant implements RandomChoice {
    constructor(
        private _name: string,
        private _description: string,
        private _location: Location
    ) { }

    get name(): string {
        return this._name;
    }
    get description(): string {
        return this._description;
    }
    get location(): Location {
        return this._location;
    }
}

export const all: Restaurant[] = config.defaultRestaurants.map(
    (r) => new Restaurant(r.name, r.address, Location.at(r.location.lat, r.location.long))
);

export default all;
