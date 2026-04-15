Page({
  data: {},
  onLoad(query) {
    this.role = query.role === "dropoff" ? "dropoff" : "pickup";
    this.opened = false;
  },
  onShow() {
    if (this.opened) return;
    this.opened = true;
    wx.chooseLocation({
      success: (res) => {
        const label = [res.name, res.address].filter(Boolean).join(" ").trim() || "已选位置";
        const ec = this.getOpenerEventChannel && this.getOpenerEventChannel();
        if (ec && ec.emit) {
          ec.emit("locationPicked", {
            role: this.role,
            point: {
              label,
              latLng: { lat: res.latitude, lng: res.longitude },
            },
          });
        }
        wx.navigateBack();
      },
      fail: () => {
        wx.navigateBack();
      },
    });
  },
});
