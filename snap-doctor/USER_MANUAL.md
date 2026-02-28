# SnapDoctor - User Manual
# SnapDoctor 用户使用手册

---

## 插件介绍

SnapDoctor（配置医生）是OpenClaw网关的自愈插件，帮助你自动备份、检测和恢复配置。

---

## 当前版本功能

| 功能 | 说明 | 状态 |
|------|------|------|
| 手动备份 | 改配置前手动备份配置文件 | ✅ 可用 |
| 健康检查 | 检查配置是否正常 | ✅ 可用 |
| 手动恢复 | 从快照恢复配置 | ✅ 可用 |
| 自动恢复 | 检测到问题后自动恢复 | ⚠️ 需要配置Heartbeat |

---

## ⚠️ 重要：改配置前必须手动备份！

**每次修改OpenClaw配置之前，你必须先手动运行备份命令！**

```bash
# 备份命令
python ~/.openclaw/snapshots/snapshot.py backup
```

如果不备份，出问题时将无法恢复！

---

## 安装步骤

### 1. 复制插件文件

把 `snap-doctor` 文件夹复制到：
```
~/.openclaw/extensions/snap-doctor/
```

### 2. 重启Gateway

```bash
openclaw gateway restart
```

### 3. 配置Heartbeat（推荐）

编辑 `~/.openclaw/workspace/HEARTBEAT.md`，添加：

```markdown
## SnapDoctor健康检查
- 每个心跳执行健康检查
- 运行: python ~/.openclaw/snapshots/snap_doctor.py check
- 如果失败，运行: python ~/.openclaw/snapshots/snap_doctor.py auto-recover
```

---

## 常用命令

| 命令 | 说明 |
|------|------|
| `python snapshot.py backup` | 手动备份（改配置前必做！）|
| `python snapshot.py list` | 查看快照列表 |
| `python snapshot.py restore <文件名>` | 恢复配置 |

---

## 故障排查

| 问题 | 解决方法 |
|------|----------|
| Gateway起不来 | 手动恢复快照 |
| 配置错了 | `snapshot.py restore` 恢复到正常版本 |
| 不知道用哪个快照 | 看列表，选最近的正常版本 |

---

## 适用范围

**这个插件只能恢复OpenClaw配置文件！**

| 能恢复 | 不能恢复 |
|--------|----------|
| openclaw.json配置 | 你的业务代码 |
| 插件配置 | 网站内容 |
| 认证信息 | 数据库数据 |

---

## 适用场景

- ✅ 防止改错配置导致Gateway起不来
- ✅ 睡觉时自动检查配置健康
- ✅ 一键回滚到正常配置

---

## 技术支持

有问题请提交Issue：https://github.com/HJH-611/snap-doctor/issues

---

*最后更新：2026-02-28*
