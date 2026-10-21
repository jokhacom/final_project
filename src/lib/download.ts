// Заголовок для скачивания файла с русским именем: браузеры берут filename* (UTF-8),
// а латинское fallback — для старых программ.
export function contentDisposition(name: string, fallback: string) {
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
