const MAX_DIMENSION = 1024
const MAX_SIZE_BYTES = 512 * 1024 // 512KB
const MAX_IMAGES = 4

/**
 * 从 File/Blob 读取并压缩为 base64 data URI。
 * 输出 JPEG，最大边 1024px，目标 < 512KB。
 */
export function fileToCompressedBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      let { width, height } = img
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)

      let quality = 0.85
      let dataUrl = canvas.toDataURL('image/jpeg', quality)
      // 逐步降质量直到满足大小限制
      while (dataUrl.length > MAX_SIZE_BYTES * 1.37 && quality > 0.3) {
        quality -= 0.1
        dataUrl = canvas.toDataURL('image/jpeg', quality)
      }
      resolve(dataUrl)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }
    img.src = url
  })
}

/**
 * 从 ClipboardEvent 中提取图片文件。
 */
export function getImagesFromClipboard(e: ClipboardEvent): File[] {
  const items = e.clipboardData?.items
  if (!items) return []
  const files: File[] = []
  for (const item of Array.from(items)) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile()
      if (file) files.push(file)
    }
  }
  return files
}

/**
 * 从 DragEvent 中提取图片文件。
 */
export function getImagesFromDrop(e: DragEvent): File[] {
  const files: File[] = []
  if (e.dataTransfer?.files) {
    for (const file of Array.from(e.dataTransfer.files)) {
      if (file.type.startsWith('image/')) files.push(file)
    }
  }
  return files
}

/**
 * 检查是否超过最大图片数量限制。
 */
export function canAddMoreImages(current: number, adding: number): number {
  return Math.min(adding, MAX_IMAGES - current)
}

export { MAX_IMAGES }
