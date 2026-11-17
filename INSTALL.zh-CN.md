# Codex Usage Ribbon：在另一台 Windows 电脑安装

适用于 Windows 版 Codex 桌面应用。这个包不包含 Codex 或模型服务。

## 一次性准备

1. 安装并打开 Codex 桌面版，完成登录，在本机完成至少一轮聊天。
2. 从 https://nodejs.org/en/download 安装 **Node.js 24 LTS** 的 Windows 安装程序，保留加入 PATH 的默认选项。本工具不需要 npm install。
3. 如需完整的速度和首 token 延迟，在这台电脑安装、启动 Magpie，并让 Codex 的模型请求经过它。默认读取 `http://127.0.0.1:3425`。

## 安装与使用

1. 把 ZIP 复制到这台电脑，解压到准备长期保留的目录，例如 `D:\Tools\CodexUsageBar`。必须先解压，不要直接在压缩包内运行。
2. 双击 `install.cmd`。它检查 Node.js、Codex 和 Magpie，并创建桌面快捷方式 **Codex Usage Bar**，不需要管理员权限。
3. 双击桌面的 **Codex Usage Bar**，打开有用量记录的聊天，输入框下方会出现状态栏。

以后都从这个快捷方式打开带状态栏的窗口。启动器复用已运行的 Codex，不另开实例。如果已有 Codex 未启用调试端口，会提示你先结束任务、完全退出 Codex，再从用量栏快捷方式启动。

从旧版升级时，请先正常退出所有 Codex 窗口，再从用量栏快捷方式启动一次。新版使用官方默认窗口配置，不再使用旧的 `runtime/codex-profile`。旧目录会保留，其中的窗口布局等界面偏好不会自动迁移。

如果安装完 Node.js 仍提示找不到它，重新打开安装脚本；仍失败时重新登录 Windows 后再试。若你的 Codex 是自定义安装路径，先打开 Codex 再执行安装脚本。

## 数据与兼容性

- 界面、图标和计算函数来自 Codex++ 原版用量状态栏。
- 速度和首 token 延迟读取**新电脑本机 Magpie**的请求统计；缓存和上下文读取**新电脑本机 Codex**的会话记录。
- Magpie 没有记录时，速度可能退回整轮近似吞吐，首 token 显示 `--`。它不会从原电脑带来账号、API Key 或历史聊天。
- 如果新电脑直接连接另一台机器上的 Magpie，本包默认地址不适用，需要另行配置数据源；仅改模型 Base URL 不会改变本包的统计地址。
- 使用官方默认 Electron 窗口配置及单实例锁，继续使用该电脑原有 CODEX_HOME；不会改写模型或登录配置。
- 本机调试端口固定为 9337。Codex 页面或日志格式更新后，可能需要适配。本包已在 Windows、Node.js 24.19.0、Codex 26.1111.2228.0 上验证，尚未在你的目标电脑验证。

## 停止、移走与卸载

双击 `stop.vbs` 可移除状态栏并退出辅助进程，Codex 保持打开。再用快捷方式启动即可恢复。

移动解压目录后重新运行 `install.cmd`，更新快捷方式路径。卸载时先运行 `stop.vbs` 并正常关闭 Codex 窗口，再删除解压目录和桌面快捷方式即可。没有开机自启、全局安装或注册表配置。

## 开源说明

包内保留完整运行源码及 AGPL-3.0-only 许可证，详见 NOTICE / LICENSE。vendor/statusline.js 与 NOTICE 中固定的 Codex++ 提交逐字节一致。只有状态栏模块被启用。

辅助进程没有 npm 依赖。`test/usage.test.mjs` 包含计算与数据读取验证；最后一个测试需要本机已经有 Codex 会话和 Magpie 请求记录。
