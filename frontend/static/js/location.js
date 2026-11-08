// Cascading Yangon delivery-address selectors.
const LocationManager = {
  locationData: null,
  loadError: null,

  init: async function () {
    if (LocationManager.locationData || LocationManager.loadError) return;
    try {
      LocationManager.locationData = await API.getLocations();
    } catch (error) {
      LocationManager.loadError = error;
      console.error('[LocationManager] Failed to load locations:', error);
    }
  },

  _resetSelect: function (select, label) {
    if (!select) return;
    select.replaceChildren(new Option(label, ''));
    select.disabled = true;
  },

  _fillSelect: function (select, choices, label) {
    select.replaceChildren(new Option(label, ''));
    choices.forEach((value) => select.add(new Option(value, value)));
    select.disabled = choices.length === 0;
  },

  _cityData: function () {
    return LocationManager.locationData?.[document.getElementById('addr-city')?.value];
  },

  _townshipData: function () {
    return LocationManager._cityData()?.townships?.[
      document.getElementById('addr-township')?.value
    ];
  },

  renderCityDropdown: function (select) {
    LocationManager._fillSelect(
      select,
      Object.keys(LocationManager.locationData || {}),
      LocationManager.loadError ? 'Locations unavailable' : 'Select City'
    );
  },

  onCityChange: function () {
    const city = document.getElementById('addr-city')?.value;
    const townships = Object.keys(LocationManager._cityData()?.townships || {});
    LocationManager._fillSelect(
      document.getElementById('addr-township'),
      townships,
      city ? 'Select Township' : 'Select City first'
    );
    LocationManager._resetSelect(document.getElementById('addr-ward'), 'Select Ward');
    LocationManager._resetSelect(document.getElementById('addr-street'), 'Select Street');
  },

  onTownshipChange: function () {
    const wards = Object.keys(LocationManager._townshipData()?.wards || {});
    LocationManager._fillSelect(
      document.getElementById('addr-ward'),
      wards,
      'Select Ward'
    );
    LocationManager._resetSelect(document.getElementById('addr-street'), 'Select Street');
  },

  onWardChange: function () {
    const ward = document.getElementById('addr-ward')?.value;
    const streets = LocationManager._townshipData()?.wards?.[ward]?.streets || [];
    LocationManager._fillSelect(
      document.getElementById('addr-street'),
      streets,
      'Select Street'
    );
  },

  getAddress: function () {
    return {
      city: document.getElementById('addr-city')?.value || '',
      township: document.getElementById('addr-township')?.value || '',
      ward: document.getElementById('addr-ward')?.value || '',
      street: document.getElementById('addr-street')?.value || '',
      house: document.getElementById('addr-house')?.value.trim() || '',
    };
  },

  validateAddress: function () {
    const address = LocationManager.getAddress();
    const streets =
      LocationManager._townshipData()?.wards?.[address.ward]?.streets || [];
    const valid =
      Boolean(address.city && address.township && address.ward && address.house) &&
      streets.includes(address.street);
    return { valid, address: valid ? address : null };
  },

  wireDropdowns: async function () {
    await LocationManager.init();
    const city = document.getElementById('addr-city');
    const township = document.getElementById('addr-township');
    const ward = document.getElementById('addr-ward');
    const street = document.getElementById('addr-street');
    if (!city || !township || !ward || !street) return;

    LocationManager.renderCityDropdown(city);
    LocationManager._resetSelect(township, 'Select Township');
    LocationManager._resetSelect(ward, 'Select Ward');
    LocationManager._resetSelect(street, 'Select Street');
    city.onchange = LocationManager.onCityChange;
    township.onchange = LocationManager.onTownshipChange;
    ward.onchange = LocationManager.onWardChange;
  },
};
