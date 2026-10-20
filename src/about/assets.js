import CURSORMESH from '../../assets/cursormesh.json';
import CARDS from '../../assets/cards.json';
import { loadMesh, loadLogoGeometry } from '../three/mesh.js';

export { loadLogoGeometry };
export const loadCursorGeometry = () => loadMesh(CURSORMESH);
export { CARDS };
