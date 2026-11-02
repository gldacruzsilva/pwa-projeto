import { Avatar, Box, Button } from '@mui/material';
import { Inventory2 } from '@mui/icons-material';
import { toast } from 'sonner';
import { encodeProductImage } from '../utils/productImage';

interface ProductImagePickerProps {
  image: string;
  onChange: (image: string) => void;
}

export default function ProductImagePicker({ image, onChange }: ProductImagePickerProps) {
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      onChange(await encodeProductImage(file));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível carregar a imagem.');
    } finally {
      event.target.value = '';
    }
  };

  return (
    <Box display="flex" alignItems="center" gap={2}>
      <Box>
        <Button component="label" variant="outlined">
          Selecionar foto
          <input hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} />
        </Button>
        {image && (
          <Button size="small" onClick={() => onChange('')}>
            Remover foto
          </Button>
        )}
      </Box>
      <Avatar src={image || undefined} variant="rounded" sx={{ width: 72, height: 72, bgcolor: 'action.hover' }}>
        <Inventory2 />
      </Avatar>
    </Box>
  );
}
