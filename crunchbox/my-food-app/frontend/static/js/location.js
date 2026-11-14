// Cascading Yangon delivery-address selectors.
const LocationManager = {
  locationData: null,
  loadError: null,
  storageKey: 'crunchbox-address-v1',

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
    ['addr-ward', 'addr-street', 'addr-house'].forEach((id) => {
      const field = document.getElementById(id);
      if (field) field.value = '';
    });
    LocationManager.saveAddress();
  },

  onTownshipChange: function () {
    ['addr-ward', 'addr-street', 'addr-house'].forEach((id) => {
      const field = document.getElementById(id);
      if (field) field.value = '';
    });
    LocationManager.saveAddress();
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
    const valid =
      Boolean(
        address.city && address.township &&
        address.ward && address.street && address.house
      );
    return { valid, address: valid ? address : null };
  },

  saveAddress: function () {
    try {
      localStorage.setItem(LocationManager.storageKey, JSON.stringify(LocationManager.getAddress()));
    } catch (error) {
      console.error('[LocationManager] Could not save address:', error);
    }
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
    const saved = LocationManager.loadAddress();
    city.onchange = LocationManager.onCityChange;
    township.onchange = LocationManager.onTownshipChange;
    [ward, street, document.getElementById('addr-house')].forEach((input) => {
      input?.addEventListener('input', LocationManager.saveAddress);
      input?.addEventListener('change', LocationManager.saveAddress);
    });
    if (saved?.city && LocationManager.locationData?.[saved.city]) {
      city.value = saved.city;
      LocationManager.onCityChange();
      if (saved.township && LocationManager._cityData()?.townships?.[saved.township]) {
        township.value = saved.township;
      }
      ward.value = saved.ward || '';
      street.value = saved.street || '';
      document.getElementById('addr-house').value = saved.house || '';
      LocationManager.saveAddress();
    }
  },

  loadAddress: function () {
    try {
      const saved = JSON.parse(localStorage.getItem(LocationManager.storageKey) || 'null');
      return saved && typeof saved === 'object' ? saved : null;
    } catch (error) {
      console.error('[LocationManager] Could not restore saved address:', error);
      return null;
    }
  },
};
