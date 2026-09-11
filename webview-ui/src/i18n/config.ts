import i18n from "i18next"
import { initReactI18next } from "react-i18next"

import zhCommon from "../locales/zh-CN/common.json"
import zhMisc from "../locales/zh-CN/common-misc.json"
import zhSettings from "../locales/zh-CN/settings.json"

// 项目已统一为简体中文：所有语言资源均指向中文文件，
// 回退语言也是中文，确保界面始终显示简体中文。
const zhResources = {
	common: zhCommon,
	settings: zhSettings,
	misc: zhMisc,
}

const resources = {
	en: zhResources,
	"zh-CN": zhResources,
}

i18n.use(initReactI18next).init({
	resources,
	lng: "zh-CN",
	fallbackLng: "zh-CN",
	defaultNS: "common",
	interpolation: {
		escapeValue: false,
	},
})

export default i18n