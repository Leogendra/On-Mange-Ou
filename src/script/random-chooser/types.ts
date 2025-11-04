export interface RandomChoice {
    name: string;
    address: string;
    location: {
        lat: number;
        long: number;
    };
}


export interface AppSettings {
    restaurants: Array<{
        name: string;
        address: string;
        location: {
            lat: number;
            long: number;
        };
        weight?: number;
    }>;
    weightsEnabled?: boolean;
    mapStyle?: string;
    originPosition?: {
        lat: number;
        lng: number;
    };
    version: string;
}


export type RandomChoices = Array<RandomChoice>;


export type RandomChooserMapOptions = {
    view?: {
        origin?: any;
        zoom?: number;
        mapStyle?: string;
    };
    style?: {
        markerSize?: number;
        originMarker?: string;
        randomMarker?: string;
    };
    text?: any;
    availableConfigs?: string[];
    selectedConfig?: string;
    language?: string;
};


export function wait(timeout: number): Promise<void> {
    return new Promise((success) => {
        setInterval(success, timeout);
    });
}