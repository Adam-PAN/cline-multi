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
| Anthropic | Claude 4 Sonnet, Claude 4 Opus |
| OpenAI | GPT-4o, GPT-4, GPT-5 |
| DeepSeek | DeepSeek-V4-Pro, DeepSeek-V4-Flash, DeepSeek-R1 |
| Google | Gemini 2.5 Pro |
| Mimo | mimo-v2.5-pro, mimo-v2.5 |
| Moonshot | Kimi K2, Kimi K3 |
| 更多... | Ollama, LM Studio, Qwen, Doubao 等本地/国产模型 |

## 项目地址

https://github.com/Adam-PAN/cline-multi

欢迎 Star ⭐、Fork 🍴、提出 Issue 和贡献代码！

## 许可证

本项目基于 [Apache-2.0](LICENSE) 许可证开源。

原版 Cline 版权归属于 [Cline 团队](https://github.com/cline/cline)。

