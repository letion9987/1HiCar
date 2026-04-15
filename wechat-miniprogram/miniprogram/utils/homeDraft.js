const KEY_LOC = "hicar_mp_home_locations_v1";
const KEY_BOOKING = "hicar_mp_home_booking_ui_v1";
const KEY_PRICING_MODE = "hicar_mp_pricing_mode_v1";

function loadLocations() {
  try {
    const raw = wx.getStorageSync(KEY_LOC);
    if (!raw || typeof raw !== "object") return { pickup: null, dropoff: null };
    return {
      pickup: raw.pickup || null,
      dropoff: raw.dropoff || null,
    };
  } catch (e) {
    return { pickup: null, dropoff: null };
  }
}

function saveLocations(pickup, dropoff) {
  try {
    wx.setStorageSync(KEY_LOC, { pickup, dropoff });
  } catch (e) {}
}

function loadBookingUi() {
  try {
    const raw = wx.getStorageSync(KEY_BOOKING);
    if (!raw || typeof raw !== "object") return null;
    return raw;
  } catch (e) {
    return null;
  }
}

function saveBookingUi(draft) {
  try {
    wx.setStorageSync(KEY_BOOKING, draft);
  } catch (e) {}
}

function clearBookingUi() {
  try {
    wx.removeStorageSync(KEY_BOOKING);
  } catch (e) {}
}

function loadPricingMode() {
  try {
    const m = wx.getStorageSync(KEY_PRICING_MODE);
    return m === "temporary" ? "temporary" : "package";
  } catch (e) {
    return "package";
  }
}

function savePricingMode(mode) {
  try {
    wx.setStorageSync(KEY_PRICING_MODE, mode === "temporary" ? "temporary" : "package");
  } catch (e) {}
}

module.exports = {
  loadLocations,
  saveLocations,
  loadBookingUi,
  saveBookingUi,
  clearBookingUi,
  loadPricingMode,
  savePricingMode,
};
