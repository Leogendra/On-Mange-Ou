export class Location {
    constructor(public lat: number, public lon: number) { }

    toTuple(): [number, number] {
        return [this.lat, this.lon];
    }

    static at(lat: number, lon: number) {
        return new Location(lat, lon);
    }
}


export default Location;