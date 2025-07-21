import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { readdir, stat } from "fs/promises";
import path from "path";
import mime from "mime-types";
import { createReadStream } from "fs";
import { Readable } from "stream";

const app = new Hono();

export interface FileEntry {
  name: string;
  url: string;
  isDirectory: boolean;
  size: string | number; // Biasanya string kalau "-", atau number kalau ukuran byte
  type: string;
  mtime: Date;
}

// Fungsi untuk generate HTML directory listing
const generateDirectoryHTML = (dirPath: string, files: any) => `
<!DOCTYPE html>
<html>
<head>
  <title>Index of ${dirPath}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 2rem }
    h1 { color: #333 }
    table { width: 100%; border-collapse: collapse }
    th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd }
    tr:hover { background-color: #f5f5f5 }
    a { color: #0066cc; text-decoration: none }
    a:hover { text-decoration: underline }
    .icon { width: 20px; margin-right: 5px; vertical-align: middle }
  </style>
</head>
<body>
  <h1>Index of ${dirPath}</h1>
  <table>
    <thead>
      <tr>
        <th>Name</th>
        <th>Size</th>
        <th>Type</th>
        <th>Last Modified</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td colspan="4"><a href="../">../ (Parent Directory)</a></td>
      </tr>
      ${files
        .map(
          (file: FileEntry) => `
        <tr>
          <td>
            <img src="${file.isDirectory ? "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iI2Y1OTgyMiIgZD0iTTEwIDRINGMtMS4xIDAtMiAuOS0yIDJzLjkgMiAyIDJoMTZjMS4xIDAgMi0uOSAyLTJzLS45LTItMi0ySDE2bC0yLTJoLTR6bTQgNHYxMGMwIDEuMS0uOSAyLTIgMkg0Yy0xLjEgMC0yLS45LTItMlY4aDE2eiIvPjwvc3ZnPg==" : "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iIzQyODVmNCIgZD0iTTYgMmMtMS4xIDAtMiAuOS0yIDJ2MTZjMCAxLjEuOSAyIDIgMmgxMmMxLjEgMCAyLS45IDItMlY4bC02LTZINnptMCAyaDd2NWg1djExSDZWNHoiLz48L3N2Zz4="}"  class="icon" alt="icon">
            <a href="${file.url}">${file.name}</a>
          </td>
          <td>${file.size}</td>
          <td>${file.type}</td>
          <td>${file.mtime.toLocaleString()}</td>
        </tr>
      `,
        )
        .join("")}
    </tbody>
  </table>
</body>
</html>
`;

// Handler utama untuk file dan directory
app.get("*", async (c) => {
  const requestedPath = c.req.path;
  const fsPath = path.join(process.cwd(), "public/static", requestedPath);

  try {
    const stats = await stat(fsPath);

    if (stats.isDirectory()) {
      const files = await readdir(fsPath);
      const fileDetails = await Promise.all(
        files.map(async (name): Promise<FileEntry> => {
          const fullPath = path.join(fsPath, name);
          const fileStat = await stat(fullPath);

          return {
            name,
            url: path.join(requestedPath, name),
            isDirectory: fileStat.isDirectory(),
            size: fileStat.isDirectory() ? "-" : formatFileSize(fileStat.size),
            type: fileStat.isDirectory()
              ? "Directory"
              : mime.lookup(name) || "Unknown",
            mtime: fileStat.mtime,
          };
        }),
      );

      return c.html(generateDirectoryHTML(requestedPath, fileDetails));
    } else {
      const fileStream = createReadStream(fsPath);
      const mimeType = mime.lookup(fsPath) || "application/octet-stream";

      return new Response(Readable.toWeb(fileStream) as any, {
        headers: {
          "Content-Type": mimeType,
          "Cache-Control": "public, max-age=3600",
        },
      });
    }
  } catch (error) {
    return c.text("File not found", 404);
  }
});

// Fungsi format ukuran file
function formatFileSize(bytes: number) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const exp = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, exp)).toFixed(1)} ${units[exp]}`;
}

// Jalankan server
serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server running on http://localhost:${info.port}`);
    console.log(`Access file browser at http://localhost:3000`);
  },
);
