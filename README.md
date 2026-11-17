# LionKo Codex Usage Lens

Windows 版 Codex 桌面用量栏：在输入框下方显示生成速度、首 token 延迟、缓存命中率和上下文占用。

从 Codex++ 提取的独立社区项目，仅启用用量状态栏。不是 OpenAI 官方产品，不包含 Codex 桌面应用或模型服务。

## 下载与安装

1. 从 [Releases](https://github.com/LionKo/LionKo-Codex-Usage-Lens/releases/latest) 下载 `LionKo-Codex-Usage-Lens-Windows.zip`。
2. 在新电脑安装 Codex 桌面版，登录并完成至少一轮本地聊天。
3. 安装 [Node.js 24 或更新版本](https://nodejs.org/en/download)，保留加入 PATH 的选项，无需 `npm install`。
4. 解压 ZIP 到长期保留的目录，双击 `install.cmd`，创建 **Codex Usage Bar** 桌面快捷方式。
5. 完全退出 Codex，再从这个快捷方式启动。

新名称用于 GitHub 和发行包；桌面快捷方式仍叫 **Codex Usage Bar**。完整步骤、停止和卸载方法见 [安装说明](INSTALL.zh-CN.md)。也可以下载仓库源码 ZIP，解压后使用同一个安装脚本。

## 数据来源

- 缓存和上下文：只读本机 Codex 的会话索引及用量记录，按当前聊天匹配。
- 精确生成速度和首 token 延迟：读取本机 Magpie `127.0.0.1:3425` 的请求统计，需要 Codex 请求经过 Magpie。
- 缺少 Magpie 记录时，速度可能退回含等待和工具耗时的整轮估算，首 token 延迟显示 `--`。

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
