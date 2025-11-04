export type WeightedItem<T> = { value: T; weight: number };
export type WeightedSet<T> = Set<WeightedItem<T>>;




export function random<T>(items: WeightedSet<T>): T {
    // Convert to array for iteration
    const arr = Array.from(items.values());
    const total = arr.reduce((s, it) => s + (it.weight || 0), 0);
    if (total <= 0) {
        return arr[0]?.value as T;
    }

    let r = Math.random() * total;
    for (const it of arr) {
        r -= (it.weight || 0);
        if (r <= 0) return it.value;
    }
    
    return arr[arr.length - 1].value;
}