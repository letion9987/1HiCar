/**
 * 统一云函数：用户资料 + 订单（按 wxContext.OPENID 隔离）
 * 需在云开发控制台创建集合：users、orders（可先不设权限，仅云函数读写）
 * 手机号：`user.phone` 使用 openapi 消费 getPhoneNumber 的 code，需在 MP 后台开通「手机号」云调用并配置用户隐私指引。
 */
const cloud = require("wx-server-sdk");
const { mapRoutes, mapReverse } = require("./tencentMap");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

function toProfile(row, openid) {
  return {
    id: openid,
    displayName: row.displayName || "微信用户",
    phoneMasked: row.phoneMasked || "—",
    avatarUrl: row.avatarUrl || "",
    membershipLevelLabel: row.membershipLevelLabel || "普通会员",
    membershipLevelKey: row.membershipLevelKey || "normal",
  };
}

function stripOrder(doc) {
  if (!doc) return null;
  const o = { ...doc };
  delete o._openid;
  return o;
}

/** 展示用脱敏，不落完整号码到前端 */
function maskPhoneDigits(raw) {
  const s = String(raw || "").replace(/\D/g, "");
  if (s.length >= 7) return `${s.slice(0, 3)}****${s.slice(-4)}`;
  return "—";
}

/**
 * 消费 getPhoneNumber 返回的 code，换手机号并写入 users.phoneMasked
 * @see https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/getPhoneNumber.html
 */
async function userBindPhone(openid, payload) {
  const code = payload && payload.code;
  if (!code || typeof code !== "string") {
    return { ok: false, error: "MISSING_CODE" };
  }
  let res;
  try {
    res = await cloud.openapi.phonenumber.getPhoneNumber({ code });
  } catch (e) {
    console.error("getPhoneNumber openapi", e);
    return { ok: false, error: e.message || String(e) };
  }
  if (res && res.errcode != null && res.errcode !== 0) {
    return { ok: false, error: res.errmsg || `PHONE_ERR_${res.errcode}` };
  }
  const info = (res && (res.phone_info || res.phoneInfo)) || res || {};
  const pure =
    info.purePhoneNumber ||
    info.pure_phone_number ||
    (info.phoneNumber || info.phone_number || "").replace(/^\+\d+/, "");
  const masked = maskPhoneDigits(pure);
  if (masked === "—") {
    return { ok: false, error: "NO_PHONE_IN_RESPONSE" };
  }
  return userUpsert(openid, { phoneMasked: masked });
}

async function userGet(openid) {
  const col = db.collection("users");
  const { data } = await col.where({ _openid: openid }).limit(1).get();
  if (data.length) {
    return { ok: true, profile: toProfile(data[0], openid) };
  }
  const defaultRow = {
    _openid: openid,
    displayName: "微信用户",
    phoneMasked: "—",
    avatarUrl:
      "https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0",
    membershipLevelLabel: "普通会员",
    membershipLevelKey: "normal",
    createdAt: db.serverDate(),
  };
  await col.add({ data: defaultRow });
  const { data: d2 } = await col.where({ _openid: openid }).limit(1).get();
  return { ok: true, profile: toProfile(d2[0], openid) };
}

async function userUpsert(openid, payload) {
  const col = db.collection("users");
  let { data } = await col.where({ _openid: openid }).limit(1).get();
  if (!data.length) {
    await userGet(openid);
    const r = await col.where({ _openid: openid }).limit(1).get();
    data = r.data;
  }
  const docId = data[0]._id;
  const patch = {
    updatedAt: db.serverDate(),
  };
  if (payload.displayName != null) patch.displayName = String(payload.displayName);
  if (payload.phoneMasked != null) patch.phoneMasked = String(payload.phoneMasked);
  if (payload.avatarUrl != null) patch.avatarUrl = String(payload.avatarUrl);
  if (payload.membershipLevelLabel != null)
    patch.membershipLevelLabel = String(payload.membershipLevelLabel);
  if (payload.membershipLevelKey != null)
    patch.membershipLevelKey = String(payload.membershipLevelKey);
  await col.doc(docId).update({ data: patch });
  const { data: fresh } = await col.where({ _openid: openid }).limit(1).get();
  return { ok: true, profile: toProfile(fresh[0], openid) };
}

const ORDER_STATUS = ["pending", "ongoing", "completed", "cancelled"];

function sortOrdersByCreatedDesc(arr) {
  return [...arr].sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });
}

/**
 * @param {string} openid
 * @param {object} [payload]
 * @param {string} [payload.id] 按订单 id 查一条（订单详情页）
 * @param {string} [payload.status] 与 skip/limit 组合：按状态分页（个人中心 Tab）
 * @param {number} [payload.skip]
 * @param {number} [payload.limit] 默认 10，最大 50
 * 无 id 且无 status 分页参数时：返回当前用户全部订单（兼容旧调用）
 */
async function ordersList(openid, payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  try {
    const byId = p.id != null && String(p.id).trim();
    if (byId) {
      const id = String(p.id).trim();
      const { data } = await db.collection("orders").where({ _openid: openid, id }).limit(1).get();
      return { ok: true, orders: data.map((d) => stripOrder(d)), hasMore: false };
    }

    const status = p.status != null ? String(p.status).trim() : "";
    const limitNum = Number(p.limit);
    const skipNum = Number(p.skip);
    const usePage =
      ORDER_STATUS.includes(status) &&
      Number.isFinite(limitNum) &&
      limitNum > 0 &&
      Number.isFinite(skipNum) &&
      skipNum >= 0;

    if (usePage) {
      const limit = Math.min(Math.max(Math.floor(limitNum), 1), 50);
      const skip = Math.max(Math.floor(skipNum), 0);
      try {
        const { data } = await db
          .collection("orders")
          .where({ _openid: openid, status })
          .orderBy("createdAt", "desc")
          .skip(skip)
          .limit(limit)
          .get();
        const orders = data.map((d) => stripOrder(d));
        return { ok: true, orders, hasMore: orders.length === limit };
      } catch (err) {
        console.warn("ordersList paged query (check DB composite index status+createdAt)", err);
        const { data } = await db.collection("orders").where({ _openid: openid }).get();
        const sorted = sortOrdersByCreatedDesc(data.filter((d) => d.status === status));
        const slice = sorted.slice(skip, skip + limit);
        const orders = slice.map((d) => stripOrder(d));
        return { ok: true, orders, hasMore: skip + orders.length < sorted.length };
      }
    }

    const { data } = await db.collection("orders").where({ _openid: openid }).get();
    const sorted = sortOrdersByCreatedDesc(data);
    return { ok: true, orders: sorted.map((d) => stripOrder(d)) };
  } catch (e) {
    console.error(e);
    return { ok: true, orders: [], hasMore: false };
  }
}

async function ordersCreate(openid, payload) {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "INVALID_PAYLOAD" };
  }
  const id = payload.id || `MP${Date.now()}`;
  const doc = {
    _openid: openid,
    id,
    status: payload.status || "pending",
    from: String(payload.from || ""),
    to: String(payload.to || ""),
    useTime: String(payload.useTime || ""),
    remark: payload.remark,
    passengers: payload.passengers,
    pricingMode: payload.pricingMode,
    vehicleLabel: payload.vehicleLabel,
    estimatedTotalYuan: payload.estimatedTotalYuan,
    depositPaidYuan: payload.depositPaidYuan,
    driverLatLng: payload.driverLatLng,
    pickupLatLng: payload.pickupLatLng,
    dropoffLatLng: payload.dropoffLatLng,
    routeLeg1Path: payload.routeLeg1Path,
    routeLeg2Path: payload.routeLeg2Path,
    tempFeeDetail: payload.tempFeeDetail,
    settlementSnapshot: payload.settlementSnapshot,
    createdAt: db.serverDate(),
  };
  await db.collection("orders").add({ data: doc });
  return { ok: true, order: stripOrder(doc) };
}

async function ordersUpdate(openid, payload) {
  const id = payload && payload.id;
  if (!id) return { ok: false, error: "MISSING_ID" };
  const { data } = await db.collection("orders").where({ _openid: openid, id }).limit(1).get();
  if (!data.length) return { ok: false, error: "NOT_FOUND" };
  const docId = data[0]._id;
  const patch = { ...(payload.patch || {}) };
  patch.updatedAt = db.serverDate();
  await db.collection("orders").doc(docId).update({ data: patch });
  const { data: fresh } = await db.collection("orders").doc(docId).get();
  return { ok: true, order: stripOrder(fresh) };
}

async function ordersDelete(openid, payload) {
  const id = payload && payload.id;
  if (!id) return { ok: false, error: "MISSING_ID" };
  const { data } = await db.collection("orders").where({ _openid: openid, id }).limit(1).get();
  if (!data.length) return { ok: false, error: "NOT_FOUND" };
  await db.collection("orders").doc(data[0]._id).remove();
  return { ok: true };
}

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) {
    return { ok: false, error: "NO_OPENID" };
  }

  const action = event && event.action;
  const payload = (event && event.payload) || {};

  try {
    switch (action) {
      case "user.get":
        return await userGet(openid);
      case "user.upsert":
        return await userUpsert(openid, payload);
      case "user.phone":
        return await userBindPhone(openid, payload);
      case "orders.list":
        return await ordersList(openid, payload);
      case "orders.create":
        return await ordersCreate(openid, payload);
      case "orders.update":
        return await ordersUpdate(openid, payload);
      case "orders.delete":
        return await ordersDelete(openid, payload);
      case "map.routes":
        return await mapRoutes(payload);
      case "map.reverse":
        return await mapReverse(payload);
      default:
        return { ok: false, error: "UNKNOWN_ACTION" };
    }
  } catch (e) {
    console.error(e);
    return { ok: false, error: e.message || String(e) };
  }
};
