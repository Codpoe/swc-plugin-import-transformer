import * as swc from '@swc/core';
import { ImportTransformer } from '../src/index';

test(`import { debounce, throttle } from 'lodash'`, () => {
  const { code } = swc.transformSync(
    `import { debounce, throttle } from 'lodash'`,
    {
      plugin: m =>
        new ImportTransformer({
          lodash: {
            transform: '[source]/[name]',
          },
        }).visitProgram(m),
    }
  );

  expect(code).toBe(`import debounce from 'lodash/debounce';
import throttle from 'lodash/throttle';
`);
});

test(`import { Button, DatePicker } from 'antd'`, () => {
  const { code } = swc.transformSync(
    `import { Button, DatePicker } from 'antd'`,
    {
      plugin: m =>
        new ImportTransformer({
          antd: {
            transform: '[source]/lib/[name:-]',
          },
        }).visitProgram(m),
    }
  );

  expect(code).toBe(`import Button from 'antd/lib/button';
import DatePicker from 'antd/lib/date-picker';
`);
});

test(`camel to dash`, () => {
  const { code } = swc.transformSync(`import { DatePicker } from 'antd'`, {
    plugin: m =>
      new ImportTransformer({
        antd: {
          transform: 'antd/lib/[name:-]',
        },
      }).visitProgram(m),
  });

  expect(code).toBe(`import DatePicker from 'antd/lib/date-picker';\n`);
});

test(`camel to underline`, () => {
  const { code } = swc.transformSync(`import { DatePicker } from 'antd'`, {
    plugin: m =>
      new ImportTransformer({
        antd: {
          transform: 'antd/lib/[name:_]',
        },
      }).visitProgram(m),
  });

  expect(code).toBe(`import DatePicker from 'antd/lib/date_picker';\n`);
});

test(`unexpected key`, () => {
  expect(() => {
    swc.transformSync(`import { DatePicker } from 'antd'`, {
      plugin: m =>
        new ImportTransformer({
          antd: {
            transform: 'antd/lib/[abc]',
          },
        }).visitProgram(m),
    });
  }).toThrow(
    new Error(
      '[swc-plugin-import-transformer] Unexpected key `abc` in `antd/lib/[abc]`'
    )
  );
});

test('transform return string[]', () => {
  const { code } = swc.transformSync(`import { DatePicker } from 'antd'`, {
    plugin: m =>
      new ImportTransformer({
        antd: ['antd/lib/[name:-]', 'antd/lib/[name:-]/style'],
      }).visitProgram(m),
  });

  expect(code).toBe(`import DatePicker from 'antd/lib/date-picker';
import 'antd/lib/date-picker/style';
`);
});

test('custom transform function', () => {
  const { code } = swc.transformSync(`import { Button } from 'antd'`, {
    plugin: m =>
      new ImportTransformer({
        antd: ({ name }) => `antd/es/${name.toLowerCase()}`,
      }).visitProgram(m),
  });

  expect(code).toBe(`import Button from 'antd/es/button';\n`);
});

test('custom transform function in a file', () => {
  const { code } = swc.transformSync(`import { Button } from 'antd'`, {
    plugin: m =>
      new ImportTransformer({
        antd: './__tests__/transform.js',
      }).visitProgram(m),
  });

  expect(code).toBe(`import Button from 'antd/es/button';\n`);
});

test('custom transform function return falsy value', () => {
  const { code } = swc.transformSync(
    `import { Button, DatePicker } from 'antd'`,
    {
      plugin: m =>
        new ImportTransformer({
          antd: ({ name }) =>
            name === 'Button' ? `antd/es/${name.toLowerCase()}` : null,
        }).visitProgram(m),
    }
  );

  expect(code).toBe(`import Button from 'antd/es/button';\n`);
});

test('skip items that are not ImportDeclaration', () => {
  const { code } = swc.transformSync(
    `import { debounce } from 'lodash'
  console.log('Hello World')`,
    {
      plugin: m =>
        new ImportTransformer({
          lodash: 'lodash/[name]',
        }).visitProgram(m),
    }
  );

  expect(code).toBe(`import debounce from 'lodash/debounce';
console.log('Hello World');
`);
});

test('skip items that are import type', () => {
  const { code } = swc.transformSync(
    `import { debounce } from 'lodash';
  import type { DebounceSettings } from 'lodash';
  debounce();`,
    {
      jsc: {
        parser: {
          syntax: 'typescript',
        },
      },
      plugin: m =>
        new ImportTransformer({
          lodash: 'lodash/[name]',
        }).visitProgram(m),
    }
  );

  expect(code).toBe(`import debounce from 'lodash/debounce';
debounce();
`);
});

test('skip items that are not NamedImport', () => {
  const { code } = swc.transformSync(`import _ from 'lodash'`, {
    plugin: m =>
      new ImportTransformer({
        lodash: 'lodash/[name]',
      }).visitProgram(m),
  });

  expect(code).toBe(`import _ from 'lodash';\n`);
});

test('skip items that are not configured', () => {
  const { code } = swc.transformSync(
    `import { debounce } from 'lodash'
    import { throttle } from 'lodash'
    import { Button } from 'antd'`,
    {
      plugin: m =>
        new ImportTransformer({
          lodash: 'lodash/[name]',
        }).visitProgram(m),
    }
  );

  expect(code).toBe(`import debounce from 'lodash/debounce';
import throttle from 'lodash/throttle';
import { Button } from 'antd';
`);
});
