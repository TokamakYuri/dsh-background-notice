# dsh-background-notice

DSH 后台通知插件：任务完成、终止或失败时在 DSH 内提醒；需要你选择时弹出 Windows 系统窗口，支持点选、多选和直接输入文字。

## 功能

- **任务完成**：DSH 右下角弹出绿色「任务已完成」卡片并播放上行提示音，15 秒自动收起，点击卡片可打开对应会话。
- **任务终止**：你主动停止本轮后，弹出灰色「任务已终止」卡片并播放低缓的下行提示音，15 秒自动收起，不再误报为完成。
- **任务失败**：本轮以错误、进程中断或登录失效结束时，弹出红色「任务执行失败」卡片并播放下行提示音，显示错误信息，需手动关闭。
- **提问**：弹出置顶的 Windows 系统窗口，显示问题、选项和文本框；支持单选、多选，也支持直接输入文字作为答案。
- **审批**：系统窗口显示工具名和原因，提供「允许一次 / 拒绝」。
- **回落**：关闭或取消系统窗口时，请求会回到 DSH 原有的提问/审批界面，不会把任务卡住。

## 安装

需要 Windows 和 DSH Desktop Web GUI。把本项目放在工作区，然后用插件管理器安装该目录：

```text
plugin_manager install_bundle target=<项目目录>
```

安装后修改 Host 代码时，用插件管理器把 bundle 关闭再开启即可触发重组加载，无需重启应用。

## 结构

| 文件 | 作用 |
| --- | --- |
| `index.js` | Host 端：注册 `turn/end` 结果投影，拦截 `user-questions/request` 与 `approval/request`，校验答案，取消时回落 |
| `turn-outcome.js` | 从 `turn/end` 的 reason 折叠出失败与用户终止两种终态，供浏览器端区分完成、终止与失败 |
| `native-dialog.js` | 启动/回收 PowerShell 子进程，负责 stdin/stdout JSON 协议 |
| `alert-window.ps1` | PowerShell + WPF 系统窗口：主题、选项、多选、自由输入、系统提示音 |
| `client.js` | 浏览器端：监听 `ui-session` 状态，显示完成/终止/失败提醒并播放 Web Audio 提示音 |
| `locale/*.json` | 插件管理页的标题与描述 |
| `cordis.patch.yml` | 插入 `dsh-background-notice` 这一行 |

## 实现

- Host 以 `prepend` 注册在两条 waterfall 事件前面，因此系统窗口先于网页回答者出现。
- 答案以一行 `###RESULT###<json>` 从 PowerShell 的 stdout 返回；任何失败都回落到 DSH 原有流程。
- 单选时输入文字会覆盖选项；多选时文字作为补充答案；无选项问题时文字就是答案。
- 完成/终止/失败提醒在浏览器端：比较连续两次 `sessionStatus`，`running: true → false` 后读取 Host 注册的 `backgroundNotice` 投影，`turn/end` 带错误原因时显示失败样式，用户主动停止（`aborted`）时显示终止样式，否则显示完成样式。
- 结果投影会等待约 400 ms 再分类，避免投影帧晚于状态帧时把失败或终止误报成完成。

## 限制

- 仅支持 Windows；系统窗口需要交互式桌面。
- 浏览器自动播放策略可能拦截第一次提示音，在页面里点击或按键一次即可解锁。
- 没有设置页；提问和审批固定使用系统窗口。
