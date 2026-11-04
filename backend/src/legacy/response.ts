/**
 * 官方信封 —— 与本项目 `{success, data}` 不同。
 *
 * poetize-ui/src/utils/request.js 的逻辑：
 *   axios 解包后 resolve(res.data)，即拿到后端整个 JSON
 *   若 JSON 含 code 字段且 != 200 → 视为错误
 *   前端各处再用 res.data 取业务数据
 *
 * 所以官方格式必须是：{ code: 200, message: "success", data: <业务数据> }
 */
export const legacyOk = <T>(data: T) =>
  Response.json({ code: 200, message: 'success', data })

export const legacyErr = (message: string, code = 500) =>
  Response.json({ code, message, data: null })
