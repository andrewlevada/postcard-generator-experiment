export function loadApiToken(page: PageNode): string | null {
    const lastNode = page.children[page.children.length - 1];

    if (lastNode.type !== 'TEXT') return null;

    return lastNode.characters;
}