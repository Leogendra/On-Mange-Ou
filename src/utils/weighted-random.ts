export type WeightedItem<T> = {
	value: T;
	weight: number;
};

export type WeightedSet<T> = Set<WeightedItem<T>>;

export function random<T>(items: WeightedSet<T>): T {
	const orderedItems = [...items];
	const totalWeight = orderedItems.reduce(
		(accumulator, item) => accumulator + item.weight,
		0
	);

	let randomValue = Math.floor(Math.random() * totalWeight);
	let nextIndex = 0;

	while (randomValue > 0) {
		randomValue -= orderedItems[nextIndex].weight;
		nextIndex++;
	}

	if (randomValue === 0) {
		return orderedItems[nextIndex].value;
	} else {
		// if randomValue is negative, we overpass the value and must take the last one
		return orderedItems[nextIndex - 1].value;
	}
}

export default random;
