# Video Downloader / 视频下载器

A local web app for analyzing and downloading public YouTube and Bilibili videos.

一个本地运行的视频下载网页应用，用于分析并下载公开的 YouTube 和 Bilibili 视频。

## Features / 功能

- Paste a YouTube or Bilibili video URL and analyze available formats.
- Choose a format and start a server-side download.
- Track download status and progress in the browser.
- Download the completed file from the web page.
- Keep only the 10 newest local download files; older files are deleted after a new download completes.

- 输入 YouTube 或 Bilibili 视频地址，分析可用清晰度/格式。
- 选择格式后由后端执行下载。
- 在网页中查看下载状态和进度。
- 下载完成后可通过网页按钮保存文件。
- 本地只保留最新 10 个下载文件；新下载完成后会自动删除最早的旧文件。

## Requirements / 环境依赖

- Node.js
- npm
- Packaged `yt-dlp` and `ffmpeg` binaries installed by npm

The app checks for `yt-dlp` and `ffmpeg` on startup. The npm install step downloads packaged binaries for deployments such as Vercel; if those are unavailable, the app falls back to system `yt-dlp` and `ffmpeg` commands.

应用启动后会检测 `yt-dlp` 和 `ffmpeg`。`npm install` 会下载适合 Vercel 等部署环境使用的内置二进制；如果内置二进制不可用，应用会回退到系统里的 `yt-dlp` 和 `ffmpeg` 命令。

## Local Usage / 本地使用

```bash
npm install
npm run local
```

Open:

打开：

```text
http://localhost:3000/video-downloader
```

The supported downloader runtime is local. Vercel is kept as a discovery/demo deployment, but cloud IPs commonly trigger YouTube bot checks and serverless functions are not reliable for long downloads.

本项目正式支持的下载运行环境是本机。Vercel 仅作为入口/演示部署；云端 IP 经常触发 YouTube 机器人校验，Serverless 函数也不适合长时间下载。

Optional local fallback if npm binary installation is skipped:

如果跳过了 npm 内置二进制安装，可以在本地额外安装系统命令作为备用：

```bash
brew install yt-dlp ffmpeg
```

## Development / 开发

```bash
npm run dev
```

## Production Build / 生产构建

```bash
npm run build
npm run start
```

## Tests / 测试

```bash
npm run test
npm run lint
npm run test:e2e
npm audit
```

## Local Files / 本地文件策略

Downloaded videos are saved under:

下载的视频会先保存到：

```text
downloads/
```

The `downloads/` directory is ignored by Git. After each successful download, the app keeps the 10 newest files in that directory and deletes older files. Failed or unfinished downloads do not trigger cleanup.

`downloads/` 目录不会进入 Git。每次新下载成功完成后，应用会在该目录中只保留最新 10 个文件，并删除更早的文件。失败或未完成的下载不会触发清理。

On Vercel, analyze and download API routes return a local-first warning instead of creating download jobs, so video files are not saved in the deployment environment.

在 Vercel 上，分析和下载接口会返回本地运行提示，不会创建下载任务，因此不会在部署环境中保存视频文件。

## Notes / 注意事项

- Use this only for public videos you are allowed to download.
- Some platforms may restrict formats, regions, login-only content, or copyrighted media.
- Run locally when you need to analyze or download videos.

- 仅用于下载你有权下载的公开视频。
- 平台可能会限制格式、地区、登录内容或版权内容。
- 需要分析或下载视频时，请在本机运行。
