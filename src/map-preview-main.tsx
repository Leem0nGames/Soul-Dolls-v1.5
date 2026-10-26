import { createRoot } from 'react-dom/client';
import VillaMapPreviewApp from './game/experimental/VillaMapPreviewApp';

const root = document.getElementById('map-preview-root');
if (!root) throw new Error('Missing map preview root element');

createRoot(root).render(<VillaMapPreviewApp />);
