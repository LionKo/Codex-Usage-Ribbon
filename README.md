# Codex Usage Ribbon

Windows 版 Codex 桌面用量栏：在输入框下方显示生成速度、首 token 延迟、缓存命中率和上下文占用。

从 Codex++ 提取的独立社区项目，仅启用用量状态栏。不是 OpenAI 官方产品，不包含 Codex 桌面应用或模型服务。

## 让 Codex 帮你安装

在目标 Windows 电脑上打开 Codex，将下面整段提示词复制到聊天中。Codex 会检查环境并执行安装；如果当前窗口需要重启才能启用用量栏，会先完成安装，再告诉你如何重新打开，避免中断正在进行的聊天。

```text
请直接在这台 Windows 电脑上安装 Codex Usage Ribbon，并验证结果，不要只给我安装教程。
项目：https://github.com/LionKo/Codex-Usage-Ribbon

请按以下步骤操作：
1. 阅读仓库当前的 README.md、INSTALL.zh-CN.md 和安装脚本，确认系统及前置条件。使用这台电脑的实际用户目录和 CODEX_HOME，不照搬其他电脑的路径。若不是 Windows，请说明当前安装脚本仅支持 Windows。
2. 从本仓库最新正式 Release 下载 Codex-Usage-Ribbon-Windows.zip 及同名 .zip.sha256 文件，核对 SHA256 后再解压执行。公开下载不需要 GitHub 登录，也不需要安装 Git、GitHub CLI 或 Python。可使用 PowerShell 下载，入口为：
   https://github.com/LionKo/Codex-Usage-Ribbon/releases/latest/download/Codex-Usage-Ribbon-Windows.zip
   https://github.com/LionKo/Codex-Usage-Ribbon/releases/latest/download/Codex-Usage-Ribbon-Windows.zip.sha256
3. 默认安装到当前用户的 %LOCALAPPDATA%\Codex-Usage-Ribbon，保证 install.ps1 和 start.vbs 位于最终安装目录。如果已经安装，先检查版本、目录和运行状态，保留 runtime 数据及本地修改，不盲目覆盖正在使用的文件。
4. 先在安装目录运行 powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 -CheckOnly 检查环境。自动化时直接调用 install.ps1，避免 install.cmd 末尾的 pause 等待输入。仅当缺少 Node.js 或版本低于 24 时，使用官方渠道安装 Node.js 24 或更新版本；已有符合要求的版本不要重复安装，无需 npm install。安装后刷新当前进程的 PATH 或打开新终端，复查 node --version 及脚本检查结果。若遇到系统权限或交互限制，准确说明需要我完成的最少步骤。
5. 确认 Codex 桌面版已安装、本机已登录并完成至少一轮聊天。如果缺少本地会话数据库，请让我完成一轮聊天后继续，不复制其他电脑的账号或聊天数据。Magpie 是可选项，不要因其未安装而中止，也不要为了它修改模型服务配置：没有 Magpie 时缓存和上下文仍可用，速度可能为整轮估算，首 token 延迟可能显示 --。
6. 检查通过后运行 powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\install.ps1，确认退出码为 0，并验证桌面 Codex Usage Bar 快捷方式指向本次安装目录中的 start.vbs。不要修改官方 Codex 安装文件、auth.json 或模型配置。
7. 若现有 Codex 已启用本机 9337 调试端口，可运行 start.vbs 并检查 runtime 日志、辅助进程及有用量记录的聊天中是否出现状态栏。若当前 Codex 没有启用调试端口，不要强制结束正在运行的 Codex；先完成安装，告诉我在本轮任务结束后正常退出所有 Codex 窗口，再从 Codex Usage Bar 快捷方式启动。重新打开后继续验证；不能仅凭创建快捷方式就声称状态栏已经显示。

最后用中文告诉我：安装目录、Node.js 检查结果、快捷方式是否创建、状态栏是否已验证，以及是否还需要我正常重启 Codex。遇到失败请根据实际错误排查，不要把 Magpie 缺失或暂无用量记录误判成安装失败。
```

## 下载与安装

1. 从 [Releases](https://github.com/LionKo/Codex-Usage-Ribbon/releases/latest) 下载 `Codex-Usage-Ribbon-Windows.zip`。
2. 在新电脑安装 Codex 桌面版，登录并完成至少一轮本地聊天。
3. 解压 ZIP 到长期保留的目录，运行 `install.cmd` 自动检查环境。
4. 只有提示缺少 Node.js 或版本过低时，才安装 [Node.js 24 或更新版本](https://nodejs.org/en/download)，保留加入 PATH 的选项，再运行 `install.cmd`。已有符合要求的版本无需重复安装，也无需 `npm install`。检查通过后会创建 **Codex Usage Bar** 桌面快捷方式。
5. 完全退出 Codex，再从这个快捷方式启动。

新名称用于 GitHub 和发行包；桌面快捷方式仍叫 **Codex Usage Bar**。完整步骤、停止和卸载方法见 [安装说明](INSTALL.zh-CN.md)。也可以下载仓库源码 ZIP，解压后使用同一个安装脚本。

## 数据来源

- 缓存和上下文：只读本机 Codex 的会话索引及用量记录，按当前聊天匹配。
- 精确生成速度和首 token 延迟：读取本机 Magpie `127.0.0.1:3425` 的请求统计，需要 Codex 请求经过 Magpie。
- 缺少 Magpie 记录时，速度可能退回含等待和工具耗时的整轮估算，首 token 延迟显示 `--`。

**Magpie 是可选数据源，不是安装用量栏的前提。** Codex++ 原版使用自己的代理/网关请求日志，不要求 Magpie。本移植版只保留状态栏，没有移植原版代理/网关，当前通过 Magpie 补充请求计时数据；缓存和上下文不依赖它。

辅助程序使用本机 `127.0.0.1:9337` 调试连接，不修改官方安装目录、登录或模型配置。它不迁移账号、密钥和聊天历史；没有自动升级或开机自启。Codex 页面或日志格式变化后可能需要适配。详见 [实现与统计口径](README.zh-CN.md)。

## 开发与打包

需要 Node.js 24+；打包另需 Python 3。无需 npm 依赖。

```powershell
# 不依赖真实会话或 Magpie 的单元测试
node --disable-warning=ExperimentalWarning --test --test-name-pattern="^(?!live local)" test/usage.test.mjs
# 模拟系统进程，不实际启动或关闭 Codex
powershell -NoProfile -ExecutionPolicy Bypass -File test/launch.test.ps1
# 完整测试另外需要本机 Codex 会话及匹配的 Magpie 记录
node --disable-warning=ExperimentalWarning --test test/usage.test.mjs
# 输出到 releases/，使用显式文件清单排除本机数据
python package-portable.py
```

## 来源与许可

采用 **AGPL-3.0-only**。用量栏来自 [BigPizzaV3/CodexPlusPlus](https://github.com/BigPizzaV3/CodexPlusPlus)，固定提交 `f84a53080c3e8c88bbe09cd8b09340bfaca3cf79`。`vendor/statusline.js` 保持原样，数据适配和启动宿主的来源及修改说明见 [NOTICE](NOTICE)，完整许可证见 [LICENSE](LICENSE)。
