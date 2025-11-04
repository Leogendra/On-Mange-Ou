import { RandomChoice } from "./types";
import { WeightedSet } from "../utils/weighted-random";
import { loadSettings, updateSettings } from "./settings";




export function recoverSavedWeights(items: Set<RandomChoice>): WeightedSet<RandomChoice> {
    const weights: WeightedSet<RandomChoice> = new Set();
    const settings = loadSettings();

    for (const item of items) {
        const savedRestaurant = settings.restaurants.find(r => r.name === item.name);
        const weight = savedRestaurant?.weight || 1;
        weights.add({ value: item, weight: weight });
    }

    return weights;
}


export function updateWeight(items: Set<RandomChoice>, decrement: RandomChoice) {
    const settings = loadSettings();
    const updatedRestaurants = settings.restaurants.map(restaurant => {
        const isTargetRestaurant = Array.from(items).some(item => item.name === restaurant.name);
        if (isTargetRestaurant) {
            const currentWeight = restaurant.weight || 1;
            if (restaurant.name === decrement.name) {
                return { ...restaurant, weight: 0 };
            } else {
                return { ...restaurant, weight: currentWeight + 1 };
            }
        }
        return restaurant;
    });

    updateSettings({ restaurants: updatedRestaurants });
}