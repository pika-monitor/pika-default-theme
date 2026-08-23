# Pika 默认主题开发指南

默认主题是一套清晰、稳定且便于二次开发的公开状态页。浅色和暗色模式共享一致的圆角、间距和信息层级；暗色模式使用标准 slate 中性色、低对比边框、蓝色主色和克制阴影，不依赖装饰性特效。公共接口、状态规则和隐私规则通过组件与领域层统一维护。

## 目录

```text
src/
├── styles/tokens.css          # 所有主题颜色、圆角和阴影
├── components/
│   ├── ui/                    # Card、加载/空状态、时间选择器
│   ├── status/                # 状态、统计、指标和证书组件
│   └── charts/                # 图表 Tooltip
├── domain/
│   ├── agents/                # 设备公开展示规则
│   └── monitors/              # 服务状态、隐私和证书规则
├── layouts/                   # 公共页面骨架
└── pages/                     # 数据获取和页面组合
```

页面负责查询、筛选和组合组件，不负责解释后端状态。主题个性主要集中在 token、公共布局和基础组件中。

## 修改品牌和主题颜色

所有颜色位于 `src/styles/tokens.css`：

```css
:root {
    --theme-brand: ...;
    --theme-canvas: ...;
    --theme-panel: ...;
}

.dark {
    --theme-brand: ...;
    --theme-canvas: ...;
    --theme-panel: ...;
}
```

页面和组件通过 Tailwind 语义类使用这些变量：

```tsx
<div className="border-line bg-panel text-content">
    <span className="text-content-secondary">说明</span>
</div>
```

常用语义：

| 类名 | 用途 |
| --- | --- |
| `bg-page` | 页面背景 |
| `bg-panel` | 卡片和控件表面 |
| `bg-panel-muted` | 次级区域、轨道、图标底色 |
| `text-content` | 主要内容 |
| `text-content-secondary` | 说明和标签 |
| `text-content-muted` | 弱化信息和占位符 |
| `border-line` | 默认边框 |
| `text-brand` | 链接、选中态和品牌操作 |
| `text-success` | 正常、在线、可用 |
| `text-warning` | 高延迟、临期、接近阈值 |
| `text-danger` | 离线、失败、已过期 |

## 使用通用组件

```tsx
import {
    Card,
    MetricBar,
    StatCard,
    StatusBadge,
    StatusSummary,
} from '../components/index';
```

### Card

```tsx
<Card padding="lg" title="标题" description="说明">
    内容
</Card>

<Card interactive>
    可点击内容
</Card>
```

Card 不包含页面业务；可交互状态只使用边框和表面颜色变化，页面不要重复实现额外的悬浮特效。
所有主卡、统计卡、详情指标卡、空状态和表格容器都使用 `rounded-card`，深浅模式共用 `--theme-radius-card`，从而保持一致的圆角。按钮和输入框使用 `rounded-control`。

### 状态

```tsx
<StatusBadge status="healthy"/>
<StatusBadge status="degraded"/>
<StatusBadge status="down"/>
<StatusBadge status="unknown"/>
```

不要在页面中自行映射后端的 `up/down/unknown`。设备和服务状态分别由 `domain/agents` 和 `domain/monitors` 解释。

### 统计

```tsx
<StatCard
    label="在线设备"
    value={12}
    icon={LinkIcon}
    tone="success"
/>
```

### 资源指标

```tsx
<MetricBar
    type="cpu"
    label="CPU"
    value={63.5}
    icon={Cpu}
    detail="8 核"
/>
```

MetricBar 内部统一处理类型颜色与 `75% / 90%` 阈值，页面不要重复阈值判断。

## 公开数据规则

设备离线时只展示离线状态，不展示可能陈旧的实时速率、流量和连接数据。服务不可用时不展示旧延迟和旧趋势。

设备到期和连接掉线是两个独立状态：到期使用 warning/amber 日期徽标，并可通过“已过期”筛选；掉线使用 danger/rose 连接提示。设备可能同时处于到期和掉线状态，不要用设备名称颜色混合表达这两个概念，也不要在名称旁添加笼统的“异常”标签。

服务目标必须通过：

```ts
getPublicMonitorTarget(monitor)
```

搜索目标必须通过：

```ts
canSearchMonitorTarget(monitor, keyword)
```

禁止绕过 `showTargetPublic` 直接输出或搜索 `monitor.target`。

## 设计约束

- 业务页面不要新增硬编码 Hex 颜色，颜色优先通过主题 token 和语义类表达。
- 卡片、控件和页面背景不要在业务页面单独覆盖暗色配色。
- 不要为 Card 重复实现发光、扫描线、装饰角或其他主题特效。
- 中文标题和正文使用系统无衬线字体。
- `font-mono` 仅用于数字、时间、主机名、地址和技术字段，不应用于标题或长段正文。
- 不要只通过颜色表达状态，应配合文字或图标。
- 深浅模式保持信息架构、尺寸、圆角和状态表达一致，只调整表面与文本对比度。

## 提交前检查

```bash
npm run lint
npm run build
```

同时检查：

- 360px、768px、1280px 和 1440px 布局；
- 浅色与暗色模式；
- 键盘焦点；
- 离线设备和异常服务；
- 隐藏目标地址；
- `prefers-reduced-motion`。
