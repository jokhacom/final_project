// Презентации: PDF открывается прямо в браузере, PowerPoint — через просмотрщик Microsoft Office.
// Большие файлы и PowerPoint хранятся в Vercel Blob (подключение даёт BLOB_STORE_ID или BLOB_READ_WRITE_TOKEN):
// браузер шлёт файл на сайт частями по CHUNK_BYTES (лимит запроса Vercel ~4,5 МБ), сайт собирает и кладёт в Blob.

export const PRESENTATION_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ppt: "application/vnd.ms-powerpoint",
};
export const MAX_PRESENTATION_MB = 100;
export const CHUNK_BYTES = 3 * 1024 * 1024;

export const extOf = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";
export const isPowerPoint = (name: string) => ["ppt", "pptx"].includes(extOf(name));

// Файл из хранилища — через адрес нашего сайта (/files/…, см. middleware): у части провайдеров
// домен *.blob.vercel-storage.com недоступен («подключение сброшено»), а сайт открывается.
const BLOB_HOST = /^([a-z0-9]+)\.public\.blob\.vercel-storage\.com$/i;
export function sameSiteUrl(url: string) {
  const u = new URL(url);
  const m = u.hostname.match(BLOB_HOST);
  return m ? `/files/${m[1]}${u.pathname}` : url;
}

// Адрес для просмотра на сайте и для «Открыть в новой вкладке».
// PowerPoint открывает просмотрщик Microsoft — он сам скачивает файл из хранилища по прямой ссылке.
export function viewerUrl(p: { id: string; url: string | null; fileName: string }) {
  if (!p.url) return `/api/learning/presentations/${p.id}`;
  return isPowerPoint(p.fileName) ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(p.url)}` : sameSiteUrl(p.url);
}
