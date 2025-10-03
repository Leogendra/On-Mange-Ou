# 🍴 On Mange Où ?

**On Mange Où ?** is a random restaurant chooser. It's a map presenting a set of restaurant with a button that select a random one among them.

It's developed in pure _HTML_/_CSS_/_Typescript_ using [**Vite**](https://vite.dev/) as a builder. The project package is managed with [**PNPM**](https://pnpm.io/). The map is done with [**Leaflet**](https://leafletjs.com/) using [**OpenStreetMap France**](https://www.openstreetmap.fr/) tiles.

The project is available live at at [on-mange-ou.gatienh.fr](https://on-mange-ou.gatienh.fr).

## 🛠️ Development

The project can be run locally using **Vite** and its auto-update development server with the commands :

```bash
pnpm install
pnpm run dev
```

Every push to the _main_ branch will trigger the auto-publication online. To verify the build result locally before pushing it online, you can run the following command to test it with the **Vite** preview :

```bash
pnpm run build
pnpm run preview
```

## Customization

You can customize parameters like initial position or default restaurants by editing the `src/data/config.json` file. The format is as follows :

```json
{
    "initialLat": 43.459399,
    "initialLng": 3.861694,
    "initialZoom": 16,
    "language": "en",
    "defaultRestaurants": [
        {
            "name": "Restaurant Name",
            "address": "123 Main St (optional)",
            "location": {
                "lat": 48.8566,
                "long": 2.3522
            },
            "weight": 1
        },
        ...
    ]
}
```

## 🛣️ Features roadmap

-   [x] Setup interactive map
-   [x] Add restaurant list
-   [x] Add full random restaurant selection
-   [x] Add weighting of selection probability based on frequency
-   [x] Update the restaurant list from a JSON file
-   [x] Add restaurants by clicking on the map
-   [x] Add option to hide restaurants before rolling
-   [x] Add toggle for weighted/random selection
-   [x] Display weights on the restaurant list
-   [x] Add option to reset weights
-   [x] Add option to manually set weights
-   [x] Export/import restaurant list via URL
-   [x] Improve UI/UX for mobile
-   [x] Collapse restaurant list

## 👏 Thanks

Big thanks to [**Dimitri Prestat**](https://github.com/diprestat) for the original idea, and [**Louis Parent**](https://gitlab.com/loss2/webapp/omo) for the implementation.
