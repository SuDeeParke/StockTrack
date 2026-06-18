# Spec: Phase 1 T6 Frontend Infrastructure

## Objective
为 StockTrack 前端建立基础设施：Tailwind v4 暗色主题、TanStack Query、React Router 布局 Shell，以及可复用的 API 客户端层。

## Commands
- Install: `npm install @tanstack/react-query @tanstack/react-query-devtools react-router-dom axios`
- Install dev: `npm install -D tailwindcss @tailwindcss/vite`
- Build: `npm run build`

## Project Structure
- `src/api` -> 前端 API 客户端与响应类型
- `src/components` -> 通用布局组件
- `src/pages` -> 路由页面
- `src/index.css` -> 全局 Tailwind 与主题变量

## Code Style
使用 TypeScript + 函数组件，沿用现有 Vite/React 结构，小步增量修改，不扩展额外状态管理方案。

## Testing Strategy
本任务以静态基础设施为主，不新增单测；以 `npm run build` 作为验收验证，确保类型检查与生产构建通过。

## Boundaries
- Always: 保持 proxy 配置不变、只新增 Tailwind 插件、仅修改任务要求的前端文件
- Ask first: 变更后端接口、修改任务文档、引入额外架构层
- Never: 修改 `backend/`、`tasks/todo.md`、`tasks/plan.md`、`public/`

## Success Criteria
- 安装指定依赖
- `vite.config.ts` 添加 `@tailwindcss/vite`
- `src/index.css` 替换为暗色主题 Tailwind v4 全局样式
- 新增 API client、布局组件、占位页面
- `src/App.tsx` 重写为 Router + QueryClient Provider
- `npm run build` 成功

## Plan
1. 安装依赖并记录任务约束
2. 配置 Tailwind 与 API 基础层
3. 实现布局 Shell 和占位路由
4. 运行构建验证
