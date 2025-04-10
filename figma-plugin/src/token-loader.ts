export function loadApiToken(page: PageNode): string | null {
    const lastNode = page.children[0];

    if (lastNode.type !== 'TEXT') return null;

    return lastNode.characters;
}