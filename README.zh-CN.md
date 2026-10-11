# Rhino Studio

**上传参考图，让建模智能体在 Rhino 8 中生成可编辑的三维模型。**

这是一个本地桌面建模工作站，现有实践主要面向珠宝首饰。图片和尺寸要求由 Codex 分析，生成 C# RhinoCommon 计划，通过 MCP 在独立 Rhino 工作文档中执行，再导出 3DM、STL 和真实四视图。

[安装与使用](docs/INSTALLATION.md) · [英文主页](README.md) · [版本记录](CHANGELOG.md)

## 能做什么

- 上传、拖入或粘贴图片，补充设计要求、主体尺寸和厚度。
- 选择首饰主体或金属组件，以及 STL 曲面网格参数。
- 自主建模；过程演示模式额外记录分步截图。
- 查看顶视、透视、前视和右视，下载模型。
- 管理历史作品：搜索、重命名、批量删除、回收站恢复。

## 启动

支持目标为 Apple Silicon Mac、本机 Rhino 8、Rhino-MCP-Platform 和已登录的 Codex CLI；需要 Python 3.9+。最初实测组合为 Rhino 8.34 与插件 0.1.5。无需安装 npm 或 pip 依赖。

```sh
git clone https://github.com/AmadeusGB/rhino-studio.git
cd rhino-studio/web
python3 server.py
```

先打开 Rhino；插件未连接时运行 `MCPConnect`。浏览器访问 http://localhost:8765 。也可以在 macOS 双击 `web/start.command`，后台启动并打开网页。

图片分析会调用在线服务并消耗账户额度，模型和任务资料保存在本机 `web/data/`。备份时保留整个目录。删除作品不会释放磁盘空间。

## 发布状态

v1.1.0 整理了 C# 执行引擎、加工参数和 STL 导出修复，发布检查通过 29 项自动化测试。本次发布未重新进行真实 Rhino 全链路验收；自动测试不能代替实际建模检查。

单张照片中的背面、深度与未给出的尺寸需要推断。闭合有效的模型仍需检查最小壁厚、连接、自交、刀具可达性和装夹。网格参数不等于机床加工公差；STL 导入时选择毫米。运行时 Rhino 可能切换到前台。

只适用于可信使用者的本地工作站，不应直接开放到公网。当前界面为中文。

代码采用 [MIT 许可证](LICENSE)。外部软件依赖遵循各自许可。
