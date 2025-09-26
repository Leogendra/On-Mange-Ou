import Leaflet from "leaflet";
import { Location } from "./utils/location";
import { WeightedSet, random as weightedRandom } from "./utils/weighted-random";

export interface RandomChoice {
    name: string;
    description: string;
    location: Location;
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
    };
};

function wait(timeout: number): Promise<void> {
    return new Promise((success, _) => {
        setInterval(success, timeout);
    });
}

class RandomChooserMap {
    private static readonly WEIGHTS_STORAGE_KEY = "weights";

    private choices: RandomChoices;
    private options: RandomChooserMapOptions;
    private map: Leaflet.Map | null = null;

    private markerCache: Map<RandomChoice, Leaflet.Marker> = new Map();
    private controlCache: Map<RandomChoice, HTMLElement> = new Map();

    private alreadyRolled: boolean = false;
    private isSelectingLocation: boolean = false;
    private tempMarker: Leaflet.Marker | null = null;
    private addRestaurantDialog: HTMLDialogElement | null = null;

    public constructor(
        choices: RandomChoices,
        options?: RandomChooserMapOptions
    ) {
        this.choices = choices;
        this.options = options ?? {};
    }

    public async roll() {
        const choicesSet = new Set(this.choices);
        const randomChoice = weightedRandom(this.recoverSavedWeights(choicesSet));
        const randomIndex = this.choices.indexOf(randomChoice);

        const restaurantListElements = document.getElementById("random-chooser-map-control-choices");
        const allClosableElements = document.getElementsByClassName("random-chooser-map-control-choice-closable");
        if (restaurantListElements && restaurantListElements.scrollHeight > restaurantListElements.clientHeight) {
            for (let i = 0; i < allClosableElements.length; i++) {
                (allClosableElements[i] as HTMLElement).classList.add("closed");
            }
        }

        const randomRollNumber = Math.floor(Math.random() * 7) + 3;
        for (let i = 0; i < this.choices.length * randomRollNumber + randomIndex + 1; i++) {
            this.unselectAll();
            this.selectChoice(i % this.choices.length);
            await wait(this.alreadyRolled ? 30 : 100);
        }

        this.controlCache.get(this.choices[randomIndex])?.click();
        this.updateWeight(choicesSet, randomChoice);
        
        if (this.alreadyRolled) { return; } // Let labels closed
        this.alreadyRolled = true;

        await wait(1000);
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
        this.addAddRestaurantControl();
        this.addRandomChoiceControls();
        this.addInteractions();
        this.createAddRestaurantDialog();
    }

    private initOrigin() {
        if (this.options.view !== undefined) {
            const origin = this.options.view.origin ?? Location.at(0, 0);

            this.map!.setView(origin.toTuple(), this.options.view.zoom);

            if (this.options.style?.originMarker !== undefined) {
                this.addMarker(origin, this.options.style.originMarker);
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

        button.addEventListener("click", () => {
            this.roll();
        });

        this.addControl(button, "bottomright");
    }

    private addResetControl() {
        const button = document.createElement("button");

        button.id = "random-chooser-map-control-reset";

        button.innerText = this.options.text?.resetAction ?? "Reset";

        button.addEventListener("click", () => {
            this.resetWeights();
        });

        this.addControl(button, "bottomleft");
    }

    private addAddRestaurantControl() {
        const button = document.createElement("button");

        button.id = "random-chooser-map-control-add";
        button.innerText = "+";
        button.title = "Ajouter un restaurant";

        button.addEventListener("click", () => {
            if (this.addRestaurantDialog) {
                this.startLocationSelection();
                this.addRestaurantDialog.showModal();
            }
        });

        this.addControl(button, "topleft");
    }

    private addRandomChoiceControls() {
        const existing = document.getElementById("random-chooser-map-control-choices");
        if (existing !== null) { existing.remove(); }

        const container = document.createElement("aside");
        container.id = "random-chooser-map-control-choices";
        container.addEventListener("wheel", (e) => e.stopImmediatePropagation());
        container.addEventListener("scroll", (e) => e.stopImmediatePropagation());

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
            weightElement.innerText = `Weight: ${weight}`;

            // Bouton de suppression
            const deleteButton = document.createElement("button");
            deleteButton.classList.add("random-chooser-map-control-choice-delete");
            deleteButton.innerHTML = "×";
            deleteButton.title = "Supprimer ce restaurant";
            deleteButton.addEventListener("click", (e) => {
                e.stopPropagation();
                this.deleteRestaurant(choice);
            });

            // Container pour le titre et le bouton de suppression
            const titleContainer = document.createElement("div");
            titleContainer.classList.add("random-chooser-map-control-choice-title-container");
            titleContainer.appendChild(titleElement);
            titleContainer.appendChild(deleteButton);

            const item = document.createElement("div");
            item.classList.add("random-chooser-map-control-choice");
            item.appendChild(titleContainer);
            item.appendChild(descriptionElement);
            item.appendChild(weightElement);

            container.appendChild(item);

            // const index = this.choices.indexOf(choice);
            // if (index !== this.choices.length - 1) {
            // 	container.appendChild(document.createElement("hr"));
            // }

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
        const rawWeights = localStorage.getItem(
            RandomChooserMap.WEIGHTS_STORAGE_KEY
        );

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

    private updateWeight(items: Set<RandomChoice>, decrement: RandomChoice) {
        const rawWeights = localStorage.getItem(
            RandomChooserMap.WEIGHTS_STORAGE_KEY
        );
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
                }
                else {
                    weights[item.name] = savedWeights[item.name]!;
                }
            }
        }
        else {
            for (const item of items) {
                weights[item.name] = 1;
            }
        }

        for (const [name, weight] of Object.entries(weights)) {
            if (decrement.name === name) { weights[name] = 0; }
            else { weights[name] = weight + 1; }
        }

        localStorage.setItem(
            RandomChooserMap.WEIGHTS_STORAGE_KEY,
            JSON.stringify(weights)
        );
    }

    private resetWeights() {
        localStorage.removeItem(RandomChooserMap.WEIGHTS_STORAGE_KEY);
    }

    private deleteRestaurant(choice: RandomChoice) {
        // Confirmer la suppression
        if (!confirm(`Êtes-vous sûr de vouloir supprimer "${choice.name}" ?`)) {
            return;
        }

        // Supprimer de la liste des choix
        const index = this.choices.indexOf(choice);
        if (index > -1) {
            this.choices.splice(index, 1);
        }

        // Supprimer le marqueur de la carte
        const marker = this.markerCache.get(choice);
        if (marker && this.map) {
            this.map.removeLayer(marker);
            this.markerCache.delete(choice);
        }

        // Supprimer du cache des contrôles
        this.controlCache.delete(choice);

        // Recréer les contrôles pour refléter les changements
        this.addRandomChoiceControls();
        this.addInteractions();

        // Mettre à jour la sauvegarde
        this.saveRestaurantsToStorage();
    }

    private createAddRestaurantDialog() {
        this.addRestaurantDialog = document.createElement("dialog");
        this.addRestaurantDialog.id = "add-restaurant-dialog";

        const form = document.createElement("form");
        form.method = "dialog";

        const title = document.createElement("h2");
        title.textContent = "Ajouter un restaurant";

        const nameGroup = document.createElement("div");
        nameGroup.className = "form-group";
        
        const nameLabel = document.createElement("label");
        nameLabel.htmlFor = "restaurant-name";
        nameLabel.textContent = "Nom du restaurant*:";
        
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
        addressLabel.textContent = "Adresse:";
        
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
        locationLabel.textContent = "Localisation:";
        
        const locationInfo = document.createElement("p");
        locationInfo.id = "location-info";
        locationInfo.textContent = "Cliquez sur la carte pour sélectionner la position";
        
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
        cancelBtn.textContent = "Annuler";
        
        const confirmBtn = document.createElement("button");
        confirmBtn.type = "submit";
        confirmBtn.id = "confirm-add";
        confirmBtn.textContent = "Ajouter";
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

    private startLocationSelection() {
        this.isSelectingLocation = true;
        const locationInfo = this.addRestaurantDialog?.querySelector("#location-info") as HTMLElement;
        if (locationInfo) {
            locationInfo.textContent = "Cliquez sur la carte pour sélectionner la position";
            locationInfo.style.color = "#007bff";
        }

        // Ajouter l'événement de clic sur la carte
        this.map?.on("click", this.onMapClickForLocation.bind(this));
    }

    private onMapClickForLocation(e: Leaflet.LeafletMouseEvent) {
        if (!this.isSelectingLocation) return;

        const { lat, lng } = e.latlng;
        
        // Supprimer le marqueur temporaire précédent
        if (this.tempMarker) {
            this.map?.removeLayer(this.tempMarker);
        }

        // Ajouter un nouveau marqueur temporaire
        this.tempMarker = Leaflet.marker([lat, lng], {
            icon: Leaflet.icon({
                iconUrl: this.options.style?.randomMarker || '/src/assets/restaurant.png',
                iconSize: [32, 32],
                popupAnchor: [0, -16]
            })
        }).addTo(this.map!);

        // Mettre à jour les champs cachés
        const latInput = this.addRestaurantDialog?.querySelector("#restaurant-lat") as HTMLInputElement;
        const lngInput = this.addRestaurantDialog?.querySelector("#restaurant-lng") as HTMLInputElement;
        const locationInfo = this.addRestaurantDialog?.querySelector("#location-info") as HTMLElement;

        if (latInput) latInput.value = lat.toString();
        if (lngInput) lngInput.value = lng.toString();
        if (locationInfo) {
            locationInfo.textContent = `Position sélectionnée: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
            locationInfo.style.color = "#28a745";
        }

        // Déclencher la validation du formulaire
        const confirmBtn = this.addRestaurantDialog?.querySelector("#confirm-add") as HTMLButtonElement;
        const nameInput = this.addRestaurantDialog?.querySelector("#restaurant-name") as HTMLInputElement;
        const addressInput = this.addRestaurantDialog?.querySelector("#restaurant-address") as HTMLInputElement;
        
        if (confirmBtn && nameInput && addressInput) {
            const isValid = nameInput.value.trim() !== "" && 
                           addressInput.value.trim() !== "" && 
                           latInput.value !== "" && 
                           lngInput.value !== "";
            confirmBtn.disabled = !isValid;
        }
    }

    private cancelLocationSelection() {
        this.isSelectingLocation = false;
        
        // Supprimer le marqueur temporaire
        if (this.tempMarker) {
            this.map?.removeLayer(this.tempMarker);
            this.tempMarker = null;
        }

        // Supprimer l'événement de clic sur la carte
        this.map?.off("click", this.onMapClickForLocation.bind(this));
    }

    private validateRestaurantForm(): boolean {
        const nameInput = this.addRestaurantDialog?.querySelector("#restaurant-name") as HTMLInputElement;
        // const addressInput = this.addRestaurantDialog?.querySelector("#restaurant-address") as HTMLInputElement;
        const latInput = this.addRestaurantDialog?.querySelector("#restaurant-lat") as HTMLInputElement;
        const lngInput = this.addRestaurantDialog?.querySelector("#restaurant-lng") as HTMLInputElement;

        return nameInput?.value.trim() !== "" && 
            //    addressInput?.value.trim() !== "" && --- IGNORE ---
               latInput?.value !== "" && 
               lngInput?.value !== "";
    }

    private resetForm() {
        const nameInput = this.addRestaurantDialog?.querySelector("#restaurant-name") as HTMLInputElement;
        const addressInput = this.addRestaurantDialog?.querySelector("#restaurant-address") as HTMLInputElement;
        const latInput = this.addRestaurantDialog?.querySelector("#restaurant-lat") as HTMLInputElement;
        const lngInput = this.addRestaurantDialog?.querySelector("#restaurant-lng") as HTMLInputElement;
        const locationInfo = this.addRestaurantDialog?.querySelector("#location-info") as HTMLElement;
        const confirmBtn = this.addRestaurantDialog?.querySelector("#confirm-add") as HTMLButtonElement;

        if (nameInput) nameInput.value = "";
        if (addressInput) addressInput.value = "";
        if (latInput) latInput.value = "";
        if (lngInput) lngInput.value = "";
        if (confirmBtn) confirmBtn.disabled = true;
        if (locationInfo) {
            locationInfo.textContent = "Cliquez sur la carte pour sélectionner la position";
            locationInfo.style.color = "";
        }
    }

    private addNewRestaurant(name: string, address: string, lat: number, lng: number) {
        const newRestaurant: RandomChoice = {
            name: name,
            description: address,
            location: Location.at(lat, lng)
        };

        // Ajouter le nouveau restaurant à la liste
        this.choices.push(newRestaurant);

        // Ajouter le marqueur sur la carte
        if (this.options.style?.randomMarker) {
            const marker = this.addMarker(
                newRestaurant.location,
                this.options.style.randomMarker,
                newRestaurant.name
            );
            this.markerCache.set(newRestaurant, marker);
        }

        // Recréer les contrôles pour inclure le nouveau restaurant
        this.addRandomChoiceControls();
        this.addInteractions();

        // Optionnel: sauvegarder dans le localStorage pour la persistance
        this.saveRestaurantsToStorage();
    }

    private saveRestaurantsToStorage() {
        const restaurantsData = this.choices.map(choice => ({
            name: choice.name,
            address: choice.description,
            location: {
                lat: choice.location.lat,
                long: choice.location.lon
            }
        }));
        localStorage.setItem('custom-restaurants', JSON.stringify(restaurantsData));
    }
}

export default RandomChooserMap;
