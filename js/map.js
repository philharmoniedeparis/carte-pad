/**
 * Carte des institutions abonnées à Philharmonie à la demande (PAD)
 *
 * Carte interactive Leaflet avec les plugins markerCluster, FullScreen et responsivePopup.
 * Aucune autre dépendance (pas de jQuery).
 *
 * Organisation du fichier :
 *   1. Paramètres modifiables
 *   2. Chargement des données
 *   3. Carte et marqueurs
 *   4. Filtres (pays, ville, types)
 *   5. Boutons, plein écran, responsive
 *   6. Tableau accessible
 */


/* =====================================================================
   1. PARAMÈTRES MODIFIABLES
   ===================================================================== */

// Source des données des institutions
const API_URL = "https://med-api.philharmoniedeparis.fr/Maps/FullPAD"

// API officielle des communes françaises (https://geo.api.gouv.fr)
const GEO_API_URL = "https://geo.api.gouv.fr/communes"

// Pays sélectionné à l'ouverture de la carte
const DEFAULT_COUNTRY = "France"

// Niveau de zoom après le choix d'une ville (plus grand = plus près)
const CITY_ZOOM = 13

// Couleurs des marqueurs et des filtres pour chaque type d'institution
// "color" = couleur du marqueur, "text_color" = couleur du texte posé dessus
const TYPE_COLORS = {
    "Bibliothèque":  { color: "#E4003A", text_color: "#ffffff" },
    "Conservatoire": { color: "#F5A800", text_color: "#001B3B" },
    "Université":    { color: "#00A19A", text_color: "#ffffff" },
    "Autre":         { color: "#7F7F7F", text_color: "#ffffff" },
}

// Type utilisé quand une institution n'a pas de type renseigné
const DEFAULT_TYPE = "Autre"

// Cadrage de chaque pays : [[latitude sud, longitude ouest], [latitude nord, longitude est]]
// Si un nouveau pays apparaît dans les données sans être listé ici,
// la carte se cadre automatiquement sur ses institutions.
const COUNTRY_BOUNDS = {
    "France":     [[41.3, -5.2], [51.1, 9.6]],
    "Belgique":   [[49.5, 2.5], [51.5, 6.4]],
    "Luxembourg": [[49.4, 5.7], [50.2, 6.5]],
    "Monaco":     [[43.72, 7.40], [43.76, 7.44]],
    "Italie":     [[36.6, 6.6], [47.1, 18.5]],
}

// Libellés des services
const SERVICES_LABELS = {
    "A":  "Accès à domicile",
    "P":  "Accès sur place",
    "AP": "Accès à domicile & Accès sur place",
}


/* =====================================================================
   Variables partagées par toutes les fonctions
   ===================================================================== */

var map           // La carte Leaflet
var cluster       // Le groupe qui regroupe les marqueurs en "bulles"
var allMarkers = [] // Tous les marqueurs (affichés ou non)


/* =====================================================================
   2. CHARGEMENT DES DONNÉES
   ===================================================================== */

document.addEventListener("DOMContentLoaded", loadData)

/**
 * Récupère les données de l'API puis lance la construction de la carte
 */
function loadData() {
    fetch(API_URL)
        .then(response => {
            if (!response.ok) {
                throw new Error("Network response : " + response.statusText)
            }
            return response.json()
        })
        .then(data => {
            // On garde les institutions localisées, sans les têtes de réseau
            const institutions = data.institutions.filter(inst => {
                return inst.role !== "head" && inst.location && inst.location.lat
            })
            // Les institutions sans type sont rangées dans le type par défaut
            institutions.forEach(inst => { inst.type = inst.type || DEFAULT_TYPE })

            init(institutions, data.filters.countries)
            document.querySelector(".loader").style.display = "none"
        })
        .catch(error => {
            console.error("Fetch error. ", error)
        })
}

/**
 * Construction générale de la carte
 * @param {array} institutions - Liste des institutions à afficher
 * @param {array} countries - Liste des pays fournie par l'API
 */
function init(institutions, countries) {
    createMap()
    createMarkers(institutions)
    buildCountrySelect(countries)
    buildTypeFilters(institutions)
    setupCitySearch()
    createResetButton()
    responsiveFilter()
    responsiveMap()
    document.getElementById("access-button").addEventListener("click", accessibilityTable)
    document.addEventListener("fullscreenchange", onFullScreenChange)

    refreshMarkers()
    zoomToCountry(DEFAULT_COUNTRY)
}


/* =====================================================================
   3. CARTE ET MARQUEURS
   ===================================================================== */

/**
 * Création de la carte (même fond et mêmes réglages que la carte des actions)
 */
function createMap() {
    map = L.map("mapDG", {
        fullscreenControl: true,
        fullscreenControlOptions: { position: "topleft" },
        worldCopyJump: true,
        scrollWheelZoom: true,
        minZoom: 2,
        maxZoom: 18,
    }).setView([46.6, 2.5], 6)

    L.tileLayer("https://tile.jawg.io/jawg-light/{z}/{x}/{y}{r}.png?access-token=YCEYIYWB5ZcUuCYc2XQe9fGjttHukDxdSd2wqzlA7mhBwMK8SXM9h3RGqxtZzuna", {}).addTo(map)
    map.attributionControl.addAttribution("<a href=\"https://www.jawg.io\" target=\"_blank\">&copy; Jawg</a> - <a href=\"https://www.openstreetmap.org\" target=\"_blank\">&copy; OpenStreetMap</a>&nbsp;contributors")

    cluster = L.markerClusterGroup({ showCoverageOnHover: false })
    map.addLayer(cluster)
}

/**
 * Création d'un marqueur par institution
 * @param {array} institutions - Liste des institutions
 */
function createMarkers(institutions) {
    institutions.forEach(inst => {
        const marker = L.marker([inst.location.lat, inst.location.lon], { icon: createIcon(inst.type) })
        marker.bindPopup(createPopup(inst), { maxWidth: 340 })
        marker.institution = inst
        allMarkers.push(marker)
    })
}

/**
 * Renvoie les couleurs d'un type d'institution
 * @param {string} type - Type d'institution
 */
function getColors(type) {
    return TYPE_COLORS[type] || TYPE_COLORS[DEFAULT_TYPE]
}

/**
 * Création de l'icône (épingle colorée) d'un marqueur
 * @param {string} type - Type d'institution
 */
function createIcon(type) {
    const colors = getColors(type)
    const html = `
        <div>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 25.66 35.26" class="icon" fill="${colors.color}">
                <path d="m12.83,0C5.74,0,0,5.74,0,12.83c0,7.08,7.6,15.91,12.83,22.43,5.23-6.52,12.83-15.35,12.83-22.43S19.91,0,12.83,0"/>
            </svg>
            <div class="icon-shadow"></div>
        </div>`
    return L.divIcon({
        html: html,
        iconSize: [30, 30],
        iconAnchor: [15, 42],
        popupAnchor: [0, 0]
    })
}

/**
 * Création de la popup d'une institution
 * @param {Object} inst - Institution
 */
function createPopup(inst) {
    const colors = getColors(inst.type)
    const content = document.createElement("div")
    content.className = "values"

    // En-tête : carré de couleur + type
    const header = document.createElement("div")
    header.className = "prospect"
    header.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44.74 44.74" style="background-color:${colors.color}"></svg>`
    addElement(header, "p", inst.type)
    content.appendChild(header)

    // Séparateur
    const separator = document.createElement("div")
    separator.className = "separator"
    content.appendChild(separator)

    // Nom de l'institution
    addElement(content, "h3", inst.name)

    // Réseau
    if (inst.networkName) {
        addElement(content, "p", inst.networkName, "Réseau : ")
    }

    // Services
    if (SERVICES_LABELS[inst.services]) {
        addElement(content, "p", SERVICES_LABELS[inst.services], "Services : ")
    }

    // Adresse
    const address = document.createElement("address")
    address.textContent = formatAddress(inst)
    content.appendChild(address)

    // Lien vers le site de l'institution
    if (inst.link) {
        const link = document.createElement("a")
        link.className = "btn btn-default btn-externe"
        link.style.backgroundColor = colors.color
        link.style.color = colors.text_color
        link.href = inst.link
        link.target = "_blank"
        link.title = "Aller sur le site de l'institution dans un nouvel onglet"
        link.textContent = "Informations"
        content.appendChild(link)
    }

    return L.responsivePopup().setContent(content)
}

/**
 * Ajoute un élément texte dans un parent, avec un libellé en gras optionnel
 * @param {Element} parent - Élément parent
 * @param {string} tag - Balise à créer (p, h3...)
 * @param {string} text - Texte de l'élément
 * @param {string} boldLabel - Libellé en gras placé avant le texte (optionnel)
 */
function addElement(parent, tag, text, boldLabel) {
    const element = document.createElement(tag)
    if (boldLabel) {
        const bold = document.createElement("b")
        bold.textContent = boldLabel
        element.appendChild(bold)
    }
    element.appendChild(document.createTextNode(text))
    parent.appendChild(element)
}

/**
 * Renvoie l'adresse complète d'une institution sur une ligne
 * @param {Object} inst - Institution
 */
function formatAddress(inst) {
    const a = inst.address
    const cityLine = [a.postalCode, a.city].filter(Boolean).join(" ")
    return [a.street, cityLine, a.country].filter(Boolean).join(", ")
}

/**
 * Affiche sur la carte les marqueurs des types cochés et met à jour le compteur
 */
function refreshMarkers() {
    const selectedTypes = getSelectedTypes()
    const visibleMarkers = allMarkers.filter(marker => selectedTypes.includes(marker.institution.type))

    cluster.clearLayers()
    cluster.addLayers(visibleMarkers)

    document.querySelector("#results b").textContent = visibleMarkers.length
}


/* =====================================================================
   4. FILTRES
   ===================================================================== */

/* ---------- Pays ---------- */

/**
 * Remplit le sélecteur de pays
 * @param {array} countries - Liste des pays
 */
function buildCountrySelect(countries) {
    const select = document.getElementById("country_select")

    countries.forEach(country => {
        const option = document.createElement("option")
        option.value = country
        option.textContent = country
        select.appendChild(option)
    })
    select.value = DEFAULT_COUNTRY

    select.addEventListener("change", () => zoomToCountry(select.value))
}

/**
 * Centre la carte sur un pays et affiche la recherche de ville si c'est la France
 * @param {string} country - Nom du pays
 */
function zoomToCountry(country) {
    if (COUNTRY_BOUNDS[country]) {
        map.fitBounds(COUNTRY_BOUNDS[country])
    } else {
        // Pays inconnu : cadrage sur ses institutions
        const points = allMarkers
            .filter(marker => marker.institution.address.country === country)
            .map(marker => marker.getLatLng())
        if (points.length) {
            map.fitBounds(L.latLngBounds(points), { maxZoom: 10 })
        }
    }

    // La recherche de ville n'est disponible que pour la France
    document.getElementById("city-search").hidden = (country !== "France")
    document.getElementById("seeker").value = ""
    closeSuggestions()
}

/* ---------- Ville (France) ---------- */

var citySuggestions = [] // Dernières communes renvoyées par geo.api.gouv.fr
var activeSuggestion = -1 // Suggestion surlignée au clavier
var searchTimer          // Délai avant d'interroger l'API

/**
 * Active la recherche de ville avec suggestions (nom + codes postaux)
 */
function setupCitySearch() {
    const input = document.getElementById("seeker")

    // Pendant la saisie : on attend 250 ms de pause avant d'interroger l'API
    input.addEventListener("input", () => {
        clearTimeout(searchTimer)
        const query = input.value.trim()
        if (query.length < 2) {
            closeSuggestions()
            return
        }
        searchTimer = setTimeout(() => fetchCities(query), 250)
    })

    // Navigation au clavier dans la liste
    input.addEventListener("keydown", e => {
        if (e.key === "ArrowDown") {
            e.preventDefault()
            highlightSuggestion(activeSuggestion + 1)
        } else if (e.key === "ArrowUp") {
            e.preventDefault()
            highlightSuggestion(activeSuggestion - 1)
        } else if (e.key === "Escape") {
            closeSuggestions()
        }
    })

    // Touche Entrée ou bouton loupe : on prend la suggestion surlignée, sinon la première
    document.getElementById("search-bar").addEventListener("submit", e => {
        e.preventDefault()
        const index = activeSuggestion >= 0 ? activeSuggestion : 0
        if (citySuggestions[index]) {
            selectCity(citySuggestions[index])
        }
    })

    // Clic en dehors de la recherche : on ferme la liste
    document.addEventListener("click", e => {
        if (!e.target.closest("#search-field")) {
            closeSuggestions()
        }
    })
}

/**
 * Interroge geo.api.gouv.fr et affiche les communes correspondantes
 * @param {string} query - Texte saisi
 */
function fetchCities(query) {
    const url = `${GEO_API_URL}?nom=${encodeURIComponent(query)}&fields=nom,codesPostaux,centre,departement&boost=population&limit=10`

    fetch(url)
        .then(response => response.json())
        .then(communes => {
            citySuggestions = communes.filter(commune => commune.centre)
            showSuggestions()
        })
        .catch(error => {
            console.error("Geo API error. ", error)
        })
}

/**
 * Affiche la liste des communes proposées
 */
function showSuggestions() {
    const list = document.getElementById("city-suggestions")
    list.innerHTML = ""
    activeSuggestion = -1

    citySuggestions.forEach((commune, index) => {
        const item = document.createElement("li")
        item.id = "city-option-" + index
        item.setAttribute("role", "option")

        // Ligne 1 : nom de la commune
        item.textContent = commune.nom

        // Ligne 2 : codes postaux (3 maximum) et département
        let postalCodes = commune.codesPostaux.slice(0, 3).join(", ")
        if (commune.codesPostaux.length > 3) { postalCodes += "…" }
        const details = document.createElement("small")
        details.textContent = postalCodes + (commune.departement ? " – " + commune.departement.nom : "")
        item.appendChild(details)

        item.addEventListener("click", () => selectCity(commune))
        list.appendChild(item)
    })

    list.hidden = citySuggestions.length === 0
    document.getElementById("seeker").setAttribute("aria-expanded", !list.hidden)
}

/**
 * Surligne une suggestion (navigation au clavier)
 * @param {number} index - Position de la suggestion dans la liste
 */
function highlightSuggestion(index) {
    const items = document.querySelectorAll("#city-suggestions li")
    if (!items.length) { return }

    // On boucle : après la dernière, on revient à la première
    activeSuggestion = (index + items.length) % items.length
    items.forEach((item, i) => item.classList.toggle("active", i === activeSuggestion))
    items[activeSuggestion].scrollIntoView({ block: "nearest" })
    document.getElementById("seeker").setAttribute("aria-activedescendant", items[activeSuggestion].id)
}

/**
 * Ferme la liste des suggestions
 */
function closeSuggestions() {
    const list = document.getElementById("city-suggestions")
    list.hidden = true
    list.innerHTML = ""
    activeSuggestion = -1
    const input = document.getElementById("seeker")
    input.setAttribute("aria-expanded", "false")
    input.removeAttribute("aria-activedescendant")
}

/**
 * Centre et zoome la carte sur la commune choisie
 * @param {Object} commune - Commune renvoyée par geo.api.gouv.fr
 */
function selectCity(commune) {
    document.getElementById("seeker").value = commune.nom
    closeSuggestions()

    // L'API renvoie les coordonnées dans l'ordre [longitude, latitude]
    const [lon, lat] = commune.centre.coordinates
    map.setView([lat, lon], CITY_ZOOM)
}

/* ---------- Types d'institution ---------- */

/**
 * Création des cases à cocher des types d'institution
 * @param {array} institutions - Liste des institutions
 */
function buildTypeFilters(institutions) {
    const parent = document.getElementById("type_action_container")

    // Types présents dans les données, dans l'ordre de TYPE_COLORS puis les éventuels nouveaux
    const presentTypes = [...new Set(institutions.map(inst => inst.type))]
    const types = Object.keys(TYPE_COLORS).filter(type => presentTypes.includes(type))
        .concat(presentTypes.filter(type => !TYPE_COLORS[type]))

    // Case "Tous les types"
    const allInput = createTypeCheckbox(parent, "all_type", "Tous les types", "var(--light-blue)")
    allInput.addEventListener("change", () => {
        document.querySelectorAll('input[name="type_action"]').forEach(input => {
            input.checked = allInput.checked
        })
        refreshMarkers()
    })

    // Une case par type
    types.forEach(type => {
        const input = createTypeCheckbox(parent, type, type, getColors(type).color)
        input.addEventListener("change", () => {
            // "Tous les types" n'est coché que si toutes les cases le sont
            allInput.checked = document.querySelectorAll('input[name="type_action"]:not(:checked)').length === 0
            refreshMarkers()
        })
    })
}

/**
 * Crée une case à cocher de type (même apparence que la carte des actions)
 * @param {Element} parent - Conteneur des cases
 * @param {string} value - Valeur de la case
 * @param {string} text - Texte affiché
 * @param {string} color - Couleur du carré
 * @returns {Element} La case à cocher créée
 */
function createTypeCheckbox(parent, value, text, color) {
    const id = "type-" + normalizeString(value)
    const container = document.createElement("div")

    const input = document.createElement("input")
    input.type = "checkbox"
    input.id = id
    input.name = value === "all_type" ? "all_type" : "type_action"
    input.value = value
    input.checked = true
    input.tabIndex = -1
    container.appendChild(input)

    const label = document.createElement("label")
    label.htmlFor = id
    label.tabIndex = 0
    label.innerHTML = `
        <div id="iconType-${id}">
            <svg class="cursor" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 73.53 73.53" style="fill: ${color}; stroke: var(--deep-blue); stroke-width:0px;">
                <rect width="73.53" height="73.53" rx="17.9" ry="17.9"/>
            </svg>
            <svg class="checkIcon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 41.3 29.06" style="stroke: #fff;">
                <line x1="3.5" y1="13.33" x2="15.74" y2="25.56"/>
                <line x1="37.8" y1="3.5" x2="15.74" y2="25.56"/>
            </svg>
        </div>`
    addElement(label, "p", text)

    // Accessibilité : cocher/décocher avec Entrée ou Espace
    label.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            input.click()
        }
    })

    container.appendChild(label)
    parent.appendChild(container)
    return input
}

/**
 * Renvoie la liste des types cochés
 */
function getSelectedTypes() {
    return Array.from(document.querySelectorAll('input[name="type_action"]:checked')).map(input => input.value)
}

/**
 * Normalisation d'une chaîne (sans accents ni espaces) pour l'utiliser comme identifiant
 * @param {string} str - Chaîne à normaliser
 */
function normalizeString(str) {
    return str.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "_").toLowerCase()
}


/* =====================================================================
   5. BOUTONS, PLEIN ÉCRAN, RESPONSIVE
   ===================================================================== */

/**
 * Création du bouton qui réinitialise la carte
 */
function createResetButton() {
    const resetButton = document.createElement("button")
    resetButton.id = "reset-button"
    resetButton.className = "leaflet-bar leaflet-control"
    resetButton.type = "button"
    resetButton.title = "Réinitialiser la carte"
    resetButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 328.32 335.24">
            <path d="m272.68,41.69c.7-1.2,1.18-2.62,2.13-3.58,8.06-8.17,16.25-16.22,24.3-24.4,5.24-5.33,11.3-7.22,18.38-4.58,6.45,2.41,9.87,8.12,9.88,16.08.03,28.45.04,56.89,0,85.34-.02,10.53-6.48,17.03-17.06,17.05-28.33.07-56.65.05-84.98,0-8.13-.01-13.87-3.55-16.35-10.11-2.69-7.13-.63-13.12,4.68-18.33,8.01-7.85,15.92-15.82,24.7-24.56-8.3-5.21-15.85-10.72-24.06-14.95-35.34-18.23-70.78-15.72-104.47,3.32-42.34,23.92-62.85,61.49-61.73,110.1,1.25,54.33,43.92,102.97,97.48,112.19,59.06,10.17,113.16-20.46,134.68-76.25,4.25-11.02,11.61-14.93,23.31-12.42,4.14.89,8.32,1.63,12.44,2.59,9.48,2.2,14.53,10.57,11.35,19.58-22.19,62.8-65.85,101.96-131.34,113.81-84.9,15.36-166.14-36.91-189.75-119.88C-19.69,121.46,37.59,25.09,129.83,4.28c51.97-11.73,97.68,1,138.54,33.99.87.7,1.74,1.42,2.62,2.11.18.14.44.2.66.29.34.34.69.69,1.03,1.03Z"/>
        </svg>`

    resetButton.addEventListener("click", () => {
        // Tous les types cochés
        document.querySelectorAll('#type_action_container input[type="checkbox"]').forEach(input => {
            input.checked = true
        })
        refreshMarkers()

        // Pays par défaut (vide aussi la recherche de ville)
        document.getElementById("country_select").value = DEFAULT_COUNTRY
        zoomToCountry(DEFAULT_COUNTRY)
        map.closePopup()
    })

    const resetControl = L.control({ position: "topleft" })
    resetControl.onAdd = () => resetButton
    resetControl.addTo(map)
}

/**
 * Ouverture / fermeture du panneau de filtres (petits écrans et plein écran)
 */
function responsiveFilter() {
    const button = document.getElementById("open-close-filter")

    button.addEventListener("click", () => {
        document.getElementById("mapDG-filter-container").classList.toggle("open")
        document.getElementById("mapDG").classList.toggle("open")
        button.classList.toggle("open")

        const isOpen = button.classList.contains("open")
        button.setAttribute("aria-pressed", isOpen)

        // En plein écran, on bloque la carte tant que les filtres sont ouverts
        if (!button.classList.contains("fullscreen-filters")) { return }
        const handlers = [map.dragging, map.touchZoom, map.doubleClickZoom, map.scrollWheelZoom]
        handlers.forEach(handler => isOpen ? handler.disable() : handler.enable())
    })
}

/**
 * Déplace les filtres dans la carte lors du passage en plein écran (et inversement)
 */
function onFullScreenChange() {
    const mapElement = document.getElementById("mapDG")
    const filterElement = document.getElementById("mapDG-filter-container")
    const buttonElement = document.getElementById("open-close-filter")
    const parentContainer = document.getElementById("mapDG-container")

    if (document.fullscreenElement === mapElement) {
        mapElement.appendChild(filterElement)
        mapElement.appendChild(buttonElement)
    } else {
        parentContainer.insertBefore(filterElement, mapElement)
        parentContainer.insertBefore(buttonElement, mapElement)
    }
    filterElement.classList.toggle("fullscreen-filters")
    buttonElement.classList.toggle("fullscreen-filters")
}

/**
 * Adapte la hauteur de la carte à la fenêtre
 */
function responsiveMap() {
    setResponsiveHeight()
    window.addEventListener("resize", setResponsiveHeight)

    // Quand la carte change de taille (ouverture/fermeture des filtres),
    // Leaflet doit recalculer ses dimensions pour charger les tuiles manquantes
    document.getElementById("mapDG").addEventListener("transitionend", () => map.invalidateSize())
}

/**
 * Calcule la hauteur de la carte et des filtres en fonction de la fenêtre
 */
function setResponsiveHeight() {
    const margin = 40
    const title = document.querySelector(".map-title")
    const titleStyle = getComputedStyle(title)
    const titleHeight = title.offsetHeight + parseFloat(titleStyle.marginTop) + parseFloat(titleStyle.marginBottom)

    const height = (window.innerHeight - titleHeight - margin) + "px"
    document.getElementById("mapDG-filter-container").style.height = height
    document.getElementById("mapDG").style.height = height
}


/* =====================================================================
   6. TABLEAU ACCESSIBLE
   ===================================================================== */

/**
 * Affiche dans une fenêtre la liste des institutions visibles sous forme de tableau
 */
function accessibilityTable() {
    // Élément qui avait le focus avant l'ouverture, pour y revenir à la fermeture
    const previouslyFocused = document.activeElement

    const oldModal = document.getElementById("access-modal")
    if (oldModal) { oldModal.remove() }

    const modal = document.createElement("section")
    modal.id = "access-modal"
    modal.setAttribute("role", "dialog")
    modal.setAttribute("aria-modal", "true")
    modal.setAttribute("aria-labelledby", "modal-title")

    // En plein écran, la fenêtre doit être dans la carte pour être visible
    const isFullscreen = document.getElementById("open-close-filter").classList.contains("fullscreen-filters")
    document.getElementById(isFullscreen ? "mapDG" : "mapDG-container").appendChild(modal)

    const closeModal = () => {
        modal.remove()
        if (previouslyFocused) { previouslyFocused.focus() }
    }

    // Bouton de fermeture
    const closeContainer = document.createElement("div")
    closeContainer.className = "close-button-container"
    const closeButton = document.createElement("button")
    closeButton.className = "btn btn-default close"
    closeButton.textContent = "Fermer le tableau"
    closeButton.addEventListener("click", closeModal)
    closeContainer.appendChild(closeButton)
    modal.appendChild(closeContainer)
    setTimeout(() => closeButton.focus(), 100)

    // Tableau
    const container = document.createElement("div")
    container.className = "table-container"
    const title = document.createElement("h2")
    title.id = "modal-title"
    title.textContent = "Liste des institutions abonnées à Philharmonie à la demande"
    container.appendChild(title)

    const table = document.createElement("table")
    const header = document.createElement("thead")
    header.style.backgroundColor = "var(--deep-blue)"
    header.style.color = "var(--white)"
    const headerRow = document.createElement("tr")
    const columns = ["Nom", "Type", "Réseau", "Adresse", "Lien"]
    columns.forEach(text => {
        const th = document.createElement("th")
        th.scope = "col"
        th.textContent = text
        headerRow.appendChild(th)
    })
    header.appendChild(headerRow)
    table.appendChild(header)

    // Une ligne par institution affichée, triées par pays, ville puis nom
    const selectedTypes = getSelectedTypes()
    const rows = allMarkers
        .map(marker => marker.institution)
        .filter(inst => selectedTypes.includes(inst.type))
        .sort((a, b) => (a.address.country || "").localeCompare(b.address.country || "")
            || (a.address.city || "").localeCompare(b.address.city || "")
            || a.name.localeCompare(b.name))

    const body = document.createElement("tbody")
    rows.forEach(inst => {
        const line = document.createElement("tr")
        const cells = [inst.name, inst.type, inst.networkName || "", formatAddress(inst)]
        cells.forEach(text => {
            addElement(line, "td", text)
        })

        const linkCell = document.createElement("td")
        if (inst.link) {
            const link = document.createElement("a")
            link.href = inst.link
            link.target = "_blank"
            link.title = "Aller sur le site de l'institution dans un nouvel onglet"
            link.textContent = "Informations"
            linkCell.appendChild(link)
        }
        line.appendChild(linkCell)
        body.appendChild(line)
    })
    table.appendChild(body)
    container.appendChild(table)
    modal.appendChild(container)

    // Fermeture avec Échap et focus maintenu dans la fenêtre
    modal.addEventListener("keydown", e => {
        if (e.key === "Escape") {
            closeModal()
        }
        if (e.key === "Tab") {
            const focusable = modal.querySelectorAll('button, a, [tabindex]:not([tabindex="-1"])')
            const first = focusable[0]
            const last = focusable[focusable.length - 1]
            if (e.shiftKey && document.activeElement === first) {
                last.focus()
                e.preventDefault()
            } else if (!e.shiftKey && document.activeElement === last) {
                first.focus()
                e.preventDefault()
            }
        }
    })
}
