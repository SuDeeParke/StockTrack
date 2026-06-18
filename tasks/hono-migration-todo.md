# Hono 迁移任务清单

> 详细说明见 `tasks/hono-migration-plan.md`
> 状态：`[ ]` 待开始 · `[~]` 进行中 · `[x]` 完成

---

## Phase A · 基础设施

- [x] **H-01** · 项目骨架：server/ 目录、package.json、tsconfig、tsx 开发启动、根 scripts
- [x] **H-02** · 共享类型层：server/types/index.ts，镜像 models.py 全部 14 个接口

### Phase A Checkpoint
- [x] `npm run server:dev` 启动无报错
- [x] `tsc --noEmit` 通过
- [x] 类型与 `src/api/client.ts` 人工比对一致

---

## Phase B · 业务切片（依赖 H-01、H-02，三个切片可并行）

- [x] **H-03** · Signals 切片：signals-mock.ts + routes/signals.ts + 7 个测试用例
- [x] **H-04** · Backtest 切片：backtest-engine.ts + routes/backtest.ts + 6 个测试用例
- [x] **H-05** · Portfolio 切片：futu-mock.ts + routes/portfolio.ts + 8 个测试用例

### Phase B Checkpoint
- [x] `npm run server:test` ≥20 个测试全部通过
- [ ] 信号看板、回测、交易面板三页面视觉验证通过
- [ ] 与 FastAPI 并行对比所有端点响应结构

---

## Phase C · 系统服务（依赖 Phase B）

- [x] **H-06** · Health + Admin + Scheduler：data-cache.ts + scheduler.ts + routes/admin.ts + 4 个测试用例
- [ ] **H-07** · 生产构建：esbuild 打包 + Hono serveStatic + 单进程验证

### Phase C Checkpoint
- [ ] `npm run build:full` 成功
- [ ] 生产模式 `http://localhost:3000` 前端 + API 均可访问
- [ ] Scheduler 日志显示两个 cron job 注册成功

---

## Phase D · 对齐与收尾（依赖 Phase C）

- [ ] **H-08** · 开发体验对齐：vite.config.ts 代理目标 :8000 → :3000，热重载验证
- [ ] **H-09** · 清理旧后端：backend/ 删除 + Dockerfile.server + docker-compose 更新

### Phase D Checkpoint（迁移完成）
- [ ] docker-compose 一键启动验证
- [ ] 13 个 API 端点逐一 curl 验证通过
- [ ] 前端所有页面功能与迁移前行为一致
- [ ] `backend/` 目录确认已安全删除
