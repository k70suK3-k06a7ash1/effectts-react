# ConfigProvider

**ステータス**: ✅ 実装済み

**注**: ファイル名は`useConfigProvider.md`ですが、実際のエクスポートは`ConfigProvider`コンポーネントと`useConfigProvider` hookです。

## 概要
カスタムConfigProviderを作成し、環境変数以外のソース（データベース、API、ローカルストレージなど）から設定を取得できるようにするコンポーネントとhook。

## ユースケース
- APIから設定を動的に取得
- データベースに保存された設定の利用
- ローカルストレージからの設定読み込み
- 複数の設定ソースの統合
- 設定のキャッシング
- リモート設定管理システムとの統合

## API設計

### ConfigProvider (Component)

```typescript
function ConfigProvider({
  provider,
  children,
  fallback,
}: {
  provider: ConfigProvider.ConfigProvider;
  children: ReactNode;
  fallback?: ReactNode;
}): ReactElement
```

### useConfigProvider (Hook)

```typescript
function useConfigProvider(): ConfigProvider.ConfigProvider | null
```

## 使用例

### 基本的な使用例 - カスタムソース

```typescript
import { ConfigProvider, useConfig } from 'effectts-react';
import * as ConfigProvider from 'effect/ConfigProvider';
import * as Config from 'effect/Config';

// カスタム設定マップ
const customConfig = new Map([
  ['API_URL', 'https://api.example.com'],
  ['API_TIMEOUT', '5000'],
  ['DEBUG', 'true'],
]);

// ConfigProviderを作成
const customProvider = ConfigProvider.fromMap(customConfig);

function App() {
  return (
    <ConfigProvider provider={customProvider}>
      <Settings />
    </ConfigProvider>
  );
}

function Settings() {
  const { value: apiUrl } = useConfig(Config.string('API_URL'));
  const { value: timeout } = useConfig(Config.number('API_TIMEOUT'));

  return (
    <div>
      <div>API URL: {apiUrl}</div>
      <div>Timeout: {timeout}ms</div>
    </div>
  );
}
```

### APIから設定を取得

```typescript
import { ConfigProvider } from 'effectts-react';
import * as ConfigProvider from 'effect/ConfigProvider';
import * as Effect from 'effect/Effect';

function App() {
  const [provider, setProvider] = useState<ConfigProvider.ConfigProvider | null>(
    null
  );

  useEffect(() => {
    const loadConfig = async () => {
      // APIから設定を取得
      const response = await fetch('/api/config');
      const config = await response.json();

      // MapからConfigProviderを作成
      const configMap = new Map(Object.entries(config));
      const provider = ConfigProvider.fromMap(configMap);

      setProvider(provider);
    };

    loadConfig();
  }, []);

  if (!provider) {
    return <div>Loading configuration...</div>;
  }

  return (
    <ConfigProvider provider={provider}>
      <MainApp />
    </ConfigProvider>
  );
}
```

### 複数ソースの統合

```typescript
import { ConfigProvider } from 'effectts-react';
import * as ConfigProvider from 'effect/ConfigProvider';

function App() {
  const [provider, setProvider] = useState<ConfigProvider.ConfigProvider | null>(
    null
  );

  useEffect(() => {
    const createComposedProvider = async () => {
      // 1. APIから動的設定を取得
      const apiConfig = await fetch('/api/config').then((r) => r.json());
      const apiProvider = ConfigProvider.fromMap(
        new Map(Object.entries(apiConfig))
      );

      // 2. ローカルストレージから取得
      const localConfig = new Map();
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('APP_')) {
          localConfig.set(key, localStorage.getItem(key));
        }
      }
      const localProvider = ConfigProvider.fromMap(localConfig);

      // 3. 環境変数（デフォルト）
      const envProvider = ConfigProvider.fromEnv();

      // 優先順位: Local > API > Env
      const composedProvider = ConfigProvider.orElse(
        localProvider,
        () => ConfigProvider.orElse(apiProvider, () => envProvider)
      );

      setProvider(composedProvider);
    };

    createComposedProvider();
  }, []);

  if (!provider) return <div>Loading...</div>;

  return (
    <ConfigProvider provider={provider}>
      <App />
    </ConfigProvider>
  );
}
```

### フラット化された設定

```typescript
import { ConfigProvider } from 'effectts-react';
import * as ConfigProvider from 'effect/ConfigProvider';

// ネストされた設定をフラット化
const nestedConfig = {
  api: {
    url: 'https://api.example.com',
    timeout: 5000,
    retries: 3,
  },
  database: {
    host: 'localhost',
    port: 5432,
  },
};

// フラット化: "api.url", "api.timeout", "database.host"
const flattenConfig = (obj: any, prefix = ''): Map<string, string> => {
  const map = new Map();

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === 'object' && value !== null) {
      const nested = flattenConfig(value, fullKey);
      nested.forEach((v, k) => map.set(k, v));
    } else {
      map.set(fullKey, String(value));
    }
  }

  return map;
};

function App() {
  const flatConfig = flattenConfig(nestedConfig);
  const provider = ConfigProvider.fromMap(flatConfig);

  return (
    <ConfigProvider provider={provider}>
      <Settings />
    </ConfigProvider>
  );
}

function Settings() {
  const { value: apiUrl } = useConfig(Config.string('api.url'));
  const { value: dbHost } = useConfig(Config.string('database.host'));

  return (
    <div>
      <div>API URL: {apiUrl}</div>
      <div>DB Host: {dbHost}</div>
    </div>
  );
}
```

### 動的な設定更新

```typescript
import { ConfigProvider, useConfigProvider } from 'effectts-react';
import * as ConfigProvider from 'effect/ConfigProvider';

function App() {
  const [configMap, setConfigMap] = useState(
    new Map([
      ['THEME', 'light'],
      ['LANGUAGE', 'en'],
    ])
  );

  const provider = useMemo(
    () => ConfigProvider.fromMap(configMap),
    [configMap]
  );

  const updateConfig = (key: string, value: string) => {
    setConfigMap((prev) => {
      const next = new Map(prev);
      next.set(key, value);
      return next;
    });
  };

  return (
    <ConfigProvider provider={provider}>
      <ThemeSelector onThemeChange={(theme) => updateConfig('THEME', theme)} />
      <LanguageSelector onLanguageChange={(lang) => updateConfig('LANGUAGE', lang)} />
      <MainContent />
    </ConfigProvider>
  );
}
```

### プレフィックス付き設定

```typescript
import { ConfigProvider } from 'effectts-react';
import * as ConfigProvider from 'effect/ConfigProvider';

// 環境変数に "APP_" プレフィックスを追加
const envProvider = ConfigProvider.fromEnv().pipe(
  ConfigProvider.nested('APP')
);

// "API_URL" の代わりに "APP_API_URL" として読み込まれる
function App() {
  return (
    <ConfigProvider provider={envProvider}>
      <Settings />
    </ConfigProvider>
  );
}

function Settings() {
  // "APP_API_URL" から読み込まれる
  const { value: apiUrl } = useConfig(Config.string('API_URL'));

  return <div>API URL: {apiUrl}</div>;
}
```

### 設定のキャッシング

```typescript
import { ConfigProvider } from 'effectts-react';
import * as ConfigProvider from 'effect/ConfigProvider';
import * as Effect from 'effect/Effect';

function App() {
  const [provider, setProvider] = useState<ConfigProvider.ConfigProvider | null>(
    null
  );

  useEffect(() => {
    const createCachedProvider = async () => {
      // キャッシュ機能付きProvider
      const baseProvider = ConfigProvider.fromFlat({
        load: async (key) => {
          // キャッシュをチェック
          const cached = sessionStorage.getItem(`config:${key}`);
          if (cached) {
            return cached;
          }

          // APIから取得
          const response = await fetch(`/api/config/${key}`);
          const value = await response.text();

          // キャッシュに保存
          sessionStorage.setItem(`config:${key}`, value);

          return value;
        },
      });

      setProvider(baseProvider);
    };

    createCachedProvider();
  }, []);

  if (!provider) return <div>Loading...</div>;

  return (
    <ConfigProvider provider={provider}>
      <App />
    </ConfigProvider>
  );
}
```

### 環境別設定プロバイダー

```typescript
import { ConfigProvider } from 'effectts-react';
import * as ConfigProvider from 'effect/ConfigProvider';

function App() {
  const env = process.env.NODE_ENV || 'development';

  const provider = useMemo(() => {
    switch (env) {
      case 'production':
        return ConfigProvider.fromMap(
          new Map([
            ['API_URL', 'https://api.production.com'],
            ['DEBUG', 'false'],
          ])
        );

      case 'staging':
        return ConfigProvider.fromMap(
          new Map([
            ['API_URL', 'https://api.staging.com'],
            ['DEBUG', 'true'],
          ])
        );

      default:
        return ConfigProvider.fromMap(
          new Map([
            ['API_URL', 'http://localhost:3000'],
            ['DEBUG', 'true'],
          ])
        );
    }
  }, [env]);

  return (
    <ConfigProvider provider={provider}>
      <App />
    </ConfigProvider>
  );
}
```

### ネストされたConfigProvider

```typescript
import { ConfigProvider } from 'effectts-react';
import * as ConfigProvider from 'effect/ConfigProvider';

function App() {
  const globalProvider = ConfigProvider.fromMap(
    new Map([
      ['API_URL', 'https://api.example.com'],
      ['THEME', 'light'],
    ])
  );

  return (
    <ConfigProvider provider={globalProvider}>
      <MainApp />

      {/* 特定のセクションでは異なる設定を使用 */}
      <AdminSection />
    </ConfigProvider>
  );
}

function AdminSection() {
  const adminProvider = ConfigProvider.fromMap(
    new Map([
      ['API_URL', 'https://admin-api.example.com'],
      ['DEBUG', 'true'],
    ])
  );

  return (
    <ConfigProvider provider={adminProvider}>
      <AdminDashboard />
    </ConfigProvider>
  );
}
```

## 実装詳細

```typescript
import { createContext, useContext, ReactNode, ReactElement } from 'react';
import * as ConfigProvider from 'effect/ConfigProvider';

const ConfigProviderContext = createContext<ConfigProvider.ConfigProvider | null>(
  null
);

export function ConfigProvider({
  provider,
  children,
  fallback,
}: {
  provider: ConfigProvider.ConfigProvider;
  children: ReactNode;
  fallback?: ReactNode;
}): ReactElement {
  if (!provider && fallback) {
    return <>{fallback}</>;
  }

  return (
    <ConfigProviderContext.Provider value={provider}>
      {children}
    </ConfigProviderContext.Provider>
  );
}

export function useConfigProvider(): ConfigProvider.ConfigProvider | null {
  return useContext(ConfigProviderContext);
}

// useConfigの実装も更新
export function useConfig<A>(
  config: Config.Config<A>,
  options?: {
    fallback?: A;
    onError?: (error: ConfigError) => void;
  }
): {
  value: A | null;
  loading: boolean;
  error: ConfigError.ConfigError | null;
  reload: () => Promise<void>;
} {
  const provider = useConfigProvider();
  const [value, setValue] = useState<A | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ConfigError.ConfigError | null>(null);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const effect = provider
        ? Effect.config(config).pipe(
            Effect.provideConfigProvider(provider)
          )
        : Effect.config(config);

      const result = await Effect.runPromise(effect);
      setValue(result);
    } catch (err) {
      const configError = err as ConfigError.ConfigError;
      setError(configError);
      options?.onError?.(configError);

      if (options?.fallback !== undefined) {
        setValue(options.fallback);
      }
    } finally {
      setLoading(false);
    }
  }, [config, provider, options]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const reload = useCallback(async () => {
    await loadConfig();
  }, [loadConfig]);

  return {
    value,
    loading,
    error,
    reload,
  };
}
```

## ConfigProviderの作成方法

### Map から作成

```typescript
const provider = ConfigProvider.fromMap(
  new Map([
    ['KEY', 'value'],
  ])
);
```

### 環境変数から作成

```typescript
const provider = ConfigProvider.fromEnv();
```

### カスタムロード関数

```typescript
const provider = ConfigProvider.fromFlat({
  load: async (key: string) => {
    // カスタムロジック
    return await fetchConfigValue(key);
  },
});
```

### 複数プロバイダーの結合

```typescript
const combined = ConfigProvider.orElse(
  provider1,
  () => provider2
);
```

## テストケース

- ✅ 基本的なConfigProvider の使用
- ✅ カスタムソースからの設定取得
- ✅ 複数ソースの統合
- ✅ プロバイダーの変更
- ✅ ネストされたプロバイダー
- ✅ フォールバック処理
- ✅ エラーハンドリング
- ✅ useConfigProviderでの取得
- ✅ アンマウント時のクリーンアップ

## 注意事項

### プロバイダーの変更

ConfigProviderが変更されると、すべての子コンポーネントで設定が再読み込みされます。パフォーマンスに注意してください。

```typescript
// useMemoで安定化
const provider = useMemo(
  () => ConfigProvider.fromMap(configMap),
  [configMap]
);
```

### セキュリティ

機密情報をクライアントサイドに保存しないでください：

```typescript
// ❌ 危険
const provider = ConfigProvider.fromMap(
  new Map([
    ['DB_PASSWORD', 'secret123'], // クライアントに公開される！
  ])
);
```

### 非同期読み込み

設定の読み込みが遅い場合は、フォールバックUIを表示してください：

```typescript
<ConfigProvider provider={provider} fallback={<Loading />}>
  {children}
</ConfigProvider>
```

## useConfig vs ConfigProvider

| 機能 | useConfig | ConfigProvider |
|------|-----------|----------------|
| 用途 | 設定値の取得 | 設定ソースの提供 |
| スコープ | コンポーネント単位 | ツリー全体 |
| 推奨使用 | 設定を使う側 | 設定を提供する側 |

## 関連Hooks

- [useConfig](./useConfig.md) - 設定値の取得
- [EffectProvider](./EffectProvider.md) - アプリケーション全体への設定提供

## 参考

- [Effect ConfigProvider Documentation](https://effect.website/docs/configuration/config-provider)
- [React Context Best Practices](https://react.dev/reference/react/useContext)
- [Configuration Management Patterns](https://12factor.net/config)
