import type { Messages } from "../types";

export const account: Messages["account"] = {
  label: "交易帳戶",
  addTitle: "新增你的交易帳號",
  savedHint: "更換了交易帳戶？請更新為你最常使用的那個。",
  emptyHint: "請輸入你的真實 MT4/MT5 登入帳號，並保持為你最常交易的帳戶——如果登記的帳戶變為不活躍，你可能會被誤移除。",
  placeholder: "例如 51234567",
  update: "更新",
  errEmpty: "請輸入你的交易帳號。",
  errFormat: "請使用你的 MT4/MT5 帳號——4 至 15 位，僅限數字。",
  errSignIn: "請重新登入。",
  errSave: "未能儲存，請重試。",
  gateEyebrow: "還差一步",
  gateBody: "你已成為入金會員，請綁定你的真實 MT4/MT5 帳號。這樣你的權限會與你實際交易的帳戶綁定——舊帳戶或不活躍的帳戶就不會讓你被誤移除。",
  gateHint: "以後更換了交易帳戶？回來把它更新為你最常使用的那個。",
  gateField: "交易帳號",
  gateSubmit: "儲存並開啟我的交易台",
};
