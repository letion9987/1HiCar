/**
 * 云函数 hicar_api。默认请求展示 wx.showLoading；传 { silent: true } 可关闭（如个人中心静默拉会员）。
 */
let loadingRefCount = 0;

function showLoading() {
  if (loadingRefCount === 0) {
    wx.showLoading({ title: "加载中", mask: true });
  }
  loadingRefCount += 1;
}

function hideLoading() {
  loadingRefCount = Math.max(0, loadingRefCount - 1);
  if (loadingRefCount === 0) {
    wx.hideLoading();
  }
}

function call(action, payload, options) {
  const silent = options && options.silent;
  const chain = Promise.resolve()
    .then(() => {
      if (!silent) showLoading();
      return wx.cloud.callFunction({
        name: "hicar_api",
        data: { action, payload: payload || {} },
      });
    })
    .then((res) => {
      const r = res.result;
      if (!r || r.ok === false) {
        const err = (r && r.error) || "请求失败";
        return Promise.reject(new Error(typeof err === "string" ? err : JSON.stringify(err)));
      }
      return r;
    })
    .finally(() => {
      if (!silent) hideLoading();
    });
  return chain;
}

module.exports = {
  call,

  userGet: (options) => call("user.get", {}, options),
  userUpsert: (payload, options) => call("user.upsert", payload, options),
  /** getPhoneNumber 回调里的 code，云函数 openapi 换号并写 users.phoneMasked */
  userBindPhone: (payload, options) => call("user.phone", payload, options),
  /** @param {Record<string, unknown>} [payload] id / status+skip+limit；空对象则拉全部订单 */
  ordersList: (payload, options) => call("orders.list", payload || {}, options),
  ordersCreate: (payload, options) => call("orders.create", payload, options),
  ordersUpdate: (payload, options) => call("orders.update", payload, options),
  ordersDelete: (payload, options) => call("orders.delete", payload, options),

  /** 驾车路线 + 逆地理城市（腾讯 WebService，云函数转发） */
  mapRoutes: (payload, options) => call("map.routes", payload, options),
  /** 单点逆地理（上车默认地址文案等） */
  mapReverse: (payload, options) => call("map.reverse", payload, options),
};
