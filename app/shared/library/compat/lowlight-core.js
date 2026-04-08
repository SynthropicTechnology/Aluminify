import { createLowlight } from "lowlight";

// Compat layer for packages that still import `lowlight/lib/core`.
const lowlight = createLowlight();

export default lowlight;
export { createLowlight };
