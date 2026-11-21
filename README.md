# Antigravity · 结城理独立动效版 (Persona 3 Reload Motion Theme)

面向 Windows 版 **Antigravity**（基于 `2.34.0` 验证）的《女神异闻录 3 Reload》结城理视觉与动效主题包。支持**全新官方原版独立安装**与**汉化伴生共存双模式**。

![P3R 水花与会话切换预览](./P3R水花60fps预览.gif)

---

## 核心特性

- **三形态兼容适配（官方英文原版 + 社区开源汉化补丁 + 个人自动维护脚本）**：
  1. **官方英文原版 Antigravity**：直接双击 `安装结城理动效版.cmd` 独立部署至 `%LOCALAPPDATA%\Programs\AntigravityMakotoMotion`，备份干净 `app.asar` 并关闭桌面窗口闪屏过渡。
  2. **社区主流开源汉化补丁**（如 `MIMICTE/Antigravity-zh-CN`、`antigravity-2.0-zhcn`、`Antigravity-CN` 等基于 `app.asar` / `preload.js` 注入的方案）：**先装好社区汉化，再运行本主题安装器**；安装器会自动优先读取当前已汉化的 `app.asar` 作为基底备份并叠加主题与安全作用域护栏，不会覆盖原社区汉化；更新社区汉化后重跑一次本安装器即可保留最新汉化；卸载时精确恢复至安装前的社区汉化版 `app.asar`。
  3. **个人自动维护脚本 `AntigravityChineseAuto`（可选兼容）**：仅在本机已装有该个人自动脚本时才启用更新维护挂钩协同模式，并非前置依赖。
- **左/右工作台侧边栏与分栏统一度**：
  - 左侧导航栏接入夜蓝钴靛斜光底纹、右缘细青边界与工程头/折叠切换钮反馈，并在暗色模式下与左侧对话标题栏对齐夜蓝视觉；
  - 右侧辅助工作台/浏览器分栏自动识别并标记为 `[data-makoto-sidepane]`（与主对话/首页画布严格隔离），配合分栏拖拽分隔条统一配色、标签卡底线高亮与 URL 地址栏聚焦光效，同时强制保护 `[data-browser-hole]` 透明通道以确保内嵌浏览器画面零遮挡。
- **首页与会话 6 秒 Spine 动态立绘及无缝转场**：
  - 接入《结城理-储君》模组抬手取景待机 Spine 动画（`portrait-idle.webm`）与「0 結城 理 / 愚者」双层名牌、侧栏振翅蓝蝶、对话眨眼头像、夜蓝命令牌面板。
  - 会话切换基于缓存复用的 `<video>` 对象、纯合成器层 `transform/opacity` 过渡、提交后首帧 `rAF` 同步启动与视口级轻量渐显，消除长对话及左侧项目栏切换时的抽帧与掉帧。
- **原生刷新率 P3R 液态水花引擎**：
  - 基于 Canvas 2D 实时绘制双层有机水波环（`wob(a, s)`）、渐细飞沫羽流、速度对齐液滴与上升气泡；按角色实测坐标自动拟合最小不裁边画布，单帧绘制耗时 `< 0.5 ms`，单帧卡顿步进钳位，适配 60 / 120 / 144 / 165 Hz 显示器。
- **「自动化 / 个性化定制 / 设置」全页面覆盖**：
  - **自动化（列表与新建/编辑表单）**与**个性化定制（插件市场 / 已安装）**：配置斜角点阵、双速水光波纹、水下/塔罗专属几何光环、跨页随动蓝蝶，支持跨页与子标签切换四重联动；主推精选卡片（Featured Spotlight）的主操作按钮（如 `+ 添加`）采用与「开启新会话 / 设置侧栏」同款的 P3R 命令牌样式（悬停/聚焦切青光底牌）搭配斜角青边辅助按钮（`详情`）与高对比度卡片按钮，在日光与暗色模式下均清晰可辨。
  - **设置弹窗 & 全界面弹出层**：保持时钟相位连续的倒挂 SYSTEM 立绘 + 入水下潜回弹与局部水花，并将侧栏「显示选项」「新建项目 / SSH Host...」等 Base UI 菜单与悬浮提示气泡统一接入夜蓝青边视觉风格。

![自动化与定制立绘动效预览](./自动化与定制立绘动效预览.gif)

---

## 安装与卸载（Windows）

### 前置依赖
- **Windows 版 Antigravity**（已在官方 `2.34.0` 原版及汉化版实测）
- **Node.js 18+**（原版独立安装需本机可调用 `node`，未安装可执行 `winget install OpenJS.NodeJS.LTS`；已装 `AntigravityChineseAuto` 时可自动复用其内置 Node）

### 安装步骤
1. 下载或克隆本仓库：
   ```powershell
   git clone https://github.com/970316ml-cloud/antigravity-makoto-motion.git
   ```
2. 双击 **`安装结城理动效版.cmd`**（或运行 `powershell -ExecutionPolicy Bypass -File .\Install-Theme.ps1`）：
   - 自动定位 Antigravity（若装在自定义目录，可执行 `.\Install-Theme.ps1 -InstallDir "你的Antigravity目录"`）；
   - 自动识别原版独立安装或汉化共存模式，备份干净的当前版本 `app.asar` 后写入主题并重启客户端。

### 卸载 / 恢复安装前界面
- **官方原版 / 社区开源汉化用户**：双击 **`卸载并恢复原版界面.cmd`**（将从备份精确还原安装前的官方原版或社区汉化版 `app.asar` 并清除启用标志）。
- **个人自动维护脚本 `AntigravityChineseAuto` 用户**：双击 **`恢复纯汉化界面.cmd`**。

---

## 目录结构

```text
antigravity-makoto-motion/
├── Install-Theme.ps1          # 双模式自动检测、备份与原子替换安装器
├── prepare.cjs                # 离线 ASAR 构建与校验脚本（支持 standalone / chinese-auto）
├── window-hook.cjs            # 汉化维护脚本窗口事件挂载器
├── update-extension.txt       # 汉化升级扩展模板
├── 安装结城理动效版.cmd       # 一键安装入口
├── 卸载并恢复原版界面.cmd     # 一键还原官方原版入口
├── 恢复纯汉化界面.cmd         # 一键还原纯汉化入口
├── 使用说明.txt               # 中文详细说明
└── theme/
    ├── asar.cjs               # 零依赖 ASAR 读写与 SHA-256 完整性重算器
    ├── patch.cjs              # 原版/汉化兼容补丁注入与 vm.Script 校验
    ├── renderer.js            # 动效编排、Canvas P3R 水花引擎与视图状态机
    ├── makoto.css             # 主体视觉风格与夜蓝/浅蓝配色令牌
    ├── motion.css             # 立绘呼吸、蓝蝶、水波与交互过渡动效
    ├── pages.css              # 自动化列表/表单、个性化定制、设置与弹出菜单样式
    ├── window-events.cjs      # 窗口还原等待绘制监听
    ├── WindowTransitions.cs   # Windows 窗口过渡控制源码
    ├── WindowTransitions.exe  # 窗口过渡辅助可执行文件
    └── art/                   # 模组提取贴图与 Spine WebM 资源
```

---

## 致谢

- 视觉立绘、Spine 动作与相关 UI 素材源自《女神异闻录 3 Reload》相关社区模组 `P3Makoto`（结城理-储君）。
