# Cline Multi 🌏

<p align="center">
  <img src="assets/icons/icon.png" width="128" alt="Cline Multi Icon">
</p>

<p align="center">
  <strong>支持多模型热切换的 AI 编程助手</strong>
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=AdamPAN.cline-multi"><img src="https://img.shields.io/visual-studio-marketplace/v/AdamPAN.cline-multi.svg?style=flat-square" alt="VS Code Marketplace"></a>
  <a href="https://marketplace.visualstudio.com/items?itemName=AdamPAN.cline-multi"><img src="https://img.shields.io/visual-studio-marketplace/d/AdamPAN.cline-multi.svg?style=flat-square" alt="Downloads"></a>
  <a href="https://github.com/Adam-PAN/cline-multi/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue.svg?style=flat-square" alt="License"></a>
</p>

## 简介

Cline Multi 基于 [Cline](https://github.com/cline/cline) 构建，是一款支持多模型配置和热切换的 AI 编程助手。它能够使用您的 CLI 和编辑器，通过工具逐步处理复杂的软件开发任务，包括创建和编辑文件、探索大型项目、使用浏览器以及执行终端命令（在您授权之后）。

### 核心特性

- **多模型热切换** — 保存多个 API 配置预设，在工作中随时切换不同模型，每个配置独立存储价格
- **国产模型深度适配** — 针对 DeepSeek、Mimo、Kimi 等国产模型优化提示词，提升中文输入下的表现
- **友好错误提示** — 模型不存在、内容拦截、服务器错误、超时等场景显示中文友好提示卡片
- **实时成本监控** — 聊天界面底部实时显示 Token 用量和费用
- **完整中文支持** — 界面全面中文化，中文 prompt 优化
- **全功能 AI 助手** — 文件读写、终端命令、浏览器操作、MCP 服务器等完整能力

## 安装

### VS Code 插件市场（推荐）

1. 打开 VS Code
2. 按 `Ctrl+Shift+X` 打开扩展面板
3. 搜索 **Cline Multi**
4. 点击安装

### 手动安装

从 [GitHub Releases](https://github.com/Adam-PAN/cline-multi/releases) 下载最新的 `.vsix` 文件，然后：

1. 在 VS Code 中按 `Ctrl+Shift+P`
2. 输入 `Extensions: Install from VSIX...`
3. 选择下载的 `.vsix` 文件

## 使用

1. 安装后点击侧边栏的 Cline Multi 图标
2. 在设置中配置你的 API Provider 和密钥
3. 可以保存多个配置预设，在主界面底部快速切换
4. 在聊天框中输入任务，Cline Multi 会逐步帮你完成

## 支持的模型

| Provider | 示例模型 |
|----------|----------|
| Anthropic | Claude Opus 5, Claude Sonnet 5, Claude Fable 5, Claude Mythos 5 |
| OpenAI | GPT-5.6 Sol/Terra/Luna, GPT-5.5, GPT-5.4, o4-mini |
| DeepSeek | DeepSeek V4 Pro/Flash, V4 Flash Vision, V4 Flash 0731 (1.3M ctx) |
| Google | Gemini 3.7 Flash, Gemini 3.1 Pro, Gemini 2.5 Pro |
| Qwen/通义 | Qwen3.8 Max/Flash, Qwen3 Coder Plus/Flash, Qwen3.7 |
| Kimi/Moonshot | Kimi K3 (1M ctx), Kimi K2.7 Code, Kimi K2.6 |
| GLM/智谱 | GLM-5.3 Flash (1.3M ctx), GLM-5.3, GLM-5.2, GLM-5 |
| XAI/Grok | Grok 4.20 (2M ctx), Grok 4.6, Grok 4.5, Grok 4.3 |
| Doubao/豆包 | Seed 2.1 Turbo, Seed 2.0 Code, Seed 2.0 Lite |
| MiniMax | MiniMax M3 (1M ctx), MiniMax M2.7 |
| 更多... | Ollama, LM Studio, Mistral, Fireworks, Nebius 等 |

## 项目地址

https://github.com/Adam-PAN/cline-multi

欢迎 Star ⭐、Fork 🍴、提出 Issue 和贡献代码！

## 更新日志

详见 [CHANGELOG.md](CHANGELOG.md)

最近更新 (v4.1.0)：
- **全厂商模型下拉框支持自由输入** — 可输入任意自定义模型 ID
- **新增 Claude 5 全系列** — Opus 5, Sonnet 5, Fable 5, Mythos 5
- **国产模型大规模更新** — Kimi K3 (1M), GLM-5.3 Flash (1.3M), Qwen3.8, Seed 2.1 等
- **XAI/Grok 新模型** — Grok 4.20 (2M ctx), Grok 4.6/4.5/4.3
- **OpenAI 新模型** — GPT-5.6 Sol/Terra/Luna 及 Pro 变体
- 详见 [CHANGELOG.md](CHANGELOG.md)

## 许可证

本项目基于 [Apache-2.0](LICENSE) 许可证开源。

原版 Cline 版权归属于 [Cline 团队](https://github.com/cline/cline)。



