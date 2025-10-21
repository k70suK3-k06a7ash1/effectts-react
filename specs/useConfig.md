# useConfig

**ステータス**: ✅ 実装済み

## 概要
Effect-TSのConfig APIを使用して、環境変数や設定値を型安全に取得するhook。デフォルト値、検証、変換をサポートします。

## ユースケース
- 環境変数の取得
- アプリケーション設定の管理
- フィーチャーフラグの制御
- API URLやキーの管理
- 環境別の設定切り替え
- 設定値の型安全な利用

## API設計

```typescript
function useConfig<A>(
  config: Config.Config<A>,
  options?: {
    fallback?: A;
    onError?: (error: ConfigError) => void;
  }
): {
  value: A | null;
  loading: boolean;
  error: ConfigError | null;
  reload: () => Promise<void>;
}
```

**パラメータ:**
- `config` - Effect Config定義
- `options.fallback` - エラー時のフォールバック値
- `options.onError` - エラー時のコールバック

**戻り値:**
- `value` - 設定値
- `loading` - ローディング状態
- `error` - エラー
- `reload` - 設定を再読み込みする関数

## 使用例

### 基本的な使用例

```typescript
import { useConfig } from 'effectts-react';
import * as Config from 'effect/Config';

function AppSettings() {
  const { value: apiUrl, loading, error } = useConfig(
    Config.string('API_URL')
  );

  const { value: timeout } = useConfig(
    Config.number('API_TIMEOUT').pipe(
      Config.withDefault(5000)
    )
  );

  const { value: debug } = useConfig(
    Config.boolean('DEBUG').pipe(
      Config.withDefault(false)
    )
  );

  if (loading) return <div>Loading configuration...</div>;
  if (error) return <div>Configuration error: {String(error)}</div>;

  return (
    <div>
      <div>API URL: {apiUrl}</div>
      <div>Timeout: {timeout}ms</div>
      <div>Debug Mode: {debug ? 'ON' : 'OFF'}</div>
    </div>
  );
}
```

### 複雑な設定オブジェクト

```typescript
import { useConfig } from 'effectts-react';
import * as Config from 'effect/Config';

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  ssl: boolean;
}

const dbConfig = Config.all({
  host: Config.string('DB_HOST'),
  port: Config.number('DB_PORT').pipe(Config.withDefault(5432)),
  database: Config.string('DB_NAME'),
  ssl: Config.boolean('DB_SSL').pipe(Config.withDefault(true)),
});

function DatabaseSettings() {
  const { value: config, loading, error } = useConfig<DatabaseConfig>(
    dbConfig,
    {
      fallback: {
        host: 'localhost',
        port: 5432,
        database: 'myapp',
        ssl: false,
      },
    }
  );

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <h2>Database Configuration</h2>
      <div>Host: {config?.host}</div>
      <div>Port: {config?.port}</div>
      <div>Database: {config?.database}</div>
      <div>SSL: {config?.ssl ? 'Enabled' : 'Disabled'}</div>
      {error && <div className="error">Error: {String(error)}</div>}
    </div>
  );
}
```

### フィーチャーフラグ

```typescript
import { useConfig } from 'effectts-react';
import * as Config from 'effect/Config';

const featureFlags = Config.all({
  newDashboard: Config.boolean('FEATURE_NEW_DASHBOARD').pipe(
    Config.withDefault(false)
  ),
  experimentalAPI: Config.boolean('FEATURE_EXPERIMENTAL_API').pipe(
    Config.withDefault(false)
  ),
  betaFeatures: Config.boolean('FEATURE_BETA').pipe(
    Config.withDefault(false)
  ),
});

function FeatureGatedComponent() {
  const { value: flags } = useConfig(featureFlags);

  return (
    <div>
      {flags?.newDashboard ? (
        <NewDashboard />
      ) : (
        <LegacyDashboard />
      )}

      {flags?.experimentalAPI && (
        <ExperimentalAPIPanel />
      )}

      {flags?.betaFeatures && (
        <BetaFeaturesSection />
      )}
    </div>
  );
}
```

### カスタム設定値の変換

```typescript
import { useConfig } from 'effectts-react';
import * as Config from 'effect/Config';

// カンマ区切りの文字列を配列に変換
const allowedOriginsConfig = Config.string('ALLOWED_ORIGINS').pipe(
  Config.map((str) => str.split(',').map((s) => s.trim()))
);

// JSON文字列をパース
const themeConfig = Config.string('THEME_CONFIG').pipe(
  Config.mapAttempt((str) => {
    try {
      return JSON.parse(str);
    } catch (e) {
      throw new Error('Invalid JSON in THEME_CONFIG');
    }
  })
);

function CorsSettings() {
  const { value: allowedOrigins } = useConfig<string[]>(
    allowedOriginsConfig,
    { fallback: ['http://localhost:3000'] }
  );

  const { value: theme } = useConfig(
    themeConfig,
    { fallback: { primary: '#000', secondary: '#fff' } }
  );

  return (
    <div>
      <h3>Allowed Origins</h3>
      <ul>
        {allowedOrigins?.map((origin) => (
          <li key={origin}>{origin}</li>
        ))}
      </ul>

      <h3>Theme</h3>
      <div>Primary: {theme?.primary}</div>
      <div>Secondary: {theme?.secondary}</div>
    </div>
  );
}
```

### 検証付き設定

```typescript
import { useConfig } from 'effectts-react';
import * as Config from 'effect/Config';

// ポート番号の検証
const portConfig = Config.number('PORT').pipe(
  Config.validate((port) => {
    if (port < 1 || port > 65535) {
      return Config.fail('Port must be between 1 and 65535');
    }
    return Config.succeed(port);
  })
);

// URLの検証
const apiUrlConfig = Config.string('API_URL').pipe(
  Config.validate((url) => {
    try {
      new URL(url);
      return Config.succeed(url);
    } catch (e) {
      return Config.fail('Invalid URL format');
    }
  })
);

function ValidatedSettings() {
  const { value: port, error: portError } = useConfig(portConfig);
  const { value: apiUrl, error: urlError } = useConfig(apiUrlConfig);

  return (
    <div>
      <div>
        Port: {port}
        {portError && <span className="error">{String(portError)}</span>}
      </div>
      <div>
        API URL: {apiUrl}
        {urlError && <span className="error">{String(urlError)}</span>}
      </div>
    </div>
  );
}
```

### 環境別設定

```typescript
import { useConfig } from 'effectts-react';
import * as Config from 'effect/Config';

const envConfig = Config.string('NODE_ENV').pipe(
  Config.withDefault('development')
);

const apiConfig = Config.all({
  baseUrl: Config.string('API_BASE_URL'),
  timeout: Config.number('API_TIMEOUT').pipe(Config.withDefault(30000)),
  retries: Config.number('API_RETRIES').pipe(Config.withDefault(3)),
});

function EnvironmentAwareComponent() {
  const { value: env } = useConfig(envConfig);
  const { value: api } = useConfig(apiConfig);

  const isProduction = env === 'production';

  return (
    <div>
      <div>Environment: {env}</div>
      <div>API Base URL: {api?.baseUrl}</div>
      <div>Timeout: {api?.timeout}ms</div>
      <div>Max Retries: {api?.retries}</div>

      {!isProduction && (
        <div className="dev-tools">
          <h3>Development Tools</h3>
          {/* デバッグツールなど */}
        </div>
      )}
    </div>
  );
}
```

### 設定の再読み込み

```typescript
import { useConfig } from 'effectts-react';
import * as Config from 'effect/Config';

function RefreshableConfig() {
  const { value, loading, reload } = useConfig(
    Config.all({
      apiUrl: Config.string('API_URL'),
      version: Config.string('APP_VERSION'),
    })
  );

  return (
    <div>
      <div>API URL: {value?.apiUrl}</div>
      <div>Version: {value?.version}</div>

      <button onClick={reload} disabled={loading}>
        {loading ? 'Reloading...' : 'Reload Config'}
      </button>
    </div>
  );
}
```

### Secret管理

```typescript
import { useConfig } from 'effectts-react';
import * as Config from 'effect/Config';

const secretsConfig = Config.all({
  apiKey: Config.secret('API_KEY'),
  dbPassword: Config.secret('DB_PASSWORD'),
});

function SecretsManager() {
  const { value: secrets, error } = useConfig(secretsConfig);

  // Secretは表示しない
  const hasApiKey = !!secrets?.apiKey;
  const hasDbPassword = !!secrets?.dbPassword;

  return (
    <div>
      <div>API Key: {hasApiKey ? '✓ Configured' : '✗ Missing'}</div>
      <div>DB Password: {hasDbPassword ? '✓ Configured' : '✗ Missing'}</div>
      {error && <div className="error">Configuration error</div>}
    </div>
  );
}
```

### 配列型の設定

```typescript
import { useConfig } from 'effectts-react';
import * as Config from 'effect/Config';

const allowedRolesConfig = Config.array(
  Config.string('ALLOWED_ROLE'),
  'ALLOWED_ROLES'
).pipe(
  Config.withDefault(['user', 'admin'])
);

function RoleSettings() {
  const { value: allowedRoles } = useConfig(allowedRolesConfig);

  return (
    <div>
      <h3>Allowed Roles</h3>
      <ul>
        {allowedRoles?.map((role) => (
          <li key={role}>{role}</li>
        ))}
      </ul>
    </div>
  );
}
```

## 実装詳細

```typescript
import { useState, useEffect, useCallback } from 'react';
import * as Effect from 'effect/Effect';
import * as Config from 'effect/Config';
import * as ConfigError from 'effect/ConfigError';

export function useConfig<A>(
  config: Config.Config<A>,
  options?: {
    fallback?: A;
    onError?: (error: ConfigError.ConfigError) => void;
  }
): {
  value: A | null;
  loading: boolean;
  error: ConfigError.ConfigError | null;
  reload: () => Promise<void>;
} {
  const [value, setValue] = useState<A | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ConfigError.ConfigError | null>(null);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await Effect.runPromise(
        Effect.config(config)
      );
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
  }, [config, options]);

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

## 環境変数の設定方法

### .env ファイル

```bash
# .env
API_URL=https://api.example.com
API_TIMEOUT=5000
DEBUG=true
DB_HOST=localhost
DB_PORT=5432
DB_NAME=myapp
ALLOWED_ORIGINS=http://localhost:3000,https://example.com
```

### process.env (Node.js)

```typescript
// Effect-TSは自動的にprocess.envから読み込む
process.env.API_URL = 'https://api.example.com';
```

### カスタムConfigProvider

より高度な設定管理には`useConfigProvider`を使用してください。

## テストケース

- ✅ 基本的な設定値の取得
- ✅ デフォルト値の使用
- ✅ 型変換（string, number, boolean）
- ✅ 複雑なオブジェクトの構築（Config.all）
- ✅ カスタム変換（Config.map, Config.mapAttempt）
- ✅ バリデーション
- ✅ エラーハンドリング
- ✅ フォールバック値
- ✅ reload機能
- ✅ Secret型の扱い
- ✅ 配列型の設定

## 注意事項

### 環境変数の命名

環境変数は大文字のスネークケースが一般的です：

```typescript
// 良い例
Config.string('API_URL')
Config.number('MAX_RETRIES')

// 避けるべき例
Config.string('apiUrl')
Config.number('maxRetries')
```

### Secretの扱い

Secret型の値は直接表示しないでください：

```typescript
// ❌ 悪い例
<div>API Key: {secrets?.apiKey}</div>

// ✅ 良い例
<div>API Key: {secrets?.apiKey ? 'Configured' : 'Not set'}</div>
```

### デフォルト値

本番環境で必須の設定には、デフォルト値を設定しないでください：

```typescript
// ❌ 本番環境で危険
Config.string('DATABASE_URL').pipe(
  Config.withDefault('localhost')
)

// ✅ 明示的にエラーにする
Config.string('DATABASE_URL')
```

## 関連Hooks

- [useConfigProvider](./useConfigProvider.md) - カスタム設定プロバイダー
- [EffectProvider](./EffectProvider.md) - アプリケーション全体への設定提供

## 参考

- [Effect Config Documentation](https://effect.website/docs/configuration)
- [12-Factor App - Config](https://12factor.net/config)
- [Environment Variables Best Practices](https://12factor.net/config)
