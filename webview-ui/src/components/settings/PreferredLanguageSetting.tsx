import React from "react"
import { useTranslation } from "react-i18next"

// 项目已统一为简体中文，语言设置固定为简体中文，不再提供切换。
const PreferredLanguageSetting: React.FC = () => {
	const { t } = useTranslation("settings")

	return (
		<div style={{}}>
			<label className="block mb-1 text-base font-medium" htmlFor="preferred-language-dropdown">
				{t("settings.preferredLanguage")}
			</label>
			<div className="vscode-dropdown" id="preferred-language-dropdown" style={{ width: "100%" }}>
				简体中文
			</div>
			<p className="text-sm text-description mt-1">{t("settings.preferredLanguageDescription")}</p>
		</div>
	)
}

export default React.memo(PreferredLanguageSetting)