// Resolves DTCG semantic colour tokens to hex for one theme. Used by the contrast audit and by
// the build; references point at primitives only (docs 11 §2).
import primitives from './tokens/primitives.tokens.json' with { type: 'json' };
import semantic from './tokens/semantic.tokens.json' with { type: 'json' };

export const THEMES = ['light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

type Leaf = { $value: string; $extensions?: { 'kp.theme'?: { dark?: string } } };

const REFERENCE = /^\{([a-z0-9.-]+)\}$/;

function isLeaf(node: unknown): node is Leaf {
  return typeof node === 'object' && node !== null && '$value' in node;
}

function childEntries(node: unknown): [string, unknown][] {
  if (typeof node !== 'object' || node === null) return [];
  return Object.entries(node).filter(([key]) => !key.startsWith('$'));
}

/** Flattens a token tree into `path → leaf`, e.g. `color.green.700`. */
function flatten(node: unknown, prefix: string, into: Map<string, Leaf>): Map<string, Leaf> {
  for (const [key, child] of childEntries(node)) {
    const path = prefix === '' ? key : `${prefix}.${key}`;
    if (isLeaf(child)) into.set(path, child);
    else flatten(child, path, into);
  }
  return into;
}

function resolveReference(primitivesByPath: ReadonlyMap<string, Leaf>, value: string): string {
  if (!REFERENCE.test(value))
    throw new Error(`Semantic token must reference a primitive: ${value}`);
  const path = value.slice(1, -1);
  const target = primitivesByPath.get(path);
  if (target === undefined) throw new Error(`Unknown primitive ${path}`);
  return target.$value.toLowerCase();
}

export type ColorResolver = (theme: Theme) => ReadonlyMap<string, string>;

/** Builds a resolver from DTCG trees; throws on references that do not point at a primitive. */
export function createColorResolver(
  primitiveTree: unknown,
  semanticColorTree: unknown,
): ColorResolver {
  const primitivesByPath = flatten(primitiveTree, '', new Map());
  const semanticColors = flatten(semanticColorTree, '', new Map());
  return (theme) => {
    const resolved = new Map<string, string>();
    for (const [name, leaf] of semanticColors) {
      const dark = leaf.$extensions?.['kp.theme']?.dark;
      const value = theme === 'dark' && dark !== undefined ? dark : leaf.$value;
      resolved.set(name, resolveReference(primitivesByPath, value));
    }
    return resolved;
  };
}

/** Semantic colour names (`bg.surface`, `status.up-fg`, …) mapped to hex for the theme. */
export const resolveSemanticColors: ColorResolver = createColorResolver(primitives, semantic.color);
