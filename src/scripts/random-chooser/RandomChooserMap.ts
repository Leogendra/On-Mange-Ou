import { loadSettings as _loadSettings, saveSettings as _saveSettings, updateSettings as _updateSettings, areWeightsEnabled as _areWeightsEnabled, toggleWeights as _toggleWeights, saveRestaurantsToStorageInternal as _saveRestaurantsToStorageInternal } from "./settings";
import { recoverSavedWeights as _recoverSavedWeights, updateWeight as _updateWeight } from "./weights";
import { buildAddRestaurantDialog, buildEditWeightsDialog, buildMapStyleDialog } from "./dialogs";
import { RandomChoice, AppSettings, RandomChoices, RandomChooserMapOptions, wait } from "./types";
import { WeightedSet, random as weightedRandom } from "../utils/weighted-random";
import { STORAGE_KEY_SETTINGS } from "./constants";
import { Location } from "../utils/location";
import Leaflet from "leaflet";




class RandomChooserMap {
    private static readonly SETTINGS_STORAGE_KEY = STORAGE_KEY_SETTINGS;

    private choices: RandomChoices;
    private defaultChoices: RandomChoices;
    private options: RandomChooserMapOptions;
    private map: Leaflet.Map | null = null;

    private markerCache: Map<RandomChoice, Leaflet.Marker> = new Map();
    private controlCache: Map<RandomChoice, HTMLElement> = new Map();

    private lockRoll: boolean = false;
    private alreadyRolled: boolean = false;

    private tempMarker: Leaflet.Marker | null = null;
    private addRestaurantDialog: HTMLDialogElement | null = null;
    private editWeightsDialog: HTMLDialogElement | null = null;
    private mapStyleDialog: HTMLDialogElement | null = null;
    private configSelectorDialog: HTMLDialogElement | null = null;

    private originalMapStyle: string | null = null;
    private hiddenRestaurants: Set<RandomChoice> = new Set();
    private originMarker: Leaflet.Marker | null = null;
    private actionChoiceDialog: HTMLDialogElement | null = null;
    private currentOriginPosition: Leaflet.LatLng | null = null;
    private restaurantsCollapsed: boolean = false;

    public constructor(
        defaultChoices: RandomChoices,
        options?: RandomChooserMapOptions
    ) {
        this.defaultChoices = [...defaultChoices];
        this.choices = this.loadRestaurantsFromStorage(defaultChoices);
        this.options = options ?? {};
    }

    public async roll() {
        if (this.lockRoll) { return; }
        this.lockRoll = true;

        const visibleChoices = this.choices.filter(choice => !this.hiddenRestaurants.has(choice));
        
        if (visibleChoices.length === 0) {
            alert(this.options.text?.noVisibleRestaurant ?? "No visible restaurant for selection! Please make at least one restaurant visible.");
            return;
        }

        let randomChoice: RandomChoice;
        let randomIndex: number;
        
        if (this.areWeightsEnabled()) {
            const choicesSet = new Set(visibleChoices);
            randomChoice = weightedRandom(this.recoverSavedWeights(choicesSet));
            randomIndex = visibleChoices.indexOf(randomChoice);
        } 
        else {
            randomIndex = Math.floor(Math.random() * visibleChoices.length);
            randomChoice = visibleChoices[randomIndex];
        }

        const addButton = document.getElementById("button-add-restaurant");
        if (addButton !== null) { addButton.style.display = "none"; }

        const restaurantListElements = document.getElementById("random-chooser-map-control-choices");
        const allClosableElements = document.getElementsByClassName("random-chooser-map-control-choice-closable");
        if (restaurantListElements && restaurantListElements.scrollHeight > restaurantListElements.clientHeight) {
            for (let i = 0; i < allClosableElements.length; i++) {
                (allClosableElements[i] as HTMLElement).classList.add("closed");
            }
        }

        const randomRollNumber = Math.floor(Math.random() * 7) + 3;
        for (let i = 0; i < visibleChoices.length * randomRollNumber + randomIndex + 1; i++) {
            this.unselectAll();
            this.selectChoice(visibleChoices[i % visibleChoices.length]);
            await wait(this.alreadyRolled ? 50 : 100);
        }

        this.controlCache.get(randomChoice)?.click();
        
        if (this.areWeightsEnabled()) {
            const choicesSet = new Set(visibleChoices);
            this.updateWeight(choicesSet, randomChoice);
        }

        await wait(this.alreadyRolled ? 500 : 1000);
        if (addButton !== null) { addButton.style.display = "flex"; }
        
        this.lockRoll = false;

        if (this.alreadyRolled) { return; } // Let labels closed
        this.alreadyRolled = true;

        for (let i = 0; i < allClosableElements.length; i++) {
            (allClosableElements[i] as HTMLElement).classList.remove("closed");
        }
    }


    public mountOn(root: HTMLElement | string) {
        this.parseUrlParameters();
        
        this.map = Leaflet.map(root);
        this.initOrigin();
        this.addTileSet();
        this.addRandomChoiceMarkers();
        this.addRollControl();
        this.addSettigsControl();
        this.addRandomChoiceControls();
        this.addInteractions();
        this.createAddRestaurantDialog();
        this.createEditWeightsDialog();
        this.createMapStyleDialog();
        this.createConfigSelectorDialog();
        this.createActionChoiceDialog();
        this.addMapClickHandler();
    }


    private initOrigin() {
        if (this.options.view !== undefined) {
            const savedOriginPosition = this.loadOriginPosition();
            const origin = savedOriginPosition || this.options.view.origin || Location.at(0, 0);

            this.map!.setView(origin.toTuple(), this.options.view.zoom);
            this.currentOriginPosition = Leaflet.latLng(origin.lat, origin.lon);

            if (this.options.style?.originMarker !== undefined) {
                this.originMarker = this.addMarker(origin, this.options.style.originMarker);
            }
        }
    }


    private addTileSet() {
        const settings = this.loadSettings();
        const mapStyleUrl = settings.mapStyle 
            || this.options.view?.mapStyle 
            || "https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png";

        Leaflet.tileLayer(mapStyleUrl, {
            attribution:
                "&copy; <a href='https://openstreetmap.fr'>OpenStreetMap France</a>",
            minZoom: 1,
            maxZoom: 20
        }).addTo(this.map!);
    }

    private addRandomChoiceMarkers() {
        if (this.options.style?.randomMarker !== undefined) {
            for (const choice of this.choices) {
                const marker = this.addMarker(
                    Location.at(choice.location.lat, choice.location.long),
                    this.options.style.randomMarker,
                    choice.name
                );

                this.markerCache.set(choice, marker);
            }
        }
    }

    private addRollControl() {
        const button = document.createElement("button");

        button.id = "random-chooser-map-control-roll";

        button.innerText = this.options.text?.rollAction ?? "ROLL !";

        button.addEventListener("click", (e) => {
            e.stopPropagation();
            this.roll();
        });

        this.addControl(button, "bottomright");
    }

    private addSettigsControl() {
        const button = document.createElement("button");

        button.id = "random-chooser-map-control-settings";
        button.innerText = this.options.text?.settingsAction ?? "Settings";

        button.addEventListener("click", (e) => {
            e.stopPropagation();
            this.showSettingsMenu(button);
        });

        this.addControl(button, "bottomleft");
    }

    private showSettingsMenu(button: HTMLElement) {

        const existing = document.getElementById("button-settings-menu");
        if (existing !== null) { 
            existing.remove(); 
            return; // Close the menu for mobile
        }

        const menu = document.createElement("div");
        menu.id = "button-settings-menu";
        menu.className = "reset-menu";

        const resetWeightsOption = document.createElement("button");
        resetWeightsOption.textContent = this.options.text?.resetWeights ?? "Reset weights";
        resetWeightsOption.className = "reset-menu-item";
        resetWeightsOption.addEventListener("click", (e) => {
            e.stopPropagation();
            this.resetWeights();
            removeMenuAndCleanup();
        });

        const resetRestaurantsOption = document.createElement("button");
        resetRestaurantsOption.textContent = this.options.text?.resetConfiguration ?? "Reset configuration";
        resetRestaurantsOption.className = "reset-menu-item";
        resetRestaurantsOption.addEventListener("click", (e) => {
            e.stopPropagation();
            this.resetToDefaultRestaurants();
            removeMenuAndCleanup();
        });

        const exportDataOption = document.createElement("button");
        exportDataOption.textContent = this.options.text?.exportData ?? "📤 Export data";
        exportDataOption.className = "reset-menu-item";
        exportDataOption.addEventListener("click", (e) => {
            e.stopPropagation();
            this.exportData();
            removeMenuAndCleanup();
        });

        const importDataOption = document.createElement("button");
        importDataOption.textContent = this.options.text?.importData ?? "📥 Import data";
        importDataOption.className = "reset-menu-item";
        importDataOption.addEventListener("click", (e) => {
            e.stopPropagation();
            this.importData();
            removeMenuAndCleanup();
        });

        const editWeightsOption = document.createElement("button");
        editWeightsOption.textContent = this.options.text?.editWeights ?? "⚖️ Edit weights";
        editWeightsOption.className = "reset-menu-item";
        editWeightsOption.addEventListener("click", (e) => {
            e.stopPropagation();
            this.showEditWeightsDialog();
            removeMenuAndCleanup();
        });

        const toggleWeightsOption = document.createElement("button");
        const weightsEnabled = this.areWeightsEnabled();
        toggleWeightsOption.textContent = weightsEnabled 
            ? (this.options.text?.weightsEnabled ?? "Weights: Enabled")
            : (this.options.text?.weightsDisabled ?? "Weights: Disabled");
        toggleWeightsOption.className = "reset-menu-item";
        toggleWeightsOption.addEventListener("click", (e) => {
            e.stopPropagation();
            this.toggleWeights();
            removeMenuAndCleanup();
        });

        const changeMapStyleOption = document.createElement("button");
        changeMapStyleOption.textContent = this.options.text?.changeMapStyle ?? "🗺️ Change map style";
        changeMapStyleOption.className = "reset-menu-item";
        changeMapStyleOption.addEventListener("click", (e) => {
            e.stopPropagation();
            this.showMapStyleDialog();
            removeMenuAndCleanup();
        });

    const chooseConfigOption = document.createElement("button");
    chooseConfigOption.textContent = this.options.text?.loadCustomConfig ?? "Load configuration";
        chooseConfigOption.className = "reset-menu-item";
        chooseConfigOption.addEventListener("click", (e) => {
            e.stopPropagation();
            this.showConfigSelectorDialog();
            removeMenuAndCleanup();
        });

        const exportUrlOption = document.createElement("button");
        exportUrlOption.textContent = this.options.text?.exportUrl ?? "🔗 Export via URL";
        exportUrlOption.className = "reset-menu-item";
        exportUrlOption.addEventListener("click", (e) => {
            e.stopPropagation();
            this.exportViaUrl();
            removeMenuAndCleanup();
        });

        menu.appendChild(exportDataOption);
        menu.appendChild(importDataOption);
    menu.appendChild(exportUrlOption);
    menu.appendChild(chooseConfigOption);
    menu.appendChild(changeMapStyleOption);
        menu.appendChild(toggleWeightsOption);
        
        if (weightsEnabled) {
            menu.appendChild(editWeightsOption);
            menu.appendChild(resetWeightsOption);
        }
        
        menu.appendChild(resetRestaurantsOption);

        const rect = button.getBoundingClientRect();
        menu.style.position = "fixed";
        menu.style.left = rect.right + "px";
        menu.style.bottom = (window.innerHeight - rect.top) + "px";

        document.body.appendChild(menu);

        menu.addEventListener("click", (e) => {
            e.stopPropagation();
        });

        let closeMenu: ((e: MouseEvent) => void) | null = null;
        const removeMenuAndCleanup = () => {
            try {
                if (menu.parentNode) {
                    document.body.removeChild(menu);
                }
            } catch (err) {
                // ignore
            }
            if (closeMenu) {
                document.removeEventListener("click", closeMenu);
                closeMenu = null;
            }
        };

        closeMenu = (e: MouseEvent) => {
            if (!menu.contains(e.target as Node) && !button.contains(e.target as Node)) {
                removeMenuAndCleanup();
            }
        };
        setTimeout(() => document.addEventListener("click", closeMenu!), 0);
    }

    private addHintRestaurantCard() {
        const buttonContainer = document.createElement("div");
        buttonContainer.classList.add("hint");

        const buttonTitle = document.createElement("div");
        buttonTitle.classList.add("random-chooser-map-control-choice-title-container");
        buttonTitle.innerText = this.options.text?.hintRestaurants ?? "Reset restaurants";

        buttonContainer.appendChild(buttonTitle);
        return buttonContainer;
    }

    private addRandomChoiceControls() {
        const existing = document.getElementById("div-random-chooser-map-control");
        if (existing !== null) { existing.remove(); }

        const divRestaurantContainer = document.createElement("div");
        divRestaurantContainer.id = "div-random-chooser-map-control";
        divRestaurantContainer.classList.add("div-restaurant-container");

        const collapseButton = document.createElement("button");
        collapseButton.id = "collapse-restaurants-btn";
        collapseButton.innerHTML = this.restaurantsCollapsed ? (this.options.text?.expandText ?? "Expand") : (this.options.text?.collapseText ?? "Collapse")
        collapseButton.title = this.restaurantsCollapsed 
            ? (this.options.text?.expandRestaurants ?? "Expand restaurants")
            : (this.options.text?.collapseRestaurants ?? "Collapse restaurants");
        collapseButton.addEventListener("click", (e) => {
            e.stopPropagation();
            this.toggleRestaurantsCollapse();
        });

        const restaurantContainer = document.createElement("aside");
        restaurantContainer.id = "random-chooser-map-control-choices";
        restaurantContainer.addEventListener("wheel", (e) => e.stopImmediatePropagation());
        restaurantContainer.addEventListener("scroll", (e) => e.stopImmediatePropagation());

        divRestaurantContainer.appendChild(collapseButton);
        divRestaurantContainer.appendChild(restaurantContainer);

        if (this.choices.length < 1) {
            const resetRestaurantCard = this.addHintRestaurantCard()
            restaurantContainer.appendChild(resetRestaurantCard);
        }

        for (const choice of this.choices) {
            const weight = this.recoverSavedWeights(new Set([choice])).values().next().value?.weight;

            const item = document.createElement("div");
            item.classList.add("random-chooser-map-control-choice");

            const titleElement = document.createElement("h2");
            titleElement.classList.add("random-chooser-map-control-choice-title");
            titleElement.innerText = choice.name;

            const deleteButton = document.createElement("button");
            deleteButton.classList.add("random-chooser-map-control-choice-delete");
            deleteButton.innerHTML = "x";
            deleteButton.title = this.options.text?.deleteRestaurantTooltip ?? "Delete this restaurant";
            deleteButton.addEventListener("click", (e) => {
                e.stopPropagation();
                this.deleteRestaurant(choice);
            });

            const hideButton = document.createElement("button");
            hideButton.classList.add("random-chooser-map-control-choice-hide");
            hideButton.innerHTML = "-";
            hideButton.title = this.options.text?.hideRestaurantTooltip ?? "Temporarily hide this restaurant";
            hideButton.addEventListener("click", (e) => {
                e.stopPropagation();
                this.toggleRestaurantVisibility(choice);
            });

            const actionsContainer = document.createElement("div");
            actionsContainer.classList.add("random-chooser-map-control-choice-actions");
            actionsContainer.appendChild(hideButton);
            actionsContainer.appendChild(deleteButton);

            const titleContainer = document.createElement("div");
            titleContainer.classList.add("random-chooser-map-control-choice-title-container");
            titleContainer.appendChild(titleElement);
            titleContainer.appendChild(actionsContainer);
            item.appendChild(titleContainer);

            if (choice.address) {
                const addressElement = document.createElement("h3");
                addressElement.classList.add("random-chooser-map-control-choice-description");
                addressElement.classList.add("random-chooser-map-control-choice-closable");
                addressElement.innerText = choice.address;
                item.appendChild(addressElement);
            }

            const weightElement = document.createElement("h3");
            weightElement.classList.add("random-chooser-map-control-choice-weight");
            weightElement.classList.add("random-chooser-map-control-choice-closable");
            weightElement.innerText = `${this.options.text?.weightLabel ?? "Weight:"} ${weight}`;
            item.appendChild(weightElement);

            const weightsEnabled = this.areWeightsEnabled();
            if (!weightsEnabled) {
                weightElement.style.display = "none";
            }

            restaurantContainer.appendChild(item);
            this.controlCache.set(choice, item);
        }

        this.addControl(divRestaurantContainer, "topright");
    }

    private addInteractions() {
        for (const [choice, control] of this.controlCache.entries()) {
            control.addEventListener("click", (e) => {
                this.markerCache.get(choice)?.openPopup();
                e.stopPropagation();
            });
        }
    }

    private addMarker(
        location: Location,
        image: string,
        message: string | undefined = undefined
    ): Leaflet.Marker {
        const markerSize = this.options.style?.markerSize ?? 16;

        const marker = Leaflet.marker(location.toTuple(), {
            icon: Leaflet.icon({
                iconUrl: image,
                iconSize: [markerSize, markerSize],
                popupAnchor: [0, -markerSize / 2]
            })
        }).addTo(this.map!);

        if (message !== undefined) {
            marker.bindPopup(message);
        }

        return marker;
    }

    private addControl(
        element: HTMLElement,
        position: Leaflet.ControlPosition
    ): void {
        element.style.position = "fixed";
        element.style.zIndex = "1000";
        element.style.pointerEvents = "auto";

        switch(position) {
            case "topright":
                element.style.top = "0.5rem";
                element.style.right = "0.5rem";
                break;
            case "topleft":
                element.style.top = "0.5rem";
                element.style.left = "0.5rem";
                break;
            case "bottomright":
                element.style.bottom = "0.2rem";
                element.style.right = "0.5rem";
                break;
            case "bottomleft":
                element.style.bottom = "0.2rem";
                element.style.left = "0.5rem";
                break;
        }

        document.body.appendChild(element);
    }

    private selectChoice(choice: number | RandomChoice) {
        if (Number.isInteger(choice)) {
            choice = this.choices[Number(choice)];
        }

        this.controlCache
            .get(choice as RandomChoice)
            ?.classList.add("selected");
    }

    private unselectAll() {
        for (const control of this.controlCache.values()) {
            control.classList.remove("selected");
        }
    }

    private recoverSavedWeights(
        items: Set<RandomChoice>
    ): WeightedSet<RandomChoice> {
        return _recoverSavedWeights(items);
    }

    private updateWeight(items: Set<RandomChoice>, decrement: RandomChoice) {
        _updateWeight(items, decrement);
        this.refreshWeightLabels();
    }

    private refreshWeightLabels() {
        const settings = this.loadSettings();
        const weightsEnabled = this.areWeightsEnabled();

        for (const restaurant of settings.restaurants) {
            const controlEntry = Array.from(this.controlCache.entries()).find(([choice]) => choice.name === restaurant.name);
            if (!controlEntry) continue;

            const control = controlEntry[1];
            const weightEl = control.querySelector('.random-chooser-map-control-choice-weight') as HTMLElement | null;
            if (!weightEl) continue;

            weightEl.innerText = `${this.options.text?.weightLabel ?? "Weight:"} ${restaurant.weight ?? 1}`;
            weightEl.style.display = weightsEnabled ? "block" : "none";
        }
    }

    private resetWeights() {
        const confirmMessage = this.options.text?.resetWeightsConfirmation ?? "Are you sure you want to reset all restaurant weights?";
        if (confirm(confirmMessage)) {
            const settings = this.loadSettings();
            const updatedRestaurants = settings.restaurants.map(restaurant => ({
                ...restaurant,
                weight: 1
            }));
            this.updateSettings({ restaurants: updatedRestaurants });
        }
    }

    private resetToDefaultRestaurants() {
        const confirmMessage = this.options.text?.resetConfigurationConfirmation ?? "Are you sure you want to reset configuration to defaults? This will remove all local settings.";
        if (confirm(confirmMessage)) {
            try {
                localStorage.removeItem(RandomChooserMap.SETTINGS_STORAGE_KEY);
            } 
            catch (err) {
                console.error("Error clearing settings from localStorage", err);
            }
            // Reload the page so the selected/default config is loaded fresh
            window.location.reload();
        }
    }

    private deleteRestaurant(choice: RandomChoice) {
        const index = this.choices.indexOf(choice);
        if (index > -1) {
            this.choices.splice(index, 1);
        }

        const marker = this.markerCache.get(choice);
        if (marker && this.map) {
            this.map.removeLayer(marker);
            this.markerCache.delete(choice);
        }

        this.controlCache.delete(choice);

        this.addRandomChoiceControls();
        this.addInteractions();
        this.saveRestaurantsToStorage();
    }

    private toggleRestaurantVisibility(choice: RandomChoice) {
        if (this.hiddenRestaurants.has(choice)) {
            this.hiddenRestaurants.delete(choice);

            const marker = this.markerCache.get(choice);
            if (marker && this.map) {
                marker.addTo(this.map);
            }

            const control = this.controlCache.get(choice);
            if (control) {
                control.classList.remove("hidden-restaurant");
                const hideButton = control.querySelector(".random-chooser-map-control-choice-hide") as HTMLButtonElement;
                if (hideButton) {
                    hideButton.innerHTML = "−";
                    hideButton.title = this.options.text?.hideRestaurantTooltip ?? "Temporarily hide this restaurant";
                }
            }
        } else {
            this.hiddenRestaurants.add(choice);

            const marker = this.markerCache.get(choice);
            if (marker && this.map) {
                this.map.removeLayer(marker);
            }

            const control = this.controlCache.get(choice);
            if (control) {
                control.classList.add("hidden-restaurant");
                const hideButton = control.querySelector(".random-chooser-map-control-choice-hide") as HTMLButtonElement;
                if (hideButton) {
                    hideButton.innerHTML = "+";
                    hideButton.title = this.options.text?.showRestaurantTooltip ?? "Make this restaurant visible";
                }
            }
        }
    }

    private toggleRestaurantsCollapse() {
        this.restaurantsCollapsed = !this.restaurantsCollapsed;
        
        const container = document.getElementById("random-chooser-map-control-choices");
        const collapseButton = document.getElementById("collapse-restaurants-btn");
        
        if (container && collapseButton) {
            if (this.restaurantsCollapsed) {
                container.classList.add("collapsed");
                collapseButton.innerHTML = this.options.text?.expandText ?? "Expand";
                collapseButton.title = this.options.text?.expandRestaurants ?? "Expand restaurants";
            } 
            else {
                container.classList.remove("collapsed");
                collapseButton.innerHTML = this.options.text?.collapseText ?? "Collapse";
                collapseButton.title = this.options.text?.collapseRestaurants ?? "Collapse restaurants";
            }
        }
    }

    private createAddRestaurantDialog() {
        this.addRestaurantDialog = buildAddRestaurantDialog(this.options.text);
        document.body.appendChild(this.addRestaurantDialog);
        this.setupDialogEvents();
    }

    private setupLocationInput() {
        if (!this.addRestaurantDialog) return;

        const locationInfo = this.addRestaurantDialog.querySelector("#location-info") as HTMLElement;
        const locationGroup = locationInfo?.parentNode as HTMLElement;
        
        if (!locationInfo || !locationGroup) return;


        const coordinatesInput = document.createElement("input");
        coordinatesInput.type = "text";
        coordinatesInput.id = "restaurant-coordinates";
        coordinatesInput.name = "restaurant-coordinates";
        coordinatesInput.placeholder = this.options.text?.formLocationCoordinatesPlaceholder ?? "Ex: 43.609935, 3.885456 or 43°36'35.8\"N 3°53'07.6\"E";
        coordinatesInput.required = false;
        

        coordinatesInput.style.padding = "0.8rem";
        coordinatesInput.style.border = "2px solid #ddd";
        coordinatesInput.style.borderRadius = "0.5rem";
        coordinatesInput.style.width = "100%";
        coordinatesInput.style.boxSizing = "border-box";
        coordinatesInput.style.fontSize = "1rem";
        coordinatesInput.style.transition = "all 0.3s ease";


        locationGroup.replaceChild(coordinatesInput, locationInfo);


        coordinatesInput.focus();


        coordinatesInput.addEventListener("input", () => {
            const isValid = this.validateAndSetCoordinates(coordinatesInput.value);
            
            if (isValid) {
                coordinatesInput.style.borderColor = "#28a745";
                coordinatesInput.style.backgroundColor = "#f8fff9";
            } else if (coordinatesInput.value.trim() === "") {
                coordinatesInput.style.borderColor = "#ddd";
                coordinatesInput.style.backgroundColor = "#fff";
            } else {
                coordinatesInput.style.borderColor = "#dc3545";
                coordinatesInput.style.backgroundColor = "#fff5f5";
            }
        });


        coordinatesInput.addEventListener("blur", () => {
            const latInput = this.addRestaurantDialog?.querySelector("#restaurant-lat") as HTMLInputElement;
            const lngInput = this.addRestaurantDialog?.querySelector("#restaurant-lng") as HTMLInputElement;
            
            if (!latInput?.value || !lngInput?.value) {

                const newLocationInfo = document.createElement("p");
                newLocationInfo.id = "location-info";
                newLocationInfo.textContent = this.options.text?.formLocationClickToEdit ?? "Click here to select on the map";
                newLocationInfo.style.cursor = "pointer";
                newLocationInfo.style.padding = "0.8rem";
                newLocationInfo.style.backgroundColor = "#f8f9fa";
                newLocationInfo.style.border = "2px dashed #ddd";
                newLocationInfo.style.borderRadius = "0.5rem";
                newLocationInfo.style.textAlign = "center";
                newLocationInfo.style.transition = "all 0.3s ease";

                newLocationInfo.addEventListener("click", () => {
                    this.setupLocationInput();
                });

                locationGroup.replaceChild(newLocationInfo, coordinatesInput);
            } 
            else {
                const confirmLocationInfo = document.createElement("p");
                confirmLocationInfo.id = "location-info";
                confirmLocationInfo.textContent = `${latInput.value}, ${lngInput.value}`;
                confirmLocationInfo.style.cursor = "pointer";
                confirmLocationInfo.style.padding = "0.8rem";
                confirmLocationInfo.style.backgroundColor = "#f8fff9";
                confirmLocationInfo.style.border = "2px solid #28a745";
                confirmLocationInfo.style.borderRadius = "0.5rem";
                confirmLocationInfo.style.textAlign = "center";
                confirmLocationInfo.style.transition = "all 0.3s ease";
                confirmLocationInfo.style.color = "#28a745";

                confirmLocationInfo.addEventListener("click", () => {
                    this.setupLocationInput();
                });

                locationGroup.replaceChild(confirmLocationInfo, coordinatesInput);
            }
        });
    }

    private setupDialogEvents() {
        if (!this.addRestaurantDialog) return;

        const cancelBtn = this.addRestaurantDialog.querySelector("#cancel-add") as HTMLButtonElement;
        const confirmBtn = this.addRestaurantDialog.querySelector("#confirm-add") as HTMLButtonElement;
        const nameInput = this.addRestaurantDialog.querySelector("#restaurant-name") as HTMLInputElement;
        const addressInput = this.addRestaurantDialog.querySelector("#restaurant-address") as HTMLInputElement;
        const latInput = this.addRestaurantDialog.querySelector("#restaurant-lat") as HTMLInputElement;
        const lngInput = this.addRestaurantDialog.querySelector("#restaurant-lng") as HTMLInputElement;

        if (!this.addRestaurantDialog) return;

        cancelBtn?.addEventListener("click", () => {
            this.cancelLocationSelection();
            this.addRestaurantDialog?.close();
        });

        this.addRestaurantDialog.addEventListener("click", (e) => {
            if (e.target === this.addRestaurantDialog) {
                this.cancelLocationSelection();
                this.addRestaurantDialog?.close();
            }
        });

        const form = this.addRestaurantDialog.querySelector("form") as HTMLFormElement;
        form?.addEventListener("submit", (e) => {
            e.preventDefault();
            if (this.validateRestaurantForm()) {
                this.addNewRestaurant(
                    nameInput.value.trim(),
                    addressInput.value.trim(),
                    parseFloat(latInput.value),
                    parseFloat(lngInput.value)
                );
                this.addRestaurantDialog?.close();
            }
        });

        this.addRestaurantDialog.addEventListener("close", () => {
            this.cancelLocationSelection();
            this.resetForm();
        });

        const validateForm = () => {
            const isValid = nameInput.value.trim() !== "" &&
                latInput.value !== "" &&
                lngInput.value !== "";
            confirmBtn.disabled = !isValid;
        };

        nameInput?.addEventListener("input", validateForm);
        addressInput?.addEventListener("input", validateForm);
    }

    private cancelLocationSelection() {
        if (this.tempMarker) {
            this.map?.removeLayer(this.tempMarker);
            this.tempMarker = null;
        }
    }

    private validateRestaurantForm(): boolean {
        const nameInput = this.addRestaurantDialog?.querySelector("#restaurant-name") as HTMLInputElement;
        const latInput = this.addRestaurantDialog?.querySelector("#restaurant-lat") as HTMLInputElement;
        const lngInput = this.addRestaurantDialog?.querySelector("#restaurant-lng") as HTMLInputElement;

        return nameInput?.value.trim() !== "" &&
            latInput?.value !== "" &&
            lngInput?.value !== "";
    }

    private validateAndSetCoordinates(coordinatesStr: string): boolean {
        if (!coordinatesStr.trim() || !this.addRestaurantDialog) {
            return false;
        }

        const cleanStr = coordinatesStr.trim();
        
        const ddRegex = /^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/;
        const ddMatch = cleanStr.match(ddRegex);
        
        if (ddMatch) {
            const lat = parseFloat(ddMatch[1]);
            const lng = parseFloat(ddMatch[2]);
            
            if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                const latInput = this.addRestaurantDialog.querySelector("#restaurant-lat") as HTMLInputElement;
                const lngInput = this.addRestaurantDialog.querySelector("#restaurant-lng") as HTMLInputElement;
                if (latInput && lngInput) {
                    latInput.value = lat.toString();
                    lngInput.value = lng.toString();
                    return true;
                }
            }
        }
        
        const dmsRegex = /(\d+)°(\d+)'([\d.]+)"([NS])\s+(\d+)°(\d+)'([\d.]+)"([EW])/;
        const dmsMatch = cleanStr.match(dmsRegex);
        
        if (dmsMatch) {
            const latDeg = parseInt(dmsMatch[1]);
            const latMin = parseInt(dmsMatch[2]);
            const latSec = parseFloat(dmsMatch[3]);
            const latDir = dmsMatch[4];
            
            const lngDeg = parseInt(dmsMatch[5]);
            const lngMin = parseInt(dmsMatch[6]);
            const lngSec = parseFloat(dmsMatch[7]);
            const lngDir = dmsMatch[8];
            
            let lat = latDeg + latMin / 60 + latSec / 3600;
            let lng = lngDeg + lngMin / 60 + lngSec / 3600;
            
            if (latDir === "S") lat = -lat;
            if (lngDir === "W") lng = -lng;
            
            if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                const latInput = this.addRestaurantDialog.querySelector("#restaurant-lat") as HTMLInputElement;
                const lngInput = this.addRestaurantDialog.querySelector("#restaurant-lng") as HTMLInputElement;
                if (latInput && lngInput) {
                    latInput.value = lat.toString();
                    lngInput.value = lng.toString();
                    return true;
                }
            }
        }
        
        return false;
    }

    private resetForm() {
        const nameInput = this.addRestaurantDialog?.querySelector("#restaurant-name") as HTMLInputElement;
        const addressInput = this.addRestaurantDialog?.querySelector("#restaurant-address") as HTMLInputElement;
        const latInput = this.addRestaurantDialog?.querySelector("#restaurant-lat") as HTMLInputElement;
        const lngInput = this.addRestaurantDialog?.querySelector("#restaurant-lng") as HTMLInputElement;
        const confirmBtn = this.addRestaurantDialog?.querySelector("#confirm-add") as HTMLButtonElement;

        if (nameInput) nameInput.value = "";
        if (addressInput) addressInput.value = "";
        if (latInput) latInput.value = "";
        if (lngInput) lngInput.value = "";
        if (confirmBtn) confirmBtn.disabled = true;

        const currentLocationElement = this.addRestaurantDialog?.querySelector("#location-info") as HTMLElement;
        const coordinatesInput = this.addRestaurantDialog?.querySelector("#restaurant-coordinates") as HTMLInputElement;

        let actualLocationGroup: HTMLElement | null = null;
        const formGroups = this.addRestaurantDialog?.querySelectorAll(".form-group");
        if (formGroups) {
            for (const group of formGroups) {
                const label = group.querySelector("label");
                if (label && label.textContent?.includes(this.options.text?.formLocationCoordinates ?? "Coordinates")) {
                    actualLocationGroup = group as HTMLElement;
                    break;
                }
            }
        }

        if (actualLocationGroup && (coordinatesInput || currentLocationElement)) {
            const elementToReplace = coordinatesInput || currentLocationElement;
            
            const locationInfo = document.createElement("p");
            locationInfo.id = "location-info";
            locationInfo.textContent = this.options.text?.formLocationClickToEdit ?? "Click here to select on the map";
            locationInfo.style.cursor = "pointer";
            locationInfo.style.padding = "0.8rem";
            locationInfo.style.backgroundColor = "#f8f9fa";
            locationInfo.style.border = "2px dashed #ddd";
            locationInfo.style.borderRadius = "0.5rem";
            locationInfo.style.textAlign = "center";
            locationInfo.style.transition = "all 0.3s ease";

            locationInfo.addEventListener("click", () => {
                this.setupLocationInput();
            });

            actualLocationGroup.replaceChild(locationInfo, elementToReplace);
        }
    }

    private addNewRestaurant(name: string, address: string, lat: number, lng: number) {
        const newRestaurant: RandomChoice = {
            name: name,
            address: address,
            location: { lat: lat, long: lng }
        };

        const normalized = name.trim().toLowerCase();
        const existsInChoices = this.choices.some(c => c.name.trim().toLowerCase() === normalized);
        if (existsInChoices) {
            alert(this.options.text?.restaurantNameExists ?? "A restaurant with this name already exists. Please choose another name.");
            return;
        }

        this.choices.push(newRestaurant);

        if (this.options.style?.randomMarker) {
            const marker = this.addMarker(
                Location.at(newRestaurant.location.lat, newRestaurant.location.long),
                this.options.style.randomMarker,
                newRestaurant.name
            );
            this.markerCache.set(newRestaurant, marker);
        }

        this.addRandomChoiceControls();
        this.addInteractions();
        this.saveRestaurantsToStorage();
    }

    private loadRestaurantsFromStorage(defaultChoices: RandomChoices): RandomChoices {
        try {
            const settings = this.loadSettings();
            if (settings.restaurants && settings.restaurants.length > 0) {
                const seen = new Set<string>();
                const results: RandomChoices = [];
                for (const r of settings.restaurants) {
                    if (!r || !r.name) { continue; }
                    
                    const normalized = String(r.name).trim().toLowerCase();
                    if (!normalized) { continue; }

                    if (seen.has(normalized)) {
                        console.warn(`Duplicate restaurant name in saved settings skipped: ${r.name}`);
                        continue;
                    }
                    seen.add(normalized);
                    
                    if (!r.location || typeof r.location.lat !== 'number' || typeof r.location.long !== 'number') {
                        console.warn(`Invalid location in saved settings for '${r.name}', skipping`);
                        continue;
                    }
                    results.push({
                        name: r.name,
                        address: r.address || "",
                        location: { lat: r.location.lat, long: r.location.long }
                    });
                }
                if (results.length > 0) return results;
            }
        } 
        catch (error) {
            console.warn(`Error while loading restaurants from settings: ${error}`);
        }

        this.saveRestaurantsToStorageInternal(defaultChoices);
        return [...defaultChoices];
    }

    private saveRestaurantsToStorage() {
        this.saveRestaurantsToStorageInternal(this.choices);
    }

    private saveRestaurantsToStorageInternal(choices: RandomChoices) {
        // delegate to settings helper which handles localStorage and merging
        _saveRestaurantsToStorageInternal(choices);
    }

    private createEditWeightsDialog() {
        this.editWeightsDialog = buildEditWeightsDialog(this.options.text);
        document.body.appendChild(this.editWeightsDialog);

        const cancelBtn = this.editWeightsDialog.querySelector("#cancel-edit-weights") as HTMLButtonElement | null;
        cancelBtn?.addEventListener("click", () => {
            this.editWeightsDialog?.close();
        });

        this.editWeightsDialog.addEventListener("click", (e) => {
            if (e.target === this.editWeightsDialog) {
                this.editWeightsDialog?.close();
            }
        });

        const form = this.editWeightsDialog.querySelector("form") as HTMLFormElement | null;
        form?.addEventListener("submit", (e) => {
            e.preventDefault();
            this.saveWeightsFromDialog();
            this.editWeightsDialog?.close();
        });
    }

    private createMapStyleDialog() {
        const currentSettings = this.loadSettings();
        const currentMapStyle = currentSettings.mapStyle || this.options.view?.mapStyle || "https://tile.openstreetmap.bzh/br/{z}/{x}/{y}.png";

        const mapStyles = [
            { name: this.options.text?.mapStyleDefault ?? "OpenStreetMap default", url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" },
            { name: this.options.text?.mapStyleBzr ?? "OpenStreetMap clean", url: "https://tile.openstreetmap.bzh/br/{z}/{x}/{y}.png" },
            { name: this.options.text?.mapStyleCartocdnLight ?? "Light map", url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" },
            { name: this.options.text?.mapStyleCartocdnDark ?? "Dark map", url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" },
            { name: this.options.text?.mapStyleOpentopomap ?? "Relief map", url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png" }
        ];

        this.mapStyleDialog = buildMapStyleDialog(this.options.text, currentMapStyle, mapStyles);
        document.body.appendChild(this.mapStyleDialog);

        const stylesContainer = this.mapStyleDialog.querySelector('.map-styles-container') as HTMLElement | null;
        const customInput = this.mapStyleDialog.querySelector('#custom-map-url') as HTMLInputElement | null;
        const customRadio = this.mapStyleDialog.querySelector('#style-custom') as HTMLInputElement | null;

        if (stylesContainer) {
            const radioButtons = stylesContainer.querySelectorAll('input[type="radio"]') as NodeListOf<HTMLInputElement>;
            radioButtons.forEach(radio => {
                radio.addEventListener('change', () => {
                    if (customInput) customInput.disabled = radio.value !== 'custom';

                    let newMapStyle: string;
                    if (radio.value === 'custom') {
                        if (customInput && customInput.value.trim()) {
                            newMapStyle = customInput.value.trim();
                        } else {
                            return;
                        }
                    } else {
                        newMapStyle = radio.value;
                    }
                    this.updateMapStyle(newMapStyle);
                });
            });
        }

        if (customInput) {
            customInput.addEventListener('input', () => {
                if (customRadio && customRadio.checked && customInput.value.trim()) {
                    this.updateMapStyle(customInput.value.trim());
                }
            });
            customInput.disabled = !(customRadio && customRadio.checked);
        }

        const cancelBtn = this.mapStyleDialog.querySelector('button[type="button"]') as HTMLButtonElement | null;
        cancelBtn?.addEventListener('click', () => {
            if (this.originalMapStyle) {
                this.updateMapStyle(this.originalMapStyle);
            }
            this.mapStyleDialog?.close();
        });

        this.mapStyleDialog.addEventListener('click', (e) => {
            if (e.target === this.mapStyleDialog) {
                this.saveCurrentMapStyle();
                this.mapStyleDialog?.close();
            }
        });

        const form = this.mapStyleDialog.querySelector('form') as HTMLFormElement | null;
        form?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveCurrentMapStyle();
            this.mapStyleDialog?.close();
        });
    }

    private showConfigSelectorDialog() {
        if (!this.configSelectorDialog) return;
        this.configSelectorDialog.showModal();
    }

    private createConfigSelectorDialog() {
    this.configSelectorDialog = document.createElement("dialog");
    this.configSelectorDialog.id = "config-selector-dialog";
    this.configSelectorDialog.className = "dialog-menu";

        const form = document.createElement("form");
        form.method = "dialog";

        const title = document.createElement("h2");
        title.textContent = this.options.text?.customConfigTitle ?? "Load configuration";

    const container = document.createElement("div");
    container.className = "map-styles-container";

        const available = (this.options as any)?.availableConfigs || [];
        const current = (this.options as any)?.selectedConfig || null;

        if (available.length === 0) {
            const p = document.createElement("p");
            p.textContent = "No default configurations available.";
            container.appendChild(p);
        } else {
            available.forEach((name: string) => {
                const row = document.createElement("div");
                row.className = "map-style-option";

                const radio = document.createElement("input");
                radio.type = "radio";
                radio.name = "config";
                radio.value = name;
                radio.id = `config-${name}`;
                if (current === name) radio.checked = true;

                const label = document.createElement("label");
                label.htmlFor = radio.id;
                label.textContent = name;

                row.appendChild(radio);
                row.appendChild(label);
                container.appendChild(row);
            });
        }

        const buttonsDiv = document.createElement("div");
        buttonsDiv.className = "dialog-buttons";

        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.textContent = this.options.text?.mapStyleCancel ?? "Cancel";

        const saveBtn = document.createElement("button");
        saveBtn.type = "submit";
        saveBtn.textContent = this.options.text?.mapStyleSave ?? "Apply";

        buttonsDiv.appendChild(cancelBtn);
        buttonsDiv.appendChild(saveBtn);

        form.appendChild(title);
        form.appendChild(container);
        form.appendChild(buttonsDiv);

        this.configSelectorDialog.appendChild(form);
        document.body.appendChild(this.configSelectorDialog);

        cancelBtn.addEventListener("click", () => {
            this.configSelectorDialog?.close();
        });

        this.configSelectorDialog.addEventListener("click", (e) => {
            if (e.target === this.configSelectorDialog) {
                this.configSelectorDialog?.close();
            }
        });

        form.addEventListener("submit", (e) => {
            e.preventDefault();
            const selected = Array.from(this.configSelectorDialog!.querySelectorAll('input[name="config"]'))
                .find((i: any) => (i as HTMLInputElement).checked) as HTMLInputElement | undefined;
            if (selected) {
                try {
                    window.localStorage.setItem("selectedConfig", selected.value);
                } catch (err) {
                    console.error("Error saving selected config", err);
                }
                try {
                    localStorage.removeItem(RandomChooserMap.SETTINGS_STORAGE_KEY);
                } catch (err) {
                    console.error("Error clearing settings from localStorage", err);
                }
                // reload to apply selected config
                window.location.reload();
            } else {
                this.configSelectorDialog?.close();
            }
        });
    }

    private showEditWeightsDialog() {
        if (!this.editWeightsDialog) return;

        const weightsContainer = this.editWeightsDialog.querySelector(".weights-container") as HTMLElement;
        if (!weightsContainer) return;

        weightsContainer.innerHTML = "";

        const settings = this.loadSettings();

        this.choices.forEach(choice => {
            const weightRow = document.createElement("div");
            weightRow.className = "weight-row";

            const nameLabel = document.createElement("label");
            nameLabel.textContent = choice.name;
            nameLabel.className = "weight-label";

            const savedRestaurant = settings.restaurants.find(r => r.name === choice.name);
            const currentWeight = savedRestaurant?.weight || 1;

            const weightInput = document.createElement("input");
            weightInput.type = "number";
            weightInput.min = "0";
            weightInput.step = "1";
            weightInput.value = currentWeight.toString();
            weightInput.className = "weight-input";
            weightInput.dataset.restaurantName = choice.name;

            weightRow.appendChild(nameLabel);
            weightRow.appendChild(weightInput);
            weightsContainer.appendChild(weightRow);
        });

        this.editWeightsDialog.showModal();
    }

    private saveWeightsFromDialog() {
        if (!this.editWeightsDialog) return;

        const weightInputs = this.editWeightsDialog.querySelectorAll(".weight-input") as NodeListOf<HTMLInputElement>;
        const settings = this.loadSettings();
        
        const updatedRestaurants = settings.restaurants.map(restaurant => {
            const input = Array.from(weightInputs).find(inp => inp.dataset.restaurantName === restaurant.name);
            const weight = input ? (parseInt(input.value) || 1) : (restaurant.weight || 1);
            return { ...restaurant, weight };
        });

        this.updateSettings({ restaurants: updatedRestaurants });
        this.addRandomChoiceControls();
        this.addInteractions();
    }

    private showMapStyleDialog() {
        if (!this.mapStyleDialog) return;

        // Save current map style to revert if needed
        const settings = this.loadSettings();
        this.originalMapStyle = settings.mapStyle 
            || this.options.view?.mapStyle 
            || "https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png";

        this.mapStyleDialog.showModal();
    }

    private saveCurrentMapStyle() {
        if (!this.map) return;
        
        let currentMapStyle: string | null = null;
        
        this.map.eachLayer((layer) => {
            if (layer instanceof Leaflet.TileLayer) {
                // @ts-ignore - private property
                currentMapStyle = layer._url || null;
            }
        });
        
        if (currentMapStyle) {
            const settings = this.loadSettings();
            this.updateSettings({ ...settings, mapStyle: currentMapStyle });
        }
    }

    private updateMapStyle(newStyleUrl: string) {
        if (!this.map) return;

        this.map.eachLayer((layer) => {
            if (layer instanceof Leaflet.TileLayer) {
                this.map?.removeLayer(layer);
            }
        });

        Leaflet.tileLayer(newStyleUrl, {
            attribution: "© OpenStreetMap contributors"
        }).addTo(this.map);
    }

    private createActionChoiceDialog() {
        this.actionChoiceDialog = document.createElement("dialog");
        this.actionChoiceDialog.id = "action-choice-dialog";

        const form = document.createElement("form");
        form.method = "dialog";

        const title = document.createElement("h2");
        title.textContent = this.options.text?.mapClickChoiceTitle ?? "What do you want to do?";

        const addRestaurantBtn = document.createElement("button");
        addRestaurantBtn.type = "button";
        addRestaurantBtn.className = "action-choice-btn";
        addRestaurantBtn.textContent = this.options.text?.mapClickAddRestaurant ?? "Add a restaurant";
        addRestaurantBtn.addEventListener("click", () => {
            this.actionChoiceDialog?.close();
            this.openAddRestaurantDialogAtLocation();
        });

        const moveOriginBtn = document.createElement("button");
        moveOriginBtn.type = "button";
        moveOriginBtn.className = "action-choice-btn";
        moveOriginBtn.textContent = this.options.text?.mapClickMoveOrigin ?? "Move the starting point";
        moveOriginBtn.addEventListener("click", () => {
            this.actionChoiceDialog?.close();
            this.moveOriginToLocation();
        });

        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.className = "action-choice-btn cancel";
        cancelBtn.textContent = this.options.text?.mapClickCancel ?? "Cancel";
        cancelBtn.addEventListener("click", () => {
            this.actionChoiceDialog?.close();
            this.cancelLocationSelection();
        });

        form.appendChild(title);
        form.appendChild(addRestaurantBtn);
        form.appendChild(moveOriginBtn);
        form.appendChild(cancelBtn);

        this.actionChoiceDialog.appendChild(form);
        document.body.appendChild(this.actionChoiceDialog);

        this.actionChoiceDialog.addEventListener("click", (e) => {
            if (e.target === this.actionChoiceDialog) {
                this.cancelLocationSelection();
                this.actionChoiceDialog?.close();
            }
        });
    }

    private addMapClickHandler() {
        this.map?.on("click", (e: Leaflet.LeafletMouseEvent) => {
            const { lat, lng } = e.latlng;
            if (this.tempMarker) {
                this.map?.removeLayer(this.tempMarker);
            }
            
            this.tempMarker = Leaflet.marker([lat, lng], {
                icon: Leaflet.icon({
                    iconUrl: this.options.style?.randomMarker || "/src/assets/restaurant.png",
                    iconSize: [32, 32],
                    popupAnchor: [0, -16]
                })
            }).addTo(this.map!);

            this.actionChoiceDialog?.showModal();
        });
    }

    private openAddRestaurantDialogAtLocation() {
        if (!this.tempMarker || !this.addRestaurantDialog) return;

        const position = this.tempMarker.getLatLng();
        
        const latInput = this.addRestaurantDialog.querySelector("#restaurant-lat") as HTMLInputElement;
        const lngInput = this.addRestaurantDialog.querySelector("#restaurant-lng") as HTMLInputElement;
        const locationInfo = this.addRestaurantDialog.querySelector("#location-info") as HTMLElement;

        if (latInput) latInput.value = position.lat.toString();
        if (lngInput) lngInput.value = position.lng.toString();
        if (locationInfo) {
            const selectedText = this.options.text?.formRestaurantLocationSelected ?? "Selected position: ";
            locationInfo.textContent = `${selectedText}${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`;
            locationInfo.style.color = "#28a745";
            locationInfo.style.borderColor = "#28a745";
            locationInfo.style.backgroundColor = "#f8fff9";
        }

        this.addRestaurantDialog.showModal();
    }

    private moveOriginToLocation() {
        if (!this.tempMarker) return;

        const position = this.tempMarker.getLatLng();
        
        if (this.originMarker) {
            this.originMarker.setLatLng(position);
        }
        
        this.currentOriginPosition = position;
        this.saveOriginPosition();
        
        this.map?.setView(position, this.map.getZoom());
        
        this.map?.removeLayer(this.tempMarker);
        this.tempMarker = null;
    }

    private exportData() {
        try {
            const settings = this.loadSettings();

            const origin = settings.originPosition || (this.currentOriginPosition ? { lat: this.currentOriginPosition.lat, lng: this.currentOriginPosition.lng } : null);
            const zoom = this.map ? this.map.getZoom() : (this.options.view?.zoom ?? null);
            const mapStyle = settings.mapStyle || this.options.view?.mapStyle || null;
            const language = (this.options as any)?.language || null;

            const defaultRestaurants = (settings.restaurants || []).map(r => {
                const base: any = {
                    name: r.name,
                    location: { lat: r.location.lat, long: r.location.long }
                };
                if (r.weight !== undefined) {
                    base.weight = r.weight;
                }
                if (r.address && String(r.address).trim() !== "") {
                    base.address = r.address;
                }
                return base;
            });

            const exportObject: any = {
                initialLat: origin ? origin.lat : (this.options.view?.origin ? this.options.view.origin.lat : null),
                initialLng: origin ? origin.lng : (this.options.view?.origin ? this.options.view.origin.lon : null),
                initialZoom: zoom,
                language: language,
                mapStyle: mapStyle,
                defaultRestaurants: defaultRestaurants,
            };

            const dataStr = JSON.stringify(exportObject, null, 2);
            const dataBlob = new Blob([dataStr], { type: "application/json" });

            const link = document.createElement("a");
            link.href = URL.createObjectURL(dataBlob);
            link.download = `exported-config-${new Date().toISOString().split("T")[0]}.json`;

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);

            alert(this.options.text?.exportSuccess ?? "Data exported successfully!");

        } 
        catch (error) {
            console.error("Export error:", error);
            alert("Error during export");
        }
    }

    private exportViaUrl() {
        try {
            const settings = this.loadSettings();

            const params = new URLSearchParams();
            
            if (settings.restaurants && settings.restaurants.length > 0) {
                const restaurantsData = settings.restaurants.map(r => ({
                    n: r.name,
                    a: r.address,
                    lt: r.location.lat,
                    lg: r.location.long,
                    ...(r.weight !== undefined && r.weight !== 1 ? { w: r.weight } : {})
                }));
                params.set("r", JSON.stringify(restaurantsData));
            }

            if (settings.originPosition) {
                params.set("o", `${settings.originPosition.lat},${settings.originPosition.lng}`);
            }

            if (settings.weightsEnabled !== undefined) {
                params.set("we", settings.weightsEnabled ? "1" : "0");
            }

            const baseUrl = window.location.origin + window.location.pathname;
            const url = `${baseUrl}?${params.toString()}`;

            navigator.clipboard.writeText(url).then(() => {
                alert(this.options.text?.urlExportSuccess ?? "URL generated successfully! Copied to clipboard.");
            }).catch(() => {
                const textArea = document.createElement("textarea");
                textArea.value = url;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand("copy");
                document.body.removeChild(textArea);
                alert(this.options.text?.urlExportSuccess ?? "URL generated successfully! Copied to clipboard.");
            });

        } catch (error) {
            console.error("URL export error:", error);
            alert("Error during URL export");
        }
    }

    private parseUrlParameters() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            
            if (urlParams.size === 0) {}

            const settings = this.loadSettings();
            let hasChanges = false;

            const restaurantsParam = urlParams.get("r");
            if (restaurantsParam) {
                try {
                    const restaurantsData = JSON.parse(restaurantsParam);
                    if (Array.isArray(restaurantsData)) {
                        settings.restaurants = restaurantsData.map(r => ({
                            name: r.n,
                            address: r.a || "",
                            location: {
                                lat: r.lt,
                                long: r.lg
                            },
                            weight: r.w !== undefined ? r.w : 1
                        }));
                        hasChanges = true;
                    }
                } catch (e) {
                    console.error("Error parsing restaurants from URL:", e);
                }
            }

            const originParam = urlParams.get("o");
            if (originParam) {
                const [lat, lng] = originParam.split(",").map(Number);
                if (!isNaN(lat) && !isNaN(lng)) {
                    settings.originPosition = { lat, lng };
                    hasChanges = true;
                }
            }

            const weightsEnabledParam = urlParams.get("we");
            if (weightsEnabledParam !== null) {
                settings.weightsEnabled = weightsEnabledParam === "1";
                hasChanges = true;
            }

            if (hasChanges) {
                this.saveSettings(settings);
                this.choices = this.loadRestaurantsFromStorage(this.defaultChoices);
            }

        } catch (error) {
            console.error("Error parsing URL parameters:", error);
        }
    }

    private importData() {
        try {
            const fileInput = document.createElement("input");
            fileInput.type = "file";
            fileInput.accept = ".json";
            fileInput.style.display = "none";

            fileInput.addEventListener("change", (event) => {
                const file = (event.target as HTMLInputElement).files?.[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const importedData = JSON.parse(e.target?.result as string);

                        if (!this.validateImportData(importedData)) {
                            alert(this.options.text?.importError ?? "Import error: invalid file");
                            return;
                        }

                        const newSettings: Partial<AppSettings> = {};

                        const restaurantsSource = importedData.defaultRestaurants;
                        if (restaurantsSource) {
                            newSettings.restaurants = restaurantsSource.map((r: any) => ({
                                name: r.name,
                                address: r.address || "",
                                location: { lat: r.location.lat, long: r.location.long },
                                weight: r.weight !== undefined ? r.weight : 1
                            }));
                        }

                        // initial position in config format
                        if (importedData.initialLat !== undefined && importedData.initialLng !== undefined) {
                            newSettings.originPosition = { lat: importedData.initialLat, lng: importedData.initialLng };
                            this.currentOriginPosition = Leaflet.latLng(importedData.initialLat, importedData.initialLng);
                            if (this.originMarker) {
                                this.originMarker.setLatLng(this.currentOriginPosition);
                                this.map?.setView(this.currentOriginPosition, this.map.getZoom());
                            }
                        }

                        if (importedData.mapStyle) {
                            newSettings.mapStyle = importedData.mapStyle;
                        }

                        this.updateSettings(newSettings);

                        this.reloadWithImportedData();

                        alert(this.options.text?.importSuccess ?? "Data imported successfully!");

                    } catch (error) {
                        console.error("Import error:", error);
                        alert(this.options.text?.importError ?? "Import error: invalid file");
                    }
                };

                reader.readAsText(file);
            });

            document.body.appendChild(fileInput);
            fileInput.click();
            document.body.removeChild(fileInput);

        } catch (error) {
            console.error("Import setup error:", error);
            alert("Error during import setup");
        }
    }

    private validateImportData(data: any): boolean {
        if (!data || typeof data !== "object") return false;
        const restaurantsArray = data.defaultRestaurants;
        if (restaurantsArray && Array.isArray(restaurantsArray)) {
            for (const restaurant of restaurantsArray) {
                if (!restaurant.name || !restaurant.location || 
                    typeof restaurant.location.lat !== "number" ||
                    typeof restaurant.location.long !== "number") {
                    return false;
                }
            }
        }

        if (data.weights && typeof data.weights !== "object") {
            return false;
        }

        return true;
    }

    private reloadWithImportedData() {
        for (const marker of this.markerCache.values()) {
            if (this.map) {
                this.map.removeLayer(marker);
            }
        }
        this.markerCache.clear();
        this.controlCache.clear();

        this.choices = this.loadRestaurantsFromStorage(this.defaultChoices);

        this.addRandomChoiceMarkers();
        this.addRandomChoiceControls();
        this.addInteractions();
    }

    private loadSettings(): AppSettings {
        return _loadSettings();
    }

    private saveSettings(settings: AppSettings) {
        _saveSettings(settings);
    }

    private updateSettings(updates: Partial<AppSettings>) {
        _updateSettings(updates);
    }

    private areWeightsEnabled(): boolean {
        return _areWeightsEnabled();
    }

    private toggleWeights() {
        _toggleWeights();
        this.addRandomChoiceControls();
        this.addInteractions();
    }

    private loadOriginPosition(): Location | null {
        const settings = this.loadSettings();
        if (settings.originPosition) {
            return Location.at(settings.originPosition.lat, settings.originPosition.lng);
        }
        return null;
    }

    private saveOriginPosition() {
        if (this.currentOriginPosition) {
            this.updateSettings({
                originPosition: {
                    lat: this.currentOriginPosition.lat,
                    lng: this.currentOriginPosition.lng
                }
            });
        }
    }
}


export default RandomChooserMap;