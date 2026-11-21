# Antigravity · 结城理独立动效版 (Persona 3 Reload Motion Theme)

面向 Windows 版 **Antigravity**（基于 `2.34.0` 验证）的《女神异闻录 3 Reload》结城理视觉与动效主题包。支持**官方原版独立安装**与 **个人自动维护脚本 `AntigravityChineseAuto` 共存模式**，并通过按安装路径、版本与基底 SHA-256 隔离的事务化替换流程保护客户端归档。

![P3R 水花与会话切换预览](./P3R水花60fps预览.gif)

---

## 核心特性

- **按安装实例与基底 SHA-256 隔离的事务化安装/卸载**：
  - **独立同卷原子替换**：跨卷部署时先在目标同目录写入 `.tmp` 并校验 SHA-256，再通过同卷 `[IO.File]::Replace` 提交并记录 `transaction.json`；任何阶段失败会自动回滚并校验原始 SHA-256，若回滚未完成则保留恢复材料与提示路径，绝不照常清理或自动重启客户端。
  - **严格目标识别**：显式传入 `-InstallDir` 无效时直接报错退出，绝不静默回退默认路径；未指定 `-InstallDir` 且本机存在多套 Antigravity 时列出全部路径并要求用户显式指定；仅当安装目录匹配个人维护脚本管理的 `%LOCALAPPDATA%\Programs\antigravity` 时才启用 `chinese-auto` 模式。
  - **独立基底绑定**：每套客户端按 `installs/<installKey>.json` 绑定 `backups/<installKey>/<version>/<sha16>/app.asar`，绝不自动猜测 `resources\app.asar.bak`。若检测到已主题化的 `app.asar` 在外部被第三方补丁改写，安装器会直接拒绝执行并提示先恢复干净基底，避免静默降级或覆盖。
- **左/右工作台侧边栏与分栏统一度**：
  - 左侧导航栏接入夜蓝钴靛斜光底纹、右缘细青边界与工程头/折叠切换钮反馈，并在暗色模式下与左侧对话标题栏对齐夜蓝视觉；
  - 右侧辅助工作台/浏览器分栏自动识别并标记为 `[data-makoto-sidepane]`（与主对话/首页画布严格隔离），配合分栏拖拽分隔条统一配色、标签卡底线高亮与 URL 地址栏聚焦光效；当内部存在激活的内嵌浏览器视口 `[data-browser-hole]` 时，强制保持分栏自身及其祖先链透明无遮挡。
- **首页与会话 6 秒 Spine 动态立绘及无缝转场**：
  - 接入《结城理-储君》模组抬手取景待机 Spine 动画（`portrait-idle.webm`）与「0 結城 理 / 愚者」双层名牌、侧栏振翅蓝蝶、对话眨眼头像、夜蓝命令牌面板。
  - 会话切换基于缓存复用的 `<video>` 对象（就绪检查含 `readyState >= 2 && videoWidth > 0`）、纯合成器层 `transform/opacity` 过渡、提交后首帧 `rAF` 同步启动与视口级轻量渐显，消除长对话及左侧项目栏切换时的抽帧与掉帧。
- **原生刷新率 P3R 液态水花引擎**：
  - 基于 Canvas 2D 实时绘制双层有机水波环（`wob(a, s)`）、渐细飞沫羽流、速度对齐液滴与上升气泡；按角色实测坐标自动拟合最小不裁边画布，单帧绘制耗时 `< 0.5 ms`，单帧卡顿步进钳位，适配 60 / 120 / 144 / 165 Hz 显示器。
- **「自动化 / 个性化定制 / 设置」全页面覆盖**：
  - **自动化（列表与新建/编辑表单）**与**个性化定制（插件市场 / 已安装）**：配置斜角点阵、双速水光波纹、水下/塔罗专属几何光环、跨页随动蓝蝶，支持跨页与子标签切换四重联动；主推精选卡片（Featured Spotlight）的主操作按钮（如 `+ 添加`）采用与「开启新会话 / 设置侧栏」同款的 P3R 命令牌样式（悬停/聚焦切青光底牌）搭配斜角青边辅助按钮（`详情`）与高对比度卡片按钮，在日光与暗色模式下均清晰可辨。
  - **设置弹窗 & 全界面弹出层**：保持时钟相位连续的倒挂 SYSTEM 立绘 + 入水下潜回弹与局部水花，并将侧栏「显示选项」「新建项目 / SSH Host...」等 Base UI 菜单与悬浮提示气泡统一接入夜蓝青边视觉风格。

![自动化与定制立绘动效预览](./自动化与定制立绘动效预览.gif)

---

## 验证范围与兼容矩阵

| 客户端 / 补丁形态 | 当前验证状态 | 安装与卸载行为说明 |
| --- | --- | --- |
| **Windows 官方英文原版 `2.34.0`** | 已验证（离线沙箱安装/卸载全流程 + 跨盘原子替换 & 回滚断言 + 无头 Edge 渲染） | 直接从干净 `app.asar` 备份基底并部署主题；卸载双击 **`卸载并恢复原版界面.cmd`** 按 SHA-256 精确恢复至安装前的原版 `app.asar`。 |
| **个人自动维护脚本 `AntigravityChineseAuto`（`2.34.0`）** | 已验证（默认路径共建/升级/恢复链路） | 仅当安装目录为 `%LOCALAPPDATA%\Programs\antigravity` 且存在完整维护脚本时启用。双击 **`恢复纯汉化界面.cmd`** 可精确恢复纯汉化 `app.asar` 界面、移除 `enabled` 并清除 `update-hook.cjs` 挂钩（`maintain.cjs` 中保留因缺少 `enabled` 而不触发的扩展槽位定义，即“恢复界面”而非逐字节恢复个人维护脚本原文件）。 |
| **第三方社区汉化补丁（修改 `app.asar` 的方案）** | 仅通过合成归档离线仿真（未对各具体发行版逐一实机全流程验证） | 若目标 `app.asar` 处于**未主题化的干净汉化状态**，安装器会保留该汉化作为基底并记录独立 SHA-256 清单，卸载可还原至该汉化基底；若此前已在主题化归档上直接被第三方补丁改写，安装器会**拒绝运行并提示先恢复干净的汉化基底**后再叠加主题。 |

---

## 安装与卸载（Windows）

### 前置依赖
- **Windows 版 Antigravity**（基于 `2.34.0` 验证）
- **Node.js 18+**（独立安装需本机可调用 `node`，未安装可执行 `winget install OpenJS.NodeJS.LTS`；`AntigravityChineseAuto` 共存模式可复用 `config.json` 中配置的 Node）

### 安装步骤
1. 下载或克隆本仓库：
   ```powershell
   git clone https://github.com/970316ml-cloud/antigravity-makoto-motion.git
   ```
2. 双击 **`安装结城理动效版.cmd`**（或运行 `powershell -ExecutionPolicy Bypass -File .\Install-Theme.ps1`）：
   - 若装在自定义目录或本机并存多个 Antigravity 安装，请显式指定：`.\Install-Theme.ps1 -InstallDir "你的Antigravity目录"`；
   - 安装脚本会校验安装目录、检查无未完成事务 `transaction.json`、生成按路径与 SHA-256 隔离的基底备份，并在提交流程前再次核对 `app.asar` 摘要与版本号后原子替换。
   - **社区汉化更新提示**：升级社区汉化前建议先卸载主题恢复干净基底、更新汉化后再运行本安装器，避免混杂改写导致拒绝继续。

### 卸载 / 恢复安装前界面
- **官方原版 / 干净社区汉化基底用户**：双击 **`卸载并恢复原版界面.cmd`**（或带 `-InstallDir` 执行 `.\Install-Theme.ps1 -Restore -InstallDir "..."`），按安装记录与 SHA-256 校验恢复对应的 `app.asar`。
- **个人自动维护脚本 `AntigravityChineseAuto` 用户**：双击 **`恢复纯汉化界面.cmd`** 恢复纯汉化界面并禁用窗口过渡挂钩。

---

## 随附程序来源与校验（`WindowTransitions.exe`）

Windows 主窗口收放过渡禁用由源码 [theme/WindowTransitions.cs](./theme/WindowTransitions.cs)（23 行 C# 调用 `GetWindowThreadProcessId` 与 `DwmSetWindowAttribute`）编译得到，未包含第三方依赖：

- **可复现构建脚本**：[build-helper.ps1](./build-helper.ps1)
- **构建命令**：
  ```powershell
  C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /nologo /target:winexe /optimize+ /out:theme\WindowTransitions.exe theme\WindowTransitions.cs
  ```
- **本次构建工具链**：Microsoft (R) Visual C# Compiler `4.8.9221.0` (`NET481REL1LAST_25H2`)
- **当前 `theme/WindowTransitions.exe` SHA-256**（记录于 [theme/WindowTransitions.sha256](./theme/WindowTransitions.sha256)）：
  `9ed843c4940528844de2a8d81f43bb49fc733f9d60dc8d5fce13447731f893f5`
- **运行时安全降级**：[theme/window-events.cjs](./theme/window-events.cjs) 在启动该 EXE 前会核对 `WindowTransitions.exe` 与 `WindowTransitions.sha256`；若缺失或校验不匹配（例如用户自行删除或系统安全策略拦截），仅跳过禁用窗口过渡的辅助调用并输出警告，主界面主题与动效照常运行。

---

## 目录结构

```text
antigravity-makoto-motion/
├── Install-Theme.ps1              # 事务化同卷原子替换、路径隔离与卸载脚本
├── build-helper.ps1               # 从 WindowTransitions.cs 重新构建辅助程序并生成 .sha256
├── prepare.cjs                    # 离线 ASAR 构建、基底清单与严格摘要校验脚本
├── window-hook.cjs                # 汉化维护脚本窗口事件挂载器
├── update-extension.txt           # 汉化升级扩展模板（带内容寻址备份）
├── 安装结城理动效版.cmd           # 一键安装入口
├── 卸载并恢复原版界面.cmd         # 一键还原安装前基底入口
├── 恢复纯汉化界面.cmd             # 个人自动维护脚本恢复纯汉化入口
├── 使用说明.txt                   # 中文详细说明
└── theme/
    ├── asar.cjs                   # 零依赖 ASAR 读写与 SHA-256 完整性重算器
    ├── patch.cjs                  # 严格参数锚点校验补丁注入与 vm.Script 检查
    ├── renderer.js                # 动效编排、Canvas P3R 水花引擎与分栏隔离状态机
    ├── makoto.css                 # 主体视觉风格与夜蓝/浅蓝配色令牌
    ├── motion.css                 # 立绘呼吸、蓝蝶、水波与交互过渡动效
    ├── pages.css                  # 自动化、个性化定制、设置与透明孔穿透样式
    ├── window-events.cjs          # 窗口还原绘制等待与 EXE SHA-256 校验监听
    ├── WindowTransitions.cs       # Windows DWM 窗口过渡禁用源码
    ├── WindowTransitions.exe      # 上述源码编译产物（可选辅助）
    ├── WindowTransitions.sha256   # WindowTransitions.exe SHA-256 摘要清单
    └── art/                       # 模组提取贴图与 Spine WebM 资源（见下方声明）
```

---

## 代码许可与第三方美术素材声明

- **脚本与样式代码**：本仓库内的安装脚本（`*.ps1`、`*.cmd`）、补丁构建器（`*.cjs`）、前端渲染脚本与样式表（`renderer.js`、`*.css`）以及辅助程序源码 `WindowTransitions.cs` 均为项目实现代码。
- **第三方美术与动画素材（`theme/art/`）**：`theme/art/` 目录下的角色立绘、Spine 动作视频（`portrait-idle.webm`）、名牌/阿卡纳/蓝蝶/命令牌等美术资源源自《女神异闻录 3 Reload》社区模组 `P3Makoto`（结城理-储君）及原作相关素材。**上述来源致谢不构成第三方美术资源的公开再分发授权**；相关素材仅用于个人非商业研究与主题预览，若需公开二次分发整包，请自行取得素材权利人授权或替换为自制/已授权素材。