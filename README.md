# LadyMuse

AI creative partner for ComfyUI — prompt generation, knowledge management, and inspiration for AI image creation.

> **LadyMuse** 是一个面向 ComfyUI 的 AI 创作伙伴。它通过对话理解你的创作意图，结合知识库与 Civitai 海量数据，帮你生成高质量的提示词。

## Features

- **Chat-based creation** — 用自然语言描述你想要的感觉，AI 帮你转化为精准的提示词
- **Multi-model support** — 支持 ZIT / SDXL / SD 1.5 / FLUX 等图像模型，自动适配提示词风格
- **Knowledge base** — 内置艺术技法、风格知识库，可扩展
- **Civitai integration** — 搜索模型、参考图片提示词、热门标签
- **Prompt management** — 保存、搜索、版本管理你生成的提示词
- **Generation tracking** — 记录出图历史与评分，持续优化
- **User profiling** — 学习你的偏好，个性化推荐关键词与风格
- **Multi-provider LLM** — 支持 OpenRouter (Claude, GPT, etc.) 和 DeepSeek

## Tech Stack

- **Frontend**: SvelteKit 5, Tailwind CSS 4
- **Backend**: SvelteKit server routes
- **Database**: SQLite via Drizzle ORM
- **AI**: Vercel AI SDK with OpenAI-compatible providers
- **External APIs**: Civitai

## Getting Started

### Prerequisites

- Node.js >= 18
- npm

### Install

```bash
git clone https://github.com/SeeleFelix/LadyMuse.git
cd LadyMuse
npm install
```

### Configure API Key

启动后在 Settings 页面配置至少一个 API Key：

- **OpenRouter** — [获取 key](https://openrouter.ai/keys)，支持 Claude、GPT 等模型
- **DeepSeek** — [获取 key](https://platform.deepseek.com/api_keys)

### Run

```bash
npm run dev
```

打开 http://localhost:5173，开始使用。

### Database

项目使用 SQLite，数据存储在 `ladymuse.db` 文件中，首次启动自动创建。数据库 migration：

```bash
npm run db:push    # 推送 schema 变更
npm run db:seed    # 填充知识库数据
```

## Project Structure

```
src/
├── lib/server/
│   ├── agent/          # AI agent (system prompt, tools, model profiles)
│   ├── db/             # Database schema and connection
│   ├── seed/           # Knowledge base seed data
│   ├── civitai.ts      # Civitai API client
│   ├── models.ts       # Model management
│   ├── config.ts       # Configuration storage
│   └── providers.ts    # LLM provider definitions
├── routes/
│   ├── api/            # REST API endpoints
│   ├── chat/           # Chat interface
│   ├── builder/        # Prompt builder
│   ├── knowledge/      # Knowledge base management
│   ├── styles/         # Style management
│   ├── prompts/        # Prompt library
│   ├── generations/    # Generation history
│   ├── inspiration/    # Creative inspiration
│   └── settings/       # App settings
└── app.html
```

## License

[GPL-3.0](LICENSE)
