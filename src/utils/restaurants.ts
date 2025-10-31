import { Location } from "./location";
import { RandomChoice } from "../RandomChooserMap";


export class Restaurant implements RandomChoice {
    constructor(
        private _name: string,
        private _location: Location,
        private _address: string = ""
    ) { }

    get name(): string {
        return this._name;
    }
    get address(): string {
        return this._address;
    }
    get location(): { lat: number; long: number; } {
        return {
            lat: this._location.lat,
            long: this._location.lon
        };
    }
}

export function createRestaurantsFromConfig(config: any): Restaurant[] {
    if (!config || !Array.isArray(config.defaultRestaurants)) return [];

    return config.defaultRestaurants.map((r: any) => new Restaurant(
        r.name,
        Location.at(r.location.lat, r.location.long),
        r.address || ""
    ));
}

export default createRestaurantsFromConfig;