# ProvideService

**ステータス**: ✅ 実装済み

**注**: ファイル名は`useProvideService.md`ですが、実際のエクスポートは`ProvideService`コンポーネントです。

## 概要
単一のサービスをシンプルに提供するコンポーネント。EffectProviderの軽量版として、Layerを使わずに直接サービスを提供します。

## ユースケース
- 小規模アプリケーションでの単一サービス提供
- コンポーネントツリーの一部にのみサービスを提供
- テスト時のモックサービス提供
- 動的なサービスの切り替え
- Layerを使わないシンプルな依存性注入

## API設計

```typescript
function ProvideService<I, S>({
  tag,
  service,
  children,
  fallback,
}: {
  tag: Context.Tag<I, S>;
  service: S;
  children: ReactNode;
  fallback?: ReactNode;
}): ReactElement
```

**パラメータ:**
- `tag` - サービスを識別するContext.Tag
- `service` - 提供するサービスの実装
- `children` - 子コンポーネント
- `fallback` - サービス初期化中に表示するフォールバック（オプション）

**戻り値:**
- `ReactElement` - サービスを提供するReactコンポーネント

## 使用例

### 基本的な使用例

```typescript
import { ProvideService } from 'effectts-react';
import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';

// サービス定義
class LoggerService extends Context.Tag('LoggerService')<
  LoggerService,
  {
    log: (message: string) => Effect.Effect<void>;
    error: (message: string) => Effect.Effect<void>;
  }
>() {}

// サービス実装
const consoleLogger = {
  log: (message: string) => Effect.sync(() => console.log(message)),
  error: (message: string) => Effect.sync(() => console.error(message)),
};

function App() {
  return (
    <ProvideService tag={LoggerService} service={consoleLogger}>
      <MyComponent />
    </ProvideService>
  );
}

// 子コンポーネントでサービスを使用
function MyComponent() {
  const logger = useService(LoggerService);

  const handleClick = () => {
    if (logger) {
      Effect.runPromise(logger.log('Button clicked!'));
    }
  };

  return <button onClick={handleClick}>Click me</button>;
}
```

### 複数のProvideServiceのネスト

```typescript
import { ProvideService } from 'effectts-react';

class ConfigService extends Context.Tag('ConfigService')<
  ConfigService,
  {
    apiUrl: string;
    timeout: number;
  }
>() {}

class AuthService extends Context.Tag('AuthService')<
  AuthService,
  {
    login: (username: string, password: string) => Effect.Effect<User>;
    logout: () => Effect.Effect<void>;
  }
>() {}

const config = {
  apiUrl: 'https://api.example.com',
  timeout: 5000,
};

const authService = {
  login: (username: string, password: string) =>
    Effect.gen(function* () {
      const config = yield* ConfigService;
      // Use config.apiUrl for login
      return { id: '1', name: username };
    }),
  logout: () => Effect.succeed(undefined),
};

function App() {
  return (
    <ProvideService tag={ConfigService} service={config}>
      <ProvideService tag={AuthService} service={authService}>
        <Dashboard />
      </ProvideService>
    </ProvideService>
  );
}
```

### テスト時のモックサービス

```typescript
import { ProvideService } from 'effectts-react';
import { render, screen } from '@testing-library/react';

class ApiService extends Context.Tag('ApiService')<
  ApiService,
  {
    fetchUser: (id: string) => Effect.Effect<User>;
  }
>() {}

// 本番実装
const realApiService = {
  fetchUser: (id: string) =>
    Effect.tryPromise(() => fetch(`/api/users/${id}`).then((r) => r.json())),
};

// モック実装
const mockApiService = {
  fetchUser: (id: string) =>
    Effect.succeed({ id, name: 'Test User', email: 'test@example.com' }),
};

// 本番環境
function App() {
  return (
    <ProvideService tag={ApiService} service={realApiService}>
      <UserProfile userId="123" />
    </ProvideService>
  );
}

// テスト環境
describe('UserProfile', () => {
  it('renders user data', async () => {
    render(
      <ProvideService tag={ApiService} service={mockApiService}>
        <UserProfile userId="123" />
      </ProvideService>
    );

    expect(await screen.findByText('Test User')).toBeInTheDocument();
  });
});
```

### 動的なサービスの切り替え

```typescript
import { ProvideService } from 'effectts-react';

class ThemeService extends Context.Tag('ThemeService')<
  ThemeService,
  {
    colors: {
      primary: string;
      secondary: string;
    };
    mode: 'light' | 'dark';
  }
>() {}

const lightTheme = {
  colors: { primary: '#007bff', secondary: '#6c757d' },
  mode: 'light' as const,
};

const darkTheme = {
  colors: { primary: '#0056b3', secondary: '#495057' },
  mode: 'dark' as const,
};

function ThemableApp() {
  const [isDark, setIsDark] = useState(false);
  const theme = isDark ? darkTheme : lightTheme;

  return (
    <ProvideService tag={ThemeService} service={theme}>
      <button onClick={() => setIsDark(!isDark)}>Toggle Theme</button>
      <ThemedComponent />
    </ProvideService>
  );
}

function ThemedComponent() {
  const theme = useService(ThemeService);

  return (
    <div
      style={{
        backgroundColor: theme?.mode === 'dark' ? '#333' : '#fff',
        color: theme?.colors.primary,
      }}
    >
      Current theme: {theme?.mode}
    </div>
  );
}
```

### 状態ベースのサービス実装

```typescript
import { ProvideService } from 'effectts-react';

class UserPreferencesService extends Context.Tag('UserPreferencesService')<
  UserPreferencesService,
  {
    language: string;
    notifications: boolean;
    updateLanguage: (lang: string) => Effect.Effect<void>;
    toggleNotifications: () => Effect.Effect<void>;
  }
>() {}

function PreferencesProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState('en');
  const [notifications, setNotifications] = useState(true);

  // 状態を含むサービス実装
  const preferencesService = useMemo(
    () => ({
      language,
      notifications,
      updateLanguage: (lang: string) =>
        Effect.sync(() => {
          setLanguage(lang);
        }),
      toggleNotifications: () =>
        Effect.sync(() => {
          setNotifications(!notifications);
        }),
    }),
    [language, notifications]
  );

  return (
    <ProvideService tag={UserPreferencesService} service={preferencesService}>
      {children}
    </ProvideService>
  );
}

function SettingsPanel() {
  const prefs = useService(UserPreferencesService);

  return (
    <div>
      <p>Language: {prefs?.language}</p>
      <button
        onClick={() =>
          prefs && Effect.runPromise(prefs.updateLanguage('ja'))
        }
      >
        Switch to Japanese
      </button>
      <p>Notifications: {prefs?.notifications ? 'ON' : 'OFF'}</p>
      <button
        onClick={() => prefs && Effect.runPromise(prefs.toggleNotifications())}
      >
        Toggle Notifications
      </button>
    </div>
  );
}
```

### 非同期サービスの初期化

```typescript
import { ProvideService } from 'effectts-react';

class DatabaseService extends Context.Tag('DatabaseService')<
  DatabaseService,
  {
    query: (sql: string) => Effect.Effect<any[]>;
    close: () => Effect.Effect<void>;
  }
>() {}

function DatabaseProvider({ children }: { children: ReactNode }) {
  const [dbService, setDbService] = useState<{
    query: (sql: string) => Effect.Effect<any[]>;
    close: () => Effect.Effect<void>;
  } | null>(null);

  useEffect(() => {
    // 非同期でDBを初期化
    const initDb = async () => {
      const db = await initializeDatabase();

      setDbService({
        query: (sql: string) =>
          Effect.tryPromise(() => db.execute(sql)),
        close: () =>
          Effect.tryPromise(() => db.close()),
      });
    };

    initDb();
  }, []);

  if (!dbService) {
    return <div>Initializing database...</div>;
  }

  return (
    <ProvideService
      tag={DatabaseService}
      service={dbService}
      fallback={<div>Loading database...</div>}
    >
      {children}
    </ProvideService>
  );
}
```

### 環境別のサービス実装

```typescript
import { ProvideService } from 'effectts-react';

class AnalyticsService extends Context.Tag('AnalyticsService')<
  AnalyticsService,
  {
    track: (event: string, data?: any) => Effect.Effect<void>;
  }
>() {}

// 本番環境: 実際のアナリティクス
const productionAnalytics = {
  track: (event: string, data?: any) =>
    Effect.tryPromise(() =>
      fetch('/analytics', {
        method: 'POST',
        body: JSON.stringify({ event, data }),
      })
    ).pipe(Effect.asVoid),
};

// 開発環境: コンソール出力のみ
const developmentAnalytics = {
  track: (event: string, data?: any) =>
    Effect.sync(() => console.log('Analytics:', event, data)),
};

function App() {
  const analytics =
    process.env.NODE_ENV === 'production'
      ? productionAnalytics
      : developmentAnalytics;

  return (
    <ProvideService tag={AnalyticsService} service={analytics}>
      <MainApp />
    </ProvideService>
  );
}
```

## 実装詳細

```typescript
import { createContext, useContext, ReactNode, ReactElement } from 'react';
import * as Context from 'effect/Context';

// サービスごとのReact Context
const ServiceContextMap = new WeakMap<
  Context.Tag<any, any>,
  React.Context<any>
>();

function getOrCreateServiceContext<I, S>(
  tag: Context.Tag<I, S>
): React.Context<S | null> {
  if (ServiceContextMap.has(tag)) {
    return ServiceContextMap.get(tag)!;
  }

  const context = createContext<S | null>(null);
  ServiceContextMap.set(tag, context);
  return context;
}

export function ProvideService<I, S>({
  tag,
  service,
  children,
  fallback,
}: {
  tag: Context.Tag<I, S>;
  service: S;
  children: ReactNode;
  fallback?: ReactNode;
}): ReactElement {
  const ServiceContext = getOrCreateServiceContext(tag);

  if (!service && fallback) {
    return <>{fallback}</>;
  }

  return (
    <ServiceContext.Provider value={service}>
      {children}
    </ServiceContext.Provider>
  );
}

// useServiceの実装も更新が必要
export function useService<I, S>(tag: Context.Tag<I, S>): S | null {
  const ServiceContext = getOrCreateServiceContext(tag);
  return useContext(ServiceContext);
}
```

## EffectProviderとの比較

| 機能 | ProvideService | EffectProvider |
|------|----------------|----------------|
| サービス数 | 単一 | 複数（Layer経由） |
| 複雑さ | ⭐ (シンプル) | ⭐⭐⭐⭐ (複雑) |
| 型安全性 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| パフォーマンス | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| サービス依存関係 | ❌ 未対応 | ✅ Layerで解決 |
| ネスト可能 | ✅ 手動でネスト | ✅ 自動マージ |
| 推奨用途 | 小規模・単一サービス | 大規模・複数サービス |

### いつProvideServiceを使うべきか

✅ **ProvideServiceを使う場合:**
- 単一のサービスのみが必要
- サービス間の依存関係がない
- 小規模なアプリケーション
- テスト時のモック提供
- シンプルさを重視

❌ **EffectProviderを使う場合:**
- 複数のサービスが必要
- サービス間に依存関係がある
- 大規模なアプリケーション
- Layerの機能（スコープ、ライフサイクル管理）が必要

## テストケース

- ✅ 基本的なサービス提供
- ✅ 子コンポーネントでのサービス取得
- ✅ 複数のProvideServiceネスト
- ✅ サービスの動的な更新
- ✅ サービス未提供時のnull返却
- ✅ fallbackの表示
- ✅ アンマウント時のクリーンアップ
- ✅ 同じタグの異なる実装の切り替え

## 注意事項

### サービスの更新

サービスオブジェクトが変更されると、すべての子コンポーネントが再レンダリングされます。パフォーマンス最適化のため、useMemoを使用してください。

```typescript
const service = useMemo(
  () => ({
    method: () => Effect.succeed(value),
  }),
  [value] // 依存する値のみ
);
```

### 依存関係の解決

ProvideServiceは単一サービスのみを提供します。サービスが他のサービスに依存する場合は、手動でネストするか、EffectProviderを使用してください。

```typescript
// 手動ネスト
<ProvideService tag={ConfigService} service={config}>
  <ProvideService tag={ApiService} service={apiService}>
    {children}
  </ProvideService>
</ProvideService>
```

## 関連Hooks/Components

- [useService](./useService.md) - サービスの取得（ProvideServiceと対）
- [EffectProvider](./EffectProvider.md) - 複数サービス提供（Layer使用）
- [useLayer](./useLayer.md) - Layer構築
- [useEffectContext](./useEffectContext.md) - Context直接操作

## 参考

- [Effect Services Documentation](https://effect.website/docs/context-management/services)
- [React Context Documentation](https://react.dev/reference/react/createContext)
