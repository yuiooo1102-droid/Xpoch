# Xpoch · 率土争霸

AI 驱动的三国战争策略游戏。多个 LLM 模型作为指挥官，在 hex 地图上自主决策、征战天下。

## 项目定位

- 这是一个**战争游戏**，不是桌游模拟
- AI 模型是**玩家**，引擎只负责**执行规则**
- Prompt 告诉 AI **能做什么**（规则），不告诉它**要做什么**（策略）
- MockAdapter 仅用于引擎测试，不是游戏的核心

## 技术栈

- **Monorepo**: pnpm workspaces, TypeScript
- **Engine**: `packages/engine` — 纯逻辑，无 I/O
- **AI Adapter**: `packages/ai-adapter` — LLM 集成层
- **Shared**: `packages/shared` — 类型定义 + 常量
- **Server**: `packages/server` — Express + WebSocket（可选，用于 HTML 前端）
- **Client**: `packages/client` — React 前端（非主要维护对象）
- **TUI**: `scripts/tui*.ts` — **主要界面**，终端沙盘

## 运行方式

```bash
# Mock AI 快速测试（无需模型）
npx tsx scripts/tui.ts

# MLX 本地模型对战（Apple Silicon，推荐）
mlx_lm.server --model mlx-community/Qwen2.5-3B-Instruct-4bit --port 8081
npx tsx scripts/tui-mlx.ts

# Ollama 本地模型对战
ollama serve
npx tsx scripts/tui-ollama.ts

# 自动测试（Claude 模拟 3 方 AI 对战 20 tick）
npx tsx scripts/test-claude-play.ts

# MLX AI 测试 + 诊断报告
npx tsx scripts/test-mlx-battle.ts 30

# 全量单元测试
npx pnpm test
```

## 核心架构

### 游戏状态 (`GameState`)

```
tiles       — hex 地图（地形/归属/建筑）
armies      — 军队（将领 + 兵力 + 坐标 + 行军状态）
generals    — 将领（等级/技能/存活状态）
cities      — 城池（等级/城墙/驻军/训练队列）
factions    — 势力（资源/科技/存活）
diplomacy   — 外交关系
```

### 每 tick 执行流程

```
1. AI 决策 → executeTurnDecision()
2. 行军 → processMarches()
3. 领地扩张 → expandTerritory() + validateConnectivity() + updateTerritoryCounts()
4. 经济 → processEconomy()
5. 将领复活 → processRespawns()
6. 淘汰检查 → checkEliminations()
7. 胜利检查 → checkVictory()
8. 推进回合 → advanceTick()
```

### AI 决策格式 (`TurnDecision`)

```json
{
  "armies": [{"generalId":"zhangyi", "action":"march", "target":{"q":1,"r":0}}],
  "cities": [{"cityId":"f0-city-1", "action":"train", "troopType":"infantry", "amount":100}],
  "build": [{"hex":{"q":-6,"r":7}, "building":"farm"}],
  "research": "agriculture",
  "diplomacy": [{"action":"declare_war", "targetFactionId":"f1"}]
}
```

## 地图

三国固定地图（radius 12, 469 hex），25 座城池：

- **大城** (Lv3): 洛阳(中立)、长安(中立)、邺城(魏)、许昌(魏)、成都(蜀)、建业(吴)、武昌(吴)
- **中城** (Lv2): 襄阳、江陵、汉中、合肥、徐州、长沙、宛城 等 18 座
- **地形**: 长江水域带（天然屏障）、秦岭山地（蜀道难）
- 中立城有驻军需攻克才能占领

## 兵种系统

三角克制：步兵 > 骑兵 > 弓兵 > 步兵（1.3x 伤害加成）

| 兵种 | 攻 | 防 | 速 | 金 | 粮 |
|------|----|----|----|----|-----|
| 步兵 | 3 | 4 | 1 | 2 | 3 |
| 骑兵 | 4 | 2 | 3 | 4 | 4 |
| 弓兵 | 3 | 2 | 1 | 3 | 2 |

## 将领系统

66 名三国武将，分属蜀/魏/吴/群雄四大阵营。每将领有：
- 五维属性（攻/防/速）
- 兵种专精（步/骑/弓/全能）
- 独特技能（来自三国演义典故）
- 等级系统（战斗升级）
- 阵亡 3 tick 后复活（降 1 级）

## 资源系统

4 种资源：金/粮/木/铁
- 领地地形产出（平原+粮+金，森林+木+金，山地+铁+金）
- 建筑加成（农田+5粮，伐木场+3木，矿场+3铁，市场+4金）
- 粮食消耗：每 100 兵每 tick 消耗 1 粮
- 缺粮饥荒：损失 10% 兵力

## 科技树

12 科技，3 个时代：
- 古代：农耕、伐木、采矿、弓术、骑术
- 经典：铁器、货币、石工、兵法
- 进阶：钢铁、后勤、攻城术

## 关键设计原则

1. **引擎管规则，AI 管策略** — 不在代码里硬编码 AI 行为
2. **Prompt 只描述能力** — 告诉 AI 能做什么（规则），不告诉它要做什么（策略）
3. **不可变数据** — 所有状态更新返回新对象
4. **TUI 优先** — 终端是主要界面，HTML 前端次要
5. **本地模型优先** — MLX/Ollama 零成本运行，API 可选

## 测试迭代流程

```
1. 跑 test-claude-play.ts 或 test-mlx-battle.ts
2. 收集错误和游戏数据
3. 分析：是规则 bug？AI 理解问题？平衡问题？
4. 修引擎（规则 bug）或改 prompt（AI 理解问题）或调常量（平衡）
5. 重新测试验证
```

## 文件结构

```
packages/
  shared/src/
    types.ts          — 所有类型定义
    constants.ts      — 将领池/科技树/建筑/兵种数据
    hex-utils.ts      — hex 数学工具
  engine/src/
    three-kingdoms-map.ts — 固定三国地图 + 25 城池
    game-state.ts     — 状态创建/查询/更新
    action-executor.ts — 执行 AI 决策
    action-validator.ts — 验证决策合法性
    combat-resolver.ts — 战斗计算（兵种克制）
    economy.ts        — 经济处理（收入/消耗/饥荒）
    territory.ts      — 领地扩张/连通性
    march-system.ts   — 行军处理
    general-manager.ts — 将领管理（分配/复活/升级）
    tech-tree.ts      — 科技研究
    victory.ts        — 胜负判定
  ai-adapter/src/
    prompt-builder.ts  — 构建 AI prompt（规则 + 状态）
    response-parser.ts — 解析 AI JSON 响应
    mock-adapter.ts    — 最小兜底（仅测试用）
    openai-compatible-adapter.ts — OpenAI/Ollama/MLX 通用
    claude-adapter.ts  — Anthropic Claude
    gemini-adapter.ts  — Google Gemini
    providers.ts       — 13 家 LLM 提供商配置
    id-mapper.ts       — 短 ID ↔ 长 ID 映射
    adapter-factory.ts — 根据配置创建适配器
scripts/
  tui.ts             — Mock AI 终端沙盘
  tui-mlx.ts         — MLX 本地模型终端沙盘
  tui-ollama.ts      — Ollama 终端沙盘
  test-claude-play.ts — Claude 模拟 3 方对战
  test-mlx-battle.ts  — MLX 自动测试 + 诊断
  test-battle.ts      — Mock 快速测试
  test-prompt.ts      — 测试 prompt 质量
docs/
  GAME_DESIGN_V2.md   — v2 设计文档
  DESIGN_V3_RATETHREEKINGDOMS.md — v3 率土之滨设计
  THREE_KINGDOMS_MAP.md — 三国地图设计
  三國演義.txt        — 原文（武将/地名参考）
```

## 当前状态

- 180 测试通过
- 三国固定地图 25 城
- 66 武将 + 12 科技 + 7 建筑
- 步骑弓三角克制战斗系统
- 领地扩张 + 连通性验证
- 4 资源经济 + 饥荒机制
- 13 家 LLM 提供商支持
- MLX 1.3s/响应，Ollama 28s/响应

## 已知问题

- 蜀汉攻长安反复失败（大城城防太高，需多军协攻或攻城术科技）
- 小模型 (3B) 战略能力弱（不会选目标/判断时机），7B+ 效果更好
- TUI 地图在小终端窗口下可能显示不全
