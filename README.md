# 双彩研究工作台 V12.2 · 自动数据与三研究员长期战绩

**目标：一次升级，集中解决四项问题**：历史自动更新、GitHub Actions 定时采集、仓库历史快照、三研究员自动记录/开奖后核对；同时验证超级大乐透更新状态。

> 本项目仅用于统计研究和娱乐。历史冷热、遗漏与走势图不意味着提高中奖概率。自动提交的 A/B/C 候选与随机基准之间的差异，不能直接解释为稳定预测能力。

## 已经包含

- `history.json`：最近 40 期双色球与 40 期大乐透的**真实第三方历史数据启动快照**。数据来自 `yangxb919/lottery-data` 公共数据仓库，其自述来源为 500.com；**不是官方独立核验数据**。截至该启动快照：双色球 2026124 / 2026-10-29，大乐透 2026123 / 2026-10-28。启动后自动任务尝试扩充完整历史库。
- `sync_history.py`：标准库 Python 抓取脚本，尝试第三方历史库与独立机构 API 核验；镜像地址不算独立来源。支持官方有最新一期但第三方尚未更新时的 `official-only` 标记；冲突隔离、旧数据保留、期号规范化。
- `automation_research.mjs`：A 数据研究员、B 经验研究员、C 走势研究员与随机基准同策略内核。仅在已有开奖足够新、目标开奖日仍在将来时自动生成本期研究记录，开奖后核对命中情况。
- `research.json`：公开自动研究档案，初始为空。自动任务成功后写入仓库；实盘记录与历史模拟回测严格区分。
- `.github/workflows/update-lottery-data.yml`：GitHub Actions 计划任务。按北京时间约 10:16、23:26 尝试运行；GitHub 可能延迟或偶尔跳过定时执行。也可手动点击 Run workflow。
- 首页及“研究战绩”页显示自动研究记录与长期平均主区/后区命中数，和随机基准直接对照。私人 iPhone 守号、锁定记录不会上传 GitHub。

## iPhone 安装说明（必须分两步）

**第 0 步：先备份。** 用现有 V12.1「数据质量中心」中的“下载完整 JSON 备份”，如有单独旧研究档案也导出。不要清除 Safari 网站数据。

**第 1 步：一次性上传普通文件。** 解压 V12.2 压缩包，打开 `01_上传到GitHub仓库根目录`，全选里面的 **15 个文件**，而不是上传 ZIP 或文件夹。访问：

https://github.com/wu17786646707-alt/Lottery-workbench/upload/main

上传、覆盖同名文件后，滑到页面底部点击 **Commit changes**。其中新增 `history.json`、`research.json`、`automation_research.mjs`、`package.json`，其他文件为 V12.2 更新。所有文件都位于仓库根目录。

**第 2 步：创建 GitHub Actions 工作流（一次配置，以后不用重复）。** GitHub 要求工作流位于专用 `.github/workflows/` 路径，无法仅靠把 YAML 上传到仓库根目录启用。使用这个入口：

https://github.com/wu17786646707-alt/Lottery-workbench/new/main?filename=.github%2Fworkflows%2Fupdate-lottery-data.yml

如果页面没有自动填入文件名，请在创建文件时把文件名填写为：

`.github/workflows/update-lottery-data.yml`

复制压缩包 `02_自动任务_在GitHub新建文件粘贴/工作流内容_复制粘贴.txt` 的全部内容，粘贴到 GitHub 编辑区，再点击 **Commit changes** 保存。

**第 3 步：允许自动任务写入仓库。** 打开仓库 Settings → Actions → General → Workflow permissions，选 **Read and write permissions**，点击 Save。如果组织政策不允许写入，请在 GitHub 里调整仓库权限；这和之前 ChatGPT 连接 GitHub 遇到的 403 是不同的权限。

https://github.com/wu17786646707-alt/Lottery-workbench/settings/actions

**第 4 步：首次实际运行。** 打开 Actions，点击 `Lottery data and public research` → `Run workflow` → 选 `main` → `Run workflow`。必须看见本工作流绿色成功，不是只看 `pages build and deployment` 绿色。

https://github.com/wu17786646707-alt/Lottery-workbench/actions

首次运行后，应看到仓库根目录的 `history.json` 自动扩充（如果第三方网络可用），`research.json` 的 `generatedAt` 更新。只有数据足够新且下一期开奖未发生时才会生成待开奖的公开研究记录；否则会标记原因并等待下一次任务，不虚构记录。

**第 5 步：在手机验收。**

https://wu17786646707-alt.github.io/Lottery-workbench/?v=12.2

- 顶部显示 V12.2；双色球和大乐透分别可以同步查看真实历史记录。
- 研究战绩出现“GitHub 自动研究员 · 公开提前记录”；没有完成开奖的记录显示待开奖，不会出现虚构实盘成绩。
- 研究战绩长期排行榜要等真实的提前锁定期次开奖、再次完成自动数据更新后才有统计。
- “数据质量中心”明确区分官方双源核验、官方单源、第三方单源；官方接口不稳定时可能无法独立核验，不能承诺每期都自动完成。

## 准确性与限制

1. 依赖公开第三方数据源和机构接口。官方接口可能因反爬、结构变化或节假日调整不可用；系统必须保留标记而不是伪造最新期开奖。
2. 工作流按常规开奖星期配置：双色球每周二、四、日；大乐透每周一、三、六（休市除外）。休市期间研究员可能暂停自动锁定，防止过期数据形成伪前瞻记录。
3. “自动提前记录”的写入时间以 GitHub Actions 工作流运行和 Git 提交时间为参考，仓库所有者理论上仍可重写历史，因此不是独立第三方不可篡改公证。
4. 公共 GitHub 仓库会公开 `history.json` 和自动研究记录，但**不会上传手机上的个人选号、守号或本地预测记录**；不要把秘密或个人信息写入仓库。
5. 保持原 `lottery_v12` IndexedDB 数据库存储键；升级页面不会主动抹除旧版本机数据。网页清理缓存时请区分缓存和网站数据。
6. 完整部署只能在你完成 GitHub 的上传、工作流文件创建、权限设置和首次成功运行后确认。ChatGPT 目前不能使用已连接 GitHub 权限直接写入仓库（之前返回 403）。

## 本地测试

在有 Python 3.11+ 和 Node.js 22+ 的环境中：

```bash
npm test
python -m unittest discover -s tests -p 'test_*.py'
node --check app.js
```

本次创建的 7 项 JavaScript 自动测试和 3 项 Python 采集测试使用独立测试样例，不会把模拟开奖号写入正式 `history.json`。实际官方接口访问和 iPhone Safari 端到端需上线后验收。
