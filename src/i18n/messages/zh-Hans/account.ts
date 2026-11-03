import type { Messages } from "../types";

export const account: Messages["account"] = {
  label: "交易账户",
  addTitle: "添加你的交易账号",
  savedHint: "更换了交易账户？请更新为你最常使用的那个。",
  emptyHint: "请输入你的真实 MT4/MT5 登录账号，并保持为你最常交易的账户——如果登记的账户变为不活跃，你可能会被误移除。",
  placeholder: "例如 51234567",
  update: "更新",
  errEmpty: "请输入你的交易账号。",
  errFormat: "请使用你的 MT4/MT5 账号——4 至 15 位，仅限数字。",
  errSignIn: "请重新登录。",
  errSave: "未能保存，请重试。",
  gateEyebrow: "还差一步",
  gateBody: "你已成为入金会员，请绑定你的真实 MT4/MT5 账号。这样你的权限会与你实际交易的账户绑定——旧账户或不活跃的账户就不会让你被误移除。",
  gateHint: "以后更换了交易账户？回来把它更新为你最常使用的那个。",
  gateField: "交易账号",
  gateSubmit: "保存并打开我的交易台",
};
