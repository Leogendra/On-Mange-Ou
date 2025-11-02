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

    const seen = new Set<string>();
    const results: Restaurant[] = [];

    for (const r of config.defaultRestaurants) {
        if (!r || !r.name) continue;
        const normalized = String(r.name).trim().toLowerCase();
        if (!normalized) continue;
        if (seen.has(normalized)) {
            console.warn(`Duplicate restaurant name in config skipped: ${r.name}`);
            continue;
        }
        seen.add(normalized);

        // Defensive: ensure location is present
        if (!r.location || typeof r.location.lat !== 'number' || typeof r.location.long !== 'number') {
            console.warn(`Invalid location for restaurant '${r.name}', skipping`);
            continue;
        }

        results.push(new Restaurant(
            r.name,
            Location.at(r.location.lat, r.location.long),
            r.address || ""
        ));
    }

    return results;
}

export default createRestaurantsFromConfig;