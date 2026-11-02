const MAX_IMAGE_DATA_URL_LENGTH = 2_500_000;

export async function encodeProductImage(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Selecione uma imagem JPG, PNG ou WebP.');
  }

  const image = await createImageBitmap(file);
  try {
    const maxDimension = 640;
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));

    const context = canvas.getContext('2d');
    if (!context) throw new Error('Não foi possível processar a imagem.');

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/webp', 0.82);
    if (dataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
      throw new Error('A imagem ficou muito grande. Escolha outra imagem.');
    }

    return dataUrl;
  } finally {
    image.close();
  }
}
