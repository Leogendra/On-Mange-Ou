export function buildAddRestaurantDialog(texts: any): HTMLDialogElement {
    const dialog = document.createElement("dialog");
    dialog.id = "add-restaurant-dialog";

    const form = document.createElement("form");
    form.method = "dialog";

    const title = document.createElement("h2");
    title.textContent = texts?.formAddRestaurant ?? "Add a restaurant";

    const nameGroup = document.createElement("div");
    nameGroup.className = "form-group";
    const nameLabel = document.createElement("label");
    nameLabel.htmlFor = "restaurant-name";
    nameLabel.textContent = texts?.formRestaurantName ?? "Restaurant name:";
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
    addressLabel.textContent = texts?.formRestaurantAddress ?? "Address:";
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
    locationLabel.textContent = texts?.formLocationCoordinates ?? "Coordinates:";

    const locationInfo = document.createElement("p");
    locationInfo.id = "location-info";
    locationInfo.textContent = texts?.formLocationClickToEdit ?? "Click here to select on the map";
    locationInfo.style.cursor = "pointer";
    locationInfo.style.padding = "0.8rem";
    locationInfo.style.backgroundColor = "#f8f9fa";
    locationInfo.style.border = "2px dashed #ddd";
    locationInfo.style.borderRadius = "0.5rem";
    locationInfo.style.textAlign = "center";
    locationInfo.style.transition = "all 0.3s ease";

    locationGroup.appendChild(locationLabel);
    locationGroup.appendChild(locationInfo);

    const latInput = document.createElement("input");
    latInput.type = "hidden";
    latInput.id = "restaurant-lat";
    latInput.name = "restaurant-lat";

    const lngInput = document.createElement("input");
    lngInput.type = "hidden";
    lngInput.id = "restaurant-lng";
    lngInput.name = "restaurant-lng";

    locationGroup.appendChild(latInput);
    locationGroup.appendChild(lngInput);

    // buttons
    const buttonsDiv = document.createElement("div");
    buttonsDiv.className = "dialog-buttons";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.id = "cancel-add";
    cancelBtn.textContent = texts?.formCancelButton ?? "Cancel";

    const confirmBtn = document.createElement("button");
    confirmBtn.type = "submit";
    confirmBtn.id = "confirm-add";
    confirmBtn.textContent = texts?.formAddButton ?? "Add";
    confirmBtn.disabled = true;

    buttonsDiv.appendChild(cancelBtn);
    buttonsDiv.appendChild(confirmBtn);

    form.appendChild(title);
    form.appendChild(nameGroup);
    form.appendChild(addressGroup);
    form.appendChild(locationGroup);
    form.appendChild(buttonsDiv);

    dialog.appendChild(form);

    return dialog;
}


export function buildEditWeightsDialog(texts: any): HTMLDialogElement {
    const dialog = document.createElement("dialog");
    dialog.id = "edit-weights-dialog";
    dialog.className = "dialog-menu";

    const form = document.createElement("form");
    form.method = "dialog";

    const title = document.createElement("h2");
    title.textContent = texts?.editWeightsTitle ?? "Edit restaurant weights";

    const weightsContainer = document.createElement("div");
    weightsContainer.className = "weights-container";

    const buttonsDiv = document.createElement("div");
    buttonsDiv.className = "dialog-buttons";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.id = "cancel-edit-weights";
    cancelBtn.textContent = texts?.editWeightsCancel ?? "Cancel";

    const saveBtn = document.createElement("button");
    saveBtn.type = "submit";
    saveBtn.id = "save-edit-weights";
    saveBtn.textContent = texts?.editWeightsSave ?? "Save";

    buttonsDiv.appendChild(cancelBtn);
    buttonsDiv.appendChild(saveBtn);

    form.appendChild(title);
    form.appendChild(weightsContainer);
    form.appendChild(buttonsDiv);

    dialog.appendChild(form);
    return dialog;
}


export function buildMapStyleDialog(texts: any, currentMapStyle: string | null, availableStyles: Array<{ name: string, url: string }>): HTMLDialogElement {
    const dialog = document.createElement("dialog");
    dialog.id = "map-style-dialog";
    dialog.className = "dialog-menu";

    const form = document.createElement("form");
    form.method = "dialog";

    const title = document.createElement("h2");
    title.textContent = texts?.mapStyleTitle ?? "Map style";

    const stylesContainer = document.createElement("div");
    stylesContainer.className = "map-styles-container";

    (availableStyles || []).forEach(style => {
        const option = document.createElement("div");
        option.className = "map-style-option";
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = "mapStyle";
        radio.value = style.url;
        radio.id = `style-${style.name.replace(/\s+/g, '-').toLowerCase()}`;
        if (style.url === currentMapStyle) radio.checked = true;

        const label = document.createElement("label");
        label.htmlFor = radio.id;
        label.textContent = style.name;

        option.appendChild(radio);
        option.appendChild(label);
        stylesContainer.appendChild(option);
    });

    const customOption = document.createElement("div");
    customOption.className = "map-style-option";
    const customRadio = document.createElement("input");
    customRadio.type = "radio";
    customRadio.name = "mapStyle";
    customRadio.value = "custom";
    customRadio.id = "style-custom";

    const customLabel = document.createElement("label");
    customLabel.htmlFor = "style-custom";
    customLabel.textContent = texts?.mapStyleCustom ?? "Custom URL";

    const customInput = document.createElement("input");
    customInput.type = "text";
    customInput.id = "custom-map-url";
    customInput.placeholder = "https://example.com/{z}/{x}/{y}.png";
    customInput.className = "custom-url-input";

    if (currentMapStyle && !((availableStyles || []).some(s => s.url === currentMapStyle))) {
        customRadio.checked = true;
        customInput.value = currentMapStyle;
    }

    customOption.appendChild(customRadio);
    customOption.appendChild(customLabel);
    customOption.appendChild(customInput);
    stylesContainer.appendChild(customOption);

    const buttonsDiv = document.createElement("div");
    buttonsDiv.className = "dialog-buttons";
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.textContent = texts?.mapStyleCancel ?? "Cancel";
    const saveBtn = document.createElement("button");
    saveBtn.type = "submit";
    saveBtn.textContent = texts?.mapStyleSave ?? "Apply";
    buttonsDiv.appendChild(cancelBtn);
    buttonsDiv.appendChild(saveBtn);

    form.appendChild(title);
    form.appendChild(stylesContainer);
    form.appendChild(buttonsDiv);
    dialog.appendChild(form);

    return dialog;
}


export function buildConfigSelectorDialog(texts: any, availableConfigs: string[], selectedConfig: string | null): HTMLDialogElement {
    const dialog = document.createElement("dialog");
    dialog.id = "config-selector-dialog";
    dialog.className = "dialog-menu";

    const form = document.createElement("form");
    form.method = "dialog";

    const title = document.createElement("h2");
    title.textContent = texts?.customConfigTitle ?? "Load configuration";

    const container = document.createElement("div");
    container.className = "map-styles-container";

    if (!availableConfigs || availableConfigs.length === 0) {
        const p = document.createElement("p");
        p.textContent = "No default configurations available.";
        container.appendChild(p);
    } else {
        availableConfigs.forEach(name => {
            const row = document.createElement("div");
            row.className = "map-style-option";

            const radio = document.createElement("input");
            radio.type = "radio";
            radio.name = "config";
            radio.value = name;
            radio.id = `config-${name}`;
            if (selectedConfig === name) radio.checked = true;

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
    cancelBtn.textContent = texts?.mapStyleCancel ?? "Cancel";
    const saveBtn = document.createElement("button");
    saveBtn.type = "submit";
    saveBtn.textContent = texts?.mapStyleSave ?? "Apply";
    buttonsDiv.appendChild(cancelBtn);
    buttonsDiv.appendChild(saveBtn);

    form.appendChild(title);
    form.appendChild(container);
    form.appendChild(buttonsDiv);
    dialog.appendChild(form);

    return dialog;
}


export function buildActionChoiceDialog(texts: any): HTMLDialogElement {
    const dialog = document.createElement("dialog");
    dialog.id = "action-choice-dialog";

    const form = document.createElement("form");
    form.method = "dialog";

    const title = document.createElement("h2");
    title.textContent = texts?.mapClickChoiceTitle ?? "What do you want to do?";

    const addRestaurantBtn = document.createElement("button");
    addRestaurantBtn.type = "button";
    addRestaurantBtn.className = "action-choice-btn";
    addRestaurantBtn.textContent = texts?.mapClickAddRestaurant ?? "Add a restaurant";

    const moveOriginBtn = document.createElement("button");
    moveOriginBtn.type = "button";
    moveOriginBtn.className = "action-choice-btn";
    moveOriginBtn.textContent = texts?.mapClickMoveOrigin ?? "Move the starting point";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "action-choice-btn cancel";
    cancelBtn.textContent = texts?.mapClickCancel ?? "Cancel";

    form.appendChild(title);
    form.appendChild(addRestaurantBtn);
    form.appendChild(moveOriginBtn);
    form.appendChild(cancelBtn);

    dialog.appendChild(form);
    return dialog;
}