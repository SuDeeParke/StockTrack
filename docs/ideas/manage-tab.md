# 管理 tab — 持仓驱动的量化指挥台（MVP：纯 mock）

## 问题陈述

**如何让 StockTrack 通过「管理」tab 维护用户实际持有的 A 股/美股持仓，让信号看板、策略回测、交易页全部消费同一张表——因为 StockTrack 是「对自己的持仓做量化」的工具，重复数据源 = 重复录入负担？**

---

## MVP 定位：纯 mock

**本期（v1）只做「持仓管理 + 信号/回测演示」，全程跑在 mock 数据上，不接 BaoStock 真实数据。**

原因（详见文末「BaoStock 兼容性附录」）：当前真实数据集成（`baostock-api`）是一个写死 6 只 A 股的 demo，且无美股源、无缓存、按需取数会打爆数据源。让 manage-tab 的「任意持仓 → 任意 ticker 产信号」跑在真实数据上，需要先对 BaoStock 服务做一轮改造（Phase 1.5），这超出本期范围。

**本期纪律：**
- 信号引擎用 mock（`computeIndicators + deriveSignal` 在 `genOHLCV` 上跑），任意 ticker 都能产 signal。
- **新端点的契约按真实数据定型**（接受任意 ticker、返回 `stale` 字段、预留缓存语义），这样 Phase 2 换真实引擎时前端零改动。
- UI 必须明确标注「信号/回测为模拟数据」，不对外宣称「真实量化决策」。

---

## 推荐方向

**`user_positions` 是唯一的持仓真相源。** 所有视图（管理 / 信号看板 / 策略回测 / 交易）都从这一张表读。

### 关键架构决策

- **替换旧的持仓存储**（`server/services/portfolio-db.ts`）。注意：现状不是裸 `positions` 表，而是把 `Position[]` 作为 **加密 JSON blob**（per-user）存在 `positions` 表的 `data` 列（见 `server/services/db-schema.ts`）。迁移 = 新建 `user_positions` 行结构表 + 重写 `portfolio-db.ts` 读写逻辑;旧 blob 是 mock 数据，可丢弃。
- **`user_positions` 同时承担两件事**：
  1. 用户手动声明的持仓来源（管理 tab 编辑）
  2. 订单成交的最终落点（Trade 下单 → 成交 → upsert `user_positions`）
- **所有视图读同一张表 + 计算同样的派生字段**：
  - `current_price` = `genOHLCV(ticker)` 最后一根 K 线 close（mock 下确定性、零成本；真实化后需走缓存，见附录）
  - `market_value` = `shares * current_price`（读时计算，不存）
  - `pnl` = `(current_price - cost_basis) * shares`（读时计算，不存）
- **不同入口的不同编辑能力**：
  - 管理 tab：可手动 CRUD
  - Trade tab：可下 BUY/SELL 单，成交时自动 upsert（BUY 加仓算新 avg_cost；SELL 减仓，0 时移除）

### 数据模型

```sql
CREATE TABLE user_positions (
  id INTEGER PRIMARY KEY,
  ticker TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  market TEXT NOT NULL CHECK (market IN ('CN', 'US')),
  shares INTEGER NOT NULL CHECK (shares >= 1),
  cost_basis REAL NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

> shares 步进校验在路由层按 market 执行（CN：min=100 且 100 步进；US：min=1 无步进约束），不在 DDL 里写死，避免跨 market 逻辑混入数据库层。

`cost_basis` 必填（`NOT NULL`）：从管理录入的需要 cost_basis；从 Trade 成交的按 fill price 写入。统一字段语义。

### API 表面

```
GET    /api/positions              -- list
POST   /api/positions              -- create (管理 tab 用)
PATCH  /api/positions/:id          -- update (管理 tab 用)
DELETE /api/positions/:id          -- delete (管理 tab 用)
POST   /api/positions/bulk-delete  -- bulk delete
GET    /api/positions/signals      -- 仅返回管理中 tickers 的信号 (Dashboard 默认)
GET    /api/signals                -- 市场级 (Dashboard 「全市场」tab 退化保留)
DELETE /api/portfolio/positions    -- ❌ 删除
```

> 契约约定（即使 v1 跑 mock）：`/api/positions/signals` 必须接受任意 ticker、对每条持仓返回 `stale` 字段、并预留缓存语义（按交易日）。这样 Phase 2 接真实引擎时前端无需改动。

### 信号引擎扩展（mock）

`signals-mock.ts` 加 `computeIndicators(ohlcv)` + `deriveSignal(indicators)`，让任意 ticker 都能在 mock OHLCV 上产 signal。`MOCK_SIGNALS` 降级为 fallback。
> 真实信号引擎（BaoStock/InStock）留到 Phase 2，契约不变。

### 前端改造

- `pages/Manage.tsx`：列表 + 弹窗 + 多选删除（二次确认）
- `pages/Dashboard.tsx`：默认 queryKey `['positions-signals']`；「全市场」chip 保留可点击，展示原有 `MOCK_SIGNALS`，无需额外改动
- `pages/Backtest.tsx`：删除局部 watchlist，从 `/api/positions` 拉取
  > 注意：回测引擎（`backtest-engine.ts`）是纯种子随机数，换股票池来源不改变「回测数据是模拟的」事实。回测页需明确标注「模拟数据」。
- `pages/Trade.tsx`：
  - 持仓 tab：fetch `/api/positions`，客户端 map 成 `qty=shares, avg_cost=cost_basis, current_price, market_value, pnl, pnl_pct` 显示
  - 下单：placeOrder 时由后端 upsert `user_positions`
  - 风险检查：`checkRisk` 读 `user_positions` 验证 SELL 数量

### UX 细节

- 列表底部 sticky「+ 添加」（移动端 thumb zone）
- 弹窗：ticker → name 用户手填 → market 自动推断（6位纯数字→CN，否则→US）→ shares 步进（CN ±100，min=100；US ±1，min=1）
  > v1 不做任何名称自动补全，用户手填 name。真实 lookup（BaoStock `query_stock_basic`）留到 Phase 1.5。
- 勾选多选 → 顶部「删除 N 项」+ AlertDialog 二次确认
- 空状态（管理 0 条）：信号看板显示 CTA 跳管理
- 全局：信号看板 / 回测页标注「模拟数据」标签

---

## 待验证的核心假设

- [ ] **替换旧持仓存储无数据丢失**——现状是加密 JSON blob（futu-mock/portfolio-db），迁移前确认没有真实单据（mock 应可丢）
- [ ] **`user_positions.cost_basis` 必填语义对**——手动添加时要求填；Trade 成交时按 fill price 写入
- [ ] **订单成交自动 upsert `user_positions`**——用户买股票后无需再到「管理」手动加；如果有 broker 外部成交，仍可走管理 tab
- [ ] **mock 信号引擎可扩展为任意 ticker**——`computeIndicators + deriveSignal` 在 `genOHLCV` 上跑通
- [ ] **派生字段（market_value, pnl）只在读时计算**——mock 下零成本；避免存储的 current_price 过期
- [ ] **Trade 持仓 tab 的展示形态**（P&L 颜色、排序）保持不变，仅数据源换了

---

## MVP 范围

### 包含

**后端：**
- 替换 `server/services/portfolio-db.ts` 的持仓存储（加密 blob → `user_positions` 行表）
- 新建 `user_positions` 表 + 5 个 REST endpoint
- 把 `applyFill` 重写为 upsert `user_positions`（BUY 加权 avg_cost；SELL 减仓，0 时删行）
- 把 `checkRisk` 改读 `user_positions`
- 扩展 `signals-mock.ts`：`computeIndicators + deriveSignal`（任意 ticker 产 mock signal）
- 新增 `GET /api/positions/signals`（契约按真实数据定型，实现走 mock）
- 移除 `GET /api/portfolio/positions`

**前端：**
- `Layout.tsx` 新增「管理」nav item（桌面 sidebar + 移动 bottom nav）
- `pages/Manage.tsx`：完整 CRUD UI
- `pages/Dashboard.tsx`：默认 = positions-signals，「全市场」chip 保留可点击展示 `MOCK_SIGNALS`（无需重构），加「模拟数据」标注
- `pages/Backtest.tsx`：删除局部 watchlist，从 `/api/positions` 拉取，加「模拟数据」标注
- `pages/Trade.tsx`：持仓 tab 数据源改为 `/api/positions`，派生字段客户端计算
- 移动端：弹窗小屏用 shadcn `Sheet`（bottom drawer）

### 不包含（v1 之后）

- **接 BaoStock 真实数据**（Phase 1.5/2，见附录）——本期全程 mock
- **真实信号引擎**（Phase 2）——mock 已能验证 UX
- **真实回测引擎**（Phase 2）——当前是随机数
- **US 真实数据源**（Phase 2，独立立项）——BaoStock 无美股
- 多模态录入（扫码 / CSV / 剪贴板解析）
- 成本基础手动 override 后重算 P&L
- 排序 / 分组 / 搜索 / 标签
- 导入 / 导出 JSON
- 多账户 / 多用户

---

## 明确不做（及原因）

- **不保留旧的持仓存储语义**——重复数据源 = 重复录入负担；用户明确「一张表」
- **不存派生字段**（market_value, pnl）——current_price 每天变，存就过期；读时计算
- **不存 `name` 为 ticker 占位**——管理录入时通过 lookup 自动补齐 + 用户可覆盖（v1 退化手填）
- **不做扫码 / CSV**——MVP 假设 10-30 只手填够用
- **本期不接任何真实数据引擎**——mock 信号/回测已能验证 UX；真实数据 = Phase 1.5/2
- **不做多账户 / 多用户**——ADR-004 单用户
- **不让用户直接编辑 cost_basis**——v1 简化；要改就删了重建；v2 再加 P&L 重算
- **不在 DDL 写步进约束**——CN/US 步进差异在路由层按 market 校验（CN min=100 步进 100；US min=1 无步进）

---

## 待解决的开放问题

- 旧持仓 blob 的 mock 数据是否要迁移到 `user_positions`？还是直接丢？（mock 应可丢，但你确认一下）
- Trade 下单页输入 ticker 时，是不是也走 lookup 自动补齐 name？保持与管理 tab 一致
- 「删除持仓」是否要走 SELL 流程才能动？v1 简化：管理 tab 的删除是 hard delete，不走单
- 持仓 0 时的清理：Trade SELL 100/100 后自动删除该行 OK 吗？还是保留 0 股行让用户决定？
- mock 信号引擎「任意 ticker 都产信号」会不会产生噪音？比如一个从没听过的小票也每天给 BUY/SELL——是否需要最低「数据可信度」门槛（真实化后更突出）
- 「全市场」tab 退化后，是否值得保留？MVP 期间留作「探索新标的」入口即可
- 移动端底部 sticky「+ 添加」按钮 (52px) + Layout bottom nav (52px) 会不会重叠？需要测
- ticker 自动推断 market 的规则：纯 6 位数字 → CN，其他 → US？（真实化后还需 ticker→bs_code 映射，见附录）

---

## 附录：BaoStock 真实数据兼容性（为何本期纯 mock）

manage-tab 的核心主张「任意持仓 → 任意 ticker 产信号」与现有 BaoStock 集成根本不兼容。隐患：开发时 `BAOSTOCK_URL` 不可达 → 全走 mock → 一切正常；真接上 BaoStock → 白名单外的持仓全部 404 →「我的持仓看不到信号」。即**真实数据接得越成功，产品越坏**。本期纯 mock 即为规避此陷阱。

### 阻断级（Phase 1.5 必须先解决）

1. **白名单架构 vs 任意持仓**——`baostock-api/main.py` 的 `WATCH_LIST` 写死 6 只 A 股；`/ohlcv`、`/indicators` 对白名单外 ticker 直接 404。需改为「按需取数」：动态 ticker→bs_code 转换 + 动态拉取。
2. **代码格式不匹配**——应用用 `600519.SH`，BaoStock 用 `sh.600519`。需通用确定性映射 + market/交易所推断规则（6 开头→SH、0/3 开头→SZ）。
3. **BaoStock 无美股数据**——`market IN ('CN','US')` 的 US 分支真实侧永远无源。须决策：v1 真实数据只做 CN（US 标灰/标 mock），或另接 US 源（Hono 侧从零）。

### 严重级（Required）

4. **N+1 + 每票一次 login**——`bs_fetch_ohlcv` 每票 `bs.login()/logout()`，`get_signals` 串行循环。30 只持仓 = 30 次登录 + 30 次串行查询，单次请求数秒~十几秒。需单 login 复用 + 结果缓存。
5. **无缓存 + 每请求健康探测**——真实路径每次全量重取，且 `isAvailable()` 每请求多一次往返。`/api/positions/signals` 是 Dashboard 热路径，必须加按交易日 TTL 缓存（`data-cache.ts` 当前只覆盖 mock）。
6. **BaoStock 非线程安全 / 同步阻塞**——全局 login/logout 并发会互踩。ADR-004 单用户缓解，但 Dashboard + Backtest 并发拉取仍需串行化或加锁。

### 数据质量级

7. **`adjustflag="3"`（不复权）**——技术指标跨除权日跳变，金叉死叉失真。技术信号建议 `"2"`（前复权）。
8. **EOD、非实时**——`current_price` = 昨收，`stale` 写死 False。P&L/market_value 是昨收口径，UI 须标注。
9. **name 自动补全无真实后端**——BaoStock 有 `query_stock_basic` 但 `baostock-api` 未暴露。v1 退化手填，真实 lookup 留 Phase 1.5。

### 分期建议

- **Phase 1（本期，纯 mock）**：落地 `user_positions` + CRUD + 前端；信号/回测走 mock，契约按真实数据定型；UI 标注模拟。
- **Phase 1.5（BaoStock 真实化，manage-tab 真实数据的前置依赖）**：重写 `baostock-api`（去白名单、ticker 映射、单 login 复用、`query_stock_basic`、`adjustflag=2`）；Hono 侧缓存覆盖真实路径；范围只做 CN。
- **Phase 2**：真实信号引擎替换 mock（契约不变）；US 数据源独立立项；真实回测引擎。

---

*生成日期：2026-06-23 / 更新：定位为 MVP 纯 mock*

---

# Implementation Plan: 管理 tab (Draft)

> ⚠️ **Draft for review.** 一旦确认将拆分到 `docs/specs/manage-tab-spec.md`，此处保留为简版。
> 上面"待解决的开放问题"在本计划中的处置：每个受影响的任务显式标注 **DEFERRED** 并采用最简默认；如不接受请在 Review 时指出。
> 关键边界：**本期全程 mock**（见上文"MVP 定位"与附录）。所有 mock 实现的契约（端点形状、字段、缓存语义、stale 标记）按真实数据定型，Phase 1.5/2 换真实引擎时前端零改动。

---

## 架构决策

- **单一真相源**：仅 `user_positions` 一张行表。旧 `positions` 表（实际是加密 JSON blob per user，写在 `server/services/portfolio-db.ts`）在 Task 1 + Task 15 中替换掉。
- **派生字段不存**：`current_price` / `market_value` / `pnl` / `pnl_pct` 每次读取时由后端实时计算。mock 下走 `genOHLCV(ticker)` 末根 close；真实化后走 `data-cache.ts`（按交易日 TTL）。
- **信号引擎 mock 但契约真**：`computeIndicators(ohlcv) + deriveSignal(indicators)` 跑在 `genOHLCV` 的随机游走 K 线上；保留 `stale: boolean` 字段、行情 EOD 语义、按交易日缓存语义——Phase 1.5 换真实引擎时端点形状不变。
- **前端视图统一**：Layout 加 `/manage` 入口；Dashboard 默认 = positions-signals；Backtest 从 `/api/positions` 拉；Trade 持仓从 `/api/positions` 拉。
- **响应式 Dialog**：桌面 `Dialog`、移动 `< md` 用 `Sheet` (bottom drawer)；底部添加按钮避让 bottom nav。
- **UI 显式标注"模拟数据"**：Dashboard / Backtest 顶部加 `Alert` 条，避免误导。

## 依赖图

```
DB schema (Task 1)
  └─ user_positions CRUD service (Task 2)
       ├─ REST endpoints + types
       │    ├─ Frontend api client
       │    │    ├─ Layout nav (Task 3)
       │    │    ├─ Manage page (Tasks 4-6)
       │    │    ├─ Dashboard (Task 11) ← "模拟数据" Alert
       │    │    ├─ Backtest (Task 12)  ← "模拟数据" Alert
       │    │    └─ Trade (Task 8)
       │    └─ applyFill/checkRisk rewrite (Task 7)
       └─ Trade 下单回路 (Task 8)
Signal engine mock extension (Task 9)
  └─ GET /api/positions/signals (Task 10)
       └─ Dashboard default (Task 11)
```

## 任务列表

### Phase 1: Foundation

#### Task 1: DB schema — 建 `user_positions`，旧 blob 停写
**Description:** `server/services/db-schema.ts` 加 `user_positions` 表（schema 见上文数据模型一节）。**不删**旧 `positions` 表与 `balance` 表（避免连锁破坏，Task 15 才统一清）；但 Task 7 之后所有读写走新表，旧 blob 写入路径断开、读取路径兜底为空（保证向后兼容）。

**Acceptance criteria:**
- [ ] `user_positions` 表存在且 `IF NOT EXISTS` 幂等
- [ ] 旧 `positions` / `balance` 表保留 schema（暂时不动）
- [ ] 应用启动后数据库检查通过
- [ ] 模拟数据状态下无 SQL 错误

**Verification:**
- `sqlite3 data/stocktrack.db ".schema user_positions"`
- `npm run typecheck` 通过
- 启动后端无 schema warning

**Dependencies:** None
**Files:** `server/services/db-schema.ts` (or `db.ts`)
**Scope:** S

---

#### Task 2: 后端 service + REST endpoints + 前端 api client
**Description:** 新建 `server/services/positions-db.ts` 暴露 `getPositions / getPosition / createPosition / updatePosition / deletePosition / bulkDelete / getPositionsWithDerived`（`getPositionsWithDerived` 内联调 `genOHLCV` 算 `current_price` 等派生字段）。新建 `server/routes/positions.ts` 挂 5 个 endpoint + 1 个 `/signals`（signals endpoint 在 Task 10 实质化，Task 2 先挂壳返回 501）。扩展 `server/types/index.ts` 加 `UserPosition` 类型。扩展 `src/api/client.ts` 暴露同名方法。

**Acceptance criteria:**
- [ ] `GET /api/positions` 返回 `UserPosition[]`，含 `current_price / market_value / pnl / pnl_pct` 派生字段
- [ ] `POST /api/positions` 校验 `ticker / market / shares / cost_basis`；非法返回 400 + 错误消息
- [ ] `PATCH /api/positions/:id` / `DELETE /api/positions/:id` / `POST /api/positions/bulk-delete` 正常
- [ ] 前端 `api.listPositions / createPosition / updatePosition / deletePosition / bulkDeletePositions` 类型完整
- [ ] `GET /api/positions/signals` 先返回 501（占位），Task 10 替换

**Verification:**
- curl 走通 5 个 endpoint
- 前端 `useQuery({ queryKey: ['positions'] })` 类型推断无报错

**Dependencies:** Task 1
**Files:** `server/services/positions-db.ts` (new), `server/routes/positions.ts` (new), `server/index.ts` (mount), `server/types/index.ts`, `src/api/client.ts`
**Scope:** M

---

#### Task 3: Layout — 加 `/manage` nav item
**Description:** `Layout.tsx` 桌面 sidebar 与移动 bottom nav 同时新增「管理」图标 + 标签，路由 `/manage`，位置紧邻「信号看板」之后。

**Acceptance criteria:**
- [ ] 桌面 sidebar 显示「管理」并高亮当前路由
- [ ] 移动 bottom nav 显示「管理」tab，4 项布局不溢出（**DEFERRED** 4 vs 5 入口取舍 — 默认 4 项：信号/回测/管理/交易）
- [ ] JWT 鉴权受保护

**Verification:**
- 桌面 1280×800 / 移动 375×667 截图检查
- 路由跳转 `/` → `/manage` 高亮跟随

**Dependencies:** Task 2
**Files:** `src/components/Layout.tsx`
**Scope:** XS

---

**Checkpoint: After Tasks 1-3**
- [ ] 后端 `/api/positions` 全套 CRUD 可用（旧数据已隔离）
- [ ] 前端 nav 已就位
- [ ] `npm run typecheck && npm run build` 通过

---

### Phase 2: Manage Page MVP

#### Task 4: Manage 列表 + 添加弹窗
**Description:** 新建 `src/pages/Manage.tsx`；列表展示 + 桌面 Dialog / 移动 Sheet 表单（ticker / name / market / shares / cost_basis / note）；ticker 失焦触发 lookup（v1 退化：白名单 ticker 走本地映射 + 用户可覆盖；**DEFERRED** 真实 lookup 等 Phase 1.5 `query_stock_basic`）；market 推断（**DEFERRED** 规则：默认 `^\d{6}\.?(SH|SZ)?$` → CN，其余 US）；shares ±100 步进，min=100（A 股）/ 1（US）。

**Acceptance criteria:**
- [ ] 列表空态显示「还没有持仓，点击添加」
- [ ] 列表项：ticker / name / market badge / shares / cost_basis / market_value / pnl / pnl_pct
- [ ] 添加表单校验：A 股 shares 必须 100 整数倍；US 不约束
- [ ] 移动端 (≤ md) 表单为 Sheet 底抽屉
- [ ] 提交成功后列表 + 看板 + Trade 持仓都自动 invalidate

**Verification:**
- 添加 600519.SH / 100 股 / cost 1750 → 看板与 Trade 持仓同步出现
- A 股 50 股提交被拒
- 移动 375px 看到 Sheet

**Dependencies:** Task 2, Task 3
**Files:** `src/pages/Manage.tsx` (new), `src/components/ui/sheet.tsx` (如未存在)
**Scope:** M

---

#### Task 5: Manage 编辑 + 单条删除（二次确认）
**Description:** 列表项菜单/右滑触发"编辑"；编辑表单复用 Task 4 弹窗；列表项右侧删除按钮触发 `AlertDialog` 二次确认（"确认删除 600519.SH？"）。**默认 hard delete，不走 SELL 单**（DEFERRED 走 SELL 流程 — 默认 NO）。

**Acceptance criteria:**
- [ ] 编辑只允许改 name / shares / cost_basis / note（**DEFERRED** 是否允许改 ticker — 默认 NO）
- [ ] 删除后列表 + 看板 + Trade 持仓同步消失
- [ ] AlertDialog 取消保留原数据
- [ ] 删除不需要先 SELL（v1 简化）

**Verification:**
- 编辑 100 → 200 股：Trade 持仓 qty 同步
- 取消 AlertDialog：列表项仍在
- 确认后 list / dashboard / trade 三个 queryKey 都失效

**Dependencies:** Task 4
**Files:** `src/pages/Manage.tsx`, `src/components/ui/alert-dialog.tsx` (如未存在)
**Scope:** S

---

#### Task 6: Manage 多选 + 批量删除
**Description:** 列表项左侧加 checkbox，勾选后顶部出现"删除 N 项"按钮；点击触发 AlertDialog 二次确认（"确认删除以下 N 项持仓？" + 列名）。

**Acceptance criteria:**
- [ ] 至少 1 项勾选时显示"删除 N 项"按钮
- [ ] 取消勾选 / 取消 AlertDialog 还原
- [ ] 确认后批量 POST `/api/positions/bulk-delete`，全部失效

**Verification:**
- 勾 3 项 → 顶部按钮显示 "删除 3 项" → AlertDialog 列出 3 个 ticker
- 确认后 list 立即空出 3 行

**Dependencies:** Task 5
**Files:** `src/pages/Manage.tsx`
**Scope:** S

---

**Checkpoint: After Tasks 4-6**
- [ ] 管理 tab 全 CRUD 可用
- [ ] 移动端 Sheet 体验顺
- [ ] 看板、Trade 还未对接新数据源

---

### Phase 3: Trade Unification

#### Task 7: `applyFill` / `checkRisk` 重写读 `user_positions`
**Description:** `server/services/portfolio-db.ts` 重写：
- `applyFill` 改为 upsert `user_positions`（BUY 时若 ticker 已存在则加权 `cost_basis = (old_qty * old_cost + new_qty * fill_price) / new_qty`；SELL 时若减到 0 则 `DELETE` 行 — **DEFERRED** 保留 0 股行 — 默认删）
- `checkRisk` 改读 `user_positions` 校验 SELL 数量
- `balance` 反推：保持 `cash` 字段单独存，`market_value` 每次从 `user_positions` 聚合

**Acceptance criteria:**
- [ ] BUY 100 股 1750 → 表中 100 / 1750
- [ ] 再 BUY 100 股 1800 → 200 / 1775（加权）
- [ ] SELL 200 股后该行被删
- [ ] SELL 300 股（超过持仓）风控拒
- [ ] 余额与持仓表保持自洽

**Verification:**
- curl 走完 BUY → BUY → SELL → SELL(超量)，检查 `user_positions` 与 `balance` 一致

**Dependencies:** Task 2
**Files:** `server/services/portfolio-db.ts`, `server/types/index.ts`
**Scope:** M

---

#### Task 8: Trade.tsx 持仓 tab 切换到 `/api/positions`
**Description:** Trade 持仓 tab 从 `api.getPositions()` 改 `api.listPositions()`；客户端 map `UserPosition` → `Position`（`qty=shares / avg_cost=cost_basis`，派生字段直接透传）；下单成功时 invalidate `['positions']`（让 Manage、Dashboard 也都失效）；下单页 ticker 失焦自动补 name（**DEFERRED** — 默认与 Task 4 行为一致：白名单映射 + 可覆盖）。

**Acceptance criteria:**
- [ ] Trade 持仓 tab 数据与 Manage tab 实时一致
- [ ] 下单成功后持仓数同步变化
- [ ] P&L 颜色 / 排序与原版一致
- [ ] 余额卡（`BalanceCard`）数据自洽

**Verification:**
- Trade 持仓 5 条 ↔ Manage 5 条 双向一致
- Trade 下 1 单 → 立即看到变化

**Dependencies:** Task 7
**Files:** `src/pages/Trade.tsx`, `src/api/client.ts`
**Scope:** M

---

**Checkpoint: After Tasks 7-8**
- [ ] 「管理」与「Trade」两个入口都写到同一张表
- [ ] 余额 / 持仓自洽
- [ ] 旧 blob 写入路径已断

---

### Phase 4: Signal Engine (Mock) + Dashboard

#### Task 9: signals-mock 扩展 — `computeIndicators` + `deriveSignal`
**Description:** 在 `server/services/signals-mock.ts` 加 `computeIndicators(ohlcv: OHLCVBar[]): IndicatorSnapshot`（基于 `genOHLCV` 已有 bars 算 MACD/RSI/KDJ 简单近似 — EMA/SMA/标准差算子）+ `deriveSignal(indicators): SignalType`（RSI < 30 BUY，> 70 SELL，否则 WATCH — **DEFERRED** 阈值策略 — 默认经典 30/70）。任意 ticker 都能跑通。**契约必须返回 `stale: boolean`** 字段（mock 下默认 `false`，但保留给真实引擎）。

**Acceptance criteria:**
- [ ] 任意 ticker 调用 `getIndicatorSnapshot(ticker)` 都返回（含 `stale` 字段）
- [ ] MACD / RSI / KDJ_K 三指标数值合理（RSI ∈ [0, 100]）
- [ ] `MOCK_SIGNALS` 降级为 fallback（不再唯一数据源）
- [ ] 同一 ticker 多次调用结果一致（确定性 — 用 `genOHLCV` 同一 seed）

**Verification:**
- `node -e "import('./signals-mock.js').then(m => console.log(m.getIndicatorSnapshot('ZZZZ.US')))"` 返回合法值
- 同一 ticker 多次调用结果一致

**Dependencies:** None（独立 spike）
**Files:** `server/services/signals-mock.ts`
**Scope:** M

---

#### Task 10: `GET /api/positions/signals` endpoint
**Description:** 替换 Task 2 的 501 占位：从 `user_positions` 取出所有 ticker，对每个跑 `getIndicatorSnapshot` + `deriveSignal`（用 signal 末根 close 当 `price`），组装成 `Signal[]` 返回。**契约**：`{ ticker, name, market, signal_type, date, price, indicators: { macd, rsi, kdj_k }, stale: boolean }`。Phase 1.5 真实化时端点形状不变。

**Acceptance criteria:**
- [ ] endpoint 返回结构与 `GET /api/signals` 一致（多 `stale` 字段）
- [ ] `user_positions` 为空时返回 `[]`
- [ ] 含派生 ticker OHLCV 异常时不 500（降级返回 `stale: true` 或过滤）
- [ ] 性能：30 只持仓下 < 200ms（mock 下轻松达成）

**Verification:**
- Manage 3 条 → endpoint 返回 3 条 signal
- Manage 清空 → endpoint 返回 []
- wrk/ab 简单压测

**Dependencies:** Task 2, Task 9
**Files:** `server/routes/positions.ts`, `server/services/positions-db.ts`
**Scope:** S

---

#### Task 11: Dashboard 默认 = positions-signals + 「模拟数据」Alert
**Description:** `Dashboard.tsx` 把 `queryKey: ['signals', market]` 拆为：`['positions-signals']` 默认、`['signals', market]` 仅"全市场"chip 触发（**DEFERRED** 全市场 chip 是否保留 — 默认保留为右上角次级 chip）。空态（Manage 0 条时）显示 CTA 跳转 `/manage`。顶部加 `Alert`「信号为模拟数据，仅供 UX 验证」。

**Acceptance criteria:**
- [ ] 进首页默认只显示我持仓的 signal
- [ ] 切到"全市场"chip 才显示市场级 signal
- [ ] 持仓 0 时 dashboard 显示「先去管理添加持仓」CTA
- [ ] 顶部 Alert 提示模拟数据
- [ ] `stale: true` 的 signal 在行内加视觉降级

**Verification:**
- Manage 添加 1 条 → Dashboard 默认显示 1 条
- Manage 清空 → Dashboard 显示 CTA + Alert
- 点 CTA 跳 /manage

**Dependencies:** Task 10
**Files:** `src/pages/Dashboard.tsx`, `src/api/client.ts`
**Scope:** M

---

**Checkpoint: After Tasks 9-11**
- [ ] mock 信号引擎对任意 ticker 可用
- [ ] Dashboard 真实反映用户持仓
- [ ] 模拟数据 Disclaimer 显眼

---

### Phase 5: Backtest

#### Task 12: Backtest 切换到 `/api/positions` + 「模拟数据」Alert
**Description:** 删除 Backtest 页面内的局部 watchlist state，初始股票池从 `api.listPositions()` 拉；若 `user_positions` 为空则显示「先去管理添加持仓」CTA，与 Dashboard 空态一致。顶部加 `Alert`「回测数据为模拟，仅供 UX 验证」。

**Acceptance criteria:**
- [ ] Backtest 进入时股票池 = 持仓列表
- [ ] 持仓变化 → Backtest 股票池同步
- [ ] 空持仓状态有引导
- [ ] 模拟数据 Alert 显眼

**Verification:**
- Manage 5 条 → Backtest 股票池 5 个 ticker
- Manage 全删 → Backtest 显示 CTA

**Dependencies:** Task 2
**Files:** `src/pages/Backtest.tsx`
**Scope:** S

---

### Phase 6: Mobile Polish

#### Task 13: Manage 弹窗响应式 — 桌面 Dialog / 移动 Sheet
**Description:** Task 4 弹窗在 `< md` 渲染为 `Sheet` 底部抽屉，≥ md 渲染为 `Dialog` 居中模态。表单字段共用。提交按钮放 Sheet footer / Dialog footer。

**Acceptance criteria:**
- [ ] 桌面 1280px：居中 Dialog
- [ ] 移动 375px：从底部弹出的 Sheet，可拖拽
- [ ] 字段顺序、校验、文案一致

**Verification:**
- DevTools 切分辨率检查两种渲染

**Dependencies:** Task 4
**Files:** `src/pages/Manage.tsx`
**Scope:** S

---

#### Task 14: 底部添加按钮 + bottom nav 协调
**Description:** 桌面端"添加持仓"按钮在表头右侧（与页面标题同行）；移动端同样在表头右侧，**不** sticky 在底部以避开 bottom nav 52px 冲突（**DEFERRED** sticky 方案 — 默认就放表头）。滚动时不浮动。

**Acceptance criteria:**
- [ ] 桌面 1280px：按钮在「管理」标题右侧
- [ ] 移动 375px：按钮在「管理」标题右侧，bottom nav 不遮挡
- [ ] 滚动时按钮位置固定（不浮动）

**Verification:**
- 移动 375px 滚动 500 条模拟列表，按钮始终在表头不与 nav 重叠

**Dependencies:** Task 13
**Files:** `src/pages/Manage.tsx`
**Scope:** S

---

### Phase 7: Cleanup

#### Task 15: 删除 legacy `positions` / `balance` 表 + `portfolio/positions` 端点
**Description:** 删 `server/services/portfolio-db.ts` 中对 `positions` / `balance` 表的读写逻辑；删 `server/routes/portfolio.ts` 中 `DELETE /api/portfolio/positions`；删 Trade.tsx 内的 `usePositionState` 旧逻辑（如有）；`db-schema.ts` 移除 `positions` / `balance` 表的 DDL（如确认无用户数据）。

**Acceptance criteria:**
- [ ] `grep -r "positions table\|portfolio/positions" server/ src/` 无结果
- [ ] 启动后端无 SQL 错误
- [ ] 旧 blob 数据已不读不写

**Verification:**
- 全代码 grep 无引用
- 启动后端 + 走通主流程

**Dependencies:** Task 1, Task 7
**Files:** `server/services/portfolio-db.ts`, `server/routes/portfolio.ts`, `server/services/db-schema.ts`, `src/api/client.ts`
**Scope:** S

---

#### Task 16: 端到端 smoke + 空态 CTA + 「模拟数据」一致性
**Description:** 完整跑通：注册 → 登录 → 添加 2 条持仓（A 股 + 美股）→ 看 Dashboard 显示 2 个 signal（带模拟数据 Alert）→ Backtest 股票池 2 个（带模拟数据 Alert）→ Trade 下 1 单 → 持仓变化正确 → 删 1 条 → 看板/Trade 同步。空态路径：清空后所有页面 CTA 正确。Disclaimer 显式可见。

**Acceptance criteria:**
- [ ] 上述流程无报错
- [ ] 移动端 375px 全程可用
- [ ] 退出重启数据保留
- [ ] Dashboard / Backtest 模拟数据 Alert 在空态时仍可见

**Verification:**
- 录屏或截图清单完成
- 杀进程重启验证 SQLite 持久化

**Dependencies:** Task 14
**Files:** （无新增，回归测试）
**Scope:** S

---

## 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| 旧 `positions` blob 仍被某处隐式读 | 中 | Task 1 写新表、Task 7 切读写、Task 15 才删 schema；中间三步可独立回滚 |
| `genOHLCV` 随机游走误导用户当真实信号 | 中 | Dashboard / Backtest 顶部强 Alert「模拟数据」；signal 行加视觉降级（`stale`） |
| mock 信号引擎与未来真实引擎的指标计算差异 | 中 | 契约定型（含 `stale` 字段、EOD 语义、按交易日缓存语义）；Phase 1.5 替换时端点形状不变 |
| DELETE 旧 `positions` 破坏 `applyFill` 调用链 | 高 | Task 7 必须先于 Task 15；中间 commit 可回滚 |
| Sheet 在 iOS Safari 滑动手势异常 | 低 | 退路是始终用 Dialog；Task 13 验证后决定 |
| 移动 bottom nav 4 项 vs 5 项挤 | 低 | 4 项布局已确认；如加"管理"溢出则把"交易"挪入"更多" |
| 真实化（Phase 1.5/2）时 N+1 + login 风暴 | 高（未来） | 本期仅文档化风险；不预防（mock 下不存在） |
| US 数据源在 mock 阶段无真实对照 | 低 | 标注 stale 即可；Phase 2 立项 |

## 关联 Open Questions（来自 idea 一页纸）的处置

| Open Question | 本计划中的处置 | 对应任务 |
|---|---|---|
| 旧 `positions` blob mock 数据迁移 vs 丢 | **默认丢**（mock，无真实单） | Task 15 |
| Trade 下单 ticker lookup 自动补 name | **默认与 Manage 一致**（白名单映射 + 可覆盖；真实 lookup 留 Phase 1.5） | Task 8 |
| 删持仓走 hard delete vs SELL 流程 | **默认 hard delete**（管理 tab 删除不走单） | Task 5, 6 |
| 0 股时是否自动删行 | **默认删**（SELL 到 0 自动清行） | Task 7 |
| mock 信号引擎"任意 ticker"噪音 | **默认接受噪音**（不设门槛；`stale` 标记 + 模拟数据 Alert） | Task 9, 11 |
| 全市场 tab 保留？ | **保留为右上角次级 chip** | Task 11 |
| 移动端 sticky + bottom nav 重叠 | **按钮放表头右侧，避让 nav** | Task 14 |
| ticker → market 自动推断规则 | `^\d{6}\.?(SH\|SZ)?$` → CN，否则 US | Task 4 |
| BaoStock 真实数据 | **本期不做**（Phase 1.5 立项） | 全篇 |
| US 真实数据源 | **本期不做**（Phase 2 立项） | Task 11, 12 |
| 真实回测引擎 | **本期不做**（Phase 2） | Task 12 |

## 平行化机会

- **Task 9（signal engine spike）独立**：可与 Phase 1-3 并行，不需要等 user_positions 建表
- **Task 3（Layout nav）+ Task 5/6（Manage UI）**：可与 Task 1-2 的不同子集并行
- **Task 12（Backtest）**：与 Phase 4-5 互不依赖，可在中段插入

## 验证清单（实施前 review）

- [ ] 每个任务有 acceptance criteria（已具备）
- [ ] 每个任务有 verification 步骤（已具备）
- [ ] 任务依赖图无环（已具备）
- [ ] 无 L/XL 任务（最大 M；已具备）
- [ ] Phase 1-3、3-5、6-7 后均有 checkpoint
- [ ] 11 个 Open Questions 都有显式处置（已具备）
- [ ] "纯 mock" 边界在每个相关任务中已标注

## 后续阶段（不在本期范围）

- **Phase 1.5（BaoStock 真实化）**：改写 `baostock-api`（去白名单、ticker 映射、单 login 复用、`query_stock_basic`、`adjustflag=2`）；Hono 侧 `data-cache.ts` 覆盖真实路径；范围只做 CN。
- **Phase 2**：真实信号引擎替换 mock（契约不变）；US 数据源独立立项；真实回测引擎。
