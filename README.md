# 🍴 On Mange Où ?

**On Mange Où ?** is a random restaurant chooser with a map presenting a set of restaurant of your choice with a button that select a random one among them. You can click on the map to add a restaurant at the clicked location. The restaurant list can be stored and shared via URL or JSON.

It's developed in pure _HTML_/_CSS_/_Typescript_ using [**Vite**](https://vite.dev/) as a builder. The project package is managed with [**PNPM**](https://pnpm.io/). The map is done with [**Leaflet**](https://leafletjs.com/) using [**OpenStreetMap**](https://www.openstreetmap.fr/) tiles.

The project is available at [https://on-mange-ou.gatienh.fr](https://on-mange-ou.gatienh.fr).

## ✨ Features

- Interactive map
- Restaurant list
- Full random restaurant selection
- Weighting of selection probability based on frequency
- Update the restaurant list from a JSON file
- Add restaurants by clicking on the map
- Add option to hide restaurants before rolling
- Add toggle for weighted/random selection
- Display weights on the restaurant list
- Add option to reset weights
- Add option to manually set weights
- Export/import restaurant list via URL
- Collapse restaurant list
- Load and save configuration files
- UI for mobile

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

## ⚙️ Customize multiple configurations

The app supports multiple default configuration files for different use cases. You can customize parameters like initial position or default restaurants by editing the `src/data/config/default.json` file. The format is as follows :

```json
{
    "initialLat": 43.459399,
    "initialLng": 3.861694,
    "initialZoom": 16,
    "language": "en",
    "mapStyle": "https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png",
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
    ]
}
```
You can find tile providers (mapStyle) at https://leaflet-extras.github.io/leaflet-providers/preview/

To use multiple configurations files, you can place JSON files in `src/data/config/` (e.g. `work.json`, `my-faves.json`). Each fields will override the default config when that file is selected. For example, a minimal config that would only override the language while inheriting all other values from `default.json` could be:

```json
{
    "language": "en"
}
```

You can select a configuration in two ways:
- **In-app**: open Settings -> "Load custom configuration" and pick one of the available files.
- **URL**: append `?config=<name>` in the URL. Example: `http://localhost:5173/?config=minimal`. /!\ Refreshing the page with a `config` parameter will clears the saved settings and reset the configuration.

Info: Exports are produced in the same format as config files so you can take an exported JSON and drop it into `src/data/config/` to use it as it is.

## 👏 Thanks

Big thanks to [**Dimitri Prestat**](https://github.com/diprestat) for the original idea, and [**Louis Parent**](https://gitlab.com/louis-parent) for the implementation.