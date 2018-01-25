let placefinder = new function() {

    let internalFunction = function() {

    };


    this.loopWithSleep = function (arr, timeToSleepInMs, callback) {
        let i = 0;
        let interval = setInterval(function(){

            callback(arr[i]);

            i++;

            if(i === arr.length) clearInterval(interval);
        }, timeToSleepInMs);
    };

    this.findPlaces = function(searchSpec) {

        let service = new google.maps.places.PlacesService(
            document.getElementById('attributions')//attributions-container
        );

        let allPlaces = [];

        const promisedResult = new Promise((resolve, reject) => {
            processResults = function(results, status, pagination) {
                if (status == google.maps.places.PlacesServiceStatus.OK) {

                    allPlaces = allPlaces.concat(results);

                    if (pagination.hasNextPage) {
                        setTimeout(() => pagination.nextPage(), 2000);
                    } else {
                        resolve(allPlaces);
                    }
                } else if (status == google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
                    resolve(allPlaces);
                } else {
                    console.log(status);
                    reject();
                }
            };

            //send a query
            service.textSearch(searchSpec, processResults);

        });
        return promisedResult;
    };

    this.FireStorePlacesRepository = class {

        constructor(placesRef) {
            this.placesRef = placesRef;
        }

        add(place) {
            // get rid of unwanted artifacts
            let cleanedPlace = JSON.parse(JSON.stringify(place));

            this.placesRef.doc(place.place_id).set(cleanedPlace);
        }
    };

    this.CachedPlacesRepositoryDecorator = class {

        constructor(placesRepository, placeIds) {
            this.realPlaceRepository = placesRepository;
            this.cache = {};

            placeIds.forEach(placeId => this._cache(placeId));
        }

        _inCache(placeId) {
            return !(this.cache[placeId] === undefined);
        }
        _cache(placeId) {
            return this.cache[placeId] = true;
        }

        add(place) {
            if (this._inCache(place.place_id)) {
                return false;
            }
            this.realPlaceRepository.add(place);

            this._cache(place.place_id);

            return true;
        }

    };


    this.CrawlController = class {

        constructor(locationsToSearchRef, lastIndexDocRef, placesRepository) {
            this.locationsToSearchRef = locationsToSearchRef;
            this.lastIndexDocRef = lastIndexDocRef;
            this.placesRepository = placesRepository;
        }


        getLastSearchedIndex() {
            return new Promise(resolve => {
                this.lastIndexDocRef.get().then(doc => {
                    if (doc.exists) {
                        resolve(doc.data().index);
                    } else {
                        resolve(null);
                    }
                });
            });
        }

        getNextLocationsToSearch(lastSearchedIndex, limit = 4000) {
            console.log("lastSearchedIndex", lastSearchedIndex);
            if (lastSearchedIndex === null) {
                return this.locationsToSearchRef.limit(limit).get();
            }

            let locationsToSearchRef = this.locationsToSearchRef;
            return locationsToSearchRef.doc(lastSearchedIndex).get().then(function (lastSearchedLocation) {
                return locationsToSearchRef.startAfter(lastSearchedLocation).limit(limit).get();
            });
        }

        searchLocation(location) {
            console.log("searching: " + location);
            return placefinder.findPlaces({query: 'near ' + location + ", Norway", type: 'gas_station'});
        }

        storePlaces(places) {
            console.log("places found: " + places.length);
            places.forEach((place) => this.storePlace(place))
        }

        storePlace(place) {
            this.placesRepository.add(place)
        }

        markAsSearched(location) {
            console.log("marking as searched: " + location.id);
            this.lastIndexDocRef.set({index: location.id})
        }
    };

};