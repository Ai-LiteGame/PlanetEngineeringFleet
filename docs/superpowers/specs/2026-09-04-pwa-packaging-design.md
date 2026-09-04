# 星球工程车队 PWA 打包设计

## 目标

把现有原生 HTML、CSS、JavaScript 学习游戏扩展为可安装、可离线运行的渐进式 Web 应用。同一份静态产物应能部署到 HTTPS 站点，并在 Windows、macOS、Android 手机和平板以及 iPhone/iPad 的现代浏览器中使用。孩子端现有游戏流程、课程内容和本地学习记录格式保持不变。

## 交付形态

`npm run package:pwa` 生成两个等价产物：

- `dist/planet-engineering-fleet-pwa/`：可直接上传到任意静态 HTTPS 托管服务的目录。
- `dist/planet-engineering-fleet-pwa.zip`：包含同一目录内容的通用发布压缩包。

PWA 不是 APK、DMG 或 EXE。安装由 Chrome、Edge、Safari 等浏览器提供的“安装应用”或“添加到主屏幕”完成。Android、iPhone 和 iPad 必须从 HTTPS 地址访问；桌面开发验收可使用浏览器认可的 `localhost` 安全上下文。直接通过 `file://` 双击 ZIP 内的 `index.html` 不属于受支持的安装方式。

## 应用清单与平台元数据

新增 `manifest.webmanifest`，包含稳定的应用标识、中文名称、短名称、描述、主题色、背景色、`start_url: "./"`、`scope: "./"` 和 `display: "standalone"`。方向使用 `any`，让桌面、横屏平板和竖屏手机沿用现有响应式布局。

`index.html` 增加 manifest 链接、Apple touch icon、应用名称、状态栏样式和移动端安装元数据。安装行为不在儿童界面增加按钮或说明文字；浏览器原生入口承担安装引导，README 面向成人说明各平台步骤。

## 图标

沿用现有深蓝、工程黄和挖掘机视觉语言，生成以下本地 PNG 文件：

- `assets/icons/icon-192.png`
- `assets/icons/icon-512.png`
- `assets/icons/icon-maskable-512.png`
- `assets/icons/apple-touch-icon-180.png`

普通图标保留圆角安全边距；maskable 图标的关键内容落在中心安全区，外围使用纯色背景，避免 Android 自适应裁切损伤车体。图标不依赖远程字体、图片或 CDN。

## 离线架构

新增 `service-worker.js`，使用显式版本号命名缓存。安装阶段完整预缓存运行所需的 HTML、CSS、JavaScript 模块、SVG 场景、车辆资源、manifest 和图标。只有全部核心资源成功缓存时，新版本才安装成功，避免产生半更新状态。

同源 `GET` 请求采用缓存优先策略：命中缓存直接返回；未命中时访问网络，并只把成功的基础响应写入运行时缓存。导航请求在网络和缓存都不可用时回退到已缓存的 `index.html`。跨域请求、非 GET 请求和浏览器扩展请求不拦截。

激活阶段删除本应用的旧版本缓存，不触碰其他站点或其他应用的 Cache Storage。新 Service Worker 立即接管后续页面请求；当前已加载课程不被强制刷新，避免孩子答题中断。学习记录继续写入现有 Local Storage，Service Worker 不读取、复制或上传任何进度。

新增独立的注册模块，由 `index.html` 在主应用模块之后加载。注册失败只写入控制台警告，游戏保持在线可用；不显示会打断儿童的错误弹窗。

## 资源清单边界

预缓存清单和打包清单使用同一个受版本控制的 `pwa-assets.js` 资源定义模块，防止“能打包但不能离线”或“能缓存但 ZIP 缺文件”。该模块只暴露缓存版本和相对文件路径，不包含浏览器或 Node 专属逻辑，因此 Service Worker 与 Node 打包脚本可以读取同一份定义。清单只包含运行时文件：

- `index.html`、`styles.css`、`manifest.webmanifest`、`service-worker.js`、`pwa-assets.js`
- `src/` 下全部 JavaScript 模块
- `assets/` 下 SVG 和 PWA 图标

测试、设计文档、Git 元数据、开发台账、`node_modules` 和旧的 `dist` 不进入发布包。构建脚本每次先安全重建明确的 `dist/planet-engineering-fleet-pwa/` 目标，不删除工作区其他目录。

ZIP 通过系统 `zip` 工具从已验证的发布目录生成。构建前检查工具是否存在，缺失时给出明确错误，同时保留已生成的静态目录，使产物仍可部署。ZIP 内以 `planet-engineering-fleet-pwa/` 为唯一顶层目录。

## 更新与版本管理

缓存版本由受版本控制的常量维护。任何会改变运行时文件内容的发布都必须同步提升缓存版本，相关自动测试负责阻止资源清单和版本遗漏。安装新版本时先建立新缓存，成功后再删除旧缓存；旧版本在新版本安装失败时继续可用。

## 安装与使用说明

README 增加以下成人操作：

- Android 手机/平板：Chrome 菜单选择“安装应用”或“添加到主屏幕”。
- Windows/macOS：Chrome 或 Edge 地址栏安装图标；macOS Safari 使用“添加到程序坞”（受当前 Safari 版本支持情况约束）。
- iPhone/iPad：Safari 分享菜单选择“添加到主屏幕”。
- 静态部署：解压 ZIP 后把顶层目录内容部署到同一 HTTPS 路径，保持文件相对位置不变。

说明卸载应用不会自动等同于导出进度；学习记录仍是单浏览器、单设备本地数据。跨设备继续学习不在本次范围内。

## 错误处理与降级

- 浏览器不支持 Service Worker：游戏仍作为普通在线网页运行。
- 首次加载时离线：无法建立缓存，显示浏览器原生网络错误；至少成功在线打开一次后才保证离线启动。
- 个别非核心运行时请求失败：返回网络错误，不伪造内容。
- Service Worker 注册或更新失败：记录警告，保留当前可用版本。
- Local Storage 不可用：继续沿用现有内存降级和成人提示。

## 测试策略

自动测试先行，覆盖：

1. manifest 必需字段、相对作用域、四种图标及 purpose 配置。
2. HTML 正确引用 manifest、图标和 Service Worker 注册模块。
3. 共享发布清单包含每个运行时模块和资源，且不存在远程 URL。
4. Service Worker 只处理同源 GET、预缓存完整、离线导航回退、旧缓存清理不越界。
5. 打包脚本产出部署目录和 ZIP，ZIP 条目与发布清单一致，不包含开发文件。
6. 现有 157 项课程、进度、荣誉和视图测试继续通过。

浏览器验收使用正式本地服务器：

- 在桌面与 390px 手机视口确认 manifest 可读取、图标非空、Service Worker 激活并控制页面。
- 首次在线加载后模拟离线，重新打开首页、课程表、地图和课程，确认资源来自缓存且学习记录仍可读写。
- 检查控制台无应用错误，页面无横向溢出，安装元数据不改变现有布局。

## 非目标

- 不生成 APK、AAB、DMG、PKG、EXE 或 Microsoft Store/App Store 包。
- 不增加账号、云同步、推送通知、后台音频、广告、分析或网络 API。
- 不在儿童游戏界面增加安装、更新或网络状态控制。
- 不改变课程目录、掌握度算法、荣誉系统或 Local Storage 数据结构。
