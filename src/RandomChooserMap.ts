import Leaflet from "leaflet";
import { Location } from "./utils/location";
import { WeightedSet, random as weightedRandom } from "./utils/weighted-random";

export interface RandomChoice {
    name: string;
    description: string;
    location: Location;
}

interface AppSettings {
    restaurants: Array<{
        name: string;
        address: string;
        location: {
            lat: number;
            long: number;
        };
    }>;
    weights: { [key: string]: number };
    originPosition?: {
        lat: number;
        lng: number;
    };
    version: string;
}

type RandomChoices = Array<RandomChoice>;

type RandomChooserMapOptions = {
    view?: {
        origin?: Location;
        zoom?: number;
    };
    style?: {
        markerSize?: number;
        originMarker?: string;
        randomMarker?: string;
    };
    text?: {
        rollAction?: string;
        resetAction?: string;
        resetWeights?: string;
        resetRestaurants?: string;
        weightDescription?: string;
        weightResetConfirmation?: string;
        noRestaurant?: string;
        noVisibleRestaurant?: string;
        formAddRestaurant?: string;
        formRestaurantName?: string;
        formRestaurantAddress?: string;
        formRestaurantLocation?: string;
        formRestaurantLocationInfo?: string;
        formRestaurantLocationSelected?: string;
        formRestaurantWeight?: string;
        formAddButton?: string;
        formCancelButton?: string;
        addRestaurantTooltip?: string;
        deleteRestaurantTooltip?: string;
        hideRestaurantTooltip?: string;
        showRestaurantTooltip?: string;
        deleteRestaurantConfirmation?: string;
        resetRestaurantsConfirmation?: string;
        resetWeightsConfirmation?: string;
        weightLabel?: string;
        mapClickChoiceTitle?: string;
        mapClickAddRestaurant?: string;
        mapClickMoveOrigin?: string;
        mapClickCancel?: string;
        formLocationClickToEdit?: string;
        formLocationEditMode?: string;
        settingsAction?: string;
        exportData?: string;
        importData?: string;
        exportSuccess?: string;
        importSuccess?: string;
        importError?: string;
        formLocationCoordinates?: string;
        formLocationCoordinatesPlaceholder?: string;
        coordinatesInvalidFormat?: string;
        editWeights?: string;
        editWeightsTitle?: string;
        editWeightsSave?: string;
        editWeightsCancel?: string;
    };
};

function wait(timeout: number): Promise<void> {
    return new Promise((success, _) => {
        setInterval(success, timeout);
    });
}

class RandomChooserMap {
    private static readonly SETTINGS_STORAGE_KEY = "settings";

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
    private hiddenRestaurants: Set<RandomChoice> = new Set();
    private originMarker: Leaflet.Marker | null = null;
    private actionChoiceDialog: HTMLDialogElement | null = null;
    private currentOriginPosition: Leaflet.LatLng | null = null;

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
        }        const choicesSet = new Set(visibleChoices);
        const randomChoice = weightedRandom(this.recoverSavedWeights(choicesSet));
        const randomIndex = visibleChoices.indexOf(randomChoice);

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
            await wait(this.alreadyRolled ? 30 : 100);
        }

        this.controlCache.get(randomChoice)?.click();
        this.updateWeight(choicesSet, randomChoice);

        await wait(1000);
        if (addButton !== null) { addButton.style.display = "flex"; }

        this.lockRoll = false;

        if (this.alreadyRolled) { return; } // Let labels closed
        this.alreadyRolled = true;

        for (let i = 0; i < allClosableElements.length; i++) {
            (allClosableElements[i] as HTMLElement).classList.remove("closed");
        }
    }

    public mountOn(root: HTMLElement | string) {
        this.map = Leaflet.map(root);
        this.initOrigin();
        this.addTileSet();
        this.addRandomChoiceMarkers();
        this.addRollControl();
        this.addResetControl();
        this.addRandomChoiceControls();
        this.addInteractions();
        this.createAddRestaurantDialog();
        this.createEditWeightsDialog();
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
        Leaflet.tileLayer(
            "https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png",
            {
                attribution:
                    '&copy; <a href="https://openstreetmap.fr">OpenStreetMap France</a>',
                minZoom: 1,
                maxZoom: 20
            }
        ).addTo(this.map!);
    }

    private addRandomChoiceMarkers() {
        if (this.options.style?.randomMarker !== undefined) {
            for (const choice of this.choices) {
                const marker = this.addMarker(
                    choice.location,
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

    private addResetControl() {
        const button = document.createElement("button");

        button.id = "random-chooser-map-control-reset";
        button.innerText = this.options.text?.settingsAction ?? "Settings";

        button.addEventListener("click", (e) => {
            e.stopPropagation();
            this.showSettingsMenu(button);
        });

        this.addControl(button, "bottomleft");
    }

    private showSettingsMenu(button: HTMLElement) {
        const menu = document.createElement("div");
        menu.className = "reset-menu";

        const resetWeightsOption = document.createElement("button");
        resetWeightsOption.textContent = this.options.text?.resetWeights ?? "Reset weights";
        resetWeightsOption.className = "reset-menu-item";
        resetWeightsOption.addEventListener("click", (e) => {
            e.stopPropagation();
            this.resetWeights();
            document.body.removeChild(menu);
        });

        const resetRestaurantsOption = document.createElement("button");
        resetRestaurantsOption.textContent = this.options.text?.resetRestaurants ?? "Reset restaurants";
        resetRestaurantsOption.className = "reset-menu-item";
        resetRestaurantsOption.addEventListener("click", (e) => {
            e.stopPropagation();
            this.resetToDefaultRestaurants();
            document.body.removeChild(menu);
        });

        const exportDataOption = document.createElement("button");
        exportDataOption.textContent = this.options.text?.exportData ?? "📤 Export data";
        exportDataOption.className = "reset-menu-item";
        exportDataOption.addEventListener("click", (e) => {
            e.stopPropagation();
            this.exportData();
            document.body.removeChild(menu);
        });

        const importDataOption = document.createElement("button");
        importDataOption.textContent = this.options.text?.importData ?? "📥 Import data";
        importDataOption.className = "reset-menu-item";
        importDataOption.addEventListener("click", (e) => {
            e.stopPropagation();
            this.importData();
            document.body.removeChild(menu);
        });

        const editWeightsOption = document.createElement("button");
        editWeightsOption.textContent = this.options.text?.editWeights ?? "⚖️ Edit weights";
        editWeightsOption.className = "reset-menu-item";
        editWeightsOption.addEventListener("click", (e) => {
            e.stopPropagation();
            this.showEditWeightsDialog();
            document.body.removeChild(menu);
        });

        menu.appendChild(exportDataOption);
        menu.appendChild(importDataOption);
        menu.appendChild(editWeightsOption);
        menu.appendChild(resetWeightsOption);
        menu.appendChild(resetRestaurantsOption);

        const rect = button.getBoundingClientRect();
        menu.style.position = "fixed";
        menu.style.left = rect.right + "px";
        menu.style.bottom = (window.innerHeight - rect.top) + "px";

        document.body.appendChild(menu);

        menu.addEventListener("click", (e) => {
            e.stopPropagation();
        });

        const closeMenu = (e: MouseEvent) => {
            if (!menu.contains(e.target as Node) && !button.contains(e.target as Node)) {
                document.body.removeChild(menu);
                document.removeEventListener("click", closeMenu);
            }
        };
        setTimeout(() => document.addEventListener("click", closeMenu), 0);
    }

    private addAddRestaurantCard() {
        const buttonContainer = document.createElement("div");
        buttonContainer.classList.add("random-chooser-map-control-choice", "add");
        buttonContainer.id = "button-add-restaurant";

        const buttonTitle = document.createElement("div");
        buttonTitle.classList.add("random-chooser-map-control-choice-title-container");
        buttonTitle.innerText = "+";
        buttonTitle.title = this.options.text?.addRestaurantTooltip ?? "Add a restaurant";

        buttonContainer.appendChild(buttonTitle);
        buttonContainer.addEventListener("click", (e) => {
            e.stopPropagation();
            if (this.addRestaurantDialog) {
                this.addRestaurantDialog.showModal();
            }
        });

        return buttonContainer;
    }

    private addResetRestaurantCard() {
        const buttonContainer = document.createElement("div");
        buttonContainer.classList.add("random-chooser-map-control-choice", "reset");

        const buttonTitle = document.createElement("div");
        buttonTitle.classList.add("random-chooser-map-control-choice-title-container");
        buttonTitle.innerText = this.options.text?.resetRestaurants ?? "Reset restaurants";

        buttonContainer.appendChild(buttonTitle);
        buttonContainer.addEventListener("click", (e) => {
            e.stopPropagation();
            this.resetToDefaultRestaurants();
        });

        return buttonContainer;
    }

    private addRandomChoiceControls() {
        const existing = document.getElementById("random-chooser-map-control-choices");
        if (existing !== null) { existing.remove(); }

        const container = document.createElement("aside");
        container.id = "random-chooser-map-control-choices";
        container.addEventListener("wheel", (e) => e.stopImmediatePropagation());
        container.addEventListener("scroll", (e) => e.stopImmediatePropagation());

        if (this.choices.length < 1) {
            const resetRestaurantCard = this.addResetRestaurantCard()
            container.appendChild(resetRestaurantCard);
        }

        for (const choice of this.choices) {
            const weight = this.recoverSavedWeights(new Set([choice])).values().next().value?.weight;

            const titleElement = document.createElement("h2");
            titleElement.classList.add("random-chooser-map-control-choice-title");
            titleElement.innerText = choice.name;

            const descriptionElement = document.createElement("h3");
            descriptionElement.classList.add("random-chooser-map-control-choice-description");
            descriptionElement.classList.add("random-chooser-map-control-choice-closable");
            descriptionElement.innerText = choice.description;

            const weightElement = document.createElement("h3");
            weightElement.classList.add("random-chooser-map-control-choice-weight");
            weightElement.classList.add("random-chooser-map-control-choice-closable");
            weightElement.innerText = `${this.options.text?.weightLabel ?? "Weight:"} ${weight}`;

            const deleteButton = document.createElement("button");
            deleteButton.classList.add("random-chooser-map-control-choice-delete");
            deleteButton.innerHTML = "×";
            deleteButton.title = this.options.text?.deleteRestaurantTooltip ?? "Delete this restaurant";
            deleteButton.addEventListener("click", (e) => {
                e.stopPropagation();
                this.deleteRestaurant(choice);
            });

            const hideButton = document.createElement("button");
            hideButton.classList.add("random-chooser-map-control-choice-hide");
            hideButton.innerHTML = "−";
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

            const item = document.createElement("div");
            item.classList.add("random-chooser-map-control-choice");
            item.appendChild(titleContainer);
            item.appendChild(descriptionElement);
            item.appendChild(weightElement);

            container.appendChild(item);

            this.controlCache.set(choice, item);
        }

        this.addControl(container, "topright");
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
    ): Leaflet.Control {
        const ExtendedControl = Leaflet.Control.extend({
            onAdd: (_: any) => element
        });
        const control = new ExtendedControl({ position }).addTo(this.map!);
        return control;
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
        const weights: WeightedSet<RandomChoice> = new Set();
        const settings = this.loadSettings();

        for (const item of items) {
            weights.add({
                value: item,
                weight: 1
            });
        }

        if (settings.weights) {
            for (const [name, weight] of Object.entries(settings.weights)) {
                for (const item of weights) {
                    if (item.value.name === name) {
                        item.weight = weight;
                    }
                }
            }
        }

        return weights;
    }

    private updateWeight(items: Set<RandomChoice>, decrement: RandomChoice) {
        const settings = this.loadSettings();
        let weights: { [key: string]: number } = { ...settings.weights };

        for (const item of items) {
            if (weights[item.name] === undefined) {
                weights[item.name] = 1;
            }
        }

        for (const [name, weight] of Object.entries(weights)) {
            if (decrement.name === name) { 
                weights[name] = 0; 
            } else { 
                weights[name] = weight + 1; 
            }
        }


        this.updateSettings({ weights });
    }

    private resetWeights() {
        const confirmMessage = this.options.text?.resetWeightsConfirmation ?? "Are you sure you want to reset all restaurant weights?";
        if (confirm(confirmMessage)) {
            this.updateSettings({ weights: {} });
        }
    }

    private resetToDefaultRestaurants() {
        const confirmMessage = this.options.text?.resetRestaurantsConfirmation ?? "Are you sure you want to reset all restaurants to default values? This will remove all added restaurants.";
        if (confirm(confirmMessage)) {
            for (const marker of this.markerCache.values()) {
                if (this.map) {
                    this.map.removeLayer(marker);
                }
            }
            this.markerCache.clear();
            this.controlCache.clear();

            this.choices = [...this.defaultChoices];


            this.updateSettings({ restaurants: [] });

            this.addRandomChoiceMarkers();
            this.addRandomChoiceControls();
            this.addInteractions();
            this.saveRestaurantsToStorage();
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

    private createAddRestaurantDialog() {
        this.addRestaurantDialog = document.createElement("dialog");
        this.addRestaurantDialog.id = "add-restaurant-dialog";

        const form = document.createElement("form");
        form.method = "dialog";

        const title = document.createElement("h2");
        title.textContent = this.options.text?.formAddRestaurant ?? "Add a restaurant";

        const nameGroup = document.createElement("div");
        nameGroup.className = "form-group";
        
        const nameLabel = document.createElement("label");
        nameLabel.htmlFor = "restaurant-name";
        nameLabel.textContent = this.options.text?.formRestaurantName ?? "Restaurant name:";
        
        const nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.id = "restaurant-name";
        nameInput.name = "restaurant-name";
        nameInput.required = true;

        nameGroup.appendChild(nameLabel);
        nameGroup.appendChild(nameInput);

        const addressGroup = document.createElement("div");
        addressGroup.className = "form-group";
        
        const addressLabel = document.createElement("label");
        addressLabel.htmlFor = "restaurant-address";
        addressLabel.textContent = this.options.text?.formRestaurantAddress ?? "Address:";
        
        const addressInput = document.createElement("input");
        addressInput.type = "text";
        addressInput.id = "restaurant-address";
        addressInput.name = "restaurant-address";
        addressInput.required = false;

        addressGroup.appendChild(addressLabel);
        addressGroup.appendChild(addressInput);

        const locationGroup = document.createElement("div");
        locationGroup.className = "form-group";
        
        const locationLabel = document.createElement("label");
        locationLabel.textContent = this.options.text?.formLocationCoordinates ?? "Coordinates:";

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

        const latInput = document.createElement("input");
        latInput.type = "hidden";
        latInput.id = "restaurant-lat";
        latInput.name = "restaurant-lat";

        const lngInput = document.createElement("input");
        lngInput.type = "hidden";
        lngInput.id = "restaurant-lng";
        lngInput.name = "restaurant-lng";

        locationGroup.appendChild(locationLabel);
        locationGroup.appendChild(locationInfo);
        locationGroup.appendChild(latInput);
        locationGroup.appendChild(lngInput);

        const buttonsDiv = document.createElement("div");
        buttonsDiv.className = "dialog-buttons";
        
        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.id = "cancel-add";
        cancelBtn.textContent = this.options.text?.formCancelButton ?? "Cancel";
        
        const confirmBtn = document.createElement("button");
        confirmBtn.type = "submit";
        confirmBtn.id = "confirm-add";
        confirmBtn.textContent = this.options.text?.formAddButton ?? "Add";
        confirmBtn.disabled = true;

        buttonsDiv.appendChild(cancelBtn);
        buttonsDiv.appendChild(confirmBtn);

        form.appendChild(title);
        form.appendChild(nameGroup);
        form.appendChild(addressGroup);
        form.appendChild(locationGroup);
        form.appendChild(buttonsDiv);

        this.addRestaurantDialog.appendChild(form);

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

        const form = this.addRestaurantDialog.querySelector('form') as HTMLFormElement;
        form?.addEventListener('submit', (e) => {
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
            
            if (latDir === 'S') lat = -lat;
            if (lngDir === 'W') lng = -lng;
            
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
            description: address,
            location: Location.at(lat, lng)
        };

        this.choices.push(newRestaurant);

        if (this.options.style?.randomMarker) {
            const marker = this.addMarker(
                newRestaurant.location,
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
                return settings.restaurants.map((r: any) => ({
                    name: r.name,
                    description: r.address,
                    location: Location.at(r.location.lat, r.location.long)
                }));
            }
        } catch (error) {
            console.warn(`Error while loading restaurants from settings: ${error}`);
        }

        this.saveRestaurantsToStorageInternal(defaultChoices);
        return [...defaultChoices];
    }

    private saveRestaurantsToStorage() {
        this.saveRestaurantsToStorageInternal(this.choices);
    }

    private saveRestaurantsToStorageInternal(choices: RandomChoices) {
        const restaurantsData = choices.map(choice => ({
            name: choice.name,
            address: choice.description,
            location: {
                lat: choice.location.lat,
                long: choice.location.lon
            }
        }));
        this.updateSettings({ restaurants: restaurantsData });
    }

    private createEditWeightsDialog() {
        this.editWeightsDialog = document.createElement("dialog");
        this.editWeightsDialog.id = "edit-weights-dialog";

        const form = document.createElement("form");
        form.method = "dialog";

        const title = document.createElement("h2");
        title.textContent = this.options.text?.editWeightsTitle ?? "Edit restaurant weights";

        const weightsContainer = document.createElement("div");
        weightsContainer.className = "weights-container";

        const buttonsDiv = document.createElement("div");
        buttonsDiv.className = "dialog-buttons";
        
        const cancelBtn = document.createElement("button");
        cancelBtn.type = "button";
        cancelBtn.id = "cancel-edit-weights";
        cancelBtn.textContent = this.options.text?.editWeightsCancel ?? "Cancel";
        
        const saveBtn = document.createElement("button");
        saveBtn.type = "submit";
        saveBtn.id = "save-edit-weights";
        saveBtn.textContent = this.options.text?.editWeightsSave ?? "Save";

        buttonsDiv.appendChild(cancelBtn);
        buttonsDiv.appendChild(saveBtn);

        form.appendChild(title);
        form.appendChild(weightsContainer);
        form.appendChild(buttonsDiv);

        this.editWeightsDialog.appendChild(form);
        document.body.appendChild(this.editWeightsDialog);

        // Event listeners
        cancelBtn.addEventListener("click", () => {
            this.editWeightsDialog?.close();
        });

        this.editWeightsDialog.addEventListener("click", (e) => {
            if (e.target === this.editWeightsDialog) {
                this.editWeightsDialog?.close();
            }
        });

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveWeightsFromDialog();
            this.editWeightsDialog?.close();
        });
    }

    private showEditWeightsDialog() {
        if (!this.editWeightsDialog) return;

        const weightsContainer = this.editWeightsDialog.querySelector(".weights-container") as HTMLElement;
        if (!weightsContainer) return;

        // Clear existing content
        weightsContainer.innerHTML = "";

        const settings = this.loadSettings();
        const currentWeights = settings.weights || {};

        // Create weight inputs for each restaurant
        this.choices.forEach(choice => {
            const weightRow = document.createElement("div");
            weightRow.className = "weight-row";

            const nameLabel = document.createElement("label");
            nameLabel.textContent = choice.name;
            nameLabel.className = "weight-label";

            const weightInput = document.createElement("input");
            weightInput.type = "number";
            weightInput.min = "0";
            weightInput.step = "1";
            weightInput.value = (currentWeights[choice.name] || 1).toString();
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
        const newWeights: { [key: string]: number } = {};

        weightInputs.forEach(input => {
            const restaurantName = input.dataset.restaurantName;
            const weight = parseInt(input.value) || 1;
            if (restaurantName) {
                newWeights[restaurantName] = weight;
            }
        });

        this.updateSettings({ weights: newWeights });
        
        // Update the displayed weights in the controls
        this.addRandomChoiceControls();
        this.addInteractions();
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
                    iconUrl: this.options.style?.randomMarker || '/src/assets/restaurant.png',
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

            const exportObject = {
                restaurants: settings.restaurants || [],
                weights: settings.weights || {},
                originPosition: settings.originPosition || null,
                exportDate: new Date().toISOString(),
                version: "1.0"
            };

            const dataStr = JSON.stringify(exportObject, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });

            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `restaurants-data-${new Date().toISOString().split('T')[0]}.json`;

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);

            alert(this.options.text?.exportSuccess ?? "Data exported successfully!");

        } catch (error) {
            console.error("Export error:", error);
            alert("Error during export");
        }
    }

    private importData() {
        try {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.json';
            fileInput.style.display = 'none';

            fileInput.addEventListener('change', (event) => {
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
                        
                        if (importedData.restaurants) {
                            newSettings.restaurants = importedData.restaurants;
                        }
                        if (importedData.weights) {
                            newSettings.weights = importedData.weights;
                        }
                        if (importedData.originPosition) {
                            newSettings.originPosition = importedData.originPosition;
                            
                            this.currentOriginPosition = Leaflet.latLng(importedData.originPosition.lat, importedData.originPosition.lng);
                            if (this.originMarker) {
                                this.originMarker.setLatLng(this.currentOriginPosition);
                                this.map?.setView(this.currentOriginPosition, this.map.getZoom());
                            }
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
        if (!data || typeof data !== 'object') return false;

        if (data.restaurants && Array.isArray(data.restaurants)) {
            for (const restaurant of data.restaurants) {
                if (!restaurant.name || !restaurant.location || 
                    typeof restaurant.location.lat !== 'number' ||
                    typeof restaurant.location.long !== 'number') {
                    return false;
                }
            }
        }

        if (data.weights && typeof data.weights !== 'object') {
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
        try {
            const saved = localStorage.getItem(RandomChooserMap.SETTINGS_STORAGE_KEY);
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (error) {
            console.warn(`Error loading settings from localStorage: ${error}`);
            localStorage.removeItem(RandomChooserMap.SETTINGS_STORAGE_KEY);
        }
        
        return {
            restaurants: [],
            weights: {},
            version: "1.0"
        };
    }

    private saveSettings(settings: AppSettings) {
        try {
            localStorage.setItem(RandomChooserMap.SETTINGS_STORAGE_KEY, JSON.stringify(settings));
        } catch (error) {
            console.error(`Error saving settings to localStorage: ${error}`);
        }
    }

    private updateSettings(updates: Partial<AppSettings>) {
        const currentSettings = this.loadSettings();
        const newSettings = { ...currentSettings, ...updates };
        this.saveSettings(newSettings);
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
