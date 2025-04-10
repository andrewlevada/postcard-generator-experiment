export function hexToRgb(hex: string): RGB {
    const justHex = hex.startsWith("#") ? hex.slice(1) : hex;

    if (justHex.length !== 6) {
        throw new Error(`Invalid hex color: ${hex}`);
    }

    return {
        r: parseInt(justHex.slice(0, 2), 16) / 255,
        g: parseInt(justHex.slice(2, 4), 16) / 255,
        b: parseInt(justHex.slice(4, 6), 16) / 255,
    };
}