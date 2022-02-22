import path from 'path';
import { ModuleItem, StringLiteral, ImportDefaultSpecifier } from '@swc/core';
import { Visitor } from '@swc/core/Visitor';

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

function transCamel(str: string, symbol: string) {
  str = str[0].toLowerCase() + str.substring(1);
  return str.replace(/([A-Z])/g, $1 => `${symbol}${$1.toLowerCase()}`);
}

function getTransform(config: Config): Transform {
  if (
    typeof config.transform === 'string' &&
    config.transform.endsWith('.js') &&
    !config.transform.includes('[')
  ) {
    const absolutePath = path.resolve(process.cwd(), config.transform);
    return require(absolutePath);
  }

  return config.transform;
}

function runTransform(
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
        (_, key: keyof TransformCtx, symbol?: string) => {
          if (!(key in ctx)) {
            throw new Error(
              `[swc-plugin-import-transformer] Unexpected key \`${key}\` in \`${pattern}\``
            );
          }
          return symbol ? transCamel(ctx[key], symbol) : ctx[key];
        }
      );
    })
    .filter((x): x is string => !!x);
}

export class ImportTransformer extends Visitor {
  private configMap: Record<string, Config>;

  constructor(userConfigMap: Record<string, Transform | Config>) {
    super();

    this.configMap = Object.keys(userConfigMap).reduce<Record<string, Config>>(
      (res, key) => {
        const userConfig = userConfigMap[key];
        res[key] =
          typeof userConfig === 'string' ||
          typeof userConfig === 'function' ||
          Array.isArray(userConfig)
            ? { transform: userConfig }
            : userConfig;
        return res;
      },
      {}
    );
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

      const transform = getTransform(config);

      for (const specifier of specifiers) {
        if (specifier.type !== 'ImportSpecifier') {
          newItems.push(item);
          continue;
        }

        const name = specifier.local.value;

        runTransform(config, transform, {
          source: source.value,
          name,
        }).map((transformed, index) => {
          const newSource: StringLiteral = {
            ...item.source,
            value: transformed,
          };

          if (index === 0) {
            const newSpecifier: ImportDefaultSpecifier = {
              ...specifier,
              type: 'ImportDefaultSpecifier',
            };

            newItems.push({
              ...item,
              source: newSource,
              specifiers: [newSpecifier],
            });
          } else {
            newItems.push({
              ...item,
              source: newSource,
              specifiers: [],
            });
          }
        });
      }
    }

    return newItems;
  }
}

export default ImportTransformer;
