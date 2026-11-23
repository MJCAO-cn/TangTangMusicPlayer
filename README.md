# 糖糖音乐播放器

糖糖音乐播放器（TangTang Music Player）是基于 [AlgerMusicPlayer](https://github.com/algerkong/AlgerMusicPlayer) 二次开发的桌面音乐播放器项目。

## 项目目标

- Windows 与 macOS 桌面端
- 音乐搜索、播放、歌词、歌单与本地音乐管理
- 收藏歌曲时自动加入本地下载队列
- 下载任务管理与下载目录配置
- 持续进行代码质量、稳定性与安全性改进

## 开发环境

- Node.js 24
- npm

```bash
npm install
npm run dev
```

## 构建安装包

```bash
# Windows
npm run build:win

# macOS Intel
npm run build:mac:x64

# macOS Apple Silicon
npm run build:mac:arm64
```

也可以推送符合项目工作流约定的版本标签，触发 GitHub Actions 构建与发布。

## 上游项目与许可说明

本项目基于 AlgerMusicPlayer 修改。上游项目及其原始作者的版权、许可证和相关声明应得到保留；请在分发前核对上游仓库中的 LICENSE 与 README 声明，并确认第三方音乐服务、音源插件、音乐文件及相关内容的使用和分发权限。

上游项目：
https://github.com/algerkong/AlgerMusicPlayer

本项目不代表任何音乐平台的官方产品。请仅在拥有合法使用权限的范围内使用音乐资源。
