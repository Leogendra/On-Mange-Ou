export class Location {
	private _latitude: number;
	private _longitude: number;

	private constructor(lat: number, lon: number) {
		this._latitude = lat;
		this._longitude = lon;
	}

	public get lat(): number {
		return this._latitude;
	}

	public get lon(): number {
		return this._longitude;
	}

	public toTuple(): [number, number] {
		return [this._latitude, this._longitude];
	}

	public static at(lat: number, lon: number): Location {
		return new Location(lat, lon);
	}
}
