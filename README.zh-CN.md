# LionKo Codex Usage Lens：实现说明

从 Codex++ 单独提取的用量状态栏。保留它原来的图标、12px 字体、输入框下方居中布局和计算函数；鼠标指向某个指标时，只显示该项的一两行简短说明。只运行状态栏，不运行 Codex++ 管理器、网关、供应商切换、主题、桌宠或插件系统。

## 使用

安装步骤见 `INSTALL.zh-CN.md`。运行 `package-portable.py` 将可分发安装包和 SHA256 校验文件输出到 `releases`。运行时生成的 `runtime` 数据不进入源码仓库或发行包。

双击 `start.vbs`，或桌面上的 **Codex Usage Bar**。打开一个已有聊天后，输入框下方显示速度、首 token 延迟、缓存命中和上下文占用。新聊天尚无用量时不借用其他聊天的数据。

只需关闭用量栏时双击 `stop.vbs`，会移除本次注入的状态栏并退出辅助进程，Codex 保持打开。下次 `start.vbs` 可以重新启用。

需要已安装的 Node.js 24 或更新版本，无 npm 依赖。辅助进程连接本机 `127.0.0.1:9337` 调试端口，仅注入状态栏模块。退出 Codex 后，辅助进程最多约一分钟内退出。没有开机自启。

## 启动窗口

用量栏入口使用官方默认 Electron 配置和单实例锁，不再创建独立的 `runtime/codex-profile`。检测到 Codex 已运行时只唤起已有窗口，不再启动第二个实例；快速重复点击或使用不同端口也不会绕过检查。仍使用原有 CODEX_HOME。

**旧版升级后**：结束当前任务并正常退出所有 Codex 窗口，再从 **Codex Usage Bar** 启动一次，即切回默认配置。旧的 `runtime/codex-profile` 保留在磁盘上，不再用于新启动；其中的窗口布局等界面偏好不会自动迁移。

如果先从普通 Codex 图标启动，已有进程可能未启用调试端口；此时用量栏入口会提示完全退出后再使用用量栏入口，不会另开一个实例。辅助程序不改官方安装目录，也不改 `config.toml` / `auth.json`。

## 数据口径

- **速度、首 token 延迟**：只读现有 Magpie `http://127.0.0.1:3425/v1/magpie/usage/requests?agent=codex&limit=100`，把会话 ID、输出 token、请求耗时、首 token 耗时映射为 Codex++ 请求记录，再调用原版计算函数。每个会话取最近最多 10 次有效请求；解码速度 = 总输出 token / 总首 token 后耗时。异常样本按原版规则排除。
- **缓存、上下文**：按会话 ID 从 Codex 本机 SQLite 索引查找 rollout，只读文件尾部的 token_count，按 Codex++ 的原版口径计算。不会拿最后活跃的另一个聊天冒充当前聊天。
- **没有请求计时**：沿用原版退回 rollout 的整轮近似吞吐，悬停明确说明口径；没有足够数据时显示 `--`。这是基于已完成调用更新的统计，不是每个流式 token 实时测速。
- **悬停提示**：速度、首 token 延迟、缓存、上下文各自显示简短解释；速度和延迟注明最近最多 10 次请求统计，估算速度明确包含等待与工具耗时，无数据时显示“暂无数据”。上下文另显示总容量。计算口径留在本节：首 token 延迟按输出 token 加权；速度排除首 token 后耗时不足 50ms 或速度超过 5000 tok/s 的样本。
- **与完整版的区别**：布局和计算代码原样保留，悬停提示由适配层简化。速度的原始记录由 Magpie 提供，而不是再加一层 Codex++ 网关。因此不能保证与另一条网络链路上的完整版数值完全相等，也不等于 Magpie 自己页面的测速算法。

## 源码与验证

`vendor/statusline.js` 与上游固定提交逐字节一致，来源、修改说明和许可证见 `NOTICE` / `LICENSE`。本目录包含完整对应源码，许可 AGPL-3.0-only。

- `data.mjs`：只读数据适配。
- `host.mjs` / `cdp.mjs`：最小注入宿主；页面重建自动重新注入。
- `adapter.js`：只开启状态栏，提供分项简短悬停提示，禁用消息旁的额外 token 角标。
- `test/usage.test.mjs`：计算、会话隔离、缺失计时与本地数据测试。
- `test/launch.test.ps1`：单实例复用、旧版过渡、默认配置启动和环境变量恢复测试。

运行数据验证：`node --disable-warning=ExperimentalWarning --test test/usage.test.mjs`。

运行启动回归验证：`powershell -NoProfile -ExecutionPolicy Bypass -File test/launch.test.ps1`（模拟系统进程，不实际启动或关闭 Codex）。

不支持自动升级；Codex 页面结构若改变，可能需要适配。所有原始请求数据留在本机，辅助程序仅访问本机 Magpie 和本机 Codex 调试端口。
