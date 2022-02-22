import { createRequire } from 'module';
import { ModuleItem, StringLiteral, NamedImportSpecifier } from '@swc/core';
import { Visitor } from '@swc/core/Visitor';

const require = createRequire(import.meta.url);

export interface TransformCtx {
  source: string;
  name: string;
}

export type TransformFn = (
  ctx: TransformCtx
) => string | string[] | undefined | null | false;

export type Transform = string | string[] | TransformFn;

export interface Config {
  transform: Transform;
  // TODO
  style?: boolean | string;
}

function toArray<T>(data: T | T[]): T[] {
  return Array.isArray(data) ? data : [data];
}

function transCamel(str: string, symbol?: string) {
  if (!symbol) {
    return str;
  }
  str = str[0].toLowerCase() + str.substr(1);
  return str.replace(/([A-Z])/g, $1 => `${symbol}${$1.toLowerCase()}`);
}

export class ImportTransformer extends Visitor {
  private configMap: Record<string, Config>;

  constructor(configMap: Record<string, Config>) {
    super();

    this.configMap = configMap;
  }

  visitModuleItems(items: ModuleItem[]): ModuleItem[] {
    const newItems: ModuleItem[] = [];

    for (const item of items) {
      if (item.type !== 'ImportDeclaration') {
        newItems.push(item);
        continue;
      }

      const { source, specifiers } = item;
      const config = this.configMap[source.value];

      if (!config) {
        newItems.push(item);
        continue;
      }

      const transform = this.getTransform(config);

      for (const specifier of specifiers) {
        if (specifier.type !== 'ImportSpecifier') {
          newItems.push(item);
          continue;
        }

        const name = specifier.local.value;

        this.runTransform(config, transform, {
          source: source.value,
          name,
        }).map(transformed => {
          const newSource: StringLiteral = {
            ...item.source,
            value: transformed,
          };
          const newSpecifier: NamedImportSpecifier = { ...specifier };

          newItems.push({
            ...item,
            source: newSource,
            specifiers: [newSpecifier],
          });
        });
      }
    }

    return newItems;
  }

  getTransform(config: Config): Transform {
    if (
      typeof config.transform === 'string' &&
      config.transform.endsWith('.js') &&
      !config.transform.includes('[')
    ) {
      return require(config.transform);
    }

    return config.transform;
  }

  runTransform(
    config: Config,
    transform: Transform,
    ctx: TransformCtx
  ): string[] {
    return toArray(typeof transform === 'function' ? transform(ctx) : transform)
      .map(pattern => {
        if (!pattern) {
          return undefined;
        }
        return pattern.replace(
          /\[(.+?)(?::(.+?))?\]/g,
          (m, key: keyof TransformCtx, symbol?: string) =>
            (symbol ? transCamel(ctx[key], symbol) : ctx[key]) || m
        );
      })
      .filter((x): x is string => !!x);
  }
}

export default ImportTransformer;
