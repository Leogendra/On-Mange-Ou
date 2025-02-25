# 🍴 OMO

**OMO** standing for _On Mange Où ?_ is a random restaurant chooser. It's a map presenting a set of restaurant with a big button that select a random one among them.

It's developed in pure _HTML_/_CSS_/_Typescript_ using [**Vite**](https://vite.dev/) as a builder. The project package is managed with [**PNPM**](https://pnpm.io/). The map is done with [**Leaflet**](https://leafletjs.com/) using [**OpenStreetMap France**](https://www.openstreetmap.fr/) tiles.

The project is auto-published using **Gitlab Pages** at [https://omo-60e239.gitlab.io/](https://omo-60e239.gitlab.io/).

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

## 🛣️ Roadmap

-   [x] Setup interactive map centered on **Pradeo**
-   [x] Add restaurant list
-   [x] Add full random restaurant selection
-   [ ] Add weighting of selection probability based on frequency

## 👏 Thanks

Big thanks to [**Dimitri Prestat**](https://github.com/diprestat) for the original idea.
