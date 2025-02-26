type WeightedItem<T> = {
	value: T;
	weight: number;
};

type WeightedSet<T> = Set<WeightedItem<T>>;

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

type NamedValue = {
	name: string;
};

export function recoverSavedWeights<T extends NamedValue>(
	items: Set<T>
): WeightedSet<T> {
	const weights: WeightedSet<T> = new Set();
	const rawWeights = localStorage.getItem("weights");

	for (const item of items) {
		weights.add({
			value: item,
			weight: 1
		});
	}

	if (rawWeights !== null) {
		const savedWeights = JSON.parse(rawWeights) as {
			[key: string]: number;
		};

		for (const [name, weight] of Object.entries(savedWeights)) {
			for (const item of weights) {
				if (item.value.name === name) {
					item.weight = weight;
				}
			}
		}
	}

	return weights;
}

export function updateWeight<T extends NamedValue>(
	items: Set<T>,
	decrement: T
) {
	const rawWeights = localStorage.getItem("weights");
	let weights: {
		[key: string]: number;
	} = {};

	if (rawWeights !== null) {
		const savedWeights: {
			[key: string]: number | undefined;
		} = JSON.parse(rawWeights);

		for (const item of items) {
			if (savedWeights[item.name] === undefined) {
				weights[item.name] = 1;
			} else {
				weights[item.name] = savedWeights[item.name]!;
			}
		}
	} else {
		for (const item of items) {
			weights[item.name] = 1;
		}
	}

	for (const [name, weight] of Object.entries(weights)) {
		if (decrement.name === name) {
			weights[name] = weight - 1;
		} else {
			weights[name] = weight + 2;
		}
	}

	localStorage.setItem("weights", JSON.stringify(weights));
}
